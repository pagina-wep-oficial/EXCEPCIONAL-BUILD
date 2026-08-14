create table if not exists public.client_site_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  slug text not null,
  name text not null,
  page_order integer not null default 0,
  is_home boolean not null default false,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_site_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.client_site_pages(id) on delete cascade,
  version_kind text not null,
  content_json jsonb not null default '{"page_name":"","slug":"","sections":[]}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_site_page_versions_kind_check
    check (version_kind in ('draft','published'))
);

create table if not exists public.client_site_publish_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  published_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists client_site_pages_project_idx
  on public.client_site_pages(project_id);

create unique index if not exists client_site_pages_project_slug_unique
  on public.client_site_pages(project_id, slug);

create index if not exists client_site_page_versions_page_idx
  on public.client_site_page_versions(page_id);

create unique index if not exists client_site_page_versions_page_kind_unique
  on public.client_site_page_versions(page_id, version_kind);

create index if not exists client_site_publish_log_project_idx
  on public.client_site_publish_log(project_id);

drop trigger if exists client_site_pages_updated_at on public.client_site_pages;
create trigger client_site_pages_updated_at
before update on public.client_site_pages
for each row execute function public.client_set_updated_at();

drop trigger if exists client_site_page_versions_updated_at on public.client_site_page_versions;
create trigger client_site_page_versions_updated_at
before update on public.client_site_page_versions
for each row execute function public.client_set_updated_at();

alter table public.client_site_pages enable row level security;
alter table public.client_site_page_versions enable row level security;
alter table public.client_site_publish_log enable row level security;

grant select, insert, update, delete on public.client_site_pages to authenticated;
grant select, insert, update, delete on public.client_site_page_versions to authenticated;
grant select, insert on public.client_site_publish_log to authenticated;

drop policy if exists "client_site_pages_select_own" on public.client_site_pages;
create policy "client_site_pages_select_own"
on public.client_site_pages
for select
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_pages.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_pages_insert_own" on public.client_site_pages;
create policy "client_site_pages_insert_own"
on public.client_site_pages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_pages.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_pages_update_own" on public.client_site_pages;
create policy "client_site_pages_update_own"
on public.client_site_pages
for update
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_pages.project_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_pages.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_page_versions_select_own" on public.client_site_page_versions;
create policy "client_site_page_versions_select_own"
on public.client_site_page_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.client_site_pages sp
    join public.client_projects p on p.id = sp.project_id
    where sp.id = client_site_page_versions.page_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_page_versions_insert_own" on public.client_site_page_versions;
create policy "client_site_page_versions_insert_own"
on public.client_site_page_versions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_site_pages sp
    join public.client_projects p on p.id = sp.project_id
    where sp.id = client_site_page_versions.page_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_page_versions_update_own" on public.client_site_page_versions;
