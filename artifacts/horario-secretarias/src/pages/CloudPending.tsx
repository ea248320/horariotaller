import { Clock, LogOut, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Pantalla para cuentas recién creadas que aún no tienen un plan activo.
// La persona ya se registró, pero no puede usar la plataforma hasta que la
// dueña le asigne un plan (tras el pago).
export default function CloudPending() {
  const { user, negocio, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-amber-50 to-orange-50">
      <div className="max-w-md w-full bg-card border border-border/50 rounded-3xl shadow-xl p-8 space-y-5 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-foreground">Cuenta creada — pendiente de activación</h1>
          <p className="text-sm text-muted-foreground mt-2">
            ¡Bienvenido/a! El negocio <strong>{negocio?.nombre}</strong> ya está registrado, pero todavía
            no tiene un plan activo. En cuanto se confirme tu plan, se activará el acceso con las
            funciones contratadas.
          </p>
        </div>

        <div className="bg-muted/40 border border-border/50 rounded-xl px-4 py-3 text-left">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>¿Qué sigue?</strong> Coordina tu plan con el proveedor de la plataforma. Una vez
            activado, entra de nuevo con este mismo correo y ya tendrás todo disponible.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Mail className="w-3.5 h-3.5" />
          {user?.email}
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
