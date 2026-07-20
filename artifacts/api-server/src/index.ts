import app from "./app";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        horario_id TEXT NOT NULL,
        assigned_to TEXT NOT NULL DEFAULT '',
        deadline TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'MEDIA',
        status TEXT NOT NULL DEFAULT 'PENDIENTE',
        created_by TEXT NOT NULL DEFAULT 'Admin',
        is_personal INTEGER NOT NULL DEFAULT 0,
        personal_owner TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_items (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'secretaria',
        horario_id TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT 'violet',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshops (
        id SERIAL PRIMARY KEY,
        horario_id TEXT NOT NULL,
        sede TEXT NOT NULL,
        teacher TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        workshop_date TEXT NOT NULL DEFAULT '',
        workshop_time TEXT NOT NULL DEFAULT '',
        max_students INTEGER NOT NULL DEFAULT 8,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshop_students (
        id SERIAL PRIMARY KEY,
        workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      ALTER TABLE schedule_classes ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'PRIMER'
    `);
    await client.query(`
      ALTER TABLE schedule_students ADD COLUMN IF NOT EXISTS class_semester TEXT NOT NULL DEFAULT 'PRIMER'
    `);
    await client.query(`
      UPDATE schedule_students ss
      SET class_semester = sc.semester
      FROM schedule_classes sc
      WHERE ss.class_code = sc.class_code
        AND ss.class_semester = 'PRIMER'
        AND sc.semester != 'PRIMER'
    `);
    await client.query(`
      DELETE FROM schedule_classes WHERE class_code LIKE '%\\_S2'
    `);
    await client.query(`
      DO $$ DECLARE r text; BEGIN
        FOR r IN
          SELECT c.conname FROM pg_constraint c
          JOIN pg_class t  ON t.oid  = c.conrelid
          JOIN pg_class ft ON ft.oid = c.confrelid
          WHERE t.relname = 'schedule_students'
            AND ft.relname = 'schedule_classes'
            AND c.contype = 'f'
        LOOP
          EXECUTE format('ALTER TABLE schedule_students DROP CONSTRAINT IF EXISTS %I', r);
        END LOOP;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'schedule_classes_v3_pk'
            AND conrelid = 'schedule_classes'::regclass
        ) THEN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'schedule_classes_class_code_semester_pk'
              AND conrelid = 'schedule_classes'::regclass
          ) THEN
            ALTER TABLE schedule_classes DROP CONSTRAINT schedule_classes_class_code_semester_pk;
          END IF;
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'schedule_classes_pkey'
              AND conrelid = 'schedule_classes'::regclass
          ) THEN
            ALTER TABLE schedule_classes DROP CONSTRAINT schedule_classes_pkey;
          END IF;
          ALTER TABLE schedule_classes ADD CONSTRAINT schedule_classes_v3_pk PRIMARY KEY (class_code, semester, horario);
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER TABLE schedule_students ADD COLUMN IF NOT EXISTS class_horario TEXT NOT NULL DEFAULT 'TEMUCO'
    `);
    await client.query(`
      UPDATE schedule_students ss
      SET class_horario = sc.horario
      FROM schedule_classes sc
      WHERE ss.class_code = sc.class_code
        AND ss.class_semester = sc.semester
        AND ss.class_horario = 'TEMUCO'
        AND sc.horario != 'TEMUCO'
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'schedule_students_class_fk_v3'
        ) THEN
          ALTER TABLE schedule_students
            ADD CONSTRAINT schedule_students_class_fk_v3
            FOREIGN KEY (class_code, class_semester, class_horario)
            REFERENCES schedule_classes(class_code, semester, horario) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    // ── Orientación tables ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientadoras (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        titulo TEXT NOT NULL DEFAULT 'Orientadora',
        foto_url TEXT NOT NULL DEFAULT '',
        activa INTEGER NOT NULL DEFAULT 1,
        orden INTEGER NOT NULL DEFAULT 99,
        creada_en TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientacion_horario_habitual (
        id SERIAL PRIMARY KEY,
        orientadora_id INTEGER NOT NULL REFERENCES orientadoras(id) ON DELETE CASCADE,
        dia_semana TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientacion_bloqueo_fecha (
        id SERIAL PRIMARY KEY,
        orientadora_id INTEGER NOT NULL REFERENCES orientadoras(id) ON DELETE CASCADE,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        hora_inicio TEXT,
        motivo TEXT
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientacion_desbloqueo_fecha (
        id SERIAL PRIMARY KEY,
        orientadora_id INTEGER NOT NULL REFERENCES orientadoras(id) ON DELETE CASCADE,
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS citas_orientacion (
        id SERIAL PRIMARY KEY,
        orientadora_id INTEGER NOT NULL REFERENCES orientadoras(id) ON DELETE CASCADE,
        nombre_estudiante TEXT NOT NULL,
        agendado_por TEXT NOT NULL DEFAULT '',
        fecha TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        motivo TEXT,
        estado_confirma TEXT NOT NULL DEFAULT 'pendiente',
        estado_asiste TEXT NOT NULL DEFAULT 'pendiente',
        creada_en TIMESTAMP DEFAULT NOW()
      )
    `);
    // ── Schedule year column ──────────────────────────────────────────────
    await client.query(`
      ALTER TABLE schedule_classes ADD COLUMN IF NOT EXISTS school_year INTEGER NOT NULL DEFAULT ${new Date().getFullYear()}
    `);
    // ── nota_rapida en citas ──────────────────────────────────────────────
    await client.query(`
      ALTER TABLE citas_orientacion ADD COLUMN IF NOT EXISTS nota_rapida TEXT
    `);
    // ── dado_de_alta en citas ─────────────────────────────────────────────
    await client.query(`
      ALTER TABLE citas_orientacion ADD COLUMN IF NOT EXISTS dado_de_alta BOOLEAN NOT NULL DEFAULT FALSE
    `);
    // ── Estados configurables de citas ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientacion_estados (
        id SERIAL PRIMARY KEY,
        tipo TEXT NOT NULL DEFAULT 'confirma',
        label TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#94a3b8',
        orden INTEGER NOT NULL DEFAULT 99
      )
    `);
    // Seed defaults if empty
    const { rows: estadosRows } = await client.query(`SELECT COUNT(*) FROM orientacion_estados`);
    if (parseInt(estadosRows[0].count) === 0) {
      await client.query(`
        INSERT INTO orientacion_estados (tipo, label, color, orden) VALUES
          ('confirma','pendiente','#f59e0b',0),
          ('confirma','confirma','#10b981',1),
          ('confirma','reagenda','#3b82f6',2),
          ('confirma','cancela','#ef4444',3),
          ('confirma','osorno','#8b5cf6',4),
          ('asiste','pendiente','#94a3b8',0),
          ('asiste','asiste','#10b981',1),
          ('asiste','no asiste','#f43f5e',2)
      `);
    }
    // ── Notas ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY,
        horario_id TEXT NOT NULL,
        autor TEXT NOT NULL DEFAULT '',
        titulo TEXT NOT NULL DEFAULT '',
        contenido TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT 'amarillo',
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // ── Horas disponibles para Orientación (ahora por orientadora) ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orientacion_horas_disponibles (
        hora TEXT NOT NULL
      )
    `);
    await client.query(`
      ALTER TABLE orientacion_horas_disponibles ADD COLUMN IF NOT EXISTS orientadora_id INTEGER
    `);
    // Si quedan filas del esquema global antiguo (sin orientadora_id), se copian
    // a cada orientadora existente para no perder las horas ya configuradas.
    const { rows: horasGlobales } = await client.query(
      `SELECT DISTINCT hora FROM orientacion_horas_disponibles WHERE orientadora_id IS NULL`
    );
    if (horasGlobales.length > 0) {
      const { rows: todasOrientadoras } = await client.query(`SELECT id FROM orientadoras`);
      for (const o of todasOrientadoras) {
        for (const h of horasGlobales) {
          await client.query(
            `INSERT INTO orientacion_horas_disponibles (orientadora_id, hora)
             SELECT $1, $2 WHERE NOT EXISTS (
               SELECT 1 FROM orientacion_horas_disponibles WHERE orientadora_id = $1 AND hora = $2
             )`,
            [o.id, h.hora]
          );
        }
      }
      await client.query(`DELETE FROM orientacion_horas_disponibles WHERE orientadora_id IS NULL`);
    }
    await client.query(`
      ALTER TABLE orientacion_horas_disponibles ALTER COLUMN orientadora_id SET NOT NULL
    `);
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'orientacion_horas_disponibles_pkey'
            AND conrelid = 'orientacion_horas_disponibles'::regclass
        ) THEN
          ALTER TABLE orientacion_horas_disponibles DROP CONSTRAINT orientacion_horas_disponibles_pkey;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'orientacion_horas_disponibles_v2_pk'
            AND conrelid = 'orientacion_horas_disponibles'::regclass
        ) THEN
          ALTER TABLE orientacion_horas_disponibles
            ADD CONSTRAINT orientacion_horas_disponibles_v2_pk PRIMARY KEY (orientadora_id, hora);
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'orientacion_horas_disponibles_fk_v2'
        ) THEN
          ALTER TABLE orientacion_horas_disponibles
            ADD CONSTRAINT orientacion_horas_disponibles_fk_v2
            FOREIGN KEY (orientadora_id) REFERENCES orientadoras(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    // Si alguna orientadora quedó sin ninguna hora configurada (p.ej. recién creada
    // antes de este cambio), se le dan las horas por defecto para no dejarla en blanco.
    await client.query(`
      INSERT INTO orientacion_horas_disponibles (orientadora_id, hora)
      SELECT o.id, h.hora
      FROM orientadoras o
      CROSS JOIN (VALUES
        ('08:00'),('09:00'),('10:00'),('11:00'),('12:00'),('13:00'),('14:00'),
        ('15:00'),('16:00'),('17:00'),('18:00'),('19:00'),('20:00')
      ) AS h(hora)
      WHERE NOT EXISTS (
        SELECT 1 FROM orientacion_horas_disponibles x WHERE x.orientadora_id = o.id
      )
    `);
    console.log("Tables ensured (tasks, task_items, team_members, workshops, workshop_students, orientación, notas, horas_disponibles, semester column, composite PK/FK)");
  } catch (err) {
    console.error("Error ensuring tables:", err);
  } finally {
    client.release();
  }
}

ensureTables().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
