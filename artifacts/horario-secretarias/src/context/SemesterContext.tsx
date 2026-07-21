import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Semestre activo GLOBAL de la plataforma. Al cambiarlo, toda la app
// (horarios, guías, fotos, admin, importación) pasa a mostrar y trabajar con
// ese semestre. Se recuerda en el navegador.
export type Semester = "PRIMER" | "SEGUNDO";

const STORAGE_KEY = "semestre-activo";

interface SemesterContextValue {
  semester: Semester;
  setSemester: (s: Semester) => void;
  /** Etiqueta legible: "1er Semestre" / "2do Semestre" */
  semesterLabel: string;
}

const SemesterContext = createContext<SemesterContextValue | null>(null);

function readInitial(): Semester {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "SEGUNDO" ? "SEGUNDO" : "PRIMER";
}

export function semesterLabelOf(s: Semester): string {
  return s === "SEGUNDO" ? "2do Semestre" : "1er Semestre";
}

export function SemesterProvider({ children }: { children: ReactNode }) {
  const [semester, setSemesterState] = useState<Semester>(readInitial);

  const setSemester = useCallback((s: Semester) => {
    localStorage.setItem(STORAGE_KEY, s);
    setSemesterState(s);
  }, []);

  return (
    <SemesterContext.Provider value={{ semester, setSemester, semesterLabel: semesterLabelOf(semester) }}>
      {children}
    </SemesterContext.Provider>
  );
}

export function useSemester() {
  const ctx = useContext(SemesterContext);
  if (!ctx) throw new Error("useSemester must be used inside SemesterProvider");
  return ctx;
}
