import { useEffect, useState, useCallback } from "react";
import { Shield, LogOut, RefreshCw, CheckCircle2, PauseCircle, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { PLANES, planLabel } from "@/lib/planes";

interface NegocioRow {
  id: string;
  nombre: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

// Panel central de la dueña de la plataforma (modo nube): lista TODOS los
// negocios y permite asignarles plan o suspenderlos. Cada negocio ve solo lo
// que su plan incluye.
export default function CloudOwnerPanel() {
  const { user, signOut } = useAuth();
  const [negocios, setNegocios] = useState<NegocioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("negocios")
      .select("id, nombre, plan, activo, created_at")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setNegocios((data as NegocioRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function asignarPlan(id: string, plan: string) {
    setBusyId(id);
    setError("");
    const { error } = await supabase.rpc("asignar_plan", { p_negocio_id: id, p_plan: plan });
    if (error) setError(error.message);
    await cargar();
    setBusyId(null);
  }

  async function toggleActivo(id: string, activo: boolean) {
    setBusyId(id);
    setError("");
    const { error } = await supabase.rpc("set_negocio_activo", { p_negocio_id: id, p_activo: !activo });
    if (error) setError(error.message);
    await cargar();
    setBusyId(null);
  }

  const activos = negocios.filter(n => n.activo).length;
  const pendientes = negocios.filter(n => n.plan === "pendiente").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Panel de la plataforma</h1>
              <p className="text-sm text-muted-foreground">{user?.email} · administradora</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cargar} className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-xl text-sm font-semibold hover:bg-muted/50 transition-colors">
              <RefreshCw className="w-4 h-4" /> Actualizar
            </button>
            <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-xl text-sm font-semibold hover:bg-muted/70 transition-colors">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="Negocios" value={negocios.length} />
          <Stat label="Activos" value={activos} />
          <Stat label="Pendientes" value={pendientes} highlight={pendientes > 0} />
        </div>

        {error && <p className="mb-4 text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : negocios.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-2xl p-10 text-center text-muted-foreground">
            Aún no hay negocios registrados. Cuando alguien cree una cuenta, aparecerá aquí para que le asignes un plan.
          </div>
        ) : (
          <div className="space-y-3">
            {negocios.map(n => (
              <div key={n.id} className="bg-card border border-border/50 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-foreground">{n.nombre}</span>
                      {n.activo ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                          <PauseCircle className="w-3 h-3" /> Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Plan actual: <strong>{planLabel(n.plan)}</strong> · creado {new Date(n.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {n.plan !== "pendiente" && (
                    <button
                      onClick={() => toggleActivo(n.id, n.activo)}
                      disabled={busyId === n.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                    >
                      {n.activo ? <><PauseCircle className="w-3.5 h-3.5" /> Suspender</> : <><PlayCircle className="w-3.5 h-3.5" /> Reactivar</>}
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Asignar plan:</span>
                  {PLANES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => asignarPlan(n.id, p.id)}
                      disabled={busyId === n.id}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${
                        n.plan === p.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground hover:bg-primary/10"
                      }`}
                    >
                      {p.nombre} · {p.precio}
                    </button>
                  ))}
                  {busyId === n.id && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center border ${highlight ? "bg-amber-50 border-amber-200" : "bg-card border-border/50"}`}>
      <p className={`text-2xl font-display font-bold ${highlight ? "text-amber-700" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
