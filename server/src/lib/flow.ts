import { createHmac } from 'node:crypto';

// Integración de cobro de la suscripción SaaS vía Flow (CLP).
// INACTIVA sin FLOW_API_KEY / FLOW_SECRET_KEY: el checkout devuelve
// { available: false } y el frontend muestra un aviso en vez de fallar.
// No activar credenciales reales sin confirmación explícita: implica plata real.

const FLOW_BASE_URL = process.env.FLOW_BASE_URL ?? 'https://sandbox.flow.cl/api';

export function isFlowConfigured(): boolean {
  return Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY);
}

// Flow exige firmar todos los parámetros ordenados alfabéticamente con
// HMAC-SHA256 usando la secret key.
function signParams(params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  const toSign = sorted.map((k) => `${k}${params[k]}`).join('');
  return createHmac('sha256', process.env.FLOW_SECRET_KEY!).update(toSign).digest('hex');
}

export interface FlowPayment {
  url: string;
  token: string;
  flowOrder: number;
}

export async function createFlowPayment(opts: {
  orderId: string;
  subject: string;
  amountClp: number;
  email: string;
}): Promise<FlowPayment> {
  const appBase = process.env.APP_BASE_URL ?? 'http://localhost:5173';
  const params: Record<string, string> = {
    apiKey: process.env.FLOW_API_KEY!,
    commerceOrder: opts.orderId,
    subject: opts.subject,
    currency: 'CLP',
    amount: String(opts.amountClp),
    email: opts.email,
    urlConfirmation: `${appBase.replace(/\/$/, '')}/api/billing/webhook`,
    urlReturn: `${appBase.replace(/\/$/, '')}/panel/configuracion`,
  };
  params.s = signParams(params);

  const res = await fetch(`${FLOW_BASE_URL}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    throw new Error(`Flow respondió ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { url: string; token: string; flowOrder: number };
  return { url: `${data.url}?token=${data.token}`, token: data.token, flowOrder: data.flowOrder };
}

export async function getFlowPaymentStatus(token: string): Promise<{
  status: number; // 1 pendiente, 2 pagada, 3 rechazada, 4 anulada
  commerceOrder: string;
}> {
  const params: Record<string, string> = {
    apiKey: process.env.FLOW_API_KEY!,
    token,
  };
  params.s = signParams(params);
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FLOW_BASE_URL}/payment/getStatus?${qs}`);
  if (!res.ok) {
    throw new Error(`Flow respondió ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as { status: number; commerceOrder: string };
}
