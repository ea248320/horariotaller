import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api, ApiError } from '../lib/api';
import type { Course, Student } from '../lib/types';

export function AlumnosPage() {
  const { organization } = useAuth();
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  const courses = useCachedData<{ courses: Course[] }>('courses', '/schedule/courses');

  useRealtime(['students:changed', 'schedule:changed'], () => {
    void students.refresh();
    void courses.refresh();
  });

  const { matchesSemester } = useAppSettings();
  const [form, setForm] = useState({ name: '', email: '', phone: '', guardianName: '' });
  const [error, setError] = useState<string | null>(null);
  const [enrollSelect, setEnrollSelect] = useState<Record<number, string>>({});

  const label = organization?.studentLabel ?? 'Alumno';
  const isPreu = organization?.businessType === 'preuniversitario';

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/students', { method: 'POST', body: form });
      setForm({ name: '', email: '', phone: '', guardianName: '' });
      await students.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear.');
    }
  };

  const remove = async (s: Student) => {
    if (!window.confirm(`¿Eliminar a ${s.name} con sus inscripciones y pagos?`)) return;
    try {
      await api(`/students/${s.id}`, { method: 'DELETE' });
      await students.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
    }
  };

  // Si el curso está lleno, el servidor responde course_full y se ofrece la
  // lista de espera en vez de rechazar sin más.
  const enroll = async (student: Student) => {
    const courseId = Number(enrollSelect[student.id]);
    if (!courseId) return;
    setError(null);
    try {
      await api(`/students/${student.id}/enrollments`, { method: 'POST', body: { courseId } });
      setEnrollSelect({ ...enrollSelect, [student.id]: '' });
      await students.refresh();
      await courses.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'course_full' && err.waitlistAvailable) {
        const ok = window.confirm(`${err.message}\n\n¿Anotar a ${student.name} en la lista de espera?`);
        if (ok) {
          try {
            await api('/waitlist', { method: 'POST', body: { courseId, studentId: student.id } });
            setEnrollSelect({ ...enrollSelect, [student.id]: '' });
            setError(null);
          } catch (err2) {
            setError(err2 instanceof Error ? err2.message : 'Error al anotar en espera.');
          }
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al inscribir.');
    }
  };

  const unenroll = async (enrollmentId: number) => {
    try {
      await api(`/students/enrollments/${enrollmentId}`, { method: 'DELETE' });
      await students.refresh();
      await courses.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar la inscripción.');
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">{label}s</h1>
      <div className="mt-4">
        <StaleDataBanner visible={students.stale} />
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
        <input
          placeholder="Apoderado"
          value={form.guardianName}
          onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Agregar
        </button>
      </form>
      {error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {(students.data?.students ?? []).map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground">{s.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[s.email, s.phone, s.guardianName ? `Apoderado: ${s.guardianName}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Sin datos de contacto'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(s)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {s.enrollments.map((en) => (
                <span
                  key={en.enrollmentId}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary"
                >
                  {en.courseName}
                  <button
                    type="button"
                    onClick={() => unenroll(en.enrollmentId)}
                    title="Cancelar inscripción"
                    className="hover:text-red-600"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <select
                value={enrollSelect[s.id] ?? ''}
                onChange={(e) => setEnrollSelect({ ...enrollSelect, [s.id]: e.target.value })}
                className="rounded-lg border border-input bg-card px-2 py-1 text-sm"
              >
                <option value="">Inscribir en…</option>
                {(courses.data?.courses ?? [])
                  .filter((c) => !s.enrollments.some((en) => en.courseId === c.id))
                  .filter((c) => !isPreu || matchesSemester(c.semester))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.enrolledCount}/{c.capacity})
                    </option>
                  ))}
              </select>
              {enrollSelect[s.id] && (
                <button
                  type="button"
                  onClick={() => enroll(s)}
                  className="rounded-lg border border-primary px-3 py-1 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  Inscribir
                </button>
              )}
            </div>
          </div>
        ))}
        {(students.data?.students ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
            Aún no hay {label.toLowerCase()}s.
          </p>
        )}
      </div>
    </div>
  );
}
