import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { getPlan, PLANS } from '../lib/plans';
import { createFlowPayment, getFlowPaymentStatus, isFlowConfigured } from '../lib/flow';
import { requireAuth } from '../middlewares/requireAuth';

// Cobro de la suscripción del SaaS (lo que el centro paga a PreuFlow), vía
// Flow. Sin credenciales el checkout responde { available: false } y el
// frontend muestra un aviso. POST /mark-paid activa un plan a mano mientras.
export const billingRouter = Router();

// Público: la landing muestra los planes sin sesión.
billingRouter.get('/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

billingRouter.get('/status', requireAuth, async (req, res) => {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  if (!org) {
    res.status(404).json({ error: 'Organización no encontrada.' });
    return;
  }
  const plan = getPlan(org.plan);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM students WHERE org_id = $1', [
    req.orgId,
  ]);
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  res.json({
    plan,
    subscriptionActive: org.subscriptionActive,
    trialEndsAt: org.trialEndsAt,
    trialDaysLeft,
    trialExpired: !org.subscriptionActive && trialDaysLeft === 0,
    studentCount: rows[0].n,
    studentLimit: plan.maxStudents,
    flowConfigured: isFlowConfigured(),
  });
});

billingRouter.post('/checkout', requireAuth, async (req, res) => {
  const planId = String(req.body?.plan ?? '');
  if (!(planId in PLANS)) {
    res.status(400).json({ error: 'Plan inválido.' });
    return;
  }
  if (!isFlowConfigured()) {
    res.json({
      available: false,
      message:
        'El pago en línea aún no está habilitado. Escríbenos y activamos tu plan manualmente mientras tanto.',
    });
    return;
  }
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  const plan = getPlan(planId);
  const payment = await createFlowPayment({
    orderId: `org${req.orgId}-${planId}-${Date.now()}`,
    subject: `PreuFlow plan ${plan.name} (mensual)`,
    amountClp: plan.priceClp,
    email: org!.email,
  });
  res.json({ available: true, url: payment.url });
});

// Webhook de confirmación de Flow (urlConfirmation). Flow envía el token del
// pago; se consulta el estado real a la API antes de activar nada.
billingRouter.post('/webhook', async (req, res) => {
  if (!isFlowConfigured()) {
    res.status(400).send('Flow no configurado');
    return;
  }
  const token = String(req.body?.token ?? '');
  if (!token) {
    res.status(400).send('token faltante');
    return;
  }
  try {
    const status = await getFlowPaymentStatus(token);
    // commerceOrder tiene formato org<id>-<plan>-<timestamp>
    const match = /^org(\d+)-(starter|growth|pro)-/.exec(status.commerceOrder);
    if (status.status === 2 && match) {
      await db
        .update(schema.organizations)
        .set({ plan: match[2], subscriptionActive: true })
        .where(eq(schema.organizations.id, Number(match[1])));
    }
    res.send('OK');
  } catch (err) {
    console.error('Error en webhook de Flow:', err);
    res.status(500).send('error');
  }
});

// Activación manual de un plan (mientras Flow no tenga credenciales).
billingRouter.post('/mark-paid', requireAuth, async (req, res) => {
  const planId = String(req.body?.plan ?? '');
  if (!(planId in PLANS)) {
    res.status(400).json({ error: 'Plan inválido.' });
    return;
  }
  const [org] = await db
    .update(schema.organizations)
    .set({ plan: planId, subscriptionActive: true })
    .where(eq(schema.organizations.id, req.orgId))
    .returning();
  res.json({ ok: true, plan: getPlan(org.plan), subscriptionActive: org.subscriptionActive });
});
