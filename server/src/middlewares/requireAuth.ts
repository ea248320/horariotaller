import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      orgId: number;
    }
  }
}

// Exige sesión válida: Authorization: Bearer <token>.
// Para SSE (EventSource no permite headers) también acepta ?token=.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : typeof req.query.token === 'string'
      ? req.query.token
      : null;

  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
    return;
  }
  req.orgId = payload.orgId;
  next();
}
