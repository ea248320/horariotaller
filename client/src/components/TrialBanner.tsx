import { Link } from 'react-router-dom';
import type { BillingStatus } from '../lib/types';

// Aviso de trial por vencer / vencido y de límite de alumnos del plan.
export function TrialBanner({ status }: { status: BillingStatus | null }) {
  if (!status) return null;

  if (!status.subscriptionActive && status.trialExpired) {
    return (
      <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>Tu período de prueba terminó.</strong> Tus datos siguen disponibles en modo lectura.{' '}
        <Link to="/panel/configuracion" className="font-semibold underline">
          Elige un plan
        </Link>{' '}
        para seguir editando.
      </div>
    );
  }

  const nearLimit =
    status.studentLimit !== null && status.studentCount >= Math.floor(status.studentLimit * 0.9);

  return (
    <>
      {!status.subscriptionActive && status.trialDaysLeft <= 5 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tu prueba gratis termina en <strong>{status.trialDaysLeft} día{status.trialDaysLeft === 1 ? '' : 's'}</strong>.{' '}
          <Link to="/panel/configuracion" className="font-semibold underline">
            Elige un plan
          </Link>{' '}
          para no perder acceso a la edición.
        </div>
      )}
      {nearLimit && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Estás usando {status.studentCount} de {status.studentLimit} cupos de alumnos del plan{' '}
          {status.plan.name}.{' '}
          <Link to="/panel/configuracion" className="font-semibold underline">
            Sube de plan
          </Link>{' '}
          si necesitas más.
        </div>
      )}
    </>
  );
}
