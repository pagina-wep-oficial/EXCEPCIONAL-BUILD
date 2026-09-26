# Guía — Fix de `video_embed` (provider pegado, URLs no detectadas y preview/publicado desalineados)

Problema actual

Hay 3 fallas mezcladas:

- el `provider` puede quedarse pegado del video anterior
- varias URLs válidas no entran al parser actual
- el preview del editor y el render publicado no aplican exactamente la misma lógica

Síntomas típicos:

- un video de YouTube funciona, luego cambias a Vimeo y ya no
- un link de YouTube con parámetros distintos no entra
- Shorts no entra
- Vimeo con rutas más largas no entra
- parece problema de dimensiones, pero en realidad el bloque ya cayó al branch incorrecto

Objetivo del fix

Dejar `video_embed` estable para:

- detectar bien YouTube
- detectar bien Vimeo
- caer a `external` solo cuando de verdad no es YouTube/Vimeo
- normalizar `aspect_ratio`
- usar la misma lógica en editor y sitio publicado

No cambia:

- `video_stream`
- `video_file_raw`
- publish al repo

---

## 1. Reemplazar helpers base en `site-view.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca este bloque completo:

```js
function extractYouTubeVideoId(url = "") {
  const raw = String(url || "").trim();
  const match = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  return match?.[1] || "";
}

function extractVimeoVideoId(url = "") {
  const raw = String(url || "").trim();
  const match = raw.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  return match?.[1] || "";
}

function detectVideoProvider(url = "", explicit = "") {
  const hinted = String(explicit || "").trim().toLowerCase();
  if (hinted) return hinted;
  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";
  return url ? "external" : "";
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
    aspect_ratio: String(base.aspect_ratio || fallback.aspect_ratio || "16 / 9").trim() || "16 / 9",
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Reemplázalo por:

```js
function parseVideoUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
  }
}

