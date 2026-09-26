insert into storage.buckets (id, name, public)
values ('site-videos', 'site-videos', true)
on conflict (id) do update set public = true;

drop policy if exists "site_videos_public_read" on storage.objects;
create policy "site_videos_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'site-videos');

drop policy if exists "site_videos_insert_owner" on storage.objects;
create policy "site_videos_insert_owner"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-videos'
  and (storage.foldername(name))[1] is not null
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);

drop policy if exists "site_videos_update_owner" on storage.objects;
create policy "site_videos_update_owner"
on storage.objects for update
to authenticated
using (
  bucket_id = 'site-videos'
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);

drop policy if exists "site_videos_delete_owner" on storage.objects;
create policy "site_videos_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'site-videos'
  and (storage.foldername(name))[1] in (
    select p.id::text
    from public.client_projects p
    where p.user_id = auth.uid() or public.is_app_admin()
  )
);
