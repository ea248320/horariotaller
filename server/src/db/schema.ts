import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Cada centro (preuniversitario, taller, academia) es una organización con
// datos completamente aislados. La sesión pertenece a la organización.
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  businessType: text('business_type').notNull().default('personalizado'), // preuniversitario | taller | academia | personalizado
  courseLabel: text('course_label').notNull().default('Curso'),
  studentLabel: text('student_label').notNull().default('Alumno'),
  brandColor: text('brand_color').notNull().default('#4F46E5'),
  feesEnabled: boolean('fees_enabled').notNull().default(true),
  plan: text('plan').notNull().default('starter'), // starter | growth | pro
  subscriptionActive: boolean('subscription_active').notNull().default(false),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teachers = pgTable('teachers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  subject: text('subject'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  room: text('room'),
  capacity: integer('capacity').notNull().default(20),
  // Solo negocios tipo preuniversitario: '1' | '2' | 'anual'. NULL en el resto.
  // Un curso 'anual' choca con todo; '1' y '2' nunca chocan entre sí.
  semester: text('semester'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scheduleBlocks = pgTable('schedule_blocks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 1 = lunes ... 7 = domingo
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  guardianName: text('guardian_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('enrollments_student_course_idx').on(t.studentId, t.courseId)],
);

// Cuota mensual marcada a mano por la secretaria. La plataforma NUNCA cobra
// a los alumnos: esto es solo un registro pagado/pendiente.
export const paymentRecords = pgTable(
  'payment_records',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    month: text('month').notNull(), // 'YYYY-MM'
    status: text('status').notNull().default('pendiente'), // pagado | pendiente
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('payment_records_student_month_idx').on(t.studentId, t.month)],
);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('info'), // info | cupo_liberado | horario
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Módulos portados del proyecto Emilia (multi-tenant por org_id) ─────────

// Tareas del equipo de secretaría, con checklist.
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  assignedTo: text('assigned_to').notNull().default(''),
  deadline: text('deadline').notNull().default(''), // YYYY-MM-DD o vacío
  priority: text('priority').notNull().default('MEDIA'), // ALTA | MEDIA | BAJA
  status: text('status').notNull().default('PENDIENTE'), // PENDIENTE | EN CURSO | COMPLETADA
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const taskItems = pgTable('task_items', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  completed: boolean('completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

// Notas rápidas compartidas (post-its).
export const notes = pgTable('notas', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  autor: text('autor').notNull().default(''),
  titulo: text('titulo').notNull().default(''),
  contenido: text('contenido').notNull().default(''),
  color: text('color').notNull().default('amarillo'), // amarillo | rosa | verde | celeste
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Registro de cambios/transferencias de alumnos entre profesores u horarios.
export const changes = pgTable('cambios', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  studentName: text('student_name').notNull(),
  subject: text('subject').notNull().default(''),
  teacherBefore: text('teacher_before').notNull().default(''),
  teacherAfter: text('teacher_after').notNull().default(''),
  leavesClass: text('leaves_class').notNull().default(''),
  entersClass: text('enters_class').notNull().default(''),
  changeType: text('change_type').notNull().default('CAMBIO HORARIO'),
  changeReason: text('change_reason').notNull().default(''),
  transferDate: text('transfer_date').notNull().default(''), // YYYY-MM-DD
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Talleres puntuales: sesiones sueltas de un día, no recurrentes.
export const workshops = pgTable('workshops', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  room: text('room'),
  workshopDate: text('workshop_date').notNull(), // YYYY-MM-DD
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  capacity: integer('capacity').notNull().default(8),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workshopStudents = pgTable(
  'workshop_students',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    workshopId: integer('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workshop_students_idx').on(t.workshopId, t.studentId)],
);

// Orientación vocacional: orientadoras y citas con doble estado.
export const counselors = pgTable('orientadoras', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  title: text('title').notNull().default('Orientadora'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const counselingAppointments = pgTable('citas_orientacion', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  counselorId: integer('counselor_id').notNull().references(() => counselors.id, { onDelete: 'cascade' }),
  studentName: text('student_name').notNull(),
  agendadoPor: text('agendado_por').notNull().default(''),
  fecha: text('fecha').notNull(), // YYYY-MM-DD
  horaInicio: text('hora_inicio').notNull(), // HH:MM
  motivo: text('motivo').notNull().default(''),
  estadoConfirma: text('estado_confirma').notNull().default('pendiente'), // pendiente | confirmada | no_confirma
  estadoAsiste: text('estado_asiste').notNull().default('pendiente'), // pendiente | asiste | no_asiste
  notaRapida: text('nota_rapida').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('waitlist_course_student_idx').on(t.courseId, t.studentId)],
);
