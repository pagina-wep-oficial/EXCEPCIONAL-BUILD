# Guía: expansión interna de `editor-v2`

Objetivo:

- mejorar `editor-v2` sin romper lo que ya funciona
- dejarlo listo para crecer a videos, archivos y fondos
- mantener pocos handlers técnicos y reglas claras

Estado actual real del editor:

- selector activo: `data-eb-editable`
- clave estable: `data-eb-key`
- tipos activos hoy:
  - `text`
  - `image`
  - `link`
  - `buttons`
  - `json`
- modo HTML real (`html_repo`):
  - guarda overrides en `draft.elements`
  - publica HTML al repo
  - solo copia imágenes de Supabase al repo
- modo secciones:
  - usa `content_json`
  - no es el foco de esta guía

Regla base:

- no crear un tipo técnico por cada caso visual
- sí crear familias técnicas cortas
- distinguir variantes con metadatos semánticos

Contrato recomendado:

```html
data-eb-key="seccion.campo"
```

o

```html
data-eb-key="seccion.slot.campo"
```

Activo hoy:

```html
data-eb-editable="text|image|link|buttons|json"
```

Preparado para después:

```html
data-eb-future="video_embed|video_file|video_poster|file_asset|background_image"
```

Semántica adicional:

```html
data-eb-role="title|subtitle|hero|logo|catalog|cta|poster|promo|interior"
data-eb-kind="embed|file|pdf|social|maps|hero_bg"
data-eb-section="hero|about|gallery|video|menu|contact|footer"
```

La idea es:

- `data-eb-editable` = handler técnico activo
- `data-eb-key` = identificador estable
- `data-eb-role` = papel visual/funcional
- `data-eb-kind` = subtipo semántico opcional
- `data-eb-future` = reservado para un handler que aún no existe

---

## 1. Qué sí conviene ampliar ya

Orden recomendado:

1. ordenar el sistema actual por handlers
2. agregar `video_embed`
3. agregar `file_asset`
4. agregar `background_image`
5. agregar `video_file`
6. agregar `video_poster`

Motivo:

- `video_embed` y `file_asset` son ligeros
- `background_image` reutiliza la lógica de imagen
- `video_file` y `video_poster` ya requieren buckets, limpieza y reglas de publicación

---

## 2. Punto exacto donde vive hoy el traductor

Las piezas importantes hoy están en:

- `editor-v2.js`
  - `buildInlineFields(type, value)`
  - `updateCurrentValue(rawValue, photoMeta)`
  - `readNodeValue(node, type)`
  - `bindEditableNodes(doc)`
  - `applyDraftToFrame()`
- `functions/api/editor-repo-publish.js`
  - copia imágenes de Supabase al repo

La expansión no debe meterse “a parches” por todas partes.

Primero conviene centralizar los tipos.

---

## 3. Refactor mínimo antes de meter tipos nuevos

Antes de ampliar, haz esta limpieza conceptual dentro de `editor-v2.js`:

### 3.1. Crear un registro central de handlers

Meta:

```js
const EB_HANDLERS = {
  text: { family: "text" },
  image: { family: "image" },
  link: { family: "link" },
  buttons: { family: "buttons" },
  json: { family: "json" },
  video_embed: { family: "video" },
  video_file: { family: "video" },
  video_poster: { family: "video" },
  file_asset: { family: "file" },
  background_image: { family: "image" }
};
```

No para cambiar todo el comportamiento desde el día uno, sino para dejar un punto único de verdad.

### 3.2. Normalizar la lectura de metadata del nodo

Crear helper tipo:

```js
function editableMeta(node){
  return {
    key: node?.getAttribute("data-eb-key") || "",
    type: node?.getAttribute("data-eb-editable") || "",
    role: node?.getAttribute("data-eb-role") || "",
    kind: node?.getAttribute("data-eb-kind") || "",
    section: node?.getAttribute("data-eb-section") || "",
    future: node?.getAttribute("data-eb-future") || ""
  };
}
```

Así dejas de leer atributos sueltos por varias funciones.

### 3.3. Mantener el selector activo solo para lo implementado

No mezcles desde ahora `data-eb-future` con el click real.

Mientras no exista el handler, sigue así:

```js
const EDITABLE_SELECTOR = "[data-eb-editable]";
```

Cuando un tipo futuro quede implementado, ese nodo deja de usar `data-eb-future` y pasa a `data-eb-editable`.

---

## 4. Familias técnicas que debe entender `editor-v2`

## 4.1. `text`

Qué cubre:

- títulos
- subtítulos
- párrafos
- badges
- etiquetas
- precios como texto
- captions

Roles sugeridos:

- `title`
- `subtitle`
- `paragraph`
- `badge`
- `label`
- `price`
- `caption`
- `eyebrow`

No requiere nuevos buckets.

---

## 4.2. `image`

Qué cubre:

- logo
- hero
- imagen de sección
- producto
- avatar
- cover

Roles sugeridos:

- `logo`
- `hero`
- `section`
- `gallery_item`
- `product`
- `avatar`
- `cover`

Hoy ya existe:

- subida a `site-images`
- ajuste no destructivo
- copia al repo en `html_repo`

Regla:

- `image` solo en `<img>`

---

## 4.3. `link`

Qué cubre:

- WhatsApp
- teléfono
- email
- mapa
- social
- enlace a PDF
- botón con URL simple

Roles sugeridos:

- `cta`
- `whatsapp`
- `phone`
- `email`
- `maps`
- `social`
- `catalog`
- `menu_pdf`

Kinds sugeridos:

- `social`
- `pdf`
- `maps`

Regla:

- `link` solo en `<a>`

---

## 4.4. `buttons`

Qué cubre:

- grupos de CTAs

Regla:

- el editor regenera el contenido del contenedor
- no se usa para botones HTML extremadamente custom

---

## 4.5. `json`

Qué cubre hoy:

- `features.items`
- `gallery.images`
- `testimonials.items`
- `hours.items`
- `menu.items`

Regla:

- solo usarlo cuando el editor vaya a reconstruir una lista completa

---

## 4.6. `video_embed` (nuevo)

Meta:

- editar una URL de YouTube/Vimeo/embed
- no subir archivo
- no copiar nada al repo como binario
- guardar solo URL y metadata textual

HTML objetivo:

```html
<div data-eb-editable="video_embed" data-eb-key="video.hero.url" data-eb-role="hero" data-eb-kind="embed">
  <iframe src="https://www.youtube.com/embed/xxxx" title="Video"></iframe>
</div>
```

Más textos aparte:

```html
<h2 data-eb-editable="text" data-eb-key="video.hero.title" data-eb-role="title">Conoce el lugar</h2>
<p data-eb-editable="text" data-eb-key="video.hero.description" data-eb-role="paragraph">Recorrido corto.</p>
```

Comportamiento interno recomendado:

- sidebar:
  - input URL
  - preview
- guardado:
  - solo string URL
- publicación:
  - no bucket
  - no repo asset
- DOM apply:
  - actualizar `iframe src`
  - o regenerar el bloque embed si usas wrapper

---

## 4.7. `video_file` (nuevo)

Meta:

- video subido por el cliente
- vive en bucket propio
- nunca se copia al repo

HTML objetivo:

```html
<video data-eb-editable="video_file" data-eb-key="video.interior.file" data-eb-role="interior" data-eb-kind="file" controls muted playsinline>
  <source src="assets/videos/interior.mp4" type="video/mp4">
</video>
```

Comportamiento interno recomendado:

- bucket nuevo:
  - `site-videos`
- sidebar:
  - subir video
  - ver tamaño
  - reemplazar
- guardado:
  - URL del video final
- publicación:
  - no repo
  - no GitHub
  - no copia
- limpieza:
  - tab de almacenamiento debe revisarlo aparte de imágenes

Regla dura:

- los videos no siguen el flujo de imagen
- no se copian al repo

---

## 4.8. `video_poster` (nuevo)

Meta:

- miniatura/poster del video
- puede vivir como imagen normal

HTML objetivo:

```html
<img data-eb-editable="video_poster" data-eb-key="video.interior.poster" data-eb-role="poster" data-eb-kind="poster" src="assets/posters/interior.jpg" alt="Poster del video">
```

Decisión técnica recomendada:

dos opciones válidas:

1. handler propio `video_poster`
2. reutilizar `image` si el poster es un `<img>` separado

Mi recomendación:

- si el poster es `<img>` separado: reutiliza `image`
- si el poster se escribe en el atributo `poster` del `<video>`: usa `video_poster`

---

## 4.9. `file_asset` (nuevo)

Meta:

- PDF, catálogo, documento o archivo descargable

HTML objetivo:

```html
<a data-eb-editable="file_asset" data-eb-key="files.catalog.file" data-eb-role="catalog" data-eb-kind="pdf" href="/catalogo.pdf">Ver catálogo</a>
```

Comportamiento interno recomendado:

- bucket nuevo:
  - `site-files`
- sidebar:
  - subir archivo
  - ver nombre y tamaño
- guardado:
  - URL final del archivo
- publicación:
  - no repo si es pesado
  - para PDFs pequeños podrías evaluarlo después, pero no lo mezcles en v1

Si hoy solo quieres link externo o fijo:

- sigue siendo `link`

---

## 4.10. `background_image` (nuevo)

Meta:

- editar una imagen de fondo

HTML objetivo:

```html
<section data-eb-editable="background_image" data-eb-key="hero.background" data-eb-role="hero_bg" data-eb-kind="background"></section>
```

Comportamiento interno recomendado:

- usar bucket `site-images`
- guardar URL igual que imagen
- aplicar al DOM con:

```js
node.style.backgroundImage = `url("${value}")`;
```

Punto importante:

- si el HTML publicado contiene la URL Supabase en estilo inline, el publicador podría copiarla al repo si la detecta en HTML
- eso sí es válido porque sigue siendo imagen, no video

---

## 5. Qué archivos tocar para cada nueva familia

## 5.1. Para cualquier handler nuevo

Archivo:

`editor-v2.js`

Zonas a tocar:

- lectura:
  - `readNodeValue(node, type)`
- UI lateral:
  - `buildInlineFields(type, value)`
- persistencia:
  - `updateCurrentValue(rawValue, extraMeta)`
- click binding:
  - `bindEditableNodes(doc)`
- aplicación al DOM:
  - `applyDraftToFrame()`

---

## 5.2. Si sube binarios nuevos

También tocar:

- helpers de subida en `editor-v2.js`
- almacenamiento/limpieza en `crm.js`
- si hay bucket nuevo, su SQL/políticas

Buckets recomendados:

- imágenes: `site-images`
- videos: `site-videos`
- documentos: `site-files`

---

## 5.3. Publicación

Archivo:

`functions/api/editor-repo-publish.js`

Regla:

- imágenes sí se pueden copiar al repo
- fondos de imagen también podrían seguir esta lógica
- videos no
- archivos no en v1

---

## 6. Fases recomendadas

## Fase 0. Ordenar contrato

Cerrar estas reglas:

- `data-eb-key`
- `data-eb-editable`
- `data-eb-role`
- `data-eb-kind`
- `data-eb-future`

## Fase 1. Refactor del runtime actual

Objetivo:

- centralizar handlers
- centralizar lectura de metadata
- dejar menos lógica regada

## Fase 2. `video_embed`

Objetivo:

- editar embed sin tocar binarios

## Fase 3. `file_asset`

Objetivo:

- PDF/docs con bucket propio

## Fase 4. `background_image`

Objetivo:

- fondos editables con la lógica actual de imagen

## Fase 5. `video_file`

Objetivo:

- subida de video real
- bucket propio
- sin repo

## Fase 6. `video_poster`

Objetivo:

- miniatura independiente

---

## 7. Reglas técnicas que no debes romper

- misma `data-eb-key` en dos nodos = espejo
- `image` solo sobre `<img>`
- `link` solo sobre `<a>`
- `text` no para contenedores con HTML complejo
- `buttons` y `json` regeneran contenido
- `video_file` no se copia al repo
- `file_asset` no se trata como imagen
- `background_image` no debe intentar usar el flujo de `<img>`

---

## 8. Pruebas mínimas por cada handler nuevo

Cada tipo nuevo debe pasar esto:

1. detectar clic correcto
2. abrir sidebar correcta
3. guardar borrador
4. recargar editor y mantener cambio
5. publicar y ver cambio final
6. volver a editar sin perder referencia

Extras:

- `video_embed`:
  - preview correcta
  - URL mala no rompe el editor
- `video_file`:
  - reemplazo de archivo
  - no duplicación al repo
  - candidato de limpieza detectado
- `file_asset`:
  - link final válido
  - nombre y tamaño visibles
- `background_image`:
  - aplica en vivo
  - respeta publicación

---

## 9. Recomendación final

No implementes todo junto.

La secuencia sana es:

1. cerrar contrato de marcado
2. refactor de handlers
3. `video_embed`
4. `file_asset`
5. `background_image`
6. `video_file`
7. `video_poster`

Con eso el editor crece sin volverse inmantenible.
