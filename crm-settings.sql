-- Configuración interna del CRM (solo administradores).
-- Ejecutar en el SQL editor de Supabase. Idempotente: puede re-ejecutarse.

create table if not exists public.crm_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.crm_settings enable row level security;

-- La política consulta app_admins y crm_miembros para saber quién es
-- administrador: el rol authenticated necesita permiso de lectura sobre ambas.
grant select on table public.app_admins to authenticated;
grant select on table public.crm_miembros to authenticated;

-- Solo administradores (app_admins o crm_miembros con rol administrador activo)
-- pueden leer o escribir.
drop policy if exists "crm_settings_admin_all" on public.crm_settings;
create policy "crm_settings_admin_all"
on public.crm_settings for all
to authenticated
using (exists (select 1 from public.app_admins a where a.user_id = auth.uid())
   or exists (select 1 from public.crm_miembros m where m.usuario_id = auth.uid() and m.rol = 'administrador' and m.activo))
with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid())
   or exists (select 1 from public.crm_miembros m where m.usuario_id = auth.uid() and m.rol = 'administrador' and m.activo));

-- Token inicial de Supabase (gestión del storage de imágenes del editor).
-- Configúralo manualmente en Supabase; nunca guardes el token en Git.
insert into public.crm_settings (key, value, updated_at)
select 'supabase_access_token', '', now()
where not exists (select 1 from public.crm_settings where key = 'supabase_access_token');
