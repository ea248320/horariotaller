import { useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, Lock, CalendarDays, ClipboardList, ArrowLeftRight, StickyNote,
  Printer, Camera, HeartHandshake, GraduationCap, Check, X, Activity, Trash2,
} from "lucide-react";
import { getErrorLog, clearErrorLog, type ErrorEntry } from "@/lib/monitor";
import { useSettings } from "@/context/SettingsContext";
import { useHorario } from "@/context/HorarioContext";

// Backoffice del propietario de la plataforma (no aparece en el menú).
// Se accede escribiendo /backoffice en la URL. Aquí se activan o desactivan
// los módulos que este negocio contrató: lo desactivado desaparece del menú
// y sus páginas dejan de estar disponibles.

const MODULE_INFO: { key: string; label: string; icon: React.ElementType; description: string }[] = [
  { key: "tareas",      label: "Tareas",      icon: ClipboardList,   description: "Lista de pendientes del equipo, con checklists y prioridades." },
  { key: "cambios",     label: "Cambios",     icon: ArrowLeftRight,  description: "Registro de cambios de horario de los alumnos." },
  { key: "notas",       label: "Notas",       icon: StickyNote,      description: "Notas rápidas compartidas tipo post-it." },
  { key: "guias",       label: "Guías",       icon: Printer,         description: "Guías de impresión del horario por sede." },
  { key: "foto",        label: "Fotos",       icon: Camera,          description: "Imagen del horario en alta resolución para pantallas/TV." },
  { key: "orientacion", label: "Orientación", icon: HeartHandshake,  description: "Agenda de citas con orientadoras: disponibilidad, estados y reportes." },
  { key: "talleres",    label: "Talleres",    icon: GraduationCap,   description: "Pestaña de talleres con inscripción de alumnos dentro de Horarios." },
];

const SESSION_KEY = "owner-panel-ok";

export default function OwnerPage() {
  const { settings, updateSettings } = useSettings();
  const { horarioList } = useHorario();
  const [, navigate] = useLocation();

  const [unlocked, setUnlocked] = useState(sessionStorage.getItem(SESSION_KEY) === "1");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [modules, setModules] = useState<Record<string, boolean>>(settings.modules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorLog, setErrorLog] = useState<ErrorEntry[]>(getErrorLog);

  const needsPinSetup = !settings.ownerPin;

  async function handleCreatePin() {
    setPinError("");
    const err = await updateSettings({ ownerPin: pinInput.trim() });
    if (err) { setPinError(err); return; }
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
    setPinInput("");
  }

  function handleUnlock() {
    if (pinInput.trim() === settings.ownerPin) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      setPinError("");
    } else {
      setPinError("PIN incorrecto");
    }
    setPinInput("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const err = await updateSettings({ modules });
    setSaving(false);
    if (err) { setError(err); return; }
    // El menú y las rutas leen los módulos al cargar: recargar para aplicar
    window.location.reload();
  }

  const changed = JSON.stringify(modules) !== JSON.stringify(settings.modules);

  if (!unlocked) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-card border border-border/50 rounded-3xl shadow-xl p-8 text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">Panel del propietario</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {needsPinSetup
                ? "Primera vez: crea un PIN de 4 a 8 dígitos para proteger este panel."
                : "Ingresa tu PIN para administrar los módulos de este negocio."}
            </p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") (needsPinSetup ? handleCreatePin() : handleUnlock()); }}
            placeholder="••••"
            className="w-full text-center text-2xl tracking-[0.5em] px-3 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {pinError && <p className="text-sm text-red-600 font-semibold">{pinError}</p>}
          <button
            onClick={needsPinSetup ? handleCreatePin : handleUnlock}
            disabled={pinInput.trim().length < 4}
            className="w-full px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {needsPinSetup ? "Crear PIN y entrar" : "Entrar"}
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Panel del propietario</h1>
          <p className="text-sm text-muted-foreground">
            Configura qué módulos tiene contratados este negocio. Lo que apagues desaparece del menú y deja de estar disponible.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
        <div className="bg-card border border-border/50 rounded-2xl p-4 text-center">
          <p className="text-xl font-display font-bold text-primary">{settings.platformName}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">nombre del negocio</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4 text-center">
          <p className="text-xl font-display font-bold text-foreground">{horarioList.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">campus configurados</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-4 text-center">
          <p className="text-xl font-display font-bold text-foreground">
            {Object.values(modules).filter(Boolean).length} / {MODULE_INFO.length}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">módulos activos</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {MODULE_INFO.map(({ key, label, icon: Icon, description }) => {
          const on = modules[key] !== false;
          return (
            <button
              key={key}
              onClick={() => setModules(m => ({ ...m, [key]: !on }))}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-colors ${
                on ? "border-primary/40 bg-primary/5" : "border-border bg-card opacity-70"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </div>
              <div className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors shrink-0 ${
                on ? "bg-primary justify-end" : "bg-muted justify-start"
              }`}>
                <div className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center">
                  {on ? <Check className="w-3.5 h-3.5 text-primary" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving || !changed}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {changed && (
          <p className="text-xs text-amber-600">Al guardar, la página se recargará para aplicar el nuevo menú.</p>
        )}
        {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
      </div>

      {/* ── Salud de la aplicación ── */}
      <div className="mt-8 bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            errorLog.length === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
          }`}>
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm text-foreground">Salud de la aplicación</p>
            <p className="text-xs text-muted-foreground">
              {errorLog.length === 0
                ? "Sin errores registrados en este navegador. Todo en orden."
                : `${errorLog.length} error${errorLog.length !== 1 ? "es" : ""} registrado${errorLog.length !== 1 ? "s" : ""} — si la app se comporta raro, esta lista ayuda a diagnosticar.`}
            </p>
          </div>
          {errorLog.length > 0 && (
            <button
              onClick={() => { clearErrorLog(); setErrorLog([]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
        {errorLog.length > 0 && (
          <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
            {errorLog.slice(0, 10).map((e, i) => (
              <div key={i} className="px-5 py-2.5">
                <p className="text-xs font-mono text-foreground break-all">{e.message}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(e.time).toLocaleString()} · v{e.version}{e.source ? ` · ${e.source}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Plataforma v{__APP_VERSION__} · compilada el {new Date(__BUILD_TIME__).toLocaleDateString()}
      </p>

      <div className="mt-4 flex items-start gap-2.5 bg-muted/40 border border-border/50 rounded-2xl px-4 py-3">
        <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Los módulos <strong>Horarios</strong>, <strong>Alertas</strong> y <strong>Admin</strong> son el núcleo de la
          plataforma y siempre están activos. Este panel no aparece en el menú: se accede escribiendo
          <span className="font-mono font-semibold"> /backoffice</span> en la dirección. El PIN es una barrera práctica
          para el día a día, no un sistema de seguridad bancaria.
        </p>
      </div>
    </div>
  );
}
