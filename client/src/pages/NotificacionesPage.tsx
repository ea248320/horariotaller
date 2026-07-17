import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Notification } from '../lib/types';

const TYPE_ICON: Record<string, string> = {
  cupo_liberado: '🎟️',
  horario: '📅',
  info: 'ℹ️',
};

export function NotificacionesPage() {
  const { data, stale, refresh } = useCachedData<{ notifications: Notification[] }>(
    'notifications',
    '/notifications',
  );

  useRealtime(['notification'], () => void refresh());

  const markRead = async (id: number) => {
    await api(`/notifications/${id}/read`, { method: 'POST' });
    await refresh();
  };

  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    await refresh();
  };

  const items = data?.notifications ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Avisos</h1>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markAll()}
            className="text-sm font-medium text-primary hover:underline"
          >
            Marcar todos como leídos
          </button>
        )}
      </div>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <div className="mt-2 space-y-2">
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border p-4 ${
              n.read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">
                  <span className="mr-1" aria-hidden>
                    {TYPE_ICON[n.type] ?? 'ℹ️'}
                  </span>
                  {n.title}
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString('es-CL')}
                </p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Marcar leído
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
            Sin avisos por ahora. Aquí aparecerán los cupos liberados y otros eventos.
          </p>
        )}
      </div>
    </div>
  );
}
