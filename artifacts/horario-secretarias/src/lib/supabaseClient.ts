import { createClient } from "@supabase/supabase-js";

// URL y anon key del proyecto. La anon key es PÚBLICA por diseño: la seguridad
// real la dan las políticas RLS de la base de datos, no el secreto de la clave.
// Por eso es correcto que viaje en el bundle del front-end.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://bhdzeqquqojxsyefxjuy.supabase.co";
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZHplcXF1cW9qeHN5ZWZ4anV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMTAzNzEsImV4cCI6MjA5OTg4NjM3MX0.8JfU5r-o7O-uWLDr6ZbkDptWQ4jKHAEZUu3SuIc1txs";

// Modo nube: mientras lo construimos y probamos, se activa solo bajo demanda
// (parámetro ?cloud=1 o localStorage) para no alterar la app local que ya
// funciona. Cuando la migración esté completa, pasará a ser el modo por defecto.
export const CLOUD_MODE: boolean =
  import.meta.env.VITE_CLOUD === "true" ||
  (typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).has("cloud") ||
      window.localStorage.getItem("cloud-mode") === "1"));

// Recordar la preferencia si llegó por ?cloud=1
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cloud")) {
  window.localStorage.setItem("cloud-mode", "1");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
