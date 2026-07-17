# PreuFlow

Plataforma multi-tenant de gestión de horarios para preuniversitarios, talleres y
academias en Chile. Backend Express + Drizzle + Postgres (`server/`), frontend
React + Vite + Tailwind (`client/`).

## Correr en desarrollo (3 terminales)

```bash
# 1. Postgres local (se descarga solo la primera vez, datos en server/.pgdata)
cd server && npm run db:local

# 2. API en http://localhost:4000
cd server && npm run dev

# 3. Frontend en http://localhost:5173 (proxy /api → 4000)
cd client && npm run dev
```

Requiere Node 20+. `npm install` en `server/` y `client/` la primera vez.

## Variables de entorno (server)

Ver `server/.env.example`. Sin configurar nada, corre completo en local:
- Sin `RESEND_API_KEY`: los avisos por correo quedan inactivos; la notificación
  interna funciona siempre.
- Sin `FLOW_API_KEY`/`FLOW_SECRET_KEY`: el checkout muestra un aviso;
  `POST /api/billing/mark-paid` activa un plan a mano.

### Supabase + Railway

Usar SIEMPRE el connection string del **Session pooler** de Supabase
(`postgres.TU-PROJECT-REF@aws-0-REGION.pooler.supabase.com:5432`), nunca la
"Direct connection" (solo IPv6; Railway no tiene salida IPv6). El SSL se activa
solo automáticamente cuando el host no es localhost.

## Reglas de negocio clave

- Solo el dueño/secretaría usa el sistema. No hay portal de alumnos/profesores.
- La plataforma **nunca** cobra a los alumnos: las cuotas son un registro manual
  Pagado/Pendiente por alumno y mes.
- Choques de horario: un profesor o sala no pueden traslaparse el mismo día
  (`OVERLAPS` de Postgres). Cursos de semestres distintos ('1' vs '2') **no**
  chocan entre sí; un curso 'anual' choca con todo. El semestre es exclusivo
  del tipo de negocio `preuniversitario`.
- Cupos: curso lleno → se ofrece lista de espera; al liberarse un cupo se avisa
  al primero (correo si hay Resend, y SIEMPRE notificación interna).
- Tiempo real por SSE (`server/src/realtime/sse.ts`, hook `useRealtime`).
- `useCachedData` guarda la última respuesta en localStorage: si el servidor se
  cae, se muestra esa copia con aviso (solo lectura, no offline-first).
- SaaS: trial de 14 días, límite de alumnos por plan (Starter 80 / Growth 250 /
  Pro ilimitado), cobro preparado para Flow.
