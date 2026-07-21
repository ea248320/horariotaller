import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { DEFAULT_DAYS, DEFAULT_TIME_SLOTS } from "@/data/schedule";

export interface PlatformSettings {
  platformName: string;
  subtitle: string;
  days: string[];
  timeSlots: string[];
}

const DEFAULTS: PlatformSettings = {
  platformName: "Mi Plataforma de Horarios",
  subtitle: "Gestión de horarios, clases y equipo",
  days: DEFAULT_DAYS,
  timeSlots: DEFAULT_TIME_SLOTS,
};

interface SettingsContextValue {
  settings: PlatformSettings;
  /** Devuelve un mensaje de error, o null si se guardó bien */
  updateSettings: (patch: Partial<PlatformSettings>) => Promise<string | null>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);

  useEffect(() => {
    fetch(apiUrl("/api/settings"))
      .then(r => r.json())
      .then(s => { if (s?.platformName) setSettings({ ...DEFAULTS, ...s }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = settings.platformName;
  }, [settings.platformName]);

  const updateSettings = useCallback(async (patch: Partial<PlatformSettings>): Promise<string | null> => {
    try {
      const res = await fetch(apiUrl("/api/settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) return data?.error ?? "No se pudo guardar la configuración";
      setSettings({ ...DEFAULTS, ...data });
      return null;
    } catch {
      return "No se pudo guardar la configuración";
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
