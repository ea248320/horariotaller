-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Plataforma de Horarios — Esquema multi-negocio con RLS                     ║
-- ║                                                                            ║
-- ║  Cada fila de datos pertenece a un negocio (negocio_id). Row Level         ║
-- ║  Security garantiza, EN LA BASE DE DATOS, que cada usuario solo lea o      ║
-- ║  escriba filas de los negocios a los que pertenece. Aunque alguien         ║
-- ║  manipule la aplicación desde su navegador, el servidor se niega a         ║
-- ║  entregar datos de otro negocio.                                           ║
-- ║                                                                            ║
-- ║  Cómo aplicar: Supabase → SQL Editor → pega este archivo → Run.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Negocios (tenants) ──────────────────────────────────────────────────────
create table if not exists public.negocios (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  subtitle      text not null default '',
  plan          text not null default 'basico',        -- basico | pro | completo
  activo        boolean not null default true,          -- false = suspendido (moroso)
  modules       jsonb not null default '{}'::jsonb,     -- { tareas:true, orientacion:false, ... }
  days          jsonb not null default '["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES"]'::jsonb,
  time_slots    jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

-- ─── Miembros de cada negocio (mapea usuarios de auth a negocios) ─────────────
create table if not exists public.negocio_miembros (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         text not null default 'secretaria',       -- admin | secretaria
  nombre      text not null default '',
  color       text not null default 'violet',
  created_at  timestamptz not null default now(),
  unique (negocio_id, user_id)
);

-- ─── Administradores de la plataforma (la dueña: ve y gestiona TODOS) ─────────
create table if not exists public.plataforma_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── Campus / horarios ───────────────────────────────────────────────────────
create table if not exists public.horarios (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  slug          text not null,                          -- id legible usado por la app (ej: CENTRAL_ABC)
  name          text not null,
  subtitle      text not null default '',
  emoji         text not null default '🏢',
  gradient      text not null default 'from-violet-500 to-purple-600',
  accent_color  text not null default 'violet',
  is_system     boolean not null default false,
  sort_order    integer not null default 99,
  sedes         jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (negocio_id, slug)
);

-- ─── Clases del horario ──────────────────────────────────────────────────────
create table if not exists public.schedule_classes (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  class_code    text not null,
  horario       text not null,                          -- slug del campus
  day           text not null,
  time          text not null,
  sede          text not null,
  sala          integer not null default 1,
  teacher       text not null,
  course        text not null,
  semester      text not null default 'PRIMER',
  school_year   integer not null default extract(year from now()),
  created_at    timestamptz not null default now(),
  unique (negocio_id, class_code, semester, horario)
);

-- ─── Alumnos inscritos en clases ─────────────────────────────────────────────
create table if not exists public.schedule_students (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  class_code     text not null,
  class_semester text not null default 'PRIMER',
  class_horario  text not null,
  student_name   text not null,
  created_at     timestamptz not null default now()
);

-- ─── Cambios / transferencias ────────────────────────────────────────────────
create table if not exists public.schedule_transfers (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  horario_id     text not null,
  student_name   text not null default '',
  teacher_before text not null default '',
  teacher_after  text not null default '',
  sede           text not null default '',
  subject        text not null default '',
  leaves_class   text not null default '',
  enters_class   text not null default '',
  transfer_date  text not null default '',
  change_type    text not null default 'CAMBIO HORARIO',
  change_reason  text not null default 'NINGUNO',
  created_at     timestamptz not null default now()
);

-- ─── Equipo administrativo ───────────────────────────────────────────────────
create table if not exists public.team_members (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  name        text not null,
  role        text not null default 'secretaria',
  horario_id  text not null default 'GLOBAL',
  color       text not null default 'violet',
  created_at  timestamptz not null default now()
);

-- ─── Tareas ──────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  title          text not null,
  description    text not null default '',
  horario_id     text not null,
  assigned_to    text not null default '',
  deadline       text not null default '',
  priority       text not null default 'MEDIA',
  status         text not null default 'PENDIENTE',
  created_by     text not null default 'Admin',
  is_personal    boolean not null default false,
  personal_owner text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.task_items (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  text        text not null,
  completed   boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── Talleres ────────────────────────────────────────────────────────────────
create table if not exists public.workshops (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios(id) on delete cascade,
  horario_id    text not null,
  sede          text not null,
  teacher       text not null,
  name          text not null default '',
  workshop_date text not null default '',
  workshop_time text not null default '',
  max_students  integer not null default 8,
  created_at    timestamptz not null default now()
);

create table if not exists public.workshop_students (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios(id) on delete cascade,
  workshop_id  uuid not null references public.workshops(id) on delete cascade,
  student_name text not null,
  created_at   timestamptz not null default now()
);

-- ─── Notas ───────────────────────────────────────────────────────────────────
create table if not exists public.notas (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  horario_id  text not null,
  autor       text not null default '',
  titulo      text not null default '',
  contenido   text not null default '',
  color       text not null default 'amarillo',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Orientación ─────────────────────────────────────────────────────────────
create table if not exists public.orientadoras (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  nombre      text not null,
  titulo      text not null default 'Orientadora',
  foto_url    text not null default '',
  activa      boolean not null default true,
  orden       integer not null default 99,
  creada_en   timestamptz not null default now()
);

create table if not exists public.orientacion_horario_habitual (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  orientadora_id uuid not null references public.orientadoras(id) on delete cascade,
  dia_semana     text not null,
  hora_inicio    text not null,
  activo         boolean not null default true
);

create table if not exists public.orientacion_bloqueo_fecha (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  orientadora_id uuid not null references public.orientadoras(id) on delete cascade,
  fecha_inicio   text not null,
  fecha_fin      text not null,
  hora_inicio    text,
  motivo         text
);

create table if not exists public.orientacion_desbloqueo_fecha (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  orientadora_id uuid not null references public.orientadoras(id) on delete cascade,
  fecha          text not null,
  hora_inicio    text not null
);

create table if not exists public.citas_orientacion (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references public.negocios(id) on delete cascade,
  orientadora_id    uuid not null references public.orientadoras(id) on delete cascade,
  nombre_estudiante text not null,
  agendado_por      text not null default '',
  fecha             text not null,
  hora_inicio       text not null,
  motivo            text,
  estado_confirma   text not null default 'pendiente',
  estado_asiste     text not null default 'pendiente',
  nota_rapida       text,
  dado_de_alta      boolean not null default false,
  creada_en         timestamptz not null default now()
);

create table if not exists public.orientacion_estados (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios(id) on delete cascade,
  tipo        text not null default 'confirma',
  label       text not null,
  color       text not null default '#94a3b8',
  orden       integer not null default 99
);

create table if not exists public.orientacion_horas_disponibles (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios(id) on delete cascade,
  orientadora_id uuid not null references public.orientadoras(id) on delete cascade,
  hora           text not null,
  unique (orientadora_id, hora)
);

-- ─── Índices por negocio (rendimiento con muchos clientes) ───────────────────
create index if not exists idx_horarios_negocio          on public.horarios(negocio_id);
create index if not exists idx_classes_negocio           on public.schedule_classes(negocio_id, horario);
create index if not exists idx_students_negocio          on public.schedule_students(negocio_id, class_horario);
create index if not exists idx_transfers_negocio         on public.schedule_transfers(negocio_id, horario_id);
create index if not exists idx_team_negocio              on public.team_members(negocio_id);
create index if not exists idx_tasks_negocio             on public.tasks(negocio_id);
create index if not exists idx_task_items_negocio        on public.task_items(negocio_id, task_id);
create index if not exists idx_workshops_negocio         on public.workshops(negocio_id);
create index if not exists idx_workshop_students_negocio on public.workshop_students(negocio_id, workshop_id);
create index if not exists idx_notas_negocio             on public.notas(negocio_id, horario_id);
create index if not exists idx_orientadoras_negocio      on public.orientadoras(negocio_id);
create index if not exists idx_citas_negocio             on public.citas_orientacion(negocio_id, orientadora_id);
create index if not exists idx_miembros_user             on public.negocio_miembros(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
--  FUNCIONES DE SEGURIDAD (security definer: leen sin gatillar RLS recursivo)
-- ═══════════════════════════════════════════════════════════════════════════

-- Negocios a los que pertenece el usuario actual
create or replace function public.current_negocio_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select negocio_id from public.negocio_miembros where user_id = auth.uid()
$$;

-- ¿El usuario actual es administrador de la plataforma? (la dueña)
create or replace function public.is_plataforma_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.plataforma_admins where user_id = auth.uid())
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- Activar RLS en todas las tablas
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'negocios','negocio_miembros','plataforma_admins','horarios',
      'schedule_classes','schedule_students','schedule_transfers','team_members',
      'tasks','task_items','workshops','workshop_students','notas',
      'orientadoras','orientacion_horario_habitual','orientacion_bloqueo_fecha',
      'orientacion_desbloqueo_fecha','citas_orientacion','orientacion_estados',
      'orientacion_horas_disponibles'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Política estándar para tablas de datos con columna negocio_id:
-- ver/editar solo filas de mis negocios (o cualquiera si soy admin de plataforma)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'horarios','schedule_classes','schedule_students','schedule_transfers',
      'team_members','tasks','task_items','workshops','workshop_students','notas',
      'orientadoras','orientacion_horario_habitual','orientacion_bloqueo_fecha',
      'orientacion_desbloqueo_fecha','citas_orientacion','orientacion_estados',
      'orientacion_horas_disponibles'
    ])
  loop
    execute format('drop policy if exists tenant_all on public.%I', t);
    execute format($f$
      create policy tenant_all on public.%I
      for all
      using (negocio_id in (select public.current_negocio_ids()) or public.is_plataforma_admin())
      with check (negocio_id in (select public.current_negocio_ids()) or public.is_plataforma_admin())
    $f$, t);
  end loop;
end $$;

-- negocios: cada quien ve sus negocios; la dueña ve todos.
drop policy if exists negocios_select on public.negocios;
create policy negocios_select on public.negocios
  for select using (id in (select public.current_negocio_ids()) or public.is_plataforma_admin());

-- Solo la dueña (admin de plataforma) crea/edita/suspende negocios.
drop policy if exists negocios_admin_write on public.negocios;
create policy negocios_admin_write on public.negocios
  for all using (public.is_plataforma_admin()) with check (public.is_plataforma_admin());

-- Un admin del negocio puede editar el nombre/módulos de SU negocio.
drop policy if exists negocios_self_update on public.negocios;
create policy negocios_self_update on public.negocios
  for update using (
    id in (select negocio_id from public.negocio_miembros
           where user_id = auth.uid() and rol = 'admin')
  );

-- negocio_miembros: veo mis membresías; la dueña ve todas.
drop policy if exists miembros_select on public.negocio_miembros;
create policy miembros_select on public.negocio_miembros
  for select using (
    user_id = auth.uid()
    or negocio_id in (select public.current_negocio_ids())
    or public.is_plataforma_admin()
  );

-- Un admin del negocio (o la dueña) gestiona los miembros del negocio.
drop policy if exists miembros_write on public.negocio_miembros;
create policy miembros_write on public.negocio_miembros
  for all using (
    public.is_plataforma_admin()
    or negocio_id in (select negocio_id from public.negocio_miembros
                      where user_id = auth.uid() and rol = 'admin')
  ) with check (
    public.is_plataforma_admin()
    or negocio_id in (select negocio_id from public.negocio_miembros
                      where user_id = auth.uid() and rol = 'admin')
  );

-- plataforma_admins: solo la propia dueña se ve a sí misma. (Se agrega el
-- primer admin manualmente desde el editor SQL — ver el README.)
drop policy if exists plataforma_admins_self on public.plataforma_admins;
create policy plataforma_admins_self on public.plataforma_admins
  for select using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
--  updated_at automático en tasks y notas
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_notas_updated on public.notas;
create trigger trg_notas_updated before update on public.notas
  for each row execute function public.touch_updated_at();
