import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.get("/notas", async (req, res) => {
  const { horarioId } = req.query;
  if (!horarioId) return res.status(400).json({ error: "horarioId requerido" });
  try {
    const r = await pool.query(
      "SELECT * FROM notas WHERE horario_id = $1 ORDER BY pinned DESC, updated_at DESC",
      [horarioId],
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.post("/notas", async (req, res) => {
  const { horarioId, autor, titulo, contenido, color, pinned } = req.body;
  if (!horarioId) return res.status(400).json({ error: "horarioId requerido" });
  try {
    const r = await pool.query(
      `INSERT INTO notas (horario_id, autor, titulo, contenido, color, pinned)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [horarioId, autor ?? "", titulo ?? "", contenido ?? "", color ?? "amarillo", pinned ? 1 : 0],
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.patch("/notas/:id", async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido, color, pinned } = req.body;
  try {
    const fields: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (titulo    !== undefined) { fields.push(`titulo = $${i++}`);    vals.push(titulo); }
    if (contenido !== undefined) { fields.push(`contenido = $${i++}`); vals.push(contenido); }
    if (color     !== undefined) { fields.push(`color = $${i++}`);     vals.push(color); }
    if (pinned    !== undefined) { fields.push(`pinned = $${i++}`);    vals.push(pinned ? 1 : 0); }
    fields.push("updated_at = NOW()");
    vals.push(id);
    const r = await pool.query(
      `UPDATE notas SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      vals,
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

router.delete("/notas/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM notas WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
