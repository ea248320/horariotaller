import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

function mapRow(row: Record<string, unknown>, students: string[] = []) {
  return {
    id: row.id,
    horarioId: row.horario_id,
    sede: row.sede,
    teacher: row.teacher,
    name: row.name,
    workshopDate: row.workshop_date,
    workshopTime: row.workshop_time,
    maxStudents: row.max_students,
    students,
    createdAt: row.created_at,
  };
}

// GET /api/workshops?horarioId=TEMUCO&sede=LAS+ENCINAS
router.get("/workshops", async (req, res) => {
  const { horarioId, sede } = req.query as Record<string, string>;
  const client = await pool.connect();
  try {
    const params: string[] = [];
    let where = "WHERE 1=1";
    if (horarioId) { params.push(horarioId); where += ` AND w.horario_id = $${params.length}`; }
    if (sede)      { params.push(sede);      where += ` AND w.sede = $${params.length}`; }

    const result = await client.query(
      `SELECT w.*,
         COALESCE(
           json_agg(ws.student_name ORDER BY ws.created_at)
           FILTER (WHERE ws.student_name IS NOT NULL),
           '[]'
         ) AS students
       FROM workshops w
       LEFT JOIN workshop_students ws ON ws.workshop_id = w.id
       ${where}
       GROUP BY w.id
       ORDER BY w.created_at DESC`,
      params
    );

    res.json(result.rows.map(row => mapRow(row, row.students as string[])));
  } catch (err) {
    console.error("GET /workshops:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

// POST /api/workshops
router.post("/workshops", async (req, res) => {
  const { horarioId, sede, teacher, name, workshopDate, workshopTime, maxStudents } = req.body as Record<string, string>;
  if (!horarioId || !sede || !teacher?.trim()) {
    return res.status(400).json({ error: "horarioId, sede y teacher son requeridos" });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO workshops (horario_id, sede, teacher, name, workshop_date, workshop_time, max_students)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [horarioId, sede, teacher.trim(), (name ?? "").trim(), (workshopDate ?? "").trim(), (workshopTime ?? "").trim(), maxStudents ?? 8]
    );
    res.status(201).json(mapRow(result.rows[0], []));
  } catch (err) {
    console.error("POST /workshops:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

// PATCH /api/workshops/:id
router.patch("/workshops/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { teacher, name, sede, workshopDate, workshopTime, maxStudents } = req.body as Record<string, string>;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE workshops
       SET teacher        = COALESCE($1, teacher),
           name           = COALESCE($2, name),
           sede           = COALESCE($3, sede),
           workshop_date  = COALESCE($4, workshop_date),
           workshop_time  = COALESCE($5, workshop_time),
           max_students   = COALESCE($6, max_students)
       WHERE id = $7 RETURNING *`,
      [
        teacher  !== undefined ? teacher.trim()       : null,
        name     !== undefined ? name.trim()          : null,
        sede     !== undefined ? sede                 : null,
        workshopDate !== undefined ? workshopDate.trim() : null,
        workshopTime !== undefined ? workshopTime.trim() : null,
        maxStudents  !== undefined ? parseInt(maxStudents) : null,
        id,
      ]
    );
    if (!result.rowCount) return res.status(404).json({ error: "No encontrado" });
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error("PATCH /workshops/:id:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

// DELETE /api/workshops/:id
router.delete("/workshops/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM workshops WHERE id = $1", [id]);
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /workshops/:id:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

// POST /api/workshops/:id/students
router.post("/workshops/:id/students", async (req, res) => {
  const workshopId = parseInt(req.params.id);
  const { studentName } = req.body as { studentName: string };
  if (!studentName?.trim()) return res.status(400).json({ error: "studentName requerido" });
  const client = await pool.connect();
  try {
    const ws = await client.query("SELECT max_students FROM workshops WHERE id = $1", [workshopId]);
    if (!ws.rowCount) return res.status(404).json({ error: "Taller no encontrado" });
    const maxStudents: number = ws.rows[0].max_students;
    const count = await client.query(
      "SELECT COUNT(*) AS cnt FROM workshop_students WHERE workshop_id = $1", [workshopId]
    );
    if (parseInt(count.rows[0].cnt) >= maxStudents) {
      return res.status(409).json({ error: "Taller lleno" });
    }
    await client.query(
      "INSERT INTO workshop_students (workshop_id, student_name) VALUES ($1, $2)",
      [workshopId, studentName.trim()]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /workshops/:id/students:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

// DELETE /api/workshops/:id/students/:name
router.delete("/workshops/:id/students/:name", async (req, res) => {
  const workshopId = parseInt(req.params.id);
  const studentName = decodeURIComponent(req.params.name);
  const client = await pool.connect();
  try {
    await client.query(
      "DELETE FROM workshop_students WHERE workshop_id = $1 AND student_name = $2",
      [workshopId, studentName]
    );
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /workshops/:id/students/:name:", err);
    res.status(500).json({ error: "DB error" });
  } finally {
    client.release();
  }
});

export default router;
