alter table public.client_projects
  add column if not exists editor_visible_to_client boolean not null default false;
