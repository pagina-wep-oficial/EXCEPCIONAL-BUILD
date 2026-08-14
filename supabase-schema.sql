-- Excepcional Build: portal de clientes
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- No elimina tus tablas actuales. Usa nombres client_* para no chocar con tu CRM.
-- Sincronizado con producción hasta 2026-08-13: solicitudes editables, completed_at y editor autogestionable.

create extension if not exists pgcrypto;

create table if not exists public.client_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  business_name text,
  location text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'Cotización preparada',
  site_url text,
  preview_url text,
  address_type text not null default 'gratis',
  domain text,
  hosting_type text not null default 'cloudflare',
  quote_ref text,
  editor_enabled boolean not null default false,
  editor_access_status text,
  editor_access_starts_at timestamptz,
  editor_access_ends_at timestamptz,
  editor_plan_months integer,
  editor_price_mxn numeric(12,2),
  editor_launch_url text,
  site_repo_owner text,
  site_repo_name text,
  site_repo_branch text not null default 'main',
  site_repo_path text not null default '/',
  site_live_url text,
  site_publish_provider text not null default 'github_pages',
  site_editor_mode text not null default 'html_repo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  creation_price numeric(12,2),
  domain_first_year numeric(12,2),
  domain_renewal numeric(12,2),
  hosting_first_year numeric(12,2),
  hosting_renewal numeric(12,2),
  initial_total numeric(12,2),
  annual_renewal numeric(12,2),
  period_total numeric(12,2),
  period_years integer not null default 1,
  quote_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.client_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null,
  message text not null,
  status text not null default 'Nueva',
  admin_title text,
  admin_summary text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text,
  created_at timestamptz not null default now()
);

create index if not exists client_projects_user_id_idx on public.client_projects(user_id);
create unique index if not exists client_projects_quote_ref_unique on public.client_projects(quote_ref) where quote_ref is not null;
create index if not exists client_quotes_user_id_idx on public.client_quotes(user_id);
create index if not exists client_quotes_project_id_idx on public.client_quotes(project_id);
create index if not exists client_requests_user_id_idx on public.client_requests(user_id);
create index if not exists client_requests_project_id_idx on public.client_requests(project_id);
create index if not exists client_updates_user_id_idx on public.client_updates(user_id);
create index if not exists client_updates_project_id_idx on public.client_updates(project_id);

create or replace function public.client_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_profiles_updated_at on public.client_profiles;
create trigger client_profiles_updated_at before update on public.client_profiles for each row execute function public.client_set_updated_at();
drop trigger if exists client_projects_updated_at on public.client_projects;
create trigger client_projects_updated_at before update on public.client_projects for each row execute function public.client_set_updated_at();
drop trigger if exists client_requests_updated_at on public.client_requests;
create trigger client_requests_updated_at before update on public.client_requests for each row execute function public.client_set_updated_at();

create or replace function public.client_handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.client_profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists client_on_auth_user_created on auth.users;
create trigger client_on_auth_user_created after insert on auth.users for each row execute procedure public.client_handle_new_user();

alter table public.client_profiles enable row level security;
alter table public.client_projects enable row level security;
alter table public.client_quotes enable row level security;
alter table public.client_requests enable row level security;
alter table public.client_updates enable row level security;

revoke all on public.client_profiles, public.client_projects, public.client_quotes, public.client_requests, public.client_updates from anon;
grant select, insert, update on public.client_profiles to authenticated;
grant select, insert on public.client_projects, public.client_quotes, public.client_requests to authenticated;
grant select on public.client_updates to authenticated;

-- Perfiles
drop policy if exists "client_profiles_select_own" on public.client_profiles;
create policy "client_profiles_select_own" on public.client_profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "client_profiles_insert_own" on public.client_profiles;
create policy "client_profiles_insert_own" on public.client_profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "client_profiles_update_own" on public.client_profiles;
create policy "client_profiles_update_own" on public.client_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Proyectos
drop policy if exists "client_projects_select_own" on public.client_projects;
create policy "client_projects_select_own" on public.client_projects for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "client_projects_insert_own" on public.client_projects;
create policy "client_projects_insert_own" on public.client_projects for insert to authenticated with check ((select auth.uid()) = user_id);

