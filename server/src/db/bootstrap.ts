import { pool } from './index';

// Sin CLI de migraciones todavía: el esquema se crea/actualiza al arrancar con
// CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS.
// Para agregar una columna nueva: sumarla al CREATE TABLE (instalaciones
// nuevas) Y agregar un ALTER TABLE ... ADD COLUMN IF NOT EXISTS (existentes).
const statements = [
  `CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'personalizado',
    course_label TEXT NOT NULL DEFAULT 'Curso',
    student_label TEXT NOT NULL DEFAULT 'Alumno',
    brand_color TEXT NOT NULL DEFAULT '#4F46E5',
    fees_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    plan TEXT NOT NULL DEFAULT 'starter',
    subscription_active BOOLEAN NOT NULL DEFAULT FALSE,
    trial_ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    subject TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    room TEXT,
    capacity INTEGER NOT NULL DEFAULT 20,
    semester TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_blocks (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    guardian_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_course_idx
    ON enrollments (student_id, course_id)`,
  `CREATE TABLE IF NOT EXISTS payment_records (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    paid_at TIMESTAMPTZ
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payment_records_student_month_idx
    ON payment_records (student_id, month)`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS waitlist_entries (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS waitlist_course_student_idx
    ON waitlist_entries (course_id, student_id)`,
  // ─── Módulos portados de Emilia ───
  `CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assigned_to TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'MEDIA',
    status TEXT NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS task_items (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS notas (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    autor TEXT NOT NULL DEFAULT '',
    titulo TEXT NOT NULL DEFAULT '',
    contenido TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'amarillo',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cambios (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    teacher_before TEXT NOT NULL DEFAULT '',
    teacher_after TEXT NOT NULL DEFAULT '',
    leaves_class TEXT NOT NULL DEFAULT '',
    enters_class TEXT NOT NULL DEFAULT '',
    change_type TEXT NOT NULL DEFAULT 'CAMBIO HORARIO',
    change_reason TEXT NOT NULL DEFAULT '',
    transfer_date TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS workshops (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    room TEXT,
    workshop_date TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS workshop_students (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS workshop_students_idx
    ON workshop_students (workshop_id, student_id)`,
  `CREATE TABLE IF NOT EXISTS orientadoras (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Orientadora',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS citas_orientacion (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    counselor_id INTEGER NOT NULL REFERENCES orientadoras(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    agendado_por TEXT NOT NULL DEFAULT '',
    fecha TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT '',
    estado_confirma TEXT NOT NULL DEFAULT 'pendiente',
    estado_asiste TEXT NOT NULL DEFAULT 'pendiente',
    nota_rapida TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Migraciones aditivas para instalaciones existentes:
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_active BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester TEXT`,
];

export async function bootstrapDatabase(): Promise<void> {
  for (const sql of statements) {
    await pool.query(sql);
  }
}
