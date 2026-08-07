# Excepcional Build

Sitio público + portal de clientes + CRM administrativo.

## Infraestructura

- GitHub: código e historial.
- Cloudflare Pages: publicación del sitio y Pages Functions.
- Supabase: autenticación, prospectos, clientes, proyectos y metadatos.
- Google Drive: archivos reales de los proyectos.

## Flujo

`Prospecto → Invitado → Cliente → Configuración → Información → Producción → Revisión → Publicado`

Lee en este orden:

1. `GUIA-VERSION-FINAL.md`
2. `FLUJO-COMERCIAL.md`
3. `CONFIGURAR-GOOGLE-DRIVE.md`

## Archivos privados del cliente

- `acceso.html`
- `panel.html`
- `perfil.html`
- `proyecto.html`
- `cotizar.html` (configuración de un proyecto aceptado)

## Administración

- `crm-local.html`

## Base de datos

- `supabase-workflow-migration.sql`: actualización desde la versión anterior.
- `supabase-schema.sql`: instalación completa.

Nunca publiques secretos de Google, `service_role`, contraseña de base de datos ni JWT secret.
