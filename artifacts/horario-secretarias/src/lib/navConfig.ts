// ─── Nav Config — stored in localStorage ──────────────────────────────────────
// Allows admins to show/hide/rename nav tabs per browser.

export interface NavItem {
  href: string;
  label: string;
  visible: boolean;
}

const LS_KEY = "nav_config_v1";

// All possible nav links with their defaults (add new pages here)
export const NAV_DEFAULTS: NavItem[] = [
  { href: "/",           label: "Inicio",       visible: true  },
  { href: "/horarios",   label: "Horarios",     visible: true  },
  { href: "/asistencia", label: "Asistencia",   visible: true  },
  { href: "/tareas",     label: "Tareas",       visible: true  },
  { href: "/cambios",    label: "Cambios",      visible: true  },
  { href: "/notas",      label: "Notas",        visible: true  },
  { href: "/guias",      label: "Guías",        visible: true  },
  { href: "/foto",       label: "Fotos",        visible: true  },
  { href: "/orientacion",label: "Orientación",  visible: true  },
  { href: "/admin",      label: "Admin",        visible: true  },
];

type StoredConfig = Record<string, { label: string; visible: boolean }>;

function loadRaw(): StoredConfig {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch { return {}; }
}

// Módulo (activable por negocio desde /backoffice) al que pertenece cada ruta.
// Las rutas sin módulo son parte del núcleo y siempre están disponibles.
export const ROUTE_MODULE: Record<string, string> = {
  "/asistencia": "asistencia",
  "/tareas": "tareas",
  "/cambios": "cambios",
  "/notas": "notas",
  "/guias": "guias",
  "/foto": "foto",
  "/orientacion": "orientacion",
};

export function getEnabledModules(): Record<string, boolean> {
  try {
    const s = JSON.parse(localStorage.getItem("htdb:settings") ?? "{}");
    return s.modules ?? {};
  } catch {
    return {};
  }
}

export function isModuleEnabled(moduleKey: string): boolean {
  return getEnabledModules()[moduleKey] !== false;
}

export function getNavConfig(): NavItem[] {
  const raw = loadRaw();
  return NAV_DEFAULTS
    .filter(d => {
      const mod = ROUTE_MODULE[d.href];
      return !mod || isModuleEnabled(mod);
    })
    .map(d => {
      const override = raw[d.href];
      return {
        href: d.href,
        label: override?.label ?? d.label,
        visible: override?.visible ?? d.visible,
      };
    });
}

export function saveNavConfig(items: NavItem[]) {
  const raw: StoredConfig = {};
  for (const item of items) {
    raw[item.href] = { label: item.label, visible: item.visible };
  }
  localStorage.setItem(LS_KEY, JSON.stringify(raw));
}

export function resetNavConfig() {
  localStorage.removeItem(LS_KEY);
}
