import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { getPlan } from '../lib/plans';
import { broadcast } from '../realtime/sse';
import { promoteWaitlist } from './waitlist';

export const studentsRouter = Router();

studentsRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.email, s.phone, s.guardian_name AS "guardianName",
            s.created_at AS "createdAt",
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'enrollmentId', e.id, 'courseId', c.id, 'courseName', c.name
               ) ORDER BY c.name)
                 FROM enrollments e JOIN courses c ON c.id = e.course_id
                WHERE e.student_id = s.id),
              '[]'
            ) AS enrollments
       FROM students s
      WHERE s.org_id = $1
      ORDER BY s.name`,
    [req.orgId],
  );
  res.json({ students: rows });
});

// Límite real de alumnos por plan (lib/plans.ts es la fuente única de verdad).
studentsRouter.post('/', async (req, res) => {
  const { name, email, phone, guardianName } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }

  const [org] = await db
    .select({ plan: schema.organizations.plan, studentLabel: schema.organizations.studentLabel })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  const plan = getPlan(org?.plan);
  if (plan.maxStudents !== null) {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM students WHERE org_id = $1',
      [req.orgId],
    );
    if (rows[0].n >= plan.maxStudents) {
      res.status(403).json({
        error: `Alcanzaste el límite de ${plan.maxStudents} ${org?.studentLabel.toLowerCase()}s del plan ${plan.name}. Sube de plan en Configuración → Plan y facturación para agregar más.`,
        code: 'plan_limit_reached',
      });
      return;
    }
  }

  const [student] = await db
    .insert(schema.students)
    .values({
      orgId: req.orgId,
      name: String(name),
      email: email ? String(email) : null,
      phone: phone ? String(phone) : null,
      guardianName: guardianName ? String(guardianName) : null,
    })
    .returning();
  broadcast(req.orgId, 'students:changed', {});
  res.status(201).json({ student });
});

studentsRouter.patch('/:id', async (req, res) => {
  const { name, email, phone, guardianName } = req.body ?? {};
  const updates: Partial<typeof schema.students.$inferInsert> = {};
  if (name !== undefined) updates.name = String(name);
  if (email !== undefined) updates.email = email ? String(email) : null;
  if (phone !== undefined) updates.phone = phone ? String(phone) : null;
  if (guardianName !== undefined) updates.guardianName = guardianName ? String(guardianName) : null;

  const [student] = await db
    .update(schema.students)
    .set(updates)
    .where(and(eq(schema.students.id, Number(req.params.id)), eq(schema.students.orgId, req.orgId)))
    .returning();
  if (!student) {
    res.status(404).json({ error: 'Alumno no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'students:changed', {});
  res.json({ student });
});

studentsRouter.delete('/:id', async (req, res) => {
  const studentId = Number(req.params.id);
  // Cursos donde estaba inscrito, para liberar cupos después de borrar.
  const { rows: courseRows } = await pool.query(
    'SELECT course_id FROM enrollments WHERE org_id = $1 AND student_id = $2',
    [req.orgId, studentId],
  );
  const [deleted] = await db
    .delete(schema.students)
    .where(and(eq(schema.students.id, studentId), eq(schema.students.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Alumno no encontrado.' });
    return;
  }
  for (const row of courseRows) {
    await promoteWaitlist(req.orgId, row.course_id);
  }
  broadcast(req.orgId, 'students:changed', {});
  res.json({ ok: true });
});

// ---- Inscripciones ----

// Inscribir a un curso. Si está lleno NO se rechaza sin más: se responde 409
// con code 'course_full' y el frontend ofrece anotar en lista de espera.
studentsRouter.post('/:id/enrollments', async (req, res) => {
  const studentId = Number(req.params.id);
  const courseId = Number(req.body?.courseId);
  if (!courseId) {
    res.status(400).json({ error: 'courseId es obligatorio.' });
    return;
  }
  const [course] = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.orgId, req.orgId)));
  if (!course) {
    res.status(404).json({ error: 'Curso no encontrado.' });
    return;
  }
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM enrollments WHERE course_id = $1',
    [courseId],
  );
  if (rows[0].n >= course.capacity) {
    res.status(409).json({
      error: `"${course.name}" está lleno (${course.capacity} cupos). Puedes anotar al alumno en la lista de espera.`,
      code: 'course_full',
      waitlistAvailable: true,
    });
    return;
  }
  try {
    const [enrollment] = await db
      .insert(schema.enrollments)
      .values({ orgId: req.orgId, studentId, courseId })
      .returning();
    // Si estaba en la lista de espera de este curso, sacarlo.
    await pool.query(
      'DELETE FROM waitlist_entries WHERE org_id = $1 AND course_id = $2 AND student_id = $3',
      [req.orgId, courseId, studentId],
    );
    broadcast(req.orgId, 'students:changed', {});
    broadcast(req.orgId, 'schedule:changed', {});
    res.status(201).json({ enrollment });
  } catch (err) {
    if (err instanceof Error && err.message.includes('enrollments_student_course_idx')) {
      res.status(409).json({ error: 'Ese alumno ya está inscrito en este curso.' });
      return;
    }
    throw err;
  }
});

// Cancelar inscripción: libera un cupo → avisa automáticamente al primero de
// la lista de espera.
studentsRouter.delete('/enrollments/:enrollmentId', async (req, res) => {
  const [deleted] = await db
    .delete(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.id, Number(req.params.enrollmentId)),
        eq(schema.enrollments.orgId, req.orgId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Inscripción no encontrada.' });
    return;
  }
  await promoteWaitlist(req.orgId, deleted.courseId);
  broadcast(req.orgId, 'students:changed', {});
  broadcast(req.orgId, 'schedule:changed', {});
  res.json({ ok: true });
});
