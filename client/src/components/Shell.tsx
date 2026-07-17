import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useRealtime } from '../hooks/useRealtime';
import { api } from '../lib/api';
import type { Notification } from '../lib/types';

// #RRGGBB → "H S% L%" para inyectar el color de marca como --primary.
function hexToHslTokens(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '250 84% 60%';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Navegación estilo Emilia: navbar superior con efecto vidrio y pestañas,
// selector de semestre global (solo preuniversitarios) y modo oscuro.
export function Shell() {
  const { organization, logout } = useAuth();
  const { dark, toggleDark, semester, setSemester } = useAppSettings();
  const [unread, setUnread] = useState(0);

  const loadUnread = () => {
    api<{ notifications: Notification[] }>('/notifications')
      .then((data) => setUnread(data.notifications.filter((n) => !n.read).length))
      .catch(() => undefined);
  };
  useEffect(loadUnread, []);
  useRealtime(['notification'], loadUnread);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--primary',
      hexToHslTokens(organization?.brandColor ?? '#7C5CFA'),
    );
  }, [organization?.brandColor]);

  if (!organization) return null;
  const isPreu = organization.businessType === 'preuniversitario';

  const items = [
    { to: '/panel', label: 'Inicio', end: true },
    { to: '/panel/calendario', label: 'Calendario' },
    { to: '/panel/cursos', label: `${organization.courseLabel}s` },
    { to: '/panel/alumnos', label: `${organization.studentLabel}s` },
    { to: '/panel/profesores', label: 'Profesores' },
    ...(organization.feesEnabled ? [{ to: '/panel/pagos', label: 'Cuotas' }] : []),
    { to: '/panel/notificaciones', label: 'Avisos', badge: unread },
    { to: '/panel/configuracion', label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="font-display text-lg font-bold text-primary">PreuFlow</span>
              <span className="hidden truncate text-sm text-muted-foreground sm:block" title={organization.name}>
                {organization.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Modo semestre global: acota TODAS las pestañas. Solo preu. */}
              {isPreu && (
                <div className="flex rounded-lg border border-border bg-muted p-0.5 text-xs font-semibold">
                  {(
                    [
                      { id: '1', label: '1er sem' },
                      { id: '2', label: '2do sem' },
                      { id: 'todos', label: 'Todo' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSemester(opt.id)}
                      className={`rounded-md px-2.5 py-1 transition ${
                        semester === opt.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={toggleDark}
                title={dark ? 'Modo claro' : 'Modo oscuro'}
                className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
              >
                {dark ? '☀️' : '🌙'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Pestañas */}
          <nav className="-mb-px flex gap-1 overflow-x-auto pb-0 text-sm">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item && item.end}
                className={({ isActive }) =>
                  `relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium transition ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.label}
                {'badge' in item && item.badge ? (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
