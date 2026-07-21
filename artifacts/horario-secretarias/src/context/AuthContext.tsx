import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

// Negocio (tenant) al que pertenece el usuario que inició sesión.
export interface Negocio {
  id: string;
  nombre: string;
  subtitle: string;
  plan: string;
  activo: boolean;
  modules: Record<string, boolean>;
  rol: string; // rol del usuario dentro del negocio: admin | secretaria
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  negocio: Negocio | null;
  loading: boolean;
  esAdminPlataforma: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUpNegocio: (email: string, password: string, nombreNegocio: string, nombreAdmin: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshNegocio: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja.";
  if (m.includes("user already registered")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
  if (m.includes("password should be at least")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("ya administras un negocio")) return "Ese usuario ya administra un negocio.";
  if (m.includes("unable to validate email")) return "El correo no tiene un formato válido.";
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [esAdminPlataforma, setEsAdminPlataforma] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargarNegocio = useCallback(async (uid: string | undefined) => {
    if (!uid) { setNegocio(null); setEsAdminPlataforma(false); return; }

    // ¿Es admin de la plataforma? (la dueña)
    const { data: admin } = await supabase
      .from("plataforma_admins")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();
    setEsAdminPlataforma(!!admin);

    // Negocio del usuario (a través de su membresía). RLS garantiza que solo
    // vea el suyo.
    const { data: miembro } = await supabase
      .from("negocio_miembros")
      .select("rol, negocios ( id, nombre, subtitle, plan, activo, modules )")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();

    if (miembro && miembro.negocios) {
      const n = miembro.negocios as unknown as Omit<Negocio, "rol">;
      setNegocio({ ...n, rol: miembro.rol });
    } else {
      setNegocio(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await cargarNegocio(data.session?.user?.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await cargarNegocio(s?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [cargarNegocio]);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? traducirError(error.message) : null;
  }, []);

  const signUpNegocio = useCallback(async (
    email: string, password: string, nombreNegocio: string, nombreAdmin: string,
  ): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return traducirError(error.message);
    // Si el proyecto exige confirmación de correo, aún no hay sesión activa.
    if (!data.session) {
      return "__CONFIRM__"; // señal para mostrar "revisa tu correo"
    }
    // Crear el negocio y quedar como admin (función segura en la BD).
    const { error: rpcError } = await supabase.rpc("crear_negocio", {
      p_nombre: nombreNegocio.trim(),
      p_subtitle: "",
      p_nombre_admin: nombreAdmin.trim(),
    });
    if (rpcError) return traducirError(rpcError.message);
    await cargarNegocio(data.session.user.id);
    return null;
  }, [cargarNegocio]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setNegocio(null);
    setEsAdminPlataforma(false);
  }, []);

  const refreshNegocio = useCallback(async () => {
    await cargarNegocio(session?.user?.id);
  }, [cargarNegocio, session]);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      negocio,
      loading,
      esAdminPlataforma,
      signIn,
      signUpNegocio,
      signOut,
      refreshNegocio,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
