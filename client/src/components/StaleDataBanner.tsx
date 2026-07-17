export function StaleDataBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <strong>Sin conexión con el servidor.</strong> Estás viendo la última copia guardada en este
      equipo; puede estar desactualizada. Los cambios quedarán deshabilitados hasta que vuelva la
      conexión.
    </div>
  );
}
