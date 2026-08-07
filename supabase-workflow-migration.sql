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
  where id = p_project_id and user_id = v_user;

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
