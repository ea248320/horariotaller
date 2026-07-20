import { X, CalendarCheck, ClipboardList } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications, type AppNotification } from "@/context/NotificationContext";

function ToastCard({ toast, onDismiss, onNavigate }: {
  toast: AppNotification;
  onDismiss: () => void;
  onNavigate: () => void;
}) {
  const isTask = toast.type === "tarea_asignada";

  return (
    <div
      className={`flex items-start gap-3 w-72 rounded-2xl border shadow-lg p-3.5 animate-in slide-in-from-right-full duration-300 cursor-pointer hover:shadow-xl transition-all ${
        isTask
          ? "border-primary/30 bg-primary/5 hover:border-primary/50"
          : "border-green-200 bg-green-50 hover:border-green-300"
      }`}
      onClick={onNavigate}
    >
      <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
        isTask ? "bg-primary/15" : "bg-green-100"
      }`}>
        {isTask
          ? <ClipboardList className="w-3.5 h-3.5 text-primary" />
          : <CalendarCheck className="w-3.5 h-3.5 text-green-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-wide leading-none mb-1 ${
          isTask ? "text-primary" : "text-green-600"
        }`}>
          {isTask ? "Tarea asignada" : `Cupo disponible${toast.sede ? ` · ${toast.sede}` : ""}`}
        </p>
        <p className={`text-sm font-semibold leading-tight ${isTask ? "text-foreground" : "text-green-900 font-mono tracking-wide font-bold"}`}>
          {isTask ? (toast.taskTitle || toast.message) : (toast.classCode || toast.message)}
        </p>
        {!isTask && (toast.cupos ?? 0) > 0 && (
          <p className="text-xs text-green-700 mt-0.5">
            {toast.cupos} cupo{toast.cupos !== 1 ? "s" : ""} libre{toast.cupos !== 1 ? "s" : ""}
          </p>
        )}
        <p className={`text-[10px] mt-1 font-medium ${isTask ? "text-primary/70" : "text-green-600/70"}`}>
          {isTask ? "Toca para ver tus tareas →" : "Toca para ver el curso →"}
        </p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        className={`shrink-0 p-1 rounded-lg transition-colors ${
          isTask ? "hover:bg-primary/10 text-primary/60" : "hover:bg-green-100 text-green-500"
        }`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();
  const [, setLocation] = useLocation();

  if (toasts.length === 0) return null;

  function handleNavigate(toast: AppNotification) {
    dismissToast(toast.id);
    if (toast.type === "tarea_asignada") {
      setLocation("/tareas");
      return;
    }
    const params = new URLSearchParams();
    params.set("open", toast.classCode || toast.message);
    if (toast.sede) params.set("sede", toast.sede);
    setLocation(`/horarios?${params.toString()}`);
  }

  return (
    <div className="fixed top-24 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard
            toast={t}
            onDismiss={() => dismissToast(t.id)}
            onNavigate={() => handleNavigate(t)}
          />
        </div>
      ))}
    </div>
  );
}
