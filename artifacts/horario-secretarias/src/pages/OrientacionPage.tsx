import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Trash2, Settings,
  User, CalendarDays, Clock, BarChart2, UserCheck, Download, Search, Pencil,
} from "lucide-react";
import OrientacionStats from "@/pages/OrientacionStats";
import { apiUrl } from "@/lib/api";
import { useCurrentUser } from "@/context/UserContext";
import { useHorario } from "@/context/HorarioContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Orientadora {
  id: number; nombre: string; titulo: string; fotoUrl: string;
  activa: number; orden: number;
}
interface HorarioSlot {
  id: number; orientadoraId: number; diaSemana: string; horaInicio: string; activo: number;
}
interface Bloqueo {
  id: number; orientadoraId: number; fechaInicio: string; fechaFin: string;
  horaInicio: string | null; motivo: string | null;
}
interface Cita {
  id: number; orientadoraId: number; nombreEstudiante: string;
  agendadoPor: string; fecha: string; horaInicio: string;
  motivo: string | null; estadoConfirma: string; estadoAsiste: string;
  notaRapida: string | null; dadoDeAlta: boolean;
}
interface Slot {
  fecha: string; horaInicio: string;
  status: "available" | "booked" | "blocked";
  cita?: Cita;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DOW_NAMES = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
const DOW_ES: Record<string, string> = {
  lunes:"Lunes", martes:"Martes", miercoles:"Miércoles",
  jueves:"Jueves", viernes:"Viernes",
};
const DOW_ORDER = ["lunes","martes","miercoles","jueves","viernes"];
const HORAS_DEFAULT = [
  "08:00","09:00","10:00","11:00","12:00","13:00","14:00",
  "15:00","16:00","17:00","18:00","19:00","20:00",
];
// ─── Estado DB type ───────────────────────────────────────────────────────────
interface EstadoDB {
  id: number; tipo: string; label: string; color: string; orden: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padZ(n: number) { return String(n).padStart(2, "0"); }
function dateStr(y: number, m: number, d: number) {
  return `${y}-${padZ(m)}-${padZ(d)}`;
}
function parseDateSafe(s: string) {
  // Parse YYYY-MM-DD as local date (avoid UTC shift)
  const [y,m,d] = s.split("-").map(Number);
  return new Date(y, m-1, d);
}
function getDOW(fecha: string) {
  return DOW_NAMES[parseDateSafe(fecha).getDay()];
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

// ─── Status Select (usa colores hex dinámicos) ────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return { r, g, b };
}
function colorStyle(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const bg = `rgba(${r},${g},${b},0.15)`;
  const text = hex;
  return { backgroundColor: bg, color: text, border: "none" };
}

function StatusSelect({
  value, estados, onChange,
}: { value: string; estados: EstadoDB[]; onChange:(v:string)=>void }) {
  const current = estados.find(e => e.label === value);
  const style = current ? colorStyle(current.color) : { backgroundColor: "#f1f5f9", color: "#64748b", border: "none" };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={style}
      className="text-[10px] font-semibold rounded-full px-2 py-0.5 outline-none cursor-pointer w-full capitalize"
    >
      {estados.map(e => <option key={e.id} value={e.label}>{e.label}</option>)}
    </select>
  );
}

// ─── Booking Modal ────────────────────────────────────────────────────────────

function BookingModal({
  fecha, hora, orientadoraNombre, agendadoPor, students, onConfirm, onClose,
}: {
  fecha: string; hora: string; orientadoraNombre: string; agendadoPor: string; students: string[];
  onConfirm:(nombre:string, motivo:string)=>void; onClose:()=>void;
}) {
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dt = parseDateSafe(fecha);
  const display = `${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]}`;

  const matches = useMemo(() => {
    const q = nombre.trim().toLowerCase();
    if (!q) return [];
    return students.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }, [nombre, students]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground">Agendar cita</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-sm">
          <p className="font-medium text-foreground">{orientadoraNombre}</p>
          <p className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{display}</p>
          <p className="text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{hora}</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <label className="block text-sm font-medium text-foreground mb-1.5">Nombre del estudiante</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input autoFocus value={nombre}
                onChange={e => { setNombre(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={e => e.key==="Enter" && nombre.trim() && onConfirm(nombre.trim(), motivo)}
                placeholder="Busca por nombre…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            {showDropdown && matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {matches.map(s => (
                  <button key={s} type="button"
                    onMouseDown={() => { setNombre(s); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {showDropdown && nombre.trim() && matches.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs text-muted-foreground">
                No se encontró en el horario — puedes agendar igual con este nombre.
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Motivo (opcional)</label>
            <input value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: orientación vocacional"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button disabled={!nombre.trim()} onClick={() => nombre.trim() && onConfirm(nombre.trim(), motivo)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
            Agendar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de edición de estados (tipo Excel) ─────────────────────────────────

const PRESET_COLORS = [
  "#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6",
  "#f43f5e","#06b6d4","#84cc16","#f97316","#94a3b8",
];

function EstadosPanel({
  estados, onRefresh,
}: { estados: EstadoDB[]; onRefresh: () => void }) {
  const confirmaList = estados.filter(e => e.tipo === "confirma");
  const asisteList   = estados.filter(e => e.tipo === "asiste");
  const [saving, setSaving] = useState(false);
  // Estado de la fila "nueva" por tipo
  const [newRow, setNewRow] = useState<{ tipo: string; label: string; color: string } | null>(null);

  async function addEstado(tipo: string, label: string, color: string) {
    if (!label.trim()) return;
    setSaving(true);
    await fetch(apiUrl("/api/orientacion/estados"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, label: label.trim(), color, orden: 99 }),
    });
    await onRefresh();
    setSaving(false);
    setNewRow(null);
  }

  async function updateEstado(id: number, patch: { label?: string; color?: string }) {
    await fetch(apiUrl(`/api/orientacion/estados/${id}`), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await onRefresh();
  }

  async function deleteEstado(id: number) {
    setSaving(true);
    await fetch(apiUrl(`/api/orientacion/estados/${id}`), { method: "DELETE" });
    await onRefresh();
    setSaving(false);
  }

  function EstadoRow({ e }: { e: EstadoDB }) {
    const [label, setLabel] = useState(e.label);
    const [showColors, setShowColors] = useState(false);

    return (
      <tr className="border-b border-border/40 last:border-0 group/row hover:bg-muted/30 transition-colors">
        {/* Color dot — clic abre picker */}
        <td className="py-1.5 pl-2 pr-1 w-8 relative">
          <button
            onClick={() => setShowColors(v => !v)}
            className="w-6 h-6 rounded-full border-2 border-white shadow transition-transform hover:scale-110"
            style={{ backgroundColor: e.color }}
            title="Cambiar color"
          />
          {showColors && (
            <div className="absolute z-10 left-0 top-8 bg-card border border-border rounded-xl shadow-xl p-2 grid grid-cols-5 gap-1.5 w-40">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => { updateEstado(e.id, { color: c }); setShowColors(false); }}
                  className="w-6 h-6 rounded-full border-2 border-white shadow hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={e.color}
                onChange={ev => { updateEstado(e.id, { color: ev.target.value }); setShowColors(false); }}
                className="col-span-5 w-full h-6 rounded cursor-pointer border-0"
                title="Color personalizado"
              />
            </div>
          )}
        </td>
        {/* Label editable inline */}
        <td className="py-1.5 px-1 flex-1">
          <input
            value={label}
            onChange={ev => setLabel(ev.target.value)}
            onBlur={() => { if (label.trim() && label !== e.label) updateEstado(e.id, { label }); }}
            onKeyDown={ev => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }}
            className="w-full bg-transparent text-sm text-foreground outline-none focus:bg-muted/40 rounded px-1 py-0.5 capitalize"
          />
        </td>
        {/* Preview badge */}
        <td className="py-1.5 px-2">
          <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 capitalize"
            style={colorStyle(e.color)}>{label}</span>
        </td>
        {/* Delete */}
        <td className="py-1.5 pr-2">
          <button onClick={() => deleteEstado(e.id)} disabled={saving}
            className="opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 disabled:opacity-30">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  // Fila de nueva entrada (visible al pulsar "+ Agregar")
  function NewRow({ tipo }: { tipo: string }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const color = newRow?.color ?? "#94a3b8";

    useEffect(() => { inputRef.current?.focus(); }, []);

    if (!newRow || newRow.tipo !== tipo) return null;

    return (
      <tr className="border-b border-border/40 bg-primary/5">
        {/* Color picker inline */}
        <td className="py-1.5 pl-2 pr-1 w-8 relative">
          <div className="relative">
            <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: color }} />
            <input type="color" value={color}
              onChange={ev => setNewRow(r => r ? { ...r, color: ev.target.value } : r)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
              title="Elegir color"
            />
          </div>
        </td>
        {/* Nombre */}
        <td className="py-1.5 px-1" colSpan={2}>
          <input
            ref={inputRef}
            value={newRow.label}
            onChange={ev => setNewRow(r => r ? { ...r, label: ev.target.value } : r)}
            onKeyDown={ev => {
              if (ev.key === "Enter") addEstado(tipo, newRow.label, color);
              if (ev.key === "Escape") setNewRow(null);
            }}
            placeholder="Nombre del estado…"
            className="w-full bg-transparent text-sm text-foreground outline-none focus:bg-muted/40 rounded px-1 py-0.5 placeholder:text-muted-foreground/50"
          />
        </td>
        {/* Botones confirmar / cancelar */}
        <td className="py-1.5 pr-2">
          <div className="flex items-center gap-1">
            <button onClick={() => addEstado(tipo, newRow.label, color)} disabled={saving || !newRow.label.trim()}
              className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5 disabled:opacity-40 hover:bg-primary/90 transition-colors">
              ✓
            </button>
            <button onClick={() => setNewRow(null)}
              className="text-[10px] font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5 hover:bg-muted/80 transition-colors">
              ✕
            </button>
          </div>
        </td>
      </tr>
    );
  }

  function Section({ tipo, label, list }: { tipo: string; label: string; list: EstadoDB[] }) {
    const isAdding = newRow?.tipo === tipo;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
          <button
            onClick={() => setNewRow(isAdding ? null : { tipo, label: "", color: "#94a3b8" })}
            disabled={saving}
            className={`flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40 ${
              isAdding
                ? "text-muted-foreground hover:text-foreground"
                : "text-primary hover:text-primary/80"
            }`}>
            {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {isAdding ? "Cancelar" : "Agregar estado"}
          </button>
        </div>
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left py-1.5 pl-2 pr-1 w-8">Color</th>
                <th className="text-left py-1.5 px-1">Nombre (editable)</th>
                <th className="text-left py-1.5 px-2">Vista previa</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && !isAdding && (
                <tr><td colSpan={4} className="py-3 text-center text-xs text-muted-foreground italic">Sin estados</td></tr>
              )}
              {list.map(e => <EstadoRow key={e.id} e={e} />)}
              <NewRow tipo={tipo} />
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Clic en el punto de color para cambiarlo · Clic en el nombre para editarlo · Enter o clic fuera para guardar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Section tipo="confirma" label="Estados de confirmación" list={confirmaList} />
      <Section tipo="asiste" label="Estados de asistencia" list={asisteList} />
    </div>
  );
}

// ─── Admin Modal (checkbox grid + feriados + estados) ─────────────────────────

function AdminModal({
  orientadora, horario, bloqueos, estados, horasDisponibles, onClose, onRefresh, onRefreshEstados, onRefreshHoras,
}: {
  orientadora: Orientadora;
  horario: HorarioSlot[];
  bloqueos: Bloqueo[];
  estados: EstadoDB[];
  horasDisponibles: string[];
  onClose: () => void;
  onRefresh: () => void;
  onRefreshEstados: () => void;
  onRefreshHoras: () => void;
}) {
  const [tab, setTab] = useState<"horario"|"feriados"|"estados"|"horas">("horario");
  const [saving, setSaving] = useState(false);
  const [newHora, setNewHora] = useState("");
  const [savingHora, setSavingHora] = useState(false);
  const [horaError, setHoraError] = useState("");
  // Feriado form
  const [feriadoDesde, setFeriadoDesde] = useState("");
  const [feriadoHasta, setFeriadoHasta] = useState("");
  const [feriadoMotivo, setFeriadoMotivo] = useState("Feriado");

  // Build set of active slots: "diaSemana|horaInicio" → slotId
  const slotMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of horario) m[`${s.diaSemana}|${s.horaInicio}`] = s.id;
    return m;
  }, [horario]);

  async function toggleSlot(dia: string, hora: string) {
    setSaving(true);
    const key = `${dia}|${hora}`;
    if (slotMap[key] !== undefined) {
      await fetch(apiUrl(`/api/orientacion/horario/${slotMap[key]}`), { method: "DELETE" });
    } else {
      await fetch(apiUrl(`/api/orientacion/orientadoras/${orientadora.id}/horario`), {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ diaSemana: dia, horaInicio: hora }),
      });
    }
    await onRefresh();
    setSaving(false);
  }

  async function addHora() {
    if (!newHora) { setHoraError("Ingresa una hora"); return; }
    if (!/^\d{2}:\d{2}$/.test(newHora)) { setHoraError("Formato HH:MM"); return; }
    setSavingHora(true); setHoraError("");
    try {
      const r = await fetch(apiUrl(`/api/orientacion/orientadoras/${orientadora.id}/horas`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hora: newHora }),
      });
      const data = await r.json();
      if (data.error) setHoraError(data.error);
      else { setNewHora(""); onRefreshHoras(); }
    } catch { setHoraError("Error de conexión"); }
    finally { setSavingHora(false); }
  }

  async function deleteHora(hora: string) {
    await fetch(apiUrl(`/api/orientacion/orientadoras/${orientadora.id}/horas/${encodeURIComponent(hora)}`), { method: "DELETE" });
    onRefreshHoras();
  }

  // Toggle ALL hours for a given day
  async function toggleDay(dia: string) {
    setSaving(true);
    const diaSlots = horasDisponibles.map(h => ({ h, key: `${dia}|${h}` }));
    const allOn = diaSlots.every(({ key }) => slotMap[key] !== undefined);
    if (allOn) {
      // Remove all
      await Promise.all(diaSlots.map(({ key }) =>
        slotMap[key] !== undefined
          ? fetch(apiUrl(`/api/orientacion/horario/${slotMap[key]}`), { method: "DELETE" })
          : Promise.resolve()
      ));
    } else {
      // Add missing
      await Promise.all(diaSlots.map(({ key, h }) =>
        slotMap[key] === undefined
          ? fetch(apiUrl(`/api/orientacion/orientadoras/${orientadora.id}/horario`), {
              method: "POST", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ diaSemana: dia, horaInicio: h }),
            })
          : Promise.resolve()
      ));
    }
    await onRefresh();
    setSaving(false);
  }

  async function addFeriado() {
    if (!feriadoDesde) return;
    const hasta = feriadoHasta || feriadoDesde;
    await fetch(apiUrl(`/api/orientacion/orientadoras/${orientadora.id}/bloqueo`), {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ fechaInicio: feriadoDesde, fechaFin: hasta, motivo: feriadoMotivo }),
    });
    setFeriadoDesde(""); setFeriadoHasta(""); setFeriadoMotivo("Feriado");
    onRefresh();
  }

  async function removeBloqueo(id: number) {
    await fetch(apiUrl(`/api/orientacion/bloqueo/${id}`), { method: "DELETE" });
    onRefresh();
  }

  // Which hours are active for at least one day?
  const activeHours = useMemo(() => {
    const used = new Set(horario.map(s => s.horaInicio));
    return horasDisponibles.filter(h => used.has(h) || true); // show all, checked = active
  }, [horario, horasDisponibles]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl my-4 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado fijo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
          <h3 className="font-bold text-lg text-foreground">Configurar — {orientadora.nombre}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1 flex-wrap">
          {([
            ["horario",  "📅 Horario"],
            ["feriados", "🚫 Sin atención"],
            ["estados",  "🎨 Estados"],
            ["horas",    "🕐 Módulos"],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${tab===t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "horario" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Haz clic en un casillero para activar/desactivar ese horario. Haz clic en el <strong>nombre del día</strong> para marcar o desmarcar todo el día de un golpe.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-3 text-xs font-semibold text-muted-foreground w-14">Hora</th>
                    {DOW_ORDER.map(d => {
                      const allChecked = horasDisponibles.every(h => slotMap[`${d}|${h}`] !== undefined);
                      const someChecked = horasDisponibles.some(h => slotMap[`${d}|${h}`] !== undefined);
                      return (
                        <th key={d} className="text-center py-1 px-1">
                          <button
                            disabled={saving}
                            onClick={() => toggleDay(d)}
                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                              allChecked
                                ? "bg-primary border-primary text-primary-foreground"
                                : someChecked
                                ? "bg-primary/20 border-primary/40 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                            } disabled:opacity-50`}
                          >
                            {d === "miercoles" ? "Mié" : DOW_ES[d]?.slice(0,3)}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {horasDisponibles.map(hora => (
                    <tr key={hora} className="border-t border-border/50">
                      <td className="py-1.5 pr-3 text-xs font-mono text-muted-foreground">{hora}</td>
                      {DOW_ORDER.map(dia => {
                        const key = `${dia}|${hora}`;
                        const checked = slotMap[key] !== undefined;
                        return (
                          <td key={dia} className="py-1.5 px-1 text-center">
                            <button
                              disabled={saving}
                              onClick={() => toggleSlot(dia, hora)}
                              className={`w-9 h-8 rounded-lg border-2 transition-all font-bold text-sm ${
                                checked
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                              } disabled:opacity-50`}
                            >
                              {checked ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              💡 Los cambios se guardan automáticamente. Si la orientadora trabaja todos los días, haz clic en cada nombre de día. Si solo trabaja Martes, Jueves y Viernes, haz clic solo en esos tres.
            </p>
          </div>
        )}

        {tab === "estados" && (
          <EstadosPanel estados={estados} onRefresh={onRefreshEstados} />
        )}

        {tab === "horas" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Estos son los módulos de tiempo disponibles para asignar al horario de la orientadora. Agrega o elimina horas según necesites (ej. 16:30, 17:30).
            </p>
            <div className="grid grid-cols-4 gap-2">
              {horasDisponibles.map(h => (
                <div key={h} className="flex items-center justify-between gap-1 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
                  <span className="text-xs font-mono font-semibold text-foreground">{h}</span>
                  <button
                    onClick={() => deleteHora(h)}
                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    title="Eliminar módulo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {horasDisponibles.length === 0 && (
                <p className="col-span-4 text-xs text-muted-foreground italic">Sin módulos definidos</p>
              )}
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Agregar módulo</h4>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="time"
                    value={newHora}
                    onChange={e => { setNewHora(e.target.value); setHoraError(""); }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {horaError && <p className="text-xs text-red-500 mt-1">{horaError}</p>}
                </div>
                <button
                  onClick={addHora}
                  disabled={savingHora || !newHora}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingHora ? "…" : "Agregar"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Puedes agregar horas como 16:30 o 17:45 — no es necesario que sean en punto.
              </p>
            </div>
          </div>
        )}

        {tab === "feriados" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Marca días específicos donde la orientadora NO atenderá (feriados, reuniones, vacaciones, etc.).
            </p>

            {/* Existing blocks */}
            <div className="space-y-2">
              {bloqueos.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin días bloqueados</p>
              )}
              {bloqueos.map(b => {
                const dt = parseDateSafe(b.fechaInicio);
                const label = b.fechaInicio === b.fechaFin
                  ? `${dt.getDate()} de ${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`
                  : `${b.fechaInicio} → ${b.fechaFin}`;
                return (
                  <div key={b.id} className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      {b.motivo && <span className="text-xs text-muted-foreground ml-2">— {b.motivo}</span>}
                    </div>
                    <button onClick={() => removeBloqueo(b.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add block */}
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Agregar período sin atención</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
                  <input type="date" value={feriadoDesde} onChange={e => {
                    setFeriadoDesde(e.target.value);
                    if (!feriadoHasta || feriadoHasta < e.target.value) setFeriadoHasta(e.target.value);
                  }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta <span className="text-muted-foreground/60">(mismo día si es 1 día)</span></label>
                  <input type="date" value={feriadoHasta} min={feriadoDesde} onChange={e => setFeriadoHasta(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Motivo</label>
                <input value={feriadoMotivo} onChange={e => setFeriadoMotivo(e.target.value)}
                  placeholder="Feriado, Reunión, Vacaciones…"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <button onClick={addFeriado} disabled={!feriadoDesde}
                className="w-full px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors">
                Marcar como sin atención
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Nueva Orientadora Modal ───────────────────────────────────────────────────

function NuevaOrientadoraModal({ onConfirm, onClose }: {
  onConfirm:(nombre:string, titulo:string)=>void; onClose:()=>void;
}) {
  const [nombre, setNombre] = useState("");
  const [titulo, setTitulo] = useState("Orientadora");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-foreground">Nueva orientadora</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nombre</label>
            <input autoFocus value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Nombre completo"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Cargo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Orientadora / Psicóloga…"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button disabled={!nombre.trim()} onClick={() => nombre.trim() && onConfirm(nombre.trim(), titulo.trim() || "Orientadora")}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// Border color se resuelve dinámicamente desde estados
function getBorderColor(estadoLabel: string, estados: EstadoDB[]) {
  return estados.find(e => e.label === estadoLabel)?.color ?? "#94a3b8";
}

// Day accent colors
const DOW_ACCENT: Record<string, { header: string; text: string }> = {
  lunes:     { header: "bg-sky-50 dark:bg-sky-950/30",    text: "text-sky-700 dark:text-sky-400" },
  martes:    { header: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400" },
  miercoles: { header: "bg-cyan-50 dark:bg-cyan-950/30",  text: "text-cyan-700 dark:text-cyan-400" },
  jueves:    { header: "bg-amber-50 dark:bg-amber-950/30",text: "text-amber-700 dark:text-amber-400" },
  viernes:   { header: "bg-rose-50 dark:bg-rose-950/30",  text: "text-rose-700 dark:text-rose-400" },
};

// ─── Appointment Cell ──────────────────────────────────────────────────────────

function AppointmentCell({
  slot, canBook, canManage, estadosConfirma, estadosAsiste,
  onBook, onUpdateCita, onDeleteCita,
}: {
  slot: Slot | undefined;
  canBook: boolean; canManage: boolean;
  estadosConfirma: EstadoDB[]; estadosAsiste: EstadoDB[];
  onBook: () => void;
  onUpdateCita: (id: number, patch: Record<string, string | null | boolean>) => void;
  onDeleteCita: (id: number, nombreEstudiante: string) => void;
}) {
  const EMPTY_H = "h-[72px]";
  const [editingName, setEditingName] = useState(false);

  if (!slot) return <div className={EMPTY_H} />;

  if (slot.status === "blocked") {
    return (
      <div className={`${EMPTY_H} flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40`}>
        <span className="text-[10px] font-medium text-red-400">🚫 Sin atención</span>
      </div>
    );
  }

  if (slot.status === "available") {
    return canBook ? (
      <button
        onClick={onBook}
        className={`${EMPTY_H} w-full rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-2 border-emerald-200 hover:border-emerald-400 dark:border-emerald-800 flex items-center justify-center gap-1.5 transition-all group cursor-pointer`}
      >
        <Plus className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-700 transition-colors" />
        <span className="text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700 dark:text-emerald-400 transition-colors">
          Agendar
        </span>
      </button>
    ) : (
      <div className={`${EMPTY_H} rounded-lg bg-muted/20 border border-border/20 flex items-center justify-center`}>
        <span className="text-[10px] text-muted-foreground/40 font-medium">Disponible</span>
      </div>
    );
  }

  // ── Booked ──────────────────────────────────────────────────────────────────
  const cita = slot.cita!;
  const accentColor = getBorderColor(cita.estadoConfirma, estadosConfirma);
  const canEdit = canBook || canManage;

  return (
    <div
      className="min-h-[72px] rounded-lg bg-card border border-border border-l-[4px] p-1.5 flex flex-col gap-0.5 group shadow-sm"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Name row */}
      <div className="flex items-start justify-between gap-1">
        {editingName ? (
          <input
            autoFocus
            defaultValue={cita.nombreEstudiante}
            onBlur={e => {
              const val = e.target.value.trim();
              if (val && val !== cita.nombreEstudiante) onUpdateCita(cita.id, { nombreEstudiante: val });
              setEditingName(false);
            }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingName(false); }}
            className="text-[11px] font-bold text-foreground leading-tight flex-1 bg-muted/40 rounded px-1 outline-none ring-1 ring-primary/40"
          />
        ) : (
          <span className="text-[11px] font-bold text-foreground leading-tight line-clamp-1 flex-1">
            {cita.nombreEstudiante}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && !editingName && (
            <button onClick={() => setEditingName(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {canManage && (
            <button onClick={() => onDeleteCita(cita.id, cita.nombreEstudiante)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Estado confirma — editable para todos */}
      {canEdit ? (
        <StatusSelect value={cita.estadoConfirma} estados={estadosConfirma}
          onChange={v => onUpdateCita(cita.id, { estadoConfirma: v })} />
      ) : (
        <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 capitalize"
          style={colorStyle(accentColor)}>
          {cita.estadoConfirma}
        </span>
      )}

      {/* Estado asiste — solo admin/orientadora */}
      {canManage && estadosAsiste.length > 0 && (
        <StatusSelect value={cita.estadoAsiste} estados={estadosAsiste}
          onChange={v => onUpdateCita(cita.id, { estadoAsiste: v })} />
      )}

      {/* Nota rápida */}
      {canEdit ? (
        <input
          key={`nota-${cita.id}`}
          defaultValue={cita.notaRapida ?? ""}
          onBlur={e => {
            const val = e.target.value.trim();
            const prev = cita.notaRapida ?? "";
            if (val !== prev) onUpdateCita(cita.id, { notaRapida: val || null });
          }}
          placeholder="Nota rápida…"
          className="w-full text-[10px] bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground/30 leading-tight"
        />
      ) : cita.notaRapida ? (
        <span className="text-[10px] text-muted-foreground italic leading-tight truncate">
          {cita.notaRapida}
        </span>
      ) : null}

      {/* Dado de alta — solo orientadora/admin */}
      {canManage && (
        <button
          onClick={() => onUpdateCita(cita.id, { dadoDeAlta: !cita.dadoDeAlta } as Record<string, string | null | boolean>)}
          className={`flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5 mt-0.5 transition-colors w-full justify-center ${
            cita.dadoDeAlta
              ? "bg-emerald-100 text-emerald-700"
              : "bg-muted/40 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
          }`}
          title={cita.dadoDeAlta ? "Marcar como activo" : "Dar de alta"}
        >
          <UserCheck className="w-2.5 h-2.5 shrink-0" />
          {cita.dadoDeAlta ? "Alta" : "Dar de alta"}
        </button>
      )}
    </div>
  );
}

// ─── Day Section ──────────────────────────────────────────────────────────────

function DaySection({
  dow, dates, slotsByDateHora, allHours,
  canBook, canManage, estadosConfirma, estadosAsiste,
  onBook, onUpdateCita, onDeleteCita,
}: {
  dow: string;
  dates: string[];
  slotsByDateHora: Record<string, Record<string, Slot>>;
  allHours: string[];
  canBook: boolean; canManage: boolean;
  estadosConfirma: EstadoDB[]; estadosAsiste: EstadoDB[];
  onBook: (fecha: string, hora: string) => void;
  onUpdateCita: (id: number, patch: Record<string, string | null | boolean>) => void;
  onDeleteCita: (id: number, nombreEstudiante: string) => void;
}) {
  if (dates.length === 0) return null;

  const accent = DOW_ACCENT[dow] ?? { header: "bg-muted/30", text: "text-foreground" };

  // Section-level counts
  const totalAvailable = dates.reduce((s, f) =>
    s + allHours.filter(h => slotsByDateHora[f]?.[h]?.status === "available").length, 0);
  const totalBooked = dates.reduce((s, f) =>
    s + allHours.filter(h => slotsByDateHora[f]?.[h]?.status === "booked").length, 0);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Section header */}
      <div className={`${accent.header} border-b border-border px-4 py-3 flex items-center gap-3 flex-wrap`}>
        <span className={`text-sm font-extrabold ${accent.text} uppercase tracking-widest`}>
          {DOW_ES[dow]}
        </span>
        <span className="text-xs text-muted-foreground font-medium">{dates.length} semanas</span>
        <div className="ml-auto flex items-center gap-2">
          {totalAvailable > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {totalAvailable} disponibles
            </span>
          )}
          {totalBooked > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              {totalBooked} agendadas
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="border-b-2 border-border">
              {/* Hour column header */}
              <th className="px-3 py-2 text-left text-xs font-bold text-muted-foreground bg-muted/40 w-16 sticky left-0 z-10 border-r border-border/40">
                Hora
              </th>
              {dates.map(fecha => {
                const dt = parseDateSafe(fecha);
                const daySlots = slotsByDateHora[fecha] ?? {};
                const allBlocked = allHours.length > 0 && allHours.every(h => daySlots[h]?.status === "blocked");
                const dayAvail  = allHours.filter(h => daySlots[h]?.status === "available").length;
                const dayBooked = allHours.filter(h => daySlots[h]?.status === "booked").length;
                return (
                  <th key={fecha} className={`px-2 py-2 text-center min-w-[130px] ${allBlocked ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/20"}`}>
                    {/* Day number */}
                    <div className="text-xl font-black text-foreground leading-none">{dt.getDate()}</div>
                    {/* Month abbrev */}
                    <div className="text-[10px] text-muted-foreground mt-0.5">{MONTH_NAMES[dt.getMonth()].slice(0,3)}</div>
                    {/* Mini status bar */}
                    {allBlocked ? (
                      <div className="mt-1 text-[9px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 rounded-full px-2 py-0.5 inline-block">
                        Sin atención
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 mt-1">
                        {dayAvail > 0 && (
                          <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />{dayAvail}
                          </span>
                        )}
                        {dayBooked > 0 && (
                          <span className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />{dayBooked}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {allHours.map((hora, idx) => (
              <tr key={hora} className={`border-b border-border/40 last:border-0 ${idx % 2 === 1 ? "bg-muted/[0.06]" : ""}`}>
                {/* Hour cell — sticky */}
                <td className="px-3 py-1 text-xs font-mono font-bold text-muted-foreground bg-muted/30 sticky left-0 z-10 border-r border-border/30">
                  {hora}
                </td>
                {dates.map(fecha => {
                  const slot = slotsByDateHora[fecha]?.[hora];
                  return (
                    <td key={fecha} className="px-1.5 py-1 align-top">
                      <AppointmentCell
                        slot={slot}
                        canBook={canBook}
                        canManage={canManage}
                        estadosConfirma={estadosConfirma}
                        estadosAsiste={estadosAsiste}
                        onBook={() => onBook(fecha, hora)}
                        onUpdateCita={onUpdateCita}
                        onDeleteCita={onDeleteCita}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OrientacionPage() {
  const { currentUser } = useCurrentUser();
  const { horarioId } = useHorario();
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [orientadoras, setOrientadoras] = useState<Orientadora[]>([]);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [slots, setSlots]               = useState<Slot[]>([]);
  const [horario, setHorario]           = useState<HorarioSlot[]>([]);
  const [bloqueos, setBloqueos]         = useState<Bloqueo[]>([]);
  const [estados, setEstados]           = useState<EstadoDB[]>([]);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>(HORAS_DEFAULT);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingModal, setBookingModal] = useState<{fecha:string; hora:string}|null>(null);
  const [adminModal, setAdminModal]     = useState(false);
  const [nuevaModal, setNuevaModal]     = useState(false);
  const [estadosModal, setEstadosModal] = useState(false);
  const [showStats, setShowStats]       = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [allStudents, setAllStudents]   = useState<string[]>([]);

  // ── Load student names from the schedule (para el buscador al agendar) ─────
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(apiUrl(`/api/schedule?horario=${horarioId}`));
        if (!r.ok) return;
        const data: Array<{ students: string[] }> = await r.json();
        const names = new Set<string>();
        data.forEach(c => c.students?.forEach(s => s && names.add(s)));
        setAllStudents([...names].sort((a, b) => a.localeCompare(b)));
      } catch {}
    })();
  }, [horarioId]);

  const isAdmin     = currentUser?.role === "admin";
  const isCounselor = currentUser?.role === "orientadora";
  const isSecretary = currentUser?.role === "secretaria";
  const canManage   = isAdmin || isCounselor || isSecretary;
  const canBook     = !!currentUser;

  const selectedOrientadora = useMemo(
    () => orientadoras.find(o => o.id === selectedId) ?? null,
    [orientadoras, selectedId],
  );

  // ── Load orientadoras ────────────────────────────────────────────────────
  const loadOrientadoras = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/orientacion/orientadoras"));
      if (!r.ok) return;
      const data: Orientadora[] = await r.json();
      const active = data.filter(o => o.activa === 1);
      setOrientadoras(active);
      setSelectedId(prev => prev ?? (active[0]?.id ?? null));
    } catch {}
  }, []);

  // ── Load estados ──────────────────────────────────────────────────────────
  const loadEstados = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/orientacion/estados"));
      if (!r.ok) return;
      const data: EstadoDB[] = await r.json();
      setEstados(data);
    } catch {}
  }, []);

  // ── Load horas disponibles (por orientadora seleccionada) ───────────────────
  const loadHoras = useCallback(async () => {
    if (!selectedId) { setHorasDisponibles(HORAS_DEFAULT); return; }
    try {
      const r = await fetch(apiUrl(`/api/orientacion/orientadoras/${selectedId}/horas`));
      if (!r.ok) return;
      const data: string[] = await r.json();
      setHorasDisponibles(data.length > 0 ? data : HORAS_DEFAULT);
    } catch {}
  }, [selectedId]);

  useEffect(() => { loadOrientadoras(); loadEstados(); }, []);
  useEffect(() => { loadHoras(); }, [loadHoras]);

  // ── Descargar Excel (sirve como respaldo manual de citas/orientadoras) ─────
  const handleExportExcel = useCallback(async () => {
    setExportingExcel(true);
    try {
      const res = await fetch(apiUrl(`/api/orientacion/export?año=${year}`));
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orientacion_${year}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo descargar el Excel. Intenta de nuevo.");
    } finally {
      setExportingExcel(false);
    }
  }, [year]);


  // ── Load slots ────────────────────────────────────────────────────────────
  const loadSlots = useCallback(async () => {
    if (!selectedId) return;
    setLoadingSlots(true);
    try {
      const r = await fetch(apiUrl(`/api/orientacion/disponibilidad/${selectedId}?año=${year}&mes=${month}`));
      if (!r.ok) { setSlots([]); return; }
      setSlots(await r.json());
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, [selectedId, year, month]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // ── Load admin data ───────────────────────────────────────────────────────
  const loadAdminData = useCallback(async () => {
    if (!selectedId) return;
    try {
      const [hr, br] = await Promise.all([
        fetch(apiUrl(`/api/orientacion/orientadoras/${selectedId}/horario`)),
        fetch(apiUrl(`/api/orientacion/orientadoras/${selectedId}/bloqueos`)),
      ]);
      if (hr.ok) setHorario(await hr.json());
      if (br.ok) setBloqueos(await br.json());
    } catch {}
  }, [selectedId]);

  // ── Month navigation ─────────────────────────────────────────────────────
  function prevMonth() {
    if (month===1) { setMonth(12); setYear(y => y-1); }
    else setMonth(m => m-1);
  }
  function nextMonth() {
    if (month===12) { setMonth(1); setYear(y => y+1); }
    else setMonth(m => m+1);
  }

  // ── Booking ───────────────────────────────────────────────────────────────
  async function handleBook(nombre: string, motivo: string) {
    if (!bookingModal || !selectedId || !currentUser) return;
    await fetch(apiUrl("/api/orientacion/citas"), {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        orientadoraId: selectedId,
        nombreEstudiante: nombre,
        agendadoPor: currentUser.name,
        fecha: bookingModal.fecha,
        horaInicio: bookingModal.hora,
        motivo: motivo || null,
      }),
    });
    setBookingModal(null);
    await loadSlots();
  }

  async function handleUpdateCita(id: number, patch: Record<string, string | null | boolean>) {
    setSlots(prev => prev.map(s =>
      s.cita?.id === id ? { ...s, cita: { ...s.cita!, ...patch } } : s
    ));
    await fetch(apiUrl(`/api/orientacion/citas/${id}`), {
      method: "PATCH", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(patch),
    });
  }

  async function handleDeleteCita(id: number, nombreEstudiante: string) {
    if (!window.confirm(`¿Eliminar la cita de ${nombreEstudiante}?\n\nEsta acción no se puede deshacer.`)) return;
    await fetch(apiUrl(`/api/orientacion/citas/${id}`), { method: "DELETE" });
    await loadSlots();
  }

  async function handleCrearOrientadora(nombre: string, titulo: string) {
    await fetch(apiUrl("/api/orientacion/orientadoras"), {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ nombre, titulo }),
    });
    setNuevaModal(false);
    await loadOrientadoras();
  }

  async function handleDeleteOrientadora(id: number, nombre: string) {
    if (!window.confirm(`¿Eliminar a ${nombre}?\n\nSe eliminarán también su horario y todas las citas agendadas.`)) return;
    await fetch(apiUrl(`/api/orientacion/orientadoras/${id}`), { method: "DELETE" });
    setSelectedId(prev => (prev === id ? null : prev));
    await loadOrientadoras();
  }

  // ── Build calendar data ───────────────────────────────────────────────────
  // Group slots by: dowName → fecha → hora
  const { workingDows, slotsByDow } = useMemo(() => {
    const dowDates: Record<string, Set<string>> = {};
    const byDowFechaHora: Record<string, Record<string, Record<string, Slot>>> = {};

    for (const slot of slots) {
      const dow = getDOW(slot.fecha);
      if (!dowDates[dow]) { dowDates[dow] = new Set(); byDowFechaHora[dow] = {}; }
      dowDates[dow].add(slot.fecha);
      if (!byDowFechaHora[dow][slot.fecha]) byDowFechaHora[dow][slot.fecha] = {};
      byDowFechaHora[dow][slot.fecha][slot.horaInicio] = slot;
    }

    // Sort dates within each dow
    const working = DOW_ORDER.filter(d => dowDates[d] && dowDates[d].size > 0);
    const result: Record<string, { dates: string[]; byDateHora: Record<string, Record<string, Slot>> }> = {};
    for (const dow of working) {
      result[dow] = {
        dates: [...dowDates[dow]].sort(),
        byDateHora: byDowFechaHora[dow],
      };
    }
    return { workingDows: working, slotsByDow: result };
  }, [slots]);

  // Get all unique hours across all working days (sorted)
  const allHours = useMemo(() => {
    const h = new Set(slots.map(s => s.horaInicio));
    // Include any slot hour not yet in horasDisponibles (safety net)
    const extra = [...h].filter(hora => !horasDisponibles.includes(hora));
    return [...horasDisponibles.filter(hora => h.has(hora)), ...extra].sort();
  }, [slots, horasDisponibles]);

  const bookedCount   = slots.filter(s => s.status === "booked").length;
  const availableCount = slots.filter(s => s.status === "available").length;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Orientación</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Agenda de citas con orientadoras</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Calendar / Stats toggle */}
            <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
              <button
                onClick={() => setShowStats(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  !showStats ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Calendario
              </button>
              <button
                onClick={() => setShowStats(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  showStats ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Estadísticas
              </button>
            </div>
            {canManage && (
              <button onClick={handleExportExcel} disabled={exportingExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />
                {exportingExcel ? "Descargando..." : "Descargar Excel"}
              </button>
            )}
            {canManage && (
              <button onClick={() => setEstadosModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                🎨 Editar estados
              </button>
            )}
            {canManage && !showStats && (
              <button onClick={() => setNuevaModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" />Nueva orientadora
              </button>
            )}
          </div>
        </div>

        {orientadoras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <User className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">No hay orientadoras configuradas</p>
            {canManage && (
              <button onClick={() => setNuevaModal(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                Agregar primera orientadora
              </button>
            )}
          </div>
        ) : showStats ? (
          <OrientacionStats
            orientadoras={orientadoras}
            selectedId={selectedId}
            onSelectId={setSelectedId}
          />
        ) : (
          <>
            {/* Orientadora tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {orientadoras.map(o => (
                <div key={o.id} className="relative group/tab flex-shrink-0">
                  <button onClick={() => setSelectedId(o.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      canManage ? "pr-8" : ""
                    } ${
                      selectedId===o.id
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                    }`}>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                      {o.nombre[0]}
                    </div>
                    {o.nombre}
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteOrientadora(o.id, o.nombre)}
                      title={`Eliminar ${o.nombre}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md opacity-0 group-hover/tab:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            {canBook && (
              <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-muted-foreground">
                <span className="uppercase tracking-wide text-[10px] font-bold">Referencias:</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Plus className="w-3 h-3" /> Hora libre — clic para agendar
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card text-foreground border-l-[3px] border border-border shadow-sm" style={{borderLeftColor:"#10b981"}}>
                  Estudiante agendado/a
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-400 border border-red-100">
                  🚫 Sin atención
                </span>
              </div>
            )}

            {selectedOrientadora && (
              <>
                {/* Controls row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
                    <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="min-w-[160px] text-center font-semibold text-foreground text-sm px-2">
                      {MONTH_NAMES[month-1]} {year}
                    </span>
                    <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <span className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                      {bookedCount} agendadas
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">
                      {availableCount} disponibles
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                      {selectedOrientadora.titulo}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => { setAdminModal(true); loadAdminData(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                        <Settings className="w-3.5 h-3.5" />Configurar horario
                      </button>
                    )}
                  </div>
                </div>

                {/* Calendar */}
                {loadingSlots ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : workingDows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                    <CalendarDays className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm font-medium">Sin horario configurado para este mes</p>
                    <p className="text-xs text-muted-foreground">Haz clic en "Configurar horario" para definir los días y horas de atención.</p>
                    {canManage && (
                      <button onClick={() => { setAdminModal(true); loadAdminData(); }}
                        className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                        Configurar horario
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {workingDows.map(dow => (
                      <DaySection
                        key={dow}
                        dow={dow}
                        dates={slotsByDow[dow].dates}
                        slotsByDateHora={slotsByDow[dow].byDateHora}
                        allHours={allHours}
                        canBook={canBook}
                        canManage={canManage}
                        estadosConfirma={estados.filter(e => e.tipo === "confirma")}
                        estadosAsiste={estados.filter(e => e.tipo === "asiste")}
                        onBook={(fecha, hora) => setBookingModal({ fecha, hora })}
                        onUpdateCita={handleUpdateCita}
                        onDeleteCita={handleDeleteCita}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {bookingModal && selectedOrientadora && (
        <BookingModal
          fecha={bookingModal.fecha} hora={bookingModal.hora}
          orientadoraNombre={selectedOrientadora.nombre}
          agendadoPor={currentUser?.name ?? ""}
          students={allStudents}
          onConfirm={handleBook} onClose={() => setBookingModal(null)}
        />
      )}

      {adminModal && selectedOrientadora && (
        <AdminModal
          orientadora={selectedOrientadora}
          horario={horario} bloqueos={bloqueos}
          estados={estados}
          horasDisponibles={horasDisponibles}
          onClose={() => { setAdminModal(false); loadSlots(); }}
          onRefresh={loadAdminData}
          onRefreshEstados={loadEstados}
          onRefreshHoras={loadHoras}
        />
      )}

      {estadosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-foreground">🎨 Editar estados</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Personaliza los nombres y colores de los estados de citas</p>
              </div>
              <button onClick={() => setEstadosModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <EstadosPanel estados={estados} onRefresh={loadEstados} />
          </div>
        </div>
      )}

      {nuevaModal && (
        <NuevaOrientadoraModal
          onConfirm={handleCrearOrientadora}
          onClose={() => setNuevaModal(false)}
        />
      )}
    </div>
  );
}
