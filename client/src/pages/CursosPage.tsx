import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { api, ApiError } from '../lib/api';
import type { Course, Student, Teacher, WaitlistEntry } from '../lib/types';

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SEMESTER_LABEL: Record<string, string> = { '1': '1er semestre', '2': '2do semestre', anual: 'Anual' };

export function CursosPage() {
  const { organization } = useAuth();
  const courses = useCachedData<{ courses: Course[] }>('courses', '/schedule/courses');
  const teachers = useCachedData<{ teachers: Teacher[] }>('teachers', '/teachers');
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  const waitlist = useCachedData<{ entries: WaitlistEntry[] }>('waitlist', '/waitlist');

  useRealtime(['schedule:changed', 'waitlist:changed', 'students:changed'], () => {
    void courses.refresh();
    void waitlist.refresh();
    void students.refresh();
  });

  const [form, setForm] = useState({ name: '', teacherId: '', room: '', capacity: '20', semester: '' });
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const isPreu = organization?.businessType === 'preuniversitario';

  const showError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setError(err.message);
      setConflicts(err.conflicts ?? []);
    } else {
      setError(fallback);
      setConflicts([]);
    }
  };

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflicts([]);
    try {
      await api('/schedule/courses', {
        method: 'POST',
        body: {
          name: form.name,
          teacherId: form.teacherId ? Number(form.teacherId) : null,
          room: form.room || null,
          capacity: Number(form.capacity) || 20,
          semester: isPreu && form.semester ? form.semester : null,
        },
      });
      setForm({ name: '', teacherId: '', room: '', capacity: '20', semester: '' });
      await courses.refresh();
    } catch (err) {
      showError(err, 'Error al crear el curso.');
    }
  };

  const deleteCourse = async (course: Course) => {
    if (!window.confirm(`¿Eliminar "${course.name}" con sus horarios e inscripciones?`)) return;
    try {
      await api(`/schedule/courses/${course.id}`, { method: 'DELETE' });
      await courses.refresh();
    } catch (err) {
      showError(err, 'Error al eliminar.');
    }
  };

  const changeCapacity = async (course: Course) => {
    const raw = window.prompt(`Nueva capacidad de "${course.name}"`, String(course.capacity));
    if (!raw) return;
    try {
      await api(`/schedule/courses/${course.id}`, { method: 'PATCH', body: { capacity: Number(raw) } });
      await courses.refresh();
    } catch (err) {
      showError(err, 'Error al cambiar la capacidad.');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{organization?.courseLabel}s</h1>
      <div className="mt-4">
        <StaleDataBanner visible={courses.stale} />
      </div>

      {/* Crear curso */}
      <form
        onSubmit={createCourse}
        className="mt-2 grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-6"
      >
        <input
          required
          placeholder="Nombre *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <select
          value={form.teacherId}
          onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sin profesor</option>
          {(teachers.data?.teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Sala"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          placeholder="Cupos"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {isPreu ? (
          <select
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Sin semestre</option>
            <option value="1">1er semestre</option>
            <option value="2">2do semestre</option>
            <option value="anual">Anual</option>
          </select>
        ) : (
          <div />
        )}
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:col-start-6"
        >
          Crear
        </button>
      </form>
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{error}</p>
          {conflicts.map((c) => (
            <p key={c}>• {c}</p>
          ))}
        </div>
      )}

      {/* Lista de cursos */}
      <div className="mt-6 space-y-4">
        {(courses.data?.courses ?? []).map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            students={students.data?.students ?? []}
            waitlist={(waitlist.data?.entries ?? []).filter((w) => w.courseId === course.id)}
            isPreu={isPreu}
            onChanged={() => {
              void courses.refresh();
              void waitlist.refresh();
            }}
            onDelete={() => deleteCourse(course)}
            onCapacity={() => changeCapacity(course)}
            onError={showError}
          />
        ))}
        {(courses.data?.courses ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Aún no hay {organization?.courseLabel.toLowerCase()}s. Crea el primero arriba.
          </p>
        )}
      </div>
    </div>
  );
}

