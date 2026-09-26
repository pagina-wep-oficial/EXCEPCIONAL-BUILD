# Guía — Fix `video_embed`: instancias, provider manual persistente, ratio y video negro

Problema actual

Hay 3 bugs mezclados:

1. Todos los videos de una misma página siguen usando la misma key:

- `video.heading`
- `video.description`
- `video.embed`

Eso hace que un video pise al otro.

2. El provider manual no persiste bien.

Si eliges manualmente otro provider y luego vuelves a tocar ese video, puede regresar a YouTube/Vimeo porque el modelo lo recalcula desde la URL.

3. A veces el video queda negro.

Eso pasa cuando el provider guardado no coincide con la URL real y el renderer intenta construir un iframe del proveedor equivocado.

Síntomas típicos

- cambias un video, tocas otro y al volver el primero ya cambió solo
- el aspect ratio parece no aplicarse o solo se ve cuando cambias URL
- un video sale negro
- parece fallo visual, pero el problema real es identidad + provider + render

Objetivo del fix

Dejar esto correcto:

- cada video usa su propia key por instancia
- el provider manual sí se conserva
- el modo auto queda realmente en auto
- si el provider no coincide con la URL, no se rompe en negro
- el ratio aplica sobre el video correcto

---

## 1. Cambiar el bloque `video` a keys por instancia en `site-view.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca este bloque completo:

```js
if (section.type === "video") {
  const videoHeading = elementValue("video.heading", data.title || data.heading || "");
  const videoDescription = elementValue("video.description", data.description || "");
  const legacyUrl = String(data.video_url || data.url || "").trim();
  const embed = buildVideoEmbedModel(
    elementJson("video.embed", data.video_embed || null),
    {
      url: legacyUrl,
      title: data.title || data.heading || "",
      poster_url: data.poster_url || "",
      aspect_ratio: data.video_aspect_ratio || "16 / 9"
    }
  );
  const embedValue = encodeURIComponent(JSON.stringify(embed));

  return `
    <section class="site-section" ${editableSection("video")}>
      ${videoHeading ? `<h2 ${editableAttrs("text", "video.heading", { role: "video", kind: "heading", section: "video" })}>${safe(videoHeading)}</h2>` : ""}
      ${videoDescription ? `<p ${editableAttrs("text", "video.description", { role: "video", kind: "description", section: "video" })}>${safe(videoDescription)}</p>` : ""}
      <div
        class="site-video"
        ${editableAttrs("video_embed", "video.embed", { role: "video", kind: "embed", section: "video" }, `data-eb-value="${safe(embedValue)}"`)}
      >
        ${renderVideoEmbedMarkup(embed, videoHeading || "Video")}
      </div>
    </section>
  `;
}
```

Reemplázalo por:

```js
if (section.type === "video") {
  const videoHeading = elementValueInst("video", "heading", data.title || data.heading || "");
  const videoDescription = elementValueInst("video", "description", data.description || "");
  const legacyUrl = String(data.video_url || data.url || "").trim();
  const embed = buildVideoEmbedModel(
    elementJsonInst("video", "embed", data.video_embed || null),
    {
      url: legacyUrl,
      title: data.title || data.heading || "",
      poster_url: data.poster_url || "",
      aspect_ratio: data.video_aspect_ratio || "16 / 9"
    }
  );
  const embedValue = encodeURIComponent(JSON.stringify(embed));

  return `
    <section class="site-section" ${editableSection("video")}>
      ${videoHeading ? `<h2 ${editableInst("text", "video", "heading", { role: "video", kind: "heading", section: "video" })}>${safe(videoHeading)}</h2>` : ""}
      ${videoDescription ? `<p ${editableInst("text", "video", "description", { role: "video", kind: "description", section: "video" })}>${safe(videoDescription)}</p>` : ""}
      <div
        class="site-video"
        ${editableInst("video_embed", "video", "embed", { role: "video", kind: "embed", section: "video" }, `data-eb-value="${safe(embedValue)}"`)}
      >
        ${renderVideoEmbedMarkup(embed, videoHeading || "Video")}
      </div>
    </section>
  `;
}
```

Resultado:

- cada sección de video tendrá keys únicas tipo:
  - `video.<id>.heading`
  - `video.<id>.description`
  - `video.<id>.embed`
- un video ya no pisará al otro

Este es el fix más importante.

---

