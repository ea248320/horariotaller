import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskItemsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/tasks?horarioId=TEMUCO  (admin: no horarioId → all tasks)
router.get("/tasks", async (req, res) => {
  try {
    const { horarioId, personalOwner } = req.query as Record<string, string>;

    let tasks;
    if (horarioId === "ADMIN") {
      tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    } else if (personalOwner) {
      tasks = await db
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.horarioId, horarioId || ""),
            eq(tasksTable.isPersonal, 1),
            eq(tasksTable.personalOwner, personalOwner)
          )
        )
        .orderBy(tasksTable.createdAt);
    } else if (horarioId) {
      tasks = await db
        .select()
        .from(tasksTable)
        .where(and(eq(tasksTable.horarioId, horarioId), eq(tasksTable.isPersonal, 0)))
        .orderBy(tasksTable.createdAt);
    } else {
      tasks = await db.select().from(tasksTable).orderBy(tasksTable.createdAt);
    }

    const taskIds = tasks.map((t) => t.id);
    let items: typeof taskItemsTable.$inferSelect[] = [];
    if (taskIds.length > 0) {
      items = await db.select().from(taskItemsTable).orderBy(taskItemsTable.sortOrder);
      items = items.filter((i) => taskIds.includes(i.taskId));
    }

    const result = tasks.map((task) => ({
      ...task,
      items: items.filter((i) => i.taskId === task.id),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener tareas" });
  }
});

// POST /api/tasks
router.post("/tasks", async (req, res) => {
  try {
    const {
      title,
      description,
      horarioId,
      assignedTo,
      deadline,
      priority,
      status,
      createdBy,
      isPersonal,
      personalOwner,
      items,
    } = req.body;

    if (!title || !horarioId) {
      return res.status(400).json({ error: "title y horarioId son requeridos" });
    }

    const [task] = await db
      .insert(tasksTable)
      .values({
        title,
        description: description || "",
        horarioId,
        assignedTo: assignedTo || "",
        deadline: deadline || "",
        priority: priority || "MEDIA",
        status: status || "PENDIENTE",
        createdBy: createdBy || "Admin",
        isPersonal: isPersonal ? 1 : 0,
        personalOwner: personalOwner || "",
      })
      .returning();

    let createdItems: typeof taskItemsTable.$inferSelect[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      createdItems = await db
        .insert(taskItemsTable)
        .values(
          items.map((text: string, idx: number) => ({
            taskId: task.id,
            text,
            completed: 0,
            sortOrder: idx,
          }))
        )
        .returning();
    }

    res.status(201).json({ ...task, items: createdItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear tarea" });
  }
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const [updated] = await db
      .update(tasksTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Tarea no encontrada" });

    const items = await db.select().from(taskItemsTable).where(eq(taskItemsTable.taskId, id));
    res.json({ ...updated, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar tarea" });
  }
});

// DELETE /api/tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar tarea" });
  }
});

// POST /api/tasks/:id/items
router.post("/tasks/:id/items", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text es requerido" });

    const existing = await db.select().from(taskItemsTable).where(eq(taskItemsTable.taskId, taskId));
    const [item] = await db
      .insert(taskItemsTable)
      .values({ taskId, text, completed: 0, sortOrder: existing.length })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear ítem" });
  }
});

// PATCH /api/tasks/:id/items/:itemId
router.patch("/tasks/:id/items/:itemId", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const updates = req.body;

    const [updated] = await db
      .update(taskItemsTable)
      .set(updates)
      .where(eq(taskItemsTable.id, itemId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Ítem no encontrado" });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar ítem" });
  }
});

// DELETE /api/tasks/:id/items/:itemId
router.delete("/tasks/:id/items/:itemId", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    await db.delete(taskItemsTable).where(eq(taskItemsTable.id, itemId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar ítem" });
  }
});

export default router;