-- Cotizaciones
drop policy if exists "client_quotes_select_own" on public.client_quotes;
create policy "client_quotes_select_own" on public.client_quotes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "client_quotes_insert_own" on public.client_quotes;
create policy "client_quotes_insert_own" on public.client_quotes for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.client_projects p where p.id = client_quotes.project_id and p.user_id = (select auth.uid())));

-- Solicitudes
drop policy if exists "client_requests_select_own" on public.client_requests;
create policy "client_requests_select_own" on public.client_requests for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "client_requests_insert_own" on public.client_requests;
create policy "client_requests_insert_own" on public.client_requests for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.client_projects p where p.id = client_requests.project_id and p.user_id = (select auth.uid())));

-- Avances: el cliente solo lee. El administrador podrá insertar con una función segura o service_role fuera del navegador.
drop policy if exists "client_updates_select_own" on public.client_updates;
create policy "client_updates_select_own" on public.client_updates for select to authenticated using ((select auth.uid()) = user_id);

-- ==========================================================
-- A partir de aquí se aplican las capacidades finales del CRM.
-- Para una instalación existente usa solamente supabase-final-migration.sql.
-- ==========================================================
-- ==========================================================
-- EXCEPCIONAL BUILD · MIGRACIÓN FINAL DEL PORTAL + CRM
-- Ejecuta TODO este archivo en Supabase > SQL Editor.
-- Está pensado para una instalación existente: no borra proyectos.
-- ==========================================================

create extension if not exists pgcrypto;

-- 1) Administradores de Excepcional Build.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- 2) El proyecto puede existir antes de que el cliente cree su cuenta.
alter table if exists public.client_projects alter column user_id drop not null;
alter table if exists public.client_quotes alter column user_id drop not null;
alter table if exists public.client_updates alter column user_id drop not null;

alter table if exists public.client_projects
  add column if not exists source_prospect_id text,
  add column if not exists site_visibility text not null default 'hidden',
  add column if not exists project_stage text not null default 'Cotización',
  add column if not exists client_note text,
  add column if not exists total_price numeric(12,2),
  add column if not exists deposit_amount numeric(12,2),
  add column if not exists balance_amount numeric(12,2),
  add column if not exists deposit_paid boolean not null default false,
  add column if not exists balance_paid boolean not null default false,
  add column if not exists claim_token uuid default gen_random_uuid(),
  add column if not exists claimed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists editor_enabled boolean not null default false,
  add column if not exists editor_access_status text,
  add column if not exists editor_access_starts_at timestamptz,
  add column if not exists editor_access_ends_at timestamptz,
  add column if not exists editor_plan_months integer,
  add column if not exists editor_price_mxn numeric(12,2),
  add column if not exists editor_launch_url text,
  add column if not exists site_repo_owner text,
  add column if not exists site_repo_name text,
  add column if not exists site_repo_branch text not null default 'main',
  add column if not exists site_repo_path text not null default '/',
  add column if not exists site_live_url text,
  add column if not exists site_publish_provider text not null default 'github_pages',
  add column if not exists site_editor_mode text not null default 'html_repo';

-- Normalizamos valores de visibilidad existentes.
update public.client_projects
set site_visibility = 'hidden'
where site_visibility is null or site_visibility not in ('hidden','preview','public');

-- Restricción ligera, añadida solo si todavía no existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_projects_site_visibility_check'
  ) then
    alter table public.client_projects
      add constraint client_projects_site_visibility_check
      check (site_visibility in ('hidden','preview','public'));
  end if;
end $$;

create unique index if not exists client_projects_claim_token_unique
  on public.client_projects(claim_token)
  where claim_token is not null;
create index if not exists client_projects_source_prospect_idx
  on public.client_projects(source_prospect_id);
create index if not exists client_projects_stage_idx
  on public.client_projects(project_stage);

-- Si existe tu tabla prospectos, agregamos campos de relación sin romperla.
do $$
begin
  if to_regclass('public.prospectos') is not null then
    execute 'alter table public.prospectos add column if not exists client_user_id uuid';
    execute 'alter table public.prospectos add column if not exists client_project_id uuid';
  end if;
end $$;

