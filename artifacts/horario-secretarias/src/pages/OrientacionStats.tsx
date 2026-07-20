import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  TrendingUp, Users, CheckCircle, RefreshCw, XCircle,
  Search, ChevronDown, ChevronUp, Award, UserCheck,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cita {
  id: number;
  orientadoraId: number;
  nombreEstudiante: string;
  agendadoPor: string;
  fecha: string;
  horaInicio: string;
  motivo: string | null;
  estadoConfirma: string;
  estadoAsiste: string;
  notaRapida: string | null;
  dadoDeAlta: boolean;
}

interface EstadoDB { id: number; tipo: string; label: string; color: string; orden: number; }
interface Orientadora { id: number; nombre: string; titulo: string; }

interface StudentSummary {
  nombre: string;
  totalCitas: number;
  citasAsistidas: number;
  primeraCita: string;
  ultimaCita: string;
  ultimoEstado: string;
  dadoDeAlta: boolean;
  motivos: string[];
  historial: Cita[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DOW_LABELS: Record<string, string> = {
  lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue", viernes:"Vie",
};
const DOW_NAMES = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
const DOW_ORDER = ["lunes","martes","miercoles","jueves","viernes"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}
function getDOW(fecha: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  return DOW_NAMES[new Date(y, m - 1, d).getDay()];
}
function fmtFecha(f: string) {
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function colorStyle(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { backgroundColor: `rgba(${r},${g},${b},0.15)`, color: hex };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, icon: Icon,
}: { label: string; value: string | number; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-foreground leading-none">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-sm">
      {label !== undefined && <p className="font-bold text-foreground mb-1">{String(label)}</p>}
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="font-black">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// ─── Student Row (expandible) ─────────────────────────────────────────────────

function StudentRow({
  s, rank, estados,
}: { s: StudentSummary; rank: number; estados: EstadoDB[] }) {
  const [open, setOpen] = useState(false);
  const confirmColor = estados.find(e => e.label === s.ultimoEstado)?.color ?? "#94a3b8";

  return (
    <>
      <tr
        className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer group"
        onClick={() => setOpen(v => !v)}
      >
        {/* Rank */}
        <td className="py-2 pl-3 pr-2 text-center">
          <span className={`text-[11px] font-black w-6 h-6 rounded-full inline-flex items-center justify-center ${
            rank === 1 ? "bg-amber-100 text-amber-700" :
            rank === 2 ? "bg-slate-100 text-slate-600" :
            rank === 3 ? "bg-orange-100 text-orange-700" :
            "text-muted-foreground"
          }`}>{rank}</span>
        </td>
        {/* Nombre */}
        <td className="py-2 px-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
              {s.nombre[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{s.nombre}</p>
              {s.motivos.length > 0 && (
                <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                  {s.motivos[0]}
                </p>
              )}
            </div>
          </div>
        </td>
        {/* Sesiones */}
        <td className="py-2 px-2 text-center">
          <span className="text-sm font-black text-foreground">{s.totalCitas}</span>
          <span className="text-[10px] text-muted-foreground"> total</span>
        </td>
        {/* Asistidas */}
        <td className="py-2 px-2 text-center">
          <span className="text-sm font-bold text-emerald-600">{s.citasAsistidas}</span>
          <span className="text-[10px] text-muted-foreground">
            {" "}({pct(s.citasAsistidas, s.totalCitas)})
          </span>
        </td>
        {/* Primera / Última */}
        <td className="py-2 px-2 text-center text-[11px] text-muted-foreground">
          <p>{fmtFecha(s.primeraCita)}</p>
          <p className="font-medium text-foreground">{fmtFecha(s.ultimaCita)}</p>
        </td>
        {/* Estado */}
        <td className="py-2 px-2">
          <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 capitalize"
            style={colorStyle(confirmColor)}>{s.ultimoEstado}</span>
        </td>
        {/* Alta */}
        <td className="py-2 px-2 text-center">
          {s.dadoDeAlta ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
              <UserCheck className="w-3 h-3" /> Alta
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">—</span>
          )}
        </td>
        {/* Expand */}
        <td className="py-2 pr-3 text-center text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
        </td>
      </tr>

      {/* Historial expandido */}
      {open && (
        <tr>
          <td colSpan={8} className="bg-muted/20 border-b border-border/40">
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Historial de sesiones — {s.nombre}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left py-1 pr-3 font-semibold">Fecha</th>
                      <th className="text-left py-1 pr-3 font-semibold">Hora</th>
                      <th className="text-left py-1 pr-3 font-semibold">Confirma</th>
                      <th className="text-left py-1 pr-3 font-semibold">Asiste</th>
                      <th className="text-left py-1 pr-3 font-semibold">Motivo</th>
                      <th className="text-left py-1 pr-3 font-semibold">Nota</th>
                      <th className="text-left py-1 font-semibold">Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.historial.map(c => {
                      const cc = estados.find(e => e.label === c.estadoConfirma)?.color ?? "#94a3b8";
                      const ac = estados.find(e => e.label === c.estadoAsiste)?.color ?? "#94a3b8";
                      return (
                        <tr key={c.id} className="border-t border-border/30 hover:bg-muted/30">
                          <td className="py-1.5 pr-3 font-medium">{fmtFecha(c.fecha)}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{c.horaInicio}</td>
                          <td className="py-1.5 pr-3">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                              style={colorStyle(cc)}>{c.estadoConfirma}</span>
                          </td>
                          <td className="py-1.5 pr-3">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                              style={colorStyle(ac)}>{c.estadoAsiste}</span>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground max-w-[160px] truncate">{c.motivo || "—"}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground max-w-[160px] truncate italic">{c.notaRapida || "—"}</td>
                          <td className="py-1.5">
                            {c.dadoDeAlta
                              ? <span className="text-emerald-600 font-bold">✓ Alta</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Stats Component ─────────────────────────────────────────────────────

export default function OrientacionStats({
  orientadoras,
  selectedId,
  onSelectId,
}: {
  orientadoras: Orientadora[];
  selectedId: number | null;
  onSelectId: (id: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [año, setAño] = useState(String(currentYear));
  const [citas, setCitas] = useState<Cita[]>([]);
  const [estados, setEstados] = useState<EstadoDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"sesiones"|"nombre"|"ultima">("sesiones");
  const [filterAlta, setFilterAlta] = useState<"todos"|"alta"|"activos">("todos");
  const [activeTab, setActiveTab] = useState<"resumen"|"estudiantes">("resumen");

  // Cargar estados dinámicos
  useEffect(() => {
    fetch(apiUrl("/api/orientacion/estados"))
      .then(r => r.ok ? r.json() : [])
      .then(setEstados)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    const params = new URLSearchParams({ orientadoraId: String(selectedId) });
    if (año !== "todas") params.set("año", año);
    fetch(apiUrl(`/api/orientacion/citas/all?${params}`))
      .then(r => r.ok ? r.json() : [])
      .then(data => { setCitas(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedId, año]);

  // ── Paleta dinámica de estados ──────────────────────────────────────────────
  const confirmaColors = useMemo(() => {
    const m: Record<string, string> = {};
    estados.filter(e => e.tipo === "confirma").forEach(e => { m[e.label] = e.color; });
    return m;
  }, [estados]);
  const asisteColors = useMemo(() => {
    const m: Record<string, string> = {};
    estados.filter(e => e.tipo === "asiste").forEach(e => { m[e.label] = e.color; });
    return m;
  }, [estados]);

  // ── Resumen agregado ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = citas.length;
    const confirmaCount: Record<string, number> = {};
    const asisteCount: Record<string, number> = {};
    const byMes: Record<string, number> = {};
    const byDow: Record<string, number> = {};
    const byHora: Record<string, number> = {};
    const byQuien: Record<string, number> = {};

    for (const c of citas) {
      confirmaCount[c.estadoConfirma] = (confirmaCount[c.estadoConfirma] ?? 0) + 1;
      asisteCount[c.estadoAsiste]     = (asisteCount[c.estadoAsiste] ?? 0) + 1;
      byMes[c.fecha.slice(0, 7)]     = (byMes[c.fecha.slice(0, 7)] ?? 0) + 1;
      const dow = getDOW(c.fecha);
      byDow[dow]               = (byDow[dow] ?? 0) + 1;
      byHora[c.horaInicio]     = (byHora[c.horaInicio] ?? 0) + 1;
      const quien = c.agendadoPor?.trim() || "Sin registrar";
      byQuien[quien]           = (byQuien[quien] ?? 0) + 1;
    }

    const asisten   = asisteCount["asiste"] ?? 0;
    const noAsisten = asisteCount["no asiste"] ?? 0;
    const confirman = confirmaCount["confirma"] ?? 0;
    const reagendan = confirmaCount["reagenda"] ?? 0;
    const cancelan  = confirmaCount["cancela"] ?? 0;
    const asistenBase = asisten + noAsisten;

    const byMesData = Object.entries(byMes)
      .sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([key, count]) => ({
        mes: MONTH_NAMES[parseInt(key.split("-")[1]) - 1] + " " + key.split("-")[0].slice(2),
        citas: count,
      }));

    const byDowData = DOW_ORDER.filter(d => byDow[d])
      .map(d => ({ dia: DOW_LABELS[d] ?? d, citas: byDow[d] }));

    const byHoraData = Object.entries(byHora)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hora, citas]) => ({ hora, citas }));

    const byQuienData = Object.entries(byQuien)
      .sort(([, a], [, b]) => b - a).slice(0, 8)
      .map(([nombre, citas]) => ({ nombre: nombre.split(" ")[0], citas }));

    const confirmaData = Object.entries(confirmaCount).map(([name, value]) => ({ name, value }));
    const asisteData   = Object.entries(asisteCount).map(([name, value]) => ({ name, value }));

    return {
      total, asisten, noAsisten, confirman, reagendan, cancelan,
      tasaAsistencia: asistenBase ? pct(asisten, asistenBase) : "—",
      tasaConfirmacion: total ? pct(confirman, total) : "—",
      byMesData, byDowData, byHoraData, byQuienData,
      confirmaData, asisteData,
    };
  }, [citas]);

  // ── Análisis por estudiante ─────────────────────────────────────────────────
  const students = useMemo((): StudentSummary[] => {
    const map = new Map<string, Cita[]>();
    for (const c of citas) {
      const key = c.nombreEstudiante.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([, list]) => {
      const sorted = [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));
      const last = sorted[sorted.length - 1];
      const asistidas = list.filter(c => c.estadoAsiste === "asiste").length;
      const alta = list.some(c => c.dadoDeAlta);
      const motivos = [...new Set(list.map(c => c.motivo).filter(Boolean) as string[])];
      return {
        nombre: last.nombreEstudiante,
        totalCitas: list.length,
        citasAsistidas: asistidas,
        primeraCita: sorted[0].fecha,
        ultimaCita: last.fecha,
        ultimoEstado: last.estadoConfirma,
        dadoDeAlta: alta,
        motivos,
        historial: sorted,
      };
    });
  }, [citas]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s => s.nombre.toLowerCase().includes(q));
    }
    if (filterAlta === "alta")    list = list.filter(s => s.dadoDeAlta);
    if (filterAlta === "activos") list = list.filter(s => !s.dadoDeAlta);
    return [...list].sort((a, b) => {
      if (sortBy === "sesiones") return b.totalCitas - a.totalCitas;
      if (sortBy === "nombre")   return a.nombre.localeCompare(b.nombre);
      return b.ultimaCita.localeCompare(a.ultimaCita);
    });
  }, [students, search, sortBy, filterAlta]);

  const studentStats = useMemo(() => {
    const total = students.length;
    const recurrentes = students.filter(s => s.totalCitas >= 3).length;
    const dados = students.filter(s => s.dadoDeAlta).length;
    const promedio = total ? (students.reduce((s, e) => s + e.totalCitas, 0) / total).toFixed(1) : "0";
    return { total, recurrentes, dados, promedio };
  }, [students]);

  const años = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-5">
      {/* Orientadora selector + año */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto">
          {orientadoras.map(o => (
            <button key={o.id} onClick={() => onSelectId(o.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                selectedId === o.id
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent"
              }`}>
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {o.nombre[0]}
              </div>
              {o.nombre}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Año:</span>
          <select value={año} onChange={e => setAño(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
            <option value="todas">Todos</option>
            {años.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : citas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">Sin datos para mostrar</p>
          <p className="text-xs text-muted-foreground/70">
            Aún no hay citas registradas para esta orientadora{año !== "todas" ? ` en ${año}` : ""}.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tabs Resumen / Estudiantes ── */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
            {([["resumen","📊 Resumen"],["estudiantes","👥 Por estudiante"]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>{label}</button>
            ))}
          </div>

          {activeTab === "resumen" && (
            <>
              {/* ── Summary cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total citas" value={stats.total} color="bg-primary/10 text-primary" icon={Users} />
                <StatCard label="Estudiantes" value={studentStats.total}
                  sub={`${studentStats.recurrentes} con 3+ sesiones`}
                  color="bg-violet-100 text-violet-700" icon={Users} />
                <StatCard label="Asistencia" value={stats.tasaAsistencia}
                  sub={`${stats.asisten} de ${stats.asisten + stats.noAsisten} resueltas`}
                  color="bg-emerald-100 text-emerald-700" icon={CheckCircle} />
                <StatCard label="Confirman" value={stats.tasaConfirmacion}
                  sub={`${stats.confirman} confirmadas`}
                  color="bg-green-100 text-green-700" icon={CheckCircle} />
                <StatCard label="Reagendan" value={stats.reagendan}
                  color="bg-blue-100 text-blue-700" icon={RefreshCw} />
                <StatCard label="Dados de alta" value={studentStats.dados}
                  sub={`${pct(studentStats.dados, studentStats.total)} del total`}
                  color="bg-teal-100 text-teal-700" icon={Award} />
              </div>

              {/* ── Distribución estado confirma + asiste ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Section title="📋 Estado de confirmación">
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width="55%" height={160}>
                      <PieChart>
                        <Pie data={stats.confirmaData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          paddingAngle={3} dataKey="value">
                          {stats.confirmaData.map((e, i) => (
                            <Cell key={i} fill={confirmaColors[e.name] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {stats.confirmaData.map(e => (
                        <div key={e.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: confirmaColors[e.name] ?? "#94a3b8" }} />
                            <span className="text-xs text-foreground capitalize">{e.name}</span>
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {e.value} <span className="text-muted-foreground font-normal">({pct(e.value, stats.total)})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>

                <Section title="✅ Estado de asistencia">
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width="55%" height={160}>
                      <PieChart>
                        <Pie data={stats.asisteData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          paddingAngle={3} dataKey="value">
                          {stats.asisteData.map((e, i) => (
                            <Cell key={i} fill={asisteColors[e.name] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {stats.asisteData.map(e => (
                        <div key={e.name} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: asisteColors[e.name] ?? "#94a3b8" }} />
                            <span className="text-xs text-foreground capitalize">{e.name}</span>
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {e.value} <span className="text-muted-foreground font-normal">({pct(e.value, stats.total)})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              </div>

              {/* ── Citas por mes ── */}
              {stats.byMesData.length > 1 && (
                <Section title="📅 Citas por mes">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.byMesData} barSize={28}
                      margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="citas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Section>
              )}

              {/* ── Por día y por hora ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.byDowData.length > 0 && (
                  <Section title="📆 Citas por día de semana">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={stats.byDowData} barSize={32}
                        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="citas" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Section>
                )}

                {stats.byHoraData.length > 0 && (
                  <Section title="🕐 Citas por hora del día">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={stats.byHoraData} barSize={24}
                        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="citas" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Section>
                )}
              </div>

              {/* ── Quién agenda más ── */}
              {stats.byQuienData.length > 0 && (
                <Section title="👤 Citas agendadas por secretaria">
                  <ResponsiveContainer width="100%" height={Math.max(120, stats.byQuienData.length * 36)}>
                    <BarChart layout="vertical" data={stats.byQuienData} barSize={20}
                      margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="nombre" width={72}
                        tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="citas" fill="#10b981" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Section>
              )}
            </>
          )}

          {activeTab === "estudiantes" && (
            <>
              {/* ── Cards de resumen de estudiantes ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Estudiantes únicos" value={studentStats.total} color="bg-primary/10 text-primary" icon={Users} />
                <StatCard label="Sesiones promedio" value={studentStats.promedio}
                  sub="por estudiante" color="bg-violet-100 text-violet-700" icon={TrendingUp} />
                <StatCard label="Recurrentes (3+)" value={studentStats.recurrentes}
                  sub={pct(studentStats.recurrentes, studentStats.total) + " del total"}
                  color="bg-amber-100 text-amber-700" icon={RefreshCw} />
                <StatCard label="Dados de alta" value={studentStats.dados}
                  sub={pct(studentStats.dados, studentStats.total) + " del total"}
                  color="bg-emerald-100 text-emerald-700" icon={Award} />
              </div>

              {/* ── Tabla de estudiantes ── */}
              <Section title="👥 Seguimiento individual de estudiantes">
                {/* Controles de búsqueda / filtros */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar estudiante…"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <select value={filterAlta} onChange={e => setFilterAlta(e.target.value as typeof filterAlta)}
                    className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none">
                    <option value="todos">Todos</option>
                    <option value="activos">Solo activos</option>
                    <option value="alta">Solo dados de alta</option>
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none">
                    <option value="sesiones">Ordenar: más sesiones</option>
                    <option value="nombre">Ordenar: nombre A-Z</option>
                    <option value="ultima">Ordenar: última visita</option>
                  </select>
                  <span className="text-xs text-muted-foreground font-medium">
                    {filteredStudents.length} estudiante{filteredStudents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                        <th className="text-center py-2 pl-3 pr-2 font-semibold w-8">#</th>
                        <th className="text-left py-2 px-2 font-semibold">Estudiante</th>
                        <th className="text-center py-2 px-2 font-semibold">Sesiones</th>
                        <th className="text-center py-2 px-2 font-semibold">Asistidas</th>
                        <th className="text-center py-2 px-2 font-semibold">1ª / Última visita</th>
                        <th className="text-left py-2 px-2 font-semibold">Último estado</th>
                        <th className="text-center py-2 px-2 font-semibold">Alta</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                          No hay estudiantes que coincidan
                        </td></tr>
                      )}
                      {filteredStudents.map((s, i) => (
                        <StudentRow key={s.nombre} s={s} rank={i + 1} estados={estados} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Haz clic en una fila para ver el historial completo de sesiones del estudiante.
                </p>
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}
