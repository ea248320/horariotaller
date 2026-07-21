import { useState, useMemo, useEffect, useCallback } from "react";
import { BookOpen, Printer, Users, Hash, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import {
  DAYS,
  DAY_LABELS,
  COURSE_FULL_NAMES,
  COURSE_COLORS,
  type ClassEntry,
} from "@/data/schedule";
import { useHorario } from "@/context/HorarioContext";
import { useSemester } from "@/context/SemesterContext";
import { apiUrl } from "@/lib/api";

const SEDE_LABELS: Record<string, string> = {
  "LAS ENCINAS":    "Las Encinas",
  "INES DE SUAREZ": "Inés de Suárez",
  "D. ALMAGRO":     "D. Almagro",
  "VILLARRICA":     "Villarrica",
  "AV. ALEMANIA":   "Av. Alemania",
};
function displaySede(sede: string): string {
  return SEDE_LABELS[sede] ?? sede;
}

interface GuiaGroup {
  course: string;
  sede: string;
  clases: ClassEntry[];
  totalStudents: number;
}

export default function GuiasPage() {
  const { horarioId, horario } = useHorario();
  const [allData, setAllData]     = useState<ClassEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(DAYS[0]);
  // El semestre es global (interruptor en la barra superior)
  const { semester: selectedSemester } = useSemester();
  const [expandedSede, setExpandedSede] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(horario.sedes.map(s => [s, true]))
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/schedule?horario=${horarioId}`));
      if (!res.ok) throw new Error("API error");
      const data: ClassEntry[] = await res.json();
      setAllData(data);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [horarioId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const semesterData = useMemo(() => {
    if (selectedSemester === "PRIMER") {
      return allData.filter(c => !c.semester || c.semester === "PRIMER" || c.semester === "ANUAL");
    }
    return allData.filter(c => c.semester === "SEGUNDO" || c.semester === "ANUAL");
  }, [allData, selectedSemester]);

  const groupsBySede = useMemo<Record<string, GuiaGroup[]>>(() => {
    const dayClasses = semesterData.filter(c => c.day === selectedDay);
    const result: Record<string, GuiaGroup[]> = {};

    for (const sede of horario.sedes) {
      const sedeClasses = dayClasses.filter(c => c.sede === sede);
      const courseMap = new Map<string, ClassEntry[]>();
      for (const cls of sedeClasses) {
        if (!courseMap.has(cls.course)) courseMap.set(cls.course, []);
        courseMap.get(cls.course)!.push(cls);
      }
      const groups: GuiaGroup[] = [];
      for (const [course, clases] of courseMap) {
        const totalStudents = clases.reduce((sum, c) => sum + c.students.length, 0);
        groups.push({ course, sede, clases, totalStudents });
      }
      groups.sort((a, b) => {
        if (b.totalStudents !== a.totalStudents) return b.totalStudents - a.totalStudents;
        return a.course.localeCompare(b.course);
      });
      result[sede] = groups;
    }
    return result;
  }, [semesterData, selectedDay, horario.sedes]);

  useEffect(() => {
    setExpandedSede(Object.fromEntries(horario.sedes.map(s => [s, true])));
    setAllData([]);
    setLoading(true);
  }, [horarioId, horario.sedes]);

  const totalDayStudents = useMemo(() => {
    return horario.sedes.reduce((sum, sede) =>
      sum + (groupsBySede[sede] ?? []).reduce((s, g) => s + g.totalStudents, 0), 0
    );
  }, [groupsBySede, horario.sedes]);

  const totalDayGuides = useMemo(() => {
    return horario.sedes.reduce((sum, sede) =>
      sum + (groupsBySede[sede] ?? []).reduce((s, g) => s + g.totalStudents, 0), 0
    );
  }, [groupsBySede, horario.sedes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Printer className="w-8 h-8 text-primary" />
            Guías de Impresión
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cantidad de guías a imprimir por ramo, día y sede
          </p>
        </div>
        <div className="text-right">
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Actualizado {lastUpdated.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <button
            onClick={fetchData}
            className="mt-1 p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Indicador del semestre activo (se cambia en la barra superior) */}
      <div className="mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold ${
          selectedSemester === "SEGUNDO" ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"
        }`}>
          {selectedSemester === "SEGUNDO" ? "2do Semestre activado" : "1er Semestre activado"}
        </span>
      </div>

      {/* Selector de día */}
      <div className="flex gap-2 flex-wrap mb-6">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              selectedDay === day
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {DAY_LABELS[day]}
          </button>
        ))}
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Printer className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wide">Total guías</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{totalDayGuides}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{DAY_LABELS[selectedDay]}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="w-4 h-4 text-secondary" />
            <span className="text-xs font-medium uppercase tracking-wide">Alumnos</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{totalDayStudents}</p>
          <p className="text-xs text-muted-foreground mt-0.5">en el día</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Hash className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Clases</span>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">
            {semesterData.filter(c => c.day === selectedDay).length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">secciones activas</p>
        </div>
      </div>

      {/* Secciones por sede */}
      {horario.sedes.map(sede => {
        const groups = groupsBySede[sede] ?? [];
        const sedeTotal = groups.reduce((sum, g) => sum + g.totalStudents, 0);
        const expanded = expandedSede[sede] ?? true;

        return (
          <div key={sede} className="mb-6 rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Header de sede */}
            <button
              onClick={() => setExpandedSede(prev => ({ ...prev, [sede]: !prev[sede] }))}
              className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-8 rounded-full bg-gradient-to-b from-primary to-secondary" />
                <div className="text-left">
                  <h2 className="text-lg font-display font-bold text-foreground">
                    {displaySede(sede)}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {groups.length} ramos · {sedeTotal} guías en {displaySede(sede)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-2xl font-display font-bold text-primary">{sedeTotal}</p>
                  <p className="text-xs text-muted-foreground">guías totales</p>
                </div>
                {expanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Tabla de grupos */}
            {expanded && (
              groups.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                  Sin clases este día en esta sede
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {groups.map((group, idx) => {
                    const badge = COURSE_COLORS[group.course] ?? "bg-slate-100 text-slate-800 border-slate-200";
                    const hasStudents = group.totalStudents > 0;
                    return (
                      <div key={group.course} className={`flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/30 ${!hasStudents ? "opacity-50" : ""}`}>
                        {/* Número de fila */}
                        <span className="text-xs font-bold text-muted-foreground/50 w-5 shrink-0 text-right">
                          {idx + 1}
                        </span>

                        {/* Badge ramo */}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border shrink-0 min-w-[72px] justify-center ${badge}`}>
                          {group.course}
                        </span>

                        {/* Nombre completo */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {COURSE_FULL_NAMES[group.course] ?? group.course}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.clases.length} {group.clases.length === 1 ? "sección" : "secciones"} · profesores:{" "}
                            {[...new Set(group.clases.map(c => c.teacher))].join(", ")}
                          </p>
                        </div>

                        {/* Clases */}
                        <div className="text-center shrink-0 w-16">
                          <p className="text-lg font-display font-bold text-foreground">
                            {group.clases.length}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-tight">clases</p>
                        </div>

                        {/* Total alumnos = guías */}
                        <div className={`text-center shrink-0 w-20 rounded-xl px-3 py-1.5 ${
                          group.totalStudents === 0
                            ? "bg-muted"
                            : group.totalStudents >= 30
                            ? "bg-primary/10"
                            : "bg-emerald-50"
                        }`}>
                          <p className={`text-xl font-display font-bold ${
                            group.totalStudents === 0
                              ? "text-muted-foreground"
                              : group.totalStudents >= 30
                              ? "text-primary"
                              : "text-emerald-700"
                          }`}>
                            {group.totalStudents}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-tight flex items-center justify-center gap-0.5">
                            <Printer className="w-2.5 h-2.5" /> guías
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {/* Totalizador */}
                  <div className="flex items-center justify-between px-6 py-3 bg-muted/40">
                    <span className="text-sm font-semibold text-foreground">
                      Total {displaySede(sede)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-primary" />
                      <span className="text-lg font-display font-bold text-primary">
                        {sedeTotal} guías
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        );
      })}

      {/* Detalle por sección (expandible por ramo) */}
      <details className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
        <summary className="cursor-pointer px-6 py-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors select-none">
          <BookOpen className="w-4 h-4" />
          Ver detalle por sección ({DAY_LABELS[selectedDay]})
        </summary>
        <div className="divide-y divide-border">
          {semesterData
            .filter(c => c.day === selectedDay)
            .sort((a, b) => a.sede.localeCompare(b.sede) || a.course.localeCompare(b.course) || a.time.localeCompare(b.time))
            .map(cls => (
              <div key={cls.classCode} className="flex items-center gap-3 px-6 py-2.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${COURSE_COLORS[cls.course] ?? "bg-slate-100 text-slate-800 border-slate-200"}`}>
                  {cls.course}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{displaySede(cls.sede)}</span>
                <span className="text-xs text-muted-foreground">{cls.time}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">Prof. {cls.teacher}</span>
                <span className={`text-sm font-bold shrink-0 ${cls.students.length === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                  {cls.students.length} alumnos
                </span>
              </div>
            ))
          }
        </div>
      </details>
    </div>
  );
}
