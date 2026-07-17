import { createApp } from './app';
import { bootstrapDatabase } from './db/bootstrap';

const PORT = Number(process.env.PORT ?? 4000);

async function main(): Promise<void> {
  await bootstrapDatabase();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`PreuFlow API escuchando en http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
