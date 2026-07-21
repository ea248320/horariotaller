// ─────────────────────────────────────────────────────────────────────────────
// Backend local: reemplaza al servidor Express + PostgreSQL del proyecto
// original. Todos los datos viven en localStorage del navegador y las
// peticiones fetch("/api/...") y EventSource("/api/.../stream") se atienden
// aquí mismo, sin salir a internet. Importar este módulo (una vez, al inicio
// de main.tsx) instala los interceptores.
// ─────────────────────────────────────────────────────────────────────────────
const PREFIX = "htdb:";
const SEED_MARKER = `${PREFIX}seeded:v2`;
const OLD_SEED_MARKER = `${PREFIX}seeded:v1`;

// ─── Capa de almacenamiento ──────────────────────────────────────────────────

type Row = Record<string, any>;

function load(table: string): Row[] {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + table) ?? "[]");
  } catch {
    return [];
  }
}

function save(table: string, rows: Row[]) {
  try {
    localStorage.setItem(PREFIX + table, JSON.stringify(rows));
  } catch (err) {
    // Cuota de localStorage llena u otro fallo de escritura
    console.error(`[local-api] No se pudo guardar "${table}":`, err);
    throw new Error("El almacenamiento del navegador está lleno. Exporta un respaldo y libera espacio.");
  }
}

function nextId(table: string): number {
  const key = `${PREFIX}seq`;
  const seq: Record<string, number> = JSON.parse(localStorage.getItem(key) ?? "{}");
  const id = (seq[table] ?? 0) + 1;
  seq[table] = id;
  localStorage.setItem(key, JSON.stringify(seq));
  return id;
}

const nowIso = () => new Date().toISOString();

// ─── Semilla inicial ─────────────────────────────────────────────────────────

// La versión v1 sembraba los 4 campus de Temuco con su horario de ejemplo.
// Esta migración elimina solo esos datos precargados (marcados isSystem),
// conservando campus, clases y demás datos creados por el cliente.
function migrateFromV1() {
  if (!localStorage.getItem(OLD_SEED_MARKER)) return;
  const horarios = load("horarios");
  const seededIds = new Set(horarios.filter(h => h.isSystem).map(h => h.id));
  if (seededIds.size > 0) {
    save("horarios", horarios.filter(h => !seededIds.has(h.id)));
    save("classes", load("classes").filter(c => !seededIds.has(c.horario)));
    save("students", load("students").filter(s => !seededIds.has(s.classHorario)));
  }
  localStorage.removeItem(OLD_SEED_MARKER);
  localStorage.setItem(SEED_MARKER, "1");
}

function seedIfNeeded() {
  migrateFromV1();
  if (localStorage.getItem(SEED_MARKER)) return;

  // La plataforma parte vacía: cada cliente crea sus campus, sedes y clases
  // desde Admin. Solo se siembran los estados de citas de orientación
  // (editables en la app).
  const estados = [
    { tipo: "confirma", label: "pendiente", color: "#94a3b8", orden: 1 },
    { tipo: "confirma", label: "confirmada", color: "#22c55e", orden: 2 },
    { tipo: "confirma", label: "no contesta", color: "#f59e0b", orden: 3 },
    { tipo: "confirma", label: "cancelada", color: "#ef4444", orden: 4 },
    { tipo: "asiste", label: "pendiente", color: "#94a3b8", orden: 1 },
    { tipo: "asiste", label: "asiste", color: "#22c55e", orden: 2 },
    { tipo: "asiste", label: "no asiste", color: "#ef4444", orden: 3 },
  ].map(e => ({ id: nextId("estados"), ...e }));
  save("estados", estados);

  localStorage.setItem(SEED_MARKER, "1");
}

// ─── Eventos en tiempo real (mismo tab + otros tabs) ─────────────────────────

const localBus = new EventTarget();
const bc = "BroadcastChannel" in window ? new BroadcastChannel("htdb-events") : null;

function emit(channel: string, data: Row) {
  const detail = { channel, data };
  localBus.dispatchEvent(new CustomEvent("api-event", { detail }));
  bc?.postMessage(detail);
}

function channelForStreamUrl(u: URL): string | null {
  const horarioId = u.searchParams.get("horarioId") ?? "";
  if (u.pathname.endsWith("/api/schedule/stream")) return `schedule:${horarioId}`;
  if (u.pathname.endsWith("/api/transfers/stream")) return `transfers:${horarioId}`;
  if (u.pathname.endsWith("/api/notifications/stream")) return `notif:${horarioId}`;
  return null;
}

class LocalEventSource extends EventTarget {
  url: string;
  readyState = 1;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;
  private channel: string | null;
  private busHandler: (e: Event) => void;
  private bcHandler: (e: MessageEvent) => void;

  constructor(u: URL) {
    super();
    this.url = u.href;
    this.channel = channelForStreamUrl(u);
    const deliver = (detail: { channel: string; data: Row }) => {
      if (this.readyState !== 1 || detail.channel !== this.channel) return;
      const ev = new MessageEvent("message", { data: JSON.stringify(detail.data) });
      this.onmessage?.(ev);
      this.dispatchEvent(ev);
    };
    this.busHandler = (e: Event) => deliver((e as CustomEvent).detail);
    this.bcHandler = (e: MessageEvent) => deliver(e.data);
    localBus.addEventListener("api-event", this.busHandler);
    bc?.addEventListener("message", this.bcHandler);
    setTimeout(() => this.onopen?.(new Event("open")), 0);
  }

  close() {
    this.readyState = 2;
    localBus.removeEventListener("api-event", this.busHandler);
    bc?.removeEventListener("message", this.bcHandler);
  }
}

// ─── Utilidades compartidas con el servidor original ─────────────────────────

const MAX_STUDENTS = 8;

const DAY_TOKEN_MAP: Record<string, string> = {
  LUN: "LUNES", MAR: "MARTES", MIE: "MIERCOLES", JUE: "JUEVES", VIE: "VIERNES",
  SAB: "SABADO", DOM: "DOMINGO",
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
const DAY_SHORT: Record<string, string> = {
  LUNES: "LUN", MARTES: "MAR", MIERCOLES: "MIE", JUEVES: "JUE", VIERNES: "VIE",
  SABADO: "SAB", DOMINGO: "DOM",
};

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

function buildClassCode(course: string, day: string, time: string, teacher: string): string {
  const dayShort = DAY_SHORT[day.toUpperCase()] ?? day.slice(0, 3).toUpperCase();
  const timeShort = String(time).split(/[\s\-–]+/)[0].replace(":", ".");
  return `${course} ${dayShort} ${timeShort} ${teacher}`.toUpperCase();
}

const HORARIO_SEDES: Record<string, string[]> = {
  TEMUCO: ["LAS ENCINAS", "INES DE SUAREZ"],
  ALMAGRO: ["D. ALMAGRO"],
  VILLARRICA: ["VILLARRICA"],
  AV_ALEMANIA: ["AV. ALEMANIA"],
};
const HORARIO_NIVEL: Record<string, string> = {
  TEMUCO: "SEDE TEMUCO",
  ALMAGRO: "SEDE OSORNO",
  VILLARRICA: "SEDE VILLARRICA",
  AV_ALEMANIA: "SEDE AV. ALEMANIA",
};

function normalizeSede(raw: string, fallback: string): string {
  const s = raw.trim().toUpperCase().replace(/^SEDE\s+/, "");
  if (/^AV\.?\s*ALEMANIA/.test(s)) return "AV. ALEMANIA";
  if (/^D\.?\s*ALMAGRO/.test(s)) return "D. ALMAGRO";
  if (/INES\s+DE\s+SUAREZ/.test(s)) return "INES DE SUAREZ";
  if (/LAS\s+ENCINAS/.test(s)) return "LAS ENCINAS";
  if (/VILLARRICA/.test(s)) return "VILLARRICA";
  return fallback;
}

const VALID_SEMS = ["PRIMER", "SEGUNDO", "ANUAL"];
function semFromQuery(q: URLSearchParams): string {
  const s = (q.get("semester") ?? "").toUpperCase();
  return VALID_SEMS.includes(s) ? s : "PRIMER";
}
function horarioFromQuery(q: URLSearchParams): string {
  return q.get("horario") || "TEMUCO";
}

function broadcastScheduleChange(horarioId: string, type: "schedule_changed" | "schedule_wiped" = "schedule_changed") {
  emit(`schedule:${horarioId}`, { type });
}

// ─── Presencia y "escribiendo" (solo en memoria) ─────────────────────────────

const presenceSessions = new Map<string, { name: string; seenAt: number }>();
const PRESENCE_TTL = 30_000;
function getActiveSessions() {
  const now = Date.now();
  for (const [id, s] of presenceSessions) if (now - s.seenAt > PRESENCE_TTL) presenceSessions.delete(id);
  return [...presenceSessions.values()];
}

const typingSessions = new Map<string, { classCode: string; name: string; seenAt: number }>();
const TYPING_TTL = 5_000;
function getActiveTyping() {
  const now = Date.now();
  for (const [id, t] of typingSessions) if (now - t.seenAt > TYPING_TTL) typingSessions.delete(id);
  return [...typingSessions.values()];
}

// ─── Router ──────────────────────────────────────────────────────────────────

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  formData: FormData | null;
}
type Handler = (ctx: Ctx) => Response | Promise<Response>;

