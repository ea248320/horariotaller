import { CheckCircle2, LogOut, Building2, Shield, Layers } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Pantalla que aparece tras iniciar sesión en modo nube. Confirma que la
// cadena completa funciona (cuenta + RLS + negocio propio) y sirve de base
// para conectar aquí, en la siguiente etapa, la aplicación real.
export default function CloudWelcome() {
  const { user, negocio, esAdminPlataforma, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary/5 to-secondary/5">
      <div className="max-w-md w-full bg-card border border-border/50 rounded-3xl shadow-xl p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">¡Sesión iniciada!</h1>
            <p className="text-sm text-muted-foreground">Conectado a la base de datos en la nube.</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <Row icon={Building2} label="Negocio" value={negocio?.nombre ?? "— (sin negocio asignado)"} />
          <Row icon={Shield} label="Tu rol" value={negocio ? (negocio.rol === "admin" ? "Administrador" : "Secretaria") : "—"} />
          <Row icon={Layers} label="Plan" value={negocio?.plan ?? "—"} />
          <Row icon={CheckCircle2} label="Correo" value={user?.email ?? "—"} />
          {esAdminPlataforma && (
            <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
              <p className="text-xs font-bold text-primary">⭐ Eres administradora de la plataforma — verás todos los negocios.</p>
            </div>
          )}
        </div>

        {negocio && negocio.activo === false && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700 font-semibold">Este negocio está suspendido. Contacta al proveedor de la plataforma.</p>
          </div>
        )}

        <div className="bg-muted/40 border border-border/50 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            ✅ Esta pantalla confirma que las <strong>cuentas por negocio</strong> y la <strong>seguridad RLS</strong>
            funcionan de punta a punta contra tu base de datos real. El siguiente paso es conectar aquí la
            aplicación completa (horarios, clases, equipo…) para que trabaje con estos datos en la nube en
            lugar del navegador.
          </p>
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-muted text-foreground rounded-xl font-semibold text-sm hover:bg-muted/70 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 rounded-xl">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground truncate">{value}</span>
    </div>
  );
}
