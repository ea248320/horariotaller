import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { BUSINESS_PRESETS, isBusinessType } from '../lib/businessTypes';
import { broadcast } from '../realtime/sse';

export const organizationRouter = Router();

organizationRouter.get('/', async (req, res) => {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  if (!org) {
    res.status(404).json({ error: 'Organización no encontrada.' });
    return;
  }
  const { passwordHash: _omit, ...rest } = org;
  res.json({ organization: rest });
});

// Personalización: tipo de negocio, etiquetas, color de marca, módulo de
// cuotas. Al cambiar el tipo de negocio se re-aplican sus presets, salvo los
// campos que vengan explícitos en la misma petición.
organizationRouter.patch('/', async (req, res) => {
  const { name, businessType, courseLabel, studentLabel, brandColor, feesEnabled } = req.body ?? {};
  const updates: Partial<typeof schema.organizations.$inferInsert> = {};

  if (businessType !== undefined) {
    if (!isBusinessType(businessType)) {
      res.status(400).json({ error: 'Tipo de negocio inválido.' });
      return;
    }
    const preset = BUSINESS_PRESETS[businessType];
    updates.businessType = businessType;
    updates.courseLabel = preset.courseLabel;
    updates.studentLabel = preset.studentLabel;
    updates.brandColor = preset.brandColor;
    updates.feesEnabled = preset.feesEnabled;
  }
  if (name !== undefined) updates.name = String(name);
  if (courseLabel !== undefined) updates.courseLabel = String(courseLabel);
  if (studentLabel !== undefined) updates.studentLabel = String(studentLabel);
  if (brandColor !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(brandColor))) {
      res.status(400).json({ error: 'El color debe ser hexadecimal, ej: #2563EB.' });
      return;
    }
    updates.brandColor = String(brandColor);
  }
  if (feesEnabled !== undefined) updates.feesEnabled = Boolean(feesEnabled);

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'Nada que actualizar.' });
    return;
  }

  const [org] = await db
    .update(schema.organizations)
    .set(updates)
    .where(eq(schema.organizations.id, req.orgId))
    .returning();
  const { passwordHash: _omit, ...rest } = org;
  broadcast(req.orgId, 'organization:changed', {});
  res.json({ organization: rest });
});
