import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Talleres puntuales (portado de Emilia): sesiones sueltas de un día con
// cupos, no recurrentes — no participan del choque de horarios semanal.
export const workshopsRouter = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

workshopsRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.teacher_id AS "teacherId", t.name AS "teacherName",
            w.room, w.workshop_date AS "workshopDate",
            w.start_time::text AS "startTime", w.end_time::text AS "endTime",
            w.capacity,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', ws.id, 'studentId', s.id, 'studentName', s.name
               ) ORDER BY s.name)
                 FROM workshop_students ws JOIN students s ON s.id = ws.student_id
                WHERE ws.workshop_id = w.id),
              '[]'
            ) AS students
       FROM workshops w
       LEFT JOIN teachers t ON t.id = w.teacher_id
      WHERE w.org_id = $1
      ORDER BY w.workshop_date DESC, w.start_time`,
    [req.orgId],
  );
  res.json({ workshops: rows });
});

workshopsRouter.post('/', async (req, res) => {
  const { name, teacherId, room, workshopDate, startTime, endTime, capacity } = req.body ?? {};
  if (!name || !DATE_RE.test(String(workshopDate))) {
    res.status(400).json({ error: 'Nombre y fecha (YYYY-MM-DD) son obligatorios.' });
    return;
  }
  if (!TIME_RE.test(String(startTime)) || !TIME_RE.test(String(endTime)) || String(startTime) >= String(endTime)) {
    res.status(400).json({ error: 'Horas inválidas: usa HH:MM y que el inicio sea antes del término.' });
    return;
  }
  const [workshop] = await db
    .insert(schema.workshops)
    .values({
      orgId: req.orgId,
      name: String(name),
      teacherId: teacherId ? Number(teacherId) : null,
      room: room ? String(room) : null,
      workshopDate: String(workshopDate),
      startTime: String(startTime),
      endTime: String(endTime),
      capacity: capacity ? Number(capacity) : 8,
    })
    .returning();
  broadcast(req.orgId, 'workshops:changed', {});
  res.status(201).json({ workshop });
});

workshopsRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.workshops)
    .where(and(eq(schema.workshops.id, Number(req.params.id)), eq(schema.workshops.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Taller no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'workshops:changed', {});
  res.json({ ok: true });
});

// Inscribir alumno en un taller (con control de cupos).
workshopsRouter.post('/:id/students', async (req, res) => {
  const workshopId = Number(req.params.id);
  const studentId = Number(req.body?.studentId);
  if (!studentId) {
    res.status(400).json({ error: 'studentId es obligatorio.' });
    return;
  }
  const [workshop] = await db
    .select()
    .from(schema.workshops)
    .where(and(eq(schema.workshops.id, workshopId), eq(schema.workshops.orgId, req.orgId)));
  if (!workshop) {
    res.status(404).json({ error: 'Taller no encontrado.' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM workshop_students WHERE workshop_id = $1',
    [workshopId],
  );
  if (rows[0].n >= workshop.capacity) {
    res.status(409).json({ error: `"${workshop.name}" está lleno (${workshop.capacity} cupos).` });
    return;
  }
  try {
    const [entry] = await db
      .insert(schema.workshopStudents)
      .values({ orgId: req.orgId, workshopId, studentId })
      .returning();
    broadcast(req.orgId, 'workshops:changed', {});
    res.status(201).json({ entry });
  } catch (err) {
    if (err instanceof Error && err.message.includes('workshop_students_idx')) {
      res.status(409).json({ error: 'Ese alumno ya está inscrito en este taller.' });
      return;
    }
    throw err;
  }
});

workshopsRouter.delete('/students/:entryId', async (req, res) => {
  const [deleted] = await db
    .delete(schema.workshopStudents)
    .where(
      and(
        eq(schema.workshopStudents.id, Number(req.params.entryId)),
        eq(schema.workshopStudents.orgId, req.orgId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Inscripción no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'workshops:changed', {});
  res.json({ ok: true });
});