const routes: { method: string; regex: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, pattern: string, handler: Handler) {
  const keys: string[] = [];
  const regexSrc = pattern
    .split("/")
    .map(seg => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  routes.push({ method, regex: new RegExp(`^${regexSrc}$`), keys, handler });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
const notFound = (msg = "No encontrado") => json({ error: msg }, 404);

// ─── Rutas: salud y presencia ────────────────────────────────────────────────

route("GET", "/api/ping", () => json({ ok: true }));
route("GET", "/api/healthz", () => json({ status: "ok" }));

// ─── Rutas: configuración de la plataforma ───────────────────────────────────

const ALL_DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];

const DEFAULT_SETTINGS = {
  platformName: "Mi Plataforma de Horarios",
  subtitle: "Gestión de horarios, clases y equipo",
  days: ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
  timeSlots: [
    "09.15 - 10.15",
    "10:30 - 11:30",
    "11.45 - 12.45",
    "15.30 - 16.30",
    "16.45 - 17.45",
    "18.00 - 19.00",
    "19.15 - 20.15",
  ],
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(`${PREFIX}settings`) ?? "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

route("GET", "/api/settings", () => json(loadSettings()));

route("PATCH", "/api/settings", ({ body }) => {
  const current = loadSettings();
  if (body?.platformName !== undefined) current.platformName = String(body.platformName).trim() || DEFAULT_SETTINGS.platformName;
  if (body?.subtitle !== undefined) current.subtitle = String(body.subtitle).trim();
  if (body?.days !== undefined) {
    const days = Array.isArray(body.days) ? ALL_DAYS.filter(d => body.days.includes(d)) : [];
    if (days.length === 0) return json({ error: "Debe haber al menos un día activo" }, 400);
    current.days = days;
  }
  if (body?.timeSlots !== undefined) {
    const slots = Array.isArray(body.timeSlots)
      ? body.timeSlots.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [];
    if (slots.length === 0) return json({ error: "Debe haber al menos una franja horaria" }, 400);
    if (new Set(slots).size !== slots.length) return json({ error: "Hay franjas horarias repetidas" }, 400);
    current.timeSlots = slots;
  }
  localStorage.setItem(`${PREFIX}settings`, JSON.stringify(current));
  emit("settings", { type: "settings_changed", settings: current });
  return json(current);
});

// ─── Rutas: respaldo, restauración y reinicio ────────────────────────────────

function allDataKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  return keys;
}

route("GET", "/api/backup", () => {
  const data: Record<string, unknown> = {};
  for (const k of allDataKeys()) {
    try { data[k] = JSON.parse(localStorage.getItem(k) ?? "null"); }
    catch { data[k] = localStorage.getItem(k); }
  }
  return json({
    formato: "horariotaller-backup",
    version: 1,
    exportadoEn: nowIso(),
    data,
  });
});

route("POST", "/api/backup/restore", ({ body }) => {
  if (body?.formato !== "horariotaller-backup" || typeof body?.data !== "object" || body.data === null) {
    return json({ error: "El archivo no es un respaldo válido de esta plataforma" }, 400);
  }
  for (const k of allDataKeys()) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(body.data as Record<string, unknown>)) {
    if (!k.startsWith(PREFIX)) continue;
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  localStorage.setItem(SEED_MARKER, "1");
  return json({ ok: true });
});

route("DELETE", "/api/reset", () => {
  for (const k of allDataKeys()) localStorage.removeItem(k);
  return json({ ok: true });
});

route("GET", "/api/schedule/presence", () => json(getActiveSessions()));
route("POST", "/api/schedule/presence", ({ body }) => {
  if (!body?.sessionId) return json({ error: "sessionId required" }, 400);
  presenceSessions.set(body.sessionId, { name: body.name ?? "Secretaria", seenAt: Date.now() });
  return json({ active: getActiveSessions().length });
});
route("DELETE", "/api/schedule/presence/:sessionId", ({ params }) => {
  presenceSessions.delete(params.sessionId);
  return json({ ok: true });
});

route("GET", "/api/schedule/typing", () => json(getActiveTyping()));
route("POST", "/api/schedule/typing", ({ body }) => {
  if (!body?.sessionId || !body?.classCode) return json({ error: "required" }, 400);
  typingSessions.set(body.sessionId, { classCode: body.classCode, name: body.name ?? "Secretaria", seenAt: Date.now() });
  return json({ ok: true });
});
route("DELETE", "/api/schedule/typing/:sessionId", ({ params }) => {
  typingSessions.delete(params.sessionId);
  return json({ ok: true });
});

// ─── Rutas: notificaciones ───────────────────────────────────────────────────

route("POST", "/api/notifications/publish", ({ body }) => {
  const { horarioId, sede, classCode, course, day, time, cupos } = body ?? {};
  if (!horarioId || !sede || !classCode) return json({ error: "Faltan campos requeridos" }, 400);
  emit(`notif:${horarioId}`, {
    type: "cupo_disponible",
    horarioId, sede, classCode,
    course: course ?? classCode,
    day: day ?? "",
    time: time ?? "",
    cupos: cupos ?? 1,
    timestamp: nowIso(),
  });
  return json({ ok: true });
});

// ─── Rutas: horario de clases ────────────────────────────────────────────────

function classesWithStudents(horarioParam: string, sede: string | null) {
  const all = load("classes");
  const classes = horarioParam === "ALL" ? all : all.filter(c => c.horario === horarioParam);
  const students = load("students");
  const byKey: Record<string, string[]> = {};
  for (const s of students) {
    const key = `${s.classCode}|${s.classSemester}|${s.classHorario}`;
    (byKey[key] ??= []).push(s.studentName);
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
    students: byKey[`${c.classCode}|${c.semester ?? "PRIMER"}|${c.horario}`] ?? [],
  }));
  if (sede) result = result.filter(c => c.sede === sede);
  return result;
}

route("GET", "/api/schedule", ({ query }) =>
  json(classesWithStudents(query.get("horario") || "TEMUCO", query.get("sede"))));

