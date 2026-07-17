import { useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Change, Student, Teacher } from '../lib/types';

const CHANGE_TYPES = ['CAMBIO HORARIO', 'CAMBIO PROFESOR', 'CAMBIO SEDE', 'RETIRO', 'OTRO'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Registro de cambios/transferencias de alumnos (portado de Emilia).
export function CambiosPage() {
  const { data, stale, refresh } = useCachedData<{ changes: Change[] }>('changes', '/changes');
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  const teachers = useCachedData<{ teachers: Teacher[] }>('teachers', '/teachers');
  useRealtime(['changes:changed'], () => void refresh());

  const [form, setForm] = useState({
    studentName: '',
    subject: '',
    teacherBefore: '',
    teacherAfter: '',
    leavesClass: '',
    entersClass: '',
    changeType: 'CAMBIO HORARIO',
    changeReason: '',
    transferDate: today(),
  });
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/changes', { method: 'POST', body: form });
      setForm({ ...form, studentName: '', subject: '', teacherBefore: '', teacherAfter: '', leavesClass: '', entersClass: '', changeReason: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cambio.');
    }
  };

  const remove = async (change: Change) => {
    if (!window.confirm(`¿Eliminar el registro de ${change.studentName}?`)) return;
    try {
      await api(`/changes/${change.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  };

  const teacherNames = (teachers.data?.teachers ?? []).map((t) => t.name);

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
        <ArrowLeftRight className="h-6 w-6 text-primary" />
        Cambios y transferencias
      </h1>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <form onSubmit={create} className="mt-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            required
            list="cambios-alumnos"
            placeholder="Alumno *"
            value={form.studentName}
            onChange={(e) => setForm({ ...form, studentName: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <datalist id="cambios-alumnos">
            {(students.data?.students ?? []).map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <input
            placeholder="Asignatura"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <select
            value={form.changeType}
            onChange={(e) => setForm({ ...form, changeType: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          >
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            list="cambios-profes"
            placeholder="Profesor anterior"
            value={form.teacherBefore}
            onChange={(e) => setForm({ ...form, teacherBefore: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            list="cambios-profes"
            placeholder="Profesor nuevo"
            value={form.teacherAfter}
            onChange={(e) => setForm({ ...form, teacherAfter: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <datalist id="cambios-profes">
            {teacherNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <input
            type="date"
            value={form.transferDate}
            onChange={(e) => setForm({ ...form, transferDate: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            placeholder="Deja la clase (ej: M1 Lun 10:00)"
            value={form.leavesClass}
            onChange={(e) => setForm({ ...form, leavesClass: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            placeholder="Entra a la clase"
            value={form.entersClass}
            onChange={(e) => setForm({ ...form, entersClass: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
          />
          <input
            placeholder="Motivo"
            value={form.changeReason}
            onChange={(e) => setForm({ ...form, changeReason: e.target.value })}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Registrar
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Alumno</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cambio</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(data?.changes ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{c.transferDate || '—'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {c.studentName}
                    {c.subject && <span className="text-muted-foreground"> · {c.subject}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {c.changeType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[
                      c.teacherBefore || c.teacherAfter
                        ? `${c.teacherBefore || '—'} → ${c.teacherAfter || '—'}`
                        : null,
                      c.leavesClass || c.entersClass
                        ? `${c.leavesClass || '—'} → ${c.entersClass || '—'}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.changeReason || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void remove(c)} className="text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(data?.changes ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Aún no hay cambios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
