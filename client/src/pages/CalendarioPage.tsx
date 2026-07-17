import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { CalendarWeek } from '../components/CalendarWeek';
import { StaleDataBanner } from '../components/StaleDataBanner';
import type { CalendarBlock } from '../lib/types';

// Vista semanal. El filtro de semestre es EXCLUSIVO de preuniversitarios:
// '1' muestra cursos del 1er semestre + anuales, '2' lo mismo con el 2do.
export function CalendarioPage() {
  const { organization } = useAuth();
  const { data, stale, refresh } = useCachedData<{ blocks: CalendarBlock[] }>(
    'blocks',
    '/schedule/blocks',
  );
  const [semesterFilter, setSemesterFilter] = useState<'todos' | '1' | '2'>('todos');

  useRealtime(['schedule:changed'], () => void refresh());

  const isPreu = organization?.businessType === 'preuniversitario';
  const blocks = (data?.blocks ?? []).filter((b) => {
    if (!isPreu || semesterFilter === 'todos') return true;
    return b.semester === semesterFilter || b.semester === 'anual' || b.semester === null;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Calendario semanal</h1>
        {isPreu && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Semestre
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value as 'todos' | '1' | '2')}
              className="rounded-lg border border-slate-300 px-3 py-1.5"
            >
              <option value="todos">Todos</option>
              <option value="1">1er semestre</option>
              <option value="2">2do semestre</option>
            </select>
          </label>
        )}
      </div>
      <div className="mt-4">
        <StaleDataBanner visible={stale} />
        <CalendarWeek blocks={blocks} />
        {blocks.length === 0 && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Aún no hay bloques de horario. Créalos desde la página de {organization?.courseLabel.toLowerCase()}s.
          </p>
        )}
      </div>
    </div>
  );
}