route("POST", "/api/schedule/classes", ({ body }) => {
  const { day, time, sede, sala, course, teacher, horario, semester } = body ?? {};
  if (!day || !time || !sede || !sala || !course || !teacher) {
    return json({ error: "Todos los campos son obligatorios" }, 400);
  }
  const horarioVal = (typeof horario === "string" && horario) ? horario.toUpperCase() : "TEMUCO";
  const semesterVal = (typeof semester === "string" && VALID_SEMS.includes(semester.toUpperCase()))
    ? semester.toUpperCase() : "PRIMER";
  const classCode = buildClassCode(course, day, time, teacher);

  const classes = load("classes");
  if (classes.some(c => c.classCode === classCode && c.semester === semesterVal && c.horario === horarioVal)) {
    return json({ error: "duplicate", message: `El código ${classCode} ya existe en ese semestre para este campus` }, 409);
  }
  classes.push({
    classCode, horario: horarioVal,
    day: day.toUpperCase(), time,
    sede: sede.toUpperCase(), sala: Number(sala),
    teacher: teacher.toUpperCase(), course: course.toUpperCase(),
    semester: semesterVal, createdAt: nowIso(),
  });
  save("classes", classes);
  broadcastScheduleChange(horarioVal);
  return json({ ok: true, classCode });
});

route("DELETE", "/api/schedule/classes", ({ query }) => {
  const horarioFilter = horarioFromQuery(query);
  const classes = load("classes");
  const remaining = classes.filter(c => c.horario !== horarioFilter);
  const deleted = classes.length - remaining.length;
  save("classes", remaining);
  save("students", load("students").filter(s => s.classHorario !== horarioFilter));
  broadcastScheduleChange(horarioFilter, "schedule_wiped");
  return json({ ok: true, deleted });
});

route("PATCH", "/api/schedule/classes/:classCode", ({ params, query, body }) => {
  const oldCode = decodeURIComponent(params.classCode);
  const oldSemester = semFromQuery(query);
  const oldHorario = horarioFromQuery(query);
  const classes = load("classes");
  const cls = classes.find(c => c.classCode === oldCode && c.semester === oldSemester && c.horario === oldHorario);
  if (!cls) return json({ error: "Clase no encontrada" }, 404);

  const { sala, course, day, time, teacher, sede, semester } = body ?? {};
  const newCourse = course ?? cls.course;
  const newDay = day ?? cls.day;
  const newTime = time ?? cls.time;
  const newTeacher = teacher ?? cls.teacher;
  const newSede = sede ?? cls.sede;
  const newSala = sala !== undefined ? Number(sala) : cls.sala;
  const newSemester = (typeof semester === "string" && VALID_SEMS.includes(semester.toUpperCase()))
    ? semester.toUpperCase() : oldSemester;

  if (!Number.isInteger(newSala) || newSala < 1) return json({ error: "Sala inválida" }, 400);

  const newCode = buildClassCode(newCourse, newDay, newTime, newTeacher);
  if (newCode !== oldCode || newSemester !== oldSemester) {
    const conflict = classes.some(c => c.classCode === newCode && c.semester === newSemester && c.horario === oldHorario);
    if (conflict) {
      return json({ error: `Ya existe una clase con código "${newCode}" en ese semestre. Cambia algún campo para evitar la duplicación.` }, 409);
    }
  }

  Object.assign(cls, {
    classCode: newCode, course: newCourse, day: newDay, time: newTime,
    teacher: newTeacher, sede: newSede, sala: newSala, semester: newSemester,
  });
  save("classes", classes);

  const students = load("students");
  for (const s of students) {
    if (s.classCode === oldCode && s.classSemester === oldSemester && s.classHorario === oldHorario) {
      s.classCode = newCode;
      s.classSemester = newSemester;
    }
  }
  save("students", students);

  broadcastScheduleChange(oldHorario);
  return json({ ok: true, classCode: newCode });
});

route("DELETE", "/api/schedule/classes/:classCode", ({ params, query }) => {
  const classCode = decodeURIComponent(params.classCode);
  const semester = semFromQuery(query);
  const horario = horarioFromQuery(query);
  save("classes", load("classes").filter(c =>
    !(c.classCode === classCode && c.semester === semester && c.horario === horario)));
  save("students", load("students").filter(s =>
    !(s.classCode === classCode && s.classSemester === semester && s.classHorario === horario)));
  broadcastScheduleChange(horario);
  return json({ ok: true });
});

route("DELETE", "/api/schedule/wipe", () => {
  const count = load("classes").length;
  save("classes", []);
  save("students", []);
  for (const h of load("horarios")) broadcastScheduleChange(h.id, "schedule_wiped");
  return json({ ok: true, deletedClasses: count });
});

// Vista previa del paso de semestre: cuántas clases y alumnos se copiarían
// y cuántas clases del 2º semestre serían reemplazadas.
route("GET", "/api/schedule/copy-semester/preview", ({ query }) => {
  const horarioVal = (query.get("horario") || "").toUpperCase();
  const classes = load("classes");
  const sourceClasses = classes.filter(c => c.horario === horarioVal && ["PRIMER", "ANUAL"].includes(c.semester));
  const students = load("students");
  const sourceCodes = new Set(sourceClasses.map(c => c.classCode));
  const sourceStudents = students.filter(s =>
    sourceCodes.has(s.classCode) && ["PRIMER", "ANUAL"].includes(s.classSemester) && s.classHorario === horarioVal);
  const existingSegundo = classes.filter(c => c.horario === horarioVal && c.semester === "SEGUNDO").length;
  return json({
    classes: sourceClasses.length,
    students: sourceStudents.length,
    classesWithStudents: new Set(sourceStudents.map(s => s.classCode)).size,
    existingSegundo,
  });
});

// Copia las clases del 1er semestre (y anuales) al 2º semestre.
// body.mode: "with-students" (por defecto) copia también las listas de alumnos;
// "without-students" copia solo la estructura de clases, con inscripción nueva.
route("POST", "/api/schedule/copy-semester", ({ query, body }) => {
  const horarioVal = (query.get("horario") || "TEMUCO").toUpperCase();
  const withStudents = body?.mode !== "without-students";
  const classes = load("classes");
  const sourceClasses = classes.filter(c => c.horario === horarioVal && ["PRIMER", "ANUAL"].includes(c.semester));
  if (!sourceClasses.length) {
    return json({ ok: true, created: 0, message: "No hay clases de 1er semestre para copiar" });
  }
  const students = load("students");
  const sourceCodes = new Set(sourceClasses.map(c => c.classCode));
  const studentsByCode: Record<string, string[]> = {};
  for (const s of students) {
    if (sourceCodes.has(s.classCode) && ["PRIMER", "ANUAL"].includes(s.classSemester) && s.classHorario === horarioVal) {
      (studentsByCode[s.classCode] ??= []).push(s.studentName);
    }
  }

  const keptClasses = classes.filter(c => !(c.horario === horarioVal && c.semester === "SEGUNDO"));
  const keptStudents = students.filter(s => !(s.classHorario === horarioVal && s.classSemester === "SEGUNDO"));

  let created = 0, copiedStudents = 0;
  for (const cls of sourceClasses) {
    keptClasses.push({ ...cls, semester: "SEGUNDO", createdAt: nowIso() });
    if (withStudents) {
      for (const name of studentsByCode[cls.classCode] ?? []) {
        keptStudents.push({
          id: nextId("students"),
          classCode: cls.classCode, classSemester: "SEGUNDO", classHorario: horarioVal,
          studentName: name, createdAt: nowIso(),
        });
        copiedStudents++;
      }
    }
    created++;
  }
  save("classes", keptClasses);
  save("students", keptStudents);
  broadcastScheduleChange(horarioVal);
  return json({ ok: true, created, copiedStudents });
});

