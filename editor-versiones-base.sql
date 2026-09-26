-- Versión base en el editor: cada página guarda una copia 'base' con el
-- contenido ORIGINAL del sitio (el que se tomó como base al inicio).
-- El editor la usa para el botón "Versión base" (restaurar la original).
-- Ejecutar en el SQL editor de Supabase. Idempotente: puede re-ejecutarse.

-- 1) Permitir el tipo 'base' junto a 'draft' y 'published'.
alter table public.client_site_page_versions
  drop constraint if exists client_site_page_versions_kind_check;

alter table public.client_site_page_versions
  add constraint client_site_page_versions_kind_check
  check (version_kind in ('draft', 'published', 'base'));

-- 2) Rellenar 'base' con el contenido publicado actual para las páginas
--    existentes que aún no tienen base (proyectos ya creados antes de esto).
insert into public.client_site_page_versions (page_id, version_kind, content_json, updated_by)
select
  vp.page_id,
  'base',
  vp.content_json,
  vp.updated_by
from public.client_site_page_versions vp
where vp.version_kind = 'published'
  and not exists (
    select 1
    from public.client_site_page_versions b
    where b.page_id = vp.page_id
      and b.version_kind = 'base'
  );

-- 3) Los proyectos NUEVOS también crean su versión base al activarse:
--    misma función de preparación, agregando el respaldo 'base'.
create or replace function public.client_prepare_site_draft(p_project_id uuid)
returns setof public.client_site_pages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_project public.client_projects%rowtype;
  v_page record;
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
    select 1 from public.client_site_pages where project_id = p_project_id
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

    if not exists (
      select 1
      from public.client_site_page_versions
      where page_id = v_page.id
        and version_kind = 'base'
    ) then
      insert into public.client_site_page_versions (
        page_id, version_kind, content_json, updated_by
      )
      select
        v_page.id,
        'base',
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