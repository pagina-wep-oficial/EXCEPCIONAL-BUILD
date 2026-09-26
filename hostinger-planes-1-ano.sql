-- ============================================================
-- PLANES DE HOSTING HOSTINGER - PRECIOS OFICIALES 12 MESES (MXN)
-- Capturados de https://www.hostinger.com/mx/precios (hoy)
-- Valor para el negocio: se ofrecen al cliente como paquetes de
-- hosting de 1 ano junto con la creacion del sitio.
-- Reemplaza el plan semilla erroneo (899/1299) y agrega Business.
-- Idempotente: puede ejecutarse las veces que sea necesario.
-- ============================================================

-- PREMIUM (3 sitios web, dominio gratis 1er ano)
INSERT INTO client_hosting_plans
  (id, name, description, features, first_year, renewal, currency, period_months, active, sort_order, created_at)
VALUES
  ('hostinger-premium',
   'Hostinger Premium',
   'Hosting de 1 ano con dominio gratis el primer ano. Ideal para el sitio de un negocio local: 3 sitios web, 20 GB SSD, respaldos semanales, correo empresarial de cortesia.',
   '["Dominio gratis durante 1 ano","3 sitios web","20 GB de almacenamiento SSD","Respaldos semanales gratis","CDN incluido","2 buzones de correo por sitio gratis 1 ano","Email marketing con IA"]'::jsonb,
   575.88, 1799.88, 'MXN', 12, true, 10, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  first_year = EXCLUDED.first_year,
  renewal = EXCLUDED.renewal,
  currency = EXCLUDED.currency,
  period_months = EXCLUDED.period_months,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

-- BUSINESS (50 sitios web, dominio gratis 1er ano)
INSERT INTO client_hosting_plans
  (id, name, description, features, first_year, renewal, currency, period_months, active, sort_order, created_at)
VALUES
  ('hostinger-business',
   'Hostinger Business',
   'Hosting de 1 ano con dominio gratis el primer ano. Para negocios que crecen: 50 sitios web, 50 GB SSD, respaldos semanales, correo empresarial y CDN.',
   '["Dominio gratis durante 1 ano","50 sitios web","50 GB de almacenamiento SSD","Respaldos semanales gratis","CDN incluido","5 buzones de correo por sitio gratis 1 ano","Email marketing con IA"]'::jsonb,
   827.88, 3599.88, 'MXN', 12, true, 20, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  first_year = EXCLUDED.first_year,
  renewal = EXCLUDED.renewal,
  currency = EXCLUDED.currency,
  period_months = EXCLUDED.period_months,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- PRECIOS DE REFERENCIA (para cotizar por WhatsApp):
-- Starter 12m: 395.88 / renov. 1,079.88
-- Premium 12m: 575.88 / renov. 1,799.88  <-- recomendado
-- Business 12m: 827.88 / renov. 3,599.88
-- Cloud 12m: 959.88 / renov. 3,959.88
-- Dominios (1er ano / renovacion):
--   .com: primer ano 0.01 / renov. 329.99
--   .mx: primer ano 99.99 / renov. 816.99
-- ============================================================