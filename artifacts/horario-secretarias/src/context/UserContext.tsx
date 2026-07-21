import { createContext, useContext, useState, type ReactNode } from "react";

export interface CurrentUser {
  id: number | null;
  name: string;
  role: "secretaria" | "admin" | "invitado" | "orientadora";
  horarioId: string;
  color: string;
}

interface UserContextType {
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  clearUser: () => void;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  clearUser: () => {},
});

const LS_KEY = "horario_current_user";

// Identidad por defecto: la app entra directo como administradora, sin pedir
// nada. Quien quiera aparecer con su nombre (para presencia y atribución)
// puede cambiarlo desde la barra superior, pero es opcional.
const DEFAULT_USER: CurrentUser = {
  id: null,
  name: "Administración",
  role: "admin",
  horarioId: "",
  color: "violet",
};

function loadFromStorage(): CurrentUser {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_USER };
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return { ...DEFAULT_USER };
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(loadFromStorage);

  const setCurrentUser = (user: CurrentUser | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem(LS_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LS_KEY);
    }
  };

  // "Salir" vuelve a la identidad por defecto (no deja la app sin usuario).
  const clearUser = () => setCurrentUser({ ...DEFAULT_USER });

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}

export const USER_COLORS: Record<string, { bg: string; text: string; light: string; ring: string }> = {
  violet:  { bg: "bg-violet-500",  text: "text-violet-600",  light: "bg-violet-100",  ring: "ring-violet-400" },
  rose:    { bg: "bg-rose-500",    text: "text-rose-600",    light: "bg-rose-100",    ring: "ring-rose-400" },
  sky:     { bg: "bg-sky-500",     text: "text-sky-600",     light: "bg-sky-100",     ring: "ring-sky-400" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-100", ring: "ring-emerald-400" },
  amber:   { bg: "bg-amber-500",   text: "text-amber-600",   light: "bg-amber-100",   ring: "ring-amber-400" },
  orange:  { bg: "bg-orange-500",  text: "text-orange-600",  light: "bg-orange-100",  ring: "ring-orange-400" },
  fuchsia: { bg: "bg-fuchsia-500", text: "text-fuchsia-600", light: "bg-fuchsia-100", ring: "ring-fuchsia-400" },
  teal:    { bg: "bg-teal-500",    text: "text-teal-600",    light: "bg-teal-100",    ring: "ring-teal-400" },
  indigo:  { bg: "bg-indigo-500",  text: "text-indigo-600",  light: "bg-indigo-100",  ring: "ring-indigo-400" },
  pink:    { bg: "bg-pink-500",    text: "text-pink-600",    light: "bg-pink-100",    ring: "ring-pink-400" },
  slate:   { bg: "bg-slate-500",   text: "text-slate-600",   light: "bg-slate-100",   ring: "ring-slate-400" },
};

export const AVAILABLE_COLORS = Object.keys(USER_COLORS);

export function UserAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const c = USER_COLORS[color] ?? USER_COLORS.violet;
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const sizeClass = size === "xs" ? "w-5 h-5 text-[10px]" : size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-lg" : "w-9 h-9 text-sm";
  return (
    <div className={`${sizeClass} ${c.bg} rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm`}>
      {initials}
    </div>
  );
}
