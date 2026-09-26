-- Bucket público de imágenes del editor de sitios (site-images).
-- Ejecutar en el SQL editor de Supabase. Idempotente: puede re-ejecutarse.

insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update set public = true;

-- Lectura pública: cualquier visitante puede ver las fotos del sitio.
drop policy if exists "site_images_public_read" on storage.objects;
create policy "site_images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'site-images');

-- Subida: el cliente dueño del proyecto (ruta <project_id>/...) o un administrador.
drop policy if exists "site_images_insert_owner" on storage.objects;
create policy "site_images_insert_owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-images'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);

-- Actualizar (reemplazar foto): mismo dueño o administrador.
drop policy if exists "site_images_update_owner" on storage.objects;
create policy "site_images_update_owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'site-images'
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);

-- Borrar (reemplazar foto): mismo dueño o administrador.
drop policy if exists "site_images_delete_owner" on storage.objects;
create policy "site_images_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'site-images'
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);