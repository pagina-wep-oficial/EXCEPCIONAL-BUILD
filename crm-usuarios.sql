create or replace function public.mi_rol_crm()
returns text language sql stable security definer set search_path = ''
as $function$
  select case
    when exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then 'administrador'
    when exists (select 1 from public.crm_miembros m where m.usuario_id = auth.uid() and m.activo = true) then (select m2.rol from public.crm_miembros m2 where m2.usuario_id = auth.uid() and m2.activo = true limit 1)
    else null
  end;
$function$;

create or replace function public.crm_listar_usuarios()
returns table (user_id uuid, email text, rol text, activo boolean, creado_en timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select u.id, u.email::text,
    coalesce((select m.rol from public.crm_miembros m where m.usuario_id = u.id), 'cliente'),
    coalesce((select m.activo from public.crm_miembros m where m.usuario_id = u.id), true),
    u.created_at
  from auth.users u
  where exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  order by u.created_at desc;
$function$;

create or replace function public.crm_registrar_usuario(p_email text, p_rol text)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid; v_rol text;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Sin permisos de administrador';
  end if;
  v_rol := lower(trim(p_rol));
  if v_rol not in ('administrador','asesor') then raise exception 'Rol invalido'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then return 'NO_EXISTE'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_id;
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

create or replace function public.crm_actualizar_usuario(p_email text, p_rol text, p_activo boolean)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid; v_rol text;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Sin permisos de administrador';
  end if;
  v_rol := lower(trim(p_rol));
  if v_rol not in ('administrador','asesor','cliente') then raise exception 'Rol invalido'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then return 'NO_EXISTE'; end if;
  if v_rol = 'cliente' then
    delete from public.crm_miembros where usuario_id = v_id;
    delete from public.app_admins where user_id = v_id;
    return 'OK';
  end if;
  insert into public.crm_miembros (usuario_id, rol, activo) values (v_id, v_rol, p_activo)
    on conflict (usuario_id) do update set rol = excluded.rol, activo = excluded.activo;
  if v_rol = 'administrador' then
    insert into public.app_admins (user_id) values (v_id) on conflict do nothing;
  else
    delete from public.app_admins where user_id = v_id;
  end if;
  return 'OK';
end;
$function$;

create or replace function public.crm_eliminar_usuario(p_email text)
returns text language plpgsql security definer set search_path = ''
as $function$
declare v_id uuid;
begin
  if not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Sin permisos de administrador';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then return 'NO_EXISTE'; end if;
  if v_id = auth.uid() then raise exception 'No puedes eliminar tu propia cuenta de administrador'; end if;
  delete from public.crm_miembros where usuario_id = v_id;
  delete from public.app_admins where user_id = v_id;
  return 'OK';
end;
$function$;

grant execute on function public.mi_rol_crm() to authenticated;
grant execute on function public.crm_listar_usuarios() to authenticated;
grant execute on function public.crm_registrar_usuario(text, text) to authenticated;
grant execute on function public.crm_actualizar_usuario(text, text, boolean) to authenticated;
grant execute on function public.crm_eliminar_usuario(text) to authenticated;