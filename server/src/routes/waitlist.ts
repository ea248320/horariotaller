import { Router } from 'express';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { pool } from '../db';
import { isEmailConfigured, sendEmail } from '../lib/email';
import { broadcast } from '../realtime/sse';

export const waitlistRouter = Router();

// Se liberó al menos un cupo en el curso (cancelación de inscripción o
// aumento de capacidad): avisar al primero de la lista de espera que aún no
// ha sido avisado. Por correo si Resend está configurado, y SIEMPRE además
// con una notificación interna, para que la secretaria pueda avisar por
// teléfono/WhatsApp como respaldo.
export async function promoteWaitlist(orgId: number, courseId: number, freedSpots = 1): Promise<void> {
  for (let i = 0; i < freedSpots; i++) {
    const [entry] = await db
      .select({
        id: schema.waitlistEntries.id,
        studentId: schema.waitlistEntries.studentId,
        studentName: schema.students.name,
        studentEmail: schema.students.email,
        studentPhone: schema.students.phone,
        courseName: schema.courses.name,
      })
      .from(schema.waitlistEntries)
      .innerJoin(schema.students, eq(schema.students.id, schema.waitlistEntries.studentId))
      .innerJoin(schema.courses, eq(schema.courses.id, schema.waitlistEntries.courseId))
      .where(
        and(
          eq(schema.waitlistEntries.orgId, orgId),
          eq(schema.waitlistEntries.courseId, courseId),
          isNull(schema.waitlistEntries.notifiedAt),
        ),
      )
      .orderBy(asc(schema.waitlistEntries.createdAt))
      .limit(1);

    if (!entry) return;

    let emailNote = 'Correo no configurado: avísale por teléfono o WhatsApp.';
    if (isEmailConfigured() && entry.studentEmail) {
      const result = await sendEmail({
        to: entry.studentEmail,
        subject: `Se liberó un cupo en ${entry.courseName}`,
        html: `<p>Hola ${entry.studentName}:</p><p>Se liberó un cupo en <strong>${entry.courseName}</strong>. Contacta al centro para confirmar tu inscripción.</p>`,
      });
      emailNote = result.sent
        ? `Se le envió un correo a ${entry.studentEmail}.`
        : `El correo falló (${result.error}): avísale por teléfono o WhatsApp.`;
    }

    const contact = entry.studentPhone ? ` Teléfono: ${entry.studentPhone}.` : '';
    await db.insert(schema.notifications).values({
      orgId,
      type: 'cupo_liberado',
      title: `Cupo liberado en ${entry.courseName}`,
      body: `${entry.studentName} es el primero en la lista de espera. ${emailNote}${contact}`,
    });

    await db
      .update(schema.waitlistEntries)
      .set({ notifiedAt: new Date() })
      .where(eq(schema.waitlistEntries.id, entry.id));

    broadcast(orgId, 'notification', { type: 'cupo_liberado' });
    broadcast(orgId, 'waitlist:changed', { courseId });
  }
}

waitlistRouter.get('/', async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  const where = courseId
    ? and(eq(schema.waitlistEntries.orgId, req.orgId), eq(schema.waitlistEntries.courseId, courseId))
    : eq(schema.waitlistEntries.orgId, req.orgId);

  const entries = await db
    .select({
      id: schema.waitlistEntries.id,
      courseId: schema.waitlistEntries.courseId,
      studentId: schema.waitlistEntries.studentId,
      studentName: schema.students.name,
      courseName: schema.courses.name,
      notifiedAt: schema.waitlistEntries.notifiedAt,
      createdAt: schema.waitlistEntries.createdAt,
    })
    .from(schema.waitlistEntries)
    .innerJoin(schema.students, eq(schema.students.id, schema.waitlistEntries.studentId))
    .innerJoin(schema.courses, eq(schema.courses.id, schema.waitlistEntries.courseId))
    .where(where)
    .orderBy(asc(schema.waitlistEntries.createdAt));
  res.json({ entries });
});

waitlistRouter.post('/', async (req, res) => {
  const { courseId, studentId } = req.body ?? {};
  if (!courseId || !studentId) {
    res.status(400).json({ error: 'courseId y studentId son obligatorios.' });
    return;
  }
  // No anotar si ya está inscrito en el curso.
  const { rows: enrolled } = await pool.query(
    'SELECT id FROM enrollments WHERE org_id = $1 AND course_id = $2 AND student_id = $3',
    [req.orgId, courseId, studentId],
  );
  if (enrolled.length > 0) {
    res.status(409).json({ error: 'Ese alumno ya está inscrito en este curso.' });
    return;
  }
  try {
    const [entry] = await db
      .insert(schema.waitlistEntries)
      .values({ orgId: req.orgId, courseId: Number(courseId), studentId: Number(studentId) })
      .returning();
    broadcast(req.orgId, 'waitlist:changed', { courseId: Number(courseId) });
    res.status(201).json({ entry });
  } catch (err) {
    if (err instanceof Error && err.message.includes('waitlist_course_student_idx')) {
      res.status(409).json({ error: 'Ese alumno ya está en la lista de espera de este curso.' });
      return;
    }
    throw err;
  }
});

waitlistRouter.delete('/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.waitlistEntries)
    .where(
      and(
        eq(schema.waitlistEntries.id, Number(req.params.id)),
        eq(schema.waitlistEntries.orgId, req.orgId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Entrada de lista de espera no encontrada.' });
    return;
  }
  broadcast(req.orgId, 'waitlist:changed', { courseId: deleted.courseId });
  res.json({ ok: true });
});
