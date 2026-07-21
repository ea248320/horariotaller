import { apiUrl } from "@/lib/api";

// Descarga un respaldo completo de la plataforma como archivo JSON.
// El backend local registra la fecha para el recordatorio de respaldo.
export async function downloadBackup(): Promise<void> {
  const res = await fetch(apiUrl("/api/backup"));
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `respaldo_plataforma_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

const SNOOZE_KEY = "backup-reminder-snooze";
const REMINDER_DAYS = 14;
const SNOOZE_DAYS = 7;

export function shouldRemindBackup(lastBackupAt: string | undefined, hasData: boolean): boolean {
  if (!hasData) return false;
  const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  if (Date.now() < snoozedUntil) return false;
  if (!lastBackupAt) return true;
  const elapsed = Date.now() - new Date(lastBackupAt).getTime();
  return elapsed > REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

export function snoozeBackupReminder(): void {
  localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
}
