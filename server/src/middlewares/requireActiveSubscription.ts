import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';

// Bloquea las ESCRITURAS (POST/PUT/PATCH/DELETE) cuando el trial venció y no
// hay suscripción activa. La lectura sigue funcionando: el centro no pierde
// acceso a sus datos, solo no puede seguir editando.
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const [org] = await db
    .select({
      subscriptionActive: schema.organizations.subscriptionActive,
      trialEndsAt: schema.organizations.trialEndsAt,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));

  if (!org) {
    res.status(401).json({ error: 'Organización no encontrada.' });
    return;
  }
  const inTrial = org.trialEndsAt.getTime() > Date.now();
  if (org.subscriptionActive || inTrial) {
    next();
    return;
  }
  res.status(402).json({
    error:
      'Tu período de prueba terminó. Elige un plan en Configuración → Plan y facturación para seguir editando (tus datos siguen disponibles en modo lectura).',
    code: 'subscription_expired',
  });
}
