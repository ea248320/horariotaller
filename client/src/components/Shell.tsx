import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  GraduationCap,
  Grid3x3,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
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

// Réplica de la navegación del proyecto Emilia: header sticky con efecto
// vidrio, logo con degradado primary→secondary, pills redondeadas con íconos,
// campana de alertas con contador, menú hamburguesa + barra inferior en móvil.
export function Shell() {
  const { organization, logout } = useAuth();
  const { dark, toggleDark, semester, setSemester } = useAppSettings();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const loadUnread = () => {
    api<{ notifications: Notification[] }>('/notifications')
      .then((data) => setUnread(data.notifications.filter((n) => !n.read).length))
      .catch(() => undefined);
  };
  useEffect(loadUnread, []);
  useRealtime(['notification'], loadUnread);

  // Cierra el menú móvil al navegar.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--primary',
      hexToHslTokens(organization?.brandColor ?? '#7C5CFA'),
    );
  }, [organization?.brandColor]);

  if (!organization) return null;
  const isPreu = organization.businessType === 'preuniversitario';

  const items = [
    { to: '/panel', label: 'Inicio', icon: Home, end: true },
    { to: '/panel/calendario', label: 'Horarios', icon: Grid3x3 },
    { to: '/panel/cursos', label: `${organization.courseLabel}s`, icon: CalendarDays },
    { to: '/panel/alumnos', label: `${organization.studentLabel}s`, icon: GraduationCap },
    { to: '/panel/profesores', label: 'Profesores', icon: Users },
    ...(organization.feesEnabled ? [{ to: '/panel/pagos', label: 'Cuotas', icon: Wallet }] : []),
    { to: '/panel/configuracion', label: 'Admin', icon: Settings },
  ];

  const pillClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  const semesterControl = isPreu && (
    <div className="flex rounded-xl border border-border bg-muted p-0.5 text-xs font-semibold">
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
          className={`rounded-lg px-2.5 py-1 transition ${
            semester === opt.id
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const bellBadge = unread > 0 && (
    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
      {unread > 9 ? '9+' : unread}
    </span>
  );

  return (
    <>
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <NavLink to="/panel" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-primary/20">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="font-display text-xl font-bold tracking-tight text-foreground">
                  {organization.name}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">PreuFlow</span>
              </div>
            </NavLink>

            {/* Nav desktop */}
            <div className="hidden items-center gap-2 md:flex">
              <nav className="flex items-center gap-1">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={'end' in item && item.end} className={pillClass}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
                <NavLink to="/panel/notificaciones" className={pillClass}>
                  <div className="relative">
                    <Bell className="h-4 w-4" />
                    {bellBadge}
                  </div>
                  Alertas
                </NavLink>
              </nav>

              {semesterControl}

              <button
                type="button"
                onClick={toggleDark}
                title={dark ? 'Modo claro' : 'Modo oscuro'}
                className="ml-1 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={logout}
                title="Cerrar sesión"
                className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>

            {/* Hamburguesa móvil */}
            <div className="flex items-center gap-2 md:hidden">
              {semesterControl}
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="rounded-xl p-2 transition-colors hover:bg-muted"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown móvil */}
        {open && (
          <div className="space-y-1 border-t border-border/50 px-4 py-3 md:hidden">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item && item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/panel/notificaciones"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <div className="relative">
                <Bell className="h-5 w-5" />
                {bellBadge}
              </div>
              Alertas
            </NavLink>
            <div className="flex gap-2 px-2 pt-2">
              <button
                type="button"
                onClick={toggleDark}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {dark ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8">
        <Outlet />
      </main>

      {/* Barra inferior móvil */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-border/50 md:hidden">
        <div className="flex items-center justify-around p-2">
          {items.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item && item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`rounded-lg p-1.5 transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <NavLink
            to="/panel/notificaciones"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative rounded-lg p-1.5 transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                  <Bell className="h-5 w-5" />
                  {bellBadge}
                </div>
                <span className="text-[10px] font-medium">Alertas</span>
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </>
  );
}
