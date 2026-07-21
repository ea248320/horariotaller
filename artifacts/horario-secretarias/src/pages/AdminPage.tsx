import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, RefreshCw, AlertTriangle, BookOpen,
  Search, X, CheckCircle, ChevronDown, Upload, FileSpreadsheet,
  Pencil, Check, Building2, ChevronRight, MapPin, Users, Sparkles,
} from "lucide-react";
import { UserAvatar, AVAILABLE_COLORS, USER_COLORS } from "@/context/UserContext";
import {
  DAYS, ALL_DAYS, DAY_LABELS, TIME_SLOTS, COURSE_FULL_NAMES,
  type ClassEntry,
} from "@/data/schedule";
import { useHorario } from "@/context/HorarioContext";
import { useSettings } from "@/context/SettingsContext";
import { useSemester } from "@/context/SemesterContext";
import { downloadBackup, shouldRemindBackup, snoozeBackupReminder } from "@/lib/backup";
import { apiUrl } from "@/lib/api";

const SEDE_DISPLAY: Record<string, string> = {
  "LAS ENCINAS": "Las Encinas",
  "INES DE SUAREZ": "Inés de Suárez",
  "D. ALMAGRO": "D. Almagro",
  "VILLARRICA": "Villarrica",
  "AV. ALEMANIA": "Av. Alemania",
};
function displaySede(sede: string): string {
  return SEDE_DISPLAY[sede] ?? sede;
}

const COURSES = Object.keys(COURSE_FULL_NAMES);

