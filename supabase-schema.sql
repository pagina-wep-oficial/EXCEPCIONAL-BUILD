-- Excepcional Build: portal de clientes
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- No elimina tus tablas actuales. Usa nombres client_* para no chocar con tu CRM.

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
