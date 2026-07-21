import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Sparkles, ArrowRight, X } from "lucide-react";
import { useHorario } from "@/context/HorarioContext";
import { useSettings } from "@/context/SettingsContext";
import { apiUrl } from "@/lib/api";

// Asistente de activación: guía al negocio nuevo a su primer "momento de valor"
// en pocos pasos. Es la palanca #1 contra el abandono temprano — el usuario ve
// progreso y utilidad desde la primera sesión. Se oculta solo al completarse.

const DISMISS_KEY = "onboarding-dismissed";

interface Step {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  cta: string;
}

export default function OnboardingChecklist() {
  const { horarioList } = useHorario();
  const { settings } = useSettings();
  const [, navigate] = useLocation();
  const [hasClasses, setHasClasses] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sched, team] = await Promise.all([
          fetch(apiUrl("/api/schedule?horario=ALL")).then(r => r.json()).catch(() => []),
          fetch(apiUrl("/api/team")).then(r => r.json()).catch(() => []),
        ]);
        if (!alive) return;
        setHasClasses(Array.isArray(sched) && sched.length > 0);
        setHasTeam(Array.isArray(team) && team.length > 0);
      } catch { /* silencioso */ }
    })();
    return () => { alive = false; };
  }, [horarioList.length]);

  const nameSet = settings.platformName.trim() !== "" && settings.platformName !== "Mi Plataforma de Horarios";
  const hasCampus = horarioList.length > 0;

  const steps: Step[] = [
    { id: "name",    label: "Ponle el nombre de tu institución", hint: "Personaliza cómo se llama tu plataforma.", done: nameSet,    cta: "Poner nombre" },
    { id: "campus",  label: "Crea tu primer campus o sede",       hint: "El lugar donde ocurren tus clases.",       done: hasCampus,  cta: "Crear campus" },
    { id: "clases",  label: "Carga tu horario de clases",         hint: "Créalo a mano o sube tu Excel con la plantilla.", done: hasClasses, cta: "Cargar horario" },
    { id: "equipo",  label: "Agrega a tu equipo (opcional)",      hint: "Para que cada quien aparezca con su nombre.", done: hasTeam,    cta: "Agregar equipo" },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const pct = Math.round((doneCount / total) * 100);

  // Si ya completó todo y lo cerró, no mostrar más.
  if (dismissed && allDone) return null;

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="max-w-3xl mx-auto w-full bg-card border border-primary/20 rounded-3xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-foreground">
            {allDone ? "¡Plataforma lista! 🎉" : "Pongamos tu plataforma en marcha"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {allDone
              ? "Completaste la configuración inicial. Ya puedes usarla todos los días."
              : `${doneCount} de ${total} pasos · unos minutos y estás lista`}
          </p>
        </div>
        {allDone && (
          <button onClick={handleDismiss} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Ocultar">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="px-6 pt-4">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-2">
        {steps.map(step => {
          const isNext = !step.done && steps.filter(s => !s.done)[0]?.id === step.id;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
                step.done ? "border-emerald-200 bg-emerald-50/50"
                  : isNext ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card"
              }`}
            >
              {step.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                : <Circle className={`w-5 h-5 shrink-0 ${isNext ? "text-primary" : "text-muted-foreground/40"}`} />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${step.done ? "text-emerald-800 line-through/0" : "text-foreground"}`}>
                  {step.label}
                </p>
                {!step.done && <p className="text-xs text-muted-foreground mt-0.5">{step.hint}</p>}
              </div>
              {!step.done && (
                <button
                  onClick={() => navigate("/admin")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    isNext ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {step.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
