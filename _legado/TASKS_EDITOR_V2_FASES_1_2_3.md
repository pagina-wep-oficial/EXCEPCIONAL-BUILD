# Guía — Implementar base de expansión del Editor V2 (Fases 1, 2 y 3)

Objetivo de esta guía

Esta guía ya no es solo un plan.
Está escrita para que vayas ejecutando cambios reales, paso por paso, como en tu guía de ejemplo.

El objetivo de estas 3 fases es dejar listo el Editor V2 para crecer de forma ordenada hacia:

- más tipos editables
- más metadata semántica
- nodos futuros reservados
- futura expansión a videos, archivos y backgrounds

Importante:

- aquí sí se implementa la base
- aquí no se implementa todavía el sistema real de videos
- Fase 4 y Fase 5 siguen aparte a propósito

Qué quedará logrado al terminar Fase 1 + 2 + 3

- `site-view.js` generará marcado más rico y consistente
- `editor-v2.js` ya no leerá solo `type` y `key`
- el editor podrá reconocer también `role`, `kind`, `section` y `future`
- los nodos futuros podrán detectarse sin volverse editables reales
- la lógica interna quedará mejor separada para crecer después

Regla central

Todavía no metas `video` como tipo editable activo.

Por ahora:

- lo activo va en `data-eb-editable`
- lo futuro va en `data-eb-future`

---

## Fase 1 — Cerrar contrato base de etiquetas HTML

Estado:

- [ ] Pendiente

Qué logra esta fase

Deja definido el idioma oficial entre las páginas y el editor.

Cuando termines esta fase:

- las páginas nuevas ya se marcan con un criterio fijo
- `site-view.js` deja listo el soporte para metadata semántica
- ya puedes empezar a reservar nodos futuros sin romper el editor actual

### 1. Expandir `editableAttrs(...)`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca:

```js
function editableAttrs(type, key, extra = "") {
  return `data-eb-editable="${safe(type)}" data-eb-key="${safe(key)}"${extra ? ` ${extra}` : ""}`;
}
```

Reemplázalo por:

```js
function editableMetaAttrs(meta = {}) {
  const attrs = [
    ["data-eb-role", meta.role || ""],
    ["data-eb-kind", meta.kind || ""],
    ["data-eb-section", meta.section || ""],
    ["data-eb-future", meta.future || ""]
  ];

  return attrs
    .filter(([, value]) => String(value || "").trim())
    .map(([name, value]) => `${name}="${safe(String(value).trim())}"`)
    .join(" ");
}

function editableAttrs(type, key, meta = {}, extra = "") {
  const metaAttrs = editableMetaAttrs(meta);
  return `data-eb-editable="${safe(type)}" data-eb-key="${safe(key)}"${metaAttrs ? ` ${metaAttrs}` : ""}${extra ? ` ${extra}` : ""}`;
}
```

Resultado:

- `editableAttrs(...)` ya podrá emitir `role`, `kind`, `section` y `future`
- todavía no cambia el comportamiento del editor; solo el contrato HTML

### 2. Expandir `editableInst(...)`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

Busca:

```js
const editableInst = (edType, type, field) => editableAttrs(edType, ik(type, field));
```

Reemplázalo por:

```js
const editableInst = (edType, type, field, meta = {}, extra = "") =>
  editableAttrs(edType, ik(type, field), meta, extra);
```

Resultado:

- los bloques con clave por instancia también podrán usar metadata extendida

### 3. Normalizar los usos actuales de `editableAttrs(...)`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\site-view.js`

No necesitas cambiar la estructura de render todavía.
Solo normaliza cada llamada actual para que ya lleve metadata semántica.

Usa esta tabla como reemplazo directo.

| Antes | Después |
|---|---|
| `editableAttrs("text", "hero.title")` | `editableAttrs("text", "hero.title", { role: "hero", kind: "title", section: "hero" })` |
| `editableAttrs("text", "hero.subtitle")` | `editableAttrs("text", "hero.subtitle", { role: "hero", kind: "subtitle", section: "hero" })` |
| `editableAttrs("buttons", "hero.buttons")` | `editableAttrs("buttons", "hero.buttons", { role: "hero", kind: "buttons", section: "hero" })` |
| `editableAttrs("image", "hero.image")` | `editableAttrs("image", "hero.image", { role: "hero", kind: "image", section: "hero" })` |
| `editableAttrs("text", "text.heading")` | `editableAttrs("text", "text.heading", { role: "text", kind: "heading", section: "text" })` |
| `editableAttrs("text", "text.body")` | `editableAttrs("text", "text.body", { role: "text", kind: "body", section: "text" })` |
| `editableAttrs("text", "gallery.heading")` | `editableAttrs("text", "gallery.heading", { role: "gallery", kind: "heading", section: "gallery" })` |
| `editableAttrs("json", "gallery.images")` | `editableAttrs("json", "gallery.images", { role: "gallery", kind: "images", section: "gallery" })` |
| `editableAttrs("image", "image.image_url")` | `editableAttrs("image", "image.image_url", { role: "image", kind: "image", section: "image" })` |
| `editableAttrs("text", "video.heading")` | `editableAttrs("text", "video.heading", { role: "video", kind: "heading", section: "video" })` |
| `editableAttrs("text", "video.description")` | `editableAttrs("text", "video.description", { role: "video", kind: "description", section: "video" })` |
| `editableAttrs("text", "testimonials.heading")` | `editableAttrs("text", "testimonials.heading", { role: "testimonials", kind: "heading", section: "testimonials" })` |
| `editableAttrs("json", "testimonials.items")` | `editableAttrs("json", "testimonials.items", { role: "testimonials", kind: "items", section: "testimonials" })` |
| `editableAttrs("text", "contact.heading")` | `editableAttrs("text", "contact.heading", { role: "contact", kind: "heading", section: "contact" })` |
| `editableAttrs("text", "contact.whatsapp")` | `editableAttrs("text", "contact.whatsapp", { role: "contact", kind: "whatsapp", section: "contact" })` |
| `editableAttrs("text", "contact.phone")` | `editableAttrs("text", "contact.phone", { role: "contact", kind: "phone", section: "contact" })` |
| `editableAttrs("text", "contact.email")` | `editableAttrs("text", "contact.email", { role: "contact", kind: "email", section: "contact" })` |
| `editableAttrs("text", "contact.address")` | `editableAttrs("text", "contact.address", { role: "contact", kind: "address", section: "contact" })` |
| `editableAttrs("link", "contact.maps_url")` | `editableAttrs("link", "contact.maps_url", { role: "contact", kind: "maps", section: "contact" })` |
| `editableAttrs("text", "hours.heading")` | `editableAttrs("text", "hours.heading", { role: "hours", kind: "heading", section: "hours" })` |
| `editableAttrs("json", "hours.items")` | `editableAttrs("json", "hours.items", { role: "hours", kind: "items", section: "hours" })` |
| `editableAttrs("text", "buttons.heading")` | `editableAttrs("text", "buttons.heading", { role: "buttons", kind: "heading", section: "buttons" })` |
| `editableAttrs("buttons", "buttons.items")` | `editableAttrs("buttons", "buttons.items", { role: "buttons", kind: "items", section: "buttons" })` |

Resultado:

- todos los nodos activos actuales ya quedan enriquecidos
- el editor todavía seguirá funcionando como antes
- Fase 2 ya tendrá metadata real que leer

### 4. Regla para páginas nuevas y nodos futuros

Todavía no cambies `editor-v2.js` aquí.
Solo deja definida esta regla para HTML nuevo:

#### Tipo activo real

```html
<img
  data-eb-editable="image"
  data-eb-key="hero.image"
  data-eb-role="hero"
  data-eb-kind="image"
  data-eb-section="hero"
  src="..."
  alt="">
```

#### Tipo futuro reservado

```html
<video
  data-eb-future="video_file"
  data-eb-key="video.interior.file"
  data-eb-role="interior"
  data-eb-kind="file"
  data-eb-section="video"
  controls
  muted
  playsinline>
</video>
```

Regla:

- si ya existe handler real: `data-eb-editable`
- si todavía no existe handler real: `data-eb-future`

### 5. Prueba de Fase 1

Revisa el HTML renderizado por el sitio y confirma esto:

1. Los nodos actuales siguen trayendo `data-eb-editable`
2. Siguen trayendo `data-eb-key`
3. Ahora también salen `data-eb-role`, `data-eb-kind` y `data-eb-section`
4. Todavía no sale lógica nueva de video

Fase 1 se marca completa cuando:

- [ ] `site-view.js` ya emite metadata extendida
- [ ] las llamadas actuales a `editableAttrs(...)` ya están normalizadas
- [ ] quedó clara la regla activo vs futuro

---

## Fase 2 — Hacer que el editor lea metadata extendida

Estado:

- [ ] Pendiente

Qué logra esta fase

Hace que `editor-v2.js` deje de ver solo “tipo + key”.

Cuando termines esta fase:

- el editor leerá `role`, `kind`, `section` y `future`
- también detectará nodos reservados futuros
- esos nodos futuros no se editarán todavía; solo se reconocerán

### 1. Ampliar el `state`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca este bloque al inicio:

```js
const state = {
  session: null,
  profile: null,
  project: null,
  pages: [],
  versions: new Map(),
  currentPageId: "",
  currentKey: "",
  currentType: "",
  mode: "edit",
  frameReady: false,
  sourceMode: "sections",
  repoPages: [],
  repoDrafts: new Map(),
  currentNodeValue: "",
  history: [],
  historyIndex: -1
};
```

Reemplázalo por:

```js
const state = {
  session: null,
  profile: null,
  project: null,
  pages: [],
  versions: new Map(),
  currentPageId: "",
  currentKey: "",
  currentType: "",
  currentRole: "",
  currentKind: "",
  currentSection: "",
  currentFuture: "",
  currentNodeMode: "active",
  mode: "edit",
  frameReady: false,
  sourceMode: "sections",
  repoPages: [],
  repoDrafts: new Map(),
  currentNodeValue: "",
  history: [],
  historyIndex: -1
};
```

Resultado:

- el editor ya tendrá dónde guardar la metadata extendida

### 2. Ampliar los resets del nodo actual

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca cada bloque repetido como este:

```js
state.currentKey = "";
state.currentType = "";
```

Reemplaza cada uno por:

```js
state.currentKey = "";
state.currentType = "";
state.currentRole = "";
state.currentKind = "";
state.currentSection = "";
state.currentFuture = "";
state.currentNodeMode = "active";
state.currentNodeValue = "";
```

Resultado:

- al cambiar página, restaurar, limpiar o salir de selección, no se quedará metadata vieja

### 3. Ampliar el selector editable

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca:

```js
const EDITABLE_SELECTOR = "[data-eb-editable]";
```

Reemplázalo por:

```js
const EDITABLE_SELECTOR = "[data-eb-editable], [data-eb-future]";
```

Resultado:

- el editor ya podrá ver nodos activos y nodos reservados

### 4. Ampliar estilos visuales del runtime

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca dentro de `ensureEditorRuntimeStyles(doc)`:

```js
style.textContent = `
  [data-eb-editable] {
    outline: 2px dashed rgba(183,255,74,.75) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
  }
`;
```

Reemplázalo por:

```js
style.textContent = `
  [data-eb-editable] {
    outline: 2px dashed rgba(183,255,74,.75) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
  }

  [data-eb-future]:not([data-eb-editable]) {
    outline: 2px dashed rgba(255,179,0,.85) !important;
    outline-offset: 3px !important;
    cursor: pointer !important;
  }
`;
```

Ahora busca dentro de `cleanEditorRuntimeMarks(doc)`:

```js
doc.querySelectorAll("[data-eb-editable]").forEach(node => {
```

Reemplázalo por:

```js
doc.querySelectorAll("[data-eb-editable], [data-eb-future]").forEach(node => {
```

Resultado:

- los nodos activos seguirán en verde
- los nodos futuros se verán distintos

### 5. Agregar lector de metadata del nodo

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Debajo de:

```js
function readNodeValue(node, type) {
  if (!node) return "";
  if (type === "image" && node.tagName === "IMG") return node.currentSrc || node.src || node.getAttribute("src") || "";
  if (type === "link" && node.tagName === "A") return node.getAttribute("href") || "";
  return node.textContent || "";
}
```

Agrega:

```js
function readNodeMeta(node) {
  const type = node?.getAttribute("data-eb-editable") || "";
  const future = node?.getAttribute("data-eb-future") || "";
  const section =
    node?.getAttribute("data-eb-section") ||
    node?.closest("[data-eb-section]")?.getAttribute("data-eb-section") ||
    "";

  return {
    key: node?.getAttribute("data-eb-key") || "",
    type: type || (future ? "future" : "text"),
    role: node?.getAttribute("data-eb-role") || "",
    kind: node?.getAttribute("data-eb-kind") || "",
    section,
    future,
    nodeMode: type ? "active" : (future ? "future" : "unknown")
  };
}
```

Resultado:

- el editor ya tendrá una sola función para leer metadata base

### 6. Reemplazar `bindEditableNodes(...)`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca la función completa:

```js
function bindEditableNodes(doc) {
  if (!doc || state.mode !== "edit") return;
  ensureEditorRuntimeStyles(doc);

  doc.querySelectorAll(EDITABLE_SELECTOR).forEach(node => {
    if (node.__ebBound) return;
    node.__ebBound = true;

    node.addEventListener("click", evt => {
      evt.preventDefault();
      evt.stopPropagation();

      state.currentKey = node.getAttribute("data-eb-key") || "";
      state.currentType = node.getAttribute("data-eb-editable") || "text";
      state.currentNodeValue = readNodeValue(node, state.currentType);
      renderSidebar();
    });
  });

  doc.querySelectorAll("a").forEach(a => {
    if (a.__ebBound) return;
    a.__ebBound = true;
    a.addEventListener("click", evt => {
      if (state.mode === "edit") {
        evt.preventDefault();
        evt.stopPropagation();
      }
    });
  });
}
```

Reemplázala por:

```js
function bindEditableNodes(doc) {
  if (!doc || state.mode !== "edit") return;
  ensureEditorRuntimeStyles(doc);

  doc.querySelectorAll(EDITABLE_SELECTOR).forEach(node => {
    if (node.__ebBound) return;
    node.__ebBound = true;

    node.addEventListener("click", evt => {
      evt.preventDefault();
      evt.stopPropagation();

      const meta = readNodeMeta(node);
      state.currentKey = meta.key;
      state.currentType = meta.type || "text";
      state.currentRole = meta.role;
      state.currentKind = meta.kind;
      state.currentSection = meta.section;
      state.currentFuture = meta.future;
      state.currentNodeMode = meta.nodeMode;
      state.currentNodeValue = meta.nodeMode === "active"
        ? readNodeValue(node, meta.type)
        : "";

      renderSidebar();
    });
  });

  doc.querySelectorAll("a").forEach(a => {
    if (a.__ebBound) return;
    a.__ebBound = true;
    a.addEventListener("click", evt => {
      if (state.mode === "edit") {
        evt.preventDefault();
        evt.stopPropagation();
      }
    });
  });
}
```

Resultado:

- al tocar un nodo, el editor ya guardará toda su metadata
- si el nodo es futuro, no intentará leerlo como texto o imagen actual

### 7. Agregar helpers para mostrar metadata y reservado futuro

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Justo antes de `function renderSidebar() {`, agrega:

```js
function renderNodeMetaSummary() {
  const rows = [
    state.currentType ? `Tipo: ${state.currentType}` : "",
    state.currentRole ? `Rol: ${state.currentRole}` : "",
    state.currentKind ? `Kind: ${state.currentKind}` : "",
    state.currentSection ? `Sección: ${state.currentSection}` : "",
    state.currentFuture ? `Future: ${state.currentFuture}` : ""
  ].filter(Boolean);

  if (!rows.length) return "";

  return `
    <div class="editor-node-meta" style="display:grid;gap:6px;margin-bottom:12px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02);font-size:12px;">
      ${rows.map(row => `<div>${safe(row)}</div>`).join("")}
    </div>
  `;
}

function renderFutureNotice() {
  return `
    <div style="display:grid;gap:8px;padding:12px;border:1px dashed rgba(255,179,0,.6);border-radius:12px;background:rgba(255,179,0,.08);">
      <strong>Elemento reservado para una función futura</strong>
      <div>Clave: ${safe(state.currentKey || "sin-clave")}</div>
      <div>Tipo futuro: ${safe(state.currentFuture || "sin-definir")}</div>
      <div>Este nodo ya está preparado, pero todavía no tiene handler real en el editor.</div>
    </div>
  `;
}
```

### 8. Reemplazar `renderSidebar()`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Busca la función completa `renderSidebar()` y reemplázala por:

```js
function renderSidebar() {
  const empty = $("#editor-v2-sidebar-empty");
  const form = $("#editor-v2-form");
  const fields = $("#editor-v2-fields");

  if (!state.currentKey || state.mode !== "edit") {
    empty.hidden = false;
    form.hidden = true;
    return;
  }

  empty.hidden = false;
  form.hidden = false;
  empty.hidden = true;

  $("#editor-v2-section-title").textContent = displayKeyLabel(state.currentKey);

  const data = currentDraftData();
  const value = data[state.currentKey]?.value ?? (state.sourceMode === "html_repo" ? state.currentNodeValue : draftSectionValue(state.currentKey));
  const type = state.currentType || data[state.currentKey]?.type || "text";

  if (state.currentNodeMode === "future") {
    fields.innerHTML = `${renderNodeMetaSummary()}${renderFutureNotice()}`;
    return;
  }

  fields.innerHTML = `${renderNodeMetaSummary()}${buildInlineFields(type, value)}`;

  fields.querySelectorAll("[data-inline-field]").forEach(input => {
    input.addEventListener("input", e => {
      updateCurrentValue(e.currentTarget.value);
    });
  });

  fields.querySelectorAll(".editor-photo-input").forEach(input => {
    input.addEventListener("change", e => {
      const file = e.currentTarget.files?.[0];
      if (!file) return;
      uploadPhoto(file);
      e.currentTarget.value = "";
    });
  });

  fields.querySelectorAll(".editor-photo-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openPhotoEditor());
  });
}
```

Resultado:

- los nodos activos seguirán mostrando UI editable
- los nodos futuros mostrarán panel informativo, no edición real

### 9. Prueba de Fase 2

Haz esta prueba:

1. Abre el editor v2
2. Toca un texto normal
3. Debes ver:
   - el editor normal
   - la caja de metadata con tipo, rol, kind y sección
4. Toca un nodo marcado solo con `data-eb-future`
5. Debes ver:
   - el borde visual del nodo futuro
   - un mensaje de “Elemento reservado”
   - sin campos de edición real

Fase 2 se marca completa cuando:

- [ ] `editor-v2.js` ya lee metadata extendida
- [ ] el panel muestra contexto del nodo
- [ ] los nodos futuros se detectan pero no se editan

---

## Fase 3 — Reordenar la lógica interna para crecer bien

Estado:

- [ ] Pendiente

Qué logra esta fase

No cambia el contrato.
No activa videos.

Lo que hace es separar un poco la lógica para que el archivo no siga creciendo como un bloque único.

Cuando termines esta fase:

- `renderSidebar()` quedará menos cargado
- `updateCurrentValue()` tendrá normalización separada
- `applyDraftToFrame()` dejará de contener toda la aplicación inline
- agregar handlers futuros será menos riesgoso

### 1. Sacar el binding del sidebar a una función separada

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `renderSidebar()`, busca este bloque:

```js
fields.querySelectorAll("[data-inline-field]").forEach(input => {
  input.addEventListener("input", e => {
    updateCurrentValue(e.currentTarget.value);
  });
});

fields.querySelectorAll(".editor-photo-input").forEach(input => {
  input.addEventListener("change", e => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    uploadPhoto(file);
    e.currentTarget.value = "";
  });
});

fields.querySelectorAll(".editor-photo-edit-btn").forEach(btn => {
  btn.addEventListener("click", () => openPhotoEditor());
});
```

