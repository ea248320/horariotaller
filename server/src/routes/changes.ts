import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Registro de cambios: transferencias de alumnos entre profesores/horarios
// (portado de Emilia). Es un historial auditable que llena la secretaria.
export const changesRouter = Router();

changesRouter.get('/', async (req, res) => {
  const changes = await db
    .select()
    .from(schema.changes)
    .where(eq(schema.changes.orgId, req.orgId))
    .orderBy(desc(schema.changes.createdAt))
    .limit(300);
  res.json({ changes });
});

changesRouter.post('/', async (req, res) => {
  const {
    studentName,
    subject,
    teacherBefore,
    teacherAfter,
    leavesClass,
    entersClass,
    changeType,
    changeReason,
    transferDate,
  } = req.body ?? {};
  if (!studentName) {
    res.status(400).json({ error: 'El nombre del alumno es obligatorio.' });
    return;
  }
  const [change] = await db
    .insert(schema.changes)
    .values({
      orgId: req.orgId,
      studentName: String(studentName),
      subject: subject ? String(subject) : '',
      teacherBefore: teacherBefore ? String(teacherBefore) : '',
      teacherAfter: teacherAfter ? String(teacherAfter) : '',
      leavesClass: leavesClass ? String(leavesClass) : '',
      entersClass: entersClass ? String(entersClass) : '',
      changeType: changeType ? String(changeType) : 'CAMBIO HORARIO',
      changeReason: changeReason ? String(changeReason) : '',
      transferDate: transferDate ? String(transferDate) : '',
    })
    .returning();
  broadcast(req.orgId, 'changes:changed', {});
  res.status(201).json({ change });
});

changesRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.changes)
    .where(and(eq(schema.changes.id, Number(req.params.id)), eq(schema.changes.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Registro no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'changes:changed', {});
  res.json({ ok: true });
});
