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
  add column if not exists published_at timestamptz;

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
    execute 'alter table public.prospectos add column if not exists borrado_en timestamptz';
  end if;
end $$;

-- Papelera de prospectos: permite borrado permanente solo para miembros del CRM.
do $$
begin
  if to_regclass('public.prospectos') is not null
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'prospectos'
         and policyname = 'crm_eliminar_prospectos'
     ) then
    execute 'create policy crm_eliminar_prospectos on public.prospectos for delete to authenticated using (public.es_miembro_crm())';
    execute 'grant delete on public.prospectos to authenticated';
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
drop view if exists public.crm_project_overview;
create view public.crm_project_overview
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

-- ==========================================================
-- 12) INVITACIONES CON CÓDIGO CORTO (Plan A+B)
-- Links identificables (?invite=lisandrouc-k3m2p9&token=...) y
-- consistencia de duplicados en el CRM.
-- ==========================================================

alter table public.client_projects add column if not exists invite_code text;
create unique index if not exists client_projects_invite_code_key
  on public.client_projects (invite_code)
  where invite_code is not null;

-- Devuelve el proyecto de una invitación por su código corto,
-- SOLO si aún está sin dueño (pendiente de reclamar).
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

-- Genera un código corto único para una invitación sin código.
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
