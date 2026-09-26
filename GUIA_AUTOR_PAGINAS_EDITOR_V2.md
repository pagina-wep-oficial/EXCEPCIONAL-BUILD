# Guía: qué marcar en una página para usarla con `editor-v2`

Objetivo:

- saber qué poner en el HTML cuando creas páginas nuevas
- usar una convención estable desde el principio
- no improvisar etiquetas distintas en cada sitio

Esta guía es práctica.

No explica cómo programar el editor.

Explica qué marcar en la página para que el editor lo pueda usar hoy o lo tenga preparado para después.

---

## 1. Atributos base

## Obligatorios para algo editable hoy

```html
data-eb-editable="TIPO"
data-eb-key="CLAVE"
```

## Recomendados para ordenar el sistema

```html
data-eb-role="ROL"
data-eb-kind="SUBTIPO"
data-eb-section="SECCION"
```

## Para dejar algo preparado para futuro

```html
data-eb-future="TIPO_FUTURO"
data-eb-key="CLAVE"
```

---

## 2. Qué funciona hoy

Activos hoy:

- `text`
- `image`
- `link`
- `buttons`
- `json`

Preparados para después:

- `video_embed`
- `video_file`
- `video_poster`
- `file_asset`
- `background_image`

---

## 3. Regla de claves

Usa esto:

```text
seccion.campo
```

o

```text
seccion.slot.campo
```

Ejemplos buenos:

- `hero.title`
- `hero.subtitle`
- `hero.image`
- `brand.logo`
- `about.text`
- `contact.whatsapp_url`
- `files.catalog.url`
- `video.hero.url`
- `video.interior.file`

Evita:

- claves random
- números innecesarios
- claves distintas para el mismo dato repetido

Si quieres espejo entre dos nodos, repite la misma `key`.

---

## 4. Mapa por familias

## 4.1. Textos

Tipo técnico:

```html
data-eb-editable="text"
```

Roles sugeridos:

- `title`
- `subtitle`
- `paragraph`
- `badge`
- `label`
- `price`
- `caption`
- `eyebrow`

Ejemplos:

```html
<h1 data-eb-editable="text" data-eb-role="title" data-eb-section="hero" data-eb-key="hero.title">
  Pizza artesanal
</h1>
```

```html
<p data-eb-editable="text" data-eb-role="subtitle" data-eb-section="hero" data-eb-key="hero.subtitle">
  Horno de piedra y entrega rápida
</p>
```

```html
<span data-eb-editable="text" data-eb-role="price" data-eb-section="menu" data-eb-key="menu.featured_price">
  $180
</span>
```

Usa `text` para contenido plano.

No lo uses en contenedores con HTML complejo dentro.

---

## 4.2. Imágenes

Tipo técnico:

```html
data-eb-editable="image"
```

Roles sugeridos:

- `logo`
- `hero`
- `section`
- `gallery_item`
- `product`
- `avatar`
- `cover`

Regla:

- `image` solo en `<img>`

Ejemplos:

```html
<img data-eb-editable="image" data-eb-role="logo" data-eb-section="header" data-eb-key="brand.logo" src="assets/logo.png" alt="Logo">
```

```html
<img data-eb-editable="image" data-eb-role="hero" data-eb-section="hero" data-eb-key="hero.image" src="assets/hero.jpg" alt="Portada">
```

```html
<img data-eb-editable="image" data-eb-role="product" data-eb-section="menu" data-eb-key="menu.featured_image" src="assets/pizza.jpg" alt="Pizza especial">
```

Si la misma imagen se repite y quieres espejo, usa la misma `key`.

---

## 4.3. Links

Tipo técnico:

```html
data-eb-editable="link"
```

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

Ejemplos:

```html
<a data-eb-editable="link" data-eb-role="whatsapp" data-eb-kind="social" data-eb-section="contact" data-eb-key="contact.whatsapp_url" href="https://wa.me/521...">
  Escríbenos
</a>
```

```html
<a data-eb-editable="link" data-eb-role="maps" data-eb-kind="maps" data-eb-section="contact" data-eb-key="contact.maps_url" href="https://maps.google.com/...">
  Ver mapa
</a>
```

```html
<a data-eb-editable="link" data-eb-role="catalog" data-eb-kind="pdf" data-eb-section="files" data-eb-key="files.catalog.url" href="/catalogo.pdf">
  Ver catálogo
</a>
```

---

## 4.4. Botones

Tipo técnico:

```html
data-eb-editable="buttons"
```

Uso:

```html
<div data-eb-editable="buttons" data-eb-role="cta_group" data-eb-section="hero" data-eb-key="hero.buttons"></div>
```

Se usa para grupos de botones generados por JSON.

No lo uses si el bloque necesita HTML manual muy especial.

---

## 4.5. Listas JSON

Tipo técnico:

```html
data-eb-editable="json"
```

Casos recomendados:

- galerías
- menú
- testimonios
- horarios
- ventajas

Ejemplos:

```html
<div data-eb-editable="json" data-eb-role="gallery" data-eb-section="gallery" data-eb-key="gallery.images"></div>
```

```html
<div data-eb-editable="json" data-eb-role="menu_list" data-eb-section="menu" data-eb-key="menu.items"></div>
```

```html
<div data-eb-editable="json" data-eb-role="hours_list" data-eb-section="contact" data-eb-key="hours.items"></div>
```

---

## 5. Videos

Aquí divide siempre en dos familias:

- embed por URL
- video local/subido

Y separa también:

- título
- descripción
- poster

---

## 5.1. Video embed

Todavía no activo.

Déjalo reservado así:

