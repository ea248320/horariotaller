import { useState, useEffect, useCallback } from "react";
import {
  Plus, CheckSquare, Square, Trash2, ChevronDown, ChevronUp,
  Calendar, User, Flag, Building2, X, ClipboardList, Lock,
  AlertCircle, Clock, CheckCircle2, Filter, KanbanSquare, List
} from "lucide-react";
import { apiUrl } from "@/lib/api";
import { useHorario } from "@/context/HorarioContext";
import { useCurrentUser, UserAvatar } from "@/context/UserContext";
import { useNotifications } from "@/context/NotificationContext";

type Priority = "ALTA" | "MEDIA" | "BAJA";
type Status = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA";

interface TaskItem {
  id: number;
  taskId: number;
  text: string;
  completed: number;
  sortOrder: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  horarioId: string;
  assignedTo: string;
  deadline: string;
  priority: Priority;
  status: Status;
  createdBy: string;
  isPersonal: number;
  personalOwner: string;
  items: TaskItem[];
  createdAt: string;
}

const SEDES = [
  { id: "TEMUCO", label: "Temuco" },
  { id: "ALMAGRO", label: "D. Almagro" },
  { id: "VILLARRICA", label: "Villarrica" },
  { id: "AV_ALEMANIA", label: "Av. Alemania" },
];

