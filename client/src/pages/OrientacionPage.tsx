import { useState } from 'react';
import { HeartHandshake, Plus, Trash2, UserPlus } from 'lucide-react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Cita, Counselor, Student } from '../lib/types';

const CONFIRMA_NEXT: Record<string, string> = {
  pendiente: 'confirmada',
  confirmada: 'no_confirma',
  no_confirma: 'pendiente',
};
const ASISTE_NEXT: Record<string, string> = {
  pendiente: 'asiste',
  asiste: 'no_asiste',
  no_asiste: 'pendiente',
};
const CONFIRMA_STYLE: Record<string, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  confirmada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  no_confirma: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
};
const CONFIRMA_LABEL: Record<string, string> = {
  pendiente: 'Por confirmar',
  confirmada: 'Confirmada',
  no_confirma: 'No confirma',
};
const ASISTE_LABEL: Record<string, string> = {
  pendiente: 'Por asistir',
  asiste: 'Asistió',
  no_asiste: 'No asistió',
};

// Orientación vocacional (portado de Emilia): orientadoras y citas con doble
// estado — confirmación previa y asistencia real.
export function OrientacionPage() {
  const counselors = useCachedData<{ counselors: Counselor[] }>('counselors', '/counseling/orientadoras');
  const citas = useCachedData<{ citas: Cita[] }>('citas', '/counseling/citas');
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  useRealtime(['counseling:changed'], () => {
    void counselors.refresh();
    void citas.refresh();
  });

  const [newCounselor, setNewCounselor] = useState('');
  const [form, setForm] = useState({
    counselorId: '',
    studentName: '',
    fecha: new Date().toISOString().slice(0, 10),
    horaInicio: '',
    motivo: '',
    agendadoPor: '',
  });
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await counselors.refresh();
      await citas.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    }
  };

  const addCounselor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounselor.trim()) return;
    void run(async () => {
      await api('/counseling/orientadoras', { method: 'POST', body: { name: newCounselor.trim() } });
      setNewCounselor('');
    });
  };

  const addCita = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api('/counseling/citas', { method: 'POST', body: { ...form, counselorId: Number(form.counselorId) } });
      setForm({ ...form, studentName: '', horaInicio: '', motivo: '' });
    });
  };

  return (
    <div>
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
        <HeartHandshake className="h-6 w-6 text-primary" />
        Orientación vocacional
      </h1>
      <div className="mt-4">
        <StaleDataBanner visible={citas.stale} />
      </div>

      {/* Orientadoras */}
      <div className="mt-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Orientadoras</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(counselors.data?.counselors ?? []).map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              {c.name}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar a ${c.name} y todas sus citas?`)) {
                    void run(() => api(`/counseling/orientadoras/${c.id}`, { method: 'DELETE' }));
                  }
                }}
                className="hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <form onSubmit={addCounselor} className="flex gap-2">
            <input
              placeholder="Nueva orientadora…"
              value={newCounselor}
              onChange={(e) => setNewCounselor(e.target.value)}
              className="rounded-xl border border-input bg-card px-3 py-1.5 text-sm"
            />
            <button type="submit" className="flex items-center gap-1 rounded-xl border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
              <UserPlus className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Nueva cita */}
      <form onSubmit={addCita} className="mt-4 grid gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-6">
        <select
          required
          value={form.counselorId}
          onChange={(e) => setForm({ ...form, counselorId: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">Orientadora *</option>
          {(counselors.data?.counselors ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          required
          list="orientacion-alumnos"
          placeholder="Alumno *"
          value={form.studentName}
          onChange={(e) => setForm({ ...form, studentName: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <datalist id="orientacion-alumnos">
          {(students.data?.students ?? []).map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
        <input
          type="date"
          required
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          type="time"
          required
          value={form.horaInicio}
          onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          placeholder="Motivo"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Agendar
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Citas */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Alumno</th>
                <th className="px-4 py-3">Orientadora</th>
                <th className="px-4 py-3">Confirmación</th>
                <th className="px-4 py-3">Asistencia</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(citas.data?.citas ?? []).map((cita) => (
                <tr key={cita.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {cita.fecha} · {cita.horaInicio}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{cita.studentName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{cita.counselorName}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="Clic para cambiar"
                      onClick={() =>
                        void run(() =>
                          api(`/counseling/citas/${cita.id}`, {
                            method: 'PATCH',
                            body: { estadoConfirma: CONFIRMA_NEXT[cita.estadoConfirma] },
                          }),
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${CONFIRMA_STYLE[cita.estadoConfirma]}`}
                    >
                      {CONFIRMA_LABEL[cita.estadoConfirma]}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="Clic para cambiar"
                      onClick={() =>
                        void run(() =>
                          api(`/counseling/citas/${cita.id}`, {
                            method: 'PATCH',
                            body: { estadoAsiste: ASISTE_NEXT[cita.estadoAsiste] },
                          }),
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        CONFIRMA_STYLE[
                          cita.estadoAsiste === 'asiste'
                            ? 'confirmada'
                            : cita.estadoAsiste === 'no_asiste'
                              ? 'no_confirma'
                              : 'pendiente'
                        ]
                      }`}
                    >
                      {ASISTE_LABEL[cita.estadoAsiste]}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{cita.motivo || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la cita de ${cita.studentName}?`)) {
                          void run(() => api(`/counseling/citas/${cita.id}`, { method: 'DELETE' }));
                        }
                      }}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {(citas.data?.citas ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aún no hay citas agendadas.
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
