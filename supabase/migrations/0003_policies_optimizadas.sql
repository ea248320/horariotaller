-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Optimización de políticas RLS y funciones                                 ║
-- ║                                                                            ║
-- ║  Resuelve las advertencias del Security Advisor:                           ║
-- ║   · Auth RLS Initialization Plan  → auth.uid() envuelto en (select …)      ║
-- ║   · Function Search Path Mutable  → search_path fijo en touch_updated_at   ║
-- ║   · Multiple Permissive Policies  → políticas separadas por comando        ║
-- ║  Además evita recursión de RLS al gestionar miembros (función definer).    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Función: ¿el usuario actual es admin de ESE negocio? ─────────────────────
-- security definer → lee negocio_miembros sin gatillar RLS (evita recursión).
create or replace function public.is_negocio_admin(p_negocio_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.negocio_miembros
    where user_id = auth.uid()
      and negocio_id = p_negocio_id
      and rol = 'admin'
  )
$$;

-- ─── Fix: search_path fijo en el trigger de updated_at ───────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Tablas de datos: una sola política FOR ALL, con auth optimizado
-- ═══════════════════════════════════════════════════════════════════════════
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
      using (
        negocio_id in (select public.current_negocio_ids())
        or (select public.is_plataforma_admin())
      )
      with check (
        negocio_id in (select public.current_negocio_ids())
        or (select public.is_plataforma_admin())
      )
    $f$, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  negocios: una política por comando (sin solapamiento)
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists negocios_select        on public.negocios;
drop policy if exists negocios_admin_write    on public.negocios;
drop policy if exists negocios_self_update    on public.negocios;
drop policy if exists negocios_insert         on public.negocios;
drop policy if exists negocios_update         on public.negocios;
drop policy if exists negocios_delete         on public.negocios;

create policy negocios_select on public.negocios
  for select using (
    id in (select public.current_negocio_ids())
    or (select public.is_plataforma_admin())
  );

create policy negocios_insert on public.negocios
  for insert with check ((select public.is_plataforma_admin()));

create policy negocios_update on public.negocios
  for update using (
    (select public.is_plataforma_admin())
    or (select public.is_negocio_admin(id))
  );

create policy negocios_delete on public.negocios
  for delete using ((select public.is_plataforma_admin()));

-- ═══════════════════════════════════════════════════════════════════════════
--  negocio_miembros: una política por comando, sin recursión
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists miembros_select on public.negocio_miembros;
drop policy if exists miembros_write  on public.negocio_miembros;
drop policy if exists miembros_insert on public.negocio_miembros;
drop policy if exists miembros_update on public.negocio_miembros;
drop policy if exists miembros_delete on public.negocio_miembros;

create policy miembros_select on public.negocio_miembros
  for select using (
    user_id = (select auth.uid())
    or negocio_id in (select public.current_negocio_ids())
    or (select public.is_plataforma_admin())
  );

create policy miembros_insert on public.negocio_miembros
  for insert with check (
    (select public.is_plataforma_admin())
    or (select public.is_negocio_admin(negocio_id))
  );

create policy miembros_update on public.negocio_miembros
  for update using (
    (select public.is_plataforma_admin())
    or (select public.is_negocio_admin(negocio_id))
  );

create policy miembros_delete on public.negocio_miembros
  for delete using (
    (select public.is_plataforma_admin())
    or (select public.is_negocio_admin(negocio_id))
  );

-- ═══════════════════════════════════════════════════════════════════════════
--  plataforma_admins: auth.uid() optimizado
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists plataforma_admins_self on public.plataforma_admins;
create policy plataforma_admins_self on public.plataforma_admins
  for select using (user_id = (select auth.uid()));
