import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { type HorarioId, type HorarioConfig, HORARIOS } from "@/data/schedule";
import { apiUrl } from "@/lib/api";

interface HorarioContextValue {
  horarioId: HorarioId;
  horario: HorarioConfig;
  setHorarioId: (id: HorarioId) => void;
  horarioList: HorarioConfig[];
  horariosMap: Record<string, HorarioConfig>;
  reloadHorarios: () => Promise<void>;
}

const HorarioContext = createContext<HorarioContextValue | null>(null);

interface ApiHorario {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  gradient: string;
  accentColor: string;
  isSystem: boolean;
  sortOrder: number;
  sedes: { name: string; displayName: string; maxSalas: number }[];
}

function apiToConfig(h: ApiHorario): HorarioConfig {
  return {
    id: h.id,
    label: h.name,
    subtitle: h.subtitle,
    emoji: h.emoji,
    gradient: h.gradient,
    accentColor: h.accentColor,
    isSystem: h.isSystem,
    sedes: h.sedes.map(s => s.name),
    sedesInfo: h.sedes,
  };
}

async function fetchHorariosFromApi(): Promise<HorarioConfig[]> {
  const res = await fetch(apiUrl("/api/horarios"));
  if (!res.ok) throw new Error("API error");
  const data: ApiHorario[] = await res.json();
  return data.map(apiToConfig);
}

function buildMap(list: HorarioConfig[]): Record<string, HorarioConfig> {
  const map: Record<string, HorarioConfig> = { ...HORARIOS };
  for (const h of list) map[h.id] = h;
  return map;
}

function getInitialHorario(): HorarioId {
  const urlParam = new URLSearchParams(window.location.search).get("campus");
  if (urlParam) return urlParam as HorarioId;
  const stored = sessionStorage.getItem("selected-horario");
  if (stored) return stored as HorarioId;
  return "TEMUCO";
}

function updateUrlCampus(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("campus", id);
  window.history.replaceState({}, "", url.toString());
}

export function HorarioProvider({ children }: { children: ReactNode }) {
  const [horariosMap, setHorariosMap] = useState<Record<string, HorarioConfig>>(HORARIOS);
  const [horarioList, setHorarioList] = useState<HorarioConfig[]>(Object.values(HORARIOS));

  const [horarioId, setHorarioIdState] = useState<HorarioId>(getInitialHorario);

  // Memoizado para que no cambie de referencia en cada render — evita que
  // efectos que dependen de horario.sedes se disparen innecesariamente.
  const horario = useMemo(
    () => horariosMap[horarioId] ?? horariosMap["TEMUCO"] ?? Object.values(horariosMap)[0],
    [horariosMap, horarioId]
  );

  async function reloadHorarios() {
    try {
      const list = await fetchHorariosFromApi();
      const map = buildMap(list);
      setHorarioList(list);
      setHorariosMap(map);
      if (!map[horarioId]) {
        const first = list[0]?.id ?? "TEMUCO";
        setHorarioIdState(first as HorarioId);
        sessionStorage.setItem("selected-horario", first);
        updateUrlCampus(first);
      }
    } catch {
      // silently use static fallback
    }
  }

  useEffect(() => {
    updateUrlCampus(horarioId);
    reloadHorarios();
  }, []);

  function setHorarioId(id: HorarioId) {
    sessionStorage.setItem("selected-horario", id);
    setHorarioIdState(id);
    updateUrlCampus(id);
  }

  return (
    <HorarioContext.Provider value={{ horarioId, horario, setHorarioId, horarioList, horariosMap, reloadHorarios }}>
      {children}
    </HorarioContext.Provider>
  );
}

export function useHorario() {
  const ctx = useContext(HorarioContext);
  if (!ctx) throw new Error("useHorario must be used inside HorarioProvider");
  return ctx;
}
