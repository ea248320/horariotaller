import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarDays, Home, Grid3x3, Settings, Menu, X, Printer, Camera,
  Bell, ArrowLeftRight, ClipboardList, HeartHandshake, StickyNote,
  SlidersHorizontal, RotateCcw, Check,
} from "lucide-react";
import { useHorario } from "@/context/HorarioContext";
import { useSettings } from "@/context/SettingsContext";
import SemesterToggle from "@/components/SemesterToggle";
import { useNotifications } from "@/context/NotificationContext";
import { useCurrentUser, UserAvatar } from "@/context/UserContext";
import {
  getNavConfig, saveNavConfig, resetNavConfig, NAV_DEFAULTS, type NavItem,
} from "@/lib/navConfig";

// Icon map by href
const ICON_MAP: Record<string, React.ElementType> = {
  "/":            Home,
  "/horarios":    Grid3x3,
  "/tareas":      ClipboardList,
  "/cambios":     ArrowLeftRight,
  "/notas":       StickyNote,
  "/guias":       Printer,
  "/foto":        Camera,
  "/orientacion": HeartHandshake,
  "/admin":       Settings,
};

// ─── Nav Config Modal ─────────────────────────────────────────────────────────

function NavConfigModal({
  onClose,
  onSave,
}: { onClose: () => void; onSave: (items: NavItem[]) => void }) {
  const [items, setItems] = useState<NavItem[]>(() => getNavConfig());

  function toggle(href: string) {
    setItems(prev => prev.map(i => i.href === href ? { ...i, visible: !i.visible } : i));
  }
  function rename(href: string, label: string) {
    setItems(prev => prev.map(i => i.href === href ? { ...i, label } : i));
  }
  function handleReset() {
    resetNavConfig();
    setItems(NAV_DEFAULTS.map(d => ({ ...d })));
  }
  function handleSave() {
    saveNavConfig(items);
    onSave(items);
    onClose();
  }

  const Icon = ({ href }: { href: string }) => {
    const I = ICON_MAP[href] ?? Home;
    return <I className="w-4 h-4 shrink-0 text-muted-foreground" />;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Personalizar menú
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Activa o desactiva pestañas y edita sus nombres. Los cambios se guardan en este navegador.
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {items.map(item => (
            <div key={item.href} className="flex items-center gap-2">
              {/* Toggle */}
              <button
                onClick={() => toggle(item.href)}
                className={`w-8 h-5 rounded-full transition-colors shrink-0 ${item.visible ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mx-0.5 ${item.visible ? "translate-x-3" : "translate-x-0"}`}
                />
              </button>
              <Icon href={item.href} />
              {/* Label input */}
              <input
                value={item.label}
                onChange={e => rename(item.href, e.target.value)}
                className="flex-1 text-sm px-2 py-1 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [showNavCfg, setShowNavCfg] = useState(false);
  const [navConfig, setNavConfig] = useState<NavItem[]>(() => getNavConfig());

  const { horario } = useHorario();
  const { settings } = useSettings();
  const { notifications } = useNotifications();
  const { currentUser, clearUser } = useCurrentUser();

  // Reload config if it changes (e.g. after save)
  useEffect(() => { setNavConfig(getNavConfig()); }, []);

  const isAdmin = currentUser?.role === "admin";
  const horarioUnread = notifications.filter(
    n => n.horarioId === horario?.id && !n.read,
  ).length;

  // Visible links filtered/renamed by config
  const visibleLinks = navConfig.filter(n => n.visible);

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-md group-hover:shadow-primary/20 transition-all duration-300 group-hover:scale-105">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="font-display font-bold text-xl tracking-tight text-foreground">
                  {horario?.id ? horario.label : settings.platformName}
                </span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <nav className="flex items-center gap-1">
                {visibleLinks.map(({ href, label }) => {
                  const Icon = ICON_MAP[href] ?? Home;
                  const active = location === href;
                  // Notifications tab special handling
                  if (href === "/notificaciones") return null;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}

                {/* Notifications — always visible */}
                <Link
                  href="/notificaciones"
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    location === "/notificaciones"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <div className="relative">
                    <Bell className="w-4 h-4" />
                    {horarioUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {horarioUnread > 9 ? "9+" : horarioUnread}
                      </span>
                    )}
                  </div>
                  Alertas
                </Link>
              </nav>

              <div className="ml-2 shrink-0"><SemesterToggle compact /></div>

              <Link
                href="/"
                title="Cambiar sede"
                className="ml-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors shrink-0"
              >
                {horario?.label}
              </Link>

              {currentUser && (
                <button
                  onClick={clearUser}
                  title={`${currentUser.name} — clic para cambiar`}
                  className="ml-1 flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors"
                >
                  <UserAvatar name={currentUser.name} color={currentUser.color} size="sm" />
                  <span className="text-xs font-medium text-foreground hidden lg:block max-w-[80px] truncate">
                    {currentUser.name}
                  </span>
                </button>
              )}

              {/* Admin — nav config button */}
              {isAdmin && (
                <button
                  onClick={() => setShowNavCfg(true)}
                  title="Personalizar menú"
                  className="ml-1 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-xl hover:bg-muted transition-colors"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="md:hidden border-t border-border/50 px-4 py-3 space-y-1">
            <div className="px-4 py-2 mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Campus activo</span>
              <p className="text-sm font-bold text-primary mt-0.5">{horario?.label}</p>
            </div>
            <div className="px-4 py-2 mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Semestre</span>
              <SemesterToggle compact />
            </div>
            {visibleLinks.map(({ href, label }) => {
              const Icon = ICON_MAP[href] ?? Home;
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </Link>
              );
            })}
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                location === "/notificaciones"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {horarioUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {horarioUnread > 9 ? "9+" : horarioUnread}
                  </span>
                )}
              </div>
              Notificaciones
              {horarioUnread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {horarioUnread}
                </span>
              )}
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <CalendarDays className="w-5 h-5" />
              Cambiar campus
            </Link>
            {isAdmin && (
              <button
                onClick={() => { setOpen(false); setShowNavCfg(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              >
                <SlidersHorizontal className="w-5 h-5" />
                Personalizar menú
              </button>
            )}
          </div>
        )}
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50">
        <div className="flex items-center justify-around p-2 pb-safe">
          {visibleLinks.slice(0, 5).map(({ href, label }) => {
            const Icon = ICON_MAP[href] ?? Home;
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary/10" : ""}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/notificaciones"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
              location === "/notificaciones" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div className={`relative p-1.5 rounded-lg transition-colors ${location === "/notificaciones" ? "bg-primary/10" : ""}`}>
              <Bell className="w-5 h-5" />
              {horarioUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {horarioUnread > 9 ? "9+" : horarioUnread}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Alertas</span>
          </Link>
        </div>
      </nav>

      {/* Nav config modal */}
      {showNavCfg && (
        <NavConfigModal
          onClose={() => setShowNavCfg(false)}
          onSave={items => setNavConfig(items)}
        />
      )}
    </>
  );
}
