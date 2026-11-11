# Reporte: historial contextual durante recuperación

## Objetivo
Mantener útil y claro el historial mientras una versión recuperada está en revisión.

## Cambios realizados
- El botón Historial cambia a “Recuperación en revisión” cuando existe una recuperación activa.
- El modal continúa mostrando las versiones disponibles.
- Las acciones Recuperar y Borrar se desactivan temporalmente para evitar conflictos.
- Se añadió un panel contextual que explica la recuperación activa.
- El panel permite seguir editando o cancelar la recuperación.
- La cancelación usa la confirmación segura existente y bloquea sus dos botones durante la solicitud.
- Al cancelar correctamente, el historial se actualiza sin cerrarse.

## Archivos modificados
- `editor-v2.html`
- `editor-v2.css`
- `editor-v2.js`
- `CAMBIO_historial_recuperacion_contextual.md`

## Validaciones realizadas
- `node --check editor-v2.js`
- `git diff --check`
- Verificación de controles, estado de solo lectura y listeners.

## No realizado
- No se modificaron APIs, Supabase, R2, GitHub ni Workers.
- Falta prueba funcional tras publicación.
