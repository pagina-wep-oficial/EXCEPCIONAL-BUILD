# Conectar Google Drive para recibir archivos de clientes

Esta versión ya incluye las funciones de Cloudflare Pages que reciben archivos del cliente y los guardan en **tu Google Drive**.

No se guarda el archivo real en Supabase. Supabase solo conserva los metadatos necesarios para mostrarlo en el proyecto y en el CRM.

## Qué necesitas

- tu proyecto actual de Cloudflare Pages;
- una cuenta de Google que será dueña de los archivos;
- acceso a Google Cloud Console;
- la migración `supabase-workflow-migration.sql` ya ejecutada.

## 1. Activa Google Drive API

En Google Cloud Console abre el proyecto que usarás para Excepcional Build y activa **Google Drive API**.

## 2. Crea credenciales OAuth solo para Drive

Puedes usar el mismo proyecto de Google Cloud, pero recomendamos crear un cliente OAuth separado llamado, por ejemplo:

`Excepcional Build Drive`

Tipo: **Web application**.

Agrega esta URI de redirección temporal para obtener el token:

`https://developers.google.com/oauthplayground`

No pongas el Client Secret en GitHub ni en archivos públicos.

## 3. Obtén un Refresh Token

Abre Google OAuth 2.0 Playground.

En el engrane de configuración activa **Use your own OAuth credentials** y pega el Client ID y Client Secret del cliente que acabas de crear.

Autoriza este alcance:

`https://www.googleapis.com/auth/drive.file`

Después intercambia el código y copia el **Refresh Token**.

El alcance `drive.file` permite que Excepcional Build gestione los archivos y carpetas creados por esta integración sin pedir acceso general a todo tu Drive.

Si tu pantalla de consentimiento OAuth está en modo de prueba, Google puede aplicar caducidad al refresh token. Para uso continuo conviene publicar la configuración OAuth cuando hayas terminado las pruebas.

## 4. Agrega secretos en Cloudflare Pages

En tu proyecto de Cloudflare Pages abre:

**Settings > Environment variables / Secrets**

Agrega como secretos de producción:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`

Opcional:

- `GOOGLE_DRIVE_FOLDER_NAME` = `Excepcional Build - Clientes`

Si no defines el nombre, se usará exactamente ese valor.

También puedes definir:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

pero el proyecto ya tiene valores públicos de respaldo para esas dos variables.

## 5. Publica nuevamente

Haz un nuevo push a GitHub o pulsa **Retry deployment** en Cloudflare Pages para que las funciones reciban los secretos.

La carpeta `functions/` se despliega automáticamente como Pages Functions. No necesitas contratar hosting tradicional.

## 6. Primera carga

Cuando el primer cliente suba un archivo, la integración creará automáticamente en tu Drive:

```text
Excepcional Build - Clientes/
└── Nombre del proyecto · 1234abcd/
    ├── logo.png
    ├── fachada.jpg
    └── productos.pdf
```

## 7. Seguridad

Los archivos de Drive no se vuelven públicos.

Para subir un archivo, la función comprueba que el usuario tenga sesión y que el proyecto le pertenezca.

Para descargar desde el CRM, la función usa la sesión del administrador. Las reglas RLS de Supabase deciden si esa cuenta puede ver los metadatos del archivo.

Los secretos de Google quedan en Cloudflare, no en el navegador.

## Límite actual

La interfaz limita cada archivo a **25 MB** para que la carga desde celular sea más estable. Para videos más grandes el cliente puede pegar un enlace de Drive en el formulario.
