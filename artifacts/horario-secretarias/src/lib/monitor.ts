// Monitoreo ligero de errores en producción: captura errores de JavaScript y
// promesas rechazadas, y guarda los últimos 50 en el navegador. Se revisan
// desde el panel del propietario (/backoffice → Salud de la aplicación).
// Se guarda fuera del prefijo htdb: para no contaminar los respaldos.

const LOG_KEY = "app-errorlog";
const MAX_ENTRIES = 50;

export interface ErrorEntry {
  time: string;
  message: string;
  source?: string;
  version: string;
}

export function getErrorLog(): ErrorEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  localStorage.removeItem(LOG_KEY);
}

function record(message: string, source?: string) {
  try {
    const log = getErrorLog();
    log.unshift({
      time: new Date().toISOString(),
      message: String(message).slice(0, 500),
      source: source?.slice(0, 200),
      version: __APP_VERSION__,
    });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, MAX_ENTRIES)));
  } catch {
    // nunca dejar que el monitor cause errores propios
  }
}

export function installErrorMonitor(): void {
  window.addEventListener("error", e => {
    record(e.message, e.filename ? `${e.filename}:${e.lineno}` : undefined);
  });
  window.addEventListener("unhandledrejection", e => {
    const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
    record(`Promesa rechazada: ${reason}`);
  });
}