route("POST", "/api/schedule/import", async ({ query, formData }) => {
  const file = formData?.get("file") as File | null;
  if (!file) return json({ error: "No se recibió ningún archivo" }, 400);
  const XLSX = await import("xlsx");

  // Con ?horario=<id> la importación afecta solo a ese campus; sin él, a todos.
  const onlyHorario = query.get("horario") || null;

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const dataRows = rows.slice(1).filter(r => r.length >= 5);

  // Vaciar PRIMER (solo del campus indicado, si lo hay); SEGUNDO se conserva y
  // solo se actualizan las listas de alumnos de las clases presentes en el Excel.
  let classes = load("classes").filter(c =>
    c.semester !== "PRIMER" || (onlyHorario !== null && c.horario !== onlyHorario));
  let students = load("students").filter(s =>
    s.classSemester !== "PRIMER" || (onlyHorario !== null && s.classHorario !== onlyHorario));

  let totalCreated = 0, totalSkipped = 0, totalStudents = 0;
  const allParseErrors: string[] = [];
  const perCampus: Record<string, { students: number; createdPrimer: number; createdSegundo: number }> = {};

  // Importar para los campus que el cliente configuró. La columna 0 (Nivel)
  // del Excel debe decir "SEDE <NOMBRE DEL CAMPUS>" (los 4 campus del formato
  // original siguen soportados vía HORARIO_NIVEL).
  const storedHorarios = load("horarios").filter(h => !onlyHorario || h.id === onlyHorario);
  for (const h of storedHorarios) {
    const horarioId = h.id;
    const nivelFilter = (HORARIO_NIVEL[horarioId] ?? `SEDE ${String(h.name).toUpperCase()}`).toUpperCase();
    const defaultSede = h.sedes?.[0]?.name ?? HORARIO_SEDES[horarioId]?.[0] ?? String(h.name).toUpperCase();
    const matching = dataRows.filter(r => String(r[0]).trim().toUpperCase() === nivelFilter);

    type Parsed = { students: string[]; sala: number | null; sede: string };
    const byCodePrimer = new Map<string, Parsed>();
    const byCodeSegundo = new Map<string, Parsed>();

    for (const r of matching) {
      const semester = String(r[1] ?? "").includes("/2") ? "SEGUNDO" : "PRIMER";
      const byCode = semester === "SEGUNDO" ? byCodeSegundo : byCodePrimer;
      const clase = String(r[2]).trim();
      let sala: number | null = null;
      const salaMatch = clase.match(/SALA\s+(\d+)/i);
      if (salaMatch) sala = parseInt(salaMatch[1], 10);
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

    let createdPrimer = 0, createdSegundo = 0;

    // PRIMER: insertar desde cero
    for (const [classCode, info] of byCodePrimer) {
      const parsed = parseClassCode(classCode);
      if (!parsed || !parsed.course || !parsed.day || !parsed.time) {
        allParseErrors.push(classCode);
        totalSkipped++;
        continue;
      }
      classes.push({
        classCode, horario: horarioId,
        course: parsed.course, day: parsed.day, time: parsed.time, teacher: parsed.teacher,
        sede: info.sede, sala: info.sala ?? 1, semester: "PRIMER", createdAt: nowIso(),
      });
      for (const studentName of info.students) {
        students.push({
          id: nextId("students"),
          classCode, classSemester: "PRIMER", classHorario: horarioId,
          studentName, createdAt: nowIso(),
        });
      }
      createdPrimer++;
      totalCreated++;
    }

    // SEGUNDO: crear la clase si falta y reemplazar solo sus alumnos
    for (const [classCode, info] of byCodeSegundo) {
      const parsed = parseClassCode(classCode);
      if (!parsed || !parsed.course || !parsed.day || !parsed.time) {
        allParseErrors.push(classCode);
        totalSkipped++;
        continue;
      }
      const exists = classes.some(c => c.classCode === classCode && c.semester === "SEGUNDO" && c.horario === horarioId);
      if (!exists) {
        classes.push({
          classCode, horario: horarioId,
          course: parsed.course, day: parsed.day, time: parsed.time, teacher: parsed.teacher,
          sede: info.sede, sala: info.sala ?? 1, semester: "SEGUNDO", createdAt: nowIso(),
        });
        totalCreated++;
      }
      students = students.filter(s =>
        !(s.classCode === classCode && s.classSemester === "SEGUNDO" && s.classHorario === horarioId));
      for (const studentName of info.students) {
        students.push({
          id: nextId("students"),
          classCode, classSemester: "SEGUNDO", classHorario: horarioId,
          studentName, createdAt: nowIso(),
        });
      }
      createdSegundo++;
    }

    totalStudents += matching.length;
    perCampus[horarioId] = { students: matching.length, createdPrimer, createdSegundo };
    broadcastScheduleChange(horarioId);
  }

  save("classes", classes);
  save("students", students);

  return json({
    ok: true,
    created: totalCreated,
    updated: 0,
    skipped: totalSkipped,
    totalStudents,
    perCampus,
    parseErrors: allParseErrors.slice(0, 20),
  });
});

route("POST", "/api/schedule/:classCode/students", ({ params, query, body }) => {
  const classCode = decodeURIComponent(params.classCode);
  const semester = semFromQuery(query);
  const horario = horarioFromQuery(query);
  const name = body?.name?.trim();
  if (!name) return json({ error: "name is required" }, 400);

  const cls = load("classes").find(c => c.classCode === classCode && c.semester === semester && c.horario === horario);
  if (!cls) return json({ error: "Class not found" }, 404);

  const students = load("students");
  const inClass = students.filter(s =>
    s.classCode === classCode && s.classSemester === semester && s.classHorario === horario);
  if (inClass.length >= MAX_STUDENTS) {
    return json({ error: "class_full", message: `La clase ya tiene ${MAX_STUDENTS} alumnos` }, 409);
  }
  if (!inClass.some(s => s.studentName === name)) {
    students.push({
      id: nextId("students"),
      classCode, classSemester: semester, classHorario: horario,
      studentName: name, createdAt: nowIso(),
    });
    save("students", students);
  }
  broadcastScheduleChange(cls.horario);
  return json({ ok: true });
});

route("DELETE", "/api/schedule/:classCode/students/:name", ({ params, query }) => {
  const classCode = decodeURIComponent(params.classCode);
  const studentName = decodeURIComponent(params.name);
  const semester = semFromQuery(query);
  const horario = horarioFromQuery(query);
  save("students", load("students").filter(s =>
    !(s.classCode === classCode && s.classSemester === semester &&
      s.classHorario === horario && s.studentName === studentName)));
  broadcastScheduleChange(horario);
  return json({ ok: true });
});

// ─── Rutas: campus (horarios) ────────────────────────────────────────────────

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
  "from-blue-500 to-indigo-600": "blue",
  "from-teal-500 to-emerald-600": "teal",
  "from-orange-500 to-rose-500": "orange",
  "from-cyan-500 to-sky-600": "cyan",
  "from-pink-500 to-fuchsia-600": "pink",
  "from-lime-500 to-green-600": "lime",
  "from-amber-500 to-yellow-600": "amber",
};

route("GET", "/api/horarios", () =>
  json([...load("horarios")].sort((a, b) => a.sortOrder - b.sortOrder)));

route("POST", "/api/horarios", ({ body }) => {
  const { name, subtitle = "", emoji = "🏢", gradient } = body ?? {};
  if (!name?.trim()) return json({ error: "Se requiere un nombre" }, 400);
  const horarios = load("horarios");
  const maxSort = horarios.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);
  const id = name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "").slice(0, 32)
    + "_" + Date.now().toString(36).toUpperCase();
  const chosenGradient = gradient && GRADIENT_OPTIONS.includes(gradient)
    ? gradient : GRADIENT_OPTIONS[Math.floor(Math.random() * GRADIENT_OPTIONS.length)];
  horarios.push({
    id,
    name: name.trim(),
    subtitle: subtitle.trim(),
    emoji: emoji.trim() || "🏢",
    gradient: chosenGradient,
    accentColor: ACCENT_FOR_GRADIENT[chosenGradient] ?? "violet",
    isSystem: false,
    sortOrder: maxSort + 1,
    sedes: [{
      name: name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, ""),
      displayName: name.trim(),
      maxSalas: 6,
    }],
  });
  save("horarios", horarios);
  return json({ ok: true, id, name: name.trim() });
});

route("PUT", "/api/horarios/:id/sedes", ({ params, body }) => {
  const { sedeName, displayName, maxSalas = 6 } = body ?? {};
  if (!sedeName?.trim()) return json({ error: "Se requiere sedeName" }, 400);
  const horarios = load("horarios");
  const row = horarios.find(h => h.id === decodeURIComponent(params.id));
  if (!row) return notFound("Horario no encontrado");
  const updated = {
    name: sedeName.trim().toUpperCase(),
    displayName: (displayName ?? sedeName).trim(),
    maxSalas: Number(maxSalas) || 6,
  };
  const idx = row.sedes.findIndex((s: Row) => s.name === updated.name);
  if (idx >= 0) row.sedes[idx] = updated;
  else row.sedes.push(updated);
  save("horarios", horarios);
  return json({ ok: true, sedes: row.sedes });
});

route("DELETE", "/api/horarios/:id/sedes/:sedeName", ({ params }) => {
  const horarios = load("horarios");
  const row = horarios.find(h => h.id === decodeURIComponent(params.id));
  if (!row) return notFound("Horario no encontrado");
  row.sedes = row.sedes.filter((s: Row) => s.name !== decodeURIComponent(params.sedeName));
  save("horarios", horarios);
  return json({ ok: true, sedes: row.sedes });
});

route("DELETE", "/api/horarios/:id", ({ params }) => {
  const id = decodeURIComponent(params.id);
  const horarios = load("horarios");
  const row = horarios.find(h => h.id === id);
  if (!row) return notFound("Horario no encontrado");
  if (row.isSystem) return json({ error: "No se pueden eliminar campus del sistema" }, 403);
  save("horarios", horarios.filter(h => h.id !== id));
  save("classes", load("classes").filter(c => c.horario !== id));
  save("students", load("students").filter(s => s.classHorario !== id));
  return json({ ok: true });
});

// ─── Rutas: cambios / transferencias ─────────────────────────────────────────