create policy "client_site_page_versions_update_own"
on public.client_site_page_versions
for update
to authenticated
using (
  exists (
    select 1
    from public.client_site_pages sp
    join public.client_projects p on p.id = sp.project_id
    where sp.id = client_site_page_versions.page_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.client_site_pages sp
    join public.client_projects p on p.id = sp.project_id
    where sp.id = client_site_page_versions.page_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_publish_log_select_own" on public.client_site_publish_log;
create policy "client_site_publish_log_select_own"
on public.client_site_publish_log
for select
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_publish_log.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "client_site_publish_log_insert_own" on public.client_site_publish_log;
create policy "client_site_publish_log_insert_own"
on public.client_site_publish_log
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_publish_log.project_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "admin_site_pages_all" on public.client_site_pages;
create policy "admin_site_pages_all"
on public.client_site_pages
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "admin_site_page_versions_all" on public.client_site_page_versions;
create policy "admin_site_page_versions_all"
on public.client_site_page_versions
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "admin_site_publish_log_all" on public.client_site_publish_log;
create policy "admin_site_publish_log_all"
on public.client_site_publish_log
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

create or replace function public.client_prepare_site_draft(p_project_id uuid)
returns setof public.client_site_pages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
  v_page public.client_site_pages%rowtype;
begin
  select *
  into v_project
  from public.client_projects
  where id = p_project_id;

  if v_project.id is null then
    raise exception 'Proyecto no encontrado.';
  end if;

  if v_project.user_id <> v_user and not public.is_app_admin() then
    raise exception 'No tienes acceso a este proyecto.';
  end if;

  if not exists (
    select 1
    from public.client_site_pages
    where project_id = p_project_id
  ) then
    insert into public.client_site_pages (project_id, slug, name, page_order, is_home, is_visible)
    values
      (p_project_id, 'inicio', 'Inicio', 1, true, true),
      (p_project_id, 'nosotros', 'Nosotros', 2, false, true),
      (p_project_id, 'contacto', 'Contacto', 3, false, true);
  end if;

  for v_page in
    select *
    from public.client_site_pages
    where project_id = p_project_id
    order by page_order, created_at
  loop
    if not exists (
      select 1
      from public.client_site_page_versions
      where page_id = v_page.id
        and version_kind = 'published'
    ) then
      insert into public.client_site_page_versions (
        page_id, version_kind, content_json, updated_by
      )
      values (
        v_page.id,
        'published',
        case
          when v_page.slug = 'inicio' then jsonb_build_object(
            'page_name', v_page.name,
            'slug', v_page.slug,
            'sections', jsonb_build_array(
              jsonb_build_object(
                'id','hero-1',
                'type','hero',
                'label','Portada principal',
                'visible',true,
                'data',jsonb_build_object(
                  'title',coalesce(v_project.name,'Tu negocio'),
                  'subtitle','Describe aquí lo más importante de tu negocio.',
                  'button_text','Escríbenos',
                  'button_url','',
                  'image_url','',
                  'image_alt',''
                )
              ),
              jsonb_build_object(
                'id','features-1',
                'type','features',
                'label','Ventajas',
                'visible',true,
                'data',jsonb_build_object(
                  'heading','Lo que ofreces',
                  'items',jsonb_build_array(
                    'Servicio 1',
                    'Servicio 2',
                    'Servicio 3'
                  )
                )
              ),
              jsonb_build_object(
                'id','contact-1',
                'type','contact',
                'label','Contacto',
                'visible',true,
                'data',jsonb_build_object(
                  'phone','',
                  'whatsapp','',
                  'email','',
                  'address','',
                  'maps_url',''
                )
              )
            )
          )
          when v_page.slug = 'nosotros' then jsonb_build_object(
            'page_name', v_page.name,
            'slug', v_page.slug,
            'sections', jsonb_build_array(
              jsonb_build_object(
                'id','text-1',
                'type','text',
                'label','Quiénes somos',
                'visible',true,
                'data',jsonb_build_object(
                  'heading','Quiénes somos',
                  'body','Cuenta aquí la historia de tu negocio, tu experiencia o tu forma de trabajar.'
                )
              ),
              jsonb_build_object(
                'id','gallery-1',
                'type','gallery',
                'label','Galería',
                'visible',true,
                'data',jsonb_build_object(
                  'heading','Conoce nuestro negocio',
                  'images',jsonb_build_array()
                )
              ),
              jsonb_build_object(
                'id','testimonials-1',
                'type','testimonials',
                'label','Testimonios',
                'visible',true,
                'data',jsonb_build_object(
                  'heading','Lo que dicen nuestros clientes',
                  'items',jsonb_build_array()
                )
              )
            )
          )
          when v_page.slug = 'contacto' then jsonb_build_object(
            'page_name', v_page.name,
            'slug', v_page.slug,
            'sections', jsonb_build_array(
              jsonb_build_object(
                'id','contact-1',
                'type','contact',
                'label','Datos de contacto',
                'visible',true,
                'data',jsonb_build_object(
                  'phone','',
                  'whatsapp','',
                  'email','',
                  'address','',
                  'maps_url',''
                )
              ),
              jsonb_build_object(
                'id','hours-1',
                'type','hours',
                'label','Horarios',
                'visible',true,
                'data',jsonb_build_object(
                  'days_text','Lunes a sábado',
                  'hours_text','8:00 AM a 6:00 PM'
                )
              ),
              jsonb_build_object(
                'id','buttons-1',
                'type','buttons',
                'label','Botones de acción',
                'visible',true,
                'data',jsonb_build_object(
                  'items',jsonb_build_array(
                    jsonb_build_object('label','Escríbenos','url','','style','primary'),
                    jsonb_build_object('label','Ver ubicación','url','','style','secondary')
                  )
                )
              )
            )
          )
          else jsonb_build_object(
            'page_name', v_page.name,
            'slug', v_page.slug,
            'sections', '[]'::jsonb
          )
        end,
        v_user
      );
    end if;

    if not exists (
      select 1
      from public.client_site_page_versions
      where page_id = v_page.id
        and version_kind = 'draft'
    ) then
      insert into public.client_site_page_versions (
        page_id, version_kind, content_json, updated_by
      )
      select
        v_page.id,
        'draft',
        content_json,
        v_user
      from public.client_site_page_versions
      where page_id = v_page.id
        and version_kind = 'published';
    end if;
  end loop;

  return query
  select *
  from public.client_site_pages
  where project_id = p_project_id
  order by page_order, created_at;
end;
$$;

revoke all on function public.client_prepare_site_draft(uuid) from public;
grant execute on function public.client_prepare_site_draft(uuid) to authenticated;

create or replace function public.client_publish_site_changes(
  p_project_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
begin
  select *
  into v_project
  from public.client_projects
  where id = p_project_id;

  if v_project.id is null then
    raise exception 'Proyecto no encontrado.';
  end if;

  if v_project.user_id <> v_user and not public.is_app_admin() then
    raise exception 'No tienes acceso a este proyecto.';
  end if;

  update public.client_site_page_versions published
  set
    content_json = draft.content_json,
    updated_by = v_user,
    updated_at = now()
  from public.client_site_page_versions draft
  join public.client_site_pages sp on sp.id = draft.page_id
  where sp.project_id = p_project_id
    and draft.version_kind = 'draft'
    and published.page_id = draft.page_id
    and published.version_kind = 'published';

  insert into public.client_site_publish_log (
    project_id,
    published_by,
    notes
  )
  values (
    p_project_id,
    v_user,
    p_notes
  );
end;
$$;

revoke all on function public.client_publish_site_changes(uuid, text) from public;
grant execute on function public.client_publish_site_changes(uuid, text) to authenticated;

create or replace function public.client_reset_site_draft(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
begin
  select *
  into v_project
  from public.client_projects
  where id = p_project_id;

  if v_project.id is null then
    raise exception 'Proyecto no encontrado.';
  end if;

  if v_project.user_id <> v_user and not public.is_app_admin() then
    raise exception 'No tienes acceso a este proyecto.';
  end if;

  update public.client_site_page_versions draft
  set
    content_json = published.content_json,
    updated_by = v_user,
    updated_at = now()
  from public.client_site_page_versions published
  join public.client_site_pages sp on sp.id = published.page_id
  where sp.project_id = p_project_id
    and published.version_kind = 'published'
    and draft.page_id = published.page_id
    and draft.version_kind = 'draft';
end;
$$;

revoke all on function public.client_reset_site_draft(uuid) from public;
grant execute on function public.client_reset_site_draft(uuid) to authenticated;