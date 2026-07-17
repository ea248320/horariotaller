import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// Fetch con respaldo en localStorage: si el servidor no responde (caída del
// hosting), se muestra la última copia exitosa con un aviso de datos
// desactualizados en vez de romperse. Deliberadamente simple: solo lectura
// durante una caída, NO es offline-first (no se puede editar sin conexión).
export function useCachedData<T>(cacheKey: string, path: string) {
  const [data, setData] = useState<T | null>(() => {
    try {
      const raw = localStorage.getItem(`preuflow_cache:${cacheKey}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    try {
      const fresh = await api<T>(pathRef.current);
      setData(fresh);
      setStale(false);
      setError(null);
      try {
        localStorage.setItem(`preuflow_cache:${cacheKey}`, JSON.stringify(fresh));
      } catch {
        // localStorage lleno: seguimos sin caché
      }
    } catch (err) {
      // El servidor no respondió: mantener la copia local si existe.
      setStale(true);
      setError(err instanceof Error ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    void refresh();
  }, [refresh, path]);

  return { data, loading, stale, error, refresh };
}
