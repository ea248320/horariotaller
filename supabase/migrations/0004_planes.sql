-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Planes (versiones) y activación de negocios                               ║
-- ║                                                                            ║
-- ║  Toda cuenta nueva nace "pendiente" y SIN módulos: la persona se registra  ║
-- ║  pero no puede usar nada hasta que la dueña de la plataforma le asigne un   ║
-- ║  plan (tras el pago). El plan determina qué módulos recibe el negocio.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Módulos que incluye cada plan ───────────────────────────────────────────
-- Un solo lugar donde se define qué trae cada versión. Cambiar aquí y volver a
-- asignar el plan actualiza a todos los negocios de ese plan.
create or replace function public.modulos_por_plan(p_plan text)
returns jsonb
language sql immutable
as $$
  select case p_plan
    when 'basico' then
      '{"tareas":false,"cambios":false,"notas":false,"guias":false,"foto":false,"orientacion":false,"talleres":false}'::jsonb
    when 'pro' then
      '{"tareas":true,"cambios":true,"notas":true,"guias":true,"foto":true,"orientacion":false,"talleres":true}'::jsonb
    when 'completo' then
      '{"tareas":true,"cambios":true,"notas":true,"guias":true,"foto":true,"orientacion":true,"talleres":true}'::jsonb
    else -- 'pendiente' o desconocido: sin módulos
      '{"tareas":false,"cambios":false,"notas":false,"guias":false,"foto":false,"orientacion":false,"talleres":false}'::jsonb
  end
$$;

-- ─── Registro: la cuenta nueva nace PENDIENTE (sin acceso) ───────────────────
-- Reemplaza la versión de 0002_signup.sql.
create or replace function public.crear_negocio(
  p_nombre   text,
  p_subtitle text default '',
  p_nombre_admin text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un negocio';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre del negocio es obligatorio';
  end if;

  if exists (
    select 1 from public.negocio_miembros
    where user_id = auth.uid() and rol = 'admin'
  ) and not public.is_plataforma_admin() then
    raise exception 'Ya administras un negocio';
  end if;

  insert into public.negocios (nombre, subtitle, plan, activo, modules)
  values (
    trim(p_nombre),
    coalesce(p_subtitle, ''),
    'pendiente',
    false,
    public.modulos_por_plan('pendiente')
  )
  returning id into v_negocio_id;

  insert into public.negocio_miembros (negocio_id, user_id, rol, nombre)
  values (v_negocio_id, auth.uid(), 'admin', coalesce(nullif(trim(p_nombre_admin), ''), ''));

  return v_negocio_id;
end $$;

revoke all on function public.crear_negocio(text, text, text) from public;
grant execute on function public.crear_negocio(text, text, text) to authenticated;

-- ─── Asignar plan / activar (solo la dueña de la plataforma) ─────────────────
create or replace function public.asignar_plan(p_negocio_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Solo la administradora de la plataforma puede asignar planes';
  end if;
  if p_plan not in ('basico', 'pro', 'completo', 'pendiente') then
    raise exception 'Plan inválido: %', p_plan;
  end if;

  update public.negocios
     set plan    = p_plan,
         modules = public.modulos_por_plan(p_plan),
         activo  = (p_plan <> 'pendiente')
   where id = p_negocio_id;
end $$;

revoke all on function public.asignar_plan(uuid, text) from public;
grant execute on function public.asignar_plan(uuid, text) to authenticated;

-- ─── Suspender / reactivar un negocio sin cambiar su plan (morosos) ──────────
create or replace function public.set_negocio_activo(p_negocio_id uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_plataforma_admin() then
    raise exception 'Solo la administradora de la plataforma puede suspender negocios';
  end if;
  update public.negocios set activo = p_activo where id = p_negocio_id;
end $$;

revoke all on function public.set_negocio_activo(uuid, boolean) from public;
grant execute on function public.set_negocio_activo(uuid, boolean) to authenticated;