-- 3) Información que el cliente entrega para construir su página.
create table if not exists public.client_project_briefs (
  project_id uuid primary key references public.client_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  business_description text,
  products_services text,
  address_text text,
  schedule_text text,
  public_phone text,
  social_links text,
  visual_notes text,
  extra_notes text,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.client_project_briefs enable row level security;
grant select, insert, update, delete on public.client_project_briefs to authenticated;

-- Trigger de actualización si la función base ya existe.
do $$
begin
  if to_regprocedure('public.client_set_updated_at()') is not null then
    drop trigger if exists client_project_briefs_updated_at on public.client_project_briefs;
    create trigger client_project_briefs_updated_at
      before update on public.client_project_briefs
      for each row execute function public.client_set_updated_at();
  end if;
end $$;

drop policy if exists "client_project_briefs_select_own" on public.client_project_briefs;
create policy "client_project_briefs_select_own" on public.client_project_briefs
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "client_project_briefs_insert_own" on public.client_project_briefs;
create policy "client_project_briefs_insert_own" on public.client_project_briefs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.client_projects p
      where p.id = client_project_briefs.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "client_project_briefs_update_own" on public.client_project_briefs;
create policy "client_project_briefs_update_own" on public.client_project_briefs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "admin_project_briefs_all" on public.client_project_briefs;
create policy "admin_project_briefs_all" on public.client_project_briefs
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- 4) Función para que un cliente reclame un proyecto creado desde el CRM.
create or replace function public.claim_client_project(p_project_id uuid, p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select * into v_project
  from public.client_projects
  where id = p_project_id
    and user_id is null
    and claim_token = p_token
  for update;

  if not found then
    raise exception 'La invitación no es válida o ya fue utilizada.';
  end if;

  update public.client_projects
  set user_id = v_user,
      claimed_at = now(),
      claim_token = null,
      updated_at = now()
  where id = p_project_id;

  update public.client_quotes
  set user_id = v_user
  where project_id = p_project_id and user_id is null;

  update public.client_updates
  set user_id = v_user
  where project_id = p_project_id and user_id is null;

  update public.client_project_briefs
  set user_id = v_user
  where project_id = p_project_id and user_id is null;

  if to_regclass('public.prospectos') is not null and v_project.source_prospect_id is not null then
    begin
      execute 'update public.prospectos set client_user_id = $1, client_project_id = $2 where id::text = $3'
      using v_user, p_project_id, v_project.source_prospect_id;
    exception when others then
      null;
    end;
  end if;

  return p_project_id;
end;
$$;

revoke all on function public.claim_client_project(uuid, uuid) from public;
grant execute on function public.claim_client_project(uuid, uuid) to authenticated;

-- 5) Permisos generales. RLS decide qué filas puede tocar cada cuenta.
grant select, insert, update, delete on public.client_profiles to authenticated;
grant select, insert, update, delete on public.client_projects to authenticated;
grant select, insert, update, delete on public.client_quotes to authenticated;
grant select, insert, update, delete on public.client_requests to authenticated;
grant select, insert, update, delete on public.client_updates to authenticated;

-- 6) Políticas de administrador para el CRM.
drop policy if exists "admin_profiles_all" on public.client_profiles;
create policy "admin_profiles_all" on public.client_profiles
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "admin_projects_all" on public.client_projects;
create policy "admin_projects_all" on public.client_projects
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "admin_quotes_all" on public.client_quotes;
create policy "admin_quotes_all" on public.client_quotes
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "admin_requests_all" on public.client_requests;
create policy "admin_requests_all" on public.client_requests
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

drop policy if exists "admin_updates_all" on public.client_updates;
create policy "admin_updates_all" on public.client_updates
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- 7) El cliente conserva sus permisos actuales. Rehacemos las políticas críticas
-- para soportar proyectos que inicialmente no tienen propietario.
drop policy if exists "client_projects_select_own" on public.client_projects;
create policy "client_projects_select_own" on public.client_projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "client_projects_insert_own" on public.client_projects;
create policy "client_projects_insert_own" on public.client_projects
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and site_visibility = 'hidden'
    and site_url is null
    and preview_url is null
  );

-- El cliente NO actualiza campos administrativos del proyecto desde el navegador.
-- Los cambios de estado, URLs, visibilidad y pagos se hacen en el CRM.

-- 8) Vista útil opcional para el panel administrativo.
create or replace view public.crm_project_overview
with (security_invoker = true)
as
select
  p.*,
  pr.full_name as client_name,
  pr.email as client_email,
  pr.phone as client_phone,
  pr.business_name as client_business
from public.client_projects p
left join public.client_profiles pr on pr.id = p.user_id;

grant select on public.crm_project_overview to authenticated;

-- ==========================================================
-- PASO MANUAL OBLIGATORIO DESPUÉS DE EJECUTAR ESTE ARCHIVO:
-- 1. Busca el UUID de TU cuenta administrativa:
--      select id, email from auth.users order by created_at;
-- 2. Copia tu UUID y ejecuta:
--      insert into public.app_admins(user_id)
--      values ('TU-UUID-AQUI')
--      on conflict do nothing;
-- ==========================================================
-- ==========================================================
-- EXCEPCIONAL BUILD · FLUJO COMERCIAL V2
-- Prospecto -> Invitado -> Cliente -> Información -> Revisión -> Publicado
-- Ejecuta TODO en Supabase > SQL Editor DESPUÉS de la migración anterior.
-- No elimina datos existentes.
-- ==========================================================

create extension if not exists pgcrypto;

-- 1) Nuevos datos administrativos del proyecto.
alter table if exists public.client_projects
  add column if not exists payment_method text,
  add column if not exists accepted_at timestamptz,
  add column if not exists invitation_sent_at timestamptz,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists brief_submitted_at timestamptz,
  add column if not exists review_ready_at timestamptz;

-- 1.5) Campos administrativos visibles para solicitudes del cliente.
alter table if exists public.client_requests
  add column if not exists admin_title text,
  add column if not exists admin_summary text,
  add column if not exists completed_at timestamptz;

-- 2) Configuración elegida por el cliente después de aceptar.
create table if not exists public.client_project_setup (
  project_id uuid primary key references public.client_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  address_type text not null default 'gratis',
  site_name text,
  domain text,
  domain_owned boolean not null default false,
  domain_first_year numeric(12,2),
  domain_renewal numeric(12,2),
  hosting_type text not null default 'cloudflare',
  special_features_note text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint client_project_setup_address_check check (address_type in ('gratis','dominio')),
  constraint client_project_setup_hosting_check check (hosting_type in ('cloudflare','hostinger'))
);

alter table public.client_project_setup add column if not exists domain_owned boolean not null default false;

alter table public.client_project_setup enable row level security;
grant select, insert, update, delete on public.client_project_setup to authenticated;

-- 3) Información del negocio: ampliamos la tabla anterior sin romper datos.
alter table if exists public.client_project_briefs
  add column if not exists business_name text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists maps_url text,
  add column if not exists reference_links text,
  add column if not exists content_options jsonb not null default '[]'::jsonb,
  add column if not exists completion_percent integer not null default 0;

-- 4) Archivos: Supabase guarda SOLO metadatos. El archivo real vive en Google Drive.
create table if not exists public.client_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  drive_file_id text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  category text not null default 'otro',
  created_at timestamptz not null default now(),
  constraint client_project_files_category_check check (category in ('logo','foto','video','documento','otro'))
);

create unique index if not exists client_project_files_drive_unique on public.client_project_files(drive_file_id);
create index if not exists client_project_files_project_idx on public.client_project_files(project_id);
create index if not exists client_project_files_user_idx on public.client_project_files(user_id);

alter table public.client_project_files enable row level security;
grant select, insert, delete on public.client_project_files to authenticated;

-- 5) Triggers updated_at para setup.
do $$
begin
  if to_regprocedure('public.client_set_updated_at()') is not null then
    drop trigger if exists client_project_setup_updated_at on public.client_project_setup;
    create trigger client_project_setup_updated_at
      before update on public.client_project_setup
      for each row execute function public.client_set_updated_at();
  end if;
end $$;

-- El cliente ya no crea proyectos directamente. Los proyectos nacen en el CRM
-- y se reclaman mediante una invitación privada.
drop policy if exists "client_projects_insert_own" on public.client_projects;

-- 6) RLS: configuración del propio proyecto.
drop policy if exists "client_project_setup_select_own" on public.client_project_setup;
create policy "client_project_setup_select_own" on public.client_project_setup
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "client_project_setup_insert_own" on public.client_project_setup;
create policy "client_project_setup_insert_own" on public.client_project_setup
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.client_projects p
      where p.id = client_project_setup.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "client_project_setup_update_own" on public.client_project_setup;
create policy "client_project_setup_update_own" on public.client_project_setup
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "admin_project_setup_all" on public.client_project_setup;
create policy "admin_project_setup_all" on public.client_project_setup
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- 7) RLS: metadatos de archivos.
drop policy if exists "client_project_files_select_own" on public.client_project_files;
create policy "client_project_files_select_own" on public.client_project_files
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "client_project_files_insert_own" on public.client_project_files;
create policy "client_project_files_insert_own" on public.client_project_files
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.client_projects p
      where p.id = client_project_files.project_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "client_project_files_delete_own" on public.client_project_files;
