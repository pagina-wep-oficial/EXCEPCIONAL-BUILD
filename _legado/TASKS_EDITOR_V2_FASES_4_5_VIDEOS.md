# Guía — Editor V2 — Fases 4 y 5 para videos

Objetivo de esta guía

Esta guía sí está pensada para ejecutar cambios reales.

La meta aquí es:

- activar `video_embed` como tipo editable real en el Editor V2
- dejar definida la arquitectura de `video_stream`
- dejar reservado `video_file_raw` como último recurso
- no tratar videos como imágenes
- no copiar videos al repo

Lo que sí queda hecho al terminar esta guía:

- `video_embed` funciona en el editor
- el sitio renderiza YouTube, Vimeo o enlace externo como embed editable
- queda creada la tabla base de assets de video para el futuro
- el sistema ya queda nombrado con 3 niveles:
  - `video_embed`
  - `video_stream`
  - `video_file_raw`

Lo que NO queda hecho todavía:

- subida real de videos del cliente
- integración real con Cloudflare Stream
- limpieza automática de videos
- UI final de administración de assets de video

Eso queda preparado, no activado.

Regla principal

No copies videos al repo.

Las páginas publicadas pueden guardar:

- HTML
- JSON
- referencias
- metadata

Pero no el binario del video.

---

## Mapa final que debes dejar

### Tipos activos

- `text`
- `image`
- `link`
- `buttons`
- `json`
- `video_embed`

### Tipos futuros reservados

- `video_stream`
- `video_file_raw`
- `video_poster`

### Regla de marcado

#### Embed real editable

```html
<div
  data-eb-editable="video_embed"
  data-eb-key="video.embed"
  data-eb-role="video"
  data-eb-kind="embed"
  data-eb-section="video"></div>
```

#### Video propio futuro

```html
<video
  data-eb-future="video_stream"
  data-eb-key="video.stream"
  data-eb-role="video"
  data-eb-kind="stream"
  data-eb-section="video"
  controls
  playsinline></video>
```

#### Raw solo reserva

```html
<video
  data-eb-future="video_file_raw"
  data-eb-key="video.raw"
  data-eb-role="video"
  data-eb-kind="raw"
  data-eb-section="video"
  controls
  playsinline></video>
```

---

## Fase 4A — Crear tabla base de assets de video

Estado:

- [ ] Pendiente

Qué logra esta fase

Deja lista la base para que un video propio no se guarde dentro de la página, sino como asset referenciado.

Aquí no se sube video todavía.
Solo se crea la estructura correcta.

### 1. Crear archivo SQL nuevo

Archivo nuevo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-video-assets.sql`

Pega esto completo:

```sql
create table if not exists public.client_site_video_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  page_id uuid references public.client_site_pages(id) on delete set null,
  asset_key text not null,
  kind text not null,
  provider text not null,
  source_url text,
  playback_url text,
  poster_url text,
  mime_type text,
  size_bytes bigint not null default 0,
  duration_ms bigint not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  status text not null default 'draft',
  source_meta jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_site_video_assets_kind_check
    check (kind in ('video_embed','video_stream','video_file_raw')),
  constraint client_site_video_assets_provider_check
    check (provider in ('youtube','vimeo','cloudflare_stream','raw','external')),
  constraint client_site_video_assets_status_check
    check (status in ('draft','processing','ready','failed','orphan')),
  constraint client_site_video_assets_size_check
    check (size_bytes >= 0),
  constraint client_site_video_assets_duration_check
    check (duration_ms >= 0),
  constraint client_site_video_assets_width_check
    check (width >= 0),
  constraint client_site_video_assets_height_check
    check (height >= 0)
);

create index if not exists client_site_video_assets_project_idx
  on public.client_site_video_assets(project_id);

create index if not exists client_site_video_assets_page_idx
  on public.client_site_video_assets(page_id);

create index if not exists client_site_video_assets_status_idx
  on public.client_site_video_assets(status);

create index if not exists client_site_video_assets_kind_idx
  on public.client_site_video_assets(kind);

create index if not exists client_site_video_assets_project_asset_key_idx
  on public.client_site_video_assets(project_id, asset_key);

drop trigger if exists client_site_video_assets_updated_at on public.client_site_video_assets;
create trigger client_site_video_assets_updated_at
before update on public.client_site_video_assets
for each row execute function public.client_set_updated_at();

alter table public.client_site_video_assets enable row level security;

grant select, insert, update, delete on public.client_site_video_assets to authenticated;

drop policy if exists "client_site_video_assets_select_own" on public.client_site_video_assets;
create policy "client_site_video_assets_select_own"
on public.client_site_video_assets
for select
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_insert_own" on public.client_site_video_assets;
create policy "client_site_video_assets_insert_own"
on public.client_site_video_assets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_update_own" on public.client_site_video_assets;
create policy "client_site_video_assets_update_own"
on public.client_site_video_assets
for update
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
)
with check (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "client_site_video_assets_delete_own" on public.client_site_video_assets;
create policy "client_site_video_assets_delete_own"
on public.client_site_video_assets
for delete
to authenticated
using (
  exists (
    select 1
    from public.client_projects p
    where p.id = client_site_video_assets.project_id
      and (p.user_id = auth.uid() or public.is_app_admin())
  )
);
```

Resultado:

- ya existe la entidad correcta para assets de video
- `video_embed` puede vivir ahí si luego quieres auditoría centralizada
- `video_stream` ya tiene dónde existir sin mezclarse con la página

### 2. Ejecutar el SQL en Supabase

Hazlo en el SQL editor de Supabase.

Prueba rápida:

```sql
select *
from public.client_site_video_assets
limit 5;
```

Si no falla, la tabla quedó bien.

Fase 4A se marca completa cuando:

- [ ] existe `client_site_video_assets`
- [ ] tiene trigger de `updated_at`
- [ ] tiene RLS

---

## Fase 4B — Activar `video_embed` en `site-view.js`

Estado:

- [ ] Pendiente

Qué logra esta fase

Convierte el bloque actual de video en un nodo editable real del tipo `video_embed`.

Además:

- mantiene compatibilidad con `data.video_url` viejo
- ya permite guardar provider, url, title, poster, ratio y flags

### 1. Agregar helpers de video en `site-view.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Debajo de:

```js
function elementJson(key, fallback) {
  const raw = elementValue(key, "");
  if (!String(raw || "").trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
```

Agrega:

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

### 2. Ajustar el CSS del poster fallback

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.css`

Debajo de:

```css
.site-video-link{
  display:inline-flex;
  align-items:center;
  min-height:44px;
  padding:0 20px;
  border-radius:999px;
  background:#102823;
  color:#fff;
  font:800 13px/1 "DM Sans";
  text-decoration:none;
}
```

Agrega:

```css
.site-video-poster-link{
  display:grid;
  gap:12px;
  text-decoration:none;
}

.site-video-poster{
  display:block;
  width:100%;
  border-radius:18px;
  background:#0c1a16;
}
```

### 3. Reemplazar el bloque actual de `section.type === "video"`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca este bloque completo:

```js
if (section.type === "video") {
  const videoHeading = elementValue("video.heading", data.title || data.heading || "");
  const videoDescription = elementValue("video.description", data.description || "");
  const url = String(data.video_url || data.url || "").trim();
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return `
    <section class="site-section" ${editableSection("video")}>
      ${videoHeading ? `<h2 ${editableAttrs("text", "video.heading", { role: "video", kind: "heading", section: "video" })}>${safe(videoHeading)}</h2>` : ""}
      ${videoDescription ? `<p ${editableAttrs("text", "video.description", { role: "video", kind: "description", section: "video" })}>${safe(videoDescription)}</p>` : ""}
      <div class="site-video">
        ${m ? `
          <div class="site-video-frame">
            <iframe src="https://www.youtube.com/embed/${safe(m[1])}" title="${safe(videoHeading || "Video")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
        ` : url ? `<a class="site-video-link" href="${safe(url)}" target="_blank" rel="noopener">Ver video</a>` : `<div class="site-media-box">Sin video todavía.</div>`}
      </div>
    </section>
  `;
}
```

Reemplázalo por:

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

Resultado:

- el bloque de video ya sale como `video_embed`
- sigue soportando páginas viejas con `data.video_url`
- el DOM del editor ya lleva `data-eb-value`

Fase 4B se marca completa cuando:

- [ ] `site-view.js` ya renderiza `video_embed`
- [ ] YouTube sigue abriendo como iframe
- [ ] Vimeo o URL externa no rompen el render

---

## Fase 5A — Activar `video_embed` en `editor-v2.js`

Estado:

- [ ] Pendiente

Qué logra esta fase

El editor ya podrá:

- detectar el nodo `video_embed`
- abrir un panel lateral propio
- guardar provider, url, title, poster, ratio y flags
- pintar el preview en el iframe

### 1. Agregar helpers de `video_embed`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Antes de `function buildInlineFields(type, value) {`, agrega:

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

function parseVideoEmbedValue(rawValue) {
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    return defaultVideoEmbedModel(rawValue);
  }

  const raw = String(rawValue || "").trim();
  if (!raw) return defaultVideoEmbedModel({});

  try {
    return defaultVideoEmbedModel(JSON.parse(raw));
  } catch {
    return defaultVideoEmbedModel({ url: raw });
  }
}

function stringifyVideoEmbedValue(value) {
  return JSON.stringify(defaultVideoEmbedModel(value));
}

function encodeEditorValueAttr(value = "") {
  return encodeURIComponent(String(value || ""));
}

function decodeEditorValueAttr(value = "") {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

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

function buildVideoEmbedDraftFromSection(data = {}) {
  return stringifyVideoEmbedValue(defaultVideoEmbedModel({
    ...(data.video_embed && typeof data.video_embed === "object" ? data.video_embed : {}),
    url: data.video_url || data.url || "",
    title: data.title || data.heading || "",
    poster_url: data.poster_url || "",
    aspect_ratio: data.video_aspect_ratio || "16 / 9"
  }));
}
```

### 2. Agregar UI propia en `buildInlineFields(...)`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `function buildInlineFields(type, value) {`, debajo del bloque de `image`, agrega:

```js
if (type === "video_embed") {
  const video = parseVideoEmbedValue(value);
  return `
    <label class="editor-field">
      <span>Proveedor</span>
      <select data-video-embed-field="provider">
        <option value="">Detectar por URL</option>
        <option value="youtube" ${video.provider === "youtube" ? "selected" : ""}>YouTube</option>
        <option value="vimeo" ${video.provider === "vimeo" ? "selected" : ""}>Vimeo</option>
        <option value="external" ${video.provider === "external" ? "selected" : ""}>Enlace externo</option>
      </select>
    </label>

    <label class="editor-field">
      <span>URL del video</span>
      <input type="text" data-video-embed-field="url" value="${safe(video.url)}" placeholder="https://...">
    </label>

    <label class="editor-field">
      <span>Título interno</span>
      <input type="text" data-video-embed-field="title" value="${safe(video.title)}" placeholder="Video principal">
    </label>

    <label class="editor-field">
      <span>Poster opcional</span>
      <input type="text" data-video-embed-field="poster_url" value="${safe(video.poster_url)}" placeholder="https://...">
    </label>

    <label class="editor-field">
      <span>Relación</span>
      <select data-video-embed-field="aspect_ratio">
        <option value="16 / 9" ${video.aspect_ratio === "16 / 9" ? "selected" : ""}>16:9</option>
        <option value="1 / 1" ${video.aspect_ratio === "1 / 1" ? "selected" : ""}>1:1</option>
        <option value="4 / 5" ${video.aspect_ratio === "4 / 5" ? "selected" : ""}>4:5</option>
        <option value="9 / 16" ${video.aspect_ratio === "9 / 16" ? "selected" : ""}>9:16</option>
      </select>
    </label>

    <label class="check-line"><input type="checkbox" data-video-embed-field="autoplay" ${video.autoplay ? "checked" : ""}> Autoplay</label>
    <label class="check-line"><input type="checkbox" data-video-embed-field="muted" ${video.muted ? "checked" : ""}> Muted</label>
    <label class="check-line"><input type="checkbox" data-video-embed-field="loop" ${video.loop ? "checked" : ""}> Loop</label>
    <label class="check-line"><input type="checkbox" data-video-embed-field="controls" ${video.controls ? "checked" : ""}> Mostrar controles</label>

    <small>Este tipo guarda configuración del embed. No sube binarios ni copia videos al repo.</small>
  `;
}
```

### 3. Dar valor por defecto al bloque `video.embed`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `draftSectionValue(key)`, busca este bloque:

```js
if (field === "description") return data.description || "";

if (field === "image") {
  return data.image_url || data.image || "";
}
```

Reemplázalo por:

```js
if (field === "description") return data.description || "";

if (field === "embed") {
  return buildVideoEmbedDraftFromSection(data);
}

if (field === "image") {
  return data.image_url || data.image || "";
}
```

### 4. Hacer que `readNodeValue(...)` entienda `video_embed`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca:

```js
function readNodeValue(node, type) {
  if (!node) return "";
  if (type === "image" && node.tagName === "IMG") return node.currentSrc || node.src || node.getAttribute("src") || "";
  if (type === "link" && node.tagName === "A") return node.getAttribute("href") || "";
  return node.textContent || "";
}
```

Reemplázalo por:

```js
function readNodeValue(node, type) {
  if (!node) return "";
  if (type === "image" && node.tagName === "IMG") return node.currentSrc || node.src || node.getAttribute("src") || "";
  if (type === "link" && node.tagName === "A") return node.getAttribute("href") || "";
  if (type === "video_embed") return decodeEditorValueAttr(node.getAttribute("data-eb-value") || "");
  return node.textContent || "";
}
```

### 5. Normalizar `video_embed` al guardar

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `normalizeDraftValue(type, rawValue)`, busca:

```js
if ((type === "image" || type === "link") &&
    rawValue && !/^(https?:\/\/|data:|\/|#)/i.test(rawValue)) {
  return "https://" + rawValue;
}

return rawValue;
```

Reemplázalo por:

```js
if (type === "video_embed") {
  return stringifyVideoEmbedValue(parseVideoEmbedValue(rawValue));
}

if ((type === "image" || type === "link") &&
    rawValue && !/^(https?:\/\/|data:|\/|#)/i.test(rawValue)) {
  return "https://" + rawValue;
}

return rawValue;
```

### 6. Conectar eventos del panel lateral

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `bindSidebarFieldEvents(fields)`, debajo del bloque de `[data-inline-field]`, agrega:

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

### 7. Aplicar preview de `video_embed` en el iframe

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `applyEntryToNode(node, key, entry)`, debajo del bloque de `link`, agrega:

```js
if (type === "video_embed") {
  const normalized = stringifyVideoEmbedValue(parseVideoEmbedValue(value));
  node.setAttribute("data-eb-value", encodeEditorValueAttr(normalized));
  node.innerHTML = renderVideoEmbedPreview(parseVideoEmbedValue(normalized));
  return;
}
```

Resultado:

- el preview del iframe ya cambia al editar
- el valor guardado es JSON, no texto suelto

Fase 5A se marca completa cuando:

- [ ] el editor abre un panel real para `video_embed`
- [ ] cambiar URL actualiza la vista previa
- [ ] el valor guardado queda serializado como JSON

---

## Fase 5B — Definir la ruta real de `video_stream`

Estado:

- [ ] Pendiente

Qué logra esta fase

No activa subida todavía.
Solo deja claro el contrato que seguirás después.

### 1. Cambiar la convención futura

De aquí en adelante:

- ya no uses `video_file` como nombre principal
- usa `video_stream` para video propio serio
- usa `video_file_raw` solo si un día decides fallback crudo

### 2. Forma del asset futuro

Cuando sí implementes `video_stream`, la fila en `client_site_video_assets` debe verse así:

```json
{
  "id": "uuid-del-asset",
  "project_id": "uuid-del-proyecto",
  "page_id": "uuid-de-la-pagina",
  "asset_key": "video.hero.main",
  "kind": "video_stream",
  "provider": "cloudflare_stream",
  "source_url": "",
  "playback_url": "https://...",
  "poster_url": "https://...",
  "mime_type": "video/mp4",
  "size_bytes": 0,
  "duration_ms": 0,
  "width": 0,
  "height": 0,
  "status": "ready",
  "source_meta": {}
}
```

### 3. Forma del `elements` futuro

Cuando sí implementes `video_stream`, el editor NO debe guardar el binario ni la URL pegada a mano como si fuera imagen.

Debe guardar una referencia así:

```json
{
  "type": "video",
  "kind": "video_stream",
  "asset_id": "uuid-del-asset",
  "provider": "cloudflare_stream"
}
```

### 4. Estado draft vs published

Regla obligatoria:

- el draft apunta a un `asset_id`
- el published apunta a otro `asset_id` o al mismo, según publicación actual
- si cambias el video en draft, no rompes el publicado

No reemplaces archivos “en caliente” sobre el mismo publicado.

### 5. Limpieza futura

Regla obligatoria:

- si un asset lo usa `published`: no borrar
- si lo usa `draft`: no borrar
- si ya no lo usa nadie: marcar `orphan`
- borrar huérfanos después

No borres videos solo porque “ya no se ven” en una página abierta.

Fase 5B se marca completa cuando:

- [ ] ya quedó decidido `video_stream`
- [ ] ya quedó decidido `video_file_raw` como fallback, no principal
- [ ] ya quedó definida la forma del `asset_id`

---

## Fase 5C — Regla de publicación y repo

Estado:

- [ ] Pendiente

Archivo a revisar:

`C:\Users\manuel\Downloads\planes-publicacion\functions\api\editor-repo-publish.js`

Qué debes dejar claro

Hoy ese archivo ya copia imágenes de `site-images` al repo.

Eso se queda así.

No agregues lógica para:

- descargar videos
- copiarlos al repo
- reescribir videos a `/api/repo-asset/...`

Regla:

- imágenes y posters sí pueden entrar al flujo de copia
- videos no

### Verificación concreta

Revisa que `storagePublicPrefix(env)` siga apuntando solo a:

```js
/storage/v1/object/public/site-images/
```

Si un día implementas `video_stream`, la URL final del video debe seguir externa.

Ejemplo válido:

```json
{
  "playback_url": "https://videodelivery.net/..."
}
```

Ejemplo no válido:

```json
{
  "playback_url": "/api/repo-asset/.../videos/intro.mp4"
}
```

Fase 5C se marca completa cuando:

- [ ] `editor-repo-publish.js` no toca videos
- [ ] posters sí pueden seguir como imagen normal

---

## Prueba final

Haz estas pruebas en este orden:

### Prueba 1 — Compatibilidad vieja

1. Abre una página que use `data.video_url`
2. Debe seguir renderizando el video
3. El editor debe abrir ese bloque como `video_embed`

### Prueba 2 — YouTube

1. Toca el bloque de video
2. Pega una URL de YouTube
3. Cambia ratio a `1 / 1`
4. Activa `loop`
5. Guarda borrador
6. Debe verse reflejado en el iframe

### Prueba 3 — Vimeo

1. Cambia la URL por una de Vimeo
2. Debe cambiar el provider
3. Debe renderizar iframe de Vimeo

### Prueba 4 — Enlace externo + poster

1. Usa una URL externa no YouTube/Vimeo
2. Agrega `poster_url`
3. Debe mostrarse poster + botón “Ver video”

### Prueba 5 — Publish repo

1. Publica una página con `video_embed`
2. Revisa el HTML publicado
3. El video debe seguir apuntando a URL externa
4. No deben haberse agregado mp4 al repo

### Prueba 6 — Futuro reservado

1. Deja un nodo con `data-eb-future="video_stream"`
2. El editor debe mostrarlo como reservado
3. No debe abrir campos activos todavía

---

## Qué NO hacer todavía

No hagas todavía:

- bucket `site-videos`
- subida de mp4 al editor
- Cloudflare Stream API
- limpieza automática de video
- panel admin de assets de video

Eso va después de cerrar esta base.

---

## Estado manual final

Marca aquí:

- [ ] Fase 4A completada — tabla `client_site_video_assets`
- [ ] Fase 4B completada — `site-view.js` con `video_embed`
- [ ] Fase 5A completada — `editor-v2.js` con handler real
- [ ] Fase 5B completada — ruta de `video_stream` definida
- [ ] Fase 5C completada — publicación sin copiar videos

