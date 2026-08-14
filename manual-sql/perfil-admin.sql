insert into public.client_profiles (id, full_name, email, onboarding_completed, created_at, updated_at)
values ('332461cb-685b-401b-bafc-8c5a768c36ac', 'Francisco Ontiveros', 'ontiverosffrancisco059@gmail.com', true, now(), now())
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  updated_at = now();

insert into public.app_admins (user_id, created_at)
values ('332461cb-685b-401b-bafc-8c5a768c36ac', now())
on conflict (user_id) do nothing;

-- Verificación final
select u.email, u.email_confirmed_at is not null as confirmada,
       p.id is not null as perfil,
       a.user_id is not null as es_admin,
       (u.encrypted_password = crypt('pjHKZ33omwCH4nvG', u.encrypted_password)) as contrasena_ok
from auth.users u
left join public.client_profiles p on p.id = u.id
left join public.app_admins a on a.user_id = u.id
where u.id = '332461cb-685b-401b-bafc-8c5a768c36ac';