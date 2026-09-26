# Guía: reglas de marcado para el traductor del editor-v2

Objetivo:

- definir qué atributos se ponen en el HTML para que `editor-v2` encuentre y edite una parte
- unificar la convención para páginas nuevas
- dejar reservado desde ahora el esquema para videos y archivos futuros

Ámbito de esta guía:

- aplica al editor `editor-v2`
- pensada sobre todo para páginas HTML reales del modo `html_repo`
- no describe el modo viejo por secciones

Importante:

- `editor-v2` hoy solo entiende en vivo estos tipos:
  - `text`
  - `image`
  - `link`
  - `buttons`
  - `json`
- para video/archivo futuro vamos a dejar reglas reservadas con `data-eb-future`
- `data-eb-future` no activa nada hoy; solo deja el HTML preparado

---

## 1. Núcleo del sistema

El traductor del editor se basa en dos atributos:

```html
data-eb-editable="TIPO"
data-eb-key="CLAVE"
```

Patrón base:

```html
<tag data-eb-editable="text" data-eb-key="hero.title">Texto</tag>
```

Significado:

- `data-eb-editable` = cómo debe tratar ese nodo el editor
- `data-eb-key` = identificador estable de ese contenido

Regla dura:

- si algo debe ser editable hoy, debe tener ambos
- si solo quieres dejarlo preparado para una función futura, usa `data-eb-future`

---

## 2. Helper recomendado

Si generas HTML con template strings, usa este helper:

```js
function eb(type, key, extra = "") {
  return `data-eb-editable="${type}" data-eb-key="${key}"${extra ? ` ${extra}` : ""}`;
}
```

Y opcionalmente uno para secciones:

```js
function ebSection(name) {
  return `data-eb-section="${name}"`;
}
```

`data-eb-section` hoy es semántico; sirve para ordenar el HTML, pero no es obligatorio para que edite.

---

## 3. Reglas de oro

### 3.1. La clave (`data-eb-key`) debe ser estable

No uses claves cambiantes, random o con índices frágiles.

Bien:

```html
<h1 data-eb-editable="text" data-eb-key="hero.title">...</h1>
```

Mal:

```html
<h1 data-eb-editable="text" data-eb-key="hero.title.1728823">...</h1>
```

### 3.2. Usa la misma clave solo si quieres espejo

Si dos nodos tienen la misma `data-eb-key`, al editar uno se actualizan ambos en esa misma página.

Útil para:

- teléfono repetido
- WhatsApp repetido
- nombre del negocio en header y footer

Ejemplo:

```html
<span data-eb-editable="text" data-eb-key="brand.name">Restaurante Roma</span>
<strong data-eb-editable="text" data-eb-key="brand.name">Restaurante Roma</strong>
```

### 3.3. No marques contenedores complejos como `text`

`text` reescribe `textContent`.

Entonces esto está mal:

```html
<h2 data-eb-editable="text" data-eb-key="hero.title">
  Bienvenido <span>a Roma</span>
</h2>
```

Porque al editar puede perderse la estructura interna.

Hazlo plano:

```html
<h2 data-eb-editable="text" data-eb-key="hero.title">Bienvenido a Roma</h2>
```

### 3.4. `image` solo sobre `<img>`

Hoy el editor lee y escribe `src` directamente sobre un `IMG`.

Bien:

```html
<img data-eb-editable="image" data-eb-key="hero.image" src="assets/hero.jpg" alt="Portada">
```

Mal:

```html
<div data-eb-editable="image" data-eb-key="hero.image" style="background-image:url(...)"></div>
```

Las imágenes de fondo todavía no están soportadas como editable real.

### 3.5. `link` solo sobre `<a>`

Hoy `link` edita `href`.

Bien:

```html
<a data-eb-editable="link" data-eb-key="contact.maps_url" href="https://maps.google.com/...">Ver mapa</a>
```

### 3.6. Si el texto del botón y el enlace cambian por separado, sepáralos

Recomendado:

```html
<a data-eb-editable="link" data-eb-key="cta.main.url" href="https://wa.me/521...">
  <span data-eb-editable="text" data-eb-key="cta.main.label">Escríbenos</span>
</a>
```

Así:

- clic en el `span` = cambia el texto
- clic en el `a` = cambia el enlace

---

## 4. Tipos activos hoy

## 4.1. `text`

Uso:

```html
<h1 data-eb-editable="text" data-eb-key="hero.title">Pizza artesanal</h1>
<p data-eb-editable="text" data-eb-key="hero.subtitle">Horno de piedra y entrega rápida</p>
```

Sirve para:

- títulos
- párrafos
- precios como texto
- teléfonos visibles
- nombres de secciones

No lo uses para:

- contenedores con HTML interno complejo
- listas enteras
- bloques repetibles

---

## 4.2. `image`

Uso:

```html
<img data-eb-editable="image" data-eb-key="hero.image" src="assets/hero.jpg" alt="Portada del restaurante">
```

Sirve para:

- hero principal
- foto de sección
- logo en `<img>`
- imágenes fijas de una tarjeta

Notas:

- el editor actual además puede guardar `meta` de ajuste de imagen
- esa metadata cuelga de la misma `key`

Recomendación:

- una imagen editable = una sola `key`
- si la misma foto se repite en la página y quieres espejo, repite la misma `key`

---

## 4.3. `link`

Uso:

```html
<a data-eb-editable="link" data-eb-key="contact.maps_url" href="https://maps.google.com/...">Ver en el mapa</a>
```

Sirve para:

- enlace a mapa
- enlace a WhatsApp
- enlace a menú PDF
- enlace a redes
- botón que solo necesita cambiar URL

Ojo:

- hoy `link` cambia `href`
- no cambia automáticamente el label si el nodo ya tiene texto

---

## 4.4. `buttons`

Uso:

```html
<div data-eb-editable="buttons" data-eb-key="hero.buttons"></div>
```

Este tipo espera un JSON como este:

```json
[
  { "label": "Pedir ahora", "url": "https://wa.me/521...", "style": "primary" },
  { "label": "Ver menú", "url": "/menu.html", "style": "secondary" }
]
```

Sirve para:

- grupos de botones CTA

No lo uses para:

- botones complejos con iconos personalizados o estructura interna especial

Porque el editor reconstruye el `innerHTML`.

---

## 4.5. `json`

Uso:

```html
<div data-eb-editable="json" data-eb-key="gallery.images"></div>
```

Sirve para listas/repetidores, por ejemplo:

- `gallery.images`
- `features.items`
- `testimonials.items`
- `hours.items`
- `menu.items`

Ejemplo de `gallery.images`:

```json
[
  { "url": "https://...", "caption": "Fachada", "alt": "Frente del local" },
  { "url": "https://...", "caption": "Interior", "alt": "Mesas" }
]
```

Ejemplo de `menu.items`:

```json
[
  {
    "name": "Pizza grande",
    "price": 180,
    "category": "Pizzas",
    "description": "8 rebanadas",
    "image": "https://..."
  }
]
```

No lo uses si:

- el bloque tiene HTML artesanal muy específico
- no quieres que el editor regenere la lista

---

## 5. Convención de claves (`data-eb-key`)

Formato recomendado:

```text
bloque.campo
```

Ejemplos:

- `hero.title`
- `hero.subtitle`
- `hero.image`
- `about.title`
- `about.text`
- `contact.phone`
- `contact.maps_url`
- `gallery.images`
- `menu.items`

Para grupos repetidos o variantes:

```text
[bloque].[slot].[campo]
```

Ejemplos:

- `cta.primary.label`
- `cta.primary.url`
- `cta.secondary.label`
- `cta.secondary.url`
- `video.interior.title`
- `video.interior.description`

Regla:

- usa minúsculas
- separa con puntos
- usa nombres semánticos
- evita espacios

---

## 6. Bloques recomendados por tipo de contenido

### Texto simple

```html
<section data-eb-section="hero">
  <h1 data-eb-editable="text" data-eb-key="hero.title">Pizza artesanal</h1>
  <p data-eb-editable="text" data-eb-key="hero.subtitle">Ingredientes frescos todos los días</p>
</section>
```

### Imagen simple

```html
<section data-eb-section="about">
  <img data-eb-editable="image" data-eb-key="about.image" src="assets/about.jpg" alt="Interior del local">
  <p data-eb-editable="text" data-eb-key="about.text">Más de 10 años sirviendo en la zona.</p>
</section>
```

### Botón con texto + enlace por separado

```html
<a class="site-btn primary" data-eb-editable="link" data-eb-key="cta.main.url" href="https://wa.me/521...">
  <span data-eb-editable="text" data-eb-key="cta.main.label">Pedir por WhatsApp</span>
</a>
```

### Archivo por URL editable hoy

```html
<a data-eb-editable="link" data-eb-key="files.menu.url" href="https://.../menu.pdf" target="_blank" rel="noopener">
  Descargar menú
</a>
```

---

## 7. Tipos reservados para futuro

Esta parte es la importante para videos y otros archivos.

Regla:

- si todavía no existe soporte interno, NO uses `data-eb-editable` para ese tipo nuevo
- usa `data-eb-future`
- así dejas el HTML preparado sin romper el editor actual

Formato:

```html
data-eb-future="TIPO_FUTURO"
data-eb-key="CLAVE"
```

`data-eb-future` hoy no lo toca el editor.

---

## 7.1. Video por enlace/embed externo

Caso:

- YouTube
- Vimeo
- video externo incrustado

Regla propuesta:

```html
<section class="video-block" data-eb-section="video">
  <h2 data-eb-editable="text" data-eb-key="video.hero.title">Conoce el lugar</h2>
  <p data-eb-editable="text" data-eb-key="video.hero.description">Recorrido corto del restaurante.</p>

  <div class="video-frame" data-eb-future="video_embed" data-eb-key="video.hero.url">
    <iframe src="https://www.youtube.com/embed/XXXXXXXXXXX" title="Video del restaurante" allowfullscreen loading="lazy"></iframe>
  </div>
</section>
```

Convención:

- `video.hero.title` = texto editable hoy
- `video.hero.description` = texto editable hoy
- `video.hero.url` = reservado para el motor futuro de video embed

Recomendación:

- para videos embed, la clave fuente siempre debe terminar en `.url`

Ejemplos:

- `video.hero.url`
- `video.about.url`
- `video.promo.url`

---

## 7.2. Video local/subido que vive en la página

Caso:

- video decorativo del interior
- video del negocio que el cliente puede reemplazar
- loop del hero

Regla propuesta:

```html
<section class="video-block" data-eb-section="video">
  <h2 data-eb-editable="text" data-eb-key="video.interior.title">Así se vive el ambiente</h2>
  <p data-eb-editable="text" data-eb-key="video.interior.description">Vista del salón principal.</p>

  <video
    class="hero-video"
    data-eb-future="video_file"
    data-eb-key="video.interior.file"
    autoplay
    muted
    loop
    playsinline
    controls
    poster="assets/posters/interior.jpg">
    <source src="assets/videos/interior.mp4" type="video/mp4">
  </video>
</section>
```

Convención:

- `video.interior.file` = archivo de video editable futuro
- `video.interior.title` = título editable hoy
- `video.interior.description` = descripción editable hoy

Recomendación:

- para video local, la clave fuente debe terminar en `.file`

Ejemplos:

- `video.hero.file`
- `video.interior.file`
- `video.promo.file`

No lo marques hoy como `data-eb-editable="video_file"`.

Todavía no existe el handler interno.

---

## 7.3. Poster/miniatura de video

Si el video luego tendrá poster editable, reserva esto:

```html
<img data-eb-future="video_poster" data-eb-key="video.interior.poster" src="assets/posters/interior.jpg" alt="Poster del video" hidden>
```

Convención:

- `.poster` para miniatura

Ejemplos:

- `video.hero.poster`
- `video.interior.poster`

---

## 7.4. Archivo subido que no es video

Caso:

- menú PDF
- carta
- catálogo
- folleto

Si hoy solo cambiará el link:

```html
<a data-eb-editable="link" data-eb-key="files.menu.url" href="https://.../menu.pdf" target="_blank" rel="noopener">
  Descargar menú
</a>
```

Si quieres dejarlo preparado para futura subida propia:

```html
<a
  data-eb-editable="link"
  data-eb-key="files.menu.url"
  data-eb-future="file_asset"
  href="https://.../menu.pdf"
  target="_blank"
  rel="noopener">
  Descargar menú
</a>
```

Convención:

- `.url` = enlace editable hoy
- `.file` = binario futuro propio

Ejemplos:

- `files.menu.url`
- `files.menu.file`
- `files.catalog.url`
- `files.catalog.file`

---

## 7.5. Imagen de fondo futura

Hoy no hay soporte real para `background-image`.

Si quieres dejarlo preparado:

```html
<section class="hero" data-eb-future="background_image" data-eb-key="hero.background">
  ...
</section>
```

No lo actives todavía como `image`.

---

## 8. Convención maestra para videos

Para no desordenarnos, usa esta matriz:

| Caso | Clave recomendada | Estado |
|---|---|---|
| Título de video | `video.[slot].title` | activo hoy |
| Descripción de video | `video.[slot].description` | activo hoy |
| URL embed externa | `video.[slot].url` | reservado |
| Archivo de video local | `video.[slot].file` | reservado |
| Poster del video | `video.[slot].poster` | reservado |

Ejemplos concretos:

- `video.hero.title`
- `video.hero.description`
- `video.hero.url`
- `video.interior.file`
- `video.interior.poster`
- `video.promo.url`

`[slot]` puede ser:

- `hero`
- `interior`
- `promo`
- `about`
- `cover`

---

## 9. Checklist para construir páginas nuevas

Antes de cerrar una sección, revisa esto:

- ¿Lo que debe cambiar el cliente sí tiene `data-eb-editable`?
- ¿La `key` es estable y semántica?
- ¿La imagen editable está sobre `<img>` y no en background?
- ¿El enlace editable está sobre `<a>`?
- ¿Un bloque repetido usa `json` o `buttons` en vez de `text`?
- ¿Los videos futuros usan `data-eb-future` y no un tipo inventado activo?
- ¿Los campos de texto y URL están separados cuando deben cambiar por separado?

---

## 10. Regla práctica final

Usa esta decisión:

- si el editor lo soporta hoy: `data-eb-editable`
- si todavía no existe la lógica interna: `data-eb-future`

En resumen:

### Editable hoy

```html
data-eb-editable="text|image|link|buttons|json"
data-eb-key="..."
```

### Preparado para futuro

```html
data-eb-future="video_embed|video_file|video_poster|file_asset|background_image"
data-eb-key="..."
```

---

## 11. Recomendación operativa

Para páginas nuevas, desde ahora:

- ya marca texto, imágenes y links con `data-eb-editable`
- ya deja videos/archivos futuros con `data-eb-future`

Así cuando implementemos videos:

- no tendrás que rediseñar toda la convención
- solo conectar el handler interno nuevo al marcado que ya quedó puesto
