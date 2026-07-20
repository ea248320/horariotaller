import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiUrl } from "@/lib/api";

export interface PlatformSettings {
  platformName: string;
  subtitle: string;
}

const DEFAULTS: PlatformSettings = {
  platformName: "Mi Plataforma de Horarios",
  subtitle: "Gestión de horarios, clases y equipo",
};

interface SettingsContextValue {
  settings: PlatformSettings;
  updateSettings: (patch: Partial<PlatformSettings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);

  useEffect(() => {
    fetch(apiUrl("/api/settings"))
      .then(r => r.json())
      .then(s => { if (s?.platformName) setSettings(s); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = settings.platformName;
  }, [settings.platformName]);

  const updateSettings = useCallback(async (patch: Partial<PlatformSettings>) => {
    const res = await fetch(apiUrl("/api/settings"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
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
