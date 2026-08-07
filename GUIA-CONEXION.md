# Conectar el portal de Excepcional Build

## Qué ya está construido

- Acceso con Google mediante Supabase Auth.
- Confirmación de nombre completo y WhatsApp.
- Panel privado del cliente.
- Creación de un proyecto desde la cotización.
- Detalle de proyecto, cotización, avances y solicitudes.
- Botones de mantenimiento, actualización, cambios, dominio y hosting.
- Registro de solicitudes en Supabase y apertura de WhatsApp al 981 133 2914.
- Seguridad RLS para que cada cliente solo vea sus propios registros.

## 1. Crear las tablas en Supabase

1. Abre tu proyecto de Supabase.
2. Entra en **SQL Editor**.
3. Abre `supabase-schema.sql`, copia todo y pulsa **Run**.
4. Confirma que aparezcan las tablas `client_profiles`, `client_projects`, `client_quotes`, `client_requests` y `client_updates`.

El archivo no elimina las tablas que ya tienes. Usa nombres `client_*` para evitar conflictos.

## 2. Colocar la clave pública

1. En Supabase abre **Project Settings > API Keys**.
2. Copia la clave **Publishable** o la clave pública **anon**.
3. Abre `supabase-config.js`.
4. Sustituye `PEGA_AQUI_TU_CLAVE_PUBLICA_ANON_O_PUBLISHABLE`.

La URL de tu proyecto ya está escrita. La clave pública puede estar en el sitio porque las tablas están protegidas con RLS.

**Nunca coloques aquí:** `service_role`, secret key, JWT secret, contraseña de base de datos ni el Client Secret de Google.

## 3. Activar Google

### En Supabase

1. Abre **Authentication > Sign In / Providers > Google**.
2. Copia la URL callback que Supabase muestra. Tendrá una forma parecida a:
   `https://TU-PROYECTO.supabase.co/auth/v1/callback`

### En Google Cloud / Google Auth Platform

1. Usa la misma cuenta de Google que ya tienes iniciada.
2. Crea o selecciona un proyecto.
3. Configura la pantalla de consentimiento con el nombre **Excepcional Build**.
4. En Data Access conserva `openid`, correo y perfil.
5. Crea un cliente OAuth de tipo **Web application**.
6. En **Authorized JavaScript origins** agrega:
   - `https://excepcional-build.pages.dev`
   - Tu dominio propio cuando lo tengas.
   - Para pruebas locales: `http://localhost:8000`
7. En **Authorized redirect URIs** pega la URL callback que te dio Supabase.
8. Copia el Client ID y Client Secret en el proveedor Google de Supabase y actívalo.

El Client Secret se guarda en Supabase, nunca en GitHub.

## 4. Configurar las redirecciones de Supabase

En **Authentication > URL Configuration**:

- Site URL: `https://excepcional-build.pages.dev`
- Redirect URLs:
  - `https://excepcional-build.pages.dev/auth-callback.html`
  - `http://localhost:8000/auth-callback.html`
  - Agrega la misma ruta con tu dominio propio cuando lo conectes.

## 5. Subir a GitHub

1. Haz una copia o rama antes de reemplazar archivos.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. Confirma que no subiste claves secretas.
4. Haz commit y push a `main`.

GitHub conserva el historial. Si alguna clave secreta se subió alguna vez, borrarla en un commit nuevo no basta: debes revocarla y generar otra.

## 6. Cloudflare Pages

Tu proyecto puede seguir siendo un sitio estático, sin contratar hosting adicional.

- Repositorio: el mismo de GitHub.
- Rama de producción: `main`.
- Framework preset: `None`.
- Build command: déjalo vacío.
- Build output directory: `/` o la raíz, según la configuración actual del proyecto.

Cada push nuevo a GitHub generará un despliegue automático en Cloudflare Pages.

## 7. Prueba completa

1. Abre `cotizar.html`.
2. Prepara una cotización y pulsa **Guardar mi cotización y continuar**.
3. Accede con Google.
4. Confirma nombre y WhatsApp.
5. Comprueba que se crea el proyecto en el panel.
6. Abre el proyecto y registra una solicitud.
7. Comprueba en Supabase que los registros aparecen en las tablas `client_*`.
8. Crea otra cuenta de prueba y confirma que no puede ver los proyectos de la primera.

## Qué falta configurar manualmente

- Pegar la clave pública de Supabase.
- Ejecutar el SQL.
- Crear el cliente OAuth de Google y pegar sus credenciales en Supabase.
- Añadir las URLs autorizadas.
- Subir los archivos a GitHub.
- Esperar el despliegue de Cloudflare Pages.

No hace falta contratar hosting tradicional para este portal: Cloudflare Pages publica los HTML, CSS y JavaScript; Supabase guarda cuentas, proyectos y solicitudes.
