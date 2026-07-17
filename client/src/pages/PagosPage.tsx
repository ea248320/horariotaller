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
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">El módulo de cuotas está desactivado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puedes activarlo en{' '}
          <Link to="/panel/configuracion" className="font-semibold text-primary underline">
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
        <h1 className="font-display text-2xl font-bold text-foreground">Cuotas</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm"
        />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {paid} de {records.length} al día este mes.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{organization?.studentLabel}</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {records.map((r) => (
              <tr key={r.studentId}>
                <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.phone ?? '—'}</td>
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
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
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