function extractYouTubeVideoId(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const parsed = parseVideoUrl(raw);
  if (parsed) {
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") return parts[0] || "";

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      const byQuery = parsed.searchParams.get("v");
      if (byQuery) return byQuery;

      if (["embed", "shorts", "live"].includes(parts[0])) {
        return parts[1] || "";
      }
    }
  }

  const match = raw.match(/(?:youtube\.com\/watch.*?[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/i);
  return match?.[1] || "";
}

function extractVimeoVideoId(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const parsed = parseVideoUrl(raw);
  if (parsed) {
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "vimeo.com" || host === "player.vimeo.com" || host.endsWith(".vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean).reverse();
      const numeric = parts.find(part => /^\d{6,}$/.test(part));
      if (numeric) return numeric;
    }
  }

  const match = raw.match(/vimeo\.com\/.*?(\d{6,})(?:$|[/?#])/i);
  return match?.[1] || "";
}

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

Resultado:

- ya no se queda pegado YouTube/Vimeo si la URL cambió
- entran más variantes de URLs
- `aspect_ratio` queda limpio aunque venga como `16:9`

---

## 2. Alinear `renderVideoEmbedMarkup(...)` en `site-view.js`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca esta función completa:

```js
function renderVideoEmbedMarkup(model, fallbackTitle = "Video") {
  const title = safe(model.title || fallbackTitle || "Video");
  const ratio = safe(model.aspect_ratio || "16 / 9");
  const youtubeId = extractYouTubeVideoId(model.url);
  const vimeoId = extractVimeoVideoId(model.url);

  if (model.provider === "youtube" && youtubeId) {
    const params = new URLSearchParams({
      autoplay: model.autoplay ? "1" : "0",
      controls: model.controls ? "1" : "0",
      rel: "0",
      playsinline: "1"
    });
    if (model.loop) {
      params.set("loop", "1");
      params.set("playlist", youtubeId);
    }
    if (model.muted) params.set("mute", "1");

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://www.youtube.com/embed/${safe(youtubeId)}?${safe(params.toString())}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (model.provider === "vimeo" && vimeoId) {
    const params = new URLSearchParams({
      autoplay: model.autoplay ? "1" : "0",
      loop: model.loop ? "1" : "0",
      muted: model.muted ? "1" : "0"
    });

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://player.vimeo.com/video/${safe(vimeoId)}?${safe(params.toString())}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (model.url && model.poster_url) {
    return `
      <a class="site-video-poster-link" href="${safe(model.url)}" target="_blank" rel="noopener">
        <img class="site-video-poster" src="${safe(model.poster_url)}" alt="${title}" loading="lazy">
        <span class="site-video-link">Ver video</span>
      </a>
    `;
  }

  if (model.url) {
    return `<a class="site-video-link" href="${safe(model.url)}" target="_blank" rel="noopener">Ver video</a>`;
  }

  return `<div class="site-media-box">Sin video todavía.</div>`;
}
```

Reemplázala por:

```js
function renderVideoEmbedMarkup(model, fallbackTitle = "Video") {
  const video = buildVideoEmbedModel(model);
  const title = safe(video.title || fallbackTitle || "Video");
  const ratio = safe(video.aspect_ratio || "16 / 9");
  const youtubeId = extractYouTubeVideoId(video.url);
  const vimeoId = extractVimeoVideoId(video.url);

  if (video.provider === "youtube" && youtubeId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      controls: video.controls ? "1" : "0",
      rel: "0",
      playsinline: "1"
    });

    if (video.autoplay && !video.muted) {
      params.set("mute", "1");
      params.set("autoplay", "1");
    }

    if (video.loop) {
      params.set("loop", "1");
      params.set("playlist", youtubeId);
    }

    if (video.muted) params.set("mute", "1");

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://www.youtube.com/embed/${safe(youtubeId)}?${safe(params.toString())}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.provider === "vimeo" && vimeoId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      loop: video.loop ? "1" : "0",
      muted: video.muted ? "1" : "0"
    });

    if (video.autoplay && !video.muted) {
      params.set("muted", "1");
      params.set("autoplay", "1");
    }

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://player.vimeo.com/video/${safe(vimeoId)}?${safe(params.toString())}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.url && video.poster_url) {
    return `
      <a class="site-video-poster-link" href="${safe(video.url)}" target="_blank" rel="noopener">
        <img class="site-video-poster" src="${safe(video.poster_url)}" alt="${title}" loading="lazy">
        <span class="site-video-link">Ver video</span>
      </a>
      `;
  }

  if (video.url) {
    return `<a class="site-video-link" href="${safe(video.url)}" target="_blank" rel="noopener">Ver video</a>`;
  }

  return `<div class="site-media-box">Sin video todavía.</div>`;
}
```

Resultado:

- el render publicado usa la misma lógica robusta
- ya no habrá diferencia rara entre editor y publicación

---

## 3. Reemplazar helpers base en `editor-v2.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca este bloque completo:

```js
function extractYouTubeVideoId(url = "") {
  const raw = String(url || "").trim();
  const match = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  return match?.[1] || "";
}

function extractVimeoVideoId(url = "") {
  const raw = String(url || "").trim();
  const match = raw.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  return match?.[1] || "";
}

function detectVideoProvider(url = "", explicit = "") {
  const hinted = String(explicit || "").trim().toLowerCase();
  if (hinted) return hinted;
  if (extractYouTubeVideoId(url)) return "youtube";
  if (extractVimeoVideoId(url)) return "vimeo";
  return url ? "external" : "";
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
    aspect_ratio: String(base.aspect_ratio || "16 / 9").trim() || "16 / 9",
    autoplay: Boolean(base.autoplay),
    muted: Boolean(base.muted),
    loop: Boolean(base.loop),
    controls: base.controls !== false
  };
}
```

Reemplázalo por:

```js
function parseVideoUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
  }
}

function extractYouTubeVideoId(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const parsed = parseVideoUrl(raw);
  if (parsed) {
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") return parts[0] || "";

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      const byQuery = parsed.searchParams.get("v");
      if (byQuery) return byQuery;

      if (["embed", "shorts", "live"].includes(parts[0])) {
        return parts[1] || "";
      }
    }
  }

  const match = raw.match(/(?:youtube\.com\/watch.*?[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/i);
  return match?.[1] || "";
}

function extractVimeoVideoId(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const parsed = parseVideoUrl(raw);
  if (parsed) {
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "vimeo.com" || host === "player.vimeo.com" || host.endsWith(".vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean).reverse();
      const numeric = parts.find(part => /^\d{6,}$/.test(part));
      if (numeric) return numeric;
    }
  }

  const match = raw.match(/vimeo\.com\/.*?(\d{6,})(?:$|[/?#])/i);
  return match?.[1] || "";
}

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

Resultado:

- la normalización del editor queda igual a la del sitio
- se arregla la detección de URLs y provider

---

## 4. Alinear `renderVideoEmbedPreview(...)` en `editor-v2.js`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca la función completa:

```js
function renderVideoEmbedPreview(model) {
  const video = defaultVideoEmbedModel(model);
  const title = safe(video.title || "Video");
  const ratio = safe(video.aspect_ratio || "16 / 9");
  const youtubeId = extractYouTubeVideoId(video.url);
  const vimeoId = extractVimeoVideoId(video.url);

  if (video.provider === "youtube" && youtubeId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      controls: video.controls ? "1" : "0",
      rel: "0",
      playsinline: "1"
    });
    if (video.autoplay && !video.muted) {
      params.set("mute", "1");
      params.set("autoplay", "1");
    }
    if (video.loop) {
      params.set("loop", "1");
      params.set("playlist", youtubeId);
    }
    if (video.muted) params.set("mute", "1");

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://www.youtube.com/embed/${safe(youtubeId)}?${safe(params.toString())}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.provider === "vimeo" && vimeoId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      loop: video.loop ? "1" : "0",
      muted: video.muted ? "1" : "0"
    });

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://player.vimeo.com/video/${safe(vimeoId)}?${safe(params.toString())}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.url && video.poster_url) {
    return `
      <a class="site-video-poster-link" href="${safe(video.url)}" target="_blank" rel="noopener">
        <img class="site-video-poster" src="${safe(video.poster_url)}" alt="${title}" loading="lazy">
        <span class="site-video-link">Ver video</span>
      </a>
    `;
  }

  if (video.url) {
    return `<a class="site-video-link" href="${safe(video.url)}" target="_blank" rel="noopener">Ver video</a>`;
  }

  return `<div class="site-media-box">Sin video todavía.</div>`;
}
```

Reemplázala por:

```js
function renderVideoEmbedPreview(model) {
  const video = defaultVideoEmbedModel(model);
  const title = safe(video.title || "Video");
  const ratio = safe(video.aspect_ratio || "16 / 9");
  const youtubeId = extractYouTubeVideoId(video.url);
  const vimeoId = extractVimeoVideoId(video.url);

  if (video.provider === "youtube" && youtubeId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      controls: video.controls ? "1" : "0",
      rel: "0",
      playsinline: "1"
    });

    if (video.autoplay && !video.muted) {
      params.set("mute", "1");
      params.set("autoplay", "1");
    }

    if (video.loop) {
      params.set("loop", "1");
      params.set("playlist", youtubeId);
    }

    if (video.muted) params.set("mute", "1");

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://www.youtube.com/embed/${safe(youtubeId)}?${safe(params.toString())}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.provider === "vimeo" && vimeoId) {
    const params = new URLSearchParams({
      autoplay: video.autoplay ? "1" : "0",
      loop: video.loop ? "1" : "0",
      muted: video.muted ? "1" : "0"
    });

    if (video.autoplay && !video.muted) {
      params.set("muted", "1");
      params.set("autoplay", "1");
    }

    return `
      <div class="site-video-frame" style="aspect-ratio:${ratio};">
        <iframe src="https://player.vimeo.com/video/${safe(vimeoId)}?${safe(params.toString())}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  if (video.url && video.poster_url) {
    return `
      <a class="site-video-poster-link" href="${safe(video.url)}" target="_blank" rel="noopener">
        <img class="site-video-poster" src="${safe(video.poster_url)}" alt="${title}" loading="lazy">
        <span class="site-video-link">Ver video</span>
      </a>
    `;
  }

  if (video.url) {
    return `<a class="site-video-link" href="${safe(video.url)}" target="_blank" rel="noopener">Ver video</a>`;
  }

  return `<div class="site-media-box">Sin video todavía.</div>`;
}
```

Resultado:

- el preview del editor queda alineado con el sitio

---

## 5. Sincronizar el select de provider en el panel del editor

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca este bloque dentro de `bindSidebarFieldEvents(fields)`:

```js
const videoFields = fields.querySelectorAll("[data-video-embed-field]");
if (videoFields.length) {
  const commitVideo = () => {
    const next = {
      provider: fields.querySelector('[data-video-embed-field="provider"]')?.value || "",
      url: fields.querySelector('[data-video-embed-field="url"]')?.value || "",
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
    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, commitVideo);
  });
}
```

Reemplázalo por:

```js
const videoFields = fields.querySelectorAll("[data-video-embed-field]");
if (videoFields.length) {
  const providerInput = fields.querySelector('[data-video-embed-field="provider"]');
  const urlInput = fields.querySelector('[data-video-embed-field="url"]');

  const syncVideoProvider = () => {
    if (!providerInput || !urlInput) return;
    const detected = detectVideoProvider(urlInput.value || "", providerInput.value || "");
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
    const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventName, commitVideo);
  });
}
```

Resultado:

- al pegar una URL nueva, el select ya no se queda mostrando el provider viejo
- el panel queda coherente con lo que realmente se guardó

---

## 6. No tocar CSS estructural

Archivo revisado:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.css`

No necesitas cambiar:

```css
.site-video-frame{
  position:relative;
  width:100%;
  aspect-ratio:16/9;
  border-radius:18px;
  overflow:hidden;
  background:#0c1a16;
}
```

La base del tamaño ya está bien.
El problema principal era de provider/parser, no del frame.

---

## 7. Prueba obligatoria

Haz estas pruebas exactas:

### Prueba 1 — cambiar de YouTube a Vimeo sin tocar provider

1. Carga un video YouTube
2. Luego pega una URL Vimeo en el mismo bloque
3. Sin tocar el select manualmente
4. Debe cambiar a Vimeo solo

### Prueba 2 — YouTube con query distinta

Prueba con algo como:

```txt
https://www.youtube.com/watch?si=abc123&v=dQw4w9WgXcQ
```

Debe detectarlo como YouTube.

### Prueba 3 — YouTube Shorts

Prueba con:

```txt
https://www.youtube.com/shorts/dQw4w9WgXcQ
```

Debe detectarlo como YouTube.

### Prueba 4 — Vimeo con ruta larga

Prueba con algo como:

```txt
https://vimeo.com/channels/staffpicks/123456789
```

Debe detectarlo como Vimeo.

### Prueba 5 — URL externa

Usa una URL que no sea YouTube ni Vimeo.

Debe:

- caer a `external`
- mostrar poster si existe
- mostrar link si no existe poster

### Prueba 6 — preview y publicado

1. Guarda borrador
2. Publica
3. Compara editor vs sitio

Debe comportarse igual en:

- provider
- autoplay
- loop
- ratio

---

## Resultado esperado

Cuando termines este fix:

- ya no se pegará el provider viejo
- ya no fallarán varias URLs válidas
- el bloque no caerá por error a link externo
- el preview del editor y el sitio publicado quedarán alineados

