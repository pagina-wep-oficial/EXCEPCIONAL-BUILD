-- Editor autogestionable
-- Ejecuta este archivo en Supabase SQL Editor.

alter table client_projects
add column if not exists editor_enabled boolean default false,
add column if not exists editor_access_status text,
add column if not exists editor_access_starts_at timestamptz,
add column if not exists editor_access_ends_at timestamptz,
add column if not exists editor_plan_months integer,
add column if not exists editor_price_mxn numeric(10,2),
add column if not exists editor_launch_url text;

-- Activar 1 mes
-- Reemplaza PROJECT_ID_AQUI
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '1 month',
  editor_plan_months = 1,
  editor_price_mxn = 50
where id = 'PROJECT_ID_AQUI';

-- Activar 3 meses
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '3 months',
  editor_plan_months = 3,
  editor_price_mxn = 140
where id = 'PROJECT_ID_AQUI';

-- Activar 6 meses
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '6 months',
  editor_plan_months = 6,
  editor_price_mxn = 270
where id = 'PROJECT_ID_AQUI';

-- Activar 12 meses
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '12 months',
  editor_plan_months = 12,
  editor_price_mxn = 500
where id = 'PROJECT_ID_AQUI';

-- Cancelar y quitar acceso inmediato
update client_projects
set
  editor_enabled = false,
  editor_access_status = 'cancelado'
where id = 'PROJECT_ID_AQUI';

-- Marcar como vencido manualmente
update client_projects
set
  editor_enabled = false,
  editor_access_status = 'vencido',
  editor_access_ends_at = now()
where id = 'PROJECT_ID_AQUI';

-- Conectar a herramienta externa
-- Usa una URL por proyecto o una URL general con query params.
update client_projects
set
  editor_launch_url = 'https://TU-SITIO-EDITOR.com/?project=PROJECT_ID_AQUI'
where id = 'PROJECT_ID_AQUI';

-- Quitar URL externa y volver a la base interna editor.html
update client_projects
set
  editor_launch_url = null
where id = 'PROJECT_ID_AQUI';

-- Revisar estado actual
select
  id,
  name,
  editor_enabled,
  editor_access_status,
  editor_access_starts_at,
  editor_access_ends_at,
  editor_plan_months,
  editor_price_mxn,
  editor_launch_url
from client_projects
order by created_at desc;
