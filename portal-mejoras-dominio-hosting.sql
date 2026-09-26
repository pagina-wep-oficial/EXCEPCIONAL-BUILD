alter table public.client_project_setup
  add column if not exists offer_domain_enabled boolean not null default false,
  add column if not exists offer_domain_price numeric(12,2),
  add column if not exists offer_domain_note text,
  add column if not exists offer_hosting_enabled boolean not null default false,
  add column if not exists offer_hosting_price numeric(12,2),
  add column if not exists offer_hosting_note text;
