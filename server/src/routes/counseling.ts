import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Orientación vocacional (portado de Emilia): orientadoras y citas con doble
// estado (confirmación previa + asistencia real).
export const counselingRouter = Router();

const CONFIRMA = ['pendiente', 'confirmada', 'no_confirma'];
const ASISTE = ['pendiente', 'asiste', 'no_asiste'];

// ---- Orientadoras ----

counselingRouter.get('/orientadoras', async (req, res) => {
  const counselors = await db
    .select()
    .from(schema.counselors)
    .where(eq(schema.counselors.orgId, req.orgId))
    .orderBy(asc(schema.counselors.name));
  res.json({ counselors });
});

counselingRouter.post('/orientadoras', async (req, res) => {
  const { name, title } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  const [counselor] = await db
    .insert(schema.counselors)
    .values({
      orgId: req.orgId,
      name: String(name),
      title: title ? String(title) : 'Orientadora',
    })
    .returning();
  broadcast(req.orgId, 'counseling:changed', {});
  res.status(201).json({ counselor });
});

counselingRouter.delete('/orientadoras/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.counselors)
    .where(and(eq(schema.counselors.id, Number(req.params.id)), eq(schema.counselors.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Orientadora no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'counseling:changed', {});
  res.json({ ok: true });
});

// ---- Citas ----

counselingRouter.get('/citas', async (req, res) => {
  const citas = await db
    .select({
      id: schema.counselingAppointments.id,
      counselorId: schema.counselingAppointments.counselorId,
      counselorName: schema.counselors.name,
      studentName: schema.counselingAppointments.studentName,
      agendadoPor: schema.counselingAppointments.agendadoPor,
      fecha: schema.counselingAppointments.fecha,
      horaInicio: schema.counselingAppointments.horaInicio,
      motivo: schema.counselingAppointments.motivo,
      estadoConfirma: schema.counselingAppointments.estadoConfirma,
      estadoAsiste: schema.counselingAppointments.estadoAsiste,
      notaRapida: schema.counselingAppointments.notaRapida,
    })
    .from(schema.counselingAppointments)
    .innerJoin(schema.counselors, eq(schema.counselors.id, schema.counselingAppointments.counselorId))
    .where(eq(schema.counselingAppointments.orgId, req.orgId))
    .orderBy(desc(schema.counselingAppointments.fecha), asc(schema.counselingAppointments.horaInicio))
    .limit(300);
  res.json({ citas });
});

counselingRouter.post('/citas', async (req, res) => {
  const { counselorId, studentName, agendadoPor, fecha, horaInicio, motivo } = req.body ?? {};
  if (!counselorId || !studentName || !fecha || !horaInicio) {
    res.status(400).json({ error: 'Orientadora, alumno, fecha y hora son obligatorios.' });
    return;
  }
  const [counselor] = await db
    .select({ id: schema.counselors.id })
    .from(schema.counselors)
    .where(and(eq(schema.counselors.id, Number(counselorId)), eq(schema.counselors.orgId, req.orgId)));
  if (!counselor) {
    res.status(404).json({ error: 'Orientadora no encontrada.' });
    return;
  }
  const [cita] = await db
    .insert(schema.counselingAppointments)
    .values({
      orgId: req.orgId,
      counselorId: Number(counselorId),
      studentName: String(studentName),
      agendadoPor: agendadoPor ? String(agendadoPor) : '',
      fecha: String(fecha),
      horaInicio: String(horaInicio),
      motivo: motivo ? String(motivo) : '',
    })
    .returning();
  broadcast(req.orgId, 'counseling:changed', {});
  res.status(201).json({ cita });
});

counselingRouter.patch('/citas/:id', async (req, res) => {
  const { estadoConfirma, estadoAsiste, notaRapida, motivo, fecha, horaInicio } = req.body ?? {};
  const updates: Partial<typeof schema.counselingAppointments.$inferInsert> = {};
  if (estadoConfirma !== undefined && CONFIRMA.includes(estadoConfirma)) updates.estadoConfirma = estadoConfirma;
  if (estadoAsiste !== undefined && ASISTE.includes(estadoAsiste)) updates.estadoAsiste = estadoAsiste;
  if (notaRapida !== undefined) updates.notaRapida = String(notaRapida);
  if (motivo !== undefined) updates.motivo = String(motivo);
  if (fecha !== undefined) updates.fecha = String(fecha);
  if (horaInicio !== undefined) updates.horaInicio = String(horaInicio);

  const [cita] = await db
    .update(schema.counselingAppointments)
    .set(updates)
    .where(
      and(
        eq(schema.counselingAppointments.id, Number(req.params.id)),
        eq(schema.counselingAppointments.orgId, req.orgId),
      ),
    )
    .returning();
  if (!cita) {
    res.status(404).json({ error: 'Cita no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'counseling:changed', {});
  res.json({ cita });
});

counselingRouter.delete('/citas/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.counselingAppointments)
    .where(
      and(
        eq(schema.counselingAppointments.id, Number(req.params.id)),
        eq(schema.counselingAppointments.orgId, req.orgId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Cita no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'counseling:changed', {});
  res.json({ ok: true });
});
