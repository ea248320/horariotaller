import type { Response } from 'express';

// Canal de tiempo real por organización via Server-Sent Events.
// Varias secretarias pueden tener el panel abierto a la vez: cualquier cambio
// se transmite a todas las conexiones de la misma organización.

const channels = new Map<number, Set<Response>>();

export function addClient(orgId: number, res: Response): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: {}\n\n`);

  let set = channels.get(orgId);
  if (!set) {
    set = new Set();
    channels.set(orgId, set);
  }
  set.add(res);

  // Heartbeat: mantiene viva la conexión a través de proxies.
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    set!.delete(res);
    if (set!.size === 0) channels.delete(orgId);
  });
}

export function broadcast(orgId: number, event: string, data: unknown = {}): void {
  const set = channels.get(orgId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(payload);
  }
}
