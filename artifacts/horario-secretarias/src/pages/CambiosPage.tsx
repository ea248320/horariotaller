import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, RefreshCw, ArrowLeftRight, Search } from "lucide-react";
import { useHorario } from "@/context/HorarioContext";

import { apiUrl as api } from "@/lib/api";

export type Transfer = {
  id: number;
  horarioId: string;
  studentName: string;
  teacherBefore: string;
  teacherAfter: string;
  sede: string;
  subject: string;
  leavesClass: string;
  entersClass: string;
  transferDate: string;
  changeType: string;
  changeReason: string;
  createdAt: string;
};

const CHANGE_TYPES = [
  "CAMBIO HORARIO",
  "CAMBIO PROFESOR",
  "RETIRO DEL PREU",
  "AGREGA CURSO",
  "RETIRO CURSO",
  "CAMBIO DE SEDE",
] as const;

const CHANGE_REASONS = ["PROFESOR", "ALUMNOS", "HORARIO", "NINGUNO", "OTRO"] as const;

const TYPE_STYLES: Record<string, string> = {
  "CAMBIO HORARIO":   "bg-pink-100 text-pink-800 border-pink-200",
  "CAMBIO PROFESOR":  "bg-red-100 text-red-800 border-red-200",
  "RETIRO DEL PREU":  "bg-rose-100 text-rose-700 border-rose-200",
  "AGREGA CURSO":     "bg-green-100 text-green-800 border-green-200",
  "RETIRO CURSO":     "bg-gray-100 text-gray-700 border-gray-300",
  "CAMBIO DE SEDE":   "bg-amber-100 text-amber-800 border-amber-200",
};

