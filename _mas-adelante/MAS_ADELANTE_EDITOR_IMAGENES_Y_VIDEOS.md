# Más adelante — Mejoras del editor V2 para imágenes y videos

Fecha: 2026-08-29
Estado: pendiente de implementación

## Objetivo

Guardar aquí el backlog de mejoras del editor V2 relacionadas con:

- imágenes
- video embed
- video stream
- UX visual del editor

## Regla principal

Seguir usando un solo motor:

- `editor-v2`

No reabrir flujos viejos de editor legado.

## Bloque 1 — Imágenes

Pendientes / mejoras futuras:

- mejorar loaders visuales al reemplazar imagen
- revisar sincronía del spinner con la carga real
- evitar artefactos visuales al hacer scroll durante carga
- seguir puliendo ajuste/encuadre para que no “salte”
- revisar bordes redondos al editar y guardar
- revisar estabilidad al reabrir una imagen ya editada

## Bloque 2 — Video embed

Pendientes / mejoras futuras:

- seguir cerrando bugs visuales de render en edición
- validar estabilidad al cambiar provider manualmente
- validar relación de aspecto por instancia
- revisar parpadeos o cuadros negros
- validar preview en modo edición vs publicado
- dejar el nodo no interactivo en edición y con preview controlada por el editor

## Bloque 3 — Video stream

Dirección ya pensada:

- no tratar videos como imágenes
- no guardar video final dentro del repo como flujo normal
- usar referencia a asset
- permitir reemplazar video, no editar su contenido

Contrato pensado:

- `kind = video_stream`
- `asset_id`
- `provider`
- `playback_url`
- `poster_url`
- `status`

Flujo esperado para usuario promedio:

1. toca el video
2. pulsa reemplazar
3. sube el nuevo archivo
4. ve estado de carga/procesamiento
5. guarda/publica
6. el sitio publicado apunta al asset correcto

Fuera de alcance:

- cortar video
- timeline
- comprimir manualmente
- editar inicio/fin
- editar contenido del video

## Bloque 4 — Publicación y almacenamiento

Decisiones importantes ya tomadas:

- no copiar videos al repo como modelo principal
- no mezclar videos grandes con flujo de imágenes
- separar “draft”, “publicado”, “huérfano” y limpieza

Reglas futuras de limpieza:

- si un asset lo usa publicado: no borrar
- si lo usa draft: no borrar
- si no lo usa nadie: marcar huérfano
- borrar huérfanos después
- mantener limpieza manual en administración

## Bloque 5 — UX del editor

Pendientes futuros:

- mensajes más limpios para usuario final
- sistema de errores amigable con diccionario interno
- menos texto técnico visible
- loaders y estados más claros
- preview más consistente entre edición y publicado

## Orden sugerido cuando se retome

### Fase 1

- cerrar bugs pendientes de `video_embed`
- QA visual fuerte en edición / preview / publicado

### Fase 2

- definir storage real de `video_stream`
- contrato de datos final

### Fase 3

- panel real de `video_stream` en editor
- reemplazo de video
- poster opcional

### Fase 4

- limpieza manual/admin de videos
- estado de uso / huérfanos

### Fase 5

- solo si hace falta: `video_file_raw`

## No meter todavía

- edición interna del video
- timeline
- compresión manual
- múltiples formatos manuales
- flujo viejo de editor

Primero cerrar lo simple: reemplazar bien y publicar bien.
