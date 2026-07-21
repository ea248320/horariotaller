-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Registro de un negocio nuevo (self-service)                               ║
-- ║                                                                            ║
-- ║  RLS impide que un usuario normal inserte en `negocios`. Esta función      ║
-- ║  security definer crea el negocio y agrega al usuario como admin en una    ║
-- ║  sola operación atómica. La app la llama con supabase.rpc('crear_negocio').║
-- ╚══════════════════════════════════════════════════════════════════════════╝

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

  -- Un usuario no puede crear un segundo negocio si ya administra uno
  -- (evita abuso; la dueña puede crear todos los que quiera vía panel).
  if exists (
    select 1 from public.negocio_miembros
    where user_id = auth.uid() and rol = 'admin'
  ) and not public.is_plataforma_admin() then
    raise exception 'Ya administras un negocio';
  end if;

  insert into public.negocios (nombre, subtitle)
  values (trim(p_nombre), coalesce(p_subtitle, ''))
  returning id into v_negocio_id;

  insert into public.negocio_miembros (negocio_id, user_id, rol, nombre)
  values (v_negocio_id, auth.uid(), 'admin', coalesce(nullif(trim(p_nombre_admin), ''), ''));

  return v_negocio_id;
end $$;

revoke all on function public.crear_negocio(text, text, text) from public;
grant execute on function public.crear_negocio(text, text, text) to authenticated;
