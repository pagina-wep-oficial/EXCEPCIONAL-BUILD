select 'users' as dnd, count(*) from auth.users where id = '332461cb-685b-401b-bafc-8c5a768c36ac'
union all select 'identities', count(*) from auth.identities where user_id = '332461cb-685b-401b-bafc-8c5a768c36ac'
union all select 'profiles', count(*) from public.client_profiles where id = '332461cb-685b-401b-bafc-8c5a768c36ac'
union all select 'app_admins', count(*) from public.app_admins where user_id = '332461cb-685b-401b-bafc-8c5a768c36ac';