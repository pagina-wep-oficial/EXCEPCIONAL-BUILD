-- Funciones para el panel de usuarios del CRM (solo cuentas con permisos)
-- Todas SECURITY DEFINER; verifican que el llamante este en app_admins.

drop function if exists public.crm_listar_usuarios();
drop function if exists public.crm_buscar_usuarios(text);
drop function if exists public.crm_agregar_usuario(text,text,text);

-- ===== Listar usuarios con permiso (admin) =====
create or replace function public.crm_listar_usuarios()
returns table (user_id uuid, email text, nombre text, rol text, activo boolean, creado_en timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select u.id, u.email::text,
    (select p.full_name from public.client_profiles p where p.id = u.id)::text,
    case
      when exists (select 1 from public.app_admins a where a.user_id = u.id) then 'administrador'
      else (select m.rol from public.crm_miembros m where m.usuario_id = u.id limit 1)
    end,
    coalesce(
      (select m.activo from public.crm_miembros m where m.usuario_id = u.id),
      exists (select 1 from public.app_admins a where a.user_id = u.id)
    ),
    u.created_at
  from auth.users u
  where exists (select 1 from public.app_admins a where a.user_id = u.id)
     or exists (select 1 from public.crm_miembros m where m.usuario_id = u.id)
  order by u.created_at desc;
$function$;

-- ===== Buscar cuentas por correo (admin) =====
create or replace function public.crm_buscar_usuarios(p_fragmento text)
returns table (user_id uuid, email text, nombre_com text)
language sql stable security definer set search_path = ''
as $function$
  select u.id, u.email::text, (select p.full_name from public.client_profiles p where p.id = u.id)::text
  from auth.users u
  where exists (select 1 from public.app_admins a where a.user_id = auth.uid())
    and (u.email ilike '%' || p_fragmento || '%' or (select p.full_name from public.client_profiles p where p.id = u.id) ilike '%' || p_fragmento || '%')
  order by u.created_at desc
  limit 8;
$function$;

-- ===== Agregar usuario con nombre (admin) =====
create or replace function public.crm_agregar_usuario(p_email text, p_nombre text, p_rol text)
returns text
language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid; v_rol text; v_nombre text;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Sin permisos de administrador';
  end if;
  v_rol := lower(trim(p_rol));
  if v_rol not in ('administrador','asesor') then raise exception 'Rol invalido'; end if;
  v_nombre := trim(p_nombre);
  if v_nombre = '' then raise exception 'Escribe el nombre de la persona'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then return 'NO_EXISTE'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_id;
  insert into public.client_profiles (id, full_name, email, onboarding_completed)
    values (v_id, v_nombre, (select email from auth.users where id = v_id), true)
    on conflict (id) do update set full_name = excluded.full_name
    where client_profiles.full_name is null or client_profiles.full_name = '';
  insert into public.crm_miembros (usuario_id, rol, activo) values (v_id, v_rol, true)
    on conflict (usuario_id) do update set rol = excluded.rol, activo = true;
  if v_rol = 'administrador' then
    insert into public.app_admins (user_id) values (v_id) on conflict do nothing;
  else
    delete from public.app_admins where user_id = v_id;
  end if;
  return 'OK';
end;
$function$;