create extension if not exists pgcrypto;

alter table public.client_projects
  add column if not exists source_system text,
  add column if not exists source_itm_project_id uuid;

create unique index if not exists client_projects_source_itm_project_unique
  on public.client_projects (source_itm_project_id)
  where source_itm_project_id is not null;

create or replace function public.import_itm_finalized_project(
  p_itm_project_id uuid,
  p_name text,
  p_site_url text,
  p_preview_url text,
  p_repo_owner text,
  p_repo_name text,
  p_repo_branch text,
  p_repo_path text,
  p_publish_provider text,
  p_store_admin_url text
)
returns table(project_id uuid, claim_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.client_projects%rowtype;
begin
  select * into v_project
  from public.client_projects
  where source_itm_project_id = p_itm_project_id
  limit 1;

  if found then
    return query select v_project.id, v_project.claim_token;
    return;
  end if;

  insert into public.client_projects (
    user_id, name, status, project_stage, site_visibility, address_type,
    hosting_type, source_system, source_itm_project_id, site_url, preview_url,
    site_live_url, site_repo_owner, site_repo_name, site_repo_branch,
    site_repo_path, site_publish_provider, site_editor_mode, store_enabled,
    store_button_label, store_admin_url, accepted_at, claim_token, client_note
  ) values (
    null, p_name, 'Página lista para revisión', 'Revisión', 'preview', 'gratis',
    'cloudflare', 'itm', p_itm_project_id, p_site_url, p_preview_url,
    p_site_url, p_repo_owner, p_repo_name,
    coalesce(nullif(p_repo_branch, ''), 'main'),
    coalesce(nullif(p_repo_path, ''), '/'),
    case when p_publish_provider in ('github_pages', 'cloudflare_pages')
      then p_publish_provider else 'github_pages' end,
    'html_repo', p_store_admin_url is not null, 'Administrar mi tienda',
    nullif(p_store_admin_url, ''), now(), gen_random_uuid(),
    'Proyecto terminado desde ITM. Precio y método de pago pendientes de configurar.'
  ) returning * into v_project;

  return query select v_project.id, v_project.claim_token;
end;
$$;

revoke all on function public.import_itm_finalized_project(
  uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.import_itm_finalized_project(
  uuid, text, text, text, text, text, text, text, text, text
) to service_role;
