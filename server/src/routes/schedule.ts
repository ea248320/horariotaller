import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { broadcast } from '../realtime/sse';
import { promoteWaitlist } from './waitlist';

export const scheduleRouter = Router();

const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function hhmm(t: string): string {
  return t.slice(0, 5);
}

interface ConflictRow {
  block_id: number;
  course_id: number;
  course_name: string;
  room: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  semester: string | null;
  start_time: string;
  end_time: string;
}

// Doble validación, corazón del producto:
// 1) Un mismo profesor o una misma sala no pueden quedar con horarios que se
//    traslapan el mismo día (OVERLAPS de Postgres).
// 2) Semestres: dos cursos de semestres distintos ('1' vs '2') NO chocan
//    aunque compartan sala/profesor/hora, porque nunca coinciden en el
//    calendario real. Un curso 'anual' choca con todo. Cursos sin semestre
//    (talleres, academias) chocan siempre entre sí.
export async function findConflicts(opts: {
  orgId: number;
  teacherId: number | null;
  room: string | null;
  semester: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  excludeBlockId?: number | null;
  excludeCourseId?: number | null;
}): Promise<{ conflicts: ConflictRow[]; reasons: string[] }> {
  const { rows } = await pool.query<ConflictRow>(
    `SELECT b.id AS block_id, c.id AS course_id, c.name AS course_name, c.room,
            c.teacher_id, t.name AS teacher_name, c.semester,
            b.start_time::text, b.end_time::text
       FROM schedule_blocks b
       JOIN courses c ON c.id = b.course_id
       LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE b.org_id = $1
        AND b.weekday = $2
        AND ($3::int IS NULL OR b.id <> $3)
        AND ($4::int IS NULL OR c.id <> $4)
        AND (
             (c.teacher_id IS NOT NULL AND c.teacher_id = $5::int)
          OR (c.room IS NOT NULL AND c.room <> '' AND lower(c.room) = lower($6::text))
        )
        AND (b.start_time, b.end_time) OVERLAPS ($7::time, $8::time)
        AND NOT (
          c.semester IS NOT NULL AND $9::text IS NOT NULL
          AND c.semester <> 'anual' AND $9::text <> 'anual'
          AND c.semester <> $9::text
        )`,
    [
      opts.orgId,
      opts.weekday,
      opts.excludeBlockId ?? null,
      opts.excludeCourseId ?? null,
      opts.teacherId,
      opts.room ?? '',
      opts.startTime,
      opts.endTime,
      opts.semester,
    ],
  );

  const reasons = rows.map((row) => {
    const when = `${WEEKDAYS[opts.weekday]} de ${hhmm(row.start_time)} a ${hhmm(row.end_time)}`;
    const semNote =
      row.semester === 'anual' ? ' (curso anual: presente todo el año)' : '';
    if (opts.teacherId && row.teacher_id === opts.teacherId) {
      return `El profesor ${row.teacher_name ?? ''} ya tiene "${row.course_name}" el ${when}${semNote}.`;
    }
    return `La sala ${row.room} está ocupada por "${row.course_name}" el ${when}${semNote}.`;
  });

  return { conflicts: rows, reasons };
}

// ---- Cursos ----

