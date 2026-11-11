# Reporte: sesión resiliente y modales del editor

## Objetivo
Evitar errores genéricos cuando una pestaña del editor permanece abierta y la sesión expira; asegurar que las confirmaciones del historial aparezcan sobre el modal de historial.

## Cambios realizados
- Se centralizaron las solicitudes privadas del editor en `editorApiFetch`.
- Cada solicitud usa la sesión vigente y reintenta una vez tras renovar la sesión.
- Si no se puede renovar, se guarda el borrador no publicado de la pestaña en `sessionStorage`.
- Al iniciar sesión de nuevo, el editor recupera ese borrador únicamente para el mismo usuario, proyecto y plan de recuperación.
- Se añadió un modal propio de sesión vencida.
- Se eliminaron avisos genéricos para errores de sesión vencida.
- Las acciones Recuperar, Cancelar recuperación, Borrar versión, guardar borrador, salir y publicar respetan el nuevo manejo de sesión.
- Se definieron capas explícitas para los modales: la confirmación de Recuperar aparece sobre el historial y este queda inactivo mientras se confirma.
- Se bloquean temporalmente Recuperar y Borrar mientras una recuperación está en proceso.

## Archivos modificados
- `editor-v2.js`
- `editor-v2.html`
- `editor-v2.css`
- `CAMBIO_sesion_y_modales_editor.md`

## Validaciones realizadas
- `node --check editor-v2.js`
- `git diff --check`
- Verificación de que no quedan encabezados manuales con tokens de sesión.
- Verificación de que no quedan solicitudes privadas a `/api` fuera de `editorApiFetch`.

## No realizado
- No se modificaron Supabase, R2, GitHub ni Workers.
- Falta validación funcional en producción después de publicar.
