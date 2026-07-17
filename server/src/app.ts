import express from 'express';
import cors from 'cors';
import { requireAuth } from './middlewares/requireAuth';
import { requireActiveSubscription } from './middlewares/requireActiveSubscription';
import { authRouter } from './routes/auth';
import { organizationRouter } from './routes/organization';
import { scheduleRouter } from './routes/schedule';
import { teachersRouter } from './routes/teachers';
import { studentsRouter } from './routes/students';
import { paymentsRouter } from './routes/payments';
import { notificationsRouter } from './routes/notifications';
import { billingRouter } from './routes/billing';
import { waitlistRouter } from './routes/waitlist';
import { tasksRouter } from './routes/tasks';
import { notesRouter } from './routes/notes';
import { changesRouter } from './routes/changes';
import { workshopsRouter } from './routes/workshops';
import { counselingRouter } from './routes/counseling';

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  // Flow envía el webhook como application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Públicas (o con auth propia por endpoint, como billing).
  app.use('/api/auth', authRouter);
  app.use('/api/billing', billingRouter);

  // Protegidas: sesión válida + bloqueo de escritura si el trial venció.
  const protectedData = [requireAuth, requireActiveSubscription] as const;
  app.use('/api/organization', ...protectedData, organizationRouter);
  app.use('/api/schedule', ...protectedData, scheduleRouter);
  app.use('/api/teachers', ...protectedData, teachersRouter);
  app.use('/api/students', ...protectedData, studentsRouter);
  app.use('/api/payments', ...protectedData, paymentsRouter);
  app.use('/api/notifications', ...protectedData, notificationsRouter);
  app.use('/api/waitlist', ...protectedData, waitlistRouter);
  app.use('/api/tasks', ...protectedData, tasksRouter);
  app.use('/api/notes', ...protectedData, notesRouter);
  app.use('/api/changes', ...protectedData, changesRouter);
  app.use('/api/workshops', ...protectedData, workshopsRouter);
  app.use('/api/counseling', ...protectedData, counselingRouter);

  // Errores no manejados → 500 con mensaje genérico (el detalle va al log).
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Error no manejado:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error interno del servidor.' });
      }
    },
  );

  return app;
}
