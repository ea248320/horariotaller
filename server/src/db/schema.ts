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
