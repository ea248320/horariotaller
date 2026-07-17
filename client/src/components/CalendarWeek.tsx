import type { CalendarBlock } from '../lib/types';

// Grilla semanal: columnas lunes-domingo (domingo solo si tiene bloques),
// filas por hora. Los bloques se posicionan de forma absoluta por minutos.
const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_PX = 56;

function minutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

const PALETTE = [
  'bg-blue-100 border-blue-400 text-blue-900',
  'bg-emerald-100 border-emerald-400 text-emerald-900',
  'bg-amber-100 border-amber-400 text-amber-900',
  'bg-purple-100 border-purple-400 text-purple-900',
  'bg-rose-100 border-rose-400 text-rose-900',
  'bg-cyan-100 border-cyan-400 text-cyan-900',
];

const SEMESTER_LABEL: Record<string, string> = { '1': '1er sem', '2': '2do sem', anual: 'Anual' };

export function CalendarWeek({ blocks }: { blocks: CalendarBlock[] }) {
  const showSunday = blocks.some((b) => b.weekday === 7);
  const days = showSunday ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
  const hours: number[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) hours.push(h);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[720px]">
        {/* Encabezado de días */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d) => (
            <div key={d} className="border-l border-border/60 px-2 py-2 text-center text-sm font-semibold text-foreground">
              {DAY_NAMES[d]}
            </div>
          ))}
        </div>
        {/* Cuerpo */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          {/* Columna de horas */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-xs text-muted-foreground"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                {h > START_HOUR ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="relative border-l border-border/60" style={{ height: gridHeight }}>
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (h - START_HOUR) * HOUR_PX }}
                />
              ))}
              {blocks
                .filter((b) => b.weekday === day)
                .map((b) => {
                  const top = ((minutes(b.startTime) - START_HOUR * 60) / 60) * HOUR_PX;
                  const height = Math.max(
                    28,
                    ((minutes(b.endTime) - minutes(b.startTime)) / 60) * HOUR_PX - 2,
                  );
                  const color = PALETTE[b.courseId % PALETTE.length];
                  return (
                    <div
                      key={b.id}
                      className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm ${color}`}
                      style={{ top, height }}
                      title={`${b.courseName} · ${b.startTime.slice(0, 5)}–${b.endTime.slice(0, 5)}${b.room ? ` · Sala ${b.room}` : ''}${b.teacherName ? ` · ${b.teacherName}` : ''}`}
                    >
                      <div className="truncate font-semibold">{b.courseName}</div>
                      <div className="truncate">
                        {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)}
                        {b.room ? ` · ${b.room}` : ''}
                      </div>
                      {b.teacherName && <div className="truncate">{b.teacherName}</div>}
                      {b.semester && (
                        <span className="mt-0.5 inline-block rounded bg-card/70 px-1 font-medium">
                          {SEMESTER_LABEL[b.semester] ?? b.semester}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
