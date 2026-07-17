// Envío de avisos por correo vía Resend.
// INACTIVA sin RESEND_API_KEY: sendEmail devuelve { sent: false } y el flujo
// sigue — la notificación interna es SIEMPRE el respaldo (la secretaria puede
// avisar por teléfono/WhatsApp).

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) return { sent: false, error: 'RESEND_API_KEY no configurada' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'PreuFlow <onboarding@resend.dev>',
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend respondió ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'error desconocido' };
  }
}
