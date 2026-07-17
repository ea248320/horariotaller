import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePaymentRecords } from '../hooks/usePaymentRecords';
import { useRealtime } from '../hooks/useRealtime';
import { PaymentBadge } from '../components/PaymentBadge';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Tabla de cuotas del mes. Registro manual: la secretaria marca
// Pagado/Pendiente cuando el alumno paga por fuera del sistema.
export function PagosPage() {
  const { organization } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const { records, loading, error, refresh, setStatus } = usePaymentRecords(month);

  useRealtime(['payments:changed', 'students:changed'], () => void refresh());

  if (organization && !organization.feesEnabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">El módulo de cuotas está desactivado</h1>
        <p className="mt-2 text-sm text-slate-500">
          Puedes activarlo en{' '}
          <Link to="/panel/configuracion" className="font-semibold text-brand underline">
            Configuración
          </Link>
          .
        </p>
      </div>
    );
  }

  const paid = records.filter((r) => r.status === 'pagado').length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Cuotas</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {paid} de {records.length} al día este mes.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">{organization?.studentLabel}</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((r) => (
              <tr key={r.studentId}>
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <PaymentBadge
                    status={r.status}
                    onToggle={() =>
                      void setStatus(r.studentId, r.status === 'pagado' ? 'pendiente' : 'pagado')
                    }
                  />
                </td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No hay {organization?.studentLabel.toLowerCase()}s registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
