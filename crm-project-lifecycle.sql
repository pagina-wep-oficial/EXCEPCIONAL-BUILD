-- Guarda el estado de un proyecto antes de cancelarlo o descontinuarlo.
-- Ejecutar una vez en el SQL Editor de Supabase antes de desplegar crm.js.
begin;

alter table public.client_projects
  add column if not exists lifecycle_previous_stage text,
  add column if not exists lifecycle_previous_status text,
  add column if not exists lifecycle_archived_at timestamptz,
  add column if not exists lifecycle_archive_reason text;

commit;