Reemplázalo por:

```js
bindSidebarFieldEvents(fields);
```

Ahora, debajo de `renderSidebar()`, agrega:

```js
function bindSidebarFieldEvents(fields) {
  fields.querySelectorAll("[data-inline-field]").forEach(input => {
    input.addEventListener("input", e => {
      updateCurrentValue(e.currentTarget.value);
    });
  });

  fields.querySelectorAll(".editor-photo-input").forEach(input => {
    input.addEventListener("change", e => {
      const file = e.currentTarget.files?.[0];
      if (!file) return;
      uploadPhoto(file);
      e.currentTarget.value = "";
    });
  });

  fields.querySelectorAll(".editor-photo-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => openPhotoEditor());
  });
}
```

Resultado:

- `renderSidebar()` queda más limpia
- el binding del panel ya está aislado

### 2. Separar normalización del valor antes de guardar draft

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Antes de `function updateCurrentValue(rawValue, photoMeta) {`, agrega:

```js
function normalizeDraftValue(type, rawValue) {
  if ((type === "image" || type === "link") &&
      rawValue && !/^(https?:\/\/|data:|\/|#)/i.test(rawValue)) {
    return "https://" + rawValue;
  }

  return rawValue;
}
```

Ahora dentro de `updateCurrentValue(rawValue, photoMeta)`, busca:

```js
if ((state.currentType === "image" || state.currentType === "link") &&
    rawValue && !/^(https?:\/\/|data:|\/|#)/i.test(rawValue)) {
  rawValue = "https://" + rawValue;
}
```

Reemplázalo por:

```js
rawValue = normalizeDraftValue(state.currentType, rawValue);
```

Resultado:

- la normalización deja de estar pegada a la persistencia
- luego podrás ampliar esta función por tipo sin ensuciar `updateCurrentValue`

### 3. Separar la resolución del tipo aplicado al nodo

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Antes de `function applyDraftToFrame() {`, agrega:

```js
function resolveEntryType(node, entry) {
  return entry?.type || node.getAttribute("data-eb-editable") || "text";
}
```

Resultado:

- la decisión del tipo deja de estar repetida inline

### 4. Sacar la aplicación por nodo a una función separada

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Antes de `function applyDraftToFrame() {`, agrega:

