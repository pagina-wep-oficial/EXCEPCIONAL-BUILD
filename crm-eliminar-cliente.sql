-- Elimina un cliente por completo: perfil, proyectos, páginas, versiones,
-- borradores repo, archivos, solicitudes y fotos del bucket.
-- La cuenta de Google (auth.users) NO se toca: si vuelve a entrar, se le
-- pedirán sus datos y será como un cliente nuevo.
-- Solo administradores. Ejecutar en el SQL editor de Supabase. Idempotente.
--
-- Supabase NO permite borrar storage.objects directamente con SQL
-- ("Use the Storage API instead"). Por eso la función devuelve la lista de
-- rutas de fotos del cliente en 'paths' y el CRM las borra después con
-- supabase.storage.from('site-images').remove(paths) (la política
-- site_images_delete_owner lo permite a administradores).
-- Devuelve texto JSON: {"result":"OK","paths":[...]} o {"result":"NO_EXISTE"}.

create or replace function public.crm_eliminar_cliente(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_proyectos uuid[];
  v_paths text[];
begin
  if not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Sin permisos de administrador';
  end if;

  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    return '{"result":"NO_EXISTE"}';
  end if;

  if v_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;

  v_proyectos := array(
    select id from public.client_projects where user_id = v_id
  );

  -- Rutas de las fotos del editor (bucket site-images, ruta <proyecto>/...) para
  -- que el CRM las borre con la API de Storage (no se permite SQL directo).
  v_paths := array(
    select name
    from storage.objects
    where bucket_id = 'site-images'
      and (storage.foldername(name))[1] = any (
        select v::text from unnest(v_proyectos) v
      )
  );

  -- Dependencias por página (versiones) y por proyecto.
  delete from public.client_site_page_versions
    where page_id in (
      select id from public.client_site_pages
      where project_id = any (v_proyectos)
    );
  delete from public.client_site_pages where project_id = any (v_proyectos);
  delete from public.client_site_repo_drafts where project_id = any (v_proyectos);

  -- Registros por proyecto y por usuario.
  delete from public.client_site_publish_log where project_id = any (v_proyectos);
  delete from public.client_updates where project_id = any (v_proyectos);
  delete from public.client_project_briefs where project_id = any (v_proyectos);
  delete from public.client_project_files where project_id = any (v_proyectos);
  delete from public.client_project_setup where project_id = any (v_proyectos);
  delete from public.client_quotes where project_id = any (v_proyectos);
  delete from public.client_requests where project_id = any (v_proyectos);
  delete from public.client_projects where user_id = v_id;

  -- Accesos y perfil.
  delete from public.crm_miembros where usuario_id = v_id;
  delete from public.app_admins where user_id = v_id;
  delete from public.client_profiles where id = v_id;

  return json_build_object(
    'result', 'OK',
    'paths', coalesce(v_paths, '{}')
  )::text;
end;
$$;