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

1. `FLUJO-COMERCIAL.md`
2. `CONFIGURAR-GOOGLE-DRIVE.md`

Si vas a instalar o migrar base de datos:

3. `supabase-schema.sql`
4. `supabase-workflow-migration.sql`
5. `supabase-final-migration.sql`

## Archivos privados del cliente

- `acceso.html`
- `panel.html`
- `perfil.html`
- `proyecto.html`
- `cotizar.html` (configuración de un proyecto aceptado)

## Administración

- `crm-local.html`

## Base de datos

- `supabase-schema.sql`: instalación completa base + columnas actuales sincronizadas con producción.
- `supabase-workflow-migration.sql`: migración desde la versión anterior.
- `supabase-final-migration.sql`: ajustes posteriores del flujo comercial.

## Documentos vigentes

- `FLUJO-COMERCIAL.md`: flujo real actual del CRM y portal.
- `CONFIGURAR-GOOGLE-DRIVE.md`: conexión de archivos con Drive.
- `editor-autogestionable-manual.sql`: columnas necesarias para el editor si se aplican por separado.
- `crm-usuarios.sql`: funciones RPC del panel de usuarios.

## Notas

- El portal del cliente, el CRM y el flujo comercial ya no deben documentarse en guías viejas separadas.
- Si un `.md` contradice este README o `FLUJO-COMERCIAL.md`, toma como válidos estos archivos actuales.

Nunca publiques secretos de Google, `service_role`, contraseña de base de datos ni JWT secret.
