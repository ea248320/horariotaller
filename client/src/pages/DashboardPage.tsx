import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBillingStatus } from '../hooks/useBillingStatus';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { TrialBanner } from '../components/TrialBanner';
import type { CalendarBlock, Course, Student, Teacher } from '../lib/types';

const DAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function DashboardPage() {
  const { organization } = useAuth();
  const { status } = useBillingStatus();
  const courses = useCachedData<{ courses: Course[] }>('courses', '/schedule/courses');
  const students = useCachedData<{ students: Student[] }>('students', '/students');
  const teachers = useCachedData<{ teachers: Teacher[] }>('teachers', '/teachers');
  const blocks = useCachedData<{ blocks: CalendarBlock[] }>('blocks', '/schedule/blocks');

  useRealtime(['schedule:changed', 'students:changed', 'teachers:changed'], () => {
    void courses.refresh();
    void students.refresh();
    void teachers.refresh();
    void blocks.refresh();
  });

  if (!organization) return null;
  const stale = courses.stale || students.stale || teachers.stale;

  // JS: getDay() domingo=0 → nuestro esquema lunes=1..domingo=7.
  const todayWeekday = ((new Date().getDay() + 6) % 7) + 1;
  const todayBlocks = (blocks.data?.blocks ?? [])
    .filter((b) => b.weekday === todayWeekday)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const cards = [
    {
      label: `${organization.studentLabel}s`,
      value: students.data?.students.length ?? '—',
      to: '/panel/alumnos',
    },
    {
      label: `${organization.courseLabel}s`,
      value: courses.data?.courses.length ?? '—',
      to: '/panel/cursos',
    },
    { label: 'Profesores', value: teachers.data?.teachers.length ?? '—', to: '/panel/profesores' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Hola, {organization.name} 👋</h1>
      <p className="mt-1 text-sm text-slate-500">Resumen de hoy, {DAY_NAMES[todayWeekday]}.</p>

      <div className="mt-6">
        <StaleDataBanner visible={stale} />
        <TrialBanner status={status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
          >
            <div className="text-3xl font-extrabold text-brand">{c.value}</div>
            <div className="text-sm font-medium text-slate-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold text-slate-900">Clases de hoy</h2>
      <div className="mt-3 space-y-2">
        {todayBlocks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No hay clases programadas para hoy.{' '}
            <Link to="/panel/cursos" className="font-semibold text-brand underline">
              Agrega horarios
            </Link>
          </p>
        )}
        {todayBlocks.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="w-24 shrink-0 text-sm font-bold text-brand">
              {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{b.courseName}</div>
              <div className="truncate text-sm text-slate-500">
                {[b.teacherName, b.room ? `Sala ${b.room}` : null].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
