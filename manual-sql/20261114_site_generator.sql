begin;

create table if not exists public.client_site_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.client_projects(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'provisioning_store', 'creating_repository', 'creating_pages', 'published', 'needs_authorization', 'failed')),
  template_version text not null default 'store-v1',
  slug text not null,
  itm_project_id uuid,
  github_owner text,
  github_repo text,
  cloudflare_project text,
  public_url text,
  last_error_code text,
  last_error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_site_generations_slug_uq
  on public.client_site_generations(lower(slug));

alter table public.client_site_generations enable row level security;

drop policy if exists client_site_generations_admin_all on public.client_site_generations;
create policy client_site_generations_admin_all
  on public.client_site_generations
  for all to authenticated
  using ((select public.is_app_admin()))
  with check ((select public.is_app_admin()));

commit;
