import { useState } from "react";
import { CalendarDays, Mail, Lock, Building2, User as UserIcon, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";

// Pantalla de acceso de la versión en la nube (cuentas reales por negocio).
// Dos modos: iniciar sesión (usuario existente) o crear un negocio nuevo.
export default function CloudLoginPage() {
  const { signIn, signUpNegocio } = useAuth();
  const { settings } = useSettings();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmMsg, setConfirmMsg] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    let err: string | null;
    if (modo === "login") {
      err = await signIn(email, password);
    } else {
      err = await signUpNegocio(email, password, nombreNegocio, nombreAdmin);
      if (err === "__CONFIRM__") { setConfirmMsg(true); setLoading(false); return; }
    }
    setLoading(false);
    if (err) setError(err);
    // En éxito, AuthProvider actualiza la sesión y App muestra la app.
  }

  if (confirmMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="max-w-sm w-full bg-card border border-border/50 rounded-3xl shadow-xl p-8 text-center space-y-4">
          <div className="text-4xl">📧</div>
          <h1 className="font-display font-bold text-xl text-foreground">Revisa tu correo</h1>
          <p className="text-sm text-muted-foreground">
            Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar
            tu cuenta y luego vuelve aquí a iniciar sesión.
          </p>
          <button
            onClick={() => { setConfirmMsg(false); setModo("login"); }}
            className="w-full px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-3">
            <CalendarDays className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-foreground">{settings.platformName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {modo === "login" ? "Inicia sesión en tu cuenta" : "Crea la cuenta de tu negocio"}
          </p>
        </div>

        <div className="bg-card border border-border/50 rounded-3xl shadow-xl p-6">
          {/* Selector login / registro */}
          <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
            {(["login", "registro"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setModo(m); setError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                  modo === m ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Iniciar sesión" : "Crear negocio"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {modo === "registro" && (
              <>
                <Field icon={Building2} placeholder="Nombre de tu negocio / institución"
                  value={nombreNegocio} onChange={setNombreNegocio} />
                <Field icon={UserIcon} placeholder="Tu nombre"
                  value={nombreAdmin} onChange={setNombreAdmin} />
              </>
            )}
            <Field icon={Mail} type="email" placeholder="Correo electrónico"
              value={email} onChange={setEmail} />
            <Field icon={Lock} type="password" placeholder="Contraseña (mínimo 6 caracteres)"
              value={password} onChange={setPassword} />

            {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password || (modo === "registro" && (!nombreNegocio || !nombreAdmin))}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {modo === "login" ? "Entrar" : "Crear mi negocio"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {modo === "login"
            ? "¿No tienes cuenta? Usa \"Crear negocio\" arriba."
            : "¿Ya tienes cuenta? Usa \"Iniciar sesión\" arriba."}
        </p>

        <div className="text-center mt-4">
          <a
            href={import.meta.env.BASE_URL}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            ← Volver a la versión normal
          </a>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type = "text", placeholder, value, onChange }: {
  icon: React.ElementType; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}
