import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardCheck, Check, X, Users, RefreshCw, CalendarDays } from "lucide-react";
import { useHorario } from "@/context/HorarioContext";
import { useSemester } from "@/context/SemesterContext";
import { DAYS, DAY_LABELS, COURSE_FULL_NAMES, type ClassEntry } from "@/data/schedule";
import { apiUrl } from "@/lib/api";

const DAY_KEYS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

interface AsistRow { classCode: string; studentName: string; presente: boolean; }

function matchesSemester(c: ClassEntry, semester: "PRIMER" | "SEGUNDO"): boolean {
  if (semester === "PRIMER") return !c.semester || c.semester === "PRIMER" || c.semester === "ANUAL";
  return c.semester === "SEGUNDO" || c.semester === "ANUAL";
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AsistenciaPage() {
  const { horarioId, horario } = useHorario();
  const { semester } = useSemester();
  const [fecha, setFecha] = useState<string>(todayISO());
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [asist, setAsist] = useState<Record<string, boolean>>({}); // key: classCode|studentName
  const [loading, setLoading] = useState(true);
  const [sede, setSede] = useState<string>(() => horario.sedes[0]);

  const dayOfFecha = DAY_KEYS[new Date(fecha + "T12:00:00").getDay()];

  const key = (classCode: string, student: string) => `${classCode}|${student}`;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, marks] = await Promise.all([
        fetch(apiUrl(`/api/schedule?horario=${encodeURIComponent(horarioId)}`)).then(r => r.json()).catch(() => []),
        fetch(apiUrl(`/api/asistencia?horario=${encodeURIComponent(horarioId)}&fecha=${fecha}`)).then(r => r.json()).catch(() => []),
      ]);
      setClasses(Array.isArray(sched) ? sched : []);
      const map: Record<string, boolean> = {};
      if (Array.isArray(marks)) {
        for (const m of marks as AsistRow[]) map[key(m.classCode, m.studentName)] = m.presente;
      }
      setAsist(map);
    } finally {
      setLoading(false);
    }
  }, [horarioId, fecha]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { setSede(horario.sedes[0]); }, [horarioId, horario.sedes]);

  // Clases de la fecha elegida (día de la semana), sede y semestre activos
  const dayClasses = useMemo(() => {
    return classes
      .filter(c => c.day === dayOfFecha && c.sede === sede && matchesSemester(c, semester) && (c.students?.length ?? 0) > 0)
      .sort((a, b) => a.time.localeCompare(b.time) || a.course.localeCompare(b.course));
  }, [classes, dayOfFecha, sede, semester]);

  async function mark(c: ClassEntry, student: string, presente: boolean | null) {
    const k = key(c.classCode, student);
    setAsist(prev => {
      const next = { ...prev };
      if (presente === null) delete next[k]; else next[k] = presente;
      return next;
    });
    await fetch(apiUrl("/api/asistencia"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        horario: horarioId, semester: c.semester ?? semester,
        classCode: c.classCode, fecha, studentName: student, presente,
      }),
    }).catch(() => {});
  }

  const isToday = fecha === todayISO();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <ClipboardCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Asistencia</h1>
          <p className="text-sm text-muted-foreground">Pasa lista de las clases del día en {horario.label}.</p>
        </div>
      </div>

      {/* Controles: fecha + sede */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isToday ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>
            {isToday ? "Hoy" : ""} {DAY_LABELS[dayOfFecha] ?? dayOfFecha}
          </span>
        </div>
        {horario.sedes.length > 1 && (
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {horario.sedes.map(s => (
              <button
                key={s}
                onClick={() => setSede(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  sede === s ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <button onClick={fetchAll} className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !DAYS.includes(dayOfFecha) ? (
        <EmptyBox text={`${DAY_LABELS[dayOfFecha] ?? dayOfFecha} no es un día con clases configurado.`} />
      ) : dayClasses.length === 0 ? (
        <EmptyBox text="No hay clases con alumnos para este día y sede." />
      ) : (
        <div className="space-y-4">
          {dayClasses.map(c => {
            const presentes = c.students.filter(s => asist[key(c.classCode, s)] === true).length;
            const ausentes = c.students.filter(s => asist[key(c.classCode, s)] === false).length;
            const sinMarcar = c.students.length - presentes - ausentes;
            return (
              <div key={`${c.classCode}|${c.semester}`} className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{COURSE_FULL_NAMES[c.course] ?? c.course}</p>
                    <p className="text-xs text-muted-foreground">{c.time} · Sala {c.sala} · Prof. {c.teacher}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="w-3.5 h-3.5" />{presentes}</span>
                    <span className="inline-flex items-center gap-1 text-red-600"><X className="w-3.5 h-3.5" />{ausentes}</span>
                    {sinMarcar > 0 && <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="w-3.5 h-3.5" />{sinMarcar}</span>}
                  </div>
                </div>
                <div className="divide-y divide-border/30">
                  {c.students.map(student => {
                    const st = asist[key(c.classCode, student)];
                    return (
                      <div key={student} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="flex-1 text-sm text-foreground truncate">{student}</span>
                        <button
                          onClick={() => mark(c, student, st === true ? null : true)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            st === true ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-emerald-100 hover:text-emerald-700"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Presente
                        </button>
                        <button
                          onClick={() => mark(c, student, st === false ? null : false)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            st === false ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-700"
                          }`}
                        >
                          <X className="w-3.5 h-3.5" /> Ausente
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground text-sm">
      {text}
    </div>
  );
}
