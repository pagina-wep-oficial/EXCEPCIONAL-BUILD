create table if not exists public.client_site_video_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  page_id uuid references public.client_site_pages(id) on delete set null,
  asset_key text not null,
  kind text not null,
  provider text not null,
  source_url text,
  playback_url text,
  poster_url text,
  mime_type text,
  size_bytes bigint not null default 0,
  duration_ms bigint not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  status text not null default 'draft',
  source_meta jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_site_video_assets_kind_check
    check (kind in ('video_embed','video_stream','video_file_raw')),
  constraint client_site_video_assets_provider_check
    check (provider in ('youtube','vimeo','cloudflare_stream','raw','external')),
  constraint client_site_video_assets_status_check
    check (status in ('draft','processing','ready','failed','orphan')),
  constraint client_site_video_assets_size_check
    check (size_bytes >= 0),
  constraint client_site_video_assets_duration_check
    check (duration_ms >= 0),
  constraint client_site_video_assets_width_check
    check (width >= 0),
  constraint client_site_video_assets_height_check
    check (height >= 0)
);

create index if not exists client_site_video_assets_project_idx
  on public.client_site_video_assets(project_id);

create index if not exists client_site_video_assets_page_idx
  on public.client_site_video_assets(page_id);

create index if not exists client_site_video_assets_status_idx
  on public.client_site_video_assets(status);

create index if not exists client_site_video_assets_kind_idx
  on public.client_site_video_assets(kind);

create index if not exists client_site_video_assets_project_asset_key_idx
  on public.client_site_video_assets(project_id, asset_key);

drop trigger if exists client_site_video_assets_updated_at on public.client_site_video_assets;
create trigger client_site_video_assets_updated_at
before update on public.client_site_video_assets
for each row execute function public.client_set_updated_at();

alter table public.client_site_video_assets enable row level security;

grant select, insert, update, delete on public.client_site_video_assets to authenticated;

drop policy if exists "client_site_video_assets_select_own" on public.client_site_video_assets;
create policy "client_site_video_assets_select_own"
on public.client_site_video_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_insert_own" on public.client_site_video_assets;
create policy "client_site_video_assets_insert_own"
on public.client_site_video_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_update_own" on public.client_site_video_assets;
create policy "client_site_video_assets_update_own"
on public.client_site_video_assets
for update
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
)
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_delete_own" on public.client_site_video_assets;
create policy "client_site_video_assets_delete_own"
on public.client_site_video_assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);