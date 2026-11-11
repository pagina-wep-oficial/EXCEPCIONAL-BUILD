# Cambio: sesión resiliente y capas de modales del editor

## Objetivo
Evitar errores al usar el editor después de varias horas abierto y hacer que las confirmaciones del historial aparezcan sobre el historial sin obligar a cerrarlo.

## Problemas confirmados
1. El editor conserva `state.session.access_token` desde el arranque y lo reutiliza en peticiones privadas. Si el token vence mientras la pestaña sigue abierta, historial, borradores, recuperación o publicación pueden responder 401/403 y terminar en un error genérico.
2. `#editor-v2-action-confirm` y `#editor-history-modal` usan el mismo `z-index: 200`. Como el historial aparece después en el HTML, cubre la confirmación de recuperación.

## Diseño aprobado
### Sesión
- Toda petición privada del editor obtiene una sesión actualizada antes de enviarse.
- Si una petición devuelve 401, se intenta renovar la sesión una vez y se repite sólo esa petición.
- Si no es posible renovar, se muestra un aviso propio de sesión vencida, no un error de publicación.
- Los cambios locales se conservan temporalmente en `sessionStorage` antes de redirigir al acceso.
- Al volver a iniciar sesión, el editor rehidrata esos cambios temporales y borra la copia local.
- La recuperación de una versión mantiene su plan activo y sus cambios temporales hasta que se publique o cancele.

### Modales
- El historial queda en la capa base de modales.
- Las confirmaciones de recuperar, cancelar y borrar quedan encima del historial.
- Al cancelar una confirmación, vuelve el foco al botón que la abrió y el historial permanece abierto.
- Al confirmar una recuperación, ambas ventanas se cierran sólo cuando la recuperación se creó correctamente.

## Alcance
- `editor-v2.js`
- `editor-v2.css`
- `editor-v2.html`
- `CAMBIO_sesion_y_modales_editor.md`
- `REPORTE_CAMBIO_sesion_y_modales_editor.md`

## Fuera de alcance
- No se modifica Supabase, Neon, R2, GitHub ni Workers.
- No se cambia el modelo de historial ni las versiones ya guardadas.
