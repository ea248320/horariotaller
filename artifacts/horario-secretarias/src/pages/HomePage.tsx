import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MapPin, ArrowRight, CalendarDays } from "lucide-react";
import { useHorario } from "@/context/HorarioContext";
import { useSettings } from "@/context/SettingsContext";
import { apiUrl } from "@/lib/api";
import { DAY_LABELS } from "@/data/schedule";
import OnboardingChecklist from "@/components/OnboardingChecklist";

const DAY_KEYS = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

const ACCENT_BADGE: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700",
  blue:   "bg-blue-100 text-blue-700",
  teal:   "bg-teal-100 text-teal-700",
  orange: "bg-orange-100 text-orange-700",
  cyan:   "bg-cyan-100 text-cyan-700",
  pink:   "bg-pink-100 text-pink-700",
  lime:   "bg-lime-100 text-lime-700",
  amber:  "bg-amber-100 text-amber-700",
};

const ACCENT_TEXT: Record<string, string> = {
  violet: "text-violet-600",
  blue:   "text-blue-600",
  teal:   "text-teal-600",
  orange: "text-orange-600",
  cyan:   "text-cyan-600",
  pink:   "text-pink-600",
  lime:   "text-lime-600",
  amber:  "text-amber-600",
};

const ACCENT_BORDER: Record<string, string> = {
  violet: "border-violet-200/60",
  blue:   "border-blue-200/60",
  teal:   "border-teal-200/60",
  orange: "border-orange-200/60",
  cyan:   "border-cyan-200/60",
  pink:   "border-pink-200/60",
  lime:   "border-lime-200/60",
  amber:  "border-amber-200/60",
};

export default function HomePage() {
  const { setHorarioId, horarioList, horariosLoading } = useHorario();
  const { settings } = useSettings();
  const [, navigate] = useLocation();

  // Gancho diario "Hoy": cuántas clases hay hoy en total (razón para entrar cada día)
  const [clasesHoy, setClasesHoy] = useState<number | null>(null);
  const todayKey = DAY_KEYS[new Date().getDay()];
  const todayLabel = DAY_LABELS[todayKey] ?? "";

  useEffect(() => {
    if (horarioList.length === 0) return;
    let alive = true;
    fetch(apiUrl("/api/schedule?horario=ALL"))
      .then(r => r.json())
      .then((data: Array<{ day: string }>) => {
        if (!alive) return;
        setClasesHoy(Array.isArray(data) ? data.filter(c => c.day === todayKey).length : 0);
      })
      .catch(() => { if (alive) setClasesHoy(null); });
    return () => { alive = false; };
  }, [horarioList.length, todayKey]);

  function handleSelect(id: string) {
    setHorarioId(id);
    navigate("/horarios");
  }

  const cols = horarioList.length <= 2 ? "lg:grid-cols-2" :
               horarioList.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  // Estado vacío: la plataforma recién instalada, sin campus configurados aún.
  // Se muestra el asistente de activación para llegar rápido al primer valor.
  if (!horariosLoading && horarioList.length === 0) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-4 py-10 pb-24 md:pb-10">
        <div className="text-center mb-8 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-3 leading-tight">
            {settings.platformName}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Bienvenida 👋 Sigue estos pasos y en unos minutos tendrás tu horario funcionando.
          </p>
        </div>
        <OnboardingChecklist />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-5rem)] flex flex-col justify-center pb-24 md:pb-0">
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4 text-center w-full">
        {/* Gancho diario: da una razón para entrar cada día */}
        {clasesHoy !== null && clasesHoy > 0 && (
          <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-emerald-100 text-emerald-800 text-sm font-bold mb-5">
            <CalendarDays className="w-4 h-4" />
            Hoy {todayLabel.toLowerCase()}: {clasesHoy} clase{clasesHoy !== 1 ? "s" : ""} en total
          </div>
        )}

        <h1 className="text-5xl md:text-7xl font-display font-extrabold mb-4 leading-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          {settings.platformName}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {settings.subtitle || "Elige el campus que quieres gestionar para acceder a su grilla, matrícula y guías de impresión."}
        </p>
      </div>

      {/* Asistente de activación mientras la configuración no esté completa */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full mb-8">
        <OnboardingChecklist />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 w-full">
        <div className="inline-flex items-center gap-2 py-1 px-4 rounded-full bg-primary/10 text-primary text-sm font-bold tracking-wide mb-6 border border-primary/20">
          <MapPin className="w-4 h-4" />
          Selecciona tu campus
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-5`}>
          {horarioList.map(horario => {
            const badgeCls  = ACCENT_BADGE[horario.accentColor]  ?? "bg-muted text-muted-foreground";
            const textCls   = ACCENT_TEXT[horario.accentColor]   ?? "text-primary";
            const borderCls = ACCENT_BORDER[horario.accentColor] ?? "border-border";
            return (
              <button
                key={horario.id}
                onClick={() => handleSelect(horario.id)}
                className={`group relative bg-card rounded-3xl p-7 border ${borderCls} shadow-xl shadow-black/5 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-primary/50`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${horario.gradient} flex items-center justify-center mb-5 shadow-md group-hover:scale-110 transition-transform duration-300 text-2xl`}>
                  {horario.emoji}
                </div>

                <h2 className="font-display font-extrabold text-xl text-foreground mb-1 leading-tight">
                  {horario.label}
                </h2>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(horario.sedesInfo ?? horario.sedes.map(s => ({ name: s, displayName: s, maxSalas: 6 }))).map(s => (
                    <span key={s.name} className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeCls}`}>
                      {s.displayName}
                    </span>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {horario.subtitle || `${horario.sedes.length} sede${horario.sedes.length !== 1 ? "s" : ""} — grilla semanal colaborativa.`}
                </p>

                <span className={`flex items-center gap-1.5 text-sm font-bold ${textCls} group-hover:gap-2.5 transition-all`}>
                  Ir a horarios
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