route("GET", "/api/transfers", ({ query }) => {
  const horarioId = query.get("horarioId");
  if (!horarioId) return json({ error: "horarioId requerido" }, 400);
  return json(load("transfers")
    .filter(t => t.horarioId === horarioId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
});

route("POST", "/api/transfers", ({ body }) => {
  const {
    horarioId, studentName = "", teacherBefore = "", teacherAfter = "", sede = "",
    subject = "", leavesClass = "", entersClass = "", transferDate = "",
    changeType = "CAMBIO HORARIO", changeReason = "NINGUNO",
  } = body ?? {};
  if (!horarioId) return json({ error: "horarioId requerido" }, 400);
  const transfers = load("transfers");
  const row = {
    id: nextId("transfers"),
    horarioId, studentName, teacherBefore, teacherAfter, sede, subject,
    leavesClass, entersClass, transferDate, changeType, changeReason,
    createdAt: nowIso(),
  };
  transfers.push(row);
  save("transfers", transfers);
  emit(`transfers:${horarioId}`, { type: "transfer_created", transfer: row });
  return json(row);
});

route("PATCH", "/api/transfers/:id", ({ params, body }) => {
  const id = parseInt(params.id, 10);
  const allowed = ["studentName", "teacherBefore", "teacherAfter", "sede", "subject",
    "leavesClass", "entersClass", "transferDate", "changeType", "changeReason"];
  const transfers = load("transfers");
  const row = transfers.find(t => t.id === id);
  if (!row) return notFound();
  let touched = false;
  for (const key of allowed) {
    if (body && key in body) { row[key] = body[key]; touched = true; }
  }
  if (!touched) return json({ error: "Sin campos para actualizar" }, 400);
  save("transfers", transfers);
  emit(`transfers:${row.horarioId}`, { type: "transfer_updated", transfer: row });
  return json(row);
});

route("DELETE", "/api/transfers/:id", ({ params }) => {
  save("transfers", load("transfers").filter(t => t.id !== parseInt(params.id, 10)));
  return json({ ok: true });
});

// ─── Rutas: equipo ───────────────────────────────────────────────────────────

route("GET", "/api/team", () => json(load("team")));

route("POST", "/api/team", ({ body }) => {
  const { name, role, color } = body ?? {};
  if (!name) return json({ error: "name es requerido" }, 400);
  const team = load("team");
  const member = {
    id: nextId("team"),
    name: String(name).trim(),
    role: role || "secretaria",
    horarioId: "GLOBAL",
    color: color || "violet",
    createdAt: nowIso(),
  };
  team.push(member);
  save("team", team);
  return json(member, 201);
});

route("PATCH", "/api/team/:id", ({ params, body }) => {
  const team = load("team");
  const member = team.find(m => m.id === parseInt(params.id, 10));
  if (!member) return notFound("Miembro no encontrado");
  const { name, role, color } = body ?? {};
  if (name) member.name = name;
  if (role) member.role = role;
  if (color) member.color = color;
  save("team", team);
  return json(member);
});

route("DELETE", "/api/team/:id", ({ params }) => {
  save("team", load("team").filter(m => m.id !== parseInt(params.id, 10)));
  return json({ success: true });
});

// ─── Rutas: tareas ───────────────────────────────────────────────────────────

function taskWithItems(task: Row) {
  const items = load("taskItems")
    .filter(i => i.taskId === task.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { ...task, items };
}

route("GET", "/api/tasks", ({ query }) => {
  const horarioId = query.get("horarioId");
  const personalOwner = query.get("personalOwner");
  let tasks = load("tasks");
  if (horarioId === "ADMIN") {
    // todas
  } else if (personalOwner) {
    tasks = tasks.filter(t => t.horarioId === (horarioId || "") && t.isPersonal === 1 && t.personalOwner === personalOwner);
  } else if (horarioId) {
    tasks = tasks.filter(t => t.horarioId === horarioId && t.isPersonal === 0);
  }
  tasks = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return json(tasks.map(taskWithItems));
});

route("POST", "/api/tasks", ({ body }) => {
  const {
    title, description, horarioId, assignedTo, deadline, priority, status,
    createdBy, isPersonal, personalOwner, items,
  } = body ?? {};
  if (!title || !horarioId) return json({ error: "title y horarioId son requeridos" }, 400);
  const tasks = load("tasks");
  const task = {
    id: nextId("tasks"),
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
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  tasks.push(task);
  save("tasks", tasks);
  let createdItems: Row[] = [];
  if (Array.isArray(items) && items.length > 0) {
    const allItems = load("taskItems");
    createdItems = items.map((text: string, idx: number) => ({
      id: nextId("taskItems"),
      taskId: task.id, text, completed: 0, sortOrder: idx, createdAt: nowIso(),
    }));
    allItems.push(...createdItems);
    save("taskItems", allItems);
  }
  return json({ ...task, items: createdItems }, 201);
});

route("PATCH", "/api/tasks/:id", ({ params, body }) => {
  const tasks = load("tasks");
  const task = tasks.find(t => t.id === parseInt(params.id, 10));
  if (!task) return notFound("Tarea no encontrada");
  Object.assign(task, body ?? {}, { id: task.id, updatedAt: nowIso() });
  save("tasks", tasks);
  return json(taskWithItems(task));
});

route("DELETE", "/api/tasks/:id", ({ params }) => {
  const id = parseInt(params.id, 10);
  save("tasks", load("tasks").filter(t => t.id !== id));
  save("taskItems", load("taskItems").filter(i => i.taskId !== id));
  return json({ success: true });
});

route("POST", "/api/tasks/:id/items", ({ params, body }) => {
  const taskId = parseInt(params.id, 10);
  if (!body?.text) return json({ error: "text es requerido" }, 400);
  const items = load("taskItems");
  const existing = items.filter(i => i.taskId === taskId);
  const item = {
    id: nextId("taskItems"),
    taskId, text: body.text, completed: 0, sortOrder: existing.length, createdAt: nowIso(),
  };
  items.push(item);
  save("taskItems", items);
  return json(item, 201);
});

route("PATCH", "/api/tasks/:id/items/:itemId", ({ params, body }) => {
  const items = load("taskItems");
  const item = items.find(i => i.id === parseInt(params.itemId, 10));
  if (!item) return notFound("Ítem no encontrado");
  Object.assign(item, body ?? {}, { id: item.id, taskId: item.taskId });
  save("taskItems", items);
  return json(item);
});

route("DELETE", "/api/tasks/:id/items/:itemId", ({ params }) => {
  save("taskItems", load("taskItems").filter(i => i.id !== parseInt(params.itemId, 10)));
  return json({ success: true });
});

// ─── Rutas: notas (formato snake_case, como el servidor original) ────────────

route("GET", "/api/notas", ({ query }) => {
  const horarioId = query.get("horarioId");
  if (!horarioId) return json({ error: "horarioId requerido" }, 400);
  const notas = load("notas")
    .filter(n => n.horario_id === horarioId)
    .sort((a, b) => (b.pinned - a.pinned) || b.updated_at.localeCompare(a.updated_at));
  return json(notas);
});

route("POST", "/api/notas", ({ body }) => {
  const { horarioId, autor, titulo, contenido, color, pinned } = body ?? {};
  if (!horarioId) return json({ error: "horarioId requerido" }, 400);
  const notas = load("notas");
  const row = {
    id: nextId("notas"),
    horario_id: horarioId,
    autor: autor ?? "",
    titulo: titulo ?? "",
    contenido: contenido ?? "",
    color: color ?? "amarillo",
    pinned: pinned ? 1 : 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  notas.push(row);
  save("notas", notas);
  return json(row);
});

route("PATCH", "/api/notas/:id", ({ params, body }) => {
  const notas = load("notas");
  const row = notas.find(n => n.id === parseInt(params.id, 10));
  if (!row) return notFound();
  const { titulo, contenido, color, pinned } = body ?? {};
  if (titulo !== undefined) row.titulo = titulo;
  if (contenido !== undefined) row.contenido = contenido;
  if (color !== undefined) row.color = color;
  if (pinned !== undefined) row.pinned = pinned ? 1 : 0;
  row.updated_at = nowIso();
  save("notas", notas);
  return json(row);
});

route("DELETE", "/api/notas/:id", ({ params }) => {
  save("notas", load("notas").filter(n => n.id !== parseInt(params.id, 10)));
  return json({ ok: true });
});

// ─── Rutas: talleres ─────────────────────────────────────────────────────────

function workshopWithStudents(w: Row) {
  const students = load("workshopStudents")
    .filter(s => s.workshopId === w.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(s => s.studentName);
  return { ...w, students };
}

route("GET", "/api/workshops", ({ query }) => {
  const horarioId = query.get("horarioId");
  const sede = query.get("sede");
  let rows = load("workshops");
  if (horarioId) rows = rows.filter(w => w.horarioId === horarioId);
  if (sede) rows = rows.filter(w => w.sede === sede);
  rows = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json(rows.map(workshopWithStudents));
});

route("POST", "/api/workshops", ({ body }) => {
  const { horarioId, sede, teacher, name, workshopDate, workshopTime, maxStudents } = body ?? {};
  if (!horarioId || !sede || !teacher?.trim()) {
    return json({ error: "horarioId, sede y teacher son requeridos" }, 400);
  }
  const workshops = load("workshops");
  const row = {
    id: nextId("workshops"),
    horarioId, sede,
    teacher: teacher.trim(),
    name: (name ?? "").trim(),
    workshopDate: (workshopDate ?? "").trim(),
    workshopTime: (workshopTime ?? "").trim(),
    maxStudents: Number(maxStudents) || 8,
    createdAt: nowIso(),
  };
  workshops.push(row);
  save("workshops", workshops);
  return json({ ...row, students: [] }, 201);
});

route("PATCH", "/api/workshops/:id", ({ params, body }) => {
  const workshops = load("workshops");
  const row = workshops.find(w => w.id === parseInt(params.id, 10));
  if (!row) return notFound();
  const { teacher, name, sede, workshopDate, workshopTime, maxStudents } = body ?? {};
  if (teacher !== undefined) row.teacher = String(teacher).trim();
  if (name !== undefined) row.name = String(name).trim();
  if (sede !== undefined) row.sede = sede;
  if (workshopDate !== undefined) row.workshopDate = String(workshopDate).trim();
  if (workshopTime !== undefined) row.workshopTime = String(workshopTime).trim();
  if (maxStudents !== undefined) row.maxStudents = parseInt(String(maxStudents), 10);
  save("workshops", workshops);
  return json(workshopWithStudents(row));
});

route("DELETE", "/api/workshops/:id", ({ params }) => {
  const id = parseInt(params.id, 10);
  save("workshops", load("workshops").filter(w => w.id !== id));
  save("workshopStudents", load("workshopStudents").filter(s => s.workshopId !== id));
  return new Response(null, { status: 204 });
});

route("POST", "/api/workshops/:id/students", ({ params, body }) => {
  const workshopId = parseInt(params.id, 10);
  const studentName = body?.studentName?.trim();
  if (!studentName) return json({ error: "studentName requerido" }, 400);
  const workshop = load("workshops").find(w => w.id === workshopId);
  if (!workshop) return notFound("Taller no encontrado");
  const students = load("workshopStudents");
  const count = students.filter(s => s.workshopId === workshopId).length;
  if (count >= workshop.maxStudents) return json({ error: "Taller lleno" }, 409);
  students.push({ id: nextId("workshopStudents"), workshopId, studentName, createdAt: nowIso() });
  save("workshopStudents", students);
  return json({ ok: true }, 201);
});

route("DELETE", "/api/workshops/:id/students/:name", ({ params }) => {
  const workshopId = parseInt(params.id, 10);
  const studentName = decodeURIComponent(params.name);
  save("workshopStudents", load("workshopStudents").filter(s =>
    !(s.workshopId === workshopId && s.studentName === studentName)));
  return new Response(null, { status: 204 });
});

// ─── Rutas: orientación ──────────────────────────────────────────────────────

const DAY_NAMES = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const padZ = (n: number) => String(n).padStart(2, "0");
const dateStr = (y: number, m: number, d: number) => `${y}-${padZ(m)}-${padZ(d)}`;
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const dayOfWeek = (y: number, m: number, d: number) => DAY_NAMES[new Date(y, m - 1, d).getDay()];
const HORAS_POR_DEFECTO = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

route("GET", "/api/orientacion/orientadoras", () =>
  json([...load("orientadoras")].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre))));

route("POST", "/api/orientacion/orientadoras", ({ body }) => {
  const { nombre, titulo, fotoUrl, orden } = body ?? {};
  if (!nombre?.trim()) return json({ error: "nombre requerido" }, 400);
  const rows = load("orientadoras");
  const row = {
    id: nextId("orientadoras"),
    nombre: nombre.trim(),
    titulo: titulo?.trim() || "Orientadora",
    fotoUrl: fotoUrl?.trim() || "",
    activa: 1,
    orden: orden ?? 99,
    creadaEn: nowIso(),
  };
  rows.push(row);
  save("orientadoras", rows);
  const horas = load("oriHoras");
  for (const h of HORAS_POR_DEFECTO) {
    if (!horas.some(x => x.orientadoraId === row.id && x.hora === h)) {
      horas.push({ orientadoraId: row.id, hora: h });
    }
  }
  save("oriHoras", horas);
  return json(row, 201);
});

route("PATCH", "/api/orientacion/orientadoras/:id", ({ params, body }) => {
  const rows = load("orientadoras");
  const row = rows.find(o => o.id === parseInt(params.id, 10));
  if (!row) return notFound("No encontrada");
  const { nombre, titulo, fotoUrl, activa, orden } = body ?? {};
  if (nombre !== undefined) row.nombre = String(nombre).trim();
  if (titulo !== undefined) row.titulo = String(titulo).trim();
  if (fotoUrl !== undefined) row.fotoUrl = String(fotoUrl).trim();
  if (activa !== undefined) row.activa = activa;
  if (orden !== undefined) row.orden = orden;
  save("orientadoras", rows);
  return json(row);
});

route("DELETE", "/api/orientacion/orientadoras/:id", ({ params }) => {
  const id = parseInt(params.id, 10);
  save("orientadoras", load("orientadoras").filter(o => o.id !== id));
  return json({ ok: true });
});

route("GET", "/api/orientacion/orientadoras/:id/horario", ({ params }) => {
  const id = parseInt(params.id, 10);
  return json(load("oriHorario")
    .filter(s => s.orientadoraId === id)
    .sort((a, b) => a.diaSemana.localeCompare(b.diaSemana) || a.horaInicio.localeCompare(b.horaInicio)));
});

route("POST", "/api/orientacion/orientadoras/:id/horario", ({ params, body }) => {
  const { diaSemana, horaInicio } = body ?? {};
  if (!diaSemana || !horaInicio) return json({ error: "diaSemana y horaInicio requeridos" }, 400);
  const rows = load("oriHorario");
  const row = { id: nextId("oriHorario"), orientadoraId: parseInt(params.id, 10), diaSemana, horaInicio, activo: 1 };
  rows.push(row);
  save("oriHorario", rows);
  return json(row, 201);
});

route("DELETE", "/api/orientacion/horario/:slotId", ({ params }) => {
  save("oriHorario", load("oriHorario").filter(s => s.id !== parseInt(params.slotId, 10)));
  return json({ ok: true });
});

route("POST", "/api/orientacion/orientadoras/:id/bloqueo", ({ params, body }) => {
  const { fechaInicio, fechaFin, horaInicio, motivo } = body ?? {};
  if (!fechaInicio || !fechaFin) return json({ error: "fechaInicio y fechaFin requeridos" }, 400);
  const rows = load("oriBloqueos");
  const row = {
    id: nextId("oriBloqueos"),
    orientadoraId: parseInt(params.id, 10),
    fechaInicio, fechaFin,
    horaInicio: horaInicio || null,
    motivo: motivo || null,
  };
  rows.push(row);
  save("oriBloqueos", rows);
  return json(row, 201);
});

route("DELETE", "/api/orientacion/bloqueo/:id", ({ params }) => {
  save("oriBloqueos", load("oriBloqueos").filter(b => b.id !== parseInt(params.id, 10)));
  return json({ ok: true });
});

route("POST", "/api/orientacion/orientadoras/:id/desbloqueo", ({ params, body }) => {
  const { fecha, horaInicio } = body ?? {};
  if (!fecha || !horaInicio) return json({ error: "fecha y horaInicio requeridos" }, 400);
  const rows = load("oriDesbloqueos");
  const row = { id: nextId("oriDesbloqueos"), orientadoraId: parseInt(params.id, 10), fecha, horaInicio };
  rows.push(row);
  save("oriDesbloqueos", rows);
  return json(row, 201);
});

route("GET", "/api/orientacion/disponibilidad/:id", ({ params, query }) => {
  const orientadoraId = parseInt(params.id, 10);
  const year = parseInt(query.get("año") ?? "", 10) || new Date().getFullYear();
  const month = parseInt(query.get("mes") ?? "", 10) || (new Date().getMonth() + 1);
  const first = dateStr(year, month, 1);
  const last = dateStr(year, month, daysInMonth(year, month));

  const slots = load("oriHorario").filter(s => s.orientadoraId === orientadoraId && s.activo === 1);
  const citas = load("citas").filter(c => c.orientadoraId === orientadoraId && c.fecha >= first && c.fecha <= last);
  const bloqueos = load("oriBloqueos").filter(b =>
    b.orientadoraId === orientadoraId && b.fechaInicio <= last && b.fechaFin >= first);
  const desbloqueos = load("oriDesbloqueos").filter(d =>
    d.orientadoraId === orientadoraId && d.fecha >= first && d.fecha <= last);

  const result: Row[] = [];
  const totalDays = daysInMonth(year, month);
  for (let d = 1; d <= totalDays; d++) {
    const fecha = dateStr(year, month, d);
    const dow = dayOfWeek(year, month, d);
    const regularHoras = slots.filter(s => s.diaSemana === dow).map(s => s.horaInicio);
    const extraHoras = desbloqueos.filter(x => x.fecha === fecha).map(x => x.horaInicio);
    const allHoras = [...new Set([...regularHoras, ...extraHoras])].sort();
    for (const hora of allHoras) {
      const isBlocked = bloqueos.some(b =>
        b.fechaInicio <= fecha && b.fechaFin >= fecha && (!b.horaInicio || b.horaInicio === hora));
      const isUnblocked = desbloqueos.some(x => x.fecha === fecha && x.horaInicio === hora);
      if (isBlocked && !isUnblocked) {
        result.push({ fecha, horaInicio: hora, status: "blocked" });
        continue;
      }
      const cita = citas.find(c => c.fecha === fecha && c.horaInicio === hora);
      result.push({ fecha, horaInicio: hora, status: cita ? "booked" : "available", cita });
    }
  }
  return json(result);
});

route("GET", "/api/orientacion/citas/all", ({ query }) => {
  const orientadoraId = query.get("orientadoraId");
  const año = query.get("año");
  let rows = load("citas");
  if (orientadoraId) rows = rows.filter(c => c.orientadoraId === parseInt(orientadoraId, 10));
  if (año) rows = rows.filter(c => String(c.fecha).startsWith(`${año}-`));
  rows = [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));
  return json(rows);
});

route("GET", "/api/orientacion/citas", ({ query }) => {
  const year = parseInt(query.get("año") ?? "", 10) || new Date().getFullYear();
  const month = parseInt(query.get("mes") ?? "", 10) || (new Date().getMonth() + 1);
  const first = dateStr(year, month, 1);
  const last = dateStr(year, month, daysInMonth(year, month));
  return json(load("citas")
    .filter(c => c.fecha >= first && c.fecha <= last)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)));
});

route("POST", "/api/orientacion/citas", ({ body }) => {
  const { orientadoraId, nombreEstudiante, agendadoPor, fecha, horaInicio, motivo } = body ?? {};
  if (!orientadoraId || !nombreEstudiante || !fecha || !horaInicio) {
    return json({ error: "Faltan campos requeridos" }, 400);
  }
  const citas = load("citas");
  if (citas.some(c => c.orientadoraId === orientadoraId && c.fecha === fecha && c.horaInicio === horaInicio)) {
    return json({ error: "Ese horario ya está ocupado" }, 409);
  }
  const row = {
    id: nextId("citas"),
    orientadoraId,
    nombreEstudiante: String(nombreEstudiante).trim(),
    agendadoPor: agendadoPor?.trim() || "",
    fecha, horaInicio,
    motivo: motivo?.trim() || null,
    estadoConfirma: "pendiente",
    estadoAsiste: "pendiente",
    notaRapida: null,
    dadoDeAlta: false,
    creadaEn: nowIso(),
  };
  citas.push(row);
  save("citas", citas);
  return json(row, 201);
});

route("PATCH", "/api/orientacion/citas/:id", ({ params, body }) => {
  const citas = load("citas");
  const row = citas.find(c => c.id === parseInt(params.id, 10));
  if (!row) return notFound("Cita no encontrada");
  const { estadoConfirma, estadoAsiste, nombreEstudiante, motivo, notaRapida, dadoDeAlta } = body ?? {};
  if (estadoConfirma !== undefined) row.estadoConfirma = estadoConfirma;
  if (estadoAsiste !== undefined) row.estadoAsiste = estadoAsiste;
  if (nombreEstudiante !== undefined) row.nombreEstudiante = String(nombreEstudiante).trim();
  if (motivo !== undefined) row.motivo = motivo?.trim() || null;
  if (notaRapida !== undefined) row.notaRapida = notaRapida?.trim() || null;
  if (dadoDeAlta !== undefined) row.dadoDeAlta = dadoDeAlta;
  save("citas", citas);
  return json(row);
});

route("DELETE", "/api/orientacion/citas/:id", ({ params }) => {
  save("citas", load("citas").filter(c => c.id !== parseInt(params.id, 10)));
  return json({ ok: true });
});

route("GET", "/api/orientacion/orientadoras/:id/bloqueos", ({ params }) => {
  const id = parseInt(params.id, 10);
  return json(load("oriBloqueos")
    .filter(b => b.orientadoraId === id)
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)));
});