const REASON_STYLES: Record<string, string> = {
  "PROFESOR": "bg-red-100 text-red-700 border-red-200",
  "ALUMNOS":  "bg-pink-100 text-pink-700 border-pink-200",
  "HORARIO":  "bg-green-100 text-green-700 border-green-200",
  "NINGUNO":  "bg-purple-100 text-purple-700 border-purple-200",
  "OTRO":     "bg-teal-100 text-teal-700 border-teal-200",
};

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const cls = styles[value] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap ${cls}`}>
      {value}
    </span>
  );
}

type EditableField = keyof Omit<Transfer, "id" | "horarioId" | "createdAt">;

const TEXT_COLS: { key: EditableField; label: string; width: string }[] = [
  { key: "studentName",   label: "Nombre del alumno",    width: "min-w-[160px]" },
  { key: "teacherBefore", label: "Profesor antes",        width: "min-w-[80px]" },
  { key: "teacherAfter",  label: "Profesor actual",       width: "min-w-[80px]" },
  { key: "sede",          label: "Sede",                  width: "min-w-[110px]" },
  { key: "subject",       label: "Asignatura",            width: "min-w-[100px]" },
  { key: "leavesClass",   label: "Sale",                  width: "min-w-[140px]" },
  { key: "entersClass",   label: "Entra",                 width: "min-w-[140px]" },
  { key: "transferDate",  label: "Fecha",                 width: "min-w-[110px]" },
];

function EditableCell({
  value,
  onSave,
  placeholder = "—",
  isDate = false,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  isDate?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onSave(draft);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={isDate ? "date" : "text"}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        autoFocus
        className="w-full px-2 py-1 text-xs border border-primary rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="w-full text-left text-xs px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors min-h-[28px] text-foreground"
    >
      {isDate && value
        ? new Date(value + "T12:00:00").toLocaleDateString("es-CL")
        : value || <span className="text-muted-foreground/50">{placeholder}</span>
      }
    </button>
  );
}

function SelectCell({
  value,
  options,
  styles,
  onSave,
}: {
  value: string;
  options: readonly string[];
  styles: Record<string, string>;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={e => { onSave(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        autoFocus
        className="w-full text-xs border border-primary rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-left">
      <Badge value={value} styles={styles} />
    </button>
  );
}

export default function CambiosPage() {
  const { horarioId, horario } = useHorario();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sedes = horario.sedesInfo?.map((s: { name: string }) => s.name) ?? horario.sedes;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(api(`/api/transfers?horarioId=${encodeURIComponent(horarioId)}`));
      if (res.ok) setTransfers(await res.json());
    } catch {}
    setLoading(false);
  }, [horarioId]);

  useEffect(() => { load(); }, [load]);

  // SSE: recibir nuevos registros en tiempo real
  useEffect(() => {
    const url = api(`/api/transfers/stream?horarioId=${encodeURIComponent(horarioId)}`);
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "transfer_created") {
          setTransfers(prev => {
            if (prev.some(t => t.id === msg.transfer.id)) return prev;
            return [...prev, msg.transfer];
          });
        } else if (msg.type === "transfer_updated") {
          setTransfers(prev =>
            prev.map(t => t.id === msg.transfer.id ? msg.transfer : t)
          );
        }
      } catch {}
    };
    return () => es.close();
  }, [horarioId]);

  async function handleAdd() {
    setAdding(true);
    try {
      const res = await fetch(api("/api/transfers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horarioId, sede: sedes[0] ?? "" }),
      });
      if (res.ok) {
        const row: Transfer = await res.json();
        setTransfers(prev => [...prev, row]);
      }
    } catch {}
    setAdding(false);
  }

  async function handlePatch(id: number, field: EditableField, value: string) {
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    try {
      await fetch(api(`/api/transfers/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {}
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await fetch(api(`/api/transfers/${id}`), { method: "DELETE" });
      setTransfers(prev => prev.filter(t => t.id !== id));
    } catch {}
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  const filtered = transfers.filter(t => {
    const q = search.toLowerCase();
    if (q && ![t.studentName, t.teacherBefore, t.teacherAfter, t.sede, t.subject, t.leavesClass, t.entersClass].some(v => v.toLowerCase().includes(q))) return false;
    if (filterType !== "all" && t.changeType !== filterType) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-200 to-rose-200 rounded-2xl flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5 text-rose-700" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Cambios de Curso</h1>
            <p className="text-xs text-muted-foreground">{horario.label} — {transfers.length} registro{transfers.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar alumno, profesor..."
              className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-xs border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Todos los tipos</option>
            {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {adding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Agregar fila
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <ArrowLeftRight className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Sin registros</p>
            <p className="text-muted-foreground/60 text-sm mt-1">Agrega una fila para registrar un cambio de curso.</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                {TEXT_COLS.map(col => (
                  <th key={col.key} className={`${col.width} px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60 whitespace-nowrap`}>
                    {col.label}
                  </th>
                ))}
                <th className="min-w-[160px] px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60 whitespace-nowrap">Tipo de cambio</th>
                <th className="min-w-[130px] px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/60 whitespace-nowrap">Razón de cambio</th>
                <th className="w-12 px-3 py-2.5 border-b border-border/60" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((t, idx) => (
                <tr key={t.id} className={`group hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                  {TEXT_COLS.map(col => (
                    <td key={col.key} className={`${col.width} px-1 py-0.5`}>
                      <EditableCell
                        value={t[col.key]}
                        onSave={v => handlePatch(t.id, col.key, v)}
                        placeholder={col.label}
                        isDate={col.key === "transferDate"}
                      />
                    </td>
                  ))}
                  <td className="min-w-[160px] px-2 py-1">
                    <SelectCell
                      value={t.changeType}
                      options={CHANGE_TYPES}
                      styles={TYPE_STYLES}
                      onSave={v => handlePatch(t.id, "changeType", v)}
                    />
                  </td>
                  <td className="min-w-[130px] px-2 py-1">
                    <SelectCell
                      value={t.changeReason}
                      options={CHANGE_REASONS}
                      styles={REASON_STYLES}
                      onSave={v => handlePatch(t.id, "changeReason", v)}
                    />
                  </td>
                  <td className="w-12 px-2 py-1">
                    {confirmDeleteId === t.id ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="px-2 py-0.5 text-[10px] font-bold bg-destructive text-white rounded-md hover:bg-destructive/80 transition-colors disabled:opacity-60 w-full"
                        >
                          {deletingId === t.id ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Sí"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 text-[10px] font-bold bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors w-full"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar fila"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer count ─────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="shrink-0 px-6 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
          Mostrando {filtered.length} de {transfers.length} registro{transfers.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
