-- Historial de publicaciones del editor V2.
-- El contenido pesado vive en Cloudflare R2; Supabase conserva el índice.
-- Ejecutar en Supabase > SQL Editor. Es idempotente.

create table if not exists public.client_editor_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  version_number integer not null default 1,
  status text not null default 'pending',
  summary text not null default '',
  snapshot_key text not null,
  size_bytes bigint not null default 0,
  file_count integer not null default 0,
  commit_sha text,
  base_commit_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  constraint client_editor_versions_status_check
    check (status in ('pending', 'published', 'failed', 'deleted'))
);

create table if not exists public.client_editor_version_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.client_editor_versions(id) on delete cascade,
  project_id uuid not null references public.client_projects(id) on delete cascade,
  file_path text not null,
  r2_key text not null,
  file_kind text not null default 'asset',
  content_type text,
  size_bytes bigint not null default 0,
  sha256 text,
  created_at timestamptz not null default now(),
  constraint client_editor_version_files_kind_check
    check (file_kind in ('manifest', 'asset')),
  unique(version_id, file_path)
);

create index if not exists client_editor_versions_project_created_idx
  on public.client_editor_versions(project_id, created_at desc);

create index if not exists client_editor_versions_project_status_idx
  on public.client_editor_versions(project_id, status, expires_at);

create index if not exists client_editor_version_files_version_idx
  on public.client_editor_version_files(version_id);

create index if not exists client_editor_version_files_project_idx
  on public.client_editor_version_files(project_id);

alter table public.client_editor_versions enable row level security;
alter table public.client_editor_version_files enable row level security;

grant select, insert, update, delete
  on public.client_editor_versions, public.client_editor_version_files
  to authenticated;

drop policy if exists "editor_versions_select_own" on public.client_editor_versions;
create policy "editor_versions_select_own"
on public.client_editor_versions for select to authenticated
using (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_versions.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_versions_insert_own" on public.client_editor_versions;
create policy "editor_versions_insert_own"
on public.client_editor_versions for insert to authenticated
with check (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_versions.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_versions_update_own" on public.client_editor_versions;
create policy "editor_versions_update_own"
on public.client_editor_versions for update to authenticated
using (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_versions.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
)
with check (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_versions.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_versions_delete_own" on public.client_editor_versions;
create policy "editor_versions_delete_own"
on public.client_editor_versions for delete to authenticated
using (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_versions.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_version_files_select_own" on public.client_editor_version_files;
create policy "editor_version_files_select_own"
on public.client_editor_version_files for select to authenticated
using (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_version_files.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_version_files_insert_own" on public.client_editor_version_files;
create policy "editor_version_files_insert_own"
on public.client_editor_version_files for insert to authenticated
with check (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_version_files.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "editor_version_files_delete_own" on public.client_editor_version_files;
create policy "editor_version_files_delete_own"
on public.client_editor_version_files for delete to authenticated
using (
  exists (
    select 1 from public.client_projects p
    where p.id = client_editor_version_files.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

-- Plan activo de recuperación: conserva qué versión se preparó
-- como borrador antes de que el usuario confirme Publicar.
create unique index if not exists client_editor_versions_project_id_id_key
  on public.client_editor_versions(project_id, id);

create table if not exists public.client_editor_restore_plans (
  project_id uuid primary key
    references public.client_projects(id) on delete cascade,
  version_id uuid not null,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  status text not null default 'draft',
  snapshot_page_paths jsonb not null default '[]'::jsonb,
  snapshot_asset_paths jsonb not null default '[]'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  publishing_at timestamptz,
  completed_at timestamptz,

  constraint client_editor_restore_plans_status_check
    check (status in ('draft', 'publishing', 'completed', 'failed')),

  constraint client_editor_restore_plans_page_paths_check
    check (jsonb_typeof(snapshot_page_paths) = 'array'),

  constraint client_editor_restore_plans_asset_paths_check
    check (jsonb_typeof(snapshot_asset_paths) = 'array'),

  constraint client_editor_restore_plans_version_project_fkey
    foreign key (project_id, version_id)
    references public.client_editor_versions(project_id, id)
    on delete restrict
);

create index if not exists client_editor_restore_plans_version_idx
  on public.client_editor_restore_plans(version_id);

alter table public.client_editor_restore_plans enable row level security;

grant select, insert, update, delete
  on public.client_editor_restore_plans
  to authenticated;

drop policy if exists "editor_restore_plans_select_own"
  on public.client_editor_restore_plans;
create policy "editor_restore_plans_select_own"
on public.client_editor_restore_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.client_projects as project
    where project.id = client_editor_restore_plans.project_id
      and (
        project.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);

drop policy if exists "editor_restore_plans_insert_own"
  on public.client_editor_restore_plans;
create policy "editor_restore_plans_insert_own"
on public.client_editor_restore_plans
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.client_projects as project
    where project.id = client_editor_restore_plans.project_id
      and (
        project.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);

drop policy if exists "editor_restore_plans_update_own"
  on public.client_editor_restore_plans;
create policy "editor_restore_plans_update_own"
on public.client_editor_restore_plans
for update
to authenticated
using (
  exists (
    select 1
    from public.client_projects as project
    where project.id = client_editor_restore_plans.project_id
      and (
        project.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.client_projects as project
    where project.id = client_editor_restore_plans.project_id
      and (
        project.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);

drop policy if exists "editor_restore_plans_delete_own"
  on public.client_editor_restore_plans;
create policy "editor_restore_plans_delete_own"
on public.client_editor_restore_plans
for delete
to authenticated
using (
  exists (
    select 1
    from public.client_projects as project
    where project.id = client_editor_restore_plans.project_id
      and (
        project.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);