## 2. Separar `provider` manual de `provider` detectado en `site-view.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca este bloque completo:

```js
function detectVideoProvider(url = "", explicit = "") {
  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";

  const hinted = String(explicit || "").trim().toLowerCase();
  if (hinted === "external") return "external";

  return String(url || "").trim() ? "external" : "";
}

function normalizeVideoAspectRatio(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "16 / 9";

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) return `${match[1]} / ${match[2]}`;

  return "16 / 9";
}

function buildVideoEmbedModel(raw, fallback = {}) {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const url = String(base.url || fallback.url || "").trim();

  return {
    kind: "video_embed",
    provider: detectVideoProvider(url, base.provider || fallback.provider || ""),
    url,
    title: String(base.title || fallback.title || "").trim(),
    poster_url: String(base.poster_url || fallback.poster_url || "").trim(),
    aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || fallback.aspect_ratio || "16 / 9"),
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Reemplázalo por:

```js
function sanitizeVideoProvider(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "youtube" || raw === "vimeo" || raw === "external" ? raw : "";
}

function detectVideoProvider(url = "") {
  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";
  return String(url || "").trim() ? "external" : "";
}

function resolveVideoProvider(model = {}) {
  const url = String(model?.url || "").trim();
  const explicit = sanitizeVideoProvider(model?.provider || "");
  const detected = detectVideoProvider(url);

  if (!explicit) return detected;
  if (explicit === "external") return "external";
  if (explicit === "youtube") return extractYouTubeVideoId(url) ? "youtube" : (detected || "external");
  if (explicit === "vimeo") return extractVimeoVideoId(url) ? "vimeo" : (detected || "external");
  return detected;
}

function normalizeVideoAspectRatio(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "16 / 9";

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) return `${match[1]} / ${match[2]}`;

  return "16 / 9";
}

