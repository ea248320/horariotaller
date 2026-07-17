// Presets por tipo de negocio. Se aplican al registrarse y se pueden
// reconfigurar después en /panel/configuracion.
// El selector de semestre es EXCLUSIVO de 'preuniversitario'.

export type BusinessType = 'preuniversitario' | 'taller' | 'academia' | 'personalizado';

export interface BusinessPreset {
  courseLabel: string;
  studentLabel: string;
  brandColor: string;
  feesEnabled: boolean;
}

export const BUSINESS_PRESETS: Record<BusinessType, BusinessPreset> = {
  preuniversitario: {
    courseLabel: 'Curso',
    studentLabel: 'Alumno',
    brandColor: '#2563EB',
    feesEnabled: false,
  },
  taller: {
    courseLabel: 'Taller',
    studentLabel: 'Participante',
    brandColor: '#D97706',
    feesEnabled: true,
  },
  academia: {
    courseLabel: 'Clase',
    studentLabel: 'Alumno',
    brandColor: '#059669',
    feesEnabled: true,
  },
  personalizado: {
    courseLabel: 'Curso',
    studentLabel: 'Alumno',
    brandColor: '#4F46E5',
    feesEnabled: true,
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === 'string' &&
    ['preuniversitario', 'taller', 'academia', 'personalizado'].includes(value)
  );
}
