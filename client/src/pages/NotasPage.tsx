import { useState } from 'react';
import { Pin, PinOff, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Note } from '../lib/types';

const NOTE_COLORS: Record<string, string> = {
  amarillo: 'bg-yellow-100 border-yellow-300 text-yellow-950 dark:bg-yellow-500/15 dark:border-yellow-500/40 dark:text-yellow-100',
  rosa: 'bg-pink-100 border-pink-300 text-pink-950 dark:bg-pink-500/15 dark:border-pink-500/40 dark:text-pink-100',
  verde: 'bg-emerald-100 border-emerald-300 text-emerald-950 dark:bg-emerald-500/15 dark:border-emerald-500/40 dark:text-emerald-100',
  celeste: 'bg-sky-100 border-sky-300 text-sky-950 dark:bg-sky-500/15 dark:border-sky-500/40 dark:text-sky-100',
};

const COLOR_DOT: Record<string, string> = {
  amarillo: 'bg-yellow-400',
  rosa: 'bg-pink-400',
  verde: 'bg-emerald-400',
  celeste: 'bg-sky-400',
};

// Notas rápidas compartidas tipo post-it (portado de Emilia).
export function NotasPage() {
  const { data, stale, refresh } = useCachedData<{ notes: Note[] }>('notes', '/notes');
  useRealtime(['notes:changed'], () => void refresh());

  const [form, setForm] = useState({ titulo: '', contenido: '', autor: '', color: 'amarillo' });
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/notes', { method: 'POST', body: form });
      setForm({ titulo: '', contenido: '', autor: form.autor, color: form.color });
    });
  };

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
        <StickyNote className="h-6 w-6 text-primary" />
        Notas del equipo
      </h1>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <form onSubmit={create} className="mt-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            placeholder="Título"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            placeholder="Tu nombre"
            value={form.autor}
            onChange={(e) => setForm({ ...form, autor: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            {Object.keys(NOTE_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setForm({ ...form, color: c })}
                className={`h-7 w-7 rounded-full ${COLOR_DOT[c]} ${form.color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''}`}
              />
            ))}
          </div>
        </div>
        <textarea
          required
          placeholder="Escribe la nota…"
          value={form.contenido}
          onChange={(e) => setForm({ ...form, contenido: e.target.value })}
          rows={2}
          className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="mt-2 flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Publicar nota
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.notes ?? []).map((note) => (
          <div
            key={note.id}
            className={`relative rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${NOTE_COLORS[note.color] ?? NOTE_COLORS.amarillo}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display font-bold">{note.titulo || 'Sin título'}</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  title={note.pinned ? 'Desfijar' : 'Fijar arriba'}
                  onClick={() =>
                    void run(() => api(`/notes/${note.id}`, { method: 'PATCH', body: { pinned: !note.pinned } }))
                  }
                  className="opacity-60 hover:opacity-100"
                >
                  {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={() => {
                    if (window.confirm('¿Eliminar esta nota?')) {
                      void run(() => api(`/notes/${note.id}`, { method: 'DELETE' }));
                    }
                  }}
                  className="opacity-60 hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{note.contenido}</p>
            <p className="mt-3 text-xs opacity-70">
              {note.autor ? `${note.autor} · ` : ''}
              {new Date(note.createdAt).toLocaleDateString('es-CL')}
              {note.pinned ? ' · 📌 fijada' : ''}
            </p>
          </div>
        ))}
        {(data?.notes ?? []).length === 0 && (
          <p className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Aún no hay notas. Escribe la primera arriba.
          </p>
        )}
      </div>
    </div>
  );
}
