import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Pin, PinOff, X } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useHorario } from "@/context/HorarioContext";
import { useCurrentUser } from "@/context/UserContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Nota {
  id: number;
  horario_id: string;
  autor: string;
  titulo: string;
  contenido: string;
  color: string;
  pinned: number;
  updated_at: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS: { key: string; bg: string; border: string; dot: string; header: string }[] = [
  { key: "amarillo", bg: "bg-yellow-50",  border: "border-yellow-300", dot: "bg-yellow-400",  header: "bg-yellow-100" },
  { key: "verde",    bg: "bg-emerald-50", border: "border-emerald-300",dot: "bg-emerald-400", header: "bg-emerald-100" },
  { key: "azul",     bg: "bg-sky-50",     border: "border-sky-300",    dot: "bg-sky-400",     header: "bg-sky-100" },
  { key: "rosa",     bg: "bg-pink-50",    border: "border-pink-300",   dot: "bg-pink-400",    header: "bg-pink-100" },
  { key: "lila",     bg: "bg-violet-50",  border: "border-violet-300", dot: "bg-violet-400",  header: "bg-violet-100" },
];

function getColor(key: string) {
  return COLORS.find(c => c.key === key) ?? COLORS[0];
}

// ─── Nota Card ────────────────────────────────────────────────────────────────

function NotaCard({
  nota,
  canDelete,
  onUpdate,
  onDelete,
  onTogglePin,
}: {
  nota: Nota;
  canDelete: boolean;
  onUpdate: (id: number, patch: Partial<Nota>) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number, pinned: boolean) => void;
}) {
  const col = getColor(nota.color);
  const [titulo, setTitulo] = useState(nota.titulo);
  const [contenido, setContenido] = useState(nota.contenido);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent updates
  useEffect(() => { setTitulo(nota.titulo); }, [nota.titulo]);
  useEffect(() => { setContenido(nota.contenido); }, [nota.contenido]);

  function schedSave(patch: Partial<Nota>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(nota.id, patch), 700);
  }

  return (
    <div className={`rounded-2xl border-2 ${col.bg} ${col.border} flex flex-col shadow-sm hover:shadow-md transition-shadow group`}>
      {/* Header bar */}
      <div className={`${col.header} rounded-t-xl px-3 py-2 flex items-center justify-between gap-2`}>
        {/* Color picker */}
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => onUpdate(nota.id, { color: c.key })}
              className={`w-4 h-4 rounded-full ${c.dot} transition-transform hover:scale-125 ${nota.color === c.key ? "ring-2 ring-offset-1 ring-gray-400 scale-125" : ""}`}
              title={c.key}
            />
          ))}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTogglePin(nota.id, !nota.pinned)}
            title={nota.pinned ? "Desfijar" : "Fijar arriba"}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {nota.pinned ? <Pin className="w-3.5 h-3.5 text-foreground" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(nota.id)}
              className="text-muted-foreground hover:text-red-500 transition-colors"
              title="Eliminar nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <input
          value={titulo}
          onChange={e => { setTitulo(e.target.value); schedSave({ titulo: e.target.value }); }}
          placeholder="Título…"
          className={`w-full bg-transparent border-none outline-none text-sm font-bold text-foreground placeholder:text-muted-foreground/50 leading-snug`}
        />
        <textarea
          value={contenido}
          onChange={e => { setContenido(e.target.value); schedSave({ contenido: e.target.value }); }}
          placeholder="Escribe tu nota aquí…"
          rows={4}
          className={`w-full bg-transparent border-none outline-none resize-none text-sm text-foreground/90 placeholder:text-muted-foreground/40 leading-relaxed flex-1`}
        />
      </div>

      {/* Footer */}
      {nota.autor && (
        <div className={`px-3 pb-2 text-[10px] text-muted-foreground/60 flex items-center justify-between`}>
          <span>{nota.autor}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotasPage() {
  const { horarioId } = useHorario();
  const { currentUser } = useCurrentUser();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotas = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/notas?horarioId=${horarioId}`));
      if (r.ok) setNotas(await r.json());
    } catch {}
    setLoading(false);
  }, [horarioId]);

  useEffect(() => { loadNotas(); }, [loadNotas]);

  async function handleCreate() {
    const r = await fetch(apiUrl("/api/notas"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        horarioId,
        autor: currentUser?.name ?? "",
        titulo: "",
        contenido: "",
        color: COLORS[Math.floor(Math.random() * COLORS.length)].key,
      }),
    });
    if (r.ok) {
      const nota = await r.json();
      setNotas(prev => [nota, ...prev]);
    }
  }

  async function handleUpdate(id: number, patch: Partial<Nota>) {
    setNotas(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
    await fetch(apiUrl(`/api/notas/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    setNotas(prev => prev.filter(n => n.id !== id));
    await fetch(apiUrl(`/api/notas/${id}`), { method: "DELETE" });
  }

  async function handleTogglePin(id: number, pinned: boolean) {
    await handleUpdate(id, { pinned: pinned ? 1 : 0 });
    // Re-sort: pinned first
    setNotas(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, pinned: pinned ? 1 : 0 } : n);
      return [...updated].sort((a, b) => (b.pinned - a.pinned));
    });
  }

  const canDelete = !!currentUser && (currentUser.role === "admin" || currentUser.role === "secretaria");
  const pinnedNotas = notas.filter(n => n.pinned);
  const normalNotas = notas.filter(n => !n.pinned);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Notas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Apuntes rápidos para tu sede</p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva nota
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="text-5xl">📝</div>
            <p className="text-muted-foreground font-medium">No hay notas todavía</p>
            <p className="text-sm text-muted-foreground/70">Haz clic en "Nueva nota" para empezar</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pinned */}
            {pinnedNotas.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  <Pin className="w-3.5 h-3.5" /> Fijadas
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pinnedNotas.map(nota => (
                    <NotaCard
                      key={nota.id}
                      nota={nota}
                      canDelete={canDelete}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Normal */}
            {normalNotas.length > 0 && (
              <div className="space-y-3">
                {pinnedNotas.length > 0 && (
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Todas las notas
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {normalNotas.map(nota => (
                    <NotaCard
                      key={nota.id}
                      nota={nota}
                      canDelete={canDelete}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