route("GET", "/api/orientacion/estados", () =>
  json([...load("estados")].sort((a, b) =>
    a.tipo.localeCompare(b.tipo) || (a.orden - b.orden) || (a.id - b.id))));

route("POST", "/api/orientacion/estados", ({ body }) => {
  const { tipo, label, color, orden } = body ?? {};
  if (!tipo || !label?.trim()) return json({ error: "tipo y label requeridos" }, 400);
  const rows = load("estados");
  const row = { id: nextId("estados"), tipo, label: label.trim(), color: color ?? "#94a3b8", orden: orden ?? 99 };
  rows.push(row);
  save("estados", rows);
  return json(row, 201);
});

route("PATCH", "/api/orientacion/estados/:id", ({ params, body }) => {
  const rows = load("estados");
  const row = rows.find(e => e.id === parseInt(params.id, 10));
  if (!row) return notFound();
  const { label, color, orden } = body ?? {};
  if (label !== undefined) row.label = String(label).trim();
  if (color !== undefined) row.color = color;
  if (orden !== undefined) row.orden = orden;
  save("estados", rows);
  return json(row);
});

route("DELETE", "/api/orientacion/estados/:id", ({ params }) => {
  save("estados", load("estados").filter(e => e.id !== parseInt(params.id, 10)));
  return json({ ok: true });
});

