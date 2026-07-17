import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PaymentRecord } from '../lib/types';

// Estado de pago mensual (registro manual pagado/pendiente por alumno).
export function usePaymentRecords(month: string) {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ records: PaymentRecord[] }>(`/payments?month=${month}`);
      setRecords(data.records);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando pagos');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const setStatus = useCallback(
    async (studentId: number, status: 'pagado' | 'pendiente') => {
      await api('/payments', { method: 'PUT', body: { studentId, month, status } });
      await refresh();
    },
    [month, refresh],
  );

  return { records, loading, error, refresh, setStatus };
}