```html
<section data-eb-section="video">
  <h2 data-eb-editable="text" data-eb-role="title" data-eb-key="video.hero.title">Conoce el lugar</h2>
  <p data-eb-editable="text" data-eb-role="paragraph" data-eb-key="video.hero.description">Recorrido corto del restaurante.</p>

  <div data-eb-future="video_embed" data-eb-role="hero" data-eb-kind="embed" data-eb-key="video.hero.url">
    <iframe src="https://www.youtube.com/embed/xxxx" title="Video" allowfullscreen loading="lazy"></iframe>
  </div>
</section>
```

Convención:

- `video.[slot].title`
- `video.[slot].description`
- `video.[slot].url`

Ejemplos:

- `video.hero.url`
- `video.hero.title`
- `video.hero.description`

---

## 5.2. Video local/subido

Todavía no activo.

Déjalo reservado así:

```html
<section data-eb-section="video">
  <h2 data-eb-editable="text" data-eb-role="title" data-eb-key="video.interior.title">Así se vive el ambiente</h2>
  <p data-eb-editable="text" data-eb-role="paragraph" data-eb-key="video.interior.description">Vista del salón principal.</p>

  <video data-eb-future="video_file" data-eb-role="interior" data-eb-kind="file" data-eb-key="video.interior.file" controls muted playsinline poster="assets/posters/interior.jpg">
    <source src="assets/videos/interior.mp4" type="video/mp4">
  </video>
</section>
```

Convención:

- `video.[slot].file`
- `video.[slot].title`
- `video.[slot].description`

Ejemplos:

- `video.interior.file`
- `video.promo.file`

---

## 5.3. Poster del video

Todavía no activo como handler separado.

Déjalo reservado así:

```html
<img data-eb-future="video_poster" data-eb-role="poster" data-eb-kind="poster" data-eb-key="video.interior.poster" src="assets/posters/interior.jpg" alt="Poster del video">
```

Convención:

- `video.[slot].poster`

Ejemplos:

- `video.hero.poster`
- `video.interior.poster`

---

## 6. Archivos

## 6.1. Archivo por URL actual

Si hoy solo vas a usar un link:

```html
<a data-eb-editable="link" data-eb-role="catalog" data-eb-kind="pdf" data-eb-section="files" data-eb-key="files.catalog.url" href="/catalogo.pdf">
  Ver catálogo
</a>
```

## 6.2. Archivo propio futuro

Si después el cliente lo subirá al sistema:

```html
<a data-eb-future="file_asset" data-eb-role="catalog" data-eb-kind="pdf" data-eb-section="files" data-eb-key="files.catalog.file" href="/catalogo.pdf">
  Ver catálogo
</a>
```

Convención:

- `files.[slot].url` = enlace actual
- `files.[slot].file` = archivo propio futuro

Ejemplos:

- `files.menu.url`
- `files.catalog.url`
- `files.catalog.file`

---

## 7. Fondo editable

Todavía no activo.

Déjalo reservado así:

```html
<section data-eb-future="background_image" data-eb-role="hero_bg" data-eb-kind="background" data-eb-section="hero" data-eb-key="hero.background">
```

Convención:

- `hero.background`
- `about.background`

---

## 8. Ejemplo completo de hero bien marcado

```html
<section class="hero" data-eb-section="hero">
  <img data-eb-editable="image" data-eb-role="logo" data-eb-key="brand.logo" src="assets/logo.png" alt="Logo">

  <h1 data-eb-editable="text" data-eb-role="title" data-eb-key="hero.title">
    Pizza artesanal
  </h1>

  <p data-eb-editable="text" data-eb-role="subtitle" data-eb-key="hero.subtitle">
    Horno de piedra y entrega rápida
  </p>

  <img data-eb-editable="image" data-eb-role="hero" data-eb-key="hero.image" src="assets/hero.jpg" alt="Portada">

  <div data-eb-editable="buttons" data-eb-role="cta_group" data-eb-key="hero.buttons"></div>
</section>
```

---

## 9. Ejemplo completo de sección video preparada

```html
<section class="video-block" data-eb-section="video">
  <h2 data-eb-editable="text" data-eb-role="title" data-eb-key="video.hero.title">
    Conoce el lugar
  </h2>

  <p data-eb-editable="text" data-eb-role="paragraph" data-eb-key="video.hero.description">
    Recorrido corto del restaurante
  </p>

  <div data-eb-future="video_embed" data-eb-role="hero" data-eb-kind="embed" data-eb-key="video.hero.url">
    <iframe src="https://www.youtube.com/embed/xxxx" title="Video" allowfullscreen loading="lazy"></iframe>
  </div>
</section>
```

---

## 10. Checklist rápido al crear páginas

Antes de cerrar una sección, revisa:

- ¿lo que el cliente debe cambiar tiene `data-eb-key`?
- ¿lo editable hoy usa `data-eb-editable`?
- ¿lo futuro usa `data-eb-future`?
- ¿las imágenes editables están sobre `<img>`?
- ¿los links editables están sobre `<a>`?
- ¿la clave es estable y semántica?
- ¿si un dato se repite y debe ir sincronizado, comparte la misma `key`?
- ¿separaste bien título, descripción, URL, file y poster en videos?
- ¿separaste bien `.url` y `.file` en archivos?

---

## 11. Resumen mínimo para memorizar

Hoy:

- `text`
- `image`
- `link`
- `buttons`
- `json`

Mañana:

- `video_embed`
- `video_file`
- `video_poster`
- `file_asset`
- `background_image`

Regla final:

- mismo tipo técnico para la misma familia
- el rol distingue el caso visual
- la `key` manda
