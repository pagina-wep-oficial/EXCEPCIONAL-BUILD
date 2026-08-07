# Excepcional Build — sitio y portal de clientes

Sitio estático publicado con Cloudflare Pages y conectado a Supabase para autenticación y datos.

## Archivos principales

- `index.html`: portada pública.
- `cotizar.html`: cotizador y entrada al portal.
- `acceso.html`: acceso con Google y confirmación del perfil.
- `panel.html`: proyectos del cliente.
- `proyecto.html`: detalle, avances y solicitudes.
- `perfil.html`: datos del cliente.
- `portal.js` y `portal.css`: lógica y diseño del portal.
- `supabase-client.js`: inicialización segura del cliente público.
- `supabase-config.js`: URL y clave pública.
- `supabase-schema.sql`: tablas y políticas RLS.
- `GUIA-CONEXION.md`: instrucciones completas.
- `crm-local.html`: CRM privado de Excepcional Build; permanece separado del portal de clientes.

## Antes de publicar

1. Ejecuta `supabase-schema.sql` en Supabase.
2. Configura Google Auth.
3. Pega la clave pública en `supabase-config.js`.
4. Sigue `GUIA-CONEXION.md`.

Nunca publiques la clave `service_role`, el Client Secret de Google ni contraseñas de base de datos.
