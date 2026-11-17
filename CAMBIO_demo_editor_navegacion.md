# Navegación del Editor Demo

## Fase 1 — Interfaz y salida segura

- Editor conectado al recorrido Tienda o Catálogo mediante `catalog=...`.
- Cabecera móvil: Vista previa, Guardar borrador, Más opciones y Publicar demo.
- Estado visible: Guardado localmente o Cambios sin guardar.
- Regreso a Mi proyecto conserva el catálogo seleccionado.
- La salida pregunta Guardar, Descartar o Seguir editando solo ante cambios sin guardar.
- Respaldo de continuación: `backup/demo-editor-navegacion-fase1-continuacion-20261116-152809`.
- Sin publicación en esta fase.
## Corrección de vista previa

- El botón Vista previa ahora usa `togglePreview()` como fuente única de comportamiento.
- La vista previa activa y desactiva correctamente el modo del iframe, el estado y el texto del botón.
## Apariencia del editor original

- El demo reutiliza la hoja visual exacta de `editor-v2.css`.
- La barra recupera las acciones visibles del Editor original: deshacer, rehacer, borrador, base, restablecer, vista previa e historial.
- La lógica del demo permanece local; no se incorporan Supabase, Firebase ni datos de proyectos reales.
