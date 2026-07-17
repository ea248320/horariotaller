import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { addClient } from '../realtime/sse';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const items = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.orgId, req.orgId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(100);
  res.json({ notifications: items });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const [item] = await db
    .update(schema.notifications)
    .set({ read: true })
    .where(
      and(
        eq(schema.notifications.id, Number(req.params.id)),
        eq(schema.notifications.orgId, req.orgId),
      ),
    )
    .returning();
  if (!item) {
    res.status(404).json({ error: 'Aviso no encontrado.' });
    return;
  }
  res.json({ notification: item });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(eq(schema.notifications.orgId, req.orgId));
  res.json({ ok: true });
});

// Stream SSE: EventSource no permite headers, la sesión llega por ?token=
// (la valida requireAuth). Montado en app.ts SIN requireActiveSubscription:
// es solo lectura.
notificationsRouter.get('/stream', (req, res) => {
  addClient(req.orgId, res);
});
