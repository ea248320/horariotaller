import { Router, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { db } from "@workspace/db";
import { scheduleClassesTable, scheduleStudentsTable, scheduleHorariosTable, scheduleTransfersTable } from "@workspace/db/schema";
import { eq, sql, and, inArray, ne } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// ─── Presencia en tiempo real (en memoria) ───────────────────────────────────
const presenceSessions = new Map<string, { name: string; seenAt: number }>();
const PRESENCE_TTL = 30_000; // 30 segundos sin heartbeat = desconectado

function getActiveSessions() {
  const now = Date.now();
  for (const [id, s] of presenceSessions) {
    if (now - s.seenAt > PRESENCE_TTL) presenceSessions.delete(id);
  }
  return [...presenceSessions.values()];
}

router.get("/schedule/presence", (_req, res) => {
  res.json(getActiveSessions());
});

router.post("/schedule/presence", (req, res) => {
  const { sessionId, name } = req.body as { sessionId?: string; name?: string };
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  presenceSessions.set(sessionId, { name: name ?? "Secretaria", seenAt: Date.now() });
  res.json({ active: getActiveSessions().length });
});

router.delete("/schedule/presence/:sessionId", (req, res) => {
  presenceSessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

// ─── Indicadores de "escribiendo" en tiempo real ──────────────────────────────
const typingSessions = new Map<string, { classCode: string; name: string; seenAt: number }>();
const TYPING_TTL = 5_000; // 5 s sin refresh = ya no está escribiendo

function getActiveTyping() {
  const now = Date.now();
  for (const [id, t] of typingSessions) {
    if (now - t.seenAt > TYPING_TTL) typingSessions.delete(id);
  }
  return [...typingSessions.values()];
}

router.get("/schedule/typing", (_req, res) => {
  res.json(getActiveTyping());
});

router.post("/schedule/typing", (req, res) => {
  const { sessionId, classCode, name } = req.body as { sessionId?: string; classCode?: string; name?: string };
  if (!sessionId || !classCode) return res.status(400).json({ error: "required" });
  typingSessions.set(sessionId, { classCode, name: name ?? "Secretaria", seenAt: Date.now() });
  res.json({ ok: true });
});

router.delete("/schedule/typing/:sessionId", (req, res) => {
  typingSessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

// ─── Notificaciones en tiempo real (SSE) ─────────────────────────────────────
const notifClients = new Map<string, Set<Response>>();

function getNotifChannel(horarioId: string, sede: string) {
  return `${horarioId}:${sede}`;
}

router.get("/notifications/stream", (req, res) => {
  const { horarioId, sede } = req.query as { horarioId?: string; sede?: string };
  if (!horarioId || !sede) {
    res.status(400).json({ error: "horarioId y sede son requeridos" });
    return;
  }
  const channel = getNotifChannel(horarioId, sede);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  res.write(": connected\n\n");

  if (!notifClients.has(channel)) notifClients.set(channel, new Set());
  notifClients.get(channel)!.add(res);

  const keepalive = setInterval(() => {
    res.write(": ping\n\n");
  }, 20_000);

  req.on("close", () => {
    clearInterval(keepalive);
    notifClients.get(channel)?.delete(res);
    if (notifClients.get(channel)?.size === 0) notifClients.delete(channel);
  });
});

router.post("/notifications/publish", (req, res) => {
  const { horarioId, sede, classCode, course, day, time, cupos } = req.body as {
    horarioId?: string;
    sede?: string;
    classCode?: string;
    course?: string;
    day?: string;
    time?: string;
    cupos?: number;
  };
  if (!horarioId || !sede || !classCode) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return;
  }

  const payload = JSON.stringify({
    type: "cupo_disponible",
    horarioId,
    sede,
    classCode,
    course: course ?? classCode,
    day: day ?? "",
    time: time ?? "",
    cupos: cupos ?? 1,
    timestamp: new Date().toISOString(),
  });

  // Broadcast to ALL sedes of this horario (so Las Encinas ↔ Inés de Suárez share notifications)
  const prefix = `${horarioId}:`;
  let totalSent = 0;
  for (const [ch, clients] of notifClients) {
    if (!ch.startsWith(prefix)) continue;
    for (const client of clients) {
      client.write(`data: ${payload}\n\n`);
    }
    totalSent += clients.size;
  }

  res.json({ ok: true, sent: totalSent });
});

const DAY_TOKEN_MAP: Record<string, string> = {
  LUN: "LUNES", MAR: "MARTES", MIE: "MIERCOLES", JUE: "JUEVES", VIE: "VIERNES",
};

const TIME_SLOT_MAP: Record<string, string> = {
  "09.15": "09.15 - 10.15",
  "10.30": "10:30 - 11:30",
  "11.45": "11.45 - 12.45",
  "15.30": "15.30 - 16.30",
  "16.45": "16.45 - 17.45",
  "18.00": "18.00 - 19.00",
  "19.15": "19.15 - 20.15",
};

const DAY_TOKENS = Object.keys(DAY_TOKEN_MAP);

function parseClassCode(code: string): { course: string; day: string; time: string; teacher: string } | null {
  const parts = code.split(/\s+/);
  const dayIdx = parts.findIndex(p => DAY_TOKENS.includes(p.toUpperCase()));
  if (dayIdx < 1) return null;
  const rawDay = parts[dayIdx].toUpperCase();
  const rawTime = parts[dayIdx + 1] ?? "";
  return {
    course: parts.slice(0, dayIdx).join(" "),
    day: DAY_TOKEN_MAP[rawDay] ?? rawDay,
    time: TIME_SLOT_MAP[rawTime] ?? rawTime,
    teacher: parts[dayIdx + 2] ?? "",
  };
}

// Sede names per horario — used for DB storage + seed fallback
const HORARIO_SEDES: Record<string, string[]> = {
  TEMUCO:      ["LAS ENCINAS", "INES DE SUAREZ"],
  ALMAGRO:     ["D. ALMAGRO"],
  VILLARRICA:  ["VILLARRICA"],
  AV_ALEMANIA: ["AV. ALEMANIA"],
};

// Maps horarioId → the value that appears in column 0 (Nivel) of the exported Excel
const HORARIO_NIVEL: Record<string, string> = {
  TEMUCO:      "SEDE TEMUCO",
  ALMAGRO:     "SEDE OSORNO",
  VILLARRICA:  "SEDE VILLARRICA",
  AV_ALEMANIA: "SEDE AV. ALEMANIA",
};

// Normalize the raw sede string extracted from the Clase column to a canonical DB value
function normalizeSede(raw: string, fallback: string): string {
  const s = raw.trim().toUpperCase().replace(/^SEDE\s+/, "");
  if (/^AV\.?\s*ALEMANIA/.test(s)) return "AV. ALEMANIA";
  if (/^D\.?\s*ALMAGRO/.test(s))   return "D. ALMAGRO";
  if (/INES\s+DE\s+SUAREZ/.test(s)) return "INES DE SUAREZ";
  if (/LAS\s+ENCINAS/.test(s))      return "LAS ENCINAS";
  if (/VILLARRICA/.test(s))         return "VILLARRICA";
  return fallback;
}

type ClassMap = Map<string, { students: string[]; sala: number | null; sede: string }>;

// Col 1 (Grado) encodes semester: "INTENSIVO 2026/2" → SEGUNDO, everything else → PRIMER.
function parseSemesterFromGrado(raw: unknown): "PRIMER" | "SEGUNDO" {
  return String(raw ?? "").includes("/2") ? "SEGUNDO" : "PRIMER";
}

function importExcelBuffer(buffer: Buffer, horarioId = "TEMUCO") {
  const nivelFilter = (HORARIO_NIVEL[horarioId] ?? HORARIO_NIVEL["TEMUCO"]).toUpperCase();
  const defaultSede = HORARIO_SEDES[horarioId]?.[0] ?? "LAS ENCINAS";

  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
  const dataRows = rows.slice(1).filter(r => r.length >= 5);

  // Filter by column 0 (Nivel) — the most reliable campus identifier
  const matching = dataRows.filter(r => String(r[0]).trim().toUpperCase() === nivelFilter);

  // Column layout: [Nivel, Grado, Clase, Nombre, Apellido, ...]
  // Semester comes from col 1 (Grado): "INTENSIVO 2026/2" → SEGUNDO, else → PRIMER.
  const byCodePrimer: ClassMap = new Map();
  const byCodeSegundo: ClassMap = new Map();

  for (const r of matching) {
    const semester = parseSemesterFromGrado(r[1]);
    const byCode = semester === "SEGUNDO" ? byCodeSegundo : byCodePrimer;

    const clase = String(r[2]).trim();

    // Extract sala number
    let sala: number | null = null;
    const salaMatch = clase.match(/SALA\s+(\d+)/i);
    if (salaMatch) sala = parseInt(salaMatch[1], 10);

    // Remove SALA part, then split on " - " to isolate class code and sede
    const withoutSala = clase.replace(/\s*-?\s*SALA\s+\d+/i, "").trim();
    const dashParts = withoutSala.split(/\s*-\s+|\s+-\s*/);
    const classCode = dashParts[0].trim().replace(/(\d{2}):(\d{2})/g, "$1.$2");
    const sedeRaw = dashParts.slice(1).join(" ").trim();
    const sede = normalizeSede(sedeRaw, defaultSede);

    const nombre = String(r[3] ?? "").trim();
    const apellido = String(r[4] ?? "").trim();
    if (!nombre && !apellido) continue;
    const fullName = `${nombre} ${apellido}`.trim();

    if (!byCode.has(classCode)) byCode.set(classCode, { students: [], sala, sede });
    byCode.get(classCode)!.students.push(fullName);
  }

  return { byCodePrimer, byCodeSegundo, totalStudents: matching.length };
}

// Used for PRIMER: caller already wiped all PRIMER classes, so we just insert fresh.
async function upsertFromParsed(
  byCode: ClassMap,
  horario = "TEMUCO",
  semester: "PRIMER" | "SEGUNDO" = "PRIMER",
) {
  let created = 0, skipped = 0;
  const parseErrors: string[] = [];

  for (const [classCode, { students, sala, sede }] of byCode.entries()) {
    const parsed = parseClassCode(classCode);
    if (!parsed || !parsed.course || !parsed.day || !parsed.time) {
      parseErrors.push(classCode);
      skipped++;
      continue;
    }
    try {
      await db.insert(scheduleClassesTable).values({
        classCode,
        horario,
        course: parsed.course,
        day: parsed.day,
        time: parsed.time,
        teacher: parsed.teacher,
        sede,
        sala: sala ?? 1,
        semester,
      });
    } catch {
      parseErrors.push(classCode);
      skipped++;
      continue;
    }
    if (students.length > 0) {
      await db.insert(scheduleStudentsTable)
        .values(students.map(studentName => ({ classCode, classSemester: semester, classHorario: horario, studentName })));
    }
    created++;
  }

  return { created, updated: 0, skipped, removed: 0, parseErrors };
}

// Used for SEGUNDO: preserves all existing SEGUNDO classes (created via copy-semester).
// Only updates the student lists for the specific classes that appear in the Excel.
// Classes NOT in the Excel are left completely untouched.
async function updateSegundoStudentsFromParsed(
  byCode: ClassMap,
  horario: string,
) {
  let updated = 0, created = 0, skipped = 0;
  const parseErrors: string[] = [];

  for (const [classCode, { students, sala, sede }] of byCode.entries()) {
    const parsed = parseClassCode(classCode);
    if (!parsed || !parsed.course || !parsed.day || !parsed.time) {
      parseErrors.push(classCode);
      skipped++;
      continue;
    }

    // Ensure the SEGUNDO class exists; create it if missing (e.g. new class not yet copied)
    const existing = await db.select({ classCode: scheduleClassesTable.classCode })
      .from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.classCode, classCode),
        eq(scheduleClassesTable.semester, "SEGUNDO"),
        eq(scheduleClassesTable.horario, horario),
      ));

    if (existing.length === 0) {
      try {
        await db.insert(scheduleClassesTable).values({
          classCode,
          horario,
          course: parsed.course,
          day: parsed.day,
          time: parsed.time,
          teacher: parsed.teacher,
          sede,
          sala: sala ?? 1,
          semester: "SEGUNDO",
        });
        created++;
      } catch {
        parseErrors.push(classCode);
        skipped++;
        continue;
      }
    }

    // Replace students for this SEGUNDO class only
    await db.delete(scheduleStudentsTable).where(and(
      eq(scheduleStudentsTable.classCode, classCode),
      eq(scheduleStudentsTable.classSemester, "SEGUNDO"),
      eq(scheduleStudentsTable.classHorario, horario),
    ));
    if (students.length > 0) {
      await db.insert(scheduleStudentsTable)
        .values(students.map(studentName => ({ classCode, classSemester: "SEGUNDO" as const, classHorario: horario, studentName })));
    }
    updated++;
  }

  return { created, updated, skipped, parseErrors };
}

async function seedFromExcel(): Promise<boolean> {
  const excelDir = path.resolve(import.meta.dirname, "../../../../attached_assets");
  const files = fs.existsSync(excelDir) ? fs.readdirSync(excelDir).filter(f => f.includes("exportado_estudiantes_clases") && f.endsWith(".xlsx")) : [];
  if (files.length === 0) {
    return false;
  }
  const sorted = files.sort((a, b) => {
    const ma = fs.statSync(path.join(excelDir, a)).mtimeMs;
    const mb = fs.statSync(path.join(excelDir, b)).mtimeMs;
    return mb - ma;
  });
  const filePath = path.join(excelDir, sorted[0]);
  console.log(`[schedule] Seeding from ${filePath}...`);
  const buffer = fs.readFileSync(filePath);
  const { byCodePrimer } = importExcelBuffer(buffer);
  const result = await upsertFromParsed(byCodePrimer);
  console.log(`[schedule] Seed complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
  if (result.parseErrors.length > 0) console.log(`[schedule] Parse errors:`, result.parseErrors.slice(0, 10));
  return true;
}

// Also keep SEED_DATA for absolute fallback (empty DB + no Excel file)
const SEED_DATA = [
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 LUN 10.30 JR", students: ["Agustin Llanquihuen","Consuelo Martinez","Cristobal Muñoz","Florencia Bastias","Joseph Vergara","Martina Bello"], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS INT LUN 10.30 DE", students: ["Agustina Pérez","Aileen Lagos","Barbara Peña","Isidora Pereda","Paula Canales","Antonio Xi"], teacher: "DE", course: "FIS INT" },
  { day: "LUNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 6, classCode: "BIO INT LUN 10.30 AV", students: ["Florencia Pooley","Francisca Leal","Francisca Torrejón","Maitte Jofre","Maria Estrada","Martina Sanchez","Rafael Briceño"], teacher: "AV", course: "BIO INT" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 INT LUN 11.45 JR", students: ["Emilia Rivas","Gabriela Astorga","Javiera Ricke","Martin Schulz","Sofia Arriagada","Sofia Carrasco"], teacher: "JR", course: "M1 INT" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 3, classCode: "FIS LUN 11.45 DE", students: ["Benjamin Diaz","Cristobal Muñoz","Hi-Jue Wu","Joseph Vergara","Maria Araneda","Sofia Gomez","Vicente Salvatici"], teacher: "DE", course: "FIS" },
  { day: "LUNES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 6, classCode: "BIO LUN 11.45 AV", students: ["Antonella Axtell","Antonia Herrera","Consuelo Martinez","Dilan Medina","Josefa Saba","Lucas Fehling","Matilda Hermosilla"], teacher: "AV", course: "BIO" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 LUN 15.30 JR", students: [], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS LUN 15.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "LUNES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "LN LUN 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M2 INT LUN 16.45 PF", students: ["Agustina Morales","Alvaro Colomera","Agustin Llanquihuen","Emilia Rivas","Gabriela Astorga","Javiera Ricke","Martin Schulz"], teacher: "PF", course: "M2 INT" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 2, classCode: "LN LUN 16.45 SC", students: [], teacher: "SC", course: "LN" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "FIS INT LUN 16.45 DE", students: ["Agustina Pérez","Aileen Lagos","Barbara Peña","Isidora Pereda","Paula Canales","Antonio Xi"], teacher: "DE", course: "FIS INT" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 5, classCode: "BIO INT LUN 16.45 AV", students: ["Antonella Axtell","Antonia Herrera","Consuelo Martinez","Dilan Medina","Josefa Saba","Lucas Fehling","Matilda Hermosilla"], teacher: "AV", course: "BIO INT" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 1, classCode: "M1 LUN 16.45 JR", students: [], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 2, classCode: "LN LUN 16.45 KG", students: [], teacher: "KG", course: "LN" },
  { day: "LUNES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 16.45 SS", students: [], teacher: "SS", course: "BIO" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "M2 LUN 18.00 PF", students: ["Agustina Morales","Alvaro Colomera","Agustin Llanquihuen","Emilia Rivas","Gabriela Astorga","Javiera Ricke","Martin Schulz"], teacher: "PF", course: "M2" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 2, classCode: "LN LUN 18.00 SC", students: ["Agustina Gutierrez","Agustina Morales","Florencia Bastias","Francisca Torrejón","Matilde Yañez","Mia Vasconez","Vicente Caballero"], teacher: "SC", course: "LN" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 3, classCode: "FIS INT LUN 18.00 DE", students: [], teacher: "DE", course: "FIS INT" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "QUI INT LUN 18.00 CA", students: [], teacher: "CA", course: "QUI INT" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "HS LUN 18.00 FM", students: [], teacher: "FM", course: "HS" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "M1 LUN 18.00 JR", students: [], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "LN LUN 18.00 KG", students: [], teacher: "KG", course: "LN" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO LUN 18.00 SS", students: [], teacher: "SS", course: "BIO" },
  { day: "LUNES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 4, classCode: "FIS LUN 18.00 FM", students: [], teacher: "FM", course: "FIS" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "M2 LUN 19.15 PF", students: ["Emilia Huenchullan","Juan Saez","Bastian Henning","Antonella Valdes","Nicolas Jofré","Nicolas Vidal"], teacher: "PF", course: "M2" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 2, classCode: "LN INT LUN 19.15 SC", students: ["Agustina Gutierrez","Agustina Morales","Florencia Bastias","Francisca Torrejón","Matilde Yañez","Mia Vasconez","Vicente Caballero"], teacher: "SC", course: "LN INT" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 4, classCode: "QUI LUN 19.15 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 6, classCode: "HS INT LUN 19.15 FM", students: [], teacher: "FM", course: "HS INT" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 1, classCode: "M1 LUN 19.15 JR", students: ["Emilia Martínez","Emilio Del","Valentina Araneda","Valentina Lincolao"], teacher: "JR", course: "M1" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "LN LUN 19.15 KG", students: [], teacher: "KG", course: "LN" },
  { day: "LUNES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO INT LUN 19.15 SS", students: [], teacher: "SS", course: "BIO INT" },

  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 10.30 PF", students: ["Agustina Morales","Alvaro Colomera","Agustín Llanquihuen"], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI MAR 10.30 CA", students: ["Barbara Peña","Catalina Pritzke","Amanda Muñoz"], teacher: "CA", course: "QUI" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 5, classCode: "LN MAR 10.30 SC", students: ["Fernanda Lassalle","Amaro Godoy","Agustina Gutierrez"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 1, classCode: "M2 MAR 10.30 JR", students: ["Emilia Martínez","Emilio Del","Valentina Araneda","Valentina Lincolao"], teacher: "JR", course: "M2" },
  { day: "MARTES", time: "11.45 - 12.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 INT MAR 11.45 PF", students: [], teacher: "PF", course: "M1 INT" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 15.30 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 2, classCode: "LN MAR 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS MAR 15.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "MARTES", time: "15.30 - 16.30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MAR 15.30 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 16.45 JR", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Nicolas Vidal","Vicente Canteros"], teacher: "JR", course: "M1" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI MAR 16.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 5, classCode: "LN MAR 16.45 SC", students: ["Agustina Gutierrez","Agustina Morales","Florencia Bastias","Francisca Torrejón","Matilde Yañez","Mia Vasconez","Vicente Caballero"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MAR 16.45 PF", students: ["Emilia Martínez","Emilio Del","Valentina Araneda","Valentina Lincolao"], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 18.00 JR", students: ["Agustin Alister","Isidora Monsalve","Isidora Buck","León Kehr","María Albornoz","Nicolas Jofré","Vicente Canteros"], teacher: "JR", course: "M1" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 2, classCode: "LN MAR 18.00 SC", students: ["Catalina Cornejo","Leonor Martinez","Vicente Miranda","Isidora Arriagada","Rodrigo Moscoso","Mateo Zavala","Vicente Paslack"], teacher: "SC", course: "LN" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 4, classCode: "FIS INT MAR 18.00 DE", students: [], teacher: "DE", course: "FIS INT" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "CS MAR 18.00 CA", students: [], teacher: "CA", course: "CS" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MAR 18.00 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MARTES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MAR 18.00 SS", students: [], teacher: "SS", course: "BIO" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MAR 19.15 JR", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Catalina Gonzalez","Emilia Navarrete"], teacher: "JR", course: "M1" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 2, classCode: "LN INT MAR 19.15 SC", students: ["Catalina Cornejo","Leonor Martinez","Vicente Miranda","Isidora Arriagada","Rodrigo Moscoso","Mateo Zavala","Vicente Paslack"], teacher: "SC", course: "LN INT" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 4, classCode: "QUI INT MAR 19.15 CA", students: [], teacher: "CA", course: "QUI INT" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 1, classCode: "M1 MAR 19.15 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "M2 MAR 19.15 PF", students: [], teacher: "PF", course: "M2" },
  { day: "MARTES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO INT MAR 19.15 SS", students: [], teacher: "SS", course: "BIO INT" },

  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MIE 10.30 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 2, classCode: "LN MIE 10.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS MIE 10.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 1, classCode: "CS MIE 10.30 CA", students: [], teacher: "CA", course: "CS" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MIE 10.30 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MIERCOLES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MIE 10.30 SS", students: [], teacher: "SS", course: "BIO" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MIE 15.30 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "FIS MIE 15.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "MIERCOLES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "LN MIE 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 MIE 16.45 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 2, classCode: "LN MIE 16.45 SC", students: [], teacher: "SC", course: "LN" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI MIE 16.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "MIERCOLES", time: "16.45 - 17.45", sede: "INES DE SUAREZ", sala: 3, classCode: "M1 MIE 16.45 JR", students: [], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 3, classCode: "LT MIE 18.00 CP", students: [], teacher: "CP", course: "LT" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "BIO MIE 18.00 FM", students: ["Emilia Gomez","Karla Casanova","Javier Luders","Maximo Riquelme","Tomás Recabarren","O: Gaspar Nisin"], teacher: "FM", course: "BIO" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "M2 MIE 18.00 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia"], teacher: "JR", course: "M2" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 1, classCode: "CS MIE 18.00 CA", students: [], teacher: "CA", course: "CS" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MIE 18.00 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MIE 18.00 SS", students: ["Josefina Henning","Leonor Alcalde","Maite bastias","Valentine Panichine"], teacher: "SS", course: "BIO" },
  { day: "MIERCOLES", time: "18.00 - 19.00", sede: "INES DE SUAREZ", sala: 5, classCode: "LN MIE 18.00 KG", students: [], teacher: "KG", course: "LN" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 5, classCode: "BIO MIE 19.15 FM", students: ["Emilia Gomez","Karla Casanova","Javier Luders","Maximo Riquelme","Clemente Sanhueza","Javiera Salvatici","Martina Ortiz","Leonor Alcalde"], teacher: "FM", course: "BIO" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 6, classCode: "M1 MIE 19.15 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia","Valentina Panichine","Maite bastias"], teacher: "JR", course: "M1" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 MIE 19.15 PF", students: [], teacher: "PF", course: "M1" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 3, classCode: "BIO MIE 19.15 SS", students: ["Josefina Henning","Leonor Alcalde","Maite bastias"], teacher: "SS", course: "BIO" },
  { day: "MIERCOLES", time: "19.15 - 20.15", sede: "INES DE SUAREZ", sala: 4, classCode: "M1 MIE 19.15 KG", students: [], teacher: "KG", course: "M1" },

  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 10.30 PF", students: ["Agustina Morales","Alvaro Colomera","Agustín Llanquihuen"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 10.30 CA", students: ["Barbara Peña","Catalina Pritzke","Amanda Muñoz"], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 5, classCode: "LN JUE 10.30 SC", students: ["Fernanda Lassalle","Amaro Godoy","Agustina Gutierrez"], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 6, classCode: "BIO JUE 10.30 AV", students: ["Florencia Pooley","Francisca Leal","Maitte Jofre","Rafael Briceño"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 2, classCode: "M1 JUE 10.30 JR", students: ["Emilia Martínez","Emilio Del","Valentina Araneda","Valentina Lincolao"], teacher: "JR", course: "M1" },
  { day: "JUEVES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 4, classCode: "BIO INT JUE 10.30 FM", students: ["Florencia Pooley","Francisca Leal","Maitte Jofre","María Estrada","Martina Sanchez","Rafael Briceño"], teacher: "FM", course: "BIO INT" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 2, classCode: "LN JUE 15.30 SC", students: [], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 15.30 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "15.30 - 16.30", sede: "LAS ENCINAS", sala: 4, classCode: "FIS JUE 15.30 DE", students: [], teacher: "DE", course: "FIS" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 16.45 JR", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Nicolas Vidal","Vicente Canteros"], teacher: "JR", course: "M1" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 3, classCode: "QUI JUE 16.45 CA", students: [], teacher: "CA", course: "QUI" },
  { day: "JUEVES", time: "16.45 - 17.45", sede: "LAS ENCINAS", sala: 6, classCode: "BIO JUE 16.45 AV", students: ["Amparo Birke","Barbara Diaz","Ignacio Valenzuela","Isidora Rivas","Joaquin Perez","José Hoyuela"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 18.00 PF", students: ["Agustin Alister","Isidora Monsalve","Isidora Buck","León Kehr","María Albornoz","Nicolas Jofré","Vicente Canteros"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 2, classCode: "BIO JUE 18.00 AV", students: ["Amparo Birke","Antonella Espinoza","Benjamin Cid","Isidora San","Martina Valdés","Vicente Toro"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 5, classCode: "LN JUE 18.00 SC", students: ["Catalina Cornejo","Leonor Martinez","Vicente Miranda","Isidora Arriagada","Rodrigo Moscoso","Mateo Zavala","Vicente Paslack"], teacher: "SC", course: "LN" },
  { day: "JUEVES", time: "18.00 - 19.00", sede: "LAS ENCINAS", sala: 6, classCode: "MT JUE 18.00 JR", students: ["LEONOR MARTINEZ (CONFIRMAR)","VICENTE MIRANDA (CONFIRMAR)","TOMAS DIAZ (CONFIRMAR)","Cristobal Kind","Vicente Urrutia","Emilia Gomez","Karla Casanova","Jacobe henriquez","Maximo Riquelme","Tomás Recabarren"], teacher: "JR", course: "MT" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 1, classCode: "M1 JUE 19.15 PF", students: ["Antonella Valdes","Bastian Henning","Emilia Huenchullan","Juan Saez","Nicolas Jofré","Catalina Gonzalez","Emilia Navarrete"], teacher: "PF", course: "M1" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 2, classCode: "BIO JUE 19.15 AV", students: ["Amparo Birke","Camila Torres","Emilia Huenchullan","Bastian Henning","Antonella Valdes"], teacher: "AV", course: "BIO" },
  { day: "JUEVES", time: "19.15 - 20.15", sede: "LAS ENCINAS", sala: 6, classCode: "MT JUE 19.15 JR", students: ["Emilia Gomez","Karla Casanova","Elisa Gonzalez","Emilia Navarrete","Emilio Flores","Juan Carrillo","Wilfred Noel"], teacher: "JR", course: "MT" },

  { day: "VIERNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 1, classCode: "FIS VIE 10.30 DE", students: ["Agustín Llanquihuen","Benjamin Díaz","Amaro Godoy"], teacher: "DE", course: "FIS" },
  { day: "VIERNES", time: "10:30 - 11:30", sede: "LAS ENCINAS", sala: 4, classCode: "LN VIE 10.30 SC", students: ["Agustina Morales","Francisca Torrejón","Matilde Yañez","Mia Vasconez","Vicente Caballero","Sofia Gomez"], teacher: "SC", course: "LN" },
  { day: "VIERNES", time: "10:30 - 11:30", sede: "INES DE SUAREZ", sala: 1, classCode: "LN VIE 10.30 CP", students: ["Fernanda Lassalle","Barbara Peña","Amaro Godoy"], teacher: "CP", course: "LN" },
];

async function seedIfEmpty() {
  const count = await db.$count(scheduleClassesTable);
  if (count > 0) return;

  for (const entry of SEED_DATA) {
    await db.insert(scheduleClassesTable).values({
      classCode: entry.classCode,
      horario: "TEMUCO",
      day: entry.day,
      time: entry.time,
      sede: entry.sede,
      sala: entry.sala,
      teacher: entry.teacher,
      course: entry.course,
    }).onConflictDoNothing();

    for (const studentName of entry.students) {
      await db.insert(scheduleStudentsTable).values({
        classCode: entry.classCode,
        classSemester: "PRIMER",
        classHorario: "TEMUCO",
        studentName,
      }).onConflictDoNothing();
    }
  }
  console.log(`[schedule] Seeded ${SEED_DATA.length} classes`);
}

(async () => {
  // IMPORTANTE: el seed automático solo corre si la base de datos está
  // completamente vacía (0 clases). Si ya existen clases — aunque sean pocas —
  // significa que las secretarias ya hicieron cambios manuales y NO debemos
  // pisar esos datos con el Excel de attached_assets.
  const count = await db.$count(scheduleClassesTable);
  if (count > 0) {
    console.log(`[schedule] DB ya tiene ${count} clases — omitiendo seed automático`);
    return;
  }
  const excelSeeded = await seedFromExcel();
  if (!excelSeeded) {
    console.log("[schedule] No Excel seed file found, using fallback SEED_DATA");
    await seedIfEmpty();
  }
})().catch(console.error);

// GET /api/schedule?horario=TEMUCO&sede=LAS+ENCINAS
// Pass horario=ALL to get classes from every campus
router.get("/schedule", async (req, res) => {
  try {
    const { sede, horario } = req.query;
    const horarioParam = typeof horario === "string" ? horario : "TEMUCO";
    const fetchAll = horarioParam === "ALL";

    const classes = fetchAll
      ? await db.select().from(scheduleClassesTable)
      : await db.select().from(scheduleClassesTable)
          .where(eq(scheduleClassesTable.horario, horarioParam));

    // Only fetch students for the classes we retrieved — avoids a full table scan
    const classCodes = classes.map(c => c.classCode);
    const students = classCodes.length > 0
      ? await db.select().from(scheduleStudentsTable)
          .where(inArray(scheduleStudentsTable.classCode, classCodes))
      : [];

    // Key by "classCode|classSemester|horario" to correctly isolate per campus+semester
    const studentsByClass: Record<string, string[]> = {};
    for (const s of students) {
      const key = `${s.classCode}|${s.classSemester}|${s.classHorario}`;
      if (!studentsByClass[key]) studentsByClass[key] = [];
      studentsByClass[key].push(s.studentName);
    }

    let result = classes.map(c => ({
      classCode: c.classCode,
      day: c.day,
      time: c.time,
      sede: c.sede,
      sala: c.sala,
      teacher: c.teacher,
      course: c.course,
      horario: c.horario,
      semester: c.semester ?? "PRIMER",
      students: studentsByClass[`${c.classCode}|${c.semester ?? "PRIMER"}|${c.horario}`] ?? [],
    }));

    if (sede && typeof sede === "string") {
      result = result.filter(c => c.sede === sede);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Schedule SSE — actualizaciones en tiempo real ───────────────────────────
const scheduleClients = new Map<string, Set<Response>>();

function broadcastScheduleChange(horarioId: string, eventType: "schedule_changed" | "schedule_wiped" = "schedule_changed") {
  const payload = `data: ${JSON.stringify({ type: eventType })}\n\n`;
  scheduleClients.get(horarioId)?.forEach(client => client.write(payload));
}

router.get("/schedule/stream", (req, res) => {
  const { horarioId } = req.query as { horarioId?: string };
  if (!horarioId) { res.status(400).json({ error: "horarioId requerido" }); return; }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  if (!scheduleClients.has(horarioId)) scheduleClients.set(horarioId, new Set());
  scheduleClients.get(horarioId)!.add(res);

  const keepalive = setInterval(() => res.write(": ping\n\n"), 20_000);
  req.on("close", () => {
    clearInterval(keepalive);
    scheduleClients.get(horarioId)?.delete(res);
    if (scheduleClients.get(horarioId)?.size === 0) scheduleClients.delete(horarioId);
  });
});

// POST /api/schedule/:classCode/students  body: { name }
router.post("/schedule/:classCode/students", async (req, res) => {
  try {
    const { classCode } = req.params;
    const { name } = req.body as { name: string };
    const VALID_SEMS = ["PRIMER", "SEGUNDO", "ANUAL"];
    const semester = (typeof req.query.semester === "string" && VALID_SEMS.includes(req.query.semester.toUpperCase()))
      ? req.query.semester.toUpperCase() : "PRIMER";
    const horario = (typeof req.query.horario === "string" && req.query.horario)
      ? req.query.horario : "TEMUCO";

    if (!name?.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const trimmed = name.trim();

    // Check class exists (scoped to campus)
    const cls = await db.select().from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.classCode, classCode),
        eq(scheduleClassesTable.semester, semester),
        eq(scheduleClassesTable.horario, horario)
      ))
      .limit(1);

    if (!cls.length) {
      return res.status(404).json({ error: "Class not found" });
    }

    // Check capacity (scoped to campus)
    const existing = await db.select().from(scheduleStudentsTable)
      .where(and(
        eq(scheduleStudentsTable.classCode, classCode),
        eq(scheduleStudentsTable.classSemester, semester),
        eq(scheduleStudentsTable.classHorario, horario)
      ));

    if (existing.length >= 8) {
      return res.status(409).json({ error: "class_full", message: "La clase ya tiene 8 alumnos" });
    }

    await db.insert(scheduleStudentsTable).values({
      classCode,
      classSemester: semester,
      classHorario: horario,
      studentName: trimmed,
    }).onConflictDoNothing();

    broadcastScheduleChange(cls[0].horario);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/schedule/:classCode/students/:name?semester=PRIMER&horario=TEMUCO
router.delete("/schedule/:classCode/students/:name", async (req, res) => {
  try {
    const { classCode, name } = req.params;
    const studentName = decodeURIComponent(name);
    const VALID_SEMS = ["PRIMER", "SEGUNDO", "ANUAL"];
    const semester = (typeof req.query.semester === "string" && VALID_SEMS.includes(req.query.semester.toUpperCase()))
      ? req.query.semester.toUpperCase() : "PRIMER";
    const horario = (typeof req.query.horario === "string" && req.query.horario)
      ? req.query.horario : "TEMUCO";

    await db.delete(scheduleStudentsTable)
      .where(and(
        eq(scheduleStudentsTable.classCode, classCode),
        eq(scheduleStudentsTable.classSemester, semester),
        eq(scheduleStudentsTable.classHorario, horario),
        eq(scheduleStudentsTable.studentName, studentName)
      ));

    broadcastScheduleChange(horario);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schedule/classes — create a new class
router.post("/schedule/classes", async (req, res) => {
  try {
    const { day, time, sede, sala, course, teacher, horario, semester } = req.body;
    if (!day || !time || !sede || !sala || !course || !teacher) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }
    const horarioVal = (typeof horario === "string" && horario) ? horario.toUpperCase() : "TEMUCO";
    const VALID_SEMESTERS = ["PRIMER", "SEGUNDO", "ANUAL"];
    const semesterVal = (typeof semester === "string" && VALID_SEMESTERS.includes(semester.toUpperCase())) ? semester.toUpperCase() : "PRIMER";
    const dayShortMap: Record<string, string> = {
      LUNES: "LUN", MARTES: "MAR", MIERCOLES: "MIE", JUEVES: "JUE", VIERNES: "VIE",
    };
    const dayShort = dayShortMap[day.toUpperCase()] ?? day.slice(0, 3).toUpperCase();
    const timeShort = String(time).split(/[\s\-–]+/)[0].replace(":", ".");
    const classCode = `${course.toUpperCase()} ${dayShort} ${timeShort} ${teacher.toUpperCase()}`;

    const existing = await db.select().from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.classCode, classCode),
        eq(scheduleClassesTable.semester, semesterVal),
        eq(scheduleClassesTable.horario, horarioVal)
      ));
    if (existing.length) {
      return res.status(409).json({ error: "duplicate", message: `El código ${classCode} ya existe en ese semestre para este campus` });
    }

    await db.insert(scheduleClassesTable).values({
      classCode,
      horario: horarioVal,
      day: day.toUpperCase(),
      time,
      sede: sede.toUpperCase(),
      sala: Number(sala),
      teacher: teacher.toUpperCase(),
      course: course.toUpperCase(),
      semester: semesterVal,
    });

    broadcastScheduleChange(horarioVal);
    res.json({ ok: true, classCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/schedule/classes/:classCode?semester=PRIMER&horario=TEMUCO — update one or more fields
router.patch("/schedule/classes/:classCode", async (req, res) => {
  try {
    const oldCode = decodeURIComponent(req.params.classCode);
    const VALID_SEMS = ["PRIMER", "SEGUNDO", "ANUAL"];
    const oldSemester = (typeof req.query.semester === "string" && VALID_SEMS.includes(req.query.semester.toUpperCase()))
      ? req.query.semester.toUpperCase() : "PRIMER";
    const oldHorario = (typeof req.query.horario === "string" && req.query.horario)
      ? req.query.horario : "TEMUCO";
    const { sala, course, day, time, teacher, sede, semester } = req.body as {
      sala?: number; course?: string; day?: string; time?: string; teacher?: string; sede?: string; semester?: string;
    };

    // Fetch existing class identified by (classCode, semester, horario)
    const existing = await db.select().from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.classCode, oldCode),
        eq(scheduleClassesTable.semester, oldSemester),
        eq(scheduleClassesTable.horario, oldHorario)
      )).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Clase no encontrada" });
    const cls = existing[0];

    const newCourse    = course   ?? cls.course;
    const newDay       = day      ?? cls.day;
    const newTime      = time     ?? cls.time;
    const newTeacher   = teacher  ?? cls.teacher;
    const newSede      = sede     ?? cls.sede;
    const newSala      = sala !== undefined ? Number(sala) : cls.sala;
    const newSemester  = (typeof semester === "string" && VALID_SEMS.includes(semester.toUpperCase()))
      ? semester.toUpperCase()
      : oldSemester;

    if (!Number.isInteger(newSala) || newSala < 1) {
      return res.status(400).json({ error: "Sala inválida" });
    }

    // Rebuild classCode if identity fields changed
    const DAY_SHORT: Record<string, string> = {
      LUNES: "LUN", MARTES: "MAR", MIERCOLES: "MIE", JUEVES: "JUE", VIERNES: "VIE",
    };
    const dayShort  = DAY_SHORT[newDay] ?? newDay.slice(0, 3);
    const timeShort = newTime.split(/[\s\-–]+/)[0].replace(":", ".");
    const newCode   = `${newCourse} ${dayShort} ${timeShort} ${newTeacher}`.toUpperCase();

    // Check collision: same (newCode, newSemester, horario) must not already exist (unless it's the same row)
    if (newCode !== oldCode || newSemester !== oldSemester) {
      const conflict = await db.select({ classCode: scheduleClassesTable.classCode })
        .from(scheduleClassesTable)
        .where(and(
          eq(scheduleClassesTable.classCode, newCode),
          eq(scheduleClassesTable.semester, newSemester),
          eq(scheduleClassesTable.horario, oldHorario)
        ))
        .limit(1);
      if (conflict.length) {
        return res.status(409).json({ error: `Ya existe una clase con código "${newCode}" en ese semestre. Cambia algún campo para evitar la duplicación.` });
      }
    }

    // The FK on schedule_students has ON DELETE CASCADE but not ON UPDATE CASCADE.
    // Changing classCode would violate the FK constraint if students exist.
    // Solution: wrap in a transaction — save students, delete them, update the
    // class row (now unblocked), then re-insert students with the new code.
    // If any step fails the whole transaction rolls back and no data is lost.
    await db.transaction(async (tx) => {
      const existingStudents = await tx.select()
        .from(scheduleStudentsTable)
        .where(and(
          eq(scheduleStudentsTable.classCode, oldCode),
          eq(scheduleStudentsTable.classSemester, oldSemester),
          eq(scheduleStudentsTable.classHorario, oldHorario)
        ));

      if (existingStudents.length > 0) {
        await tx.delete(scheduleStudentsTable).where(and(
          eq(scheduleStudentsTable.classCode, oldCode),
          eq(scheduleStudentsTable.classSemester, oldSemester),
          eq(scheduleStudentsTable.classHorario, oldHorario)
        ));
      }

      await tx.update(scheduleClassesTable)
        .set({ classCode: newCode, course: newCourse, day: newDay, time: newTime,
               teacher: newTeacher, sede: newSede, sala: newSala, semester: newSemester })
        .where(and(
          eq(scheduleClassesTable.classCode, oldCode),
          eq(scheduleClassesTable.semester, oldSemester),
          eq(scheduleClassesTable.horario, oldHorario)
        ));

      if (existingStudents.length > 0) {
        await tx.insert(scheduleStudentsTable).values(
          existingStudents.map(s => ({
            classCode: newCode,
            classSemester: newSemester as "PRIMER" | "SEGUNDO" | "ANUAL",
            classHorario: oldHorario,
            studentName: s.studentName,
          }))
        );
      }
    });

    broadcastScheduleChange(cls.horario);
    res.json({ ok: true, classCode: newCode });
  } catch (err: any) {
    console.error(err);
    if (err?.code === "23505") {
      res.status(409).json({ error: "Ya existe una clase con ese código. Cambia algún campo para evitar la duplicación." });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

// DELETE /api/schedule/classes/:classCode?semester=PRIMER&horario=TEMUCO — delete a class and its students
router.delete("/schedule/classes/:classCode", async (req, res) => {
  try {
    const classCode = decodeURIComponent(req.params.classCode);
    const VALID_SEMS = ["PRIMER", "SEGUNDO", "ANUAL"];
    const semester = (typeof req.query.semester === "string" && VALID_SEMS.includes(req.query.semester.toUpperCase()))
      ? req.query.semester.toUpperCase() : "PRIMER";
    const horario = (typeof req.query.horario === "string" && req.query.horario)
      ? req.query.horario : "TEMUCO";
    // Students cascade-delete via FK
    await db.delete(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.classCode, classCode),
        eq(scheduleClassesTable.semester, semester),
        eq(scheduleClassesTable.horario, horario)
      ));
    broadcastScheduleChange(horario);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/schedule/classes?horario=TEMUCO — delete ALL classes for a horario (reset)
router.delete("/schedule/classes", async (req, res) => {
  try {
    const { horario } = req.query;
    const horarioFilter = (typeof horario === "string" && horario) ? horario : "TEMUCO";
    const classesInHorario = await db.select({ classCode: scheduleClassesTable.classCode })
      .from(scheduleClassesTable).where(eq(scheduleClassesTable.horario, horarioFilter));
    const count = classesInHorario.length;
    if (count > 0) {
      // Students cascade-delete via FK
      await db.delete(scheduleClassesTable).where(eq(scheduleClassesTable.horario, horarioFilter));
    }
    broadcastScheduleChange(horarioFilter, "schedule_wiped");
    res.json({ ok: true, deleted: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/schedule/wipe — wipes ALL classes + students across every horario and semester.
// Talleres (workshops) are in a separate table and are never affected.
router.delete("/schedule/wipe", async (_req, res) => {
  try {
    const rows = await db
      .select({ classCode: scheduleClassesTable.classCode })
      .from(scheduleClassesTable);

    // Explicit student delete first, then classes (covers FK cascade failures)
    await db.delete(scheduleStudentsTable);
    await db.delete(scheduleClassesTable);

    const horarios = await db.select({ id: scheduleHorariosTable.id }).from(scheduleHorariosTable);
    for (const h of horarios) broadcastScheduleChange(h.id, "schedule_wiped");

    res.json({ ok: true, deletedClasses: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al vaciar el horario" });
  }
});

// POST /api/schedule/copy-semester?horario=TEMUCO
// Idempotent: deletes all SEGUNDO classes for this horario, then recreates them
// from ALL PRIMER + ANUAL classes.
//   - INT and M2 courses → copied WITHOUT students (fresh enrollment for 2nd semester)
//   - All other courses  → copied WITH their students
router.post("/schedule/copy-semester", async (req, res) => {
  try {
    const { horario } = req.query;
    const horarioVal = (typeof horario === "string" && horario) ? horario.toUpperCase() : "TEMUCO";

    // Fetch ALL PRIMER + ANUAL classes for this horario
    const sourceClasses = await db.select().from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.horario, horarioVal),
        inArray(scheduleClassesTable.semester, ["PRIMER", "ANUAL"])
      ));

    if (!sourceClasses.length) {
      return res.json({ ok: true, created: 0, message: "No hay clases de 1er semestre para copiar" });
    }

    // Get students for PRIMER classes (ANUAL students have classSemester='ANUAL')
    const sourceCodes = sourceClasses.map(c => c.classCode);
    const allSourceStudents = await db.select().from(scheduleStudentsTable)
      .where(and(
        inArray(scheduleStudentsTable.classCode, sourceCodes),
        inArray(scheduleStudentsTable.classSemester, ["PRIMER", "ANUAL"])
      ));

    const studentsByCode: Record<string, string[]> = {};
    for (const s of allSourceStudents) {
      if (!studentsByCode[s.classCode]) studentsByCode[s.classCode] = [];
      studentsByCode[s.classCode].push(s.studentName);
    }

    // Wipe all existing SEGUNDO classes for this horario (students cascade-delete)
    await db.delete(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.horario, horarioVal),
        eq(scheduleClassesTable.semester, "SEGUNDO")
      ));

    // Create fresh SEGUNDO classes.
    // INT and M2 courses → no students (enrollment opens fresh in 2nd semester).
    // All other courses  → carry their students over.
    let created = 0;
    for (const cls of sourceClasses) {
      const noStudents =
        /\bINT\b/i.test(cls.course) ||
        /\bM2\b/i.test(cls.course);

      await db.insert(scheduleClassesTable).values({
        classCode: cls.classCode,
        horario: cls.horario,
        day: cls.day,
        time: cls.time,
        sede: cls.sede,
        sala: cls.sala,
        teacher: cls.teacher,
        course: cls.course,
        semester: "SEGUNDO",
      });

      if (!noStudents) {
        const students = studentsByCode[cls.classCode] ?? [];
        if (students.length > 0) {
          await db.insert(scheduleStudentsTable)
            .values(students.map(name => ({
              classCode: cls.classCode,
              classSemester: "SEGUNDO" as const,
              classHorario: horarioVal,
              studentName: name,
            })));
        }
      }

      created++;
    }

    broadcastScheduleChange(horarioVal);
    res.json({ ok: true, created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const ALL_HORARIO_IDS = ["TEMUCO", "ALMAGRO", "VILLARRICA", "AV_ALEMANIA"] as const;

// POST /api/schedule/import — import students from Excel (.xlsx)
// Replaces PRIMER and SEGUNDO data from the Excel.
// ANUAL classes/students are preserved (managed manually).
// If the Excel has a "Semestre" column (col 1), students are routed to the
// correct semester automatically. Files without that column default to PRIMER.
router.post("/schedule/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    // ── Wipe PRIMER only — SEGUNDO classes/students are preserved ─────────────
    // SEGUNDO class structure was built via "Copiar 1er → 2do". We never wipe it
    // on import; instead we update only the specific SEGUNDO student lists that
    // appear in the Excel (see updateSegundoStudentsFromParsed below).
    await db.delete(scheduleStudentsTable)
      .where(eq(scheduleStudentsTable.classSemester, "PRIMER"));
    await db.delete(scheduleClassesTable)
      .where(eq(scheduleClassesTable.semester, "PRIMER"));

    // ── Import per campus ─────────────────────────────────────────────────────
    let totalCreated = 0, totalSkipped = 0, totalStudents = 0;
    const allParseErrors: string[] = [];
    const perCampus: Record<string, { students: number; createdPrimer: number; createdSegundo: number }> = {};

    for (const horarioId of ALL_HORARIO_IDS) {
      const { byCodePrimer, byCodeSegundo, totalStudents: ts } = importExcelBuffer(req.file.buffer, horarioId);

      // PRIMER: full wipe already done above, insert fresh
      const rPrimer  = await upsertFromParsed(byCodePrimer, horarioId, "PRIMER");
      // SEGUNDO: only update students for classes that appear in the Excel
      const rSegundo = await updateSegundoStudentsFromParsed(byCodeSegundo, horarioId);

      totalCreated  += rPrimer.created  + rSegundo.created;
      totalSkipped  += rPrimer.skipped  + rSegundo.skipped;
      totalStudents += ts;
      allParseErrors.push(...rPrimer.parseErrors, ...rSegundo.parseErrors);
      perCampus[horarioId] = {
        students: ts,
        createdPrimer:  rPrimer.created,
        createdSegundo: rSegundo.updated + rSegundo.created,
      };
      broadcastScheduleChange(horarioId);
    }

    res.json({
      ok: true,
      created: totalCreated,
      updated: 0,
      skipped: totalSkipped,
      totalStudents,
      perCampus,
      parseErrors: allParseErrors.slice(0, 20),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al procesar el archivo" });
  }
});

// POST /api/schedule/copy-primer — copies SEGUNDO students → PRIMER
// Use this when students were accidentally imported into SEGUNDO but should be in PRIMER.
router.post("/schedule/copy-primer", async (req, res) => {
  try {
    const { horario } = req.query;
    const horarioVal = (typeof horario === "string" && horario) ? horario.toUpperCase() : "TEMUCO";

    // Fetch SEGUNDO classes for this horario as source
    const sourceClasses = await db.select().from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.horario, horarioVal),
        eq(scheduleClassesTable.semester, "SEGUNDO"),
      ));

    if (!sourceClasses.length) {
      return res.json({ ok: true, created: 0, message: "No hay clases de 2do semestre para copiar" });
    }

    // Get SEGUNDO students (scoped to this campus)
    const sourceCodes = sourceClasses.map(c => c.classCode);
    const segundoStudents = await db.select().from(scheduleStudentsTable)
      .where(and(
        inArray(scheduleStudentsTable.classCode, sourceCodes),
        eq(scheduleStudentsTable.classSemester, "SEGUNDO"),
        eq(scheduleStudentsTable.classHorario, horarioVal),
      ));

    const studentsByCode: Record<string, string[]> = {};
    for (const s of segundoStudents) {
      if (!studentsByCode[s.classCode]) studentsByCode[s.classCode] = [];
      studentsByCode[s.classCode].push(s.studentName);
    }

    // Ensure PRIMER classes exist for each SEGUNDO class (create if missing)
    const existingPrimer = await db.select({ classCode: scheduleClassesTable.classCode })
      .from(scheduleClassesTable)
      .where(and(
        eq(scheduleClassesTable.horario, horarioVal),
        eq(scheduleClassesTable.semester, "PRIMER"),
      ));
    const existingPrimerCodes = new Set(existingPrimer.map(c => c.classCode));

    for (const cls of sourceClasses) {
      if (!existingPrimerCodes.has(cls.classCode)) {
        try {
          await db.insert(scheduleClassesTable).values({
            classCode: cls.classCode,
            horario: cls.horario,
            day: cls.day,
            time: cls.time,
            sede: cls.sede,
            sala: cls.sala,
            teacher: cls.teacher,
            course: cls.course,
            semester: "PRIMER",
          });
        } catch { /* class already exists, skip */ }
      }
    }

    // Delete existing PRIMER students for these class codes (scoped to this campus), then replace
    await db.delete(scheduleStudentsTable)
      .where(and(
        inArray(scheduleStudentsTable.classCode, sourceCodes),
        eq(scheduleStudentsTable.classSemester, "PRIMER"),
        eq(scheduleStudentsTable.classHorario, horarioVal),
      ));

    // Insert SEGUNDO students as PRIMER students
    let copied = 0;
    for (const [classCode, students] of Object.entries(studentsByCode)) {
      if (students.length > 0) {
        await db.insert(scheduleStudentsTable)
          .values(students.map(name => ({ classCode, classSemester: "PRIMER" as const, classHorario: horarioVal, studentName: name })));
        copied += students.length;
      }
    }

    broadcastScheduleChange(horarioVal);
    res.json({ ok: true, copied });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Horarios / Sedes dinámicas ───────────────────────────────────────────────

interface SedeConfig {
  name: string;         // Internal name used in DB — e.g. "LAS ENCINAS"
  displayName: string;  // Display name — e.g. "Las Encinas"
  maxSalas: number;
}

const BUILT_IN_HORARIOS = [
  {
    id: "TEMUCO",
    name: "Temuco",
    subtitle: "Las Encinas · Inés de Suárez",
    emoji: "🏙️",
    gradient: "from-violet-500 to-purple-600",
    accentColor: "violet",
    sortOrder: 0,
    sedes: [
      { name: "LAS ENCINAS",    displayName: "Las Encinas",    maxSalas: 7 },
      { name: "INES DE SUAREZ", displayName: "Inés de Suárez", maxSalas: 5 },
    ] as SedeConfig[],
  },
  {
    id: "ALMAGRO",
    name: "D. Almagro",
    subtitle: "Diego de Almagro",
    emoji: "📍",
    gradient: "from-blue-500 to-indigo-600",
    accentColor: "blue",
    sortOrder: 1,
    sedes: [{ name: "D. ALMAGRO", displayName: "D. Almagro", maxSalas: 6 }] as SedeConfig[],
  },
  {
    id: "VILLARRICA",
    name: "Villarrica",
    subtitle: "Sede Villarrica",
    emoji: "🌿",
    gradient: "from-teal-500 to-emerald-600",
    accentColor: "teal",
    sortOrder: 2,
    sedes: [{ name: "VILLARRICA", displayName: "Villarrica", maxSalas: 4 }] as SedeConfig[],
  },
  {
    id: "AV_ALEMANIA",
    name: "Av. Alemania",
    subtitle: "Sede Av. Alemania",
    emoji: "🌆",
    gradient: "from-orange-500 to-rose-500",
    accentColor: "orange",
    sortOrder: 3,
    sedes: [{ name: "AV. ALEMANIA", displayName: "Av. Alemania", maxSalas: 4 }] as SedeConfig[],
  },
];

async function seedHorariosIfEmpty() {
  try {
    const existing = await db.select({ id: scheduleHorariosTable.id }).from(scheduleHorariosTable);
    if (existing.length > 0) return;
    for (const h of BUILT_IN_HORARIOS) {
      await db.insert(scheduleHorariosTable).values({
        id: h.id,
        name: h.name,
        subtitle: h.subtitle,
        emoji: h.emoji,
        gradient: h.gradient,
        accentColor: h.accentColor,
        sedesJson: JSON.stringify(h.sedes),
        isSystem: 1,
        sortOrder: h.sortOrder,
      });
    }
  } catch (err) {
    console.error("seedHorariosIfEmpty error:", err);
  }
}

seedHorariosIfEmpty();

function parseSedesJson(json: string): SedeConfig[] {
  try { return JSON.parse(json) as SedeConfig[]; } catch { return []; }
}

// GET /api/horarios — list all horarios with their sedes
router.get("/horarios", async (_req, res) => {
  try {
    const rows = await db.select().from(scheduleHorariosTable).orderBy(scheduleHorariosTable.sortOrder);
    const result = rows.map(r => ({
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      emoji: r.emoji,
      gradient: r.gradient,
      accentColor: r.accentColor,
      isSystem: r.isSystem === 1,
      sortOrder: r.sortOrder,
      sedes: parseSedesJson(r.sedesJson),
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener horarios" });
  }
});

const GRADIENT_OPTIONS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-teal-500 to-emerald-600",
  "from-orange-500 to-rose-500",
  "from-cyan-500 to-sky-600",
  "from-pink-500 to-fuchsia-600",
  "from-lime-500 to-green-600",
  "from-amber-500 to-yellow-600",
];

const ACCENT_FOR_GRADIENT: Record<string, string> = {
  "from-violet-500 to-purple-600": "violet",
  "from-blue-500 to-indigo-600":   "blue",
  "from-teal-500 to-emerald-600":  "teal",
  "from-orange-500 to-rose-500":   "orange",
  "from-cyan-500 to-sky-600":      "cyan",
  "from-pink-500 to-fuchsia-600":  "pink",
  "from-lime-500 to-green-600":    "lime",
  "from-amber-500 to-yellow-600":  "amber",
};

// POST /api/horarios — create a new horario
router.post("/horarios", async (req, res) => {
  try {
    const { name, subtitle = "", emoji = "🏢", gradient } = req.body as {
      name?: string; subtitle?: string; emoji?: string; gradient?: string;
    };
    if (!name?.trim()) return res.status(400).json({ error: "Se requiere un nombre" });

    const allRows = await db.select({ sortOrder: scheduleHorariosTable.sortOrder }).from(scheduleHorariosTable);
    const maxSort = allRows.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);

    const id = name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "").slice(0, 32)
      + "_" + Date.now().toString(36).toUpperCase();
    const chosenGradient = gradient && GRADIENT_OPTIONS.includes(gradient) ? gradient : GRADIENT_OPTIONS[Math.floor(Math.random() * GRADIENT_OPTIONS.length)];
    const accentColor = ACCENT_FOR_GRADIENT[chosenGradient] ?? "violet";
    const defaultSede: SedeConfig = {
      name: name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, ""),
      displayName: name.trim(),
      maxSalas: 6,
    };

    await db.insert(scheduleHorariosTable).values({
      id,
      name: name.trim(),
      subtitle: subtitle.trim(),
      emoji: emoji.trim() || "🏢",
      gradient: chosenGradient,
      accentColor,
      sedesJson: JSON.stringify([defaultSede]),
      isSystem: 0,
      sortOrder: maxSort + 1,
    });

    res.json({ ok: true, id, name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear horario" });
  }
});

// PUT /api/horarios/:id/sedes — add or update a sede in a horario
router.put("/horarios/:id/sedes", async (req, res) => {
  try {
    const { id } = req.params;
    const { sedeName, displayName, maxSalas = 6 } = req.body as {
      sedeName?: string; displayName?: string; maxSalas?: number;
    };
    if (!sedeName?.trim()) return res.status(400).json({ error: "Se requiere sedeName" });

    const [row] = await db.select().from(scheduleHorariosTable).where(eq(scheduleHorariosTable.id, id));
    if (!row) return res.status(404).json({ error: "Horario no encontrado" });

    const sedes = parseSedesJson(row.sedesJson);
    const existing = sedes.findIndex(s => s.name === sedeName.trim().toUpperCase());
    const updated: SedeConfig = {
      name: sedeName.trim().toUpperCase(),
      displayName: (displayName ?? sedeName).trim(),
      maxSalas: Number(maxSalas) || 6,
    };
    if (existing >= 0) sedes[existing] = updated;
    else sedes.push(updated);

    await db.update(scheduleHorariosTable).set({ sedesJson: JSON.stringify(sedes) }).where(eq(scheduleHorariosTable.id, id));
    res.json({ ok: true, sedes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar sede" });
  }
});

// DELETE /api/horarios/:id/sedes/:sedeName — remove a sede from a horario
router.delete("/horarios/:id/sedes/:sedeName", async (req, res) => {
  try {
    const { id, sedeName } = req.params;
    const [row] = await db.select().from(scheduleHorariosTable).where(eq(scheduleHorariosTable.id, id));
    if (!row) return res.status(404).json({ error: "Horario no encontrado" });

    const sedes = parseSedesJson(row.sedesJson).filter(s => s.name !== decodeURIComponent(sedeName));
    await db.update(scheduleHorariosTable).set({ sedesJson: JSON.stringify(sedes) }).where(eq(scheduleHorariosTable.id, id));
    res.json({ ok: true, sedes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar sede" });
  }
});

// DELETE /api/horarios/:id — delete a custom horario (non-system only)
router.delete("/horarios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db.select().from(scheduleHorariosTable).where(eq(scheduleHorariosTable.id, id));
    if (!row) return res.status(404).json({ error: "Horario no encontrado" });
    if (row.isSystem === 1) return res.status(403).json({ error: "No se pueden eliminar campus del sistema" });

    // Students cascade-delete via FK when classes are deleted
    await db.delete(scheduleClassesTable).where(eq(scheduleClassesTable.horario, id));
    await db.delete(scheduleHorariosTable).where(eq(scheduleHorariosTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar horario" });
  }
});

// ─── Cambios / Transferencias de alumnos ─────────────────────────────────────
const transferClients = new Map<string, Set<Response>>();

router.get("/transfers/stream", (req, res) => {
  const { horarioId } = req.query as { horarioId?: string };
  if (!horarioId) { res.status(400).json({ error: "horarioId requerido" }); return; }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");

  if (!transferClients.has(horarioId)) transferClients.set(horarioId, new Set());
  transferClients.get(horarioId)!.add(res);

  const keepalive = setInterval(() => res.write(": ping\n\n"), 20_000);
  req.on("close", () => {
    clearInterval(keepalive);
    transferClients.get(horarioId)?.delete(res);
    if (transferClients.get(horarioId)?.size === 0) transferClients.delete(horarioId);
  });
});

router.get("/transfers", async (req, res) => {
  const { horarioId } = req.query as { horarioId?: string };
  if (!horarioId) return res.status(400).json({ error: "horarioId requerido" });
  try {
    const rows = await db
      .select()
      .from(scheduleTransfersTable)
      .where(eq(scheduleTransfersTable.horarioId, horarioId))
      .orderBy(scheduleTransfersTable.createdAt);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener cambios" });
  }
});

router.post("/transfers", async (req, res) => {
  const { horarioId, studentName = "", teacherBefore = "", teacherAfter = "", sede = "", subject = "", leavesClass = "", entersClass = "", transferDate = "", changeType = "CAMBIO HORARIO", changeReason = "NINGUNO" } = req.body as Record<string, string>;
  if (!horarioId) return res.status(400).json({ error: "horarioId requerido" });
  try {
    const [row] = await db.insert(scheduleTransfersTable).values({
      horarioId, studentName, teacherBefore, teacherAfter, sede, subject,
      leavesClass, entersClass, transferDate, changeType, changeReason,
    }).returning();

    // Broadcast to all connected CambiosPage clients for this horario
    const payload = `data: ${JSON.stringify({ type: "transfer_created", transfer: row })}\n\n`;
    transferClients.get(horarioId)?.forEach(client => client.write(payload));

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear cambio" });
  }
});

router.patch("/transfers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const allowed = ["studentName","teacherBefore","teacherAfter","sede","subject","leavesClass","entersClass","transferDate","changeType","changeReason"] as const;
  type AllowedKey = typeof allowed[number];
  const updates: Partial<Record<AllowedKey, string>> = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Sin campos para actualizar" });
  try {
    const [row] = await db.update(scheduleTransfersTable).set(updates).where(eq(scheduleTransfersTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "No encontrado" });

    // Broadcast update to all connected CambiosPage clients
    const payload = `data: ${JSON.stringify({ type: "transfer_updated", transfer: row })}\n\n`;
    transferClients.get(row.horarioId)?.forEach(client => client.write(payload));

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar cambio" });
  }
});

router.delete("/transfers/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    await db.delete(scheduleTransfersTable).where(eq(scheduleTransfersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar cambio" });
  }
});

export default router;
