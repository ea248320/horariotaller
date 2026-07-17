import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { CalendarWeek } from '../components/CalendarWeek';
import { StaleDataBanner } from '../components/StaleDataBanner';
import type { CalendarBlock } from '../lib/types';

// Vista semanal. Obedece al modo de semestre GLOBAL del navbar (exclusivo de
// preuniversitarios): en "1er sem" se ven los cursos del 1er semestre + los
// anuales; ídem para "2do sem".
export function CalendarioPage() {
  const { organization } = useAuth();
  const { semester, matchesSemester } = useAppSettings();
  const { data, stale, refresh } = useCachedData<{ blocks: CalendarBlock[] }>(
    'blocks',
    '/schedule/blocks',
  );

  useRealtime(['schedule:changed'], () => void refresh());

  const isPreu = organization?.businessType === 'preuniversitario';
  const blocks = (data?.blocks ?? []).filter((b) => !isPreu || matchesSemester(b.semester));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">Calendario semanal</h1>
        {isPreu && semester !== 'todos' && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Mostrando {semester === '1' ? '1er' : '2do'} semestre + anuales
          </span>
        )}
      </div>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
        <CalendarWeek blocks={blocks} />
        {blocks.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No hay bloques de horario{isPreu && semester !== 'todos' ? ' en este semestre' : ''}.
            Créalos desde la página de {organization?.courseLabel.toLowerCase()}s.
          </p>
        )}
      </div>
    </div>
  );
}
