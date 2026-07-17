// Postgres local de desarrollo sin Docker ni instalación manual:
// `npm run db:local` descarga (una vez) y levanta un Postgres real en el
// puerto 5433 con datos persistentes en server/.pgdata.
// Dejar corriendo en una terminal aparte mientras se desarrolla.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const dataDir = resolve(import.meta.dirname, '..', '.pgdata');
const alreadyInitialized = existsSync(dataDir);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'preuflow',
  password: 'preuflow',
  port: 5433,
  persistent: true,
});

async function main(): Promise<void> {
  if (!alreadyInitialized) {
    console.log('Inicializando Postgres local en', dataDir);
    await pg.initialise();
  }
  await pg.start();
  if (!alreadyInitialized) {
    await pg.createDatabase('preuflow');
  }
  console.log('Postgres local listo: postgres://preuflow:preuflow@localhost:5433/preuflow');
  console.log('Ctrl+C para detenerlo.');

  const stop = async () => {
    console.log('\nDeteniendo Postgres local...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(async (err) => {
  console.error('Error levantando Postgres local:', err);
  try {
    await pg.stop();
  } catch {
    // ya estaba detenido
  }
  process.exit(1);
});
