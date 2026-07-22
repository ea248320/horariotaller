// Definición de planes (versiones) — debe coincidir con modulos_por_plan() en
// la migración 0004_planes.sql de la base de datos.

export interface PlanInfo {
  id: "basico" | "pro" | "completo";
  nombre: string;
  precio: string;
  modules: Record<string, boolean>;
  incluye: string[];
}

const NINGUNO = {
  asistencia: false, tareas: false, cambios: false, guias: false,
  notas: false, foto: false, orientacion: false, talleres: false,
};

export const PLANES: PlanInfo[] = [
  {
    id: "basico",
    nombre: "Básico",
    precio: "$19.990",
    modules: { ...NINGUNO },
    incluye: ["Horarios", "Administración", "Alertas de cupos"],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: "$34.990",
    modules: { ...NINGUNO, asistencia: true, tareas: true, cambios: true, notas: true, guias: true, foto: true, talleres: true },
    incluye: ["Todo lo del Básico", "Tareas", "Cambios", "Notas", "Guías", "Fotos", "Talleres"],
  },
  {
    id: "completo",
    nombre: "Completo",
    precio: "$49.990",
    modules: { asistencia: true, tareas: true, cambios: true, notas: true, guias: true, foto: true, orientacion: true, talleres: true },
    incluye: ["Todo lo del Pro", "Orientación (agenda de citas)"],
  },
];

export function planLabel(id: string): string {
  if (id === "pendiente") return "Pendiente de activación";
  return PLANES.find(p => p.id === id)?.nombre ?? id;
}