function CourseCard({
  course,
  students,
  waitlist,
  isPreu,
  onChanged,
  onDelete,
  onCapacity,
  onError,
}: {
  course: Course;
  students: Student[];
  waitlist: WaitlistEntry[];
  isPreu: boolean;
  onChanged: () => void;
  onDelete: () => void;
  onCapacity: () => void;
  onError: (err: unknown, fallback: string) => void;
}) {
  const [block, setBlock] = useState({ weekday: '1', startTime: '', endTime: '' });
  const [waitlistStudent, setWaitlistStudent] = useState('');
  const full = course.enrolledCount >= course.capacity;

  const addBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api(`/schedule/courses/${course.id}/blocks`, {
        method: 'POST',
        body: {
          weekday: Number(block.weekday),
          startTime: block.startTime,
          endTime: block.endTime,
        },
      });
      setBlock({ weekday: '1', startTime: '', endTime: '' });
      onChanged();
    } catch (err) {
      onError(err, 'Error al agregar el horario.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeBlock = async (blockId: number) => {
    try {
      await api(`/schedule/blocks/${blockId}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      onError(err, 'Error al quitar el horario.');
    }
  };

  const addToWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistStudent) return;
    try {
      await api('/waitlist', {
        method: 'POST',
        body: { courseId: course.id, studentId: Number(waitlistStudent) },
      });
      setWaitlistStudent('');
      onChanged();
    } catch (err) {
      onError(err, 'Error al anotar en la lista de espera.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeFromWaitlist = async (entryId: number) => {
    try {
      await api(`/waitlist/${entryId}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      onError(err, 'Error al quitar de la lista de espera.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {course.name}
            {isPreu && course.semester && (
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                {SEMESTER_LABEL[course.semester]}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500">
            {[course.teacherName, course.room ? `Sala ${course.room}` : null]
              .filter(Boolean)
              .join(' · ') || 'Sin profesor ni sala'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={onCapacity}
            className={`rounded-full px-3 py-1 font-semibold ${
              full ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
            }`}
            title="Clic para cambiar la capacidad"
          >
            {course.enrolledCount}/{course.capacity} cupos
          </button>
          <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
            Eliminar
          </button>
        </div>
      </div>

      {/* Bloques horarios */}
      <div className="mt-3 flex flex-wrap gap-2">
        {course.blocks.map((b) => (
          <span
            key={b.id}
            className="group inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
          >
            {DAY_NAMES[b.weekday]} {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
            <button
              type="button"
              onClick={() => removeBlock(b.id)}
              className="text-slate-400 hover:text-red-600"
              title="Quitar horario"
            >
              ✕
            </button>
          </span>
        ))}
        {course.blocks.length === 0 && <span className="text-sm text-slate-400">Sin horarios aún.</span>}
      </div>

      <form onSubmit={addBlock} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <select
          value={block.weekday}
          onChange={(e) => setBlock({ ...block, weekday: e.target.value })}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        >
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {DAY_NAMES[d]}
            </option>
          ))}
        </select>
        <input
          type="time"
          required
          value={block.startTime}
          onChange={(e) => setBlock({ ...block, startTime: e.target.value })}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        />
        <span className="text-slate-400">a</span>
        <input
          type="time"
          required
          value={block.endTime}
          onChange={(e) => setBlock({ ...block, endTime: e.target.value })}
          className="rounded-lg border border-slate-300 px-2 py-1.5"
        />
        <button
          type="submit"
          className="rounded-lg border border-brand px-3 py-1.5 font-semibold text-brand hover:bg-brand/5"
        >
          + Agregar horario
        </button>
      </form>

      {/* Lista de espera */}
      {(full || waitlist.length > 0) && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <h3 className="text-sm font-bold text-amber-900">
            Lista de espera ({waitlist.length})
          </h3>
          <ul className="mt-1 space-y-1 text-sm text-amber-900">
            {waitlist.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2">
                <span>
                  {i + 1}. {w.studentName}
                  {w.notifiedAt && (
                    <span className="ml-1 rounded bg-emerald-100 px-1.5 text-xs font-medium text-emerald-800">
                      avisado ✓
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeFromWaitlist(w.id)}
                  className="text-amber-500 hover:text-red-600"
                  title="Quitar"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addToWaitlist} className="mt-2 flex gap-2">
            <select
              value={waitlistStudent}
              onChange={(e) => setWaitlistStudent(e.target.value)}
              className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Anotar en espera…</option>
              {students
                .filter(
                  (s) =>
                    !s.enrollments.some((en) => en.courseId === course.id) &&
                    !waitlist.some((w) => w.studentId === s.id),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Anotar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
