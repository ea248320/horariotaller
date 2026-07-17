import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcast } from '../realtime/sse';

export const teachersRouter = Router();

teachersRouter.get('/', async (req, res) => {
  const teachers = await db
    .select()
    .from(schema.teachers)
    .where(eq(schema.teachers.orgId, req.orgId))
    .orderBy(asc(schema.teachers.name));
  res.json({ teachers });
});

teachersRouter.post('/', async (req, res) => {
  const { name, email, phone, subject } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  const [teacher] = await db
    .insert(schema.teachers)
    .values({
      orgId: req.orgId,
      name: String(name),
      email: email ? String(email) : null,
      phone: phone ? String(phone) : null,
      subject: subject ? String(subject) : null,
    })
    .returning();
  broadcast(req.orgId, 'teachers:changed', {});
  res.status(201).json({ teacher });
});

teachersRouter.patch('/:id', async (req, res) => {
  const { name, email, phone, subject } = req.body ?? {};
  const updates: Partial<typeof schema.teachers.$inferInsert> = {};
  if (name !== undefined) updates.name = String(name);
  if (email !== undefined) updates.email = email ? String(email) : null;
  if (phone !== undefined) updates.phone = phone ? String(phone) : null;
  if (subject !== undefined) updates.subject = subject ? String(subject) : null;

  const [teacher] = await db
    .update(schema.teachers)
    .set(updates)
    .where(and(eq(schema.teachers.id, Number(req.params.id)), eq(schema.teachers.orgId, req.orgId)))
    .returning();
  if (!teacher) {
    res.status(404).json({ error: 'Profesor no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'teachers:changed', {});
  res.json({ teacher });
});

teachersRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.teachers)
    .where(and(eq(schema.teachers.id, Number(req.params.id)), eq(schema.teachers.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Profesor no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'teachers:changed', {});
  res.json({ ok: true });
});
