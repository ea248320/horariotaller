import { useState } from 'react';
import { CalendarPlus, Plus, Trash2, X } from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Student, Teacher, Workshop } from '../lib/types';

// Talleres puntuales (portado de Emilia): sesiones sueltas de un día con
// cupos, separadas del horario semanal recurrente.
export function TalleresPage() {
  const { data, stale, refresh } = useCachedData<{ workshops: Workshop[] }>('workshops', '/workshops');
  const teachers = useCachedData<{ teachers: Teacher[] }>('teachers', '/teachers');
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  useRealtime(['workshops:changed'], () => void refresh());

  const [form, setForm] = useState({
    name: '',
    teacherId: '',
    room: '',
    workshopDate: '',
    startTime: '',
    endTime: '',
    capacity: '8',
  });
  const [enrollSelect, setEnrollSelect] = useState<Record<number, string>>({});
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
      await api('/workshops', {
        method: 'POST',
        body: {
          ...form,
          teacherId: form.teacherId ? Number(form.teacherId) : null,
          capacity: Number(form.capacity) || 8,
        },
      });
      setForm({ name: '', teacherId: '', room: '', workshopDate: '', startTime: '', endTime: '', capacity: '8' });
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
        <CalendarPlus className="h-6 w-6 text-primary" />
        Talleres puntuales
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sesiones de un solo día (no recurrentes), con cupos propios.
      </p>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <form onSubmit={create} className="mt-2 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-7">
        <input
          required
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={form.teacherId}
          onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">Sin profesor</option>
          {(teachers.data?.teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          required
          value={form.workshopDate}
          onChange={(e) => setForm({ ...form, workshopDate: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          type="time"
          required
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          type="time"
          required
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            title="Cupos"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            className="w-16 rounded-xl border border-input bg-card px-2 py-2 text-sm"
          />
          <button
            type="submit"
            className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {(data?.workshops ?? []).map((w) => {
          const past = w.workshopDate < todayStr;
          const full = w.students.length >= w.capacity;
          return (
            <div key={w.id} className={`rounded-2xl border border-border bg-card p-5 shadow-sm ${past ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-foreground">{w.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date(`${w.workshopDate}T12:00:00`).toLocaleDateString('es-CL', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}{' '}
                    · {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                    {w.room ? ` · Sala ${w.room}` : ''}
                    {w.teacherName ? ` · ${w.teacherName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      full
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {w.students.length}/{w.capacity}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el taller "${w.name}"?`)) {
                        void run(() => api(`/workshops/${w.id}`, { method: 'DELETE' }));
                      }
                    }}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {w.students.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {s.studentName}
                    <button
                      type="button"
                      onClick={() => void run(() => api(`/workshops/students/${s.id}`, { method: 'DELETE' }))}
                      className="hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {w.students.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sin inscritos aún.</span>
                )}
              </div>

              {!full && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const studentId = Number(enrollSelect[w.id]);
                    if (!studentId) return;
                    void run(async () => {
                      await api(`/workshops/${w.id}/students`, { method: 'POST', body: { studentId } });
                      setEnrollSelect({ ...enrollSelect, [w.id]: '' });
                    });
                  }}
                  className="mt-3 flex gap-2"
                >
                  <select
                    value={enrollSelect[w.id] ?? ''}
                    onChange={(e) => setEnrollSelect({ ...enrollSelect, [w.id]: e.target.value })}
                    className="flex-1 rounded-xl border border-input bg-card px-2 py-1.5 text-sm"
                  >
                    <option value="">Inscribir alumno…</option>
                    {(students.data?.students ?? [])
                      .filter((s) => !w.students.some((ws) => ws.studentId === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <button type="submit" className="rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
                    Inscribir
                  </button>
                </form>
              )}
            </div>
          );
        })}
        {(data?.workshops ?? []).length === 0 && (
          <p className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground md:col-span-2">
            Aún no hay talleres puntuales. Crea el primero arriba.
          </p>
        )}
      </div>
    </div>
  );
}
