-- ============================================================================
-- TANDA 1 + TANDA 2 - EJECUTAR EN SUPABASE SQL EDITOR (todo es idempotente)
-- Copia TODO este archivo en una consulta nueva y ejecuta.
--   Seccion 1: columnas + tabla de planes + RLS + trigger de bloqueos (Tanda 1)
--   Seccion 2: funcion client_apply_project_setup (Tanda 2)
--   Seccion 3: plan de prueba Hostinger Premium
-- ============================================================================

-- ============================================================================
-- TANDA 1 - ADMINISTRACIÓN, PLANES Y BLOQUEOS DE DOMINIO Y ALOJAMIENTO
-- ----------------------------------------------------------------------------
-- Sección idempotente: puede ejecutarse más de una vez.
-- ============================================================================

-- 1.1a) Columnas de administración en client_project_setup.
alter table public.client_project_setup
  add column if not exists domain_type_locked boolean not null default false,
  add column if not exists domain_value_locked boolean not null default false,
  add column if not exists domain_verified_at timestamptz,
  add column if not exists hosting_plan_locked boolean not null default false,
  add column if not exists hosting_plan_id text,
  add column if not exists hosting_plan_name text,
  add column if not exists hosting_plan_features jsonb,
  add column if not exists hosting_first_year numeric(12,2),
  add column if not exists hosting_renewal numeric(12,2),
  add column if not exists hosting_currency text;

-- 1.1b) Ampliar hosting_type: permite "propio" (el cliente ya tiene hosting).
alter table public.client_project_setup
  drop constraint if exists client_project_setup_hosting_check;
alter table public.client_project_setup
  add constraint client_project_setup_hosting_check
  check (hosting_type in ('cloudflare','hostinger','propio'));

-- 1.3) Catálogo de planes de hosting (puede empezar vacío; solo admin escribe).
create table if not exists public.client_hosting_plans (
  id text primary key,
  name text not null,
  description text,
  features jsonb not null default '[]'::jsonb,
  first_year numeric(12,2),
  renewal numeric(12,2),
  currency text not null default 'MXN',
  period_months integer not null default 12,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.client_hosting_plans enable row level security;
grant select on public.client_hosting_plans to authenticated;
grant insert, update, delete on public.client_hosting_plans to authenticated;

drop policy if exists "client_hosting_plans_select_active" on public.client_hosting_plans;
create policy "client_hosting_plans_select_active" on public.client_hosting_plans
  for select to authenticated
  using (active = true);

drop policy if exists "admin_hosting_plans_all" on public.client_hosting_plans;
create policy "admin_hosting_plans_all" on public.client_hosting_plans
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

-- 1.4) Trigger de bloqueos: el cliente no puede tocar lo que el admin fijó.
create or replace function public.client_project_setup_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := public.is_app_admin();
begin
  if v_is_admin then
    return new;
  end if;

  -- Cliente insertando su configuración: nunca puede fijar bloqueos.
  if tg_op = 'INSERT' then
    new.domain_type_locked := false;
    new.domain_value_locked := false;
    new.hosting_plan_locked := false;
    return new;
  end if;

  -- UPDATE: el cliente no puede cambiar los bloqueos.
  if new.domain_type_locked is distinct from old.domain_type_locked
     or new.domain_value_locked is distinct from old.domain_value_locked
     or new.hosting_plan_locked is distinct from old.hosting_plan_locked then
    raise exception 'No puedes cambiar la configuración fijada. Pide al equipo que la ajuste.';
  end if;

  -- Proteger los campos según cada bloqueo activo.
  if old.domain_type_locked and (
    new.address_type is distinct from old.address_type
    or new.domain_owned is distinct from old.domain_owned
  ) then
    raise exception 'El tipo de dirección fue fijado por tu equipo.';
  end if;

  if old.domain_value_locked and (
    new.site_name is distinct from old.site_name
    or new.domain is distinct from old.domain
    or new.domain_first_year is distinct from old.domain_first_year
    or new.domain_renewal is distinct from old.domain_renewal
    or new.domain_verified_at is distinct from old.domain_verified_at
  ) then
    raise exception 'La dirección fue fijada por tu equipo.';
  end if;

  if old.hosting_plan_locked and (
    new.hosting_type is distinct from old.hosting_type
    or new.hosting_plan_id is distinct from old.hosting_plan_id
    or new.hosting_plan_name is distinct from old.hosting_plan_name
    or new.hosting_plan_features is distinct from old.hosting_plan_features
    or new.hosting_first_year is distinct from old.hosting_first_year
    or new.hosting_renewal is distinct from old.hosting_renewal
    or new.hosting_currency is distinct from old.hosting_currency
  ) then
    raise exception 'El alojamiento fue fijado por tu equipo.';
  end if;

  return new;
end;
$$;

drop trigger if exists client_project_setup_guard on public.client_project_setup;
create trigger client_project_setup_guard
  before insert or update on public.client_project_setup
  for each row execute function public.client_project_setup_guard();

-- ============================================================================
-- SECCION 2 - FUNCION CLIENT_APPLY_PROJECT_SETUP (TANDA 2)
-- ============================================================================

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
    and (s.user_id = v_user or s.user_id is null)
    and (p.user_id = v_user or p.user_id is null)
    and coalesce(p.project_stage, 'Invitación') in ('Invitación','Configuración','Cotización','Aprobación','Información')
  order by s.user_id is null
  limit 1;

  if not found then raise exception 'No se encontró la configuración de este proyecto.'; end if;

  if v_setup.hosting_type in ('hostinger','propio') and v_setup.address_type <> 'dominio' then
    raise exception 'Este alojamiento requiere dominio personalizado.';
  end if;

  if v_setup.address_type = 'gratis' and nullif(trim(coalesce(v_setup.site_name,'')), '') is null then
    raise exception 'Falta el nombre del enlace gratuito.';
  end if;

  if v_setup.address_type = 'dominio' and nullif(trim(coalesce(v_setup.domain,'')), '') is null then
    raise exception 'Falta el dominio personalizado.';
  end if;

  update public.client_project_setup
  set user_id = coalesce(user_id, v_user),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where project_id = p_project_id and (user_id = v_user or user_id is null);

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

-- 3) Plan de prueba para client_hosting_plans (idempotente).
insert into public.client_hosting_plans
(id, name, description, features, first_year, renewal, currency, period_months, active, sort_order)
values
('hostinger-premium', 'Hostinger Premium', 'Plan para sitios con hosting contratado.', '["Hosting web", "Correo opcional", "SSL", "Soporte para dominio"]'::jsonb, 899, 1299, 'MXN', 12, true, 1)
on conflict (id) do update set
name=excluded.name,
description=excluded.description,
features=excluded.features,
first_year=excluded.first_year,
renewal=excluded.renewal,
currency=excluded.currency,
period_months=excluded.period_months,
active=excluded.active,
sort_order=excluded.sort_order;