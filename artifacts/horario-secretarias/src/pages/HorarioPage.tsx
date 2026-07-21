import { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import { Search, X, MapPin, Clock, Users, AlertTriangle, Plus, Minus, Trash2, RefreshCw, Pencil, Check, Bell, BellOff, GraduationCap } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import {
  DAYS,
  DAY_LABELS,
  TIME_SLOTS,
  COURSE_FULL_NAMES,
  type ClassEntry,
} from "@/data/schedule";
import { useHorario } from "@/context/HorarioContext";
import { useNotifications } from "@/context/NotificationContext";
import { apiUrl } from "@/lib/api";
import TalleresTab from "@/components/TalleresTab";

const SEDE_DISPLAY_NAMES: Record<string, string> = {
  "LAS ENCINAS": "Las Encinas",
  "INES DE SUAREZ": "Inés de Suárez",
  "D. ALMAGRO": "D. Almagro",
  "VILLARRICA": "Villarrica",
  "AV. ALEMANIA": "Av. Alemania",
};
function displaySede(sede: string): string {
  return SEDE_DISPLAY_NAMES[sede] ?? sede.split(" ").map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

const SEDE_ROOMS_MIN: Record<string, number> = {
  "LAS ENCINAS": 1,
  "INES DE SUAREZ": 1,
};

const NORMAL_CAPACITY = 7;
const MAX_STUDENTS = 8;

const COURSE_SOLID_COLORS: Record<string, string> = {
  // Matemática → familia amarillo (todos amarillo, distintas intensidades)
  "MP":       "bg-yellow-200",
  "M2":       "bg-yellow-300",
  "M1":       "bg-yellow-400",
  "M1 INT":   "bg-yellow-500",
  "MT":       "bg-yellow-500",
  "M1 CONT":  "bg-yellow-600",
  "MS":       "bg-yellow-600",
  "M2 INT":   "bg-yellow-600",
  // Lenguaje → familia rojo/rosa (cada uno distinto)
  "LN":       "bg-red-500",
  "LN INT":   "bg-red-700",
  "LN CONT":  "bg-red-800",
  "LT":       "bg-rose-600",
  "LS":       "bg-rose-400",
  "LP":       "bg-red-400",
  // Física → familia naranja (cada uno distinto)
  "FIS":      "bg-orange-500",
  "FIS INT":  "bg-orange-700",
  "FIS CONT": "bg-orange-800",
  // Química → familia cyan/calipso (cada uno distinto)
  "QUI":      "bg-cyan-500",
  "QUI INT":  "bg-cyan-700",
  "QUI CONT": "bg-teal-600",
  // Biología → familia verde (cada uno distinto)
  "BIO":      "bg-green-500",
  "BIO INT":  "bg-green-700",
  "BIO CONT": "bg-emerald-600",
  // Historia → familia gris (cada uno distinto)
  "HS":       "bg-gray-400",
  "HS INT":   "bg-gray-600",
  "HIS":      "bg-gray-500",
  "HIS INT":  "bg-gray-700",
  // Otros
  "CS":       "bg-slate-500",
};

const COURSE_BADGE_COLORS: Record<string, string> = {
  // Matemática → todos amarillo
  "MP":       "bg-yellow-50 text-yellow-700 border-yellow-200",
  "M2":       "bg-yellow-100 text-yellow-800 border-yellow-200",
  "M1":       "bg-yellow-100 text-yellow-800 border-yellow-200",
  "M1 INT":   "bg-yellow-200 text-yellow-900 border-yellow-300",
  "MT":       "bg-yellow-200 text-yellow-900 border-yellow-300",
  "M1 CONT":  "bg-yellow-300 text-yellow-900 border-yellow-400",
  "MS":       "bg-yellow-200 text-yellow-900 border-yellow-300",
  "M2 INT":   "bg-yellow-200 text-yellow-900 border-yellow-300",
  // Lenguaje
  "LN":       "bg-red-100 text-red-800 border-red-200",
  "LN INT":   "bg-red-200 text-red-900 border-red-300",
  "LN CONT":  "bg-red-300 text-red-900 border-red-400",
  "LT":       "bg-rose-100 text-rose-800 border-rose-200",
  "LS":       "bg-rose-100 text-rose-900 border-rose-300",
  "LP":       "bg-red-50 text-red-700 border-red-200",
  // Física
  "FIS":      "bg-orange-100 text-orange-800 border-orange-200",
  "FIS INT":  "bg-orange-200 text-orange-900 border-orange-300",
  "FIS CONT": "bg-orange-300 text-orange-900 border-orange-400",
  // Química
  "QUI":      "bg-cyan-100 text-cyan-800 border-cyan-200",
  "QUI INT":  "bg-cyan-200 text-cyan-900 border-cyan-300",
  "QUI CONT": "bg-teal-100 text-teal-800 border-teal-200",
  // Biología
  "BIO":      "bg-green-100 text-green-800 border-green-200",
  "BIO INT":  "bg-green-200 text-green-900 border-green-300",
  "BIO CONT": "bg-emerald-100 text-emerald-800 border-emerald-200",
  // Historia
  "HS":       "bg-gray-100 text-gray-600 border-gray-200",
  "HS INT":   "bg-gray-200 text-gray-700 border-gray-300",
  "HIS":      "bg-gray-100 text-gray-700 border-gray-200",
  "HIS INT":  "bg-gray-200 text-gray-800 border-gray-300",
  // Otros
  "CS":       "bg-slate-100 text-slate-800 border-slate-200",
};

function getBaseCourse(course: string): string {
  return course.split(" ")[0];
}

interface DuplicateConflict {
  student: string;
  otherEntry: ClassEntry;
}

function getConflicts(entry: ClassEntry, allData: ClassEntry[]): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];
  for (const student of entry.students) {
    const others = allData.filter(
      e => e.classCode !== entry.classCode &&
        e.course === entry.course &&
        e.students.includes(student)
    );
    for (const other of others) {
      conflicts.push({ student, otherEntry: other });
    }
  }
  return conflicts;
}

