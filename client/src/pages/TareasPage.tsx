import { useState } from 'react';
import { CheckCircle2, Circle, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Task } from '../lib/types';

const PRIORITY_STYLE: Record<string, string> = {
  ALTA: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  MEDIA: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  BAJA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

const STATUS_NEXT: Record<string, Task['status']> = {
  PENDIENTE: 'EN CURSO',
  'EN CURSO': 'COMPLETADA',
  COMPLETADA: 'PENDIENTE',
};

const STATUS_STYLE: Record<string, string> = {
  PENDIENTE: 'bg-muted text-muted-foreground',
  'EN CURSO': 'bg-primary/10 text-primary',
  COMPLETADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

// Tareas del equipo (portado de Emilia): prioridad, estado y checklist.
export function TareasPage() {
  const { data, stale, refresh } = useCachedData<{ tasks: Task[] }>('tasks', '/tasks');
  useRealtime(['tasks:changed'], () => void refresh());

  const [form, setForm] = useState({ title: '', assignedTo: '', deadline: '', priority: 'MEDIA' });
  const [filter, setFilter] = useState<'todas' | 'pendientes' | 'completadas'>('todas');
  const [itemText, setItemText] = useState<Record<number, string>>({});
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
      await api('/tasks', { method: 'POST', body: form });
      setForm({ title: '', assignedTo: '', deadline: '', priority: 'MEDIA' });
    });
  };

  const tasks = (data?.tasks ?? []).filter((t) => {
    if (filter === 'pendientes') return t.status !== 'COMPLETADA';
    if (filter === 'completadas') return t.status === 'COMPLETADA';
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardList className="h-6 w-6 text-primary" />
          Tareas del equipo
        </h1>
        <div className="flex rounded-xl border border-border bg-muted p-0.5 text-xs font-semibold">
          {(['todas', 'pendientes', 'completadas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 capitalize transition ${
                filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <form onSubmit={create} className="mt-2 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-5">
        <input
          required
          placeholder="Nueva tarea *"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          placeholder="Responsable"
          value={form.assignedTo}
          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="rounded-xl border border-input bg-card px-2 py-2 text-sm"
          >
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Crear
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className={`font-semibold text-foreground ${task.status === 'COMPLETADA' ? 'line-through opacity-60' : ''}`}>
                  {task.title}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${PRIORITY_STYLE[task.priority]}`}>
                    {task.priority}
                  </span>
                  <button
                    type="button"
                    title="Clic para cambiar estado"
                    onClick={() =>
                      void run(() =>
                        api(`/tasks/${task.id}`, { method: 'PATCH', body: { status: STATUS_NEXT[task.status] } }),
                      )
                    }
                    className={`rounded-full px-2 py-0.5 font-bold ${STATUS_STYLE[task.status]}`}
                  >
                    {task.status}
                  </button>
                  {task.assignedTo && <span className="text-muted-foreground">· {task.assignedTo}</span>}
                  {task.deadline && <span className="text-muted-foreground">· vence {task.deadline}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la tarea "${task.title}"?`)) {
                    void run(() => api(`/tasks/${task.id}`, { method: 'DELETE' }));
                  }
                }}
                className="text-muted-foreground hover:text-red-600"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {/* Checklist */}
            <ul className="mt-3 space-y-1.5">
              {task.items.map((item) => (
                <li key={item.id} className="group flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => void run(() => api(`/tasks/items/${item.id}`, { method: 'PATCH', body: {} }))}
                    className={item.completed ? 'text-emerald-600' : 'text-muted-foreground hover:text-primary'}
                  >
                    {item.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <span className={item.completed ? 'text-muted-foreground line-through' : 'text-foreground'}>
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => void run(() => api(`/tasks/items/${item.id}`, { method: 'DELETE' }))}
                    className="ml-auto hidden text-muted-foreground hover:text-red-600 group-hover:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = (itemText[task.id] ?? '').trim();
                if (!text) return;
                void run(async () => {
                  await api(`/tasks/${task.id}/items`, { method: 'POST', body: { text } });
                  setItemText({ ...itemText, [task.id]: '' });
                });
              }}
              className="mt-2 flex gap-2"
            >
              <input
                placeholder="Agregar paso…"
                value={itemText[task.id] ?? ''}
                onChange={(e) => setItemText({ ...itemText, [task.id]: e.target.value })}
                className="flex-1 rounded-xl border border-input bg-card px-3 py-1.5 text-sm"
              />
              <button type="submit" className="rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
                +
              </button>
            </form>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground md:col-span-2">
            No hay tareas {filter !== 'todas' ? filter : ''} por ahora.
          </p>
        )}
      </div>
    </div>
  );
}
