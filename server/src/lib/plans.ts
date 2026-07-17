// Fuente única de verdad de los planes del SaaS (precios CLP, límites).
// El límite de alumnos se aplica en routes/students.ts.

export type PlanId = 'starter' | 'growth' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  priceClp: number; // mensual, CLP
  maxStudents: number | null; // null = sin límite
  features: string[];
}

export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceClp: 19990,
    maxStudents: 80,
    features: [
      'Hasta 80 alumnos',
      'Horarios con detección de choques',
      'Cuotas pagado/pendiente',
      'Lista de espera',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    priceClp: 39990,
    maxStudents: 250,
    features: [
      'Hasta 250 alumnos',
      'Todo lo de Starter',
      'Avisos por correo (Resend)',
      'Tiempo real multi-secretaría',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceClp: 69990,
    maxStudents: null,
    features: [
      'Alumnos ilimitados',
      'Todo lo de Growth',
      'Soporte prioritario',
    ],
  },
};

export function getPlan(id: string | null | undefined): Plan {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.starter;
}
