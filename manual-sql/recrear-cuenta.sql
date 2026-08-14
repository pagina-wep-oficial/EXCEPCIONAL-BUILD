-- 1) Cuenta: recrea con la contraseña original
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_sent_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '332461cb-685b-401b-bafc-8c5a768c36ac',
  'authenticated', 'authenticated',
  'ontiverosffrancisco059@gmail.com',
  crypt('pjHKZ33omwCH4nvG', gen_salt('bf')),
  now(), now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}'
)
on conflict (id) do update set
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = now(),
  updated_at = now();

-- 2) Identidad para el login por correo/contraseña
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '332461cb-685b-401b-bafc-8c5a768c36ac',
  '332461cb-685b-401b-bafc-8c5a768c36ac',
  format('{"sub":"%s","email":"ontiverosffrancisco059@gmail.com","email_verified":true,"phone_verified":false}',
    '332461cb-685b-401b-bafc-8c5a768c36ac')::jsonb,
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;