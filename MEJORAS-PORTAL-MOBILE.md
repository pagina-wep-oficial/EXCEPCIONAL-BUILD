# Mejora visual del portal · enfoque celular

Esta actualización es principalmente de interfaz. **No requiere una nueva migración SQL** si la versión final anterior ya está funcionando.

## Cambios para clientes

- Navegación móvil reducida a tres opciones: **Inicio**, **Cotizar** y **Mi cuenta**.
- Se eliminó el menú lateral del portal del cliente.
- Botones, campos y tarjetas tienen áreas táctiles más grandes.
- El panel muestra mensajes sencillos en lugar de información técnica.
- La página de proyecto explica el avance de manera más visual.
- La URL de la página solo aparece cuando el administrador la habilita desde el CRM.
- El perfil personal ya no pide **Nombre del negocio**.
- El perfil ahora solo guarda: nombre, WhatsApp, ubicación general y correo de Google.
- Cada negocio guarda su información dentro de su propio proyecto, permitiendo que una persona tenga varios negocios.
- El ejemplo del WhatsApp es ficticio: `981 123 4567`.
- La ubicación usa `Hopelchén` únicamente como ejemplo.

## Acceso con Google

Los textos propios de Excepcional Build ya no mencionan Supabase.

La pantalla que muestra Google al autorizar una cuenta pertenece a Google. Desde Google Cloud / Google Auth Platform puedes configurar el nombre de la aplicación, logotipo, correo de soporte y dominios autorizados para que aparezca la marca **Excepcional Build**. Los avisos de seguridad que Google genera automáticamente no pueden sustituirse con HTML propio.

## CRM

- En Clientes ya no se muestra `Nombre del negocio` desde el perfil.
- Se muestra la ubicación del cliente y sus proyectos.
- Los negocios se administran como proyectos separados.
- Se mejoró la navegación del CRM en pantallas pequeñas.

## Archivos modificados

- `acceso.html`
- `auth-callback.html`
- `panel.html`
- `perfil.html`
- `proyecto.html`
- `portal.css`
- `portal.js`
- `crm-local.html`
- `crm.css`
- `crm.js`

Para publicar, reemplaza estos archivos en GitHub y deja que Cloudflare Pages haga el nuevo despliegue.