scheduleRouter.get('/courses', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.teacher_id AS "teacherId", t.name AS "teacherName",
            c.room, c.capacity, c.semester, c.created_at AS "createdAt",
            (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id) AS "enrolledCount",
            (SELECT count(*)::int FROM waitlist_entries w WHERE w.course_id = c.id) AS "waitlistCount",
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', b.id, 'weekday', b.weekday,
                 'startTime', b.start_time::text, 'endTime', b.end_time::text
               ) ORDER BY b.weekday, b.start_time)
                 FROM schedule_blocks b WHERE b.course_id = c.id),
              '[]'
            ) AS blocks
       FROM courses c
       LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE c.org_id = $1
      ORDER BY c.name`,
    [req.orgId],
  );
  res.json({ courses: rows });
});

scheduleRouter.post('/courses', async (req, res) => {
  const { name, teacherId, room, capacity, semester } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: 'El nombre es obligatorio.' });
    return;
  }
  const sem = await normalizeSemester(req.orgId, semester);
  if (sem instanceof Error) {
    res.status(400).json({ error: sem.message });
    return;
  }
  const [course] = await db
    .insert(schema.courses)
    .values({
      orgId: req.orgId,
      name: String(name),
      teacherId: teacherId ? Number(teacherId) : null,
      room: room ? String(room) : null,
      capacity: capacity ? Number(capacity) : 20,
      semester: sem,
    })
    .returning();
  broadcast(req.orgId, 'schedule:changed', {});
  res.status(201).json({ course });
});

scheduleRouter.patch('/courses/:id', async (req, res) => {
  const courseId = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.orgId, req.orgId)));
  if (!existing) {
    res.status(404).json({ error: 'Curso no encontrado.' });
    return;
  }

  const { name, teacherId, room, capacity, semester } = req.body ?? {};
  const updates: Partial<typeof schema.courses.$inferInsert> = {};
  if (name !== undefined) updates.name = String(name);
  if (teacherId !== undefined) updates.teacherId = teacherId ? Number(teacherId) : null;
  if (room !== undefined) updates.room = room ? String(room) : null;
  if (capacity !== undefined) updates.capacity = Number(capacity);
  if (semester !== undefined) {
    const sem = await normalizeSemester(req.orgId, semester);
    if (sem instanceof Error) {
      res.status(400).json({ error: sem.message });
      return;
    }
    updates.semester = sem;
  }

  // Si cambian profesor, sala o semestre, revalidar todos los bloques del curso.
  const nextTeacherId = updates.teacherId !== undefined ? updates.teacherId : existing.teacherId;
  const nextRoom = updates.room !== undefined ? updates.room : existing.room;
  const nextSemester = updates.semester !== undefined ? updates.semester : existing.semester;
  const blocks = await db
    .select()
    .from(schema.scheduleBlocks)
    .where(eq(schema.scheduleBlocks.courseId, courseId));
  for (const block of blocks) {
    const { reasons } = await findConflicts({
      orgId: req.orgId,
      teacherId: nextTeacherId ?? null,
      room: nextRoom ?? null,
      semester: nextSemester ?? null,
      weekday: block.weekday,
      startTime: block.startTime,
      endTime: block.endTime,
      excludeCourseId: courseId,
    });
    if (reasons.length > 0) {
      res.status(409).json({ error: 'El cambio genera choques de horario.', conflicts: reasons });
      return;
    }
  }

  const [course] = await db
    .update(schema.courses)
    .set(updates)
    .where(eq(schema.courses.id, courseId))
    .returning();

  // Si subió la capacidad, se liberaron cupos: avisar a la lista de espera.
  if (updates.capacity !== undefined && updates.capacity > existing.capacity) {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM enrollments WHERE course_id = $1',
      [courseId],
    );
    const enrolled: number = rows[0].n;
    const freed = Math.min(updates.capacity - Math.max(existing.capacity, enrolled), updates.capacity - enrolled);
    if (freed > 0) await promoteWaitlist(req.orgId, courseId, freed);
  }

  broadcast(req.orgId, 'schedule:changed', {});
  res.json({ course });
});

scheduleRouter.delete('/courses/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.courses)
    .where(and(eq(schema.courses.id, Number(req.params.id)), eq(schema.courses.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Curso no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'schedule:changed', {});
  res.json({ ok: true });
});

// El semestre es exclusivo de negocios tipo preuniversitario.
async function normalizeSemester(orgId: number, value: unknown): Promise<string | null | Error> {
  if (value === undefined || value === null || value === '') return null;
  if (!['1', '2', 'anual'].includes(String(value))) {
    return new Error("Semestre inválido: usa '1', '2' o 'anual'.");
  }
  const [org] = await db
    .select({ businessType: schema.organizations.businessType })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId));
  if (org?.businessType !== 'preuniversitario') {
    return new Error('El semestre solo está disponible para preuniversitarios.');
  }
  return String(value);
}

// ---- Bloques horarios ----

function validBlockInput(body: Record<string, unknown>): string | null {
  const { weekday, startTime, endTime } = body;
  const wd = Number(weekday);
  if (!Number.isInteger(wd) || wd < 1 || wd > 7) return 'El día debe ser 1 (lunes) a 7 (domingo).';
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  if (!timeRe.test(String(startTime)) || !timeRe.test(String(endTime))) {
    return 'Horas inválidas: usa formato HH:MM.';
  }
  if (String(startTime) >= String(endTime)) return 'La hora de inicio debe ser antes que la de término.';
  return null;
}

scheduleRouter.post('/courses/:id/blocks', async (req, res) => {
  const courseId = Number(req.params.id);
  const [course] = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.id, courseId), eq(schema.courses.orgId, req.orgId)));
  if (!course) {
    res.status(404).json({ error: 'Curso no encontrado.' });
    return;
  }
  const invalid = validBlockInput(req.body ?? {});
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const { weekday, startTime, endTime } = req.body;

  const { reasons } = await findConflicts({
    orgId: req.orgId,
    teacherId: course.teacherId,
    room: course.room,
    semester: course.semester,
    weekday: Number(weekday),
    startTime: String(startTime),
    endTime: String(endTime),
  });
  if (reasons.length > 0) {
    res.status(409).json({ error: 'Choque de horario.', conflicts: reasons });
    return;
  }

  const [block] = await db
    .insert(schema.scheduleBlocks)
    .values({
      orgId: req.orgId,
      courseId,
      weekday: Number(weekday),
      startTime: String(startTime),
      endTime: String(endTime),
    })
    .returning();
  broadcast(req.orgId, 'schedule:changed', {});
  res.status(201).json({ block });
});

scheduleRouter.patch('/blocks/:id', async (req, res) => {
  const blockId = Number(req.params.id);
  const [existing] = await db
    .select()
    .from(schema.scheduleBlocks)
    .where(and(eq(schema.scheduleBlocks.id, blockId), eq(schema.scheduleBlocks.orgId, req.orgId)));
  if (!existing) {
    res.status(404).json({ error: 'Bloque no encontrado.' });
    return;
  }
  const body = {
    weekday: req.body?.weekday ?? existing.weekday,
    startTime: req.body?.startTime ?? existing.startTime,
    endTime: req.body?.endTime ?? existing.endTime,
  };
  const invalid = validBlockInput(body);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const [course] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, existing.courseId));

  const { reasons } = await findConflicts({
    orgId: req.orgId,
    teacherId: course?.teacherId ?? null,
    room: course?.room ?? null,
    semester: course?.semester ?? null,
    weekday: Number(body.weekday),
    startTime: String(body.startTime),
    endTime: String(body.endTime),
    excludeBlockId: blockId,
  });
  if (reasons.length > 0) {
    res.status(409).json({ error: 'Choque de horario.', conflicts: reasons });
    return;
  }

  const [block] = await db
    .update(schema.scheduleBlocks)
    .set({
      weekday: Number(body.weekday),
      startTime: String(body.startTime),
      endTime: String(body.endTime),
    })
    .where(eq(schema.scheduleBlocks.id, blockId))
    .returning();
  broadcast(req.orgId, 'schedule:changed', {});
  res.json({ block });
});

scheduleRouter.delete('/blocks/:id', async (req, res) => {
  const [deleted] = await db
    .delete(schema.scheduleBlocks)
    .where(and(eq(schema.scheduleBlocks.id, Number(req.params.id)), eq(schema.scheduleBlocks.orgId, req.orgId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: 'Bloque no encontrado.' });
    return;
  }
  broadcast(req.orgId, 'schedule:changed', {});
  res.json({ ok: true });
});

// ---- Vista calendario ----

scheduleRouter.get('/blocks', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.weekday, b.start_time::text AS "startTime", b.end_time::text AS "endTime",
            c.id AS "courseId", c.name AS "courseName", c.room, c.semester,
            t.name AS "teacherName"
       FROM schedule_blocks b
       JOIN courses c ON c.id = b.course_id
       LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE b.org_id = $1
      ORDER BY b.weekday, b.start_time`,
    [req.orgId],
  );
  res.json({ blocks: rows });
});
