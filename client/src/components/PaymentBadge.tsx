// Botón Pagado/Pendiente de la cuota mensual. Registro 100% manual: la
// plataforma nunca cobra a los alumnos.
export function PaymentBadge({
  status,
  onToggle,
  disabled,
}: {
  status: 'pagado' | 'pendiente';
  onToggle: () => void;
  disabled?: boolean;
}) {
  const paid = status === 'pagado';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title="Clic para cambiar"
      className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        paid
          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          : 'bg-red-100 text-red-700 hover:bg-red-200'
      }`}
    >
      {paid ? '✓ Pagado' : 'Pendiente'}
    </button>
  );
}
