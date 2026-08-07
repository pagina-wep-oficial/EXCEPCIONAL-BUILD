# Excepcional Build · sitio + cotizador + portal + CRM

Proyecto estático publicado con Cloudflare Pages y respaldado en GitHub. Supabase se usa para autenticación y datos.

## Páginas públicas
- `index.html`
- `cotizar.html`

## Portal del cliente
- `acceso.html`
- `auth-callback.html`
- `panel.html`
- `proyecto.html`
- `perfil.html`

## Administración
- `crm-local.html`

## Configuración
- `supabase-config.js` contiene únicamente la URL y clave pública del navegador.
- `supabase-final-migration.sql` actualiza una instalación existente.
- `supabase-schema.sql` sirve como esquema completo para una instalación nueva.

Lee `GUIA-VERSION-FINAL.md` antes de publicar esta actualización.
