# Conexiones de Excepcional Build

La arquitectura final es:

- **GitHub**: historial del código.
- **Cloudflare Pages**: publica el sitio y ejecuta las funciones `/api/*`.
- **Supabase**: autenticación y base de datos.
- **Google Drive**: fotografías, videos, logos y documentos de clientes.

Si Supabase y Google Login ya están funcionando, no vuelvas a crearlos.

Para actualizar esta versión:

1. ejecuta `supabase-workflow-migration.sql`;
2. sube los archivos a GitHub;
3. configura Google Drive siguiendo `CONFIGURAR-GOOGLE-DRIVE.md`;
4. deja que Cloudflare Pages vuelva a desplegar el proyecto.
