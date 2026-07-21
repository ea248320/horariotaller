import { useSemester } from "@/context/SemesterContext";

// Interruptor global de semestre. Muestra cuál está activo y permite cambiarlo.
// Al cambiar, toda la app (horarios, guías, fotos, admin) pasa a ese semestre.
export default function SemesterToggle({ compact = false }: { compact?: boolean }) {
  const { semester, setSemester } = useSemester();

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl bg-muted p-1 ${compact ? "" : "shadow-sm"}`}>
      {(["PRIMER", "SEGUNDO"] as const).map(s => {
        const active = semester === s;
        return (
          <button
            key={s}
            onClick={() => setSemester(s)}
            title={`Activar ${s === "PRIMER" ? "1er" : "2do"} semestre en toda la plataforma`}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "PRIMER" ? "1er Sem." : "2do Sem."}
            {active && !compact && <span className="ml-1">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
