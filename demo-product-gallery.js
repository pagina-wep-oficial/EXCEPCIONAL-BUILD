(function () {
  "use strict";

  const store = window.DemoStore;
  const host = document.querySelector("#product-gallery");
  const adjustHost = document.querySelector("#product-media-adjust");
  const studio = document.querySelector("#media-studio");
  const openStudioButton = document.querySelector("#open-media-studio");
  const uploadInput = document.querySelector("#product-files");
  const summary = document.querySelector("#media-summary-text");
  const productForm = document.querySelector("#product-form");
  const titleNode = document.querySelector("#media-studio-title");

  let items = [];
  let busy = false;
  let activeIndex = 0;
  let activeTab = "adjust";
  let resolvedUrls = new Map();
  let previewCatalog = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";
  let previewContext = "store";

  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const currencyById = id => store.model.currencies.find(item => item.id === id) || store.model.currencies[0];
  const currentSettings = () => store.state.imageSettings || {};
  const isStudioOpen = () => studio && !studio.hidden;
  const hasItems = () => items.length > 0;
  const imageCount = () => items.filter(item => item.type !== "video").length;
  const videoCount = () => items.filter(item => item.type === "video").length;
  const selectedItem = () => items[activeIndex] || null;

  const CROP_RATIOS = { "1/1": "1 / 1", "4/3": "4 / 3", "3/4": "3 / 4" };
  const cropRatio = item => CROP_RATIOS[item?.crop] || "";

  const icon = name => ({
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3"></rect><circle cx="8.4" cy="9.2" r="1.7"></circle><path d="M5.5 17.2 10.2 12.6 13.2 15.6 15.7 13.2 18.5 16"></path></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="12.5" height="14" rx="3"></rect><path d="m16 10 4.5-2.7v9.4L16 14"></path></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.4 4.8 5.3.8-3.8 3.7.9 5.2L12 15.7 7.2 18.3l.9-5.2-3.8-3.7 5.3-.8z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h15"></path><path d="M9.5 3.8h5l.8 2.2H8.7z"></path><path d="m7.2 7.5.8 11a2 2 0 0 0 2 1.8h4a2 2 0 0 0 2-1.8l.8-11"></path><path d="M10 10.5v6.2M14 10.5v6.2"></path></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 5.5-6.5 6.5 6.5 6.5"></path></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 5.5 6.5 6.5-6.5 6.5"></path></svg>',
    cover: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"></rect></svg>',
    contain: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"></rect><rect x="8" y="8" width="8" height="8" rx="1.2"></rect></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 7.5V3.8"></path><path d="M5.5 3.8h3.7"></path><path d="M6.3 12A6.7 6.7 0 1 0 8 7.7"></path></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6h2.2l1.6 7.5h8l1.8-5.3H8.8"></path><circle cx="10.2" cy="18.5" r="1"></circle><circle cx="16.2" cy="18.5" r="1"></circle></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5"></path><path d="M8 16H6.8a3.3 3.3 0 1 1 0-6.6H10"></path><path d="M14 8h3.2a3.3 3.3 0 1 1 0 6.6H14"></path></svg>',
    preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.4-5.8 9.2-5.8 9.2 5.8 9.2 5.8-3.4 5.8-9.2 5.8S2.8 12 2.8 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>',
    rotateLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4V3"></path><path d="M4.5 7A8 8 0 1 1 3 13"></path></svg>',
    rotateRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 7h4V3"></path><path d="M19.5 7A8 8 0 1 0 21 13"></path></svg>',
    flipH: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16"></path><path d="m4 7 5 5-5 5zM20 7l-5 5 5 5z"></path></svg>',
    flipV: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"></path><path d="m7 4 5 5 5-5zM7 20l5-5 5 5z"></path></svg>',
    crop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v15a3 3 0 0 0 3 3h12M3 6h15a3 3 0 0 1 3 3v12"></path></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>'
  }[name] || "");

  const emptyIllustration = () => `<div class="studio-empty-art" aria-hidden="true">${icon("image")}</div>`;
  const placeholderCardMedia = () => `<div class="studio-card-placeholder">${emptyIllustration()}<strong>Sin medio seleccionado</strong><small>Agrega una foto o video para empezar a diseñar la tarjeta del producto.</small></div>`;

  function status(message) {
    const node = document.querySelector("#product-status");
    if (node) node.textContent = message || "";
  }

  function itemLabel(item, index) {
    if (!item) return "Medio";
    if (item.type === "video") return "Video del producto";
    const order = items.slice(0, index + 1).filter(entry => entry.type !== "video").length;
    return `Imagen ${order}`;
  }

  function counterLabel(item) {
    if (!item) return "";
    if (item.type === "video") return "Video";
    const order = items.slice(0, activeIndex + 1).filter(entry => entry.type !== "video").length;
    return `Imagen ${order} de ${imageCount()}`;
  }

  function normalizeSelection() {
    if (!items.length) { activeIndex = 0; return; }
    activeIndex = clamp(activeIndex, 0, items.length - 1);
  }

  function countsLabel() {
    const photos = imageCount();
    const videos = videoCount();
    if (!photos && !videos) return "Agrega imágenes para mostrar mejor tu producto.";
    return `${photos} imagen${photos === 1 ? "" : "es"}${videos ? ` · ${videos} video` : ""}. Edita el encuadre y revisa la vista previa del producto.`;
  }

  function normalizeMediaOrder() {
    const selected = items[activeIndex] || null;
    const images = items.filter(item => item.type !== "video");
    const videos = items.filter(item => item.type === "video");
    const primary = images.find(item => item.is_primary) || images[0] || null;
    const remaining = images.filter(item => item !== primary);

    images.forEach(item => { item.is_primary = item === primary; });
    items = primary ? [primary, ...remaining, ...videos] : [...videos];

    const selectedPosition = selected ? items.indexOf(selected) : -1;
    activeIndex = selectedPosition >= 0 ? selectedPosition : 0;
  }

  function commit() {
    normalizeMediaOrder();
    normalizeSelection();
    if (summary) summary.textContent = countsLabel();
    window.dispatchEvent(new CustomEvent("demo-gallery-change"));
    if (isStudioOpen()) renderStudio();
  }

  async function previewSource(item) {
    try {
      return item ? await window.DemoMedia.resolve(item.source_url) : "";
    } catch {
      return "";
    }
  }

  function productDraft() {
    const isExternal = previewCatalog === "external_catalog";
    const form = productForm;
    const currency = currencyById(form?.elements.currency_id?.value);
    const price = Number(form?.elements.price?.value || 0);
    const compareAtPrice = Number(form?.elements.compareAtPrice?.value || 0);
    const hasPrice = form && form.elements.price && form.elements.price.value !== "" && (previewCatalog === "commerce" || form.elements.external_price_visible.checked);
    const amount = value => `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value)} ${currency.display_label}`;
    const priceHtml = hasPrice
      ? `<span class="price">${compareAtPrice > price ? `<del>${amount(compareAtPrice)}</del> ` : ""}${amount(price)}</span>`
      : "";
    return {
      name: form?.elements.name?.value.trim() || "Nombre del producto",
      category: form?.elements.category?.value || "Categoría",
      description: form?.elements.description?.value.trim() || "Aquí verás cómo se presentará la descripción al público dentro de la tarjeta del producto.",
      priceHtml,
      type: isExternal ? "external_catalog" : "commerce",
      cta: isExternal ? (store.model.catalogs.external_catalog.settings?.ctaLabel || "Ver oferta") : "Agregar",
      secondaryCta: isExternal ? "Abrir detalle" : "Ver producto"
    };
  }

  function mediaStyle(item, large = false) {
    const settings = currentSettings();
    const fit = item?.fit_mode === "cover" || item?.fit_mode === "contain" ? item.fit_mode : (settings.fitMode || "contain");
    const x = clamp(item?.focal_x ?? 50, 0, 100);
    const y = clamp(item?.focal_y ?? 50, 0, 100);
    const zoom = clamp(item?.zoom ?? 1, 1, 3);
    const rotation = clamp(item?.rotation ?? 0, -180, 180);
    const scale = large ? zoom : Math.min(zoom, 2.4);
    return `object-fit:${fit};object-position:${x}% ${y}%;transform:scale(${scale}) rotate(${rotation}deg) scaleX(${item?.flip_x ? -1 : 1}) scaleY(${item?.flip_y ? -1 : 1})`;
  }

  function stageMediaStyle(item) {
    const ratio = cropRatio(item);
    const fit = ratio ? "cover" : (item?.fit_mode === "cover" ? "cover" : "contain");
    const x = clamp(item?.focal_x ?? 50, 0, 100);
    const y = clamp(item?.focal_y ?? 50, 0, 100);
    const zoom = clamp(item?.zoom ?? 1, 1, 3);
    const rotation = clamp(item?.rotation ?? 0, -180, 180);
    return `object-fit:${fit};object-position:${x}% ${y}%;transform:scale(${zoom}) rotate(${rotation}deg) scaleX(${item?.flip_x ? -1 : 1}) scaleY(${item?.flip_y ? -1 : 1})`;
  }

  function previewMediaMarkup(item, className = "", live = false) {
    const classes = className ? ` ${className}` : "";
    if (!item) return `<div class="studio-preview-media-placeholder${classes}">Sin imagen</div>`;

    const url = resolvedUrls.get(item) || item.source_url || item.url || item.data_url || item.preview_url || "";
    if (!url) return `<div class="studio-preview-media-placeholder${classes}">Sin imagen</div>`;

    const style = mediaStyle(item, true);

    if (item.type === "video" || String(item.mime_type || "").startsWith("video/")) {
      return `<video class="studio-preview-media${classes}" src="${safe(url)}" style="${style}" muted playsinline controls></video>`;
    }

    return `<img class="studio-preview-media${classes}" src="${safe(url)}" alt="${safe(item.alt_text || productDraft().name || "Producto")}" style="${style}"${live ? " data-live-media" : ""}>`;
  }

  function previewPrice(draft) {
    return draft.priceHtml || "";
  }

  function previewImages() {
    const media = Array.isArray(items) ? items.slice() : [];
    return [
      ...media.filter(item => item.type !== "video"),
      ...media.filter(item => item.type === "video")
    ];
  }

  function liveFrameStyle(item) {
    const ratio = cropRatio(item);
    return ratio ? `aspect-ratio:${ratio}` : "";
  }

  function featuredImageMarkup(item) {
    const url = item?.source_url || item?.url || item?.data_url || item?.preview_url || "";
    if (!url) {
      return `<img class="home-featured-image-media" src="demo-casa-nopal/assets/home-chilaquiles-900.jpg" alt="Producto" style="object-fit:cover;object-position:50% 50%;transform:scale(1) rotate(0deg) scaleX(1) scaleY(1)" data-live-media>`;
    }
    return previewMediaMarkup(item, "home-featured-image-media", true);
  }

  function featuredPreviewMarkup() {
    const draft = productDraft();
    const image = selectedItem();

    return `
      <div class="studio-featured-preview">
        <article class="home-featured-card">
          <div class="home-featured-image" data-live-frame style="${liveFrameStyle(image)}">
            ${featuredImageMarkup(image)}
          </div>
          <div class="home-featured-body">
            <span class="home-featured-category">${safe(draft.category || "Producto")}</span>
            <h3>${safe(draft.name || "Nombre del producto")}</h3>
            <p class="home-featured-description">${safe(draft.description || "Descripción del producto")}</p>
            <div class="home-featured-bottom">
              ${previewPrice(draft)}
              <span class="button primary">Ver producto</span>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function storePreviewMarkup() {
    const draft = productDraft();
    const image = selectedItem();
    const external = previewCatalog === "external_catalog";

    return `
      <article class="product-card">
        <div class="product-media-frame" data-live-frame style="${liveFrameStyle(image)}">
          ${previewMediaMarkup(image, "product-card-media", true)}
        </div>
        <div class="product-body">
          <div class="product-meta">
            <span class="category">${safe(draft.category || "Producto")}</span>
            ${previewPrice(draft)}
          </div>
          <h2>${safe(draft.name || "Nombre del producto")}</h2>
          <p>${safe(draft.description || "Descripción del producto")}</p>
          <div class="product-actions">
            ${external ? "" : `<button class="button primary" type="button">Agregar</button>`}
            <button class="button secondary" type="button">Ver producto</button>
          </div>
        </div>
      </article>
    `;
  }

  function detailPreviewMarkup() {
    const draft = productDraft();
    const media = previewImages();
    const main = selectedItem() || media[0];
    const external = previewCatalog === "external_catalog";

    return `
      <article class="detail-view">
        <div class="detail-gallery">
          <div class="detail-media" data-live-frame style="${liveFrameStyle(main)}">
            ${previewMediaMarkup(main, "detail-main-image", true)}
          </div>
          ${
            media.length > 1
              ? `<div class="detail-thumbnails">
                  ${media.slice(0, 5).map((item, index) => `
                    <button class="detail-thumbnail${items.indexOf(item) === activeIndex ? " is-active" : ""}" type="button">
                      ${previewMediaMarkup(item, "detail-thumbnail-media")}
                    </button>
                  `).join("")}
                </div>`
              : ""
          }
        </div>

        <div class="detail-copy">
          <span class="section-kicker">${safe(draft.category || "Producto")}</span>
          <h1>${safe(draft.name || "Nombre del producto")}</h1>
          <p>${safe(draft.description || "Descripción del producto")}</p>
          ${previewPrice(draft)}
          <div class="detail-actions">
            ${
              external
                ? `<button class="button primary" type="button">Ver oferta ↗</button>`
                : `
                  <label class="quantity">
                    <span>Cantidad</span>
                    <input type="number" min="1" value="1">
                  </label>
                  <button class="button primary" type="button">Agregar al carrito</button>
                  <button class="button secondary" type="button">Ir al carrito</button>
                `
            }
          </div>
        </div>
      </article>
    `;
  }

  function contextPreviewMarkup() {
    if (previewContext === "featured") return featuredPreviewMarkup();
    if (previewContext === "detail") return detailPreviewMarkup();
    return storePreviewMarkup();
  }

  function previewBoardMarkup() {
    const mode = previewCatalog === "external_catalog" ? "Catálogo" : "Tienda";
    const contexts = [
      ["featured", "Destacados"],
      ["store", mode],
      ["detail", "Detalle"]
    ];

    return `
      <section class="studio-live-shell" aria-label="Vista en vivo">
        <header class="studio-live-head">
          <div>
            <p class="studio-kicker">Vista en vivo</p>
            <h3>Así se ve tu producto</h3>
            <p>Se muestra el medio que estás editando, en su contexto real.</p>
          </div>
          <span class="studio-mode-badge">${safe(mode)}</span>
        </header>

        <div class="studio-context-tabs" role="tablist" aria-label="Contexto">
          ${contexts.map(([value, label]) => `
            <button type="button" class="studio-context-tab${previewContext === value ? " is-active" : ""}" data-preview-context="${value}" role="tab" aria-selected="${previewContext === value ? "true" : "false"}">${label}</button>
          `).join("")}
        </div>

        <div class="studio-live-stage">
          <div class="studio-device">
            <div class="studio-device-bar"><span></span><span></span><span></span><em>${safe(mode)} · ${safe(previewContext === "featured" ? "Destacados" : previewContext === "detail" ? "Detalle" : mode)}</em></div>
            <div class="studio-device-screen">
              <div class="studio-preview-public-shell" data-context="${safe(previewContext)}">
                ${contextPreviewMarkup()}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function sliderRow(label, name, value, min, max, step, suffix = "") {
    const printable = `${Number(value).toFixed(step < 1 ? 2 : 0)}${suffix}`.replace(/\.00(?=[^\d]|$)/, "");
    return `
      <label class="studio-range-row">
        <span>${safe(label)}<strong data-range-value="${safe(name)}">${safe(printable)}</strong></span>
        <input type="range" data-media-field="${safe(name)}" min="${min}" max="${max}" step="${step}" value="${safe(value)}">
      </label>
    `;
  }

  function fitToggleMarkup(item) {
    return `
      <div class="studio-fit-toggle" role="group" aria-label="Ajuste de imagen">
        <button type="button" class="${item.fit_mode === "cover" ? "is-active" : ""}" data-set-fit="cover">${icon("cover")}<span>Llenar espacio</span></button>
        <button type="button" class="${item.fit_mode !== "cover" ? "is-active" : ""}" data-set-fit="contain">${icon("contain")}<span>Mostrar completa</span></button>
      </div>
    `;
  }

  function cropTabMarkup(item) {
    const ratios = [
      ["original", "Original", "Sin recorte"],
      ["1/1", "1:1", "Cuadrada"],
      ["4/3", "4:3", "Horizontal"],
      ["3/4", "3:4", "Vertical"]
    ];
    return `
      <div class="studio-crop-grid" role="group" aria-label="Proporción de recorte">
        ${ratios.map(([value, label, helper]) => `
          <button type="button" class="studio-crop-chip${(item.crop || "original") === value ? " is-active" : ""}" data-set-crop="${value}">
            <span class="studio-crop-shape studio-crop-${safe(value)}"><i></i></span>
            <span class="studio-crop-meta"><strong>${label}</strong><small>${helper}</small></span>
          </button>
        `).join("")}
      </div>
      <p class="studio-tab-hint">El recorte solo cambia el encuadre; tu imagen original se conserva intacta.</p>
    `;
  }

  function rotateTabMarkup(item) {
    return `
      <div class="studio-rotate-grid" role="group" aria-label="Girar y voltear">
        <button type="button" data-rotate="-90">${icon("rotateLeft")}<span>Girar 90°</span></button>
        <button type="button" data-rotate="90">${icon("rotateRight")}<span>Girar 90°</span></button>
        <button type="button" class="${item.flip_x ? "is-active" : ""}" data-flip="x">${icon("flipH")}<span>Voltear horizontal</span></button>
        <button type="button" class="${item.flip_y ? "is-active" : ""}" data-flip="y">${icon("flipV")}<span>Voltear vertical</span></button>
      </div>
      ${sliderRow("Rotación fina", "rotation", clamp(item.rotation ?? 0, -180, 180), -180, 180, 1, "°")}
    `;
  }

  function adjustTabMarkup(item) {
    return `
      ${fitToggleMarkup(item)}
      ${sliderRow("Zoom", "zoom", clamp(item.zoom ?? 1, 1, 3), 1, 3, 0.01, "x")}
      ${sliderRow("Posición horizontal", "focal_x", clamp(item.focal_x ?? 50, 0, 100), 0, 100, 1, "%")}
      ${sliderRow("Posición vertical", "focal_y", clamp(item.focal_y ?? 50, 0, 100), 0, 100, 1, "%")}
    `;
  }

  function inspectorMarkup(item, source) {
    if (!item) {
      return `
        <section class="studio-editor-shell">
          <section class="studio-editor-empty">
            ${emptyIllustration()}<strong>Selecciona una foto o un video</strong><p>Aquí editarás el medio elegido y verás el resultado al instante en la vista en vivo.</p>
          </section>
        </section>
      `;
    }

    const isVideo = item.type === "video";
    const stage = isVideo
      ? `<video src="${safe(source)}" controls playsinline preload="metadata" class="studio-editor-stage-media"></video>`
      : `<img src="${safe(source)}" alt="${safe(itemLabel(item, activeIndex))}" class="studio-editor-stage-media" style="${stageMediaStyle(item)}">`;

    const tabs = [
      ["adjust", "Ajustar"],
      ["crop", "Recortar"],
      ["rotate", "Girar"]
    ];

    const controls = isVideo
      ? `<div class="studio-video-note">${icon("video")}<div><strong>Video listo para publicar</strong><p>En el sitio se mostrará con controles propios. Aquí solo puedes conservarlo, reordenarlo o reemplazarlo.</p></div></div>`
      : activeTab === "crop"
        ? cropTabMarkup(item)
        : activeTab === "rotate"
          ? rotateTabMarkup(item)
          : adjustTabMarkup(item);

    return `
      <section class="studio-editor-shell">
        <header class="studio-editor-nav">
          <button type="button" class="studio-nav-arrow" data-step-media="-1" ${activeIndex === 0 ? "disabled" : ""} aria-label="Medio anterior">${icon("left")}</button>
          <span class="studio-editor-counter">${safe(counterLabel(item))}</span>
          <button type="button" class="studio-nav-arrow" data-step-media="1" ${activeIndex === items.length - 1 ? "disabled" : ""} aria-label="Medio siguiente">${icon("right")}</button>
          <span class="studio-editor-kind ${isVideo ? "is-video" : ""}">${isVideo ? icon("video") : icon("image")}${isVideo ? "Video" : "Imagen"}</span>
        </header>

        <div class="studio-editor-stage" style="${cropRatio(item) ? `aspect-ratio:${cropRatio(item)}` : ""}">
          ${stage}
        </div>

        ${isVideo ? "" : `
          <div class="studio-editor-tabs" role="tablist" aria-label="Herramientas de edición">
            ${tabs.map(([value, label]) => `
              <button type="button" class="${activeTab === value ? "is-active" : ""}" data-editor-tab="${value}" role="tab" aria-selected="${activeTab === value ? "true" : "false"}">${label}</button>
            `).join("")}
          </div>
        `}

        <div class="studio-editor-controls">
          ${controls}
        </div>

        <div class="studio-editor-actions">
          ${isVideo ? "" : `<button type="button" class="studio-outline-button ${item.is_primary ? "is-active" : ""}" data-set-primary>${icon("star")}${item.is_primary ? "Principal" : "Usar principal"}</button>`}
          ${isVideo ? "" : `
            <button type="button" class="studio-outline-button" data-move-selected="-1" ${activeIndex <= 1 ? "disabled" : ""}>${icon("left")}Mover</button>
            <button type="button" class="studio-outline-button" data-move-selected="1" ${activeIndex === items.length - 1 || items[activeIndex + 1]?.type === "video" ? "disabled" : ""}>${icon("right")}Mover</button>
          `}
          <button type="button" class="studio-outline-button is-danger" data-delete-selected>${icon("trash")}Eliminar</button>
        </div>

        ${isVideo ? "" : `<button type="button" class="studio-reset-button" data-reset-image>${icon("reset")}Restablecer ajustes</button>`}
      </section>
    `;
  }

  function mediaTileMarkup(item, index, source) {
    const style = item.type === "image" ? ` style="${mediaStyle(item)}"` : "";
    return `
      <button type="button" class="studio-media-tile${index === activeIndex ? " is-active" : ""}${item.is_primary ? " is-primary" : ""}" data-select-media="${index}">
        <div class="studio-media-thumb">
          ${item.type === "video" ? `<video src="${safe(source)}" muted playsinline preload="metadata"></video><span class="studio-tile-kind">${icon("video")}Video</span>` : `<img src="${safe(source)}" alt="${safe(itemLabel(item, index))}"${style}><span class="studio-tile-kind">${icon("image")}Foto</span>`}
          ${item.is_primary ? `<span class="studio-tile-primary">${icon("star")}Principal</span>` : ""}
        </div>
        <span class="studio-media-caption">${safe(itemLabel(item, index))}</span>
      </button>
    `;
  }

  function addTileMarkup(intent, label, helper, disabled) {
    const iconName = intent === "video" ? "video" : intent === "primary" ? "star" : "plus";
    return `
      <label class="studio-add-tile${disabled ? " is-disabled" : ""}">
        <span class="studio-add-icon">${icon(iconName)}</span>
        <strong>${safe(label)}</strong>
        <small>${safe(helper)}</small>
        <span class="studio-add-hit" data-upload-intent="${safe(intent)}" ${disabled ? 'aria-disabled="true"' : ''}></span>
      </label>
    `;
  }

  function libraryMarkup(sources) {
    return `
      <section class="studio-library-shell">
        <header class="studio-library-head">
          <div>
            <p class="studio-kicker">Biblioteca de medios</p>
            <h3>${imageCount()}/5 fotos · ${videoCount()}/1 video</h3>
          </div>
          <button type="button" class="studio-close-inline" data-close-media>Volver al producto</button>
        </header>

        <div class="studio-add-strip">
          ${addTileMarkup("primary", "Foto principal", "Define la portada del producto.", imageCount() >= 5 && !items.some(item => item.is_primary && item.type !== "video"))}
          ${addTileMarkup("extra", "Más fotos", "Apoyo para el carrusel.", imageCount() >= 5)}
          ${addTileMarkup("video", "Video", "Uno corto y con audio.", videoCount() >= 1)}
        </div>

        <div class="studio-media-strip${items.length ? "" : " is-empty"}">
          ${items.length ? sources.map((source, index) => mediaTileMarkup(items[index], index, source)).join("") : `<div class="studio-empty-library">${emptyIllustration()}<strong>Sin medios cargados</strong><p>Agrega una foto principal para empezar.</p></div>`}
        </div>
      </section>
    `;
  }

  async function renderStudio() {
    if (!host || !adjustHost) return;
    normalizeSelection();
    const selected = selectedItem();
    const sources = await Promise.all(items.map(item => previewSource(item)));
    resolvedUrls = new Map(items.map((item, index) => [item, sources[index]]));
    const currentSource = selected ? sources[activeIndex] : "";

    host.innerHTML = `${previewBoardMarkup()}${libraryMarkup(sources)}`;
    adjustHost.hidden = false;
    adjustHost.innerHTML = inspectorMarkup(selected, currentSource);

    bindStudioInteractions();
  }

  function refreshStudioMedia() {
    const item = selectedItem();
    if (!item) return;

    const liveStyle = mediaStyle(item, true);
    const stageStyle = stageMediaStyle(item);

    adjustHost.querySelector(".studio-editor-stage")?.style.setProperty("aspect-ratio", cropRatio(item) || "auto");
    adjustHost.querySelector(".studio-editor-stage-media")?.setAttribute("style", stageStyle);
    host.querySelectorAll("[data-live-media]").forEach(el => el.setAttribute("style", liveStyle));
  }

  function bindStudioInteractions() {
    host.querySelectorAll("[data-upload-intent]").forEach(node => {
      node.addEventListener("click", event => {
        if (node.getAttribute("aria-disabled") === "true") return;
        uploadInput.dataset.intent = node.dataset.uploadIntent || "extra";
        event.preventDefault();
        uploadInput.click();
      });
    });

    host.querySelectorAll("[data-select-media]").forEach(button => button.addEventListener("click", () => {
      activeIndex = Number(button.dataset.selectMedia) || 0;
      renderStudio();
    }));

    host.querySelectorAll("[data-preview-context]").forEach(button => {
      button.addEventListener("click", () => {
        previewContext = button.dataset.previewContext || "store";
        renderStudio();
      });
    });

    const selected = selectedItem();
    if (!selected) return;

    adjustHost.querySelectorAll("[data-step-media]").forEach(button => button.addEventListener("click", () => {
      const step = Number(button.dataset.stepMedia || 0);
      activeIndex = clamp(activeIndex + step, 0, items.length - 1);
      renderStudio();
    }));

    adjustHost.querySelectorAll("[data-editor-tab]").forEach(button => button.addEventListener("click", () => {
      activeTab = button.dataset.editorTab || "adjust";
      renderStudio();
    }));

    adjustHost.querySelectorAll("[data-media-field]").forEach(input => input.addEventListener("input", () => {
      const field = input.dataset.mediaField;
      const item = selectedItem();
      if (!field || !item) return;
      item[field] = Number(input.value);
      const label = input.closest(".studio-range-row")?.querySelector("strong");
      if (label) {
        const step = Number(input.step) || 1;
        label.textContent = `${Number(input.value).toFixed(step < 1 ? 2 : 0)}${field === "zoom" ? "x" : field === "rotation" ? "°" : "%"}`;
      }
      refreshStudioMedia();
    }));

    adjustHost.querySelectorAll("[data-set-fit]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.fit_mode = button.dataset.setFit === "contain" ? "contain" : "cover";
      commit();
    }));

    adjustHost.querySelectorAll("[data-set-crop]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.crop = button.dataset.setCrop === "original" ? undefined : button.dataset.setCrop;
      commit();
    }));

    adjustHost.querySelectorAll("[data-rotate]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.rotation = clamp((item.rotation ?? 0) + Number(button.dataset.rotate || 0), -180, 180);
      commit();
    }));

    adjustHost.querySelectorAll("[data-flip]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      if (button.dataset.flip === "x") item.flip_x = !item.flip_x;
      else item.flip_y = !item.flip_y;
      commit();
    }));

    adjustHost.querySelector("[data-reset-image]")?.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      Object.assign(item, { fit_mode: "inherit", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0, flip_x: false, flip_y: false, crop: undefined });
      commit();
    });

    adjustHost.querySelector("[data-set-primary]")?.addEventListener("click", () => {
      const current = selectedItem();
      if (!current || current.type === "video") return;
      items = [current, ...items.filter((entry, index) => index !== activeIndex)];
      items.forEach((entry, index) => { entry.is_primary = index === 0 && entry.type !== "video"; });
      activeIndex = 0;
      commit();
    });

    adjustHost.querySelectorAll("[data-move-selected]").forEach(button => button.addEventListener("click", () => {
      const current = selectedItem();
      const from = activeIndex;
      const to = from + Number(button.dataset.moveSelected || 0);
      if (!current || current.type === "video" || current.is_primary || to < 1 || to >= items.length || items[to]?.type === "video") return;
      [items[from], items[to]] = [items[to], items[from]];
      activeIndex = to;
      items = window.DemoStore.validateMedia(items);
      commit();
    }));

    adjustHost.querySelector("[data-delete-selected]")?.addEventListener("click", () => {
      items.splice(activeIndex, 1);
      items = window.DemoStore.validateMedia(items);
      activeIndex = Math.max(0, activeIndex - (activeIndex >= items.length ? 1 : 0));
      commit();
    });
  }

  function set(next) {
    items = window.DemoStore.validateMedia(next || []);
    normalizeMediaOrder();
    activeIndex = items.findIndex(item => item.is_primary);
    if (activeIndex < 0) activeIndex = 0;
    commit();
  }

  function append(next) {
    items = window.DemoStore.validateMedia([...items, ...next]);
    if (!hasItems()) activeIndex = 0;
    commit();
  }

  openStudioButton?.addEventListener("click", () => {
    if (!studio) return;
    previewCatalog = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";
    activeTab = "adjust";
    titleNode.textContent = "Fotos y video del producto";
    studio.hidden = false;
    studio.classList.add("is-open");
    document.body.classList.add("has-open-studio");
    renderStudio();
  });

  function closeStudio() {
    if (!studio) return;
    studio.hidden = true;
    studio.classList.remove("is-open");
    document.body.classList.remove("has-open-studio");
  }

  studio?.addEventListener("click", event => {
    if (event.target.closest("[data-close-media]")) closeStudio();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isStudioOpen()) closeStudio();
  });

  uploadInput?.addEventListener("change", async event => {
    if (busy) return;
    busy = true;
    const intent = uploadInput.dataset.intent || "extra";
    try {
      const files = Array.from(event.target.files || []);
      const accepted = intent === "video"
        ? files.filter(file => file.type.startsWith("video/"))
        : files.filter(file => file.type.startsWith("image/"));

      if (!accepted.length) throw new Error(intent === "video" ? "Elige un video válido." : "Elige una imagen válida.");
      if (intent === "primary" && accepted.length > 1) throw new Error("Elige una sola imagen principal.");
      if (intent !== "video" && imageCount() + accepted.length > 5) throw new Error("Puedes agregar hasta 5 imágenes.");
      if (intent === "video" && videoCount() + accepted.length > 1) throw new Error("Solo se permite 1 video por producto.");

      const staged = [];
      for (const file of accepted) staged.push(await window.DemoMedia.save(file));

      if (intent === "video") {
        items = items.filter(item => item.type !== "video");
        items = window.DemoStore.validateMedia([...items, staged[0]]);
        activeIndex = items.findIndex(item => item.type === "video");
      } else if (intent === "primary") {
        const next = staged[0];
        items = items.filter(item => !(item.type !== "video" && item.is_primary));
        items = window.DemoStore.validateMedia([{ ...next, is_primary: true }, ...items]);
        activeIndex = 0;
      } else {
        items = window.DemoStore.validateMedia([...items, ...staged]);
        activeIndex = items.length - staged.length;
      }

      status(intent === "video" ? "Video agregado. Guarda el producto para conservarlo." : "Medio agregado. Guarda el producto para conservarlo.");
      commit();
    } catch (error) {
      status(error.message);
    } finally {
      busy = false;
      event.target.value = "";
      delete event.target.dataset.intent;
    }
  });

  document.querySelector("#add-media-url")?.addEventListener("click", () => {
    const input = document.querySelector("#media-url");
    const url = window.DemoStore.safeUrl(input.value);
    if (!url) {
      status("Escribe una URL HTTP o HTTPS válida.");
      return;
    }
    try {
      items = window.DemoStore.validateMedia([...items, { source_url: url, type: "image", is_primary: !items.some(item => item.is_primary) }]);
      activeIndex = items.length - 1;
      input.value = "";
      commit();
      status("URL agregada. Guarda el producto para conservarla.");
    } catch (error) {
      status(error.message);
    }
  });

  productForm?.addEventListener("input", () => {
    if (isStudioOpen()) renderStudio();
  });
  productForm?.addEventListener("change", () => {
    if (isStudioOpen()) renderStudio();
  });

  if (typeof sendLivePreview === "function") {
    window.addEventListener("demo-editor-live-preview-ready", sendLivePreview);
  }

  window.addEventListener("demo-gallery-change", () => {
    if (summary) summary.textContent = countsLabel();
  });

  if (summary) summary.textContent = countsLabel();

  window.DemoProductGallery = {
    set,
    get: () => JSON.parse(JSON.stringify(items)),
    isBusy: () => busy,
    close: closeStudio
  };
})();
