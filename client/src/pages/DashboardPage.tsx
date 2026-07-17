import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useBillingStatus } from '../hooks/useBillingStatus';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { TrialBanner } from '../components/TrialBanner';
import type { CalendarBlock, Course, Student, Teacher } from '../lib/types';

const DAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// Portada estilo Emilia: badge superior, título display con degradado y
// tarjetas rounded-3xl con caja de emoji degradada y hover con elevación.
export function DashboardPage() {
  const { organization } = useAuth();
  const { semester, matchesSemester } = useAppSettings();
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
  const isPreu = organization.businessType === 'preuniversitario';

  // JS: getDay() domingo=0 → nuestro esquema lunes=1..domingo=7.
  const todayWeekday = ((new Date().getDay() + 6) % 7) + 1;
  // El modo de semestre global también acota el resumen del día.
  const todayBlocks = (blocks.data?.blocks ?? [])
    .filter((b) => b.weekday === todayWeekday && (!isPreu || matchesSemester(b.semester)))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const visibleCourses = (courses.data?.courses ?? []).filter(
    (c) => !isPreu || matchesSemester(c.semester),
  );

  const cards = [
    {
      label: `${organization.studentLabel}s`,
      value: students.data?.students.length ?? '—',
      to: '/panel/alumnos',
      emoji: '🎓',
      gradient: 'from-violet-500 to-purple-600',
      cta: `Ver ${organization.studentLabel.toLowerCase()}s`,
    },
    {
      label: `${organization.courseLabel}s`,
      value: visibleCourses.length,
      to: '/panel/cursos',
      emoji: '📚',
      gradient: 'from-teal-500 to-emerald-600',
      cta: `Ver ${organization.courseLabel.toLowerCase()}s`,
    },
    {
      label: 'Profesores',
      value: teachers.data?.teachers.length ?? '—',
      to: '/panel/profesores',
      emoji: '👩‍🏫',
      gradient: 'from-orange-500 to-amber-600',
      cta: 'Ver profesores',
    },
  ];

  return (
    <div>
      <div className="pt-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-sm font-bold tracking-wide text-primary">
          <MapPin className="h-4 w-4" />
          Hoy es {DAY_NAMES[todayWeekday]}
          {isPreu && semester !== 'todos' ? ` · ${semester === '1' ? '1er' : '2do'} semestre` : ''}
        </div>
        <h1 className="font-display mb-3 text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
          Hola,{' '}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {organization.name}
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          Gestiona horarios, cupos y {organization.feesEnabled ? 'cuotas' : 'listas de espera'} de tu
          centro desde un solo lugar.
        </p>
      </div>

      <StaleDataBanner visible={stale} />
      <TrialBanner status={status} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group relative rounded-3xl border border-border bg-card p-7 text-left shadow-xl shadow-black/5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
          >
            <div
              className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${c.gradient} text-2xl shadow-md transition-transform duration-300 group-hover:scale-110`}
            >
              {c.emoji}
            </div>
            <div className="font-display text-4xl font-extrabold text-foreground">{c.value}</div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{c.label}</h2>
            <span className="flex items-center gap-1.5 text-sm font-bold text-primary transition-all group-hover:gap-2.5">
              {c.cta}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="font-display mt-12 flex items-center gap-2 text-xl font-bold text-foreground">
        <Clock className="h-5 w-5 text-primary" />
        Clases de hoy
      </h2>
      <div className="mt-4 space-y-2">
        {todayBlocks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
            No hay clases programadas para hoy.{' '}
            <Link to="/panel/cursos" className="font-semibold text-primary underline">
              Agrega horarios
            </Link>
          </p>
        )}
        {todayBlocks.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-sm">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div className="w-28 shrink-0 text-sm font-bold text-primary">
              {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{b.courseName}</div>
              <div className="truncate text-sm text-muted-foreground">
                {[b.teacherName, b.room ? `Sala ${b.room}` : null].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
