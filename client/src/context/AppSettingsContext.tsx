import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// Modo de semestre GLOBAL del panel (exclusivo de preuniversitarios): al elegir
// "1er semestre" o "2do semestre" TODAS las pestañas (inicio, calendario,
// cursos…) se acotan a ese semestre; los cursos anuales aparecen siempre.
export type SemesterMode = 'todos' | '1' | '2';

interface AppSettings {
  dark: boolean;
  toggleDark: () => void;
  semester: SemesterMode;
  setSemester: (mode: SemesterMode) => void;
  /** true si el curso es visible en el modo de semestre actual */
  matchesSemester: (courseSemester: string | null) => boolean;
}

const AppSettingsContext = createContext<AppSettings | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('preuflow_dark') === '1');
  const [semester, setSemesterState] = useState<SemesterMode>(() => {
    const saved = localStorage.getItem('preuflow_semester');
    return saved === '1' || saved === '2' ? saved : 'todos';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('preuflow_dark', dark ? '1' : '0');
  }, [dark]);

  const toggleDark = useCallback(() => setDark((d) => !d), []);

  const setSemester = useCallback((mode: SemesterMode) => {
    setSemesterState(mode);
    localStorage.setItem('preuflow_semester', mode);
  }, []);

  const matchesSemester = useCallback(
    (courseSemester: string | null) => {
      if (semester === 'todos') return true;
      // Sin semestre (talleres/academias) y anuales: visibles siempre.
      return courseSemester === null || courseSemester === 'anual' || courseSemester === semester;
    },
    [semester],
  );

  const value = useMemo(
    () => ({ dark, toggleDark, semester, setSemester, matchesSemester }),
    [dark, toggleDark, semester, setSemester, matchesSemester],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettings {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings debe usarse dentro de <AppSettingsProvider>');
  return ctx;
}