```js
function applyEntryToNode(node, key, entry) {
  const type = resolveEntryType(node, entry);
  const value = entry?.value ?? "";

  if (type === "text") {
    node.textContent = value;
    return;
  }

  if (type === "image" && node.tagName === "IMG") {
    node.setAttribute("src", value);
    applyPhotoMetaStyles(node, entry?.meta || null);
    return;
  }

  if (type === "link" && node.tagName === "A") {
    node.setAttribute("href", value || "#");
    if (!node.textContent.trim()) node.textContent = value || "Enlace";
    return;
  }

  if (type === "buttons") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (Array.isArray(parsed)) {
        node.innerHTML = parsed.map(item => {
          const url = String(item?.url || "").trim() || "#";
          const label = String(item?.label || "Botón");
          const style = String(item?.style || "primary");
          return `<a class="site-btn ${safe(style)}" href="${safe(url)}">${safe(label)}</a>`;
        }).join("");
      }
    } catch {
      setStatus("El formato JSON de botones no es válido.", "error");
    }
    return;
  }

  if (type === "json") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) throw new Error("JSON_LIST_REQUIRED");
      const listKey = baseKey(key);

      if (listKey === "features.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `<div>${safe(typeof item === "string" ? item : (item?.text || item?.label || ""))}</div>`).join("")
          : `<div>Agrega tus ventajas aquí.</div>`;
      } else if (listKey === "gallery.images") {
        node.innerHTML = parsed.length
          ? parsed.map(img => `
              <article class="site-gallery-card">
                ${img?.url ? `<img class="site-gallery-image" src="${safe(img.url)}" alt="${safe(img.alt || img.caption || "Imagen de galería")}" loading="lazy">` : `<div class="site-media-box">Sin imagen</div>`}
                <div class="site-gallery-copy">
                  <strong>${safe(img?.caption || img?.alt || "Imagen")}</strong>
                </div>
              </article>
            `).join("")
          : `<div class="site-media-box">Sin imágenes todavía.</div>`;
      } else if (listKey === "testimonials.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `
              <article class="site-testimonial">
                <p>“${safe(item?.text || item?.body || "")}”</p>
                <strong>${safe(item?.name || item?.author || "Cliente")}</strong>
              </article>
            `).join("")
          : `<div class="site-media-box">Sin testimonios todavía.</div>`;
      } else if (listKey === "hours.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `<div class="site-hours-row"><span>${safe(item?.days || item?.day || "")}</span><span>${safe(item?.hours || item?.hour || "")}</span></div>`).join("")
          : `<div class="site-media-box">Sin horarios todavía.</div>`;
      } else if (listKey === "menu.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `
              <article class="site-menu-card" data-menu-item data-category="${safe(item?.category || "")}">
                ${item?.image ? `<div class="site-menu-card-media"><img class="site-menu-card-img" src="${safe(item.image)}" alt="${safe(item?.name || "Producto")}" loading="lazy"></div>` : ""}
                <div class="site-menu-card-body">
                  <div class="site-menu-card-head">
                    <h3>${safe(item?.name || "Producto")}</h3>
                    <strong class="site-menu-card-price">$${safe(String(item?.price ?? item?.price_from ?? ""))}</strong>
                  </div>
                  ${item?.description ? `<p>${safe(item.description)}</p>` : ""}
                  ${item?.sizes?.length ? `
                    <div class="site-menu-sizes">
                      ${item.sizes.map(size => `<span>${safe(size?.label || "")} $${safe(String(size?.price ?? ""))}</span>`).join("")}
                    </div>
                  ` : ""}
                  ${item?.tag ? `<span class="site-menu-tag">${safe(item.tag)}</span>` : ""}
                </div>
              </article>
            `).join("")
          : `<div class="site-media-box">Todavía no has agregado productos al menú.</div>`;
      }
    } catch {
      setStatus(`El contenido de ${displayKeyLabel(key)} no tiene un JSON válido.`, "error");
    }
  }
}
```

Resultado:

- la lógica de aplicar cambios ya queda aislada del recorrido general del iframe

### 5. Simplificar `applyDraftToFrame()`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\editor-v2.js`

Dentro de `applyDraftToFrame()`, busca este bloque:

```js
nodes.forEach(node => {
  const type = entry?.type || node.getAttribute("data-eb-editable") || "text";
  const value = entry?.value ?? "";

  if (type === "text") {
    node.textContent = value;
    return;
  }

  if (type === "image" && node.tagName === "IMG") {
    node.setAttribute("src", value);
    applyPhotoMetaStyles(node, entry?.meta || null);
    return;
  }

  if (type === "link" && node.tagName === "A") {
    node.setAttribute("href", value || "#");
    if (!node.textContent.trim()) node.textContent = value || "Enlace";
    return;
  }

  if (type === "buttons") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (Array.isArray(parsed)) {
        node.innerHTML = parsed.map(item => {
          const url = String(item?.url || "").trim() || "#";
          const label = String(item?.label || "Botón");
          const style = String(item?.style || "primary");
          return `<a class="site-btn ${safe(style)}" href="${safe(url)}">${safe(label)}</a>`;
        }).join("");
      }
    } catch {
      setStatus("El formato JSON de botones no es válido.", "error");
    }
    return;
  }

  if (type === "json") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) throw new Error("JSON_LIST_REQUIRED");
      const listKey = baseKey(key);

      if (listKey === "features.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `<div>${safe(typeof item === "string" ? item : (item?.text || item?.label || ""))}</div>`).join("")
          : `<div>Agrega tus ventajas aquí.</div>`;
      } else if (listKey === "gallery.images") {
        node.innerHTML = parsed.length
          ? parsed.map(img => `
              <article class="site-gallery-card">
                ${img?.url ? `<img class="site-gallery-image" src="${safe(img.url)}" alt="${safe(img.alt || img.caption || "Imagen de galería")}" loading="lazy">` : `<div class="site-media-box">Sin imagen</div>`}
                <div class="site-gallery-copy">
                  <strong>${safe(img?.caption || img?.alt || "Imagen")}</strong>
                </div>
              </article>
            `).join("")
          : `<div class="site-media-box">Sin imágenes todavía.</div>`;
      } else if (listKey === "testimonials.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `
              <article class="site-testimonial">
                <p>“${safe(item?.text || item?.body || "")}”</p>
                <strong>${safe(item?.name || item?.author || "Cliente")}</strong>
              </article>
            `).join("")
          : `<div class="site-media-box">Sin testimonios todavía.</div>`;
      } else if (listKey === "hours.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `<div class="site-hours-row"><span>${safe(item?.days || item?.day || "")}</span><span>${safe(item?.hours || item?.hour || "")}</span></div>`).join("")
          : `<div class="site-media-box">Sin horarios todavía.</div>`;
      } else if (listKey === "menu.items") {
        node.innerHTML = parsed.length
          ? parsed.map(item => `
              <article class="site-menu-card" data-menu-item data-category="${safe(item?.category || "")}">
                ${item?.image ? `<div class="site-menu-card-media"><img class="site-menu-card-img" src="${safe(item.image)}" alt="${safe(item?.name || "Producto")}" loading="lazy"></div>` : ""}
                <div class="site-menu-card-body">
                  <div class="site-menu-card-head">
                    <h3>${safe(item?.name || "Producto")}</h3>
                    <strong class="site-menu-card-price">$${safe(String(item?.price ?? item?.price_from ?? ""))}</strong>
                  </div>
                  ${item?.description ? `<p>${safe(item.description)}</p>` : ""}
                  ${item?.sizes?.length ? `
                    <div class="site-menu-sizes">
                      ${item.sizes.map(size => `<span>${safe(size?.label || "")} $${safe(String(size?.price ?? ""))}</span>`).join("")}
                    </div>
                  ` : ""}
                  ${item?.tag ? `<span class="site-menu-tag">${safe(item.tag)}</span>` : ""}
                </div>
              </article>
            `).join("")
          : `<div class="site-media-box">Todavía no has agregado productos al menú.</div>`;
      }
    } catch {
      setStatus(`El contenido de ${displayKeyLabel(key)} no tiene un JSON válido.`, "error");
    }
  }
});
```

Reemplázalo por:

```js
nodes.forEach(node => {
  applyEntryToNode(node, key, entry);
});
```

Resultado:

- `applyDraftToFrame()` queda concentrado en recorrer
- `applyEntryToNode(...)` queda concentrado en aplicar

### 6. Prueba de Fase 3

Haz esta prueba:

1. Edita un texto
2. Edita una imagen
3. Edita un link
4. Edita un bloque JSON
5. Guarda borrador
6. Cambia de página y regresa
7. Todo debe seguir funcionando igual que antes

Y además revisa en código:

- `renderSidebar()` ya no carga todo el binding inline
- `updateCurrentValue()` ya no normaliza inline
- `applyDraftToFrame()` ya no contiene toda la lógica por tipo

Fase 3 se marca completa cuando:

- [ ] el editor sigue funcionando para `text`, `image`, `link`, `buttons`, `json`
- [ ] la aplicación por tipo ya está aislada
- [ ] la normalización ya está aislada
- [ ] el binding del sidebar ya está aislado

---

## Qué NO hacer todavía

Todavía no hagas esto:

- implementar `video_file`
- implementar subida real de videos
- copiar videos al repo
- meter `data-eb-editable="video"`
- tratar `data-eb-future` como si ya fuera editable real

Eso pertenece a:

- Fase 4 — definir arquitectura de videos
- Fase 5 — implementar videos

---

## Estado manual final

Marca aquí tu avance:

- [ ] Fase 1 completada
- [ ] Fase 2 completada
- [ ] Fase 3 completada

Cuando cierres estas 3, entonces sí haces la guía aparte para:

- Fase 4
- Fase 5

