import { useState } from "react";
import { Bell, BellOff, Trash2, CheckCheck, CalendarCheck, ExternalLink, Settings2, ClipboardList, AlertCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications, type AppNotification } from "@/context/NotificationContext";
import { useHorario } from "@/context/HorarioContext";

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRIORITY_COLOR: Record<string, string> = {
  ALTA: "text-red-600",
  MEDIA: "text-amber-600",
  BAJA: "text-emerald-600",
};
const PRIORITY_LABEL: Record<string, string> = {
  ALTA: "Alta", MEDIA: "Media", BAJA: "Baja",
};

function NotifCard({ notif, onRemove, onMarkRead, onNavigate }: {
  notif: AppNotification;
  onRemove: () => void;
  onMarkRead: () => void;
  onNavigate: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isTask = notif.type === "tarea_asignada";

  function handleClick() {
    if (!notif.read) onMarkRead();
    onNavigate();
  }

  const accentUnread = isTask ? "bg-primary/5 border-primary/30 hover:border-primary/50" : "bg-green-50 border-green-200 hover:border-green-300";
  const accentDot = isTask ? "bg-primary" : "bg-green-500";
  const iconBg = notif.read ? "bg-muted" : isTask ? "bg-primary/10" : "bg-green-100";
  const iconColor = notif.read ? "text-muted-foreground" : isTask ? "text-primary" : "text-green-600";
  const labelColor = notif.read ? "text-muted-foreground" : isTask ? "text-primary" : "text-green-600";

  return (
    <div
      className={`relative flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
        notif.read ? "bg-muted/30 border-border/40 opacity-70 hover:opacity-90" : accentUnread
      }`}
      onClick={handleClick}
    >
      {!notif.read && (
        <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${accentDot}`} />
      )}
      <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
        {isTask
          ? <ClipboardList className={`w-4 h-4 ${iconColor}`} />
          : <CalendarCheck className={`w-4 h-4 ${iconColor}`} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
            {isTask ? "Tarea asignada" : "Cupo disponible"}
          </span>
          {notif.sede && (
            <span className="text-[10px] text-muted-foreground">· {notif.sede}</span>
          )}
        </div>

        {isTask ? (
          <>
            <p className={`text-sm font-semibold leading-tight ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>
              {notif.taskTitle || notif.message}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {notif.priority && (
                <span className={`flex items-center gap-1 text-xs font-medium ${notif.read ? "text-muted-foreground" : PRIORITY_COLOR[notif.priority] ?? "text-muted-foreground"}`}>
                  <AlertCircle className="w-3 h-3" />
                  Prioridad {PRIORITY_LABEL[notif.priority] ?? notif.priority}
                </span>
              )}
              {notif.deadline && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(notif.deadline).toLocaleDateString("es-CL")}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className={`text-sm font-bold font-mono tracking-wide leading-tight ${notif.read ? "text-muted-foreground" : "text-foreground"}`}>
              {notif.classCode || notif.message}
            </p>
            {(notif.cupos ?? 0) > 0 && (
              <p className={`text-xs mt-0.5 font-semibold ${notif.read ? "text-muted-foreground" : "text-green-700"}`}>
                {notif.cupos} cupo{notif.cupos !== 1 ? "s" : ""} libre{notif.cupos !== 1 ? "s" : ""}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-muted-foreground">{formatTimestamp(notif.timestamp)}</p>
          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${labelColor}`}>
            <ExternalLink className="w-3 h-3" />
            {isTask ? "Ver tareas" : "Ver curso"}
          </span>
        </div>
      </div>
      {confirmDelete ? (
        <div className="flex flex-col items-end gap-1 shrink-0 animate-in fade-in duration-150">
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="px-2 py-0.5 text-[11px] font-bold bg-destructive text-white rounded-lg hover:bg-destructive/80 transition-colors"
          >Sí</button>
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
            className="px-2 py-0.5 text-[11px] font-bold bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
          >No</button>
        </div>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
          className="shrink-0 p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
          title="Eliminar notificación"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { horarioId, horario } = useHorario();
  const { notifications, removeNotification, markRead } = useNotifications();
  const [, setLocation] = useLocation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const horarioSedes: string[] = horario.sedesInfo?.map((s: { name: string }) => s.name) ?? horario.sedes;

  const [notifsEnabled, setNotifsEnabled] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    for (const sede of horarioSedes) {
      result[sede] = localStorage.getItem(`notif-enabled:${horarioId}:${sede}`) !== "0";
    }
    return result;
  });

  function toggleSede(sede: string) {
    const newVal = !notifsEnabled[sede];
    localStorage.setItem(`notif-enabled:${horarioId}:${sede}`, newVal ? "1" : "0");
    setNotifsEnabled(prev => ({ ...prev, [sede]: newVal }));
  }

  function handleNavigate(notif: AppNotification) {
    if (notif.type === "tarea_asignada") {
      setLocation("/tareas");
      return;
    }
    const params = new URLSearchParams();
    params.set("open", notif.classCode || notif.message);
    if (notif.sede) params.set("sede", notif.sede);
    setLocation(`/horarios?${params.toString()}`);
  }

  function handleDeleteAll() {
    filtered.forEach(n => removeNotification(n.id));
    setConfirmingDelete(false);
  }

  const filtered = notifications.filter(n => n.horarioId === horarioId);
  const unread = filtered.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-200 to-emerald-200 rounded-2xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Notificaciones</h1>
            <p className="text-sm text-muted-foreground">{horario.label} — Cupos disponibles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={() => filtered.filter(n => !n.read).forEach(n => markRead(n.id))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar leídas
            </button>
          )}
          {filtered.length > 0 && (
            confirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">¿Eliminar todas?</span>
                <button
                  onClick={handleDeleteAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Sí, eliminar
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar todas
              </button>
            )
          )}
        </div>
      </div>

      {unread > 0 && (
        <div className="mb-4 px-4 py-2 rounded-2xl bg-green-50 border border-green-200 text-sm text-green-700 font-semibold">
          {unread} cupo{unread !== 1 ? "s" : ""} disponible{unread !== 1 ? "s" : ""} sin revisar
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-muted/50 rounded-3xl flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Sin notificaciones</p>
          <p className="text-muted-foreground/70 text-sm mt-1">Aparecerán aquí cuando queden cupos disponibles en una clase.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <NotifCard
              key={n.id}
              notif={n}
              onRemove={() => removeNotification(n.id)}
              onMarkRead={() => markRead(n.id)}
              onNavigate={() => handleNavigate(n)}
            />
          ))}
        </div>
      )}

      {/* ── Configuración de notificaciones por sede ─────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Configuración de notificaciones</span>
        </div>
        <div className="divide-y divide-border/30">
          {horarioSedes.map(sede => {
            const enabled = notifsEnabled[sede] ?? true;
            const displayName = sede.split(" ").map((w: string) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
            return (
              <div key={sede} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${enabled ? "bg-green-100" : "bg-muted"}`}>
                    {enabled
                      ? <Bell className="w-3.5 h-3.5 text-green-600" />
                      : <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{displayName}</p>
                    <p className={`text-xs ${enabled ? "text-green-600" : "text-muted-foreground"}`}>
                      {enabled ? "Notificaciones activas" : "Notificaciones desactivadas"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSede(sede)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    enabled ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                  aria-label={`${enabled ? "Desactivar" : "Activar"} notificaciones para ${displayName}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            Las preferencias se guardan en este navegador. Cada secretaria puede elegir su configuración de forma independiente.
          </p>
        </div>
      </div>
    </div>
  );
}
