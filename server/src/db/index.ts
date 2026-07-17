import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://preuflow:preuflow@localhost:5433/preuflow';

// SSL condicional: Supabase (y la mayoría de los Postgres administrados) exigen
// SSL, pero el Postgres local no lo soporta. Se activa solo si el host no es
// localhost. NO quitar: sin esto, Supabase rechaza la conexión.
function needsSsl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

export const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { schema };
