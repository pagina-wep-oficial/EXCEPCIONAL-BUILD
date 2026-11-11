# Reporte: historial de versiones beta del editor

## Objetivo

Incorporar historial de publicaciones recuperables durante siete días para las páginas y medios administrados por el Editor V2, sin exponer R2 ni alterar borradores normales durante una revisión.

## Implementado

- Índice de versiones, manifiestos privados R2 y archivos archivados con hash SHA-256.
- Vista de medios históricos mediante URL firmada de diez minutos.
- Plan de restauración por proyecto y publicación de restauración mediante un commit atómico de GitHub.
- Revisión histórica aislada: consultar una versión no escribe en `client_site_repo_drafts`.
- Cancelación segura de una recuperación y protección contra reemplazar un plan activo.
- Limpieza diaria de versiones vencidas, pendientes abandonadas y protección de restauraciones activas.
- Reintentos sin commit GitHub duplicado si el árbol publicado ya coincide con la restauración.
- Conservación del respaldo R2 si falla Supabase después de que GitHub acepte el commit.

## Archivos principales

- `editor-v2.html`, `editor-v2.css`, `editor-v2.js`
- `functions/api/editor-versions.js`
- `functions/api/editor-version-asset/[[path]].js`
- `functions/api/editor-repo-publish.js`
- `functions/_lib/editor-version-storage.js`
- `functions/_lib/editor-versions.js`
- `functions/_lib/editor-restore-plans.js`
- `functions/_lib/editor-version-preview.js`
- `workers/editor-version-storage-bridge.js`
- `workers/editor-version-cleaner.js`
- `editor-history-r2.sql`
- `CONFIGURAR-HISTORIAL-R2.md`

## Validación realizada

```bash
node --check editor-v2.js
node --check functions/_lib/editor-restore-plans.js
node --check functions/_lib/editor-versions.js
node --check functions/_lib/editor-version-preview.js
node --check functions/api/editor-versions.js
node --check functions/api/editor-version-asset/[[path]].js
node --check functions/api/editor-repo-publish.js
node --check workers/editor-version-storage-bridge.js
node --check workers/editor-version-cleaner.js
git diff --check
```

Todas las comprobaciones anteriores terminaron sin errores.

## Pendiente de integración

- Ejecutar `editor-history-r2.sql` en Supabase.
- Crear el bucket R2, desplegar el puente y el limpiador, y configurar sus secretos.
- Configurar los secretos de Pages y desplegar la rama.
- Probar publicación, recuperación, cancelación, restauración y expiración controlada.

## No realizado

- No se ejecutó SQL en Supabase.
- No se configuraron secretos externos.
- No se hizo commit, push ni despliegue.
