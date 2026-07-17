import { useState } from 'react';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api } from '../lib/api';
import type { Teacher } from '../lib/types';

export function ProfesoresPage() {
  const { data, stale, refresh } = useCachedData<{ teachers: Teacher[] }>('teachers', '/teachers');
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '' });
  const [error, setError] = useState<string | null>(null);

  useRealtime(['teachers:changed'], () => void refresh());

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/teachers', { method: 'POST', body: form });
      setForm({ name: '', email: '', phone: '', subject: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear.');
    }
  };

  const remove = async (t: Teacher) => {
    if (!window.confirm(`¿Eliminar a ${t.name}? Sus cursos quedarán sin profesor.`)) return;
    try {
      await api(`/teachers/${t.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">Profesores</h1>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
      </div>

      <form onSubmit={create} className="mt-2 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-5">
        <input
          required
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          placeholder="Asignatura"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="Correo"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <input
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Agregar
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Asignatura</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {(data?.teachers ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.subject ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {[t.email, t.phone].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {(data?.teachers ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Aún no hay profesores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