route("GET", "/api/orientacion/orientadoras/:id/horas", ({ params }) => {
  const id = parseInt(params.id, 10);
  return json(load("oriHoras")
    .filter(h => h.orientadoraId === id)
    .map(h => h.hora)
    .sort());
});

route("POST", "/api/orientacion/orientadoras/:id/horas", ({ params, body }) => {
  const id = parseInt(params.id, 10);
  const h = body?.hora?.trim();
  if (!h) return json({ error: "hora requerida" }, 400);
  if (!/^\d{2}:\d{2}$/.test(h)) return json({ error: "Formato inválido (HH:MM)" }, 400);
  const horas = load("oriHoras");
  if (!horas.some(x => x.orientadoraId === id && x.hora === h)) {
    horas.push({ orientadoraId: id, hora: h });
    save("oriHoras", horas);
  }
  return json({ ok: true, hora: h }, 201);
});

route("DELETE", "/api/orientacion/orientadoras/:id/horas/:hora", ({ params }) => {
  const id = parseInt(params.id, 10);
  const hora = decodeURIComponent(params.hora);
  save("oriHoras", load("oriHoras").filter(h => !(h.orientadoraId === id && h.hora === hora)));
  return json({ ok: true });
});

route("GET", "/api/orientacion/export", async ({ query }) => {
  const XLSX = await import("xlsx");
  const año = query.get("año");

  const orientadoras = [...load("orientadoras")].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre));
  const nombreById = new Map(orientadoras.map(o => [o.id, o.nombre]));

  let citas = load("citas");
  if (año) citas = citas.filter(c => String(c.fecha).startsWith(`${año}-`));
  citas = [...citas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio));

  const citasSheet = citas.map(r => ({
    "Fecha": r.fecha,
    "Hora": r.horaInicio,
    "Orientadora": nombreById.get(r.orientadoraId) ?? `#${r.orientadoraId}`,
    "Estudiante": r.nombreEstudiante,
    "Agendado por": r.agendadoPor,
    "Motivo": r.motivo ?? "",
    "Estado confirmación": r.estadoConfirma,
    "Estado asistencia": r.estadoAsiste,
    "Nota rápida": r.notaRapida ?? "",
    "Dado de alta": r.dadoDeAlta ? "Sí" : "No",
    "Creada en": r.creadaEn,
  }));
  const orientadorasSheet = orientadoras.map(o => ({
    "Nombre": o.nombre,
    "Título": o.titulo,
    "Activa": o.activa === 1 ? "Sí" : "No",
    "Orden": o.orden,
  }));
  const bloqueosSheet = load("oriBloqueos").map(b => ({
    "Orientadora": nombreById.get(b.orientadoraId) ?? `#${b.orientadoraId}`,
    "Desde": b.fechaInicio,
    "Hasta": b.fechaFin,
    "Hora (si aplica)": b.horaInicio ?? "Todo el día",
    "Motivo": b.motivo ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(citasSheet), "Citas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orientadorasSheet), "Orientadoras");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bloqueosSheet), "Bloqueos");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  return new Response(new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), { status: 200 });
});

// ─── Instalación de los interceptores ────────────────────────────────────────

function toApiUrl(input: RequestInfo | URL): URL | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let u: URL;
  try {
    u = new URL(raw, location.origin);
  } catch {
    return null;
  }
  return u.pathname.startsWith("/api/") ? u : null;
}

async function dispatch(u: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  let body: any = null;
  let formData: FormData | null = null;
  if (init?.body instanceof FormData) {
    formData = init.body;
  } else if (typeof init?.body === "string") {
    try { body = JSON.parse(init.body); } catch { body = null; }
  }
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = u.pathname.match(r.regex);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    try {
      return await r.handler({ params, query: u.searchParams, body, formData });
    } catch (err) {
      console.error(`[local-api] ${method} ${u.pathname}:`, err);
      const msg = err instanceof Error && err.message ? err.message : "Error interno (local)";
      return json({ error: msg }, 500);
    }
  }
  return json({ error: `Ruta local no implementada: ${method} ${u.pathname}` }, 404);
}

export function installLocalApi() {
  seedIfNeeded();

  const origFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const u = toApiUrl(input);
    if (u) return dispatch(u, init);
    return origFetch(input as any, init);
  }) as typeof window.fetch;

  const NativeES = window.EventSource;
  (window as any).EventSource = class {
    constructor(url: string | URL, init?: EventSourceInit) {
      const u = new URL(String(url), location.origin);
      if (u.pathname.startsWith("/api/")) return new LocalEventSource(u) as any;
      return new NativeES(url, init) as any;
    }
  };
}
