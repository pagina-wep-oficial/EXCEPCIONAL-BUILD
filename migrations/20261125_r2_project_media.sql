begin;

create table if not exists public.client_project_media_assets (
  id uuid primary key,
  project_id uuid not null references public.client_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  purpose text not null,
  visibility text not null,
  storage_provider text not null default 'r2',
  r2_key text not null unique,
  public_url text,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  page_path text,
  asset_key text,
  status text not null default 'ready',
  legacy_source_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint client_project_media_assets_purpose_check
    check (purpose in ('editor_image', 'editor_video', 'project_file', 'legacy_image', 'legacy_video', 'legacy_file')),
  constraint client_project_media_assets_visibility_check
    check (visibility in ('public', 'private')),
  constraint client_project_media_assets_storage_check
    check (storage_provider = 'r2'),
  constraint client_project_media_assets_status_check
    check (status in ('ready', 'orphan', 'deleted', 'failed')),
  constraint client_project_media_assets_size_check check (size_bytes >= 0),
  constraint client_project_media_assets_public_check
    check ((visibility = 'public' and public_url is not null) or (visibility = 'private' and public_url is null))
);

create index if not exists client_project_media_assets_project_idx
  on public.client_project_media_assets(project_id, created_at desc);
create index if not exists client_project_media_assets_project_key_idx
  on public.client_project_media_assets(project_id, r2_key);
create index if not exists client_project_media_assets_editor_ref_idx
  on public.client_project_media_assets(project_id, page_path, asset_key)
  where deleted_at is null;

alter table public.client_project_media_assets enable row level security;
grant select, insert, update, delete on public.client_project_media_assets to authenticated;

drop policy if exists "client_project_media_assets_select_own" on public.client_project_media_assets;
create policy "client_project_media_assets_select_own" on public.client_project_media_assets
  for select to authenticated
  using (
    exists (
      select 1 from public.client_projects project
      where project.id = client_project_media_assets.project_id
        and (project.user_id = auth.uid() or public.is_app_admin())
    )
  );

drop policy if exists "client_project_media_assets_insert_own" on public.client_project_media_assets;
create policy "client_project_media_assets_insert_own" on public.client_project_media_assets
  for insert to authenticated
  with check (
    exists (
      select 1 from public.client_projects project
      where project.id = client_project_media_assets.project_id
        and (project.user_id = auth.uid() or public.is_app_admin())
    )
  );

drop policy if exists "client_project_media_assets_update_own" on public.client_project_media_assets;
create policy "client_project_media_assets_update_own" on public.client_project_media_assets
  for update to authenticated
  using (
    exists (
      select 1 from public.client_projects project
      where project.id = client_project_media_assets.project_id
        and (project.user_id = auth.uid() or public.is_app_admin())
    )
  ) with check (
    exists (
      select 1 from public.client_projects project
      where project.id = client_project_media_assets.project_id
        and (project.user_id = auth.uid() or public.is_app_admin())
    )
  );

alter table public.client_project_files
  add column if not exists storage_provider text not null default 'drive',
  add column if not exists media_asset_id uuid references public.client_project_media_assets(id) on delete set null,
  add column if not exists r2_key text;

alter table public.client_project_files
  alter column drive_file_id drop not null;

alter table public.client_project_files
  drop constraint if exists client_project_files_storage_provider_check;
alter table public.client_project_files
  add constraint client_project_files_storage_provider_check
  check (
    (storage_provider = 'drive' and drive_file_id is not null and r2_key is null)
    or (storage_provider = 'r2' and drive_file_id is null and r2_key is not null)
  );

create unique index if not exists client_project_files_r2_key_unique
  on public.client_project_files(r2_key) where r2_key is not null;
create unique index if not exists client_project_files_media_asset_unique
  on public.client_project_files(media_asset_id) where media_asset_id is not null;

alter table public.client_site_video_assets
  add column if not exists media_asset_id uuid references public.client_project_media_assets(id) on delete set null,
  add column if not exists r2_key text;

alter table public.client_site_video_assets
  drop constraint if exists client_site_video_assets_provider_check;
alter table public.client_site_video_assets
  add constraint client_site_video_assets_provider_check
  check (provider in ('youtube', 'vimeo', 'cloudflare_stream', 'raw', 'r2', 'external'));

create unique index if not exists client_site_video_assets_r2_key_unique
  on public.client_site_video_assets(r2_key) where r2_key is not null;

commit;
