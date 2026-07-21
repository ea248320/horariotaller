# Base de datos (Supabase) — Plataforma de Horarios

Esta carpeta contiene el esquema versionado de la base de datos multi-negocio
con Row Level Security (RLS). Cada negocio (tenant) ve **solo** sus datos, y la
regla se impone en la base de datos, no en la aplicación.

## Cómo aplicar las migraciones

1. Entra a tu proyecto en [supabase.com](https://supabase.com) → **SQL Editor**.
2. Abre `migrations/0001_init.sql`, copia todo su contenido, pégalo y pulsa **Run**.
3. Repite con `migrations/0002_signup.sql`.
4. Repite con `migrations/0003_policies_optimizadas.sql` (optimiza las políticas
   y elimina las advertencias de rendimiento del Security Advisor).
5. Repite con `migrations/0004_planes.sql` (planes/versiones: las cuentas nuevas
   nacen "pendientes" sin acceso; la dueña asigna el plan que activa los módulos).
6. Repite con `migrations/0005_notificacion_email.sql` (te envía un correo cada
   vez que se registra un cliente nuevo). Después de ejecutarla, sigue los pasos
   del encabezado del archivo para conectar tu cuenta de Resend.

Aplícalas siempre en orden numérico. Cada archivo nuevo (`0004`, `0005`…) es un
cambio incremental: se ejecuta una vez y queda registrado en tu historial.

Listo: se crean todas las tablas, los índices, las funciones de seguridad y las
políticas RLS. Puedes verlas en **Table Editor** y **Authentication → Policies**.

## Convertirte en administradora de la plataforma

El "admin de plataforma" es quien ve y gestiona **todos** los negocios (tú).
Después de crear tu cuenta de usuario en la app (o en Authentication → Users):

1. Ve a **Authentication → Users** y copia tu `user id` (un UUID).
2. En **SQL Editor**, ejecuta (reemplazando el UUID):

   ```sql
   insert into public.plataforma_admins (user_id)
   values ('TU-UUID-AQUI');
   ```

Desde ese momento tu cuenta puede leer y administrar todos los negocios, y el
panel central de propietario te los mostrará todos.

## Modelo de datos (resumen)

- **negocios**: cada cliente. Tiene `activo` (para suspender morosos), `plan`,
  y `modules` (qué módulos contrató).
- **negocio_miembros**: qué usuarios (correo/contraseña) pertenecen a cada
  negocio y con qué rol (`admin` / `secretaria`).
- **plataforma_admins**: tú. Acceso a todos los negocios.
- El resto de las tablas (horarios, clases, alumnos, tareas, notas, talleres,
  orientación…) llevan `negocio_id` y están protegidas por la política
  `tenant_all`: cada fila solo es visible para su negocio.

## Seguridad

- **RLS activo en todas las tablas.** Un usuario autenticado nunca recibe filas
  de un negocio ajeno, aunque manipule la app.
- **Registro self-service** vía la función `crear_negocio()`, que es la única
  forma en que un usuario normal puede crear un negocio (y queda como su admin).
- La **anon key** que usa el front-end es pública por diseño: no da acceso a
  nada sin una sesión válida y sin pasar las políticas RLS.
- Nunca pongas la **service_role key** en el front-end (esa sí salta RLS). Solo
  se usa en servidores de confianza.
