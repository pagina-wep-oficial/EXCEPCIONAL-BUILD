(function () {
  "use strict";

  const store = window.DemoStore;
  const host = document.querySelector("#product-gallery");
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
  let adjustTool = "move";
  let hudPanelOpen = !window.matchMedia("(max-width: 760px)").matches;
  let hudHidden = false;
  let confirmDelete = false;

  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const currencyById = id => store.model.currencies.find(item => item.id === id) || store.model.currencies[0];
  const currentSettings = () => store.state.imageSettings || {};
  const isStudioOpen = () => studio && !studio.hidden;
  const hasItems = () => items.length > 0;
  const imageCount = () => items.filter(item => item.type !== "video").length;
  const videoCount = () => items.filter(item => item.type === "video").length;
  const selectedItem = () => items[activeIndex] || null;
  const primaryImage = () => items.find(item => item.type !== "video" && item.is_primary) || items.find(item => item.type !== "video") || null;
  const isPrimarySelected = () => {
    const item = selectedItem();
    return !!item && item.type !== "video" && item.is_primary;
  };

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
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.4-5.8 9.2-5.8 9.2 5.8 9.2 5.8-3.4 5.8-9.2 5.8S2.8 12 2.8 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4 20 20"></path><path d="M9.9 6.5A10.8 10.8 0 0 1 12 6.2c5.8 0 9.2 5.8 9.2 5.8a16.4 16.4 0 0 1-2.4 3.1"></path><path d="M6.5 8.1A16 16 0 0 0 2.8 12s3.4 5.8 9.2 5.8a10.6 10.6 0 0 0 3.4-.6"></path><path d="M10.3 10.3a2.7 2.7 0 0 0 3.4 3.4"></path></svg>',
    adjust: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7"></path><circle cx="15" cy="7" r="2.5"></circle><path d="M18 7h2"></path><path d="M4 17h2"></path><circle cx="9" cy="17" r="2.5"></circle><path d="M12 17h8"></path></svg>',
    move: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4"></circle><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"></circle><path d="M12 3.6v2.2M12 18.2v2.2M3.6 12h2.2M18.2 12h2.2"></path></svg>',
    zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.4"></circle><path d="m15.4 15.4 4.6 4.6M8.2 10.5h4.6M10.5 8.2v4.6"></path></svg>',
    horizontal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M7.2 8.2 3.4 12l3.8 3.8M16.8 8.2 20.6 12l-3.8 3.8"></path></svg>',
    vertical: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M8.2 7.2 12 3.4l3.8 3.8M8.2 16.8 12 20.6l3.8-3.8"></path></svg>',
    radius: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4v5.5A10.5 10.5 0 0 1 9.5 20H4"></path><path d="M4 20V9.5A5.5 5.5 0 0 1 9.5 4H20"></path></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
    rotateLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7H4V3"></path><path d="M4.5 7A8 8 0 1 1 3 13"></path></svg>',
    rotateRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 7h4V3"></path><path d="M19.5 7A8 8 0 1 0 21 13"></path></svg>',
    rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 7h4V3"></path><path d="M19.5 7A8 8 0 1 0 21 13"></path></svg>',
    flipH: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16"></path><path d="m4 7 5 5-5 5zM20 7l-5 5 5 5z"></path></svg>',
    flipV: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"></path><path d="m7 4 5 5 5-5zM7 20l5-5 5 5z"></path></svg>',
    crop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v15a3 3 0 0 0 3 3h12M3 6h15a3 3 0 0 1 3 3v12"></path></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10" width="15" height="10" rx="2.5"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path></svg>',
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
    confirmDelete = false;
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
    const radius = clamp(item?.radius ?? 16, 0, 32);
    const scale = large ? zoom : Math.min(zoom, 2.4);
    return `object-fit:${fit};object-position:${x}% ${y}%;transform:scale(${scale}) rotate(${rotation}deg) scaleX(${item?.flip_x ? -1 : 1}) scaleY(${item?.flip_y ? -1 : 1});border-radius:${radius}px`;
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
    if (!item) {
      return `<img class="home-featured-image-media" src="demo-casa-nopal/assets/home-chilaquiles-900.jpg" alt="Producto" style="object-fit:cover;object-position:50% 50%;transform:scale(1) rotate(0deg) scaleX(1) scaleY(1)" data-live-media>`;
    }
    return previewMediaMarkup(item, "home-featured-image-media", true);
  }

  function featuredPreviewMarkup() {
    const draft = productDraft();
    const image = primaryImage();

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
    const image = primaryImage();
    const external = previewCatalog === "external_catalog";

    return `
      <div class="studio-store-preview">
        <article class="product-card">
          <div class="product-media-frame" data-live-frame style="${liveFrameStyle(image)}">
            ${previewMediaMarkup(image, "product-card-media", true)}
          </div>
          <div class="product-body">
            <div class="product-meta">
              <span class="category">${safe(draft.category || "Producto")}</span>
              <span data-product-field="price">${previewPrice(draft)}</span>
            </div>
            <h2>${safe(draft.name || "Nombre del producto")}</h2>
            <p>${safe(draft.description || "Descripción del producto")}</p>
            <div class="product-actions">
              ${external ? "" : `<span class="button primary">Agregar</span>`}
              <span class="button secondary">Ver producto</span>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function detailPreviewMarkup() {
    const draft = productDraft();
    const media = previewImages();
    const main = selectedItem() || media[0];
    const activeMedia = media.indexOf(main);
    const external = previewCatalog === "external_catalog";

    return `
      <div class="studio-detail-frame">
        <div class="studio-detail-canvas">
          <article class="detail-view">
            <div class="detail-gallery">
              <div class="detail-media" data-live-frame style="${liveFrameStyle(main)}">
                ${previewMediaMarkup(main, "detail-main-image", true)}
              </div>
              ${
                media.length > 1
                  ? `<div class="detail-thumbnails">
                      ${media.slice(0, 5).map((item, index) => `
                        <span class="detail-thumbnail${index === activeMedia ? " active" : ""}">
                          ${previewMediaMarkup(item, "detail-thumbnail-media")}
                        </span>
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
              ${
                external
                  ? `<a class="button primary" href="#" tabindex="-1" aria-hidden="true">${safe(draft.cta)} ↗</a>`
                  : `
                    <div class="detail-quantity">
                      <span>Cantidad</span>
                      <div class="quantity quantity-input">
                        <button type="button" tabindex="-1" aria-hidden="true">−</button>
                        <input type="number" value="1" readonly tabindex="-1" aria-hidden="true">
                        <button type="button" tabindex="-1" aria-hidden="true">+</button>
                      </div>
                    </div>
                    <div class="detail-actions">
                      <span class="button primary">Agregar al carrito</span>
                      <span class="button secondary">Ir al carrito</span>
                    </div>
                  `
              }
            </div>
          </article>
        </div>
      </div>
    `;
  }

  function contextPreviewMarkup() {
    if (previewContext === "featured") return featuredPreviewMarkup();
    if (previewContext === "detail") return detailPreviewMarkup();
    return storePreviewMarkup();
  }

  function previewBoardMarkup() {
    const mode = previewCatalog === "external_catalog" ? "Catálogo" : "Tienda";
    const item = selectedItem();
    const isVideo = item?.type === "video";
    const primarySelected = isPrimarySelected();
    const contexts = [
      ["featured", "Destacados", primarySelected],
      ["store", mode, primarySelected],
      ["detail", "Detalle", true]
    ];
    const contextTab = ([value, label, available]) => {
      const active = previewContext === value;
      const locked = !available;
      const reason = "Solo la foto principal se muestra en esta vista";
      return `
        <button type="button" class="studio-context-tab${active ? " is-active" : ""}${locked ? " is-locked" : ""}" data-preview-context="${value}" role="tab" aria-selected="${active ? "true" : "false"}"${locked ? ` aria-disabled="true" aria-label="${safe(label)}, solo disponible con la foto principal" title="${reason}"` : ""}>${locked ? icon("lock") : ""}${label}</button>
      `;
    };

    return `
      <section class="studio-live-shell" aria-label="Vista en vivo">
        <header class="studio-live-topbar">
          <div class="studio-live-title">
            <span class="studio-live-pulse" aria-hidden="true"></span>
            <p class="studio-kicker">Vista en vivo</p>
          </div>

          <div class="studio-context-tabs" role="tablist" aria-label="Contexto">
            ${contexts.map(contextTab).join("")}
          </div>

          <div class="studio-live-tools">
            <span class="studio-mode-badge">${safe(mode)}</span>
            <button type="button" class="studio-hud-toggle" data-toggle-hud aria-pressed="${hudHidden ? "true" : "false"}" aria-label="${hudHidden ? "Mostrar interfaz" : "Ocultar interfaz"}">
              ${hudHidden ? icon("eyeOff") : icon("eye")}
              <span>${hudHidden ? "Mostrar UI" : "Ocultar UI"}</span>
            </button>
          </div>
        </header>

        <div class="studio-live-stage">
          <div class="studio-device${hudHidden ? " is-clean" : ""}">
            ${hudHidden ? "" : `
              <div class="studio-device-bar">
                <div class="studio-device-dots" aria-hidden="true"><span></span><span></span><span></span></div>
                <div class="studio-device-nav">
                  <button type="button" class="studio-device-arrow" data-step-media="-1" ${!item || activeIndex === 0 ? "disabled" : ""} aria-label="Medio anterior">${icon("left")}</button>
                  <span class="studio-editor-counter">${safe(item ? counterLabel(item) : "Sin medios")}</span>
                  <button type="button" class="studio-device-arrow" data-step-media="1" ${!item || activeIndex === items.length - 1 ? "disabled" : ""} aria-label="Medio siguiente">${icon("right")}</button>
                </div>
                <span class="studio-editor-kind${isVideo ? " is-video" : ""}">${item ? (isVideo ? `${icon("video")}Video` : `${icon("image")}Imagen`) : "Sin medios"}</span>
              </div>
            `}
            <div class="studio-device-screen">
              <div class="studio-preview-public-shell" data-context="${safe(previewContext)}">
                ${contextPreviewMarkup()}
              </div>
              <div class="studio-hud-mount" id="studio-hud-mount"></div>
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
        <button type="button" class="${item.fit_mode === "cover" ? "is-active" : ""}" data-set-fit="cover" aria-label="Llenar espacio">${icon("cover")}<span class="studio-fit-full">Llenar espacio</span><span class="studio-fit-short">Llenar</span></button>
        <button type="button" class="${item.fit_mode !== "cover" ? "is-active" : ""}" data-set-fit="contain" aria-label="Mostrar completa">${icon("contain")}<span class="studio-fit-full">Mostrar completa</span><span class="studio-fit-short">Completa</span></button>
      </div>
    `;
  }

  function adjustToolsMarkup(active = "move") {
    const tools = [
      ["move", "move", "Mover"],
      ["zoom", "zoom", "Zoom"],
      ["x", "horizontal", "Horizontal"],
      ["y", "vertical", "Vertical"],
      ["radius", "radius", "Bordes"]
    ];
    return `
      <div class="studio-adjust-tools" role="tablist" aria-label="Herramientas de ajuste">
        ${tools.map(([value, iconName, label]) => `
          <button type="button" class="studio-adjust-tool${active === value ? " is-active" : ""}" data-adjust-tool="${value}" role="tab" aria-selected="${active === value ? "true" : "false"}">
            ${icon(iconName)}<span>${label}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function joystickMarkup(item) {
    const x = Math.round(clamp(item.focal_x ?? 50, 0, 100));
    const y = Math.round(clamp(item.focal_y ?? 50, 0, 100));
    return `
      <div class="studio-joystick-block">
        <div class="studio-joystick" data-joystick role="application" tabindex="0" aria-label="Joystick para mover la imagen. Arrastra la perilla o usa las flechas del teclado.">
          <span class="studio-joystick-axis" aria-hidden="true"></span>
          <span class="studio-joystick-knob" data-joystick-knob aria-hidden="true"></span>
        </div>
        <div class="studio-joystick-side">
          <strong>Encuadre</strong>
          <small>Arrastra la perilla para mover la imagen.</small>
          <button type="button" class="studio-joystick-center" data-center-media>${icon("move")}Centrar</button>
          <span class="studio-joystick-position" data-joystick-position>${x}% · ${y}%</span>
        </div>
      </div>
    `;
  }

  function radiusPresetsMarkup(item) {
    const radius = Math.round(clamp(item.radius ?? 16, 0, 32));
    const presets = [[0, "Cuadrada"], [16, "Suave"], [28, "Redonda"]];
    return `
      <div class="studio-radius-presets" role="group" aria-label="Bordes de la imagen">
        ${presets.map(([value, label]) => `<button type="button" class="${radius === value ? "is-active" : ""}" data-set-radius="${value}">${label}</button>`).join("")}
      </div>
    `;
  }

  function adjustTabMarkup(item) {
    const tool = ["move", "zoom", "x", "y", "radius"].includes(adjustTool) ? adjustTool : "move";
    const control = (name, markup) => `<div class="studio-adjust-control${tool === name ? " is-active" : ""}" data-adjust-control="${name}">${markup}</div>`;
    return `
      ${fitToggleMarkup(item)}
      ${adjustToolsMarkup(tool)}
      <div class="studio-adjust-controls" data-adjust-active="${tool}">
        ${control("move", joystickMarkup(item))}
        ${control("zoom", sliderRow("Zoom", "zoom", clamp(item.zoom ?? 1, 1, 3), 1, 3, 0.01, "x"))}
        ${control("x", sliderRow("Posición horizontal", "focal_x", clamp(item.focal_x ?? 50, 0, 100), 0, 100, 1, "%"))}
        ${control("y", sliderRow("Posición vertical", "focal_y", clamp(item.focal_y ?? 50, 0, 100), 0, 100, 1, "%"))}
        ${control("radius", `${sliderRow("Bordes de la imagen", "radius", clamp(item.radius ?? 16, 0, 32), 0, 32, 1, "px")}${radiusPresetsMarkup(item)}`)}
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

  function hudMarkup(item) {
    const isVideo = item.type === "video";
    const toolTabs = isVideo
      ? [["video", "video", "Video"]]
      : [["adjust", "adjust", "Ajustar"], ["crop", "crop", "Recortar"], ["rotate", "rotate", "Girar"]];
    const panelTab = isVideo ? "video" : activeTab;
    const panelIcon = isVideo ? "video" : panelTab === "crop" ? "crop" : panelTab === "rotate" ? "rotate" : "adjust";
    const panelTitle = isVideo ? "Video" : panelTab === "crop" ? "Recortar" : panelTab === "rotate" ? "Girar" : "Ajustar";
    const showPrimaryActions = !isVideo && !item.is_primary;
    const hasPrimary = items.some(entry => entry.type !== "video" && entry.is_primary);
    const primaryLabel = hasPrimary ? "Reemplazar foto principal" : "Usar como principal";

    const controls = isVideo
      ? `<div class="studio-video-note">${icon("video")}<div><strong>Video listo para publicar</strong><p>En el sitio se mostrará con controles propios. Aquí solo puedes conservarlo, reordenarlo o reemplazarlo.</p></div></div>`
      : panelTab === "crop"
        ? cropTabMarkup(item)
        : panelTab === "rotate"
          ? rotateTabMarkup(item)
          : adjustTabMarkup(item);

    return `
      <div class="studio-hud${hudPanelOpen ? " is-panel-open" : ""}">
        <div class="studio-hud-panel" aria-hidden="${hudPanelOpen ? "false" : "true"}" aria-label="${safe(panelTitle)}">
          <header class="studio-hud-panel-head">
            <span class="studio-hud-panel-title">${icon(panelIcon)}${safe(panelTitle)}</span>
            <button type="button" class="studio-hud-close" data-close-hud aria-label="Cerrar panel">${icon("close")}</button>
          </header>
          <div class="studio-hud-panel-body">
            ${controls}
          </div>
        </div>

        <div class="studio-hud-rail" role="toolbar" aria-label="Herramientas del medio">
          ${toolTabs.map(([value, iconName, label]) => `
            <button type="button" class="studio-hud-tool${panelTab === value && hudPanelOpen ? " is-active" : ""}" data-editor-tab="${value}" data-tip="${safe(label)}" aria-label="${safe(label)}" aria-pressed="${panelTab === value && hudPanelOpen ? "true" : "false"}">${icon(iconName)}</button>
          `).join("")}
          ${isVideo ? "" : `<span class="studio-hud-divider" aria-hidden="true"></span>`}
          ${showPrimaryActions ? `
            <button type="button" class="studio-hud-tool" data-set-primary data-tip="${safe(primaryLabel)}" aria-label="${safe(primaryLabel)}">${icon("star")}</button>
            <button type="button" class="studio-hud-tool" data-move-selected="-1" ${activeIndex <= 1 ? "disabled" : ""} data-tip="Mover antes" aria-label="Mover antes">${icon("left")}</button>
            <button type="button" class="studio-hud-tool" data-move-selected="1" ${activeIndex === items.length - 1 || items[activeIndex + 1]?.type === "video" ? "disabled" : ""} data-tip="Mover después" aria-label="Mover después">${icon("right")}</button>
          ` : ""}
          ${isVideo ? "" : `<button type="button" class="studio-hud-tool" data-reset-image data-tip="Restablecer ajustes" aria-label="Restablecer ajustes">${icon("reset")}</button>`}
          <button type="button" class="studio-hud-tool is-danger" data-delete-selected data-tip="Eliminar" aria-label="Eliminar">${icon("trash")}</button>
        </div>

        ${confirmDelete ? `
          <div class="studio-confirm" role="alertdialog" aria-modal="true" aria-labelledby="studio-confirm-title" aria-describedby="studio-confirm-text">
            <div class="studio-confirm-card">
              <span class="studio-confirm-icon" aria-hidden="true">${icon("trash")}</span>
              <div class="studio-confirm-copy">
                <strong id="studio-confirm-title">¿Eliminar ${isVideo ? "este video" : "esta imagen"}?</strong>
                <p id="studio-confirm-text">${isVideo ? "El video se quitará del producto." : item.is_primary && imageCount() > 1 ? "Es la foto principal; otra imagen tomará su lugar." : "La imagen se quitará del producto."} Esta acción no se puede deshacer.</p>
              </div>
              <div class="studio-confirm-actions">
                <button type="button" data-cancel-delete>Cancelar</button>
                <button type="button" class="studio-confirm-danger" data-confirm-delete>Eliminar</button>
              </div>
            </div>
          </div>
        ` : ""}
      </div>
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

  function addTileMarkup(intent, label, helper, options = {}) {
    const { disabled = false, count = "" } = options;
    const iconName = disabled ? "lock" : intent === "video" ? "video" : intent === "primary" ? "star" : "plus";
    return `
      <label class="studio-add-tile${disabled ? " is-disabled" : ""}"${disabled ? ' aria-disabled="true"' : ""}>
        <span class="studio-add-top">
          <span class="studio-add-icon">${icon(iconName)}</span>
          ${count ? `<span class="studio-add-count">${safe(count)}</span>` : ""}
        </span>
        <strong>${safe(label)}</strong>
        <small>${safe(helper)}</small>
        <span class="studio-add-hit" data-upload-intent="${safe(intent)}" ${disabled ? 'aria-disabled="true"' : ''}></span>
      </label>
    `;
  }

  function libraryMarkup(sources) {
    const photos = imageCount();
    const videos = videoCount();
    const photosFull = photos >= 5;
    const videoFull = videos >= 1;
    const hasPrimary = items.some(item => item.type !== "video" && item.is_primary);

    return `
      <section class="studio-library-shell">
        <header class="studio-library-head">
          <div>
            <p class="studio-kicker">Biblioteca de medios</p>
            <h3>${photos} de 5 fotos · ${videos} de 1 video</h3>
          </div>
          <button type="button" class="studio-close-inline" data-close-media>Volver al producto</button>
        </header>

        <div class="studio-add-strip">
          ${addTileMarkup("primary", hasPrimary ? "Reemplazar principal" : "Foto principal", hasPrimary ? "Sustituye la portada actual." : "Define la portada del producto.")}
          ${addTileMarkup("extra", photosFull ? "Límite de fotos" : "Más fotos", photosFull ? "Elimina una para agregar otra." : "Apoyo para el carrusel.", { disabled: photosFull, count: `${photos} de 5` })}
          ${addTileMarkup("video", videoFull ? "Video agregado" : "Video", videoFull ? "Solo se permite un video." : "Uno corto y con audio.", { disabled: videoFull, count: `${videos} de 1` })}
        </div>

        <div class="studio-media-strip${items.length ? "" : " is-empty"}">
          ${items.length ? sources.map((source, index) => mediaTileMarkup(items[index], index, source)).join("") : `<div class="studio-empty-library">${emptyIllustration()}<strong>Sin medios cargados</strong><p>Agrega una foto principal para empezar.</p></div>`}
        </div>
      </section>
    `;
  }

  function fitDetailPreview() {
    const frame = host?.querySelector(".studio-detail-frame");
    const canvas = frame?.querySelector(".studio-detail-canvas");
    if (!frame || !canvas) return;

    const available = frame.clientWidth;
    if (!available) return;

    const scale = Math.min(1, available / 1200);
    canvas.style.transform = `scale(${scale})`;
    frame.style.height = `${canvas.offsetHeight * scale}px`;
  }

  async function renderStudio() {
    if (!host) return;
    normalizeSelection();
    if (!isPrimarySelected()) previewContext = "detail";
    const selected = selectedItem();
    if (selected?.type === "video") activeTab = "video";
    else if (activeTab === "video") activeTab = "adjust";

    const sources = await Promise.all(items.map(item => previewSource(item)));
    resolvedUrls = new Map(items.map((item, index) => [item, sources[index]]));

    host.innerHTML = `${previewBoardMarkup()}${libraryMarkup(sources)}`;
    renderHud();
    bindStudioInteractions();
    fitDetailPreview();
    requestAnimationFrame(fitDetailPreview);
    document.fonts?.ready.then(fitDetailPreview).catch(() => {});
  }

  function renderHud() {
    const mount = host?.querySelector("#studio-hud-mount");
    if (!mount) return;
    const item = selectedItem();
    mount.innerHTML = item && !hudHidden ? hudMarkup(item) : "";
    bindHudInteractions(mount);
  }

  function refreshStudioMedia() {
    const item = selectedItem();
    if (!item) return;

    const liveStyle = mediaStyle(item, true);
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
      confirmDelete = false;
      renderStudio();
    }));

    host.querySelectorAll("[data-preview-context]").forEach(button => {
      button.addEventListener("click", () => {
        const next = button.dataset.previewContext || "store";
        if (next !== "detail" && !isPrimarySelected()) return;
        previewContext = next;
        renderStudio();
      });
    });

    host.querySelectorAll("[data-toggle-hud]").forEach(button => button.addEventListener("click", () => {
      hudHidden = !hudHidden;
      renderStudio();
    }));

    host.querySelectorAll("[data-step-media]").forEach(button => button.addEventListener("click", () => {
      const step = Number(button.dataset.stepMedia || 0);
      activeIndex = clamp(activeIndex + step, 0, items.length - 1);
      confirmDelete = false;
      renderStudio();
    }));
  }

  function updateRangeLabel(input, field) {
    const label = input.closest(".studio-range-row")?.querySelector("strong");
    if (!label) return;
    const step = Number(input.step) || 1;
    const suffix = field === "zoom" ? "x" : field === "rotation" ? "°" : field === "radius" ? "px" : "%";
    label.textContent = `${Number(input.value).toFixed(step < 1 ? 2 : 0)}${suffix}`.replace(/\.00(?=[^\d]|$)/, "");
  }

  function syncFitButtons(mount, item) {
    mount.querySelectorAll("[data-set-fit]").forEach(button => {
      const isCover = button.dataset.setFit === "cover";
      button.classList.toggle("is-active", isCover ? item.fit_mode === "cover" : item.fit_mode !== "cover");
    });
  }

  function syncRadiusPresets(mount, value) {
    mount.querySelectorAll("[data-set-radius]").forEach(button => {
      button.classList.toggle("is-active", Math.round(Number(value)) === Number(button.dataset.setRadius));
    });
  }

  function syncJoystickPosition(mount, item) {
    const node = mount.querySelector("[data-joystick-position]");
    if (!node) return;
    const x = Math.round(clamp(item.focal_x ?? 50, 0, 100));
    const y = Math.round(clamp(item.focal_y ?? 50, 0, 100));
    node.textContent = `${x}% · ${y}%`;
  }

  function bindJoystick(mount) {
    const pad = mount.querySelector("[data-joystick]");
    const knob = pad?.querySelector("[data-joystick-knob]");
    if (!pad || !knob) return;

    let frame = 0;
    let last = 0;
    let pointerId = null;
    let vectorX = 0;
    let vectorY = 0;

    const currentItem = () => {
      const item = selectedItem();
      return item && item.type !== "video" ? item : null;
    };

    const moveKnob = (x, y) => {
      knob.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    };

    const readVector = event => {
      const rect = pad.getBoundingClientRect();
      const limit = Math.max(24, Math.min(rect.width, rect.height) / 2 - 23);
      let x = event.clientX - (rect.left + rect.width / 2);
      let y = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > limit) {
        x = (x / distance) * limit;
        y = (y / distance) * limit;
      }
      moveKnob(x, y);
      vectorX = x / limit;
      vectorY = y / limit;
    };

    const applyMovement = (item, delta) => {
      const deadzone = 0.14;
      const axis = value => Math.abs(value) <= deadzone ? 0 : (value - Math.sign(value) * deadzone) / (1 - deadzone);
      const nx = axis(vectorX);
      const ny = axis(vectorY);
      if (!nx && !ny) return;
      if (item.fit_mode !== "cover") {
        item.fit_mode = "cover";
        syncFitButtons(mount, item);
      }
      const zoom = clamp(item.zoom ?? 1, 1, 3);
      const speed = 46 / zoom;
      item.focal_x = clamp((item.focal_x ?? 50) - nx * speed * delta, 0, 100);
      item.focal_y = clamp((item.focal_y ?? 50) - ny * speed * delta, 0, 100);
      syncJoystickPosition(mount, item);
      ["focal_x", "focal_y"].forEach(field => {
        const input = mount.querySelector(`[data-media-field="${field}"]`);
        if (!input) return;
        input.value = String(Math.round(item[field]));
        updateRangeLabel(input, field);
      });
      refreshStudioMedia();
    };

    const tick = time => {
      if (pointerId === null) return;
      const item = currentItem();
      if (!item) {
        stop();
        return;
      }
      const now = time || performance.now();
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      applyMovement(item, delta);
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (pointerId === null) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      const released = pointerId;
      pointerId = null;
      vectorX = 0;
      vectorY = 0;
      pad.classList.remove("is-dragging");
      moveKnob(0, 0);
      try {
        if (pad.hasPointerCapture?.(released)) pad.releasePointerCapture(released);
      } catch {}
    };

    pad.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!currentItem()) return;
      event.preventDefault();
      pad.focus({ preventScroll: true });
      pointerId = event.pointerId;
      pad.classList.add("is-dragging");
      try { pad.setPointerCapture?.(pointerId); } catch {}
      readVector(event);
      last = performance.now();
      frame = requestAnimationFrame(tick);
    });

    pad.addEventListener("pointermove", event => {
      if (pointerId === null || event.pointerId !== pointerId) return;
      event.preventDefault();
      readVector(event);
    });

    pad.addEventListener("pointerup", event => {
      if (event.pointerId === pointerId) stop();
    });

    pad.addEventListener("pointercancel", event => {
      if (event.pointerId === pointerId) stop();
    });

    pad.addEventListener("lostpointercapture", event => {
      if (event.pointerId === pointerId) stop();
    });

    pad.addEventListener("keydown", event => {
      const directions = {
        ArrowLeft: [1, 0],
        ArrowRight: [-1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1]
      };
      const direction = directions[event.key];
      if (!direction) return;
      const item = currentItem();
      if (!item) return;
      event.preventDefault();
      if (item.fit_mode !== "cover") {
        item.fit_mode = "cover";
        syncFitButtons(mount, item);
      }
      const step = event.shiftKey ? 6 : 2;
      item.focal_x = clamp((item.focal_x ?? 50) + direction[0] * step, 0, 100);
      item.focal_y = clamp((item.focal_y ?? 50) + direction[1] * step, 0, 100);
      syncJoystickPosition(mount, item);
      ["focal_x", "focal_y"].forEach(field => {
        const input = mount.querySelector(`[data-media-field="${field}"]`);
        if (!input) return;
        input.value = String(Math.round(item[field]));
        updateRangeLabel(input, field);
      });
      refreshStudioMedia();
    });
  }

  function bindHudInteractions(mount) {
    if (!mount) return;

    mount.querySelectorAll("[data-editor-tab]").forEach(button => button.addEventListener("click", () => {
      const tab = button.dataset.editorTab || "adjust";
      if (hudPanelOpen && activeTab === tab) {
        hudPanelOpen = false;
      } else {
        activeTab = tab;
        hudPanelOpen = true;
      }
      renderHud();
    }));

    mount.querySelectorAll("[data-adjust-tool]").forEach(button => button.addEventListener("click", () => {
      adjustTool = button.dataset.adjustTool || "move";
      renderHud();
    }));

    mount.querySelector("[data-close-hud]")?.addEventListener("click", () => {
      hudPanelOpen = false;
      renderHud();
    });

    mount.querySelectorAll("[data-media-field]").forEach(input => input.addEventListener("input", () => {
      const field = input.dataset.mediaField;
      const item = selectedItem();
      if (!field || !item) return;
      item[field] = Number(input.value);
      updateRangeLabel(input, field);
      if (field === "radius") syncRadiusPresets(mount, item.radius);
      if (field === "focal_x" || field === "focal_y") syncJoystickPosition(mount, item);
      refreshStudioMedia();
    }));

    mount.querySelectorAll("[data-set-radius]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      item.radius = clamp(Number(button.dataset.setRadius), 0, 32);
      const input = mount.querySelector('[data-media-field="radius"]');
      if (input) {
        input.value = String(item.radius);
        updateRangeLabel(input, "radius");
      }
      syncRadiusPresets(mount, item.radius);
      refreshStudioMedia();
    }));

    mount.querySelector("[data-center-media]")?.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      item.focal_x = 50;
      item.focal_y = 50;
      syncJoystickPosition(mount, item);
      ["focal_x", "focal_y"].forEach(field => {
        const input = mount.querySelector(`[data-media-field="${field}"]`);
        if (!input) return;
        input.value = "50";
        updateRangeLabel(input, field);
      });
      refreshStudioMedia();
    });

    bindJoystick(mount);

    mount.querySelectorAll("[data-set-fit]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.fit_mode = button.dataset.setFit === "contain" ? "contain" : "cover";
      commit();
    }));

    mount.querySelectorAll("[data-set-crop]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.crop = button.dataset.setCrop === "original" ? undefined : button.dataset.setCrop;
      commit();
    }));

    mount.querySelectorAll("[data-rotate]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      item.rotation = clamp((item.rotation ?? 0) + Number(button.dataset.rotate || 0), -180, 180);
      commit();
    }));

    mount.querySelectorAll("[data-flip]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item) return;
      if (button.dataset.flip === "x") item.flip_x = !item.flip_x;
      else item.flip_y = !item.flip_y;
      commit();
    }));

    mount.querySelector("[data-reset-image]")?.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      Object.assign(item, { fit_mode: "inherit", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0, flip_x: false, flip_y: false, crop: undefined, radius: 16 });
      commit();
    });

    mount.querySelector("[data-set-primary]")?.addEventListener("click", () => {
      const current = selectedItem();
      if (!current || current.type === "video") return;
      items = [current, ...items.filter((entry, index) => index !== activeIndex)];
      items.forEach((entry, index) => { entry.is_primary = index === 0 && entry.type !== "video"; });
      activeIndex = 0;
      commit();
    });

    mount.querySelectorAll("[data-move-selected]").forEach(button => button.addEventListener("click", () => {
      const current = selectedItem();
      const from = activeIndex;
      const to = from + Number(button.dataset.moveSelected || 0);
      if (!current || current.type === "video" || current.is_primary || to < 1 || to >= items.length || items[to]?.type === "video") return;
      [items[from], items[to]] = [items[to], items[from]];
      activeIndex = to;
      items = window.DemoStore.validateMedia(items);
      commit();
    }));

    mount.querySelector("[data-delete-selected]")?.addEventListener("click", () => {
      if (!selectedItem()) return;
      confirmDelete = true;
      renderHud();
    });

    mount.querySelector("[data-cancel-delete]")?.addEventListener("click", () => {
      confirmDelete = false;
      renderHud();
    });

    mount.querySelector("[data-confirm-delete]")?.addEventListener("click", () => {
      if (!selectedItem()) return;
      confirmDelete = false;
      items.splice(activeIndex, 1);
      items = window.DemoStore.validateMedia(items);
      activeIndex = Math.max(0, activeIndex - (activeIndex >= items.length ? 1 : 0));
      commit();
    });

    if (confirmDelete) mount.querySelector("[data-cancel-delete]")?.focus();
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
    adjustTool = "move";
    hudHidden = false;
    confirmDelete = false;
    hudPanelOpen = !window.matchMedia("(max-width: 760px)").matches;
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
    if (event.key !== "Escape" || !isStudioOpen()) return;
    // El editor de medios vive dentro del diálogo de producto: el Escape
    // debe cerrar solo el estudio y no el producto que está detrás.
    event.preventDefault();
    event.stopPropagation();
    if (confirmDelete) {
      confirmDelete = false;
      renderHud();
      return;
    }
    if (hudPanelOpen && !hudHidden && selectedItem()) {
      hudPanelOpen = false;
      renderHud();
      return;
    }
    closeStudio();
  });

  // El evento cancel del selector de archivos burbujea hasta el diálogo
  // de producto y lo cerraba. Lo detenemos aquí para conservar el editor.
  uploadInput?.addEventListener("cancel", event => {
    event.stopPropagation();
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

  window.addEventListener("resize", () => {
    if (isStudioOpen()) fitDetailPreview();
  });

  if (summary) summary.textContent = countsLabel();

  window.DemoProductGallery = {
    set,
    get: () => JSON.parse(JSON.stringify(items)),
    isBusy: () => busy,
    close: closeStudio
  };
})();