function buildVideoEmbedModel(raw, fallback = {}) {
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const url = String(base.url || fallback.url || "").trim();

  return {
    kind: "video_embed",
    provider: sanitizeVideoProvider(base.provider || fallback.provider || ""),
    url,
    title: String(base.title || fallback.title || "").trim(),
    poster_url: String(base.poster_url || fallback.poster_url || "").trim(),
    aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || fallback.aspect_ratio || "16 / 9"),
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Resultado:

- `provider` guardado ya significa “elección manual”
- la detección automática ya no pisa el valor manual

---

## 3. Evitar negro en `site-view.js`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Dentro de `renderVideoEmbedMarkup(model, fallbackTitle = "Video")`, busca:

```js
const video = buildVideoEmbedModel(model);
const title = safe(video.title || fallbackTitle || "Video");
const ratio = safe(video.aspect_ratio || "16 / 9");
const youtubeId = extractYouTubeVideoId(video.url);
const vimeoId = extractVimeoVideoId(video.url);

if (video.provider === "youtube" && youtubeId) {
```

Reemplázalo por:

```js
const video = buildVideoEmbedModel(model);
const resolvedProvider = resolveVideoProvider(video);
const title = safe(video.title || fallbackTitle || "Video");
const ratio = safe(video.aspect_ratio || "16 / 9");
const youtubeId = extractYouTubeVideoId(video.url);
const vimeoId = extractVimeoVideoId(video.url);

if (resolvedProvider === "youtube" && youtubeId) {
```

Ahora más abajo busca:

```js
if (video.provider === "vimeo" && vimeoId) {
```

Reemplázalo por:

```js
if (resolvedProvider === "vimeo" && vimeoId) {
```

Resultado:

- si el provider guardado no coincide con la URL, el renderer cae al proveedor resoluble o a `external`
- el iframe no se queda negro por intentar armar una plataforma equivocada

---

## 4. Hacer lo mismo en `editor-v2.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca este bloque completo:

```js
function detectVideoProvider(url = "", explicit = "") {
  const hinted = String(explicit || "").trim().toLowerCase();
  if (hinted === "external") return "external";

  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";

  if (hinted === "youtube" || hinted === "vimeo") return hinted;

  return String(url || "").trim() ? "external" : "";
}

function normalizeVideoAspectRatio(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "16 / 9";

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) return `${match[1]} / ${match[2]}`;

  return "16 / 9";
}

function defaultVideoEmbedModel(source = {}) {
  const base = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const url = String(base.url || "").trim();

  return {
    kind: "video_embed",
    provider: detectVideoProvider(url, base.provider || ""),
    url,
    title: String(base.title || "").trim(),
    poster_url: String(base.poster_url || "").trim(),
    aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || "16 / 9"),
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Reemplázalo por:

```js
function sanitizeVideoProvider(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "youtube" || raw === "vimeo" || raw === "external" ? raw : "";
}

function detectVideoProvider(url = "") {
  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";
  return String(url || "").trim() ? "external" : "";
}

function resolveVideoProvider(model = {}) {
  const url = String(model?.url || "").trim();
  const explicit = sanitizeVideoProvider(model?.provider || "");
  const detected = detectVideoProvider(url);

  if (!explicit) return detected;
  if (explicit === "external") return "external";
  if (explicit === "youtube") return extractYouTubeVideoId(url) ? "youtube" : (detected || "external");
  if (explicit === "vimeo") return extractVimeoVideoId(url) ? "vimeo" : (detected || "external");
  return detected;
}

function normalizeVideoAspectRatio(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "16 / 9";

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (match) return `${match[1]} / ${match[2]}`;

  return "16 / 9";
}

function defaultVideoEmbedModel(source = {}) {
  const base = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const url = String(base.url || "").trim();

  return {
    kind: "video_embed",
    provider: sanitizeVideoProvider(base.provider || ""),
    url,
    title: String(base.title || "").trim(),
    poster_url: String(base.poster_url || "").trim(),
    aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || "16 / 9"),
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Resultado:

- el modelo del editor deja de sobreescribir el provider manual

---

## 5. Evitar negro también en el preview del editor

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `renderVideoEmbedPreview(model)`, busca:

```js
const video = defaultVideoEmbedModel(model);
const title = safe(video.title || "Video");
const ratio = safe(video.aspect_ratio || "16 / 9");
const youtubeId = extractYouTubeVideoId(video.url);
const vimeoId = extractVimeoVideoId(video.url);

if (video.provider === "youtube" && youtubeId) {
```

Reemplázalo por:

```js
const video = defaultVideoEmbedModel(model);
const resolvedProvider = resolveVideoProvider(video);
const title = safe(video.title || "Video");
const ratio = safe(video.aspect_ratio || "16 / 9");
const youtubeId = extractYouTubeVideoId(video.url);
const vimeoId = extractVimeoVideoId(video.url);

if (resolvedProvider === "youtube" && youtubeId) {
```

Ahora busca:

```js
if (video.provider === "vimeo" && vimeoId) {
```

Reemplázalo por:

```js
if (resolvedProvider === "vimeo" && vimeoId) {
```

Resultado:

- el preview usa la misma resolución segura que el sitio

---

## 6. Quitar el auto-cambio del select `provider` en el panel

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca este bloque completo dentro de `bindSidebarFieldEvents(fields)`:

```js
const videoFields = fields.querySelectorAll("[data-video-embed-field]");
if (videoFields.length) {
  const providerInput = fields.querySelector('[data-video-embed-field="provider"]');
  const urlInput = fields.querySelector('[data-video-embed-field="url"]');

  const syncVideoProvider = () => {
    if (!providerInput || !urlInput) return;
    const current = (providerInput.value || "").trim();
    const valid = current === "youtube" || current === "vimeo" || current === "external";
    if (providerInput.dataset.ebManual === "1") return;
    if (valid) return;
    const detected = detectVideoProvider(urlInput.value || "");
    providerInput.value = detected || "";
  };

  const commitVideo = () => {
    syncVideoProvider();

    const next = {
      provider: providerInput?.value || "",
      url: urlInput?.value || "",
      title: fields.querySelector('[data-video-embed-field="title"]')?.value || "",
      poster_url: fields.querySelector('[data-video-embed-field="poster_url"]')?.value || "",
      aspect_ratio: fields.querySelector('[data-video-embed-field="aspect_ratio"]')?.value || "16 / 9",
      autoplay: !!fields.querySelector('[data-video-embed-field="autoplay"]')?.checked,
      muted: !!fields.querySelector('[data-video-embed-field="muted"]')?.checked,
      loop: !!fields.querySelector('[data-video-embed-field="loop"]')?.checked,
      controls: !!fields.querySelector('[data-video-embed-field="controls"]')?.checked
    };

    updateCurrentValue(stringifyVideoEmbedValue(next));
  };

  syncVideoProvider();

  videoFields.forEach(input => {
    if (!urlInput || !providerInput) return;

    if (input === urlInput) {
      input.addEventListener("input", evt => {
        if (providerInput.dataset.ebManual !== "1") {
          const detected = detectVideoProvider(urlInput.value || "", providerInput.value || "");
          providerInput.value = detected || "";
        }
        commitVideo();
        evt.stopPropagation();
      });
      return;
    }

    if (input === providerInput) {
      input.addEventListener("change", evt => {
        if (providerInput.value) {
          providerInput.dataset.ebManual = "1";
        } else {
          providerInput.dataset.ebManual = "0";
          syncVideoProvider();
        }
        commitVideo();
        evt.stopPropagation();
      });
      return;
    }
```

Reemplázalo por:

```js
const videoFields = fields.querySelectorAll("[data-video-embed-field]");
if (videoFields.length) {
  const providerInput = fields.querySelector('[data-video-embed-field="provider"]');
  const urlInput = fields.querySelector('[data-video-embed-field="url"]');

  const commitVideo = () => {
    const next = {
      provider: sanitizeVideoProvider(providerInput?.value || ""),
      url: urlInput?.value || "",
      title: fields.querySelector('[data-video-embed-field="title"]')?.value || "",
      poster_url: fields.querySelector('[data-video-embed-field="poster_url"]')?.value || "",
      aspect_ratio: fields.querySelector('[data-video-embed-field="aspect_ratio"]')?.value || "16 / 9",
      autoplay: !!fields.querySelector('[data-video-embed-field="autoplay"]')?.checked,
      muted: !!fields.querySelector('[data-video-embed-field="muted"]')?.checked,
      loop: !!fields.querySelector('[data-video-embed-field="loop"]')?.checked,
      controls: !!fields.querySelector('[data-video-embed-field="controls"]')?.checked
    };

    updateCurrentValue(stringifyVideoEmbedValue(next));
  };

  videoFields.forEach(input => {
    if (!urlInput || !providerInput) return;

    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, evt => {
      commitVideo();
      evt.stopPropagation();
    });
  });
}
```

Resultado:

- el select ya no se reescribe solo
- si dejas provider vacío, queda en modo auto real
- si eliges uno manual, sí se guarda

Regla nueva del panel:

- vacío = auto
- `youtube` / `vimeo` / `external` = manual

---

## 7. No cambiar `draftSectionValue(...)`

Archivo revisado:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

No cambies esto:

```js
if (field === "embed") {
  return buildVideoEmbedDraftFromSection(data);
}
```

Con keys por instancia ya funciona porque `splitKey(...)` y la búsqueda de `section.id` ya aíslan la sección correcta.

---

## 8. Qué corrige exactamente este fix

Después de esto:

- el provider manual ya no regresa solo a YouTube
- el aspect ratio ya no se pisa entre videos
- si hay 2 o más videos en la página, cada uno conserva su propio estado
- el video negro baja mucho porque el renderer ya no fuerza una plataforma incompatible

---

## 9. Prueba obligatoria

Haz estas pruebas exactas:

### Prueba 1 — dos videos en la misma página

1. Ten 2 secciones de video
2. Cambia el provider del primero a `external`
3. Cambia el segundo a YouTube
4. Regresa al primero

Debe seguir en `external`.

### Prueba 2 — ratio por instancia

1. En el primer video cambia ratio a `1 / 1`
2. En el segundo déjalo en `16 / 9`
3. Cambia entre ambos

Cada uno debe conservar su ratio.

### Prueba 3 — provider vacío = auto

1. Deja el select de provider vacío
2. Pega una URL YouTube
3. Guarda
4. Cierra y vuelve a tocar el video

El select debe seguir vacío, no reescribirse solo.
Pero el video debe renderizar YouTube.

### Prueba 4 — manual external

1. Usa una URL YouTube
2. Cambia provider manual a `external`
3. Regresa luego a ese video

Debe seguir en `external`.

### Prueba 5 — no negro

1. Prueba una URL Vimeo
2. Fuerza manual `youtube`
3. El sistema no debe quedarse negro

Debe caer a render resoluble o a fallback externo.

---

## Resultado esperado final

Al terminar:

- las keys de video ya no son globales
- el provider manual sí persiste
- el auto ya no pisa manual
- el ratio se guarda por video
- el negro deja de aparecer por mismatch tonto de provider/url

