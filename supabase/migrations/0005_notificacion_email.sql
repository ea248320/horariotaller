-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Notificación por correo cuando se registra un cliente nuevo               ║
-- ║                                                                            ║
-- ║  Cuando se crea un negocio, la base de datos envía un email a la dueña de  ║
-- ║  la plataforma usando Resend (https://resend.com — plan gratuito). Todo    ║
-- ║  ocurre en el servidor; no hace falta desplegar nada aparte.               ║
-- ║                                                                            ║
-- ║  Pasos después de ejecutar esta migración:                                 ║
-- ║   1) Crea una cuenta gratis en resend.com con tu correo.                    ║
-- ║   2) En Resend → API Keys → crea una key (empieza con 're_...').            ║
-- ║   3) Ejecuta (reemplazando la key):                                        ║
-- ║        update public.plataforma_config                                     ║
-- ║           set resend_api_key = 're_tu_key_aqui'                            ║
-- ║         where id = 1;                                                      ║
-- ║   Listo: cada registro nuevo te llega por correo.                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- pg_net permite que la base de datos haga llamadas HTTP (para enviar el email)
create extension if not exists pg_net;

-- Configuración de la plataforma (solo la dueña la ve/edita)
create table if not exists public.plataforma_config (
  id             int primary key default 1,
  resend_api_key text,
  notify_email   text,
  constraint plataforma_config_singleton check (id = 1)
);

alter table public.plataforma_config enable row level security;

drop policy if exists config_admin on public.plataforma_config;
create policy config_admin on public.plataforma_config
  for all
  using ((select public.is_plataforma_admin()))
  with check ((select public.is_plataforma_admin()));

-- Fila única de configuración, con el correo de destino ya puesto.
insert into public.plataforma_config (id, notify_email)
values (1, 'emiliaalarconpisano@gmail.com')
on conflict (id) do nothing;

-- Función que envía el correo al insertarse un negocio nuevo
create or replace function public.notificar_nuevo_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key   text;
  v_email text;
begin
  select resend_api_key, notify_email
    into v_key, v_email
    from public.plataforma_config
   where id = 1;

  -- Si aún no configuraste la key de Resend, no hace nada (no falla el registro)
  if v_key is null or v_email is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Plataforma Horarios <onboarding@resend.dev>',
      'to', array[v_email],
      'subject', '🆕 Nuevo cliente pendiente: ' || new.nombre,
      'html',
        '<div style="font-family:sans-serif;max-width:480px">'
        || '<h2 style="color:#7c3aed">Nuevo negocio registrado</h2>'
        || '<p><strong>' || new.nombre || '</strong> acaba de crear una cuenta y está '
        || '<strong style="color:#d97706">pendiente de activación</strong>.</p>'
        || '<p>Entra a tu panel de la plataforma para asignarle un plan cuando confirmes el pago.</p>'
        || '<p style="color:#6b7280;font-size:13px">Registrado: ' || to_char(new.created_at, 'DD/MM/YYYY HH24:MI') || '</p>'
        || '</div>'
    )
  );

  return new;
end $$;

drop trigger if exists trg_nuevo_negocio on public.negocios;
create trigger trg_nuevo_negocio
  after insert on public.negocios
  for each row execute function public.notificar_nuevo_negocio();