const COURSE_COLORS: Record<string, string> = {
  // Matemática
  "M1":       "bg-yellow-100 text-yellow-800 border-yellow-200",
  "M1 INT":   "bg-yellow-200 text-yellow-900 border-yellow-300",
  "M1 CONT":  "bg-yellow-300 text-yellow-900 border-yellow-400",
  "M2":       "bg-amber-100 text-amber-800 border-amber-200",
  "M2 INT":   "bg-amber-200 text-amber-900 border-amber-300",
  "MT":       "bg-lime-100 text-lime-800 border-lime-200",
  "MS":       "bg-amber-100 text-amber-900 border-amber-300",
  "MP":       "bg-yellow-50 text-yellow-700 border-yellow-200",
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

const DAY_SHORT: Record<string, string> = {
  LUNES: "LUN", MARTES: "MAR", MIERCOLES: "MIE", JUEVES: "JUE", VIERNES: "VIE",
};

function generateClassCode(course: string, day: string, time: string, teacher: string) {
  const dayShort = DAY_SHORT[day] ?? day.slice(0, 3);
  const timeShort = time.split(/[\s\-–]+/)[0].replace(":", ".");
  return `${course} ${dayShort} ${timeShort} ${teacher}`.toUpperCase();
}

async function apiCreateClass(data: {
  day: string; time: string; sede: string; sala: number; course: string; teacher: string; horario: string; semester: string;
}) {
  const res = await fetch(apiUrl("/api/schedule/classes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiUpdateClass(classCode: string, semester: string, horario: string, data: {
  course?: string; day?: string; time?: string; teacher?: string; sede?: string; sala?: number;
}) {
  const res = await fetch(apiUrl(`/api/schedule/classes/${encodeURIComponent(classCode)}?semester=${encodeURIComponent(semester)}&horario=${encodeURIComponent(horario)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiDeleteClass(classCode: string, semester: string, horario: string) {
  const res = await fetch(apiUrl(`/api/schedule/classes/${encodeURIComponent(classCode)}?semester=${encodeURIComponent(semester)}&horario=${encodeURIComponent(horario)}`), {
    method: "DELETE",
  });
  return res.json();
}

async function apiWipeCampus(horarioId: string) {
  const res = await fetch(apiUrl(`/api/schedule/classes?horario=${encodeURIComponent(horarioId)}`), { method: "DELETE" });
  return res.json();
}

const emptyForm = {
  sede: "" as string,
  course: "",
  day: "",
  time: "",
  sala: "",
  teacher: "",
  semester: "PRIMER" as string,
};

function CourseCombobox({
  value, onChange, options, placeholder = "Escribe o selecciona...", className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [inputVal, setInputVal] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input in sync when value changes externally
  useEffect(() => { setInputVal(value); }, [value]);

  const filtered = useMemo(() => {
    const q = inputVal.toLowerCase();
    if (!q) return options;
    return options.filter(c =>
      c.toLowerCase().includes(q) ||
      (COURSE_FULL_NAMES[c] ?? "").toLowerCase().includes(q)
    );
  }, [options, inputVal]);

  const exactMatch = options.some(c => c.toLowerCase() === inputVal.toLowerCase());
  const showCustom = inputVal.trim() && !exactMatch;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // Accept whatever is typed when clicking away
        const trimmed = inputVal.trim().toUpperCase();
        if (trimmed) onChange(trimmed);
        else setInputVal(value);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [inputVal, value, onChange]);

  function select(c: string) {
    onChange(c);
    setInputVal(c);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = inputVal.trim().toUpperCase();
      if (trimmed) { onChange(trimmed); setInputVal(trimmed); setOpen(false); }
    } else if (e.key === "Escape") {
      setInputVal(value);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex items-center border border-border rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          className="px-2 py-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {showCustom && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); select(inputVal.trim().toUpperCase()); }}
              className="w-full text-left px-3 py-2 text-sm border-b border-border hover:bg-primary/10 transition-colors flex items-center gap-2 text-primary font-semibold"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Usar "{inputVal.trim().toUpperCase()}"
            </button>
          )}
          {filtered.length === 0 && !showCustom ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map(c => (
              <button
                key={c}
                type="button"
                onMouseDown={e => { e.preventDefault(); select(c); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center gap-2 ${c === value ? "bg-primary/10 font-semibold text-primary" : "text-foreground"}`}
              >
                <span className="font-bold min-w-[3rem]">{c}</span>
                {COURSE_FULL_NAMES[c] && <span className="text-muted-foreground text-xs truncate">{COURSE_FULL_NAMES[c]}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recordatorio de respaldo (los datos viven en este navegador) ────────────
function BackupReminderBanner({ hasData }: { hasData: boolean }) {
  const { settings } = useSettings();
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (dismissed || !shouldRemindBackup(settings.lastBackupAt, hasData)) return null;

  return (
    <div className="mb-4 flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 flex-wrap">
      <span className="text-lg">💾</span>
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold text-sky-900">
          {settings.lastBackupAt ? "Hace más de 2 semanas del último respaldo" : "Aún no has descargado un respaldo"}
        </p>
        <p className="text-xs text-sky-700">
          Tus datos viven en este navegador: descarga un respaldo periódicamente para no perder nada.
        </p>
      </div>
      <button
        onClick={async () => { setDownloading(true); await downloadBackup(); setDownloading(false); setDismissed(true); }}
        disabled={downloading}
        className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-60"
      >
        {downloading ? "Descargando..." : "Descargar respaldo ahora"}
      </button>
      <button
        onClick={() => { snoozeBackupReminder(); setDismissed(true); }}
        className="px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 rounded-xl transition-colors"
      >
        Recordar en 7 días
      </button>
    </div>
  );
}

// ─── Datos de la plataforma (configuración vendible por cliente) ─────────────
function PlatformSettingsCard() {
  const { settings, updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(settings.platformName);
  const [subtitle, setSubtitle] = useState(settings.subtitle);
  const [days, setDays] = useState<string[]>(settings.days);
  const [slots, setSlots] = useState<string[]>(settings.timeSlots);
  const [newSlot, setNewSlot] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(settings.platformName);
    setSubtitle(settings.subtitle);
    setDays(settings.days);
    setSlots(settings.timeSlots);
  }, [settings]);

  const gridChanged =
    JSON.stringify(days) !== JSON.stringify(settings.days) ||
    JSON.stringify(slots) !== JSON.stringify(settings.timeSlots);

  function toggleDay(d: string) {
    setDays(prev => prev.includes(d)
      ? (prev.length > 1 ? prev.filter(x => x !== d) : prev)
      : ALL_DAYS.filter(x => [...prev, d].includes(x)));
  }

  function addSlot() {
    const s = newSlot.trim();
    if (!s || slots.includes(s)) return;
    setSlots(prev => [...prev, s]);
    setNewSlot("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const err = await updateSettings({ platformName: name, subtitle, days, timeSlots: slots });
    setSaving(false);
    if (err) { setError(err); return; }
    if (gridChanged) {
      // Los días/franjas se leen al cargar la app: recargar para aplicarlos
      window.location.reload();
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleBackup() {
    await downloadBackup();
  }

  async function handleRestoreFile(file: File) {
    setError("");
    try {
      const parsed = JSON.parse(await file.text());
      const res = await fetch(apiUrl("/api/backup/restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error ?? "No se pudo restaurar el respaldo"); return; }
      window.location.reload();
    } catch {
      setError("El archivo no es un respaldo válido");
    }
  }

  async function handleReset() {
    await fetch(apiUrl("/api/reset"), { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="mb-6 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <span className="font-semibold text-sm text-foreground">Datos de la plataforma</span>
          <span className="ml-2 text-xs text-muted-foreground">{settings.platformName}</span>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/50 p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Nombre de la plataforma / institución
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Preuniversitario Los Andes"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Subtítulo (se muestra en la portada)
              </label>
              <input
                value={subtitle}
                onChange={e => setSubtitle(e.target.value)}
                placeholder="Ej: Gestión de horarios y clases"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Días con clases
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    days.includes(d)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Franjas horarias de la grilla
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {slots.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-muted rounded-xl text-xs font-semibold text-foreground">
                  {t}
                  <button
                    onClick={() => slots.length > 1 && setSlots(prev => prev.filter(x => x !== t))}
                    className="p-0.5 rounded-md hover:bg-background text-muted-foreground hover:text-red-600"
                    title="Quitar franja"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSlot}
                onChange={e => setNewSlot(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addSlot(); }}
                placeholder="Ej: 08.00 - 09.00"
                className="flex-1 max-w-xs px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={addSlot}
                className="px-3 py-2 bg-muted rounded-xl text-sm font-semibold hover:bg-muted/70 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {gridChanged && (
              <p className="text-[11px] text-amber-600 mt-1.5">
                Al guardar cambios de días o franjas la página se recargará para aplicar la nueva grilla.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar"}
            </button>

            <span className="flex-1" />

            <button
              onClick={handleBackup}
              className="px-4 py-2.5 bg-muted rounded-xl font-semibold text-sm hover:bg-muted/70 transition-colors"
              title="Descarga un archivo con todos los datos de la plataforma"
            >
              Descargar respaldo
            </button>
            <button
              onClick={() => restoreInputRef.current?.click()}
              className="px-4 py-2.5 bg-muted rounded-xl font-semibold text-sm hover:bg-muted/70 transition-colors"
              title="Restaura los datos desde un archivo de respaldo"
            >
              Restaurar respaldo
            </button>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleRestoreFile(f); e.target.value = ""; }}
            />
            {confirmReset ? (
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span className="text-red-600 font-semibold">¿Borrar TODO?</span>
                <button onClick={handleReset} className="px-2.5 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700">Sí, borrar</button>
                <button onClick={() => setConfirmReset(false)} className="px-2.5 py-1.5 text-xs font-bold bg-muted rounded-lg">Cancelar</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="px-4 py-2.5 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-50 transition-colors"
                title="Borra todos los datos y deja la plataforma como nueva"
              >
                Restablecer plataforma
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { horarioId, horario, horarioList, reloadHorarios, setHorarioId } = useHorario();
  const { settings } = useSettings();
  // El semestre lo maneja el interruptor global (barra superior)
  const { semester } = useSemester();
  const filterSemester = semester;
  const [allData, setAllData] = useState<ClassEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // For the "Nueva Clase" form: which campus and which sede
  const defaultCampus = horarioList[0]?.id ?? horarioId;
  const [formHorario, setFormHorario] = useState(horarioId || defaultCampus);
  const formCampus = horarioList.find(h => h.id === formHorario) ?? horarioList[0] ?? horario;
  useEffect(() => {
    if (horarioId) {
      setFormHorario(horarioId);
      setForm(f => ({ ...f, sede: horario.sedes?.[0] ?? "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioId]);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    semester,
    sede: horarioList[0]?.sedes?.[0] ?? horario.sedes?.[0] ?? "",
  }));
  // La clase nueva se crea, por defecto, en el semestre activo global.
  useEffect(() => { setForm(f => ({ ...f, semester })); }, [semester]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState<{ deleted: number } | null>(null);
  const [search, setSearch] = useState("");
  // El Admin siempre trabaja sobre el campus activo (horarioId)
  const [filterSede, setFilterSede] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number; updated: number; skipped: number; totalStudents: number; parseErrors: string[];
    perCampus?: Record<string, { students: number; created: number }>;
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingSemester, setEditingSemester] = useState<string>("PRIMER");
  const [editingHorario, setEditingHorario] = useState<string>("");
  const [editForm, setEditForm] = useState({ ...emptyForm, sede: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [apiError, setApiError] = useState(false);

  const [campusOpen, setCampusOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{id:number;name:string;role:string;horarioId:string;color:string}>>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("secretaria");
  const [newMemberColor, setNewMemberColor] = useState("violet");
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [newCampusName, setNewCampusName] = useState("");
  const [newCampusSubtitle, setNewCampusSubtitle] = useState("");
  const [newCampusEmoji, setNewCampusEmoji] = useState("🏢");
  const [creatingCampus, setCreatingCampus] = useState(false);
  const [campusError, setCampusError] = useState("");
  const [deletingCampusId, setDeletingCampusId] = useState<string | null>(null);
  const [confirmDeleteCampus, setConfirmDeleteCampus] = useState<string | null>(null);
  const [confirmDeleteSede, setConfirmDeleteSede] = useState<string | null>(null);
  const [expandedCampus, setExpandedCampus] = useState<string | null>(null);
  const [newSedeName, setNewSedeName] = useState("");
  const [newSedeDisplay, setNewSedeDisplay] = useState("");
  const [newSedeMaxSalas, setNewSedeMaxSalas] = useState("6");
  const [addingSedeFor, setAddingSedeFor] = useState<string | null>(null);
  const [sedeError, setSedeError] = useState("");

  async function handleCreateCampus() {
    if (!newCampusName.trim()) { setCampusError("El nombre es requerido."); return; }
    setCreatingCampus(true); setCampusError("");
    try {
      const res = await fetch(apiUrl("/api/horarios"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCampusName, subtitle: newCampusSubtitle, emoji: newCampusEmoji }),
      });
      const json = await res.json();
      if (json.error) { setCampusError(json.error); return; }
      setNewCampusName(""); setNewCampusSubtitle(""); setNewCampusEmoji("🏢");
      await reloadHorarios();
    } catch { setCampusError("Error de conexión."); }
    finally { setCreatingCampus(false); }
  }

  async function handleDeleteCampus(id: string) {
    setDeletingCampusId(id);
    try {
      await fetch(apiUrl(`/api/horarios/${encodeURIComponent(id)}`), { method: "DELETE" });
      setConfirmDeleteCampus(null);
      await reloadHorarios();
    } catch { /* silent */ }
    finally { setDeletingCampusId(null); }
  }

  async function handleAddSede(horarioId: string) {
    if (!newSedeName.trim()) { setSedeError("Nombre interno requerido."); return; }
    setSedeError("");
    try {
      const res = await fetch(apiUrl(`/api/horarios/${encodeURIComponent(horarioId)}/sedes`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sedeName: newSedeName.trim().toUpperCase(),
          displayName: newSedeDisplay.trim() || newSedeName.trim(),
          maxSalas: Number(newSedeMaxSalas) || 6,
        }),
      });
      const json = await res.json();
      if (json.error) { setSedeError(json.error); return; }
      setNewSedeName(""); setNewSedeDisplay(""); setNewSedeMaxSalas("6");
      setAddingSedeFor(null);
      await reloadHorarios();
    } catch { setSedeError("Error de conexión."); }
  }

  async function handleDeleteSede(horarioId: string, sedeName: string) {
    try {
      await fetch(apiUrl(`/api/horarios/${encodeURIComponent(horarioId)}/sedes/${encodeURIComponent(sedeName)}`), {
        method: "DELETE",
      });
      await reloadHorarios();
    } catch { /* silent */ }
  }

  const fetchData = useCallback(async () => {
    if (!horarioId) { setAllData([]); setLoading(false); return; }
    try {
      const res = await fetch(apiUrl(`/api/schedule?horario=${encodeURIComponent(horarioId)}`));
      if (!res.ok) throw new Error("API error");
      const json = await res.json();
      setAllData(json);
      setApiError(false);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, [horarioId]);

  useEffect(() => {
    fetchData();
    if (!horarioId) return;
    // SSE: solo el campus que se está administrando
    const es = new EventSource(apiUrl(`/api/schedule/stream?horarioId=${encodeURIComponent(horarioId)}`));
    es.onmessage = () => fetchData();
    // Fallback poll cada 30s solo si SSE falla
    const interval = setInterval(fetchData, 30_000);
    return () => { es.close(); clearInterval(interval); };
  }, [fetchData, horarioId]);

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await fetch(apiUrl("/api/team"));
      const data = await res.json();
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setTeamLoading(false); }
  }, []);

  useEffect(() => { if (teamOpen) fetchTeam(); }, [teamOpen, fetchTeam]);

  async function handleAddMember() {
    if (!newMemberName.trim()) { setMemberError("El nombre es requerido."); return; }
    setAddingMember(true); setMemberError("");
    try {
      const res = await fetch(apiUrl("/api/team"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMemberName.trim(), role: newMemberRole, color: newMemberColor }),
      });
      if (!res.ok) throw new Error("Error al crear");
      const member = await res.json();
      setTeamMembers(prev => [...prev, member]);
      setNewMemberName(""); setNewMemberRole("secretaria"); setNewMemberColor("violet");
    } catch { setMemberError("No se pudo agregar el miembro."); }
    finally { setAddingMember(false); }
  }

  async function handleDeleteMember(id: number) {
    await fetch(apiUrl(`/api/team/${id}`), { method: "DELETE" });
    setTeamMembers(prev => prev.filter(m => m.id !== id));
  }

  // Keep formHorario in sync if horarioList changes (campus added/removed)
  useEffect(() => {
    if (horarioList.length > 0 && !horarioList.find(h => h.id === formHorario)) {
      const first = horarioList[0];
      setFormHorario(first.id);
      setForm(f => ({ ...f, sede: first.sedes?.[0] ?? "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horarioList]);

  const preview = useMemo(() => {
    if (!form.course || !form.day || !form.time || !form.teacher) return "";
    return generateClassCode(form.course, form.day, form.time, form.teacher);
  }, [form.course, form.day, form.time, form.teacher]);

  const filteredList = useMemo(() => {
    return allData.filter(e => {
      if (filterSede && e.sede !== filterSede) return false;
      if (filterCourse && e.course !== filterCourse) return false;
      // Semestre activo: PRIMER muestra PRIMER + anuales; SEGUNDO muestra SEGUNDO + anuales
      if (filterSemester === "PRIMER" && e.semester !== "PRIMER" && e.semester !== "ANUAL" && !!e.semester) return false;
      if (filterSemester === "SEGUNDO" && e.semester !== "SEGUNDO" && e.semester !== "ANUAL") return false;
      if (search) {
        const q = search.toLowerCase();
        const dayLabel = DAY_LABELS[e.day]?.toLowerCase() ?? e.day?.toLowerCase() ?? "";
        if (
          !e.classCode.toLowerCase().includes(q) &&
          !e.course.toLowerCase().includes(q) &&
          !e.teacher.toLowerCase().includes(q) &&
          !dayLabel.includes(q)
        ) return false;
      }
      return true;
    });
  }, [allData, filterSede, filterCourse, filterSemester, search]);

  const statsBySede = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of allData) {
      const key = e.sede ?? "?";
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [allData]);

  const existingCourses = useMemo(() => {
    let base = allData;
    if (filterSede)    base = base.filter(e => e.sede === filterSede);
    if (filterSemester === "PRIMER")  base = base.filter(e => !e.semester || e.semester === "PRIMER"  || e.semester === "ANUAL");
    if (filterSemester === "SEGUNDO") base = base.filter(e => e.semester === "SEGUNDO" || e.semester === "ANUAL");
    return [...new Set(base.map(e => e.course))].sort();
  }, [allData, filterSede, filterSemester]);

  const editSemesterCourses = useMemo(() => {
    if (!editingCode) return COURSES;
    const sem = editForm.semester || "PRIMER";
    const filtered = allData.filter(e =>
      e.semester === sem || e.semester === "ANUAL"
    );
    const unique = [...new Set(filtered.map(e => e.course))].sort();
    return unique.length > 0 ? unique : COURSES;
  }, [allData, editingCode, editForm.semester]);

  function setField(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setFormError("");
    setFormSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.course || !form.day || !form.time || !form.teacher || !form.sala) {
      setFormError("Completa todos los campos.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      const result = await apiCreateClass({
        day: form.day,
        time: form.time,
        sede: form.sede,
        sala: Number(form.sala),
        course: form.course,
        teacher: form.teacher,
        horario: formHorario,
        semester: form.semester || "PRIMER",
      });
      if (result.error === "duplicate") {
        setFormError(`Ya existe la clase "${result.message?.split('"')[1] ?? preview}".`);
      } else if (result.error) {
        setFormError(result.message ?? "Error al crear la clase.");
      } else {
        setFormSuccess(`Clase "${result.classCode}" creada correctamente.`);
        setForm(f => ({ ...f, course: "", teacher: "", sala: "" }));
        // Optimistic update — add the new class locally without a full refetch
        setAllData(prev => [...prev, {
          classCode: result.classCode,
          day: form.day,
          time: form.time,
          sede: form.sede,
          sala: Number(form.sala),
          teacher: form.teacher.toUpperCase(),
          course: form.course.toUpperCase(),
          horario: formHorario,
          semester: form.semester || "PRIMER",
          students: [],
        }]);
      }
    } catch {
      setFormError("Error de conexión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(classCode: string, semester: string, horario: string) {
    const key = `${classCode}|${semester}|${horario}`;
    setDeletingKey(key);
    try {
      await apiDeleteClass(classCode, semester, horario);
      // Optimistic update — remove locally without full refetch
      setAllData(prev => prev.filter(e => !(e.classCode === classCode && e.semester === semester && e.horario === horario)));
      setConfirmDeleteCode(null);
    } finally {
      setDeletingKey(null);
    }
  }

  function handleStartEdit(entry: ClassEntry) {
    if (editingCode === entry.classCode) {
      setEditingCode(null);
      return;
    }
    setEditForm({
      sede: entry.sede,
      course: entry.course,
      day: entry.day,
      time: entry.time,
      sala: String(entry.sala),
      teacher: entry.teacher,
      semester: entry.semester ?? "PRIMER",
    });
    setEditError("");
    setEditingCode(entry.classCode);
    setEditingSemester(entry.semester ?? "PRIMER");
    setEditingHorario(entry.horario ?? horarioId);
  }

  async function handleSaveEdit() {
    if (!editingCode) return;
    if (!editForm.course || !editForm.day || !editForm.time || !editForm.teacher || !editForm.sala) {
      setEditError("Completa todos los campos.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const result = await apiUpdateClass(editingCode, editingSemester, editingHorario, {
        course: editForm.course,
        day: editForm.day,
        time: editForm.time,
        teacher: editForm.teacher,
        sede: editForm.sede,
        sala: Number(editForm.sala),
      });
      if (result.error) {
        setEditError(result.error);
      } else {
        setEditingCode(null);
        // Optimistic update — patch the entry locally without full refetch
        const newCode = result.classCode as string;
        setAllData(prev => prev.map(e => {
          if (e.classCode !== editingCode || e.semester !== editingSemester) return e;
          return {
            ...e,
            classCode: newCode,
            course: editForm.course.toUpperCase(),
            day: editForm.day,
            time: editForm.time,
            teacher: editForm.teacher.toUpperCase(),
            sede: editForm.sede,
            sala: Number(editForm.sala),
            semester: editForm.semester || editingSemester,
          };
        }));
      }
    } catch {
      setEditError("Error de conexión.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleWipe() {
    setWiping(true);
    setWipeResult(null);
    try {
      const json = await apiWipeCampus(horarioId);
      if (!json.error) {
        setWipeResult(json);
        setConfirmWipe(false);
        fetchData();
      }
    } finally {
      setWiping(false);
    }
  }

  async function handleDownloadTemplate() {
    const XLSX = await import("xlsx");
    const sede = horario.sedes[0] ?? "SEDE 1";
    const dias = settings.days ?? ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
    const hora = (settings.timeSlots ?? ["09:00 - 10:00"])[0];
    // Filas de ejemplo para que se entienda el formato
    const ejemplo = [
      { Día: dias[0], Hora: hora, Sede: sede, Sala: 1, Curso: "Matemáticas", Profesor: "Juan Pérez", Alumno: "Ana Soto" },
      { Día: dias[0], Hora: hora, Sede: sede, Sala: 1, Curso: "Matemáticas", Profesor: "Juan Pérez", Alumno: "Luis Díaz" },
      { Día: dias[1] ?? dias[0], Hora: hora, Sede: sede, Sala: 2, Curso: "Lenguaje", Profesor: "María Rojas", Alumno: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(ejemplo, {
      header: ["Día", "Hora", "Sede", "Sala", "Curso", "Profesor", "Alumno"],
    });
    ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Horario");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plantilla_horario_${horario.label.replace(/\s+/g, "_")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setImportError("Solo se aceptan archivos Excel (.xlsx)");
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiUrl(`/api/schedule/import?horario=${encodeURIComponent(horarioId)}&semester=${encodeURIComponent(semester)}`), { method: "POST", body: formData });
      const json = await res.json();
      if (json.error) {
        setImportError(json.error);
      } else {
        setImportResult(json);
        fetchData();
      }
    } catch {
      setImportError("Error de conexión al importar.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-1">Panel Administrativo</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-muted-foreground text-sm">Estás administrando el campus:</p>
              <div className="relative">
                <select
                  value={horarioId}
                  onChange={e => setHorarioId(e.target.value)}
                  className="pl-3 pr-8 py-1.5 text-sm font-bold border border-primary/30 rounded-xl bg-primary/5 text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
                >
                  {horarioList.map(h => (
                    <option key={h.id} value={h.id}>{h.emoji} {h.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
              </div>
              <p className="text-muted-foreground text-xs">Todo lo que hagas aquí aplica solo a este campus.</p>
            </div>
          </div>

        </div>

        <BackupReminderBanner hasData={allData.length > 0} />

        {apiError && (
          <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-semibold text-amber-800">Conectando con el servidor...</span>
              <span className="text-xs text-amber-700 ml-2">El servidor está iniciando, los datos aparecerán en unos segundos.</span>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        <PlatformSettingsCard />

        {/* ── Gestión de Campus ─────────────────────────────────── */}
        <div className="mb-6 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setCampusOpen(o => !o)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-foreground">Gestionar Campus</span>
              <span className="ml-2 text-xs text-muted-foreground">{horarioList.length} campus configurados</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${campusOpen ? "rotate-90" : ""}`} />
          </button>

          {campusOpen && (
            <div className="border-t border-border/50 p-5 space-y-4">
              {/* Lista de campus existentes */}
              <div className="space-y-2">
                {horarioList.map(h => (
                  <div key={h.id} className="border border-border/60 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
                      <span className="text-lg">{h.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-foreground">{h.label}</span>
                        {h.subtitle && <span className="text-xs text-muted-foreground ml-2">{h.subtitle}</span>}
                        {h.isSystem && <span className="ml-2 text-[10px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md">Sistema</span>}
                      </div>
                      <button
                        onClick={() => setExpandedCampus(expandedCampus === h.id ? null : h.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                        title="Ver sedes"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                      {!h.isSystem && (
                        confirmDeleteCampus === h.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteCampus(h.id)}
                              disabled={deletingCampusId === h.id}
                              className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                            >
                              {deletingCampusId === h.id ? "..." : "Sí"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteCampus(null)}
                              className="px-2 py-1 text-xs font-bold bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteCampus(h.id)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                            title="Eliminar campus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>

                    {expandedCampus === h.id && (
                      <div className="px-4 pb-3 pt-2 bg-background border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Sedes</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(h.sedesInfo ?? h.sedes.map(s => ({ name: s, displayName: s, maxSalas: 6 }))).map(s => (
                            <div key={s.name} className="flex items-center gap-1.5 bg-muted/60 rounded-xl px-3 py-1.5 text-xs">
                              <span className="font-semibold text-foreground">{s.displayName}</span>
                              <span className="text-muted-foreground">({s.maxSalas} salas)</span>
                              {!h.isSystem && (
                                confirmDeleteSede === `${h.id}:${s.name}` ? (
                                  <div className="flex items-center gap-1 ml-1 animate-in fade-in duration-150">
                                    <button
                                      onClick={() => { handleDeleteSede(h.id, s.name); setConfirmDeleteSede(null); }}
                                      className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                    >
                                      Sí
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteSede(null)}
                                      className="px-1.5 py-0.5 text-[10px] font-bold bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteSede(`${h.id}:${s.name}`)}
                                    className="ml-0.5 text-muted-foreground hover:text-red-600 transition-colors"
                                    title="Eliminar sede"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )
                              )}
                            </div>
                          ))}
                        </div>

                        {addingSedeFor === h.id ? (
                          <div className="flex flex-wrap gap-2 items-end">
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">Nombre (interno)</label>
                              <input
                                value={newSedeName}
                                onChange={e => setNewSedeName(e.target.value)}
                                placeholder="Ej: NORTE"
                                className="h-8 px-2 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-28"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">Nombre visible</label>
                              <input
                                value={newSedeDisplay}
                                onChange={e => setNewSedeDisplay(e.target.value)}
                                placeholder="Ej: Sede Norte"
                                className="h-8 px-2 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-32"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">Salas</label>
                              <input
                                value={newSedeMaxSalas}
                                onChange={e => setNewSedeMaxSalas(e.target.value)}
                                type="number" min="1" max="20"
                                className="h-8 px-2 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-16"
                              />
                            </div>
                            <button
                              onClick={() => handleAddSede(h.id)}
                              className="h-8 px-3 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90"
                            >
                              Agregar
                            </button>
                            <button
                              onClick={() => { setAddingSedeFor(null); setSedeError(""); }}
                              className="h-8 px-3 text-xs font-semibold bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
                            >
                              Cancelar
                            </button>
                            {sedeError && <p className="text-xs text-red-600 w-full">{sedeError}</p>}
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAddingSedeFor(h.id); setNewSedeName(""); setNewSedeDisplay(""); setNewSedeMaxSalas("6"); setSedeError(""); }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar sede
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Formulario para nuevo campus */}
              <div className="border border-dashed border-border rounded-xl p-4">
                <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wide">Agregar nuevo campus</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Nombre *</label>
                    <input
                      value={newCampusName}
                      onChange={e => setNewCampusName(e.target.value)}
                      placeholder="Ej: Puerto Montt"
                      className="h-8 px-3 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Descripción</label>
                    <input
                      value={newCampusSubtitle}
                      onChange={e => setNewCampusSubtitle(e.target.value)}
                      placeholder="Ej: Sede Puerto Montt"
                      className="h-8 px-3 text-xs border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-44"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground block mb-1">Emoji</label>
                    <input
                      value={newCampusEmoji}
                      onChange={e => setNewCampusEmoji(e.target.value)}
                      placeholder="🏢"
                      className="h-8 px-2 text-base border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 w-14 text-center"
                    />
                  </div>
                  <button
                    onClick={handleCreateCampus}
                    disabled={creatingCampus}
                    className="h-8 flex items-center gap-1.5 px-4 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {creatingCampus ? "Creando..." : "Crear campus"}
                  </button>
                </div>
                {campusError && <p className="mt-2 text-xs text-red-600">{campusError}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-card rounded-2xl border border-border/50 p-4 text-center shadow-sm">
            <div className="text-2xl font-display font-bold text-primary">{allData.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Clases en {horario.label}</div>
          </div>
          {(horario.sedesInfo ?? horario.sedes.map(s => ({ name: s, displayName: displaySede(s), maxSalas: 6 }))).map(s => (
            <button
              key={s.name}
              onClick={() => setFilterSede(filterSede === s.name ? "" : s.name)}
              className={`rounded-2xl border p-4 text-center shadow-sm transition-all ${
                filterSede === s.name
                  ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30"
                  : "bg-card border-border/50 hover:border-primary/30 hover:bg-muted/40"
              }`}
            >
              <div className={`text-xl font-display font-bold ${filterSede === s.name ? "text-primary" : "text-secondary"}`}>
                {statsBySede[s.name] ?? 0}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.displayName}</div>
            </button>
          ))}
        </div>

        {/* ── Equipo Administrativo ───────────────────────────────── */}
        <div className="mb-6 bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setTeamOpen(o => !o)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-600" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-foreground">Equipo Administrativo</span>
              <span className="ml-2 text-xs text-muted-foreground">Usuarios que pueden ingresar a la app</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${teamOpen ? "rotate-90" : ""}`} />
          </button>

          {teamOpen && (
            <div className="border-t border-border/50 p-5 space-y-5">
              {/* Lista de miembros */}
              {teamLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Aún no hay miembros. Agrega el primero abajo.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teamMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                      <UserAvatar name={m.name} color={m.color} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{m.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(m.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Formulario agregar miembro */}
              <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agregar miembro</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={newMemberName}
                    onChange={e => { setNewMemberName(e.target.value); setMemberError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleAddMember()}
                    className="px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <select
                    value={newMemberRole}
                    onChange={e => setNewMemberRole(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="secretaria">Secretaria</option>
                    <option value="admin">Administrador</option>
                    <option value="orientadora">Orientadora</option>
                    <option value="invitado">Invitado</option>
                  </select>
                </div>
                {/* Color picker */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Color del avatar</p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_COLORS.map(color => {
                      const c = USER_COLORS[color];
                      return (
                        <button
                          key={color}
                          onClick={() => setNewMemberColor(color)}
                          className={`w-7 h-7 rounded-full ${c.bg} transition-all ${newMemberColor === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                          title={color}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* Preview */}
                {newMemberName.trim() && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserAvatar name={newMemberName} color={newMemberColor} size="sm" />
                    <span>Vista previa: <strong className="text-foreground">{newMemberName}</strong></span>
                  </div>
                )}
                {memberError && <p className="text-xs text-red-500">{memberError}</p>}
                <button
                  onClick={handleAddMember}
                  disabled={addingMember}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {addingMember ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Agregar al equipo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Importar desde Excel */}
        <div className="mb-6">
          <div
            className={`bg-card rounded-3xl border-2 border-dashed shadow-sm transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border/60"
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleImportFile(file);
            }}
          >
            <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display font-bold text-foreground">Importar desde Excel</h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Solo {horario.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Descarga la plantilla, complétala con tus columnas <strong>Día, Hora, Sede, Sala, Curso, Profesor y Alumno</strong>, y súbela.
                  Se cargará en el <strong>{semester === "SEGUNDO" ? "2do" : "1er"} semestre</strong> (el activo arriba) del campus <strong>{horario.label}</strong>, reemplazando lo que hubiera. El otro semestre y los demás campus no se tocan.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white border border-emerald-300 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Descargar plantilla
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleImportFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {importing
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Importando...</>
                    : <><Upload className="w-4 h-4" /> Subir archivo</>
                  }
                </button>
              </div>
            </div>

            {/* Resultado de importación */}
            {importResult && (
              <div className="px-6 pb-5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold text-emerald-800">Importación completada — {horario.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-5 text-sm">
                    <div><span className="font-bold text-emerald-700">{importResult.totalStudents}</span><span className="text-emerald-600"> alumnos procesados</span></div>
                    {importResult.created > 0 && (
                      <div><span className="font-bold text-emerald-700">{importResult.created}</span><span className="text-emerald-600"> clases nuevas</span></div>
                    )}
                    <div><span className="font-bold text-emerald-700">{importResult.updated}</span><span className="text-emerald-600"> clases actualizadas</span></div>
                    {importResult.skipped > 0 && (
                      <div><span className="font-bold text-amber-700">{importResult.skipped}</span><span className="text-amber-600"> omitidas</span></div>
                    )}
                  </div>
                  {importResult.perCampus && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {Object.entries(importResult.perCampus).map(([id, data]) => {
                        const labels: Record<string, string> = Object.fromEntries(horarioList.map(h => [h.id, h.label]));
                        return (
                          <div key={id} className="bg-white border border-emerald-200 rounded-xl px-3 py-2">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">{labels[id] ?? id}</p>
                            <p className="text-lg font-display font-bold text-foreground">{data.students}</p>
                            <p className="text-[10px] text-muted-foreground">alumnos · {data.created} clases</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {importResult.parseErrors.length > 0 && (
                    <details className="w-full">
                      <summary className="text-xs text-amber-700 cursor-pointer font-medium">
                        Ver clases omitidas ({importResult.parseErrors.length})
                      </summary>
                      <ul className="mt-2 space-y-0.5">
                        {importResult.parseErrors.map((c, i) => (
                          <li key={i} className="text-xs text-amber-600 font-mono">{c}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}
            {importError && (
              <div className="px-6 pb-5">
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-sm text-red-700 font-medium">{importError}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Vaciar horario (wipe) ────────────────────────────────────── */}
        <div className="mb-6">
          <div className="bg-card border border-red-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-display font-bold text-foreground">Vaciar horario</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Elimina <strong>todas las clases y alumnos de todos los semestres</strong> del campus {horario.label}. Los talleres y los demás campus no se tocan.
                </p>
              </div>
              <div className="shrink-0">
                {!confirmWipe ? (
                  <button
                    onClick={() => { setConfirmWipe(true); setWipeResult(null); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 border border-red-300 rounded-xl bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Vaciar horario
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="text-sm font-medium text-red-700">¿Confirmar borrado total?</span>
                    <button
                      onClick={handleWipe}
                      disabled={wiping}
                      className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      {wiping ? "Vaciando..." : "Sí, vaciar"}
                    </button>
                    <button
                      onClick={() => setConfirmWipe(false)}
                      className="px-3 py-1.5 text-xs font-bold bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>
            {wipeResult && (
              <div className="px-6 pb-5">
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-800 font-medium">
                    Horario vaciado — {wipeResult.deleted} clases eliminadas de este campus. Ya puedes subir el Excel.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-1">
            <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden sticky top-24">
              <div className="px-6 py-5 border-b border-border/50 bg-gradient-to-r from-primary/5 to-secondary/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-foreground">Nueva Clase</h2>
                    <p className="text-xs text-muted-foreground">Completa los campos para agregar</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Campus activo (fijo: el Admin trabaja por campus) */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Campus</label>
                  <div className="px-3 py-2.5 text-sm border border-border rounded-xl bg-muted/40 text-foreground font-semibold">
                    {horario.emoji} {horario.label}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Sede</label>
                  <div className="flex rounded-xl overflow-hidden border border-border/60">
                    {(formCampus?.sedes ?? []).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setField("sede", s)}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          form.sede === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {displaySede(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Semestre</label>
                  <div className="flex rounded-xl overflow-hidden border border-border/60">
                    {(["PRIMER", "SEGUNDO", "ANUAL"] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setField("semester", s)}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${
                          form.semester === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s === "PRIMER" ? "1er Sem." : s === "SEGUNDO" ? "2do Sem." : "Anual"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Asignatura</label>
                  <CourseCombobox
                    value={form.course}
                    onChange={v => setField("course", v)}
                    options={COURSES}
                    placeholder="Seleccionar asignatura..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Día</label>
                    <div className="relative">
                      <select
                        value={form.day}
                        onChange={e => setField("day", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none pr-8"
                      >
                        <option value="">Día...</option>
                        {DAYS.map(d => (
                          <option key={d} value={d}>{DAY_LABELS[d]}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Sala</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={form.sala}
                      onChange={e => setField("sala", e.target.value)}
                      placeholder="Nº sala"
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Horario</label>
                  <div className="relative">
                    <select
                      value={form.time}
                      onChange={e => setField("time", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none pr-8"
                    >
                      <option value="">Seleccionar horario...</option>
                      {TIME_SLOTS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Profesor (iniciales)</label>
                  <input
                    type="text"
                    value={form.teacher}
                    onChange={e => setField("teacher", e.target.value.toUpperCase())}
                    placeholder="Ej: JR, PF, DE..."
                    maxLength={4}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground uppercase"
                  />
                </div>

                {preview && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Código generado</div>
                    <div className="font-display font-bold text-primary text-sm">{preview}</div>
                  </div>
                )}

                {formError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 text-xs text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {formError}
                  </div>
                )}

                {formSuccess && (
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700">
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {formSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm shadow-primary/20"
                >
                  {submitting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Creando...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Crear clase</>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-card rounded-3xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
              <div className="px-6 py-5 border-b border-border/50 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-secondary" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-foreground">Todas las clases</h2>
                    <p className="text-xs text-muted-foreground">
                      {filteredList.length} de {allData.length} — campus {horario.label}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-b border-border/30 flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar clase, profesor, día..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                  />
                </div>
                {horario.sedes.length > 1 && (
                  <select
                    value={filterSede}
                    onChange={e => setFilterSede(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                  >
                    <option value="">Todas las sedes</option>
                    {horario.sedes.map(s => (
                      <option key={s} value={s}>{displaySede(s)}</option>
                    ))}
                  </select>
                )}
                <span className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold ${
                  semester === "SEGUNDO" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"
                }`}>
                  {semester === "SEGUNDO" ? "2do Semestre activado" : "1er Semestre activado"}
                </span>
                <select
                  value={filterCourse}
                  onChange={e => setFilterCourse(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                >
                  <option value="">Todos los cursos</option>
                  {existingCourses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {(search || filterSede || filterCourse) && (
                  <button
                    onClick={() => { setSearch(""); setFilterSede(""); setFilterCourse(""); }}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Limpiar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Cargando...
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <BookOpen className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No hay clases aún</p>
                  <p className="text-xs mt-1">Usa el formulario para crear las clases del año.</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[640px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-muted/70 border-b border-border/50 text-left">
                        <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Código</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sede</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Día</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Horario</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sala</th>
                        <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Prof.</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredList.map(entry => {
                        const rowKey = `${entry.classCode}|${entry.semester ?? "PRIMER"}`;
                        const badge = COURSE_COLORS[entry.course] ?? "bg-slate-100 text-slate-800 border-slate-200";
                        const confirmKey = `${entry.classCode}|${entry.semester ?? "PRIMER"}|${entry.horario ?? horarioId}`;
                        const isDeleting = deletingKey === confirmKey;
                        const isEditing = editingCode === entry.classCode && editingSemester === (entry.semester ?? "PRIMER");
                        const semBadge = entry.semester === "SEGUNDO"
                          ? "bg-purple-100 text-purple-700 border-purple-200"
                          : entry.semester === "ANUAL"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-blue-100 text-blue-700 border-blue-200";
                        const semLabel = entry.semester === "SEGUNDO" ? "2do" : entry.semester === "ANUAL" ? "Anual" : "1er";
                        return (
                          <React.Fragment key={rowKey}>
                          <tr className={`hover:bg-muted/30 transition-colors ${isDeleting ? "opacity-40" : ""} ${isEditing ? "bg-primary/5" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${badge}`}>
                                  {entry.course}
                                </span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${semBadge}`}>
                                  {semLabel}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 font-mono">{entry.classCode}</div>
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {displaySede(entry.sede)}
                            </td>
                            <td className="px-3 py-3 text-xs font-medium text-foreground whitespace-nowrap">
                              {DAY_LABELS[entry.day] ?? entry.day}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{entry.time}</td>
                            <td className="px-3 py-3 text-xs text-center font-semibold text-foreground">{entry.sala}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-muted text-xs font-bold text-foreground">
                                {entry.teacher}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {confirmDeleteCode === confirmKey ? (
                                  <div className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-xl px-2.5 py-1.5">
                                    <span className="text-[11px] font-semibold text-destructive whitespace-nowrap">¿Eliminar?</span>
                                    <button
                                      onClick={() => { handleDelete(entry.classCode, entry.semester ?? "PRIMER", entry.horario ?? horarioId); setConfirmDeleteCode(null); }}
                                      disabled={isDeleting}
                                      className="px-2 py-0.5 text-[11px] font-bold bg-destructive text-white rounded-lg hover:bg-destructive/80 transition-colors disabled:opacity-60"
                                    >
                                      {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Sí"}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteCode(null)}
                                      className="px-2 py-0.5 text-[11px] font-bold bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleStartEdit(entry)}
                                      disabled={isDeleting}
                                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${isEditing ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                                      title="Editar clase"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => { setConfirmDeleteCode(confirmKey); setEditingCode(null); }}
                                      disabled={isDeleting}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                                      title="Eliminar clase"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr className="bg-primary/5 border-b border-primary/20">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="flex flex-wrap gap-2 items-end">
                                  {(() => {
                                    const entryCampus = horarioList.find(h => h.id === entry.horario);
                                    const sedes = entryCampus?.sedes ?? [];
                                    return sedes.length > 1 ? (
                                      <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sede</label>
                                        <select value={editForm.sede} onChange={e => setEditForm(f => ({ ...f, sede: e.target.value }))}
                                          className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                                          {sedes.map(s => <option key={s} value={s}>{displaySede(s)}</option>)}
                                        </select>
                                      </div>
                                    ) : null;
                                  })()}
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Curso</label>
                                    <CourseCombobox
                                      value={editForm.course}
                                      onChange={v => setEditForm(f => ({ ...f, course: v }))}
                                      options={editSemesterCourses}
                                      placeholder="Curso..."
                                      className="text-xs"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Día</label>
                                    <select value={editForm.day} onChange={e => setEditForm(f => ({ ...f, day: e.target.value }))}
                                      className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                                      <option value="">Día...</option>
                                      {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Horario</label>
                                    <select value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                                      className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground">
                                      <option value="">Horario...</option>
                                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sala</label>
                                    <input type="number" min={1} max={10} value={editForm.sala}
                                      onChange={e => setEditForm(f => ({ ...f, sala: e.target.value }))}
                                      className="w-16 px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Prof.</label>
                                    <input type="text" value={editForm.teacher} maxLength={4}
                                      onChange={e => setEditForm(f => ({ ...f, teacher: e.target.value.toUpperCase() }))}
                                      className="w-16 px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase" />
                                  </div>
                                  <div className="flex gap-1 ml-1">
                                    <button onClick={handleSaveEdit} disabled={savingEdit}
                                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                                      {savingEdit ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                      Guardar
                                    </button>
                                    <button onClick={() => setEditingCode(null)}
                                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors">
                                      <X className="w-3 h-3" /> Cancelar
                                    </button>
                                  </div>
                                  {editError && (
                                    <div className="w-full text-xs text-destructive font-medium flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> {editError}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
