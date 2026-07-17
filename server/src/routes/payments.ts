import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../db';
import { broadcast } from '../realtime/sse';

// Registro MANUAL de pagos de mensualidad. La plataforma nunca cobra ni
// procesa pagos de alumnos: la secretaria marca Pagado/Pendiente a mano cuando
// el alumno paga en efectivo o transferencia por fuera del sistema.
export const paymentsRouter = Router();

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

paymentsRouter.get('/', async (req, res) => {
  const month = String(req.query.month ?? '');
  if (!MONTH_RE.test(month)) {
    res.status(400).json({ error: "Falta el mes: usa ?month=YYYY-MM." });
    return;
  }
  const { rows } = await pool.query(
    `SELECT s.id AS "studentId", s.name, s.phone,
            COALESCE(p.status, 'pendiente') AS status,
            p.paid_at AS "paidAt"
       FROM students s
       LEFT JOIN payment_records p ON p.student_id = s.id AND p.month = $2
      WHERE s.org_id = $1
      ORDER BY s.name`,
    [req.orgId, month],
  );
  res.json({ month, records: rows });
});

paymentsRouter.put('/', async (req, res) => {
  const { studentId, month, status } = req.body ?? {};
  if (!studentId || !MONTH_RE.test(String(month)) || !['pagado', 'pendiente'].includes(status)) {
    res.status(400).json({ error: 'studentId, month (YYYY-MM) y status (pagado|pendiente) son obligatorios.' });
    return;
  }
  // El módulo de cuotas debe estar activo para este centro.
  const [org] = await db
    .select({ feesEnabled: schema.organizations.feesEnabled })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, req.orgId));
  if (!org?.feesEnabled) {
    res.status(400).json({ error: 'El módulo de cuotas no está activo para este centro.' });
    return;
  }
  // El alumno debe pertenecer a esta organización.
  const { rows: owned } = await pool.query(
    'SELECT id FROM students WHERE id = $1 AND org_id = $2',
    [studentId, req.orgId],
  );
  if (owned.length === 0) {
    res.status(404).json({ error: 'Alumno no encontrado.' });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO payment_records (org_id, student_id, month, status, paid_at)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'pagado' THEN now() ELSE NULL END)
     ON CONFLICT (student_id, month)
     DO UPDATE SET status = $4, paid_at = CASE WHEN $4 = 'pagado' THEN now() ELSE NULL END
     RETURNING id, student_id AS "studentId", month, status, paid_at AS "paidAt"`,
    [req.orgId, studentId, month, status],
  );
  broadcast(req.orgId, 'payments:changed', { month });
  res.json({ record: rows[0] });
});
