import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Tareas del equipo (portado de Emilia): prioridad, estado, checklist.
export const tasksRouter = Router();

const PRIORITIES = ['ALTA', 'MEDIA', 'BAJA'];
const STATUSES = ['PENDIENTE', 'EN CURSO', 'COMPLETADA'];

tasksRouter.get('/', async (req, res) => {
  const taskRows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.orgId, req.orgId))
    .orderBy(desc(schema.tasks.createdAt));
  const ids = taskRows.map((t) => t.id);
  const items = ids.length
    ? await db
        .select()
        .from(schema.taskItems)
        .where(inArray(schema.taskItems.taskId, ids))
        .orderBy(asc(schema.taskItems.sortOrder), asc(schema.taskItems.id))
    : [];
  const tasks = taskRows.map((t) => ({
    ...t,
    items: items.filter((i) => i.taskId === t.id),
  }));
  res.json({ tasks });
});

tasksRouter.post('/', async (req, res) => {
  const { title, description, assignedTo, deadline, priority } = req.body ?? {};
  if (!title) {
    res.status(400).json({ error: 'El título es obligatorio.' });
    return;
  }
  const [task] = await db
    .insert(schema.tasks)
    .values({
      orgId: req.orgId,
      title: String(title),
      description: description ? String(description) : '',
      assignedTo: assignedTo ? String(assignedTo) : '',
      deadline: deadline ? String(deadline) : '',
      priority: PRIORITIES.includes(priority) ? priority : 'MEDIA',
    })
    .returning();
  broadcast(req.orgId, 'tasks:changed', {});
  res.status(201).json({ task });
});

tasksRouter.patch('/:id', async (req, res) => {
  const { title, description, assignedTo, deadline, priority, status } = req.body ?? {};
  const updates: Partial<typeof schema.tasks.$inferInsert> = {};
  if (title !== undefined) updates.title = String(title);
  if (description !== undefined) updates.description = String(description);
  if (assignedTo !== undefined) updates.assignedTo = String(assignedTo);
  if (deadline !== undefined) updates.deadline = String(deadline);
  if (priority !== undefined && PRIORITIES.includes(priority)) updates.priority = priority;
  if (status !== undefined && STATUSES.includes(status)) updates.status = status;

  const [task] = await db
    .update(schema.tasks)
    .set(updates)
    .where(and(eq(schema.tasks.id, Number(req.params.id)), eq(schema.tasks.orgId, req.orgId)))
    .returning();
  if (!task) {
    res.status(404).json({ error: 'Tarea no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'tasks:changed', {});
  res.json({ task });
});

tasksRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.tasks)
    .where(and(eq(schema.tasks.id, Number(req.params.id)), eq(schema.tasks.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Tarea no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'tasks:changed', {});
  res.json({ ok: true });
});

// ---- Checklist ----

tasksRouter.post('/:id/items', async (req, res) => {
  const taskId = Number(req.params.id);
  const [task] = await db
    .select({ id: schema.tasks.id })
    .from(schema.tasks)
    .where(and(eq(schema.tasks.id, taskId), eq(schema.tasks.orgId, req.orgId)));
  if (!task) {
    res.status(404).json({ error: 'Tarea no encontrada.' });
    return;
  }
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'El texto es obligatorio.' });
    return;
  }
  const [item] = await db.insert(schema.taskItems).values({ taskId, text }).returning();
  broadcast(req.orgId, 'tasks:changed', {});
  res.status(201).json({ item });
});

tasksRouter.patch('/items/:itemId', async (req, res) => {
  const itemId = Number(req.params.itemId);
  // Verificar pertenencia via la tarea padre.
  const [row] = await db
    .select({ itemId: schema.taskItems.id, completed: schema.taskItems.completed })
    .from(schema.taskItems)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskItems.taskId))
    .where(and(eq(schema.taskItems.id, itemId), eq(schema.tasks.orgId, req.orgId)));
  if (!row) {
    res.status(404).json({ error: 'Ítem no encontrado.' });
    return;
  }
  const completed = req.body?.completed !== undefined ? Boolean(req.body.completed) : !row.completed;
  const [item] = await db
    .update(schema.taskItems)
    .set({ completed })
    .where(eq(schema.taskItems.id, itemId))
    .returning();
  broadcast(req.orgId, 'tasks:changed', {});
  res.json({ item });
});

tasksRouter.delete('/items/:itemId', async (req, res) => {
  const itemId = Number(req.params.itemId);
  const [row] = await db
    .select({ itemId: schema.taskItems.id })
    .from(schema.taskItems)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskItems.taskId))
    .where(and(eq(schema.taskItems.id, itemId), eq(schema.tasks.orgId, req.orgId)));
  if (!row) {
    res.status(404).json({ error: 'Ítem no encontrado.' });
    return;
  }
  await db.delete(schema.taskItems).where(eq(schema.taskItems.id, itemId));
  broadcast(req.orgId, 'tasks:changed', {});
  res.json({ ok: true });
});
