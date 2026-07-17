import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Notas rápidas compartidas tipo post-it (portado de Emilia).
export const notesRouter = Router();

const COLORS = ['amarillo', 'rosa', 'verde', 'celeste'];

notesRouter.get('/', async (req, res) => {
  const notes = await db
    .select()
    .from(schema.notes)
    .where(eq(schema.notes.orgId, req.orgId))
    .orderBy(desc(schema.notes.pinned), desc(schema.notes.createdAt));
  res.json({ notes });
});

notesRouter.post('/', async (req, res) => {
  const { autor, titulo, contenido, color } = req.body ?? {};
  if (!contenido && !titulo) {
    res.status(400).json({ error: 'La nota no puede estar vacía.' });
    return;
  }
  const [note] = await db
    .insert(schema.notes)
    .values({
      orgId: req.orgId,
      autor: autor ? String(autor) : '',
      titulo: titulo ? String(titulo) : '',
      contenido: contenido ? String(contenido) : '',
      color: COLORS.includes(color) ? color : 'amarillo',
    })
    .returning();
  broadcast(req.orgId, 'notes:changed', {});
  res.status(201).json({ note });
});

notesRouter.patch('/:id', async (req, res) => {
  const { autor, titulo, contenido, color, pinned } = req.body ?? {};
  const updates: Partial<typeof schema.notes.$inferInsert> = {};
  if (autor !== undefined) updates.autor = String(autor);
  if (titulo !== undefined) updates.titulo = String(titulo);
  if (contenido !== undefined) updates.contenido = String(contenido);
  if (color !== undefined && COLORS.includes(color)) updates.color = color;
  if (pinned !== undefined) updates.pinned = Boolean(pinned);

  const [note] = await db
    .update(schema.notes)
    .set(updates)
    .where(and(eq(schema.notes.id, Number(req.params.id)), eq(schema.notes.orgId, req.orgId)))
    .returning();
  if (!note) {
    res.status(404).json({ error: 'Nota no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'notes:changed', {});
  res.json({ note });
});

notesRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.notes)
    .where(and(eq(schema.notes.id, Number(req.params.id)), eq(schema.notes.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Nota no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'notes:changed', {});
  res.json({ ok: true });
});
