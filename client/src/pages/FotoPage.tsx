import { Camera, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCachedData } from '../hooks/useCachedData';
import { useRealtime } from '../hooks/useRealtime';
import { CalendarWeek } from '../components/CalendarWeek';
import type { CalendarBlock } from '../lib/types';

// Foto del horario (portado de Emilia): vista limpia a pantalla completa para
// mostrar en TV o imprimir/exportar. Con Ctrl+P (o el botón) sale sin menús.
export function FotoPage() {
  const { organization } = useAuth();
  const { semester, matchesSemester } = useAppSettings();
  const { data, refresh } = useCachedData<{ blocks: CalendarBlock[] }>('blocks', '/schedule/blocks');
  useRealtime(['schedule:changed'], () => void refresh());

  const isPreu = organization?.businessType === 'preuniversitario';
  const blocks = (data?.blocks ?? []).filter((b) => !isPreu || matchesSemester(b.semester));

  return (
    <div className="print-area">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-foreground">
          <Camera className="h-6 w-6 text-primary" />
          Foto del horario
        </h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Printer className="h-4 w-4" />
          Imprimir / exportar
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground print:hidden">
        Vista limpia del horario semanal para proyectar en TV o imprimir.
      </p>

      <div className="mt-5">
        <div className="mb-3 text-center">
          <span className="font-display text-2xl font-extrabold text-foreground">
            {organization?.name}
          </span>
          <span className="ml-3 text-sm text-muted-foreground">
            Horario semanal
            {isPreu && semester !== 'todos'
              ? ` · ${semester === '1' ? '1er' : '2do'} semestre`
              : ''}
          </span>
        </div>
        <CalendarWeek blocks={blocks} />
      </div>
    </div>
  );
}
