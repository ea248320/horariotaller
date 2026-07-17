import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { api } from '../lib/api';
import type { Notification } from '../lib/types';

function hexToRgb(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return '79 70 229';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// Navegación del panel: sidebar en desktop, barra inferior en mobile.
export function Shell() {
  const { organization, logout } = useAuth();
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
      '--brand-rgb',
      hexToRgb(organization?.brandColor ?? '#4F46E5'),
    );
  }, [organization?.brandColor]);

  if (!organization) return null;

  const items = [
    { to: '/panel', label: 'Inicio', icon: '🏠', end: true },
    { to: '/panel/calendario', label: 'Calendario', icon: '📅' },
    { to: '/panel/cursos', label: `${organization.courseLabel}s`, icon: '📚' },
    { to: '/panel/alumnos', label: `${organization.studentLabel}s`, icon: '🎓' },
    { to: '/panel/profesores', label: 'Profesores', icon: '👩‍🏫' },
    ...(organization.feesEnabled ? [{ to: '/panel/pagos', label: 'Cuotas', icon: '💵' }] : []),
    { to: '/panel/notificaciones', label: 'Avisos', icon: '🔔', badge: unread },
    { to: '/panel/configuracion', label: 'Configuración', icon: '⚙️' },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold text-brand">PreuFlow</div>
          <div className="truncate text-sm text-slate-500" title={organization.name}>
            {organization.name}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={'end' in item && item.end} className={linkClass}>
              <span aria-hidden>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {'badge' in item && item.badge ? (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-4 rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
        >
          Cerrar sesión
        </button>
      </aside>

      {/* Contenido */}
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
        <Outlet />
      </main>

      {/* Barra inferior mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-slate-200 bg-white py-2 md:hidden">
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={'end' in item && item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center px-2 text-xs ${isActive ? 'text-brand' : 'text-slate-500'}`
            }
          >
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
        <NavLink
          to="/panel/configuracion"
          className={({ isActive }) =>
            `relative flex flex-col items-center px-2 text-xs ${isActive ? 'text-brand' : 'text-slate-500'}`
          }
        >
          <span className="text-lg" aria-hidden>
            ⚙️
          </span>
          Más
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </NavLink>
      </nav>
    </div>
  );
}
