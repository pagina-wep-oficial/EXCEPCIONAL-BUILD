# Reporte: historial operable del editor

## Objetivo
Hacer que el historial de publicaciones sea claro y útil: recuperar una versión, revisarla, editar texto o enlaces temporalmente, publicarla como una versión nueva o cancelarla sin afectar el sitio ni los borradores normales.

## Archivos cambiados
- `editor-v2.html`
- `editor-v2.js`
- `functions/api/editor-repo-publish.js`
- `CAMBIO_editor_historial_operable.md`
- `REPORTE_CAMBIO_editor_historial_operable.md`

## Cambios realizados
- El panel de Elemento activo se actualiza con el contenido realmente publicado.
- El historial muestra números de versión estables y la posición disponible dentro de la retención.
- Las confirmaciones nativas fueron sustituidas por el modal propio del editor.
- Recuperar una versión abre una copia temporal.
- En una copia temporal se permite editar texto y enlaces; imágenes y videos históricos se conservan sin modificación.
- Guardar borrador no escribe una recuperación temporal en los borradores normales.
- Cancelar recuperación descarta la copia temporal y vuelve a los borradores normales.
- Publicar una recuperación crea una nueva versión, conserva los medios históricos y actualiza el sitio.
- La publicación normal y la restauración usan un único commit atómico de GitHub.

## Datos e infraestructura
- No se agregaron migraciones.
- No se requieren cambios en Supabase, Neon, R2 ni Workers.
- Se reutiliza la infraestructura de historial ya configurada.

## Riesgos controlados
- Una recuperación no puede sobrescribir borradores normales antes de publicar.
- Si se cancela, los cambios temporales desaparecen.
- Si GitHub rechaza actualizar la rama, no se publica un conjunto parcial de archivos.
- Los medios históricos de una recuperación permanecen iguales; no se permite reemplazarlos durante la revisión temporal.

## Validación estática
Pendiente de ejecutar antes del commit:
- `node --check editor-v2.js`
- `node --check functions/api/editor-repo-publish.js`
- `node --check functions/api/editor-versions.js`
- `node --check functions/_lib/editor-versions.js`
- `node --check functions/_lib/editor-restore-plans.js`
- `git diff --check`

## Prueba en línea pendiente
1. Publicar un cambio normal de texto y comprobar Elemento activo.
2. Recuperar una versión histórica, editar texto, publicar y comprobar que aparece una versión nueva.
3. Recuperar otra versión, editarla y cancelarla; comprobar que no cambia el sitio ni los borradores.
4. Confirmar que imágenes y videos históricos se conservan en la versión recuperada.
