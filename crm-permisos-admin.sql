begin;

alter table public.crm_miembros
  add column if not exists permisos jsonb not null default '{}'::jsonb;

drop function if exists public.crm_listar_usuarios();
drop function if exists public.crm_agregar_usuario(text,text,text);
drop function if exists public.crm_registrar_usuario(text,text);
drop function if exists public.crm_actualizar_usuario(text,text,boolean);
drop function if exists public.crm_eliminar_usuario(text);

create or replace function public.crm_default_permissions(p_rol text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case lower(coalesce(p_rol,''))
    when 'administrador' then jsonb_build_object(
      'dashboard', true,
      'prospects', true,
      'invited', true,
      'clients', true,
      'projects', true,
      'project_admin', true,
      'editor_any', true,
      'storage_cleanup', true,
      'requests', true,
      'users', true,
      'settings', true,
      'trash', true
    )
    else jsonb_build_object(
      'dashboard', true,
      'prospects', true,
      'invited', false,
      'clients', false,
      'projects', false,
      'project_admin', false,
      'editor_any', false,
      'storage_cleanup', false,
      'requests', false,
      'users', false,
      'settings', false,
      'trash', true
    )
  end;
$$;

create or replace function public.crm_normalize_permissions(
  p_rol text,
  p_permisos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v jsonb := public.crm_default_permissions(p_rol) || coalesce(p_permisos,'{}'::jsonb);
  v_projects boolean := coalesce((v->>'projects')::boolean,false);
  v_project_admin boolean := coalesce((v->>'project_admin')::boolean,false);
begin
  if lower(coalesce(p_rol,'')) <> 'administrador' then
    return public.crm_default_permissions('asesor');
  end if;

  if not v_projects then
    v := jsonb_set(v,'{project_admin}','false'::jsonb,true);
    v := jsonb_set(v,'{editor_any}','false'::jsonb,true);
    v := jsonb_set(v,'{storage_cleanup}','false'::jsonb,true);
  elsif not v_project_admin then
    v := jsonb_set(v,'{editor_any}','false'::jsonb,true);
    v := jsonb_set(v,'{storage_cleanup}','false'::jsonb,true);
  end if;

  return v;
end;
$$;

create or replace function public.crm_can_manage_users()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.crm_miembros m
    where m.usuario_id = auth.uid()
      and m.activo
      and lower(coalesce(m.rol,'')) = 'administrador'
      and coalesce((public.crm_normalize_permissions(m.rol, m.permisos)->>'users')::boolean,false)
  )
  or (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
    and not exists (select 1 from public.crm_miembros m where m.usuario_id = auth.uid())
  );
$$;

create or replace function public.crm_sync_app_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_active boolean;
  v_permisos jsonb;
  v_allow boolean := false;
begin
  select m.rol, m.activo, m.permisos
    into v_rol, v_active, v_permisos
  from public.crm_miembros m
  where m.usuario_id = p_user_id
  limit 1;

  v_permisos := public.crm_normalize_permissions(v_rol, v_permisos);

  v_allow := coalesce(v_active,false)
    and lower(coalesce(v_rol,'')) = 'administrador'
    and (
      coalesce((v_permisos->>'projects')::boolean,false)
      or coalesce((v_permisos->>'project_admin')::boolean,false)
      or coalesce((v_permisos->>'editor_any')::boolean,false)
    );

  if v_allow then
    insert into public.app_admins(user_id)
    values (p_user_id)
    on conflict do nothing;
  else
    delete from public.app_admins
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.crm_listar_usuarios()
returns table (
  user_id uuid,
  email text,
  nombre text,
  rol text,
  activo boolean,
  permisos jsonb,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email::text,
    (select p.full_name from public.client_profiles p where p.id = u.id)::text as nombre,
    coalesce(
      (select m.rol from public.crm_miembros m where m.usuario_id = u.id limit 1),
      case when exists(select 1 from public.app_admins a where a.user_id = u.id) then 'administrador' end
    ) as rol,
    coalesce(
      (select m.activo from public.crm_miembros m where m.usuario_id = u.id),
      exists(select 1 from public.app_admins a where a.user_id = u.id)
    ) as activo,
    public.crm_normalize_permissions(
      coalesce(
        (select m.rol from public.crm_miembros m where m.usuario_id = u.id limit 1),
        case when exists(select 1 from public.app_admins a where a.user_id = u.id) then 'administrador' end
      ),
      (select m.permisos from public.crm_miembros m where m.usuario_id = u.id limit 1)
    ) as permisos,
    u.created_at
  from auth.users u
  where exists (select 1 from public.app_admins a where a.user_id = u.id)
     or exists (select 1 from public.crm_miembros m where m.usuario_id = u.id)
  order by u.created_at desc;
$$;

create or replace function public.crm_mi_perfil()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rol text;
  v_activo boolean;
  v_permisos jsonb;
begin
  select m.rol, m.activo, m.permisos
    into v_rol, v_activo, v_permisos
  from public.crm_miembros m
  where m.usuario_id = auth.uid()
  limit 1;

  if coalesce(v_activo,false) then
    v_permisos := public.crm_normalize_permissions(v_rol, v_permisos);
    return jsonb_build_object('rol', v_rol, 'permisos', v_permisos);
  end if;

  if exists(select 1 from public.app_admins a where a.user_id = auth.uid()) then
    return jsonb_build_object(
      'rol', 'administrador',
      'permisos', public.crm_default_permissions('administrador')
    );
  end if;

  return null;
end;
$$;

create or replace function public.crm_agregar_usuario(
  p_email text,
  p_nombre text,
  p_rol text,
  p_permisos jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_rol text;
  v_nombre text;
  v_permisos jsonb;
begin
  if not public.crm_can_manage_users() then
    raise exception 'Sin permisos para administrar usuarios';
  end if;

  v_rol := lower(trim(p_rol));
  if v_rol not in ('administrador','asesor') then
    raise exception 'Rol inválido';
  end if;

  v_nombre := trim(p_nombre);
  if v_nombre = '' then
    raise exception 'Escribe el nombre de la persona';
  end if;

  select id into v_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_id is null then
    return 'NO_EXISTE';
  end if;

  v_permisos := public.crm_normalize_permissions(v_rol, coalesce(p_permisos, '{}'::jsonb));

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = v_id;

  insert into public.client_profiles (id, full_name, email, onboarding_completed)
  values (v_id, v_nombre, (select email from auth.users where id = v_id), true)
  on conflict (id) do update
    set full_name = excluded.full_name
  where public.client_profiles.full_name is null
     or public.client_profiles.full_name = '';

  insert into public.crm_miembros (usuario_id, rol, activo, permisos)
  values (v_id, v_rol, true, v_permisos)
  on conflict (usuario_id) do update
    set rol = excluded.rol,
        activo = true,
        permisos = excluded.permisos;

  perform public.crm_sync_app_admin(v_id);
  return 'OK';
end;
$$;

create or replace function public.crm_registrar_usuario(
  p_email text,
  p_rol text,
  p_permisos jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  if not public.crm_can_manage_users() then
    raise exception 'Sin permisos para administrar usuarios';
  end if;

  select coalesce(
    nullif(trim((select p.full_name from public.client_profiles p where p.id = u.id)),''),
    split_part(lower(trim(p_email)),'@',1)
  )
  into v_nombre
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_nombre is null then
    return 'NO_EXISTE';
  end if;

  return public.crm_agregar_usuario(p_email, v_nombre, p_rol, p_permisos);
end;
$$;

create or replace function public.crm_actualizar_usuario(
  p_email text,
  p_rol text,
  p_activo boolean,
  p_permisos jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_prev_permisos jsonb;
  v_rol text;
  v_permisos jsonb;
begin
  if not public.crm_can_manage_users() then
    raise exception 'Sin permisos para administrar usuarios';
  end if;

  select id into v_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_id is null then
    raise exception 'Usuario no encontrado';
  end if;

  v_rol := lower(trim(p_rol));
  if v_rol not in ('administrador','asesor') then
    raise exception 'Rol inválido';
  end if;

  select m.permisos into v_prev_permisos
  from public.crm_miembros m
  where m.usuario_id = v_id;

  v_permisos := public.crm_normalize_permissions(
    v_rol,
    coalesce(p_permisos, v_prev_permisos, '{}'::jsonb)
  );

  insert into public.crm_miembros (usuario_id, rol, activo, permisos)
  values (v_id, v_rol, coalesce(p_activo,true), v_permisos)
  on conflict (usuario_id) do update
    set rol = excluded.rol,
        activo = excluded.activo,
        permisos = excluded.permisos;

  perform public.crm_sync_app_admin(v_id);
  return 'OK';
end;
$$;

create or replace function public.crm_eliminar_usuario(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.crm_can_manage_users() then
    raise exception 'Sin permisos para administrar usuarios';
  end if;

  select id into v_id
  from auth.users
  where lower(email) = lower(trim(p_email));

  if v_id is null then
    return 'OK';
  end if;

  delete from public.crm_miembros where usuario_id = v_id;
  delete from public.app_admins where user_id = v_id;
  return 'OK';
end;
$$;

update public.crm_miembros
set permisos = public.crm_normalize_permissions(rol, permisos);

do $$
declare
  r record;
begin
  for r in select usuario_id from public.crm_miembros loop
    perform public.crm_sync_app_admin(r.usuario_id);
  end loop;
end $$;

grant execute on function public.crm_default_permissions(text) to authenticated;
grant execute on function public.crm_normalize_permissions(text,jsonb) to authenticated;
grant execute on function public.crm_can_manage_users() to authenticated;
grant execute on function public.crm_sync_app_admin(uuid) to authenticated;
grant execute on function public.crm_listar_usuarios() to authenticated;
grant execute on function public.crm_mi_perfil() to authenticated;
grant execute on function public.crm_agregar_usuario(text,text,text,jsonb) to authenticated;
grant execute on function public.crm_registrar_usuario(text,text,jsonb) to authenticated;
grant execute on function public.crm_actualizar_usuario(text,text,boolean,jsonb) to authenticated;
grant execute on function public.crm_eliminar_usuario(text) to authenticated;

commit;