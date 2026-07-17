const TOKEN_KEY = 'preuflow_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  conflicts?: string[];
  waitlistAvailable?: boolean;

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : `Error ${status}`);
    this.status = status;
    if (typeof payload.code === 'string') this.code = payload.code;
    if (Array.isArray(payload.conflicts)) this.conflicts = payload.conflicts as string[];
    if (typeof payload.waitlistAvailable === 'boolean') this.waitlistAvailable = payload.waitlistAvailable;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    // respuesta sin cuerpo JSON
  }

  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      // Sesión vencida: limpiar y mandar a login.
      setToken(null);
      window.location.href = '/login';
    }
    throw new ApiError(res.status, payload);
  }
  return payload as T;
}
