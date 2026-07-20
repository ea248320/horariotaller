import { Router } from "express";
import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/team — returns all members (team is global across all sedes)
router.get("/team", async (_req, res) => {
  try {
    const members = await db.select().from(teamMembersTable);
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener equipo" });
  }
});

// POST /api/team — team is global, horarioId is always "GLOBAL"
router.post("/team", async (req, res) => {
  try {
    const { name, role, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name es requerido" });
    }
    const [member] = await db.insert(teamMembersTable).values({
      name: name.trim(),
      role: role || "secretaria",
      horarioId: "GLOBAL",
      color: color || "violet",
    }).returning();
    res.status(201).json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear miembro" });
  }
});

// PATCH /api/team/:id
router.patch("/team/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, role, color } = req.body;
    const [updated] = await db.update(teamMembersTable)
      .set({ ...(name && { name }), ...(role && { role }), ...(color && { color }) })
      .where(eq(teamMembersTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Miembro no encontrado" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar miembro" });
  }
});

// DELETE /api/team/:id
router.delete("/team/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(teamMembersTable).where(eq(teamMembersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar miembro" });
  }
});

export default router;