create policy "client_project_files_delete_own" on public.client_project_files
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "admin_project_files_all" on public.client_project_files;
create policy "admin_project_files_all" on public.client_project_files
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- 8) Reclamar invitación. Al activar cuenta, el proyecto pasa a Configuración.
create or replace function public.claim_client_project(p_project_id uuid, p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select * into v_project
  from public.client_projects
  where id = p_project_id
    and user_id is null
    and claim_token = p_token
  for update;

  if not found then
    raise exception 'La invitación no es válida o ya fue utilizada.';
  end if;

  update public.client_projects
  set user_id = v_user,
      claimed_at = now(),
      claim_token = null,
      project_stage = case
        when project_stage is null or project_stage in ('Cotización','Aprobación','Invitación') then 'Configuración'
        else project_stage
      end,
      status = case
        when project_stage is null or project_stage in ('Cotización','Aprobación','Invitación') then 'Cuenta activada · configura tu página'
        else status
      end,
      updated_at = now()
  where id = p_project_id;

  update public.client_quotes set user_id = v_user where project_id = p_project_id and user_id is null;
  update public.client_updates set user_id = v_user where project_id = p_project_id and user_id is null;
  update public.client_project_briefs set user_id = v_user where project_id = p_project_id and user_id is null;
  update public.client_project_setup set user_id = v_user where project_id = p_project_id and user_id is null;
  update public.client_project_files set user_id = v_user where project_id = p_project_id and user_id is null;

  if to_regclass('public.prospectos') is not null and v_project.source_prospect_id is not null then
    begin
      execute 'update public.prospectos set client_user_id = $1, client_project_id = $2 where id::text = $3'
      using v_user, p_project_id, v_project.source_prospect_id;
    exception when others then
      null;
    end;
  end if;

  return p_project_id;
end;
$$;

revoke all on function public.claim_client_project(uuid, uuid) from public;
grant execute on function public.claim_client_project(uuid, uuid) to authenticated;

-- 9) Aplicar la configuración elegida por el cliente.
create or replace function public.client_apply_project_setup(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_setup public.client_project_setup%rowtype;
begin
  if v_user is null then raise exception 'Debes iniciar sesión.'; end if;

  select s.* into v_setup
  from public.client_project_setup s
  join public.client_projects p on p.id = s.project_id
  where s.project_id = p_project_id
    and s.user_id = v_user
    and (p.user_id = v_user or p.user_id is null)
    and coalesce(p.project_stage, 'Invitación') in ('Invitación','Configuración','Cotización','Aprobación','Información');

  if not found then
    select s.* into v_setup
    from public.client_project_setup s
    join public.client_projects p on p.id = s.project_id
    where s.project_id = p_project_id
      and s.user_id is null
      and (p.user_id = v_user or p.user_id is null)
      and coalesce(p.project_stage, 'Invitación') in ('Invitación','Configuración','Cotización','Aprobación','Información');

    update public.client_project_setup
    set user_id = v_user, updated_at = now()
    where project_id = p_project_id and user_id is null;
  end if;

  if not found then raise exception 'No se encontró la configuración de este proyecto.'; end if;

  if v_setup.hosting_type = 'hostinger' and v_setup.address_type <> 'dominio' then
    raise exception 'El alojamiento especializado requiere un dominio propio.';
  end if;

  update public.client_project_setup
  set completed_at = coalesce(completed_at, now()), updated_at = now()
  where project_id = p_project_id;

  update public.client_projects
  set user_id = coalesce(user_id, v_user),
      address_type = v_setup.address_type,
      domain = case
        when v_setup.address_type = 'gratis' then nullif(trim(v_setup.site_name), '') || '.pages.dev'
        else nullif(trim(v_setup.domain), '')
      end,
      hosting_type = v_setup.hosting_type,
      setup_completed_at = coalesce(setup_completed_at, now()),
      project_stage = case when project_stage in ('Invitación','Configuración','Cotización','Aprobación') then 'Información' else project_stage end,
      status = case when project_stage in ('Invitación','Configuración','Cotización','Aprobación') then 'Configuración lista · completa la información de tu negocio' else status end,
      updated_at = now()
  where id = p_project_id and (user_id = v_user or user_id is null);

  return p_project_id;
end;
$$;

revoke all on function public.client_apply_project_setup(uuid) from public;
grant execute on function public.client_apply_project_setup(uuid) to authenticated;

-- 10) El cliente confirma que ya envió suficiente información para comenzar.
create or replace function public.client_submit_project_brief(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Debes iniciar sesión.'; end if;

  if not exists (
    select 1 from public.client_projects p
    where p.id = p_project_id and p.user_id = v_user and p.setup_completed_at is not null
  ) then
    raise exception 'Primero completa la configuración de tu página.';
  end if;

  if not exists (
    select 1 from public.client_project_briefs b
    where b.project_id = p_project_id and b.user_id = v_user
  ) then
    raise exception 'Primero agrega la información de tu negocio.';
  end if;

  update public.client_project_briefs
  set submitted_at = now(), updated_at = now()
  where project_id = p_project_id and user_id = v_user;

  update public.client_projects
  set brief_submitted_at = now(),
      project_stage = case when project_stage in ('Configuración','Información') then 'Producción' else project_stage end,
      status = case when project_stage in ('Configuración','Información') then 'Información recibida · estamos preparando tu página' else status end,
      updated_at = now()
  where id = p_project_id and user_id = v_user;

  return p_project_id;
end;
$$;

revoke all on function public.client_submit_project_brief(uuid) from public;
grant execute on function public.client_submit_project_brief(uuid) to authenticated;

-- 11) Vista administrativa actualizada.
create or replace view public.crm_project_overview
with (security_invoker = true)
as
select
  p.*,
  pr.full_name as client_name,
  pr.email as client_email,
  pr.phone as client_phone,
  pr.location as client_location
