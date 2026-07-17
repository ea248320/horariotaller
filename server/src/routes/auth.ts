import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { hashPassword, signToken, verifyPassword } from '../lib/auth';
import { TRIAL_DAYS } from '../lib/plans';
import { BUSINESS_PRESETS, isBusinessType } from '../lib/businessTypes';
import { requireAuth } from '../middlewares/requireAuth';

export const authRouter = Router();

function publicOrg(org: typeof schema.organizations.$inferSelect) {
  const { passwordHash: _omit, ...rest } = org;
  return rest;
}

// Registro de un centro nuevo: crea la organización con los presets del tipo
// de negocio y arranca el trial de 14 días.
authRouter.post('/register', async (req, res) => {
  const { name, email, password, businessType } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nombre del centro, correo y contraseña son obligatorios.' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    return;
  }
  const type = isBusinessType(businessType) ? businessType : 'personalizado';
  const preset = BUSINESS_PRESETS[type];
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const existing = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.email, String(email).toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: 'Ya existe un centro registrado con ese correo.' });
    return;
  }

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: String(name),
      email: String(email).toLowerCase(),
      passwordHash: hashPassword(String(password)),
      businessType: type,
      courseLabel: preset.courseLabel,
      studentLabel: preset.studentLabel,
      brandColor: preset.brandColor,
      feesEnabled: preset.feesEnabled,
      trialEndsAt,
    })
    .returning();

  res.status(201).json({ token: signToken(org.id), organization: publicOrg(org) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    return;
  }
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.email, String(email).toLowerCase()));
  if (!org || !verifyPassword(String(password), org.passwordHash)) {
    res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    return;
  }
  res.json({ token: signToken(org.id), organization: publicOrg(org) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  if (!org) {
    res.status(401).json({ error: 'Organización no encontrada.' });
    return;
  }
  res.json({ organization: publicOrg(org) });
});