const STATUSES: { value: Status; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: "PENDIENTE", label: "Pendiente", icon: AlertCircle, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800" },
  { value: "EN_PROGRESO", label: "En Progreso", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  { value: "COMPLETADA", label: "Completada", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
];

const PRIORITIES: { value: Priority; label: string; color: string; dot: string }[] = [
  { value: "ALTA", label: "Alta", color: "text-red-600", dot: "bg-red-500" },
  { value: "MEDIA", label: "Media", color: "text-amber-600", dot: "bg-amber-500" },
  { value: "BAJA", label: "Baja", color: "text-emerald-600", dot: "bg-emerald-500" },
];

function deadlineColor(deadline: string): string {
  if (!deadline) return "text-muted-foreground";
  const now = new Date();
  const d = new Date(deadline);
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "text-red-600 font-semibold";
  if (diff <= 3) return "text-amber-500 font-semibold";
  return "text-emerald-600";
}

function deadlineBadge(deadline: string): string {
  if (!deadline) return "";
  const now = new Date();
  const d = new Date(deadline);
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "Vencida";
  if (diff <= 1) return "Hoy / Mañana";
  if (diff <= 3) return "Pronto";
  return "";
}

function formatDate(str: string): string {
  if (!str) return "";
  const d = new Date(str + "T12:00:00");
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function ChecklistBar({ items }: { items: TaskItem[] }) {
  if (!items.length) return null;
  const done = items.filter((i) => i.completed).length;
  const pct = Math.round((done / items.length) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{done}/{items.length}</span>
    </div>
  );
}

// ─── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({
  task,
  isAdmin,
  onUpdate,
  onDelete,
  onToggleItem,
  onAddItem,
  onDeleteItem,
}: {
  task: Task;
  isAdmin: boolean;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDelete: (id: number) => void;
  onToggleItem: (taskId: number, itemId: number, completed: boolean) => void;
  onAddItem: (taskId: number, text: string) => void;
  onDeleteItem: (taskId: number, itemId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);

  const prio = PRIORITIES.find((p) => p.value === task.priority)!;
  const statusInfo = STATUSES.find((s) => s.value === task.status)!;
  const sede = SEDES.find((s) => s.id === task.horarioId);
  const badge = deadlineBadge(task.deadline);

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    onAddItem(task.id, newItem.trim());
    setNewItem("");
  };

  const nextStatus = (): Status => {
    if (task.status === "PENDIENTE") return "EN_PROGRESO";
    if (task.status === "EN_PROGRESO") return "COMPLETADA";
    return "PENDIENTE";
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 ${
        task.status === "COMPLETADA" ? "opacity-70" : ""
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <button
            onClick={() => onUpdate(task.id, { status: nextStatus() })}
            className="mt-0.5 shrink-0 transition-transform hover:scale-110"
            title="Cambiar estado"
          >
            {task.status === "COMPLETADA" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : task.status === "EN_PROGRESO" ? (
              <Clock className="w-5 h-5 text-amber-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-slate-400" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3
              className={`font-semibold text-sm leading-snug ${
                task.status === "COMPLETADA" ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </h3>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${prio.color} bg-opacity-10`}
              style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
              {prio.label}
            </span>
            {(isAdmin || true) && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
          {isAdmin && sede && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {sede.label}
            </span>
          )}
          {task.assignedTo && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.assignedTo}
            </span>
          )}
          {task.deadline && (
            <span className={`flex items-center gap-1 ${deadlineColor(task.deadline)}`}>
              <Calendar className="w-3 h-3" />
              {formatDate(task.deadline)}
              {badge && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                  {badge}
                </span>
              )}
            </span>
          )}
          {task.isPersonal === 1 && (
            <span className="flex items-center gap-1 text-primary">
              <Lock className="w-3 h-3" />
              Personal
            </span>
          )}
        </div>

        {/* Checklist bar */}
        <ChecklistBar items={task.items} />

        {/* Expand toggle */}
        {(task.items.length > 0 || task.description) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Ocultar" : `Ver detalles${task.items.length > 0 ? ` (${task.items.length} ítems)` : ""}`}
          </button>
        )}
      </div>

      {/* Expanded checklist */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
          {task.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 group">
              <button
                onClick={() => onToggleItem(task.id, item.id, !item.completed)}
                className="shrink-0 transition-transform hover:scale-110"
              >
                {item.completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Square className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              <span
                className={`flex-1 text-sm ${
                  item.completed ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => onDeleteItem(task.id, item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Agregar ítem al checklist…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1 text-sm px-3 py-1.5 bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={handleAddItem}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Status selector */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => onUpdate(task.id, { status: s.value })}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors ${
                  task.status === s.value
                    ? `${s.bg} ${s.color} ring-1 ring-current/30`
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────
function CreateTaskModal({
  isAdmin,
  currentHorarioId,
  onClose,
  onCreate,
}: {
  isAdmin: boolean;
  currentHorarioId: string;
  onClose: () => void;
  onCreate: (task: Task) => void;
}) {
  const { currentUser } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [horarioId, setHorarioId] = useState(isAdmin ? "TEMUCO" : currentHorarioId);
  const [assignedTo, setAssignedTo] = useState(currentUser?.name ?? "");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIA");
  const [items, setItems] = useState<string[]>([""]);
  const [isPersonal, setIsPersonal] = useState(false);
  const [personalOwner, setPersonalOwner] = useState(currentUser?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{id:number;name:string;color:string}>>([]);

  useEffect(() => {
    fetch(apiUrl(`/api/team?horarioId=${currentHorarioId}`))
      .then(r => r.json())
      .then(d => Array.isArray(d) && setTeamMembers(d))
      .catch(() => {});
  }, [currentHorarioId]);

  const handleSubmit = async () => {
    setTouched(true);
    if (!title.trim()) {
      setError("El título es obligatorio para crear la tarea.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          horarioId,
          assignedTo: assignedTo.trim(),
          deadline,
          priority,
          status: "PENDIENTE",
          createdBy: isAdmin ? "Admin" : "Secretaria",
          isPersonal: isPersonal ? 1 : 0,
          personalOwner: isPersonal ? personalOwner : "",
          items: items.filter((i) => i.trim()),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error del servidor (${res.status})`);
      }
      const created = await res.json();
      onCreate(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear la tarea. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-foreground">Nueva Tarea</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Revisar listas de asistencia…"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (error) setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoFocus
                className={`w-full px-4 py-2.5 bg-background border rounded-xl text-sm focus:outline-none focus:ring-2 transition-colors ${
                  touched && !title.trim()
                    ? "border-red-400 focus:ring-red-300"
                    : "border-border focus:ring-primary/30"
                }`}
              />
              {touched && !title.trim() && (
                <p className="text-xs text-red-500 mt-1">Escribe un título para continuar</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Descripción
              </label>
              <textarea
                placeholder="Detalles adicionales…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            {/* Sede + Priority row */}
            <div className="grid grid-cols-2 gap-3">
              {isAdmin && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Sede
                  </label>
                  <select
                    value={horarioId}
                    onChange={(e) => setHorarioId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {SEDES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={isAdmin ? "" : "col-span-2"}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Prioridad
                </label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        priority === p.value
                          ? `${p.color} bg-current/10 ring-1 ring-current/30`
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Assigned + Deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Asignar a
                </label>
                {teamMembers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAssignedTo("")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all ${!assignedTo ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      Sin asignar
                    </button>
                    {teamMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setAssignedTo(m.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-sm border transition-all ${assignedTo === m.name ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground hover:border-primary/50"}`}
                      >
                        <UserAvatar name={m.name} color={m.color} size="xs" />
                        <span className="font-medium">{m.name.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Nombre (opcional)"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Personal note toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPersonal(!isPersonal)}
                className={`w-10 h-6 rounded-full transition-colors ${isPersonal ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
                    isPersonal ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-foreground">Nota personal (solo yo la veo)</span>
            </div>
            {isPersonal && (
              <input
                type="text"
                placeholder="Tu nombre (para identificar tu nota)"
                value={personalOwner}
                onChange={(e) => setPersonalOwner(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}

            {/* Checklist */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Checklist inicial
              </label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Ítem ${idx + 1}…`}
                      value={item}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = e.target.value;
                        setItems(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setItems([...items, ""]);
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {items.length > 1 && (
                      <button
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="p-2 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setItems([...items, ""])}
                  className="flex items-center gap-2 text-xs text-primary hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Agregar ítem
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear Tarea"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  status,
  tasks,
  isAdmin,
  onUpdate,
  onDelete,
  onToggleItem,
  onAddItem,
  onDeleteItem,
}: {
  status: (typeof STATUSES)[number];
  tasks: Task[];
  isAdmin: boolean;
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDelete: (id: number) => void;
  onToggleItem: (taskId: number, itemId: number, completed: boolean) => void;
  onAddItem: (taskId: number, text: string) => void;
  onDeleteItem: (taskId: number, itemId: number) => void;
}) {
  return (
    <div className={`rounded-2xl p-4 ${status.bg} flex flex-col gap-3 min-h-48`}>
      <div className="flex items-center gap-2">
        <status.icon className={`w-4 h-4 ${status.color}`} />
        <span className={`font-semibold text-sm ${status.color}`}>{status.label}</span>
        <span className="ml-auto text-xs font-bold bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Sin tareas</p>
      )}
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggleItem={onToggleItem}
          onAddItem={onAddItem}
          onDeleteItem={onDeleteItem}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TareasPage() {
  const { horarioId } = useHorario();
  const { currentUser } = useCurrentUser();
  const { addNotification } = useNotifications();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [filterStatus, setFilterStatus] = useState<Status | "TODAS">("TODAS");
  const [filterHorario, setFilterHorario] = useState<string>("TODAS");
  const [filterPriority, setFilterPriority] = useState<Priority | "TODAS">("TODAS");
  const [showPersonal, setShowPersonal] = useState(false);
  const [filterMine, setFilterMine] = useState(false);
  const myName = currentUser?.name ?? "";

  // Generate in-app notifications for tasks assigned to current user
  useEffect(() => {
    if (!myName || tasks.length === 0) return;
    const myTasks = tasks.filter(t =>
      t.assignedTo === myName && t.status !== "COMPLETADA"
    );
    myTasks.forEach(task => {
      addNotification({
        type: "tarea_asignada",
        title: "Tarea asignada a ti",
        message: task.title,
        horarioId: task.horarioId,
        sede: task.horarioId,
        taskId: task.id,
        taskTitle: task.title,
        assignedTo: myName,
        priority: task.priority,
        deadline: task.deadline ?? undefined,
      });
    });
  // Only run when tasks change and we have a user
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, myName]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let url = apiUrl("/api/tasks");
      if (adminMode) {
        url += "?horarioId=ADMIN";
      } else if (showPersonal && myName) {
        url += `?horarioId=${horarioId}&personalOwner=${encodeURIComponent(myName)}`;
      } else {
        url += `?horarioId=${horarioId}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [horarioId, adminMode, showPersonal, myName]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleUpdate = async (id: number, patch: Partial<Task>) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    await fetch(apiUrl(`/api/tasks/${id}`), { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleItem = async (taskId: number, itemId: number, completed: boolean) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${taskId}/items/${itemId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: completed ? 1 : 0 }),
      });
      const updated = await res.json();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, items: t.items.map((i) => (i.id === itemId ? updated : i)) } : t
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = async (taskId: number, text: string) => {
    try {
      const res = await fetch(apiUrl(`/api/tasks/${taskId}/items`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const item = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, items: [...t.items, item] } : t))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (taskId: number, itemId: number) => {
    await fetch(apiUrl(`/api/tasks/${taskId}/items/${itemId}`), { method: "DELETE" });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t
      )
    );
  };

  const handleAdminLogin = () => {
    if (adminPassword === "admin123" || adminPassword === "admin") {
      setIsAdmin(true);
      setAdminMode(true);
      setAdminError(false);
    } else {
      setAdminError(true);
    }
  };


  // My pending tasks count for banner
  const myPendingTasks = myName
    ? tasks.filter(t => t.assignedTo === myName && t.status !== "COMPLETADA")
    : [];

  // Filtered tasks
  const filtered = tasks.filter((t) => {
    if (filterMine && t.assignedTo !== myName) return false;
    if (filterStatus !== "TODAS" && t.status !== filterStatus) return false;
    if (filterHorario !== "TODAS" && t.horarioId !== filterHorario) return false;
    if (filterPriority !== "TODAS" && t.priority !== filterPriority) return false;
    return true;
  });

  // Dashboard stats
  const overdue = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "COMPLETADA"
  ).length;
  const urgent = tasks.filter((t) => {
    if (!t.deadline || t.status === "COMPLETADA") return false;
    const diff = (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }).length;
  const completedCount = tasks.filter((t) => t.status === "COMPLETADA").length;

  const sede = SEDES.find((s) => s.id === horarioId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-md">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Tareas</h1>
            <p className="text-sm text-muted-foreground">
              {adminMode ? "Vista Admin — todas las sedes" : `${sede?.label ?? horarioId}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
          {/* Mis tareas filter */}
          {!adminMode && myName && (
            <button
              onClick={() => setFilterMine(!filterMine)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative ${
                filterMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <User className="w-4 h-4" />
              Mis tareas
              {myPendingTasks.length > 0 && !filterMine && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {myPendingTasks.length}
                </span>
              )}
            </button>
          )}

          {/* Personal toggle */}
          {!adminMode && (
            <button
              onClick={() => setShowPersonal(!showPersonal)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                showPersonal ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Lock className="w-4 h-4" />
              Mis notas
            </button>
          )}

          {/* Admin toggle */}
          {isAdmin ? (
            <button
              onClick={() => { setAdminMode(!adminMode); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                adminMode ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
              }`}
            >
              <Flag className="w-4 h-4" />
              {adminMode ? "Admin activo" : "Modo admin"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Clave admin"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setAdminError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                className={`w-32 px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  adminError ? "border-red-400 bg-red-50" : "border-border bg-background"
                }`}
              />
              <button
                onClick={handleAdminLogin}
                className="px-3 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Entrar
              </button>
            </div>
          )}

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        </div>
      </div>

      {/* Personal note filter indicator */}
      {showPersonal && myName && (
        <div className="mb-4 flex items-center gap-2 text-sm text-primary">
          <Lock className="w-4 h-4" />
          Mostrando notas personales de <strong>{myName}</strong>
        </div>
      )}
      {showPersonal && !myName && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          Selecciona tu usuario en el navbar para ver tus notas personales.
        </div>
      )}

      {/* My tasks summary banner */}
      {myPendingTasks.length > 0 && !filterMine && !adminMode && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Tienes {myPendingTasks.length} tarea{myPendingTasks.length !== 1 ? "s" : ""} pendiente{myPendingTasks.length !== 1 ? "s" : ""} asignada{myPendingTasks.length !== 1 ? "s" : ""} a ti
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {myPendingTasks.slice(0, 3).map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium truncate max-w-[160px]">
                    {t.priority === "ALTA" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                    {t.priority === "MEDIA" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                    {t.priority === "BAJA" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                    {t.title}
                  </span>
                ))}
                {myPendingTasks.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{myPendingTasks.length - 3} más</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setFilterMine(true)}
            className="shrink-0 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Ver mis tareas
          </button>
        </div>
      )}

      {/* "Mis tareas" active indicator */}
      {filterMine && (
        <div className="mb-4 flex items-center gap-2 text-sm text-primary">
          <User className="w-4 h-4" />
          Mostrando tareas asignadas a <strong>{myName}</strong>
          <button
            onClick={() => setFilterMine(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
          >
            ver todas
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: tasks.length, color: "text-foreground", bg: "bg-card" },
          { label: "Completadas", value: completedCount, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Vencidas", value: overdue, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: "Por vencer", value: urgent, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-border rounded-2xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Per-campus summary (admin only) */}
      {adminMode && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {SEDES.map((s) => {
            const count = tasks.filter((t) => t.horarioId === s.id).length;
            const done = tasks.filter((t) => t.horarioId === s.id && t.status === "COMPLETADA").length;
            return (
              <div key={s.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="font-semibold text-sm text-foreground">{s.label}</div>
                <div className="text-2xl font-bold text-primary mt-1">{count}</div>
                <div className="text-xs text-muted-foreground">{done} completadas</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters & view toggle */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />

        {/* Status filter */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {["TODAS", ...STATUSES.map((s) => s.value)].map((val) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val as Status | "TODAS")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === val ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {val === "TODAS" ? "Todas" : STATUSES.find((s) => s.value === val)?.label}
            </button>
          ))}
        </div>

        {/* Horario filter (admin) */}
        {adminMode && (
          <select
            value={filterHorario}
            onChange={(e) => setFilterHorario(e.target.value)}
            className="px-3 py-1.5 bg-muted rounded-xl text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="TODAS">Todas las sedes</option>
            {SEDES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | "TODAS")}
          className="px-3 py-1.5 bg-muted rounded-xl text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="TODAS">Todas las prioridades</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {/* View mode */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 ml-auto">
          <button
            onClick={() => setViewMode("kanban")}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === "kanban" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            <KanbanSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-card shadow text-primary" : "text-muted-foreground"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status.value}
              status={status}
              tasks={filtered.filter((t) => t.status === status.value)}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onToggleItem={handleToggleItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16">Sin tareas que mostrar</p>
          )}
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onToggleItem={handleToggleItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal
          isAdmin={isAdmin}
          currentHorarioId={horarioId}
          onClose={() => setShowCreate(false)}
          onCreate={(task) => setTasks((prev) => [task, ...prev])}
        />
      )}
    </div>
  );
}