from public.client_projects p
left join public.client_profiles pr on pr.id = p.user_id;

grant select on public.crm_project_overview to authenticated;

-- ===========================================================
-- INVITACIONES CON CÓDIGO CORTO (Plan A+B)
-- ===========================================================

alter table public.client_projects add column if not exists invite_code text;
create unique index if not exists client_projects_invite_code_key
  on public.client_projects (invite_code)
  where invite_code is not null;

create or replace function public.get_invite_by_code(p_code text)
returns table (project_id uuid, project_name text, claim_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.claim_token
  from public.client_projects p
  where p.invite_code = lower(p_code)
    and p.user_id is null
  limit 1;
$$;

revoke all on function public.get_invite_by_code(text) from public;
grant execute on function public.get_invite_by_code(text) to anon, authenticated;

create or replace function public.ensure_project_invite_code(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_name text;
  v_suffix text;
  v_taken boolean;
begin
  select p.invite_code into v_code
  from public.client_projects p
  where p.id = p_project_id and p.user_id is null;

  if v_code is not null then
    return v_code;
  end if;

  select p.name into v_name
  from public.client_projects p
  where p.id = p_project_id and p.user_id is null;

  if v_name is null then
    raise exception 'Proyecto no encontrado o ya reclamado.';
  end if;

  v_code := lower(translate(v_name, 'áéíóúüñ', 'aeiouun'));
  v_code := regexp_replace(v_code, '[^a-z0-9]+', '-', 'g');
  v_code := trim(both '-' from v_code);
  if length(v_code) > 30 then
    v_code := left(v_code, 30);
  end if;
  if v_code = '' then
    v_code := 'proyecto';
  end if;

  loop
    v_suffix := '';
    for i in 1..6 loop
      v_suffix := v_suffix || substr('abcdefghijklmnopqrstuvwxyz0123456789', 1 + floor(random() * 36)::int, 1);
    end loop;

    select exists(
      select 1 from public.client_projects
      where invite_code = v_code || '-' || v_suffix
    ) into v_taken;

    exit when not v_taken;
  end loop;

  update public.client_projects
  set invite_code = v_code || '-' || v_suffix, updated_at = now()
  where id = p_project_id and user_id is null;

  return v_code || '-' || v_suffix;
end;
$$;

revoke all on function public.ensure_project_invite_code(uuid) from public;
grant execute on function public.ensure_project_invite_code(uuid) to authenticated;

-- ============================================================================
-- FASE 8/9 - EDITOR MVP v2 (PENDIENTE DE EJECUTAR EN SUPABASE)
-- ----------------------------------------------------------------------------
-- Este bloque aun NO se ejecuto en la base. En la Fase 9 se aplicara junto con
-- la creacion de la tabla client_site_page_versions y de las funciones
-- client_prepare_site_draft / client_publish_site_changes / client_reset_site_draft.
--
-- PENDIENTE: dentro del cuerpo de client_prepare_site_draft, reemplazar el
-- insert original de la version 'published' por el siguiente (paginas iniciales
-- con bloques base en lugar de '[]' vacio):
--
--   insert into public.client_site_page_versions (
--     page_id, version_kind, content_json, updated_by
--   )
--   values (
--     v_page.id,
--     'published',
--     case
--       when v_page.slug = 'inicio' then jsonb_build_object(
--         'page_name', v_page.name,
--         'slug', v_page.slug,
--         'sections', jsonb_build_array(
--           jsonb_build_object(
--             'id','hero-1',
--             'type','hero',
--             'label','Portada principal',
--             'visible',true,
--             'data',jsonb_build_object(
--               'title',coalesce(v_project.name,'Tu negocio'),
--               'subtitle','Describe aquí lo más importante de tu negocio.',
--               'button_text','Escríbenos',
--               'button_url','',
--               'image_url','',
--               'image_alt',''
--             )
--           ),
--           jsonb_build_object(
--             'id','features-1',
--             'type','features',
--             'label','Ventajas',
--             'visible',true,
--             'data',jsonb_build_object(
--               'heading','Lo que ofreces',
--               'items',jsonb_build_array(
--                 'Servicio 1',
--                 'Servicio 2',
--                 'Servicio 3'
--               )
--             )
--           ),
--           jsonb_build_object(
--             'id','contact-1',
--             'type','contact',
--             'label','Contacto',
--             'visible',true,
--             'data',jsonb_build_object(
--               'phone','',
--               'whatsapp','',
--               'email','',
--               'address','',
--               'maps_url',''
--             )
--           )
--         )
--       )
--       when v_page.slug = 'nosotros' then jsonb_build_object(
--         'page_name', v_page.name,
--         'slug', v_page.slug,
--         'sections', jsonb_build_array(
--           jsonb_build_object(
--             'id','text-1',
--             'type','text',
--             'label','Quiénes somos',
--             'visible',true,
--             'data',jsonb_build_object(
--               'heading','Quiénes somos',
--               'body','Cuenta aquí la historia de tu negocio, tu experiencia o tu forma de trabajar.'
--             )
--           ),
--           jsonb_build_object(
--             'id','gallery-1',
--             'type','gallery',
--             'label','Galería',
--             'visible',true,
--             'data',jsonb_build_object(
--               'heading','Conoce nuestro negocio',
--               'images',jsonb_build_array()
--             )
--           ),
--           jsonb_build_object(
--             'id','testimonials-1',
--             'type','testimonials',
--             'label','Testimonios',
--             'visible',true,
--             'data',jsonb_build_object(
--               'heading','Lo que dicen nuestros clientes',
--               'items',jsonb_build_array()
--             )
--           )
--         )
--       )
--       when v_page.slug = 'contacto' then jsonb_build_object(
--         'page_name', v_page.name,
--         'slug', v_page.slug,
--         'sections', jsonb_build_array(
--           jsonb_build_object(
--             'id','contact-1',
--             'type','contact',
--             'label','Datos de contacto',
--             'visible',true,
--             'data',jsonb_build_object(
--               'phone','',
--               'whatsapp','',
--               'email','',
--               'address','',
--               'maps_url',''
--             )
--           ),
--           jsonb_build_object(
--             'id','hours-1',
--             'type','hours',
--             'label','Horarios',
--             'visible',true,
--             'data',jsonb_build_object(
--               'days_text','Lunes a sábado',
--               'hours_text','8:00 AM a 6:00 PM'
--             )
--           ),
--           jsonb_build_object(
--             'id','buttons-1',
--             'type','buttons',
--             'label','Botones de acción',
--             'visible',true,
--             'data',jsonb_build_object(
--               'items',jsonb_build_array(
--                 jsonb_build_object('label','Escríbenos','url','','style','primary'),
--                 jsonb_build_object('label','Ver ubicación','url','','style','secondary')
--               )
--             )
--           )
--         )
--       )
--       else jsonb_build_object(
--         'page_name', v_page.name,
--         'slug', v_page.slug,
--         'sections', '[]'::jsonb
--       )
--     end,
--     v_user
--   );
