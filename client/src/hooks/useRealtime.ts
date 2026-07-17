import { useEffect, useRef } from 'react';
import { getToken } from '../lib/api';

// Conexión al canal SSE de la organización. Varias pestañas/secretarias ven
// los cambios en vivo sin recargar. EventSource reconecta solo al caerse.
export function useRealtime(events: string[], handler: (event: string, data: unknown) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const key = events.join(',');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    const names = key.split(',').filter(Boolean);
    const listeners = names.map((name) => {
      const listener = (e: MessageEvent) => {
        let data: unknown = {};
        try {
          data = JSON.parse(e.data);
        } catch {
          // sin payload
        }
        handlerRef.current(name, data);
      };
      source.addEventListener(name, listener);
      return { name, listener };
    });
    return () => {
      for (const { name, listener } of listeners) source.removeEventListener(name, listener);
      source.close();
    };
  }, [key]);
}