async function apiAddStudent(classCode: string, semester: string, horario: string, name: string): Promise<{ ok?: boolean; error?: string; message?: string }> {
  const res = await fetch(apiUrl(`/api/schedule/${encodeURIComponent(classCode)}/students?semester=${encodeURIComponent(semester)}&horario=${encodeURIComponent(horario)}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

async function apiRemoveStudent(classCode: string, semester: string, horario: string, name: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(
    apiUrl(`/api/schedule/${encodeURIComponent(classCode)}/students/${encodeURIComponent(name)}?semester=${encodeURIComponent(semester)}&horario=${encodeURIComponent(horario)}`),
    { method: "DELETE" }
  );
  return res.json();
}

async function apiUpdateSala(classCode: string, semester: string, horario: string, sala: number): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(apiUrl(`/api/schedule/classes/${encodeURIComponent(classCode)}?semester=${encodeURIComponent(semester)}&horario=${encodeURIComponent(horario)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sala }),
  });
  return res.json();
}

async function apiPublishNotification(payload: {
  horarioId: string;
  sede: string;
  classCode: string;
  course: string;
  day: string;
  time: string;
  cupos: number;
}): Promise<void> {
  try {
    await fetch(apiUrl("/api/notifications/publish"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

function ClassCellBase({
  entry,
  onSelect,
  selected,
  highlighted,
  dimmed,
  typingBy,
}: {
  entry: ClassEntry;
  onSelect: (e: ClassEntry) => void;
  selected: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  typingBy?: string;
}) {
  const solidBg = COURSE_SOLID_COLORS[entry.course] ?? "bg-slate-500";
  const count = entry.students.length;
  const isFull = count >= MAX_STUDENTS;
  const isOverCapacity = count > NORMAL_CAPACITY;

  return (
    <button
      onClick={() => onSelect(entry)}
      className={`w-full h-full text-left align-top cursor-pointer transition-all duration-150 ${
        selected
          ? "bg-primary/5 outline outline-2 outline-primary outline-offset-[-2px]"
          : highlighted
          ? "bg-yellow-50 outline outline-2 outline-yellow-400 outline-offset-[-2px] shadow-inner"
          : dimmed
          ? "opacity-30 grayscale-[60%]"
          : "hover:bg-muted/60"
      }`}
    >
      <div className="p-1.5">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className={`${solidBg} text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md leading-tight`}>
            {entry.classCode}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-tight shrink-0 ${
            isOverCapacity
              ? "bg-amber-200 text-amber-800 animate-pulse"
              : isFull
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-700"
          }`}>
            {count}/{MAX_STUDENTS}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground font-medium mb-1 truncate">
          {entry.teacher}
        </div>
        <ul>
          {entry.students.slice(0, MAX_STUDENTS).map((s, i) => (
            <li key={i} className={`text-[12px] leading-[18px] truncate rounded px-0.5 ${
              i >= NORMAL_CAPACITY
                ? "bg-amber-200 text-amber-900 font-semibold"
                : "text-foreground"
            }`}>
              <span className={`font-semibold ${i >= NORMAL_CAPACITY ? "text-amber-700" : "text-muted-foreground"}`}>{i + 1}.</span> {s}
            </li>
          ))}
          {count > MAX_STUDENTS && (
            <li className="text-[12px] text-amber-700 font-semibold leading-[18px] bg-amber-100 rounded px-0.5">
              +{count - MAX_STUDENTS} más...
            </li>
          )}
          {Array.from({ length: Math.max(0, MAX_STUDENTS - count) }).map((_, i) => (
            <li key={`empty-${i}`} className="text-[12px] text-muted-foreground/30 leading-[18px]">
              —
            </li>
          ))}
        </ul>

        {typingBy && (
          <div className="mt-1.5 flex items-center gap-1 bg-violet-100 border border-violet-200 rounded-md px-1.5 py-0.5">
            <Pencil className="w-2.5 h-2.5 text-violet-500 shrink-0" />
            <span className="text-[9px] font-semibold text-violet-700 truncate">{typingBy}</span>
            <span className="flex gap-[2px] shrink-0 ml-0.5">
              <span className="w-[3px] h-[3px] rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-[3px] h-[3px] rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-[3px] h-[3px] rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
const ClassCell = memo(ClassCellBase);

function DetailPanel({
  entry,
  allData,
  onClose,
  onStudentChange,
  sessionId,
  myName,
  onTypingStart,
  onTypingStop,
}: {
  entry: ClassEntry;
  allData: ClassEntry[];
  onClose: () => void;
  onStudentChange: () => void;
  sessionId: string;
  myName: string;
  onTypingStart: (classCode: string) => void;
  onTypingStop: () => void;
}) {
  const { horarioId } = useHorario();
  const badge = COURSE_BADGE_COLORS[entry.course] ?? "bg-slate-100 text-slate-800 border-slate-200";
  const [newStudentName, setNewStudentName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingSala, setEditingSala] = useState(false);
  const [salaInput, setSalaInput] = useState(String(entry.sala));
  const [savingSala, setSavingSala] = useState(false);
  const [salaError, setSalaError] = useState("");

  async function handleSaveSala() {
    const num = parseInt(salaInput, 10);
    if (!num || num < 1 || num > 20) { setSalaError("Número inválido"); return; }
    setSavingSala(true);
    setSalaError("");
    try {
      const result = await apiUpdateSala(entry.classCode, entry.semester ?? "PRIMER", entry.horario ?? horarioId, num);
      if (result.error) { setSalaError(result.error); }
      else { setEditingSala(false); onStudentChange(); }
    } catch { setSalaError("Error de conexión"); }
    finally { setSavingSala(false); }
  }

  const conflicts = useMemo(() => getConflicts(entry, allData), [entry, allData]);
  const conflictMap = useMemo(() => {
    const map = new Map<string, DuplicateConflict[]>();
    for (const c of conflicts) {
      if (!map.has(c.student)) map.set(c.student, []);
      map.get(c.student)!.push(c);
    }
    return map;
  }, [conflicts]);

  const isFull = entry.students.length >= MAX_STUDENTS;
  const isOverCapacity = entry.students.length > NORMAL_CAPACITY;

  // Detectar conflictos en tiempo real mientras se escribe
  const previewConflicts = useMemo(() => {
    const name = newStudentName.trim().toLowerCase();
    if (!name) return [];
    const results: { classEntry: ClassEntry; matchedName: string }[] = [];
    for (const e of allData) {
      if (e.classCode === entry.classCode) continue;
      if (e.course !== entry.course) continue;
      for (const s of e.students) {
        if (s.toLowerCase().includes(name)) {
          results.push({ classEntry: e, matchedName: s });
        }
      }
    }
    return results;
  }, [newStudentName, allData, entry]);

  async function handleAdd() {
    const name = newStudentName.trim();
    if (!name) return;
    setAdding(true);
    setAddError("");
    try {
      const result = await apiAddStudent(entry.classCode, entry.semester ?? "PRIMER", entry.horario ?? horarioId, name);
      if (result.error === "class_full") {
        setAddError("La clase ya tiene 7 alumnos.");
      } else if (result.error) {
        setAddError(result.message ?? "Error al agregar alumno.");
      } else {
        setNewStudentName("");
        onTypingStop();
        onStudentChange();

        // Auto-registrar el curso al que ENTRA el alumno en la tabla de Cambios
        const today = new Date().toISOString().slice(0, 10);
        const fullCourseName = COURSE_FULL_NAMES[entry.course] ?? entry.course;
        const entersReadable = entry.classCode.replace(entry.course, fullCourseName);

        // Buscar si ya existe un registro incompleto de este alumno (sin "entersClass")
        const searchRes = await fetch(
          `/api/transfers?horarioId=${encodeURIComponent(horarioId)}`
        ).catch(() => null);

        if (searchRes?.ok) {
          const allTransfers: Array<{
            id: number; studentName: string; entersClass: string;
          }> = await searchRes.json();
          const incomplete = allTransfers.find(
            t => t.studentName.toLowerCase() === name.toLowerCase() && t.entersClass === ""
          );
          if (incomplete) {
            // Completar el registro existente con los datos del nuevo curso
            fetch(apiUrl(`/api/transfers/${incomplete.id}`), {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entersClass: entersReadable,
                teacherAfter: entry.teacher,
              }),
            }).catch(() => {});
          } else {
            // No hay registro previo: crear uno nuevo con los datos de entrada
            fetch(apiUrl("/api/transfers"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                horarioId,
                studentName: name,
                teacherBefore: "",
                teacherAfter: entry.teacher,
                sede: entry.sede,
                subject: fullCourseName,
                leavesClass: "",
                entersClass: entersReadable,
                transferDate: today,
                changeType: "CAMBIO HORARIO",
                changeReason: "NINGUNO",
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      setAddError("Error de conexión.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(studentName: string) {
    setRemovingStudent(studentName);
    try {
      const result = await apiRemoveStudent(entry.classCode, entry.semester ?? "PRIMER", entry.horario ?? horarioId, studentName);
      if (result.error) {
        setAddError(result.error ?? "Error al eliminar alumno.");
        return;
      }
      onStudentChange();

      // Auto-registrar el cambio en la tabla de Cambios
      const today = new Date().toISOString().slice(0, 10);
      const fullCourseName = COURSE_FULL_NAMES[entry.course] ?? entry.course;
      // Reemplaza el código del curso por el nombre completo en el classCode
      // ej: "M1 LUN 18.00 SF" → "Matemática 1 LUN 18.00 SF"
      const leavesReadable = entry.classCode.replace(entry.course, fullCourseName);
      fetch(apiUrl("/api/transfers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horarioId,
          studentName,
          teacherBefore: entry.teacher,
          teacherAfter: "",
          sede: entry.sede,
          subject: fullCourseName,
          leavesClass: leavesReadable,
          entersClass: "",
          transferDate: today,
          changeType: "CAMBIO HORARIO",
          changeReason: "NINGUNO",
        }),
      }).catch(() => {});

      const newCount = entry.students.length - 1;
      if (newCount < MAX_STUDENTS) {
        const cupos = MAX_STUDENTS - newCount;
        await apiPublishNotification({
          horarioId,
          sede: entry.sede,
          classCode: entry.classCode,
          course: COURSE_FULL_NAMES[entry.course] ?? entry.course,
          day: DAY_LABELS[entry.day] ?? entry.day,
          time: entry.time,
          cupos,
        });
      }
    } catch {
      setAddError("Error de conexión al eliminar alumno. Intente de nuevo.");
    } finally {
      setRemovingStudent(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAdd();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => { onTypingStop(); onClose(); }} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-card shadow-2xl border-l border-border z-50 flex flex-col">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${badge}`}>
                  {entry.course}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                  entry.semester === "SEGUNDO"
                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                    : entry.semester === "ANUAL"
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                }`}>
                  {entry.semester === "SEGUNDO" ? "2do Semestre" : entry.semester === "ANUAL" ? "Anual" : "1er Semestre"}
                </span>
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground">
                {COURSE_FULL_NAMES[entry.course] ?? entry.course}
              </h2>
              <p className="text-muted-foreground text-sm mt-1">{entry.classCode}</p>
            </div>
            <button
              onClick={() => { onTypingStop(); onClose(); }}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: MapPin, label: "Sede", value: entry.sede === "INES DE SUAREZ" ? "Inés de Suárez" : "Las Encinas" },
              { icon: Clock, label: "Horario", value: entry.time },
              { icon: Users, label: "Día", value: DAY_LABELS[entry.day] ?? entry.day },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-muted/50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                </div>
                <div className="font-semibold text-sm text-foreground">{value}</div>
              </div>
            ))}

            {/* Sala — editable inline */}
            <div className="bg-muted/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Sala</span>
              </div>
              {editingSala ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={salaInput}
                    onChange={e => { setSalaInput(e.target.value); setSalaError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveSala(); if (e.key === "Escape") setEditingSala(false); }}
                    className="w-14 px-2 py-1 text-sm font-bold border border-primary rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveSala}
                    disabled={savingSala}
                    className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {savingSala ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setEditingSala(false); setSalaInput(String(entry.sala)); setSalaError(""); }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-sm text-foreground">Sala {entry.sala}</span>
                  <button
                    onClick={() => { setEditingSala(true); setSalaInput(String(entry.sala)); }}
                    className="p-1 rounded-lg hover:bg-muted/80 transition-colors text-muted-foreground/60 hover:text-primary"
                    title="Cambiar sala"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              {salaError && <p className="text-[10px] text-destructive mt-1">{salaError}</p>}
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/20">
            <div className="text-xs text-muted-foreground mb-1 font-medium">Profesor</div>
            <div className="font-display font-bold text-lg text-foreground">{entry.teacher}</div>
          </div>

          {conflictMap.size > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-sm font-bold text-amber-800">
                  {conflictMap.size} alumno{conflictMap.size !== 1 ? "s" : ""} con inscripción duplicada
                </span>
              </div>
              <ul className="space-y-2">
                {Array.from(conflictMap.entries()).map(([student, cs]) =>
                  cs.map((c, ci) => (
                    <li key={`${student}-${ci}`} className="text-xs text-amber-700 bg-amber-100/60 rounded-xl px-3 py-2">
                      <span className="font-semibold">{student}</span> ya está en{" "}
                      <span className="font-bold">{c.otherEntry.course}</span>
                      {" · "}
                      {c.otherEntry.sede === "INES DE SUAREZ" ? "Inés de Suárez" : "Las Encinas"}
                      {" · "}
                      Sala {c.otherEntry.sala}
                      {" · "}
                      {DAY_LABELS[c.otherEntry.day] ?? c.otherEntry.day} {c.otherEntry.time}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-foreground">Alumnos inscritos</h3>
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                isOverCapacity ? "bg-amber-200 text-amber-800" : isFull ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"
              }`}>
                {entry.students.length}/{MAX_STUDENTS}
              </span>
            </div>

            {!isFull && (
              <div className="mb-4">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newStudentName}
                    onChange={e => {
                      const val = e.target.value;
                      setNewStudentName(val);
                      setAddError("");
                      if (val.trim()) onTypingStart(entry.classCode);
                      else onTypingStop();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Nombre del alumno..."
                    className={`flex-1 px-3 py-2 text-sm border rounded-xl bg-background focus:outline-none focus:ring-2 placeholder:text-muted-foreground transition-colors ${
                      previewConflicts.length > 0
                        ? "border-amber-400 focus:ring-amber-300"
                        : "border-border focus:ring-primary/50"
                    }`}
                    disabled={adding}
                  />
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newStudentName.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>

                {/* Aviso en tiempo real: alumno ya inscrito en otra clase del mismo ramo */}
                {previewConflicts.length > 0 && (
                  <div className="mt-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-amber-800">
                        Ya inscrito en {entry.course}
                      </span>
                    </div>
                    {previewConflicts.map((pc, i) => (
                      <div key={i} className="text-xs text-amber-700 bg-amber-100/70 rounded-lg px-2.5 py-1.5 leading-snug">
                        <span className="font-semibold">{pc.matchedName}</span>
                        {" — "}
                        <span className="font-medium">{DAY_LABELS[pc.classEntry.day] ?? pc.classEntry.day}</span>
                        {" · "}
                        {pc.classEntry.time}
                        {" · "}
                        Sala {pc.classEntry.sala}
                        {" · "}
                        Profe {pc.classEntry.teacher}
                      </div>
                    ))}
                  </div>
                )}

                {addError && (
                  <p className="mt-2 text-xs text-destructive font-medium">{addError}</p>
                )}
              </div>
            )}

            {isOverCapacity && (
              <div className="mb-3 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                Clase sobre el cupo — tiene {entry.students.length} alumnos (máximo {MAX_STUDENTS}). Los alumnos resaltados superan el cupo normal.
              </div>
            )}
            {!isOverCapacity && isFull && (
              <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
                Clase completa — máximo {MAX_STUDENTS} alumnos alcanzado.
              </div>
            )}

            {entry.students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Sin alumnos registrados
              </div>
            ) : (
              <ul className="space-y-2">
                {entry.students.map((s, i) => {
                  const hasConflict = conflictMap.has(s);
                  const isRemoving = removingStudent === s;
                  const isExtraStudent = i >= NORMAL_CAPACITY;
                  return (
                    <li
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-colors group ${
                        isExtraStudent
                          ? "bg-amber-100 border border-amber-300"
                          : hasConflict
                          ? "bg-amber-50 border border-amber-200"
                          : "bg-muted/40 hover:bg-muted/70"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isExtraStudent
                          ? "bg-amber-400 text-white"
                          : hasConflict
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {isExtraStudent ? "!" : hasConflict ? <AlertTriangle className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${isExtraStudent ? "text-amber-900 font-semibold" : hasConflict ? "text-amber-800" : "text-foreground"}`}>
                          {s}
                        </span>
                        {isExtraStudent && (
                          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Alumno #{i + 1} — fuera del cupo normal (7)</div>
                        )}
                        {hasConflict && conflictMap.get(s)!.map((c, ci) => (
                          <div key={ci} className="text-[11px] text-amber-600 mt-0.5">
                            También en {c.otherEntry.course} · {c.otherEntry.sede === "INES DE SUAREZ" ? "Inés de Suárez" : "Las Encinas"} Sala {c.otherEntry.sala}
                          </div>
                        ))}
                      </div>
                      {confirmRemoveStudent === s ? (
                        <div className="flex items-center gap-1 shrink-0 animate-in fade-in duration-150">
                          <button
                            onClick={() => { setConfirmRemoveStudent(null); handleRemove(s); }}
                            disabled={isRemoving}
                            className="px-2 py-0.5 text-[11px] font-bold bg-destructive text-white rounded-lg hover:bg-destructive/80 transition-colors disabled:opacity-60"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmRemoveStudent(null)}
                            className="px-2 py-0.5 text-[11px] font-bold bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveStudent(s)}
                          disabled={isRemoving}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30 shrink-0"
                          title="Eliminar alumno"
                        >
                          {isRemoving
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function HorarioPage() {
  const { horarioId, horario } = useHorario();
  const { subscribeToSede, unsubscribeFromSede } = useNotifications();
  const [, setLocation] = useLocation();
  const rawSearch = useSearch();
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
  const [search, setSearch] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<ClassEntry | null>(null);
  const [activeSede, setActiveSede] = useState<string>(() => horario.sedes[0]);
  const [activeTab, setActiveTab] = useState<"PRIMER" | "SEGUNDO" | "talleres">("PRIMER");
  const [allData, setAllData] = useState<ClassEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [gridZoom, setGridZoom] = useState(100);
  const zoomIn  = () => setGridZoom(z => Math.min(z + 10, 150));
  const zoomOut = () => setGridZoom(z => Math.max(z - 10, 50));

  // ── Notificaciones activadas/desactivadas por sede (persiste en localStorage) ─
  const [notifsEnabledBySede, setNotifsEnabledBySede] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (const sede of horario.sedes) {
      result[sede] = localStorage.getItem(`notif-enabled:${horarioId}:${sede}`) !== "0";
    }
    return result;
  });

  const notifsEnabled = notifsEnabledBySede[activeSede] ?? true;

  function toggleNotifs() {
    const newVal = !notifsEnabled;
    localStorage.setItem(`notif-enabled:${horarioId}:${activeSede}`, newVal ? "1" : "0");
    setNotifsEnabledBySede(prev => ({ ...prev, [activeSede]: newVal }));
  }

  // Reset cuando el usuario cambia de campus (horarioId).
  // NO llamamos setAllData([]) aquí: fetchData reemplazará los datos cuando
  // lleguen del nuevo campus. El spinner cubre la transición.
  // NO incluir horario.sedes: el contexto puede crear un nuevo array con
  // el mismo contenido al recargar, disparando este efecto innecesariamente.
  useEffect(() => {
    setActiveSede(horario.sedes[0]);
    setActiveTab("PRIMER");
    setSelectedEntry(null);
    setLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioId]);

  // ── Suscripción SSE a notificaciones por sede ───────────────────────────────
  useEffect(() => {
    if (!activeSede) return;
    sessionStorage.setItem("horario-active-sede", activeSede);
    if (!notifsEnabled) {
      unsubscribeFromSede();
      return;
    }
    subscribeToSede(horarioId, activeSede);
    return () => { unsubscribeFromSede(); };
  }, [horarioId, activeSede, notifsEnabled, subscribeToSede, unsubscribeFromSede]);

  // ── Apertura automática desde notificación (?open=classCode&sede=...) ────────
  useEffect(() => {
    if (!allData.length) return;
    const params = new URLSearchParams(rawSearch);
    const openCode = params.get("open");
    const openSede = params.get("sede");
    if (!openCode) return;
    const entry = allData.find(e => e.classCode === openCode);
    if (!entry) return;
    if (openSede && horario.sedes.includes(openSede)) setActiveSede(openSede);
    else if (entry.sede && horario.sedes.includes(entry.sede)) setActiveSede(entry.sede);
    setSelectedEntry(entry);
    setLocation("/horarios", { replace: true });
  }, [allData, rawSearch, horario.sedes, setLocation]);

  // ── Presencia colaborativa ──────────────────────────────────────────────────
  const [sessionId] = useState<string>(() => {
    const stored = sessionStorage.getItem("horario-session-id");
    if (stored) return stored;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("horario-session-id", id);
    return id;
  });
  const [myName, setMyName] = useState<string>(() =>
    sessionStorage.getItem("horario-session-name") ?? ""
  );
  const [showNameModal, setShowNameModal] = useState<boolean>(() =>
    !sessionStorage.getItem("horario-session-name")
  );
  const [nameInput, setNameInput] = useState("");
  const [activePeers, setActivePeers] = useState<Array<{ name: string }>>([]);

  const sendHeartbeat = useCallback(async (name: string) => {
    try {
      await fetch(apiUrl("/api/schedule/presence"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name }),
      });
    } catch {}
  }, [sessionId]);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/schedule/presence"));
      if (!res.ok) return;
      const all: Array<{ name: string }> = await res.json();
      setActivePeers(all.filter(s => true));
    } catch {}
  }, []);

  const handleSetName = (name: string) => {
    const trimmed = name.trim() || "Secretaria";
    sessionStorage.setItem("horario-session-name", trimmed);
    setMyName(trimmed);
    setShowNameModal(false);
    sendHeartbeat(trimmed);
  };

  useEffect(() => {
    if (!myName) return;
    sendHeartbeat(myName);
    const hb = setInterval(() => sendHeartbeat(myName), 10_000);
    return () => clearInterval(hb);
  }, [myName, sendHeartbeat]);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 15_000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  // ── Indicadores de escritura en tiempo real ─────────────────────────────────
  const [typingMap, setTypingMap] = useState<Map<string, string>>(new Map());

  const fetchTyping = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/schedule/typing"));
      if (!res.ok) return;
      const all: Array<{ classCode: string; name: string }> = await res.json();
      const m = new Map<string, string>();
      for (const t of all) {
        if (t.name !== myName) m.set(t.classCode, t.name);
      }
      setTypingMap(m);
    } catch {}
  }, [myName]);

  useEffect(() => {
    const interval = setInterval(fetchTyping, 4_000);
    return () => clearInterval(interval);
  }, [fetchTyping]);

  const handleTypingStart = useCallback((classCode: string) => {
    if (!myName) return;
    fetch(apiUrl("/api/schedule/typing"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, classCode, name: myName }),
    }).catch(() => {});
  }, [sessionId, myName]);

  const handleTypingStop = useCallback(() => {
    fetch(apiUrl(`/api/schedule/typing/${sessionId}`), { method: "DELETE" }).catch(() => {});
  }, [sessionId]);
  // ────────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/schedule?horario=${horarioId}`));
      if (!res.ok) throw new Error("API error");
      const data: ClassEntry[] = await res.json();
      // NUNCA reemplazamos datos con un array vacío desde el servidor.
      // Si la API devuelve [] por error transitorio (cold-start de Railway,
      // timeout, etc.) simplemente conservamos los datos que ya teníamos.
      // El único caso donde se permite vaciar es "schedule_wiped" (ver SSE),
      // que llama setAllData([]) directamente antes de llamar fetchData.
      if (data.length > 0) {
        setAllData(data);
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [horarioId]);

  useEffect(() => {
    fetchData();
    // SSE para actualizaciones en tiempo real entre usuarios/sedes
    const es = new EventSource(apiUrl(`/api/schedule/stream?horarioId=${encodeURIComponent(horarioId)}`));
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data ?? "{}");
        if (msg.type === "schedule_wiped") {
          // Vaciado explícito: limpiamos inmediatamente y luego confirmamos
          // con un fetch (que también devolverá [] y será ignorado, ok).
          setAllData([]);
        }
      } catch { /* ignorar eventos malformados */ }
      fetchData();
    };
    // Poll de 30s como fallback si el SSE falla.
    // Si la API devuelve [] (error transitorio), los datos se conservan.
    const interval = setInterval(fetchData, 30_000);
    return () => { es.close(); clearInterval(interval); };
  }, [fetchData, horarioId]);

  const sedeData = useMemo(
    () => allData.filter(e => {
      if (e.sede !== activeSede) return false;
      if (activeTab === "PRIMER") return !e.semester || e.semester === "PRIMER" || e.semester === "ANUAL";
      if (activeTab === "SEGUNDO") return e.semester === "SEGUNDO" || e.semester === "ANUAL";
      return true;
    }),
    [allData, activeSede, activeTab]
  );

  const semesterAllData = useMemo(
    () => {
      if (activeTab === "PRIMER") return allData.filter(e => !e.semester || e.semester === "PRIMER" || e.semester === "ANUAL");
      if (activeTab === "SEGUNDO") return allData.filter(e => e.semester === "SEGUNDO" || e.semester === "ANUAL");
      return allData;
    },
    [allData, activeTab]
  );

  const gridData = useMemo(() => {
    return sedeData.filter(entry => {
      if (selectedTeacher && entry.teacher !== selectedTeacher) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          entry.course.toLowerCase().includes(q) ||
          entry.classCode.toLowerCase().includes(q) ||
          entry.teacher.toLowerCase().includes(q) ||
          entry.students.some(s => s.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [sedeData, selectedTeacher, search]);

  const filteredData = useMemo(() => {
    if (!selectedCourse) return gridData;
    return gridData.filter(entry => entry.course === selectedCourse);
  }, [gridData, selectedCourse]);

  const visibleDays = useMemo(
    () => DAYS.filter(d => selectedDays.includes(d)),
    [selectedDays]
  );

  const courses = useMemo(
    () => [...new Set(sedeData.map(e => e.course))].sort(),
    [sedeData]
  );

  const teachers = useMemo(
    () => [...new Set(sedeData.map(e => e.teacher))].sort(),
    [sedeData]
  );

  const hasFilters = !!(selectedCourse || selectedTeacher || search || selectedDays.length < DAYS.length);

  function clearFilters() {
    setSelectedCourse("");
    setSelectedTeacher("");
    setSearch("");
    setSelectedDays(DAYS);
  }

  function toggleDay(day: string) {
    setSelectedDays(prev => {
      const allSelected = prev.length === DAYS.length;
      if (allSelected) {
        return [day];
      }
      if (prev.includes(day)) {
        return prev.length > 1 ? prev.filter(d => d !== day) : DAYS;
      }
      return [...prev, day].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
    });
  }

  function getEntries(day: string, time: string, sala: number): ClassEntry[] {
    return gridData.filter(
      e => e.day === day && e.time === time && e.sala === sala
    );
  }

  const liveSelectedEntry = useMemo(() => {
    if (!selectedEntry) return null;
    return allData.find(e =>
      e.classCode === selectedEntry.classCode &&
      (e.semester ?? "PRIMER") === (selectedEntry.semester ?? "PRIMER")
    ) ?? null;
  }, [selectedEntry, allData]);

  const salasPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    const minSalas = SEDE_ROOMS_MIN[activeSede] ?? 1;
    for (const day of DAYS) {
      const dayEntries = sedeData.filter(e => e.day === day);
      const maxSala = dayEntries.reduce((mx, e) => Math.max(mx, e.sala), 0);
      map[day] = Math.max(maxSala, minSalas);
    }
    return map;
  }, [sedeData, activeSede]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasMoved = useRef(false);

  function handleMouseDown(e: React.MouseEvent) {
    if (!scrollRef.current) return;
    isDragging.current = true;
    hasMoved.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 4) hasMoved.current = true;
    scrollRef.current.scrollLeft = scrollStartX.current - dx;
  }
  function handleMouseUp() {
    if (!scrollRef.current) return;
    isDragging.current = false;
    scrollRef.current.style.cursor = "grab";
    scrollRef.current.style.removeProperty("user-select");
  }
  function handleClickCapture(e: React.MouseEvent) {
    if (hasMoved.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMoved.current = false;
    }
  }

  const totalStats = useMemo(() => ({
    classes: allData.length,
    students: [...new Set(allData.flatMap(e => e.students))].length,
    courses: [...new Set(allData.map(e => e.course))].length,
  }), [allData]);

  return (
    <div className="min-h-screen pb-24 md:pb-8">

      {/* ── Modal de nombre de sesión ──────────────────────────────────────── */}
      {showNameModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card rounded-3xl shadow-2xl border border-border/50 p-8 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-foreground text-lg">¿Cómo te identificas?</h2>
                <p className="text-xs text-muted-foreground">Se mostrará a las otras secretarias conectadas</p>
              </div>
            </div>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSetName(nameInput)}
              placeholder="Ej: María, Secretaria Las Encinas..."
              className="w-full px-4 py-3 text-sm border border-border rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground mb-4"
              maxLength={32}
            />
            <button
              onClick={() => handleSetName(nameInput)}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/90 transition-colors"
            >
              Entrar al horario
            </button>
          </div>
        </div>
      )}

      <div className="max-w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-1">Horarios</h1>
            <p className="text-muted-foreground text-sm">
              Haz clic en una celda para ver o gestionar alumnos.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Badge de presencia */}
            <div className="flex items-center gap-2">
              {activePeers.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    {activePeers.length === 1 ? "1 persona activa" : `${activePeers.length} personas activas`}
                  </span>
                  <span className="text-xs text-emerald-600 hidden sm:inline">
                    — {activePeers.map(p => p.name).join(", ")}
                  </span>
                </div>
              )}
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                Actualizado {lastUpdated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Cargando horarios...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Clases", value: totalStats.classes },
                { label: "Cursos", value: totalStats.courses },
                { label: "Alumnos", value: totalStats.students },
              ].map(({ label, value }) => (
                <div key={label} className="bg-card rounded-2xl border border-border/50 p-4 text-center shadow-sm">
                  <div className="text-2xl font-display font-bold text-primary">{value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/40">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar alumno o materia..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex rounded-xl overflow-hidden border border-border/60 shadow-sm">
                    {horario.sedes.map((sede) => (
                      <button
                        key={sede}
                        onClick={() => setActiveSede(sede)}
                        className={`px-5 py-2 text-sm font-semibold transition-colors ${
                          activeSede === sede
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {displaySede(sede)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={toggleNotifs}
                    title={notifsEnabled ? "Desactivar notificaciones para esta sede" : "Activar notificaciones para esta sede"}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      notifsEnabled
                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        : "bg-muted text-muted-foreground border-border/60 hover:bg-muted/80"
                    }`}
                  >
                    {notifsEnabled
                      ? <Bell className="w-3.5 h-3.5" />
                      : <BellOff className="w-3.5 h-3.5" />
                    }
                    <span className="hidden sm:inline">
                      {notifsEnabled ? "Notif. activas" : "Notif. desactivadas"}
                    </span>
                  </button>
                </div>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-destructive border border-destructive/20 rounded-xl bg-destructive/5 hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>

              {/* ── Pestañas Semestre / Talleres ── */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-muted/20">
                {([
                  { id: "PRIMER"   as const, label: "1er Semestre", Icon: Search },
                  { id: "SEGUNDO"  as const, label: "2do Semestre", Icon: Search },
                  { id: "talleres" as const, label: "Talleres",     Icon: GraduationCap },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeTab === id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab !== "talleres" && (
              <div className="divide-y divide-border/30">
                <div className="flex items-start gap-4 px-4 py-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pt-1 w-24 shrink-0">
                    Asignaturas
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {courses.map((c) => {
                      const colorClass = COURSE_SOLID_COLORS[c] ?? "bg-slate-500";
                      const isActive = selectedCourse === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setSelectedCourse(isActive ? "" : c)}
                          title={COURSE_FULL_NAMES[c] ?? c}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all duration-150 ${
                            isActive
                              ? `${colorClass} text-white border-transparent shadow-md scale-105`
                              : "bg-background border-border text-foreground/70 hover:text-foreground hover:border-primary/40 hover:bg-muted/50"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-24 shrink-0">
                    Días
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => setSelectedDays(DAYS)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all duration-150 ${
                        selectedDays.length === DAYS.length
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      Todos
                    </button>
                    <span className="w-px bg-border/60 self-stretch mx-0.5" />
                    {DAYS.map((day) => {
                      const allActive = selectedDays.length === DAYS.length;
                      const highlighted = !allActive && selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg border transition-all duration-150 ${
                            highlighted
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          {DAY_LABELS[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-start gap-4 px-4 py-3">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pt-1 w-24 shrink-0">
                    Profesor
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {teachers.map((t) => {
                      const isActive = selectedTeacher === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setSelectedTeacher(isActive ? "" : t)}
                          className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-150 ${
                            isActive
                              ? "bg-secondary text-secondary-foreground border-transparent shadow-md ring-2 ring-offset-1 ring-secondary"
                              : "bg-background text-muted-foreground border-border hover:border-secondary/60 hover:text-secondary"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              )}
            </div>

            {activeTab === "talleres" ? (
              <TalleresTab
                horarioId={horarioId}
                activeSede={activeSede}
                allSedes={horario.sedes}
                sedeDisplayName={displaySede}
              />
            ) : sedeData.length === 0 && !loading ? (
              <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
                <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Search className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-foreground text-lg">
                      {activeTab === "SEGUNDO" ? "El 2do semestre aún no tiene clases" : "No hay clases para este semestre"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      {activeTab === "SEGUNDO"
                        ? "Puedes copiar las clases del 1er semestre con un asistente que te muestra exactamente qué se va a copiar."
                        : "Crea clases desde el Panel Admin o importa un archivo Excel."}
                    </p>
                  </div>
                  {activeTab === "SEGUNDO" && (
                    <button
                      onClick={() => setLocation("/admin")}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Pasar clases al 2do semestre
                    </button>
                  )}
                </div>
              </div>
            ) : (
            <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-display font-bold text-foreground">
                  {displaySede(activeSede)} — Semana completa
                </span>
                <span className="ml-auto text-sm text-muted-foreground">
                  {filteredData.length} clase{filteredData.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1 ml-3 border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={zoomOut}
                    disabled={gridZoom <= 50}
                    className="px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
                    title="Reducir"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 py-1 text-xs font-semibold text-foreground tabular-nums select-none min-w-[38px] text-center border-x border-border">
                    {gridZoom}%
                  </span>
                  <button
                    onClick={zoomIn}
                    disabled={gridZoom >= 150}
                    className="px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30"
                    title="Ampliar"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="overflow-x-auto cursor-grab"
                style={{ zoom: `${gridZoom}%` }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClickCapture={handleClickCapture}
              >
                <table className="border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-30 bg-card border border-border px-2 py-2 text-center font-bold text-[11px] text-foreground w-[96px] min-w-[96px] align-middle"
                      >
                        Horario
                      </th>
                      {visibleDays.map((day) => (
                        <th
                          key={day}
                          colSpan={salasPerDay[day] || 1}
                          className="border border-border border-l-2 border-l-gray-900 px-2 py-2 text-center font-display font-bold text-[12px] text-primary bg-primary/10"
                        >
                          {DAY_LABELS[day]}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {visibleDays.map((day) =>
                        Array.from({ length: salasPerDay[day] || 1 }, (_, i) => (
                          <th
                            key={`${day}-sala-${i}`}
                            className={`border border-border px-1 py-1.5 text-center font-semibold text-[10px] text-muted-foreground bg-muted w-[110px] min-w-[110px] ${i === 0 ? "border-l-2 border-l-gray-900" : ""}`}
                          >
                            Sala {i + 1}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => {
                      const hasAny = visibleDays.some((day) =>
                        Array.from({ length: salasPerDay[day] || 1 }, (_, i) => getEntries(day, time, i + 1)).some(arr => arr.length > 0)
                      );
                      if (!hasAny && hasFilters) return null;
                      return (
                        <tr key={time}>
                          <td className="sticky left-0 z-10 bg-card border border-border px-2 py-1 text-center font-bold text-[10px] text-muted-foreground align-middle whitespace-nowrap w-[96px] min-w-[96px]">
                            {time}
                          </td>
                          {visibleDays.map((day) =>
                            Array.from({ length: salasPerDay[day] || 1 }, (_, i) => {
                              const entries = getEntries(day, time, i + 1);
                              const isConflict = entries.length > 1;
                              return (
                                <td key={`${day}-${i}`} className={`p-0 align-top w-[110px] min-w-[110px] ${
                                  isConflict
                                    ? "border-2 border-red-500 bg-red-50"
                                    : `border border-border ${i === 0 ? "border-l-2 border-l-gray-900" : ""}`
                                }`}>
                                  {entries.length > 0 ? (
                                    <div className={isConflict ? "flex flex-col gap-0.5" : ""}>
                                      {isConflict && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold leading-none">
                                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                          CONFLICTO DE SALA
                                        </div>
                                      )}
                                      {entries.map((entry) => (
                                        <ClassCell
                                          key={entry.classCode}
                                          entry={entry}
                                          onSelect={setSelectedEntry}
                                          selected={liveSelectedEntry?.classCode === entry.classCode && (liveSelectedEntry?.semester ?? "PRIMER") === (entry.semester ?? "PRIMER")}
                                          highlighted={!!selectedCourse && entry.course === selectedCourse}
                                          dimmed={!!selectedCourse && entry.course !== selectedCourse}
                                          typingBy={typingMap.get(entry.classCode)}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-1.5 text-center text-muted-foreground/20 text-[10px] select-none min-h-[28px]">
                                      —
                                    </div>
                                  )}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      {liveSelectedEntry && (
        <DetailPanel
          entry={liveSelectedEntry}
          allData={semesterAllData}
          onClose={() => setSelectedEntry(null)}
          onStudentChange={fetchData}
          sessionId={sessionId}
          myName={myName}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
        />
      )}
    </div>
  );
}
