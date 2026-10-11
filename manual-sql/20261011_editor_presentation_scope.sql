-- El editor visual solo abre los HTML declarados aquí.
alter table public.client_projects
  add column if not exists site_editor_pages jsonb
  not null
  default '["index.html"]'::jsonb;

-- Configuración real de Fonda Mexicana:
-- repo/dist/index.html será la única página editable.
update public.client_projects
set
  site_repo_path = 'dist',
  site_editor_pages = '["index.html"]'::jsonb,
  updated_at = now()
where id = '872beea0-6c4d-4a7a-b572-9772bbd2c7e5';
