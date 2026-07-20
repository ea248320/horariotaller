import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { apiUrl } from "@/lib/api";

export type NotifType = "cupo_disponible" | "tarea_asignada";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  horarioId: string;
  sede: string;
  // cupo_disponible fields
  classCode?: string;
  course?: string;
  day?: string;
  time?: string;
  cupos?: number;
  // tarea_asignada fields
  taskId?: number;
  taskTitle?: string;
  assignedTo?: string;
  priority?: string;
  deadline?: string;
}

interface Toast extends AppNotification {
  expiresAt: number;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: Toast[];
  unreadCount: number;
  removeNotification: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
  subscribeToSede: (horarioId: string, sede: string) => void;
  unsubscribeFromSede: () => void;
  addNotification: (notif: Omit<AppNotification, "id" | "read" | "timestamp">) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = "horario-notificaciones-v2";
const TOAST_DURATION = 7000;
const MAX_STORED = 200;

function loadStored(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function saveStored(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
  } catch {}
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sseRef = useRef<EventSource | null>(null);
  const currentChannelRef = useRef<string>("");

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    saveStored(notifications);
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timerRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback((notif: AppNotification) => {
    const toast: Toast = { ...notif, expiresAt: Date.now() + TOAST_DURATION };
    setToasts(prev => [...prev.slice(-4), toast]);
    const timer = setTimeout(() => dismissToast(notif.id), TOAST_DURATION);
    timerRef.current.set(notif.id, timer);
  }, [dismissToast]);

  // Generic add notification (used for task notifications from frontend)
  const addNotification = useCallback((partial: Omit<AppNotification, "id" | "read" | "timestamp">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const notif: AppNotification = {
      ...partial,
      id,
      read: false,
      timestamp: new Date().toISOString(),
    };
    setNotifications(prev => {
      // Avoid duplicate task notifications by taskId
      if (notif.taskId) {
        const exists = prev.some(n => n.type === "tarea_asignada" && n.taskId === notif.taskId);
        if (exists) return prev;
      }
      return [notif, ...prev];
    });
    pushToast(notif);
  }, [pushToast]);

  const addFromSSE = useCallback((data: {
    type: NotifType;
    horarioId: string;
    sede: string;
    classCode: string;
    course: string;
    day: string;
    time: string;
    cupos: number;
    timestamp: string;
  }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cupos = data.cupos ?? 1;
    const notif: AppNotification = {
      id,
      type: "cupo_disponible",
      title: "Cupo disponible",
      message: data.classCode,
      timestamp: data.timestamp,
      read: false,
      sede: data.sede,
      horarioId: data.horarioId,
      classCode: data.classCode,
      course: data.course,
      day: data.day,
      time: data.time,
      cupos,
    };
    setNotifications(prev => [notif, ...prev]);
    pushToast(notif);
  }, [pushToast]);

  const subscribeToSede = useCallback((horarioId: string, sede: string) => {
    const channel = `${horarioId}:${sede}`;
    if (currentChannelRef.current === channel) return;
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    currentChannelRef.current = channel;
    const url = apiUrl(`/api/notifications/stream?horarioId=${encodeURIComponent(horarioId)}&sede=${encodeURIComponent(sede)}`);
    const es = new EventSource(url);
    sseRef.current = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "cupo_disponible") addFromSSE(data);
      } catch {}
    };
    es.onerror = () => {};
  }, [addFromSSE]);

  const unsubscribeFromSede = useCallback(() => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    currentChannelRef.current = "";
  }, []);

  useEffect(() => {
    return () => { if (sseRef.current) sseRef.current.close(); };
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, toasts, unreadCount,
      removeNotification, markRead, markAllRead, clearAll,
      dismissToast, subscribeToSede, unsubscribeFromSede, addNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
