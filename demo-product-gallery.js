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
  let previewCatalog = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";

  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const currencyById = id => store.model.currencies.find(item => item.id === id) || store.model.currencies[0];
  const currentSettings = () => store.state.imageSettings || {};
  const isStudioOpen = () => studio && !studio.hidden;
  const hasItems = () => items.length > 0;
  const imageCount = () => items.filter(item => item.type !== "video").length;
  const videoCount = () => items.filter(item => item.type === "video").length;
  const selectedItem = () => items[activeIndex] || null;

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
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.2"></rect><rect x="13" y="4" width="7" height="7" rx="1.2"></rect><rect x="4" y="13" width="7" height="7" rx="1.2"></rect><rect x="13" y="13" width="7" height="7" rx="1.2"></rect></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6h2.2l1.6 7.5h8l1.8-5.3H8.8"></path><circle cx="10.2" cy="18.5" r="1"></circle><circle cx="16.2" cy="18.5" r="1"></circle></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5 14.5 9.5"></path><path d="M8 16H6.8a3.3 3.3 0 1 1 0-6.6H10"></path><path d="M14 8h3.2a3.3 3.3 0 1 1 0 6.6H14"></path></svg>',
    preview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.4-5.8 9.2-5.8 9.2 5.8 9.2 5.8-3.4 5.8-9.2 5.8S2.8 12 2.8 12Z"></path><circle cx="12" cy="12" r="2.7"></circle></svg>',
    tune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16"></path><path d="M4 16.5h16"></path><circle cx="9" cy="7.5" r="2"></circle><circle cx="15" cy="16.5" r="2"></circle></svg>'
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

  function normalizeSelection() {
    if (!items.length) {
      activeIndex = 0;
      return;
    }
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

  function changed() {
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
    const displayPrice = hasPrice ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(price)} ${currency.display_label}` : "";
    const comparePrice = hasPrice && compareAtPrice > price ? `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(compareAtPrice)} ${currency.display_label}` : "";
    return {
      name: form?.elements.name?.value.trim() || "Nombre del producto",
      category: form?.elements.category?.value || "Categoría",
      description: form?.elements.description?.value.trim() || "Aquí verás cómo se presentará la descripción al público dentro de la tarjeta del producto.",
      price: displayPrice,
      compareAtPrice: comparePrice,
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
    return `object-fit:${fit};object-position:${x}% ${y}%;transform:scale(${scale}) rotate(${rotation}deg)`;
  }

  function productCardMarkup(item, source) {
    const draft = productDraft();
    const settings = currentSettings();
    const aspect = { "4/3": "4 / 3", "1/1": "1 / 1", "3/4": "3 / 4", auto: "4 / 3" }[settings.aspect] || "4 / 3";
    const radius = { square: "10px", soft: "16px", rounded: "24px", pill: "36px" }[settings.radius] || "24px";
    const padding = `${clamp(settings.padding ?? 12, 0, 28)}px`;
    const background = { soft: "linear-gradient(145deg,#f4efe6,#e6dcc8)", light: "#fff", dark: "#18221d" }[settings.background] || "linear-gradient(145deg,#f4efe6,#e6dcc8)";
    const mediaMarkup = !item ? placeholderCardMedia() : item.type === "video"
      ? `<video src="${safe(source)}" controls playsinline preload="metadata" class="studio-card-media" aria-label="${safe(draft.name)}"></video>`
      : `<img src="${safe(source)}" alt="${safe(draft.name)}" class="studio-card-media" style="${mediaStyle(item)}">`;

    return `
      <article class="studio-product-card ${draft.type === "external_catalog" ? "is-catalog" : "is-commerce"}">
        <div class="studio-card-media-frame" style="--studio-card-aspect:${aspect};--studio-card-radius:${radius};--studio-card-padding:${padding};--studio-card-background:${background}">
          ${mediaMarkup}
        </div>
        <div class="studio-card-body">
          <div class="studio-card-meta">
            <span class="studio-card-chip">${safe(draft.category)}</span>
            ${draft.price ? `<span class="studio-card-price">${draft.compareAtPrice ? `<del>${safe(draft.compareAtPrice)}</del>` : ""}<strong>${safe(draft.price)}</strong></span>` : '<span class="studio-card-price is-muted">Precio opcional</span>'}
          </div>
          <h3>${safe(draft.name)}</h3>
          <p>${safe(draft.description)}</p>
          <div class="studio-card-actions">
            <button type="button" class="studio-card-button is-primary">${draft.type === "external_catalog" ? icon("link") : icon("cart")}<span>${safe(draft.cta)}</span></button>
            <button type="button" class="studio-card-button is-secondary">${icon("preview")}<span>${safe(draft.secondaryCta)}</span></button>
          </div>
        </div>
      </article>
    `;
  }

  function previewBoardMarkup() {
    const mode = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";
    return `
      <section class="studio-preview-shell">
        <header class="studio-section-head">
          <div>
            <p class="studio-kicker">Vista en vivo</p>
            <h3>Así lo verá el público</h3>
            <p>Esta es la tienda real del recorrido activo.</p>
          </div>
          <div class="studio-mode-badge">
            ${mode === "commerce" ? icon("cart") : icon("link")}
            <span>${mode === "commerce" ? "Tienda" : "Catálogo"}</span>
          </div>
        </header>
        <div class="studio-live-frame-wrap">
          <iframe
            id="studio-live-frame"
            class="studio-live-frame"
            title="Vista pública del producto"
            src="../demo-casa-nopal/tienda.html?catalog=${mode}&editor_preview=1">
          </iframe>
        </div>
      </section>
    `;
  }

  function previewProduct() {
    const form = productForm;
    const selected = selectedItem();
    const catalogType = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";
    const price = Number(form?.elements.price?.value || 0);
    const compareAtPrice = Number(form?.elements.compareAtPrice?.value || 0);
    const primary = items.find(item => item.type !== "video" && item.is_primary) || items.find(item => item.type !== "video");

    return {
      id: form?.elements.id?.value || "demo-editor-preview",
      name: form?.elements.name?.value.trim() || "Nombre del producto",
      category: form?.elements.category?.value || "Categoría",
      description: form?.elements.description?.value.trim() || "Descripción del producto",
      price,
      compareAtPrice: compareAtPrice > price ? compareAtPrice : null,
      currency_id: form?.elements.currency_id?.value || "demo-mxn",
      currency_display_label: store.model.currencies.find(item => item.id === form?.elements.currency_id?.value)?.display_label || "MXN",
      unitLabel: form?.elements.unitLabel?.value || "c/u",
      image: primary?.source_url || "",
      media: JSON.parse(JSON.stringify(items)),
      featured: Boolean(form?.elements.featured?.checked),
      enabled: true,
      external_price_visible: catalogType === "commerce" || Boolean(form?.elements.external_price_visible?.checked),
      external_url: form?.elements.external_url?.value || "https://example.com/",
      catalog_type: catalogType,
      selected_media: selected?.source_url || ""
    };
  }

  function sendLivePreview() {
    const frame = document.querySelector("#studio-live-frame");
    if (!frame?.contentWindow) return;
    const message = {
      type: "demo-editor-preview",
      catalog_type: store.catalogType === "external_catalog" ? "external_catalog" : "commerce",
      product: previewProduct()
    };
    const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
    frame.contentWindow.postMessage(message, targetOrigin);
  }

  function sliderRow(label, name, value, min, max, step, suffix = "") {
    const printable = `${Number(value).toFixed(step < 1 ? 2 : 0)}${suffix}`.replace(/\.00(?=[^\d]|$)/, "");
    return `
      <label class="studio-range-row">
        <span>${safe(label)}<strong>${safe(printable)}</strong></span>
        <input type="range" data-media-field="${safe(name)}" min="${min}" max="${max}" step="${step}" value="${safe(value)}">
      </label>
    `;
  }

  function inspectorMarkup(item, source) {
    if (!item) {
      return `
        <aside class="studio-inspector-shell">
          <section class="studio-inspector-card is-empty">
            <div class="studio-empty-panel">${emptyIllustration()}<strong>Selecciona una foto o un video</strong><p>El panel derecho mostrará aquí los ajustes y la vista detallada del medio.</p></div>
          </section>
        </aside>
      `;
    }

    const previewArea = item.type === "video"
      ? `<video src="${safe(source)}" controls playsinline preload="metadata" class="studio-adjust-media"></video>`
      : `<img src="${safe(source)}" alt="${safe(itemLabel(item, activeIndex))}" class="studio-adjust-media" style="${mediaStyle(item, true)}">`;

    const imageControls = item.type === "video" ? `
      <div class="studio-video-note">
        ${icon("video")}
        <div>
          <strong>Video listo para publicar</strong>
          <p>En el sitio se mostrará con controles propios. Aquí solo puedes conservarlo, reordenarlo o reemplazarlo.</p>
        </div>
      </div>
    ` : `
      <div class="studio-fit-toggle" role="group" aria-label="Ajuste de imagen">
        <button type="button" class="${item.fit_mode !== "contain" ? "is-active" : ""}" data-set-fit="cover">${icon("cover")}<span>Llenar</span></button>
        <button type="button" class="${item.fit_mode === "contain" ? "is-active" : ""}" data-set-fit="contain">${icon("contain")}<span>Completa</span></button>
      </div>
      <div class="studio-nudge-grid" aria-label="Mover encuadre">
        <button type="button" data-nudge-x="0" data-nudge-y="-5">↑</button>
        <div class="studio-nudge-middle">
          <button type="button" data-nudge-x="-5" data-nudge-y="0">←</button>
          <button type="button" data-nudge-x="5" data-nudge-y="0">→</button>
        </div>
        <button type="button" data-nudge-x="0" data-nudge-y="5">↓</button>
      </div>
      ${sliderRow("Posición horizontal", "focal_x", clamp(item.focal_x ?? 50, 0, 100), 0, 100, 1, "%")}
      ${sliderRow("Posición vertical", "focal_y", clamp(item.focal_y ?? 50, 0, 100), 0, 100, 1, "%")}
      ${sliderRow("Zoom", "zoom", clamp(item.zoom ?? 1, 1, 3), 1, 3, 0.01, "x")}
      ${sliderRow("Rotación", "rotation", clamp(item.rotation ?? 0, -180, 180), -180, 180, 1, "°")}
      <button type="button" class="studio-ghost-button" data-reset-image>${icon("reset")}Restablecer ajustes</button>
    `;

    return `
      <aside class="studio-inspector-shell">
        <section class="studio-inspector-card">
          <header class="studio-section-head is-tight">
            <div>
              <p class="studio-kicker">Editor del medio</p>
              <h3>${safe(itemLabel(item, activeIndex))}</h3>
              <p>${item.is_primary ? "Este es el medio principal del producto." : "Puedes dejarlo como apoyo o convertirlo en principal."}</p>
            </div>
            <div class="studio-media-type-badge ${item.type === "video" ? "is-video" : ""}">${item.type === "video" ? icon("video") : icon("image")}<span>${item.type === "video" ? "Video" : "Imagen"}</span></div>
          </header>

          <div class="studio-adjust-stage">${previewArea}</div>

          <div class="studio-inspector-actions">
            ${item.type !== "video" ? `<button type="button" class="studio-outline-button ${item.is_primary ? "is-active" : ""}" data-set-primary>${icon("star")}Usar como principal</button>` : ""}
            ${item.type !== "video" && !item.is_primary ? `<button type="button" class="studio-outline-button" data-move-selected="-1" ${activeIndex <= 1 ? "disabled" : ""}>${icon("left")}Mover</button>
            <button type="button" class="studio-outline-button" data-move-selected="1" ${activeIndex === items.length - 1 || items[activeIndex + 1]?.type === "video" ? "disabled" : ""}>${icon("right")}Mover</button>` : ""}
            <button type="button" class="studio-outline-button is-danger" data-delete-selected>${icon("trash")}Eliminar</button>
          </div>

          <div class="studio-control-stack">
            ${imageControls}
          </div>
        </section>
      </aside>
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
        <input type="button" hidden ${disabled ? "disabled" : ""}>
        <span class="studio-add-icon">${icon(iconName)}</span>
        <strong>${safe(label)}</strong>
        <small>${safe(helper)}</small>
        <span class="studio-add-hit" data-upload-intent="${safe(intent)}" ${disabled ? 'aria-disabled="true"' : ''}></span>
      </label>
    `;
  }

  async function renderStudio() {
    if (!host || !adjustHost) return;
    normalizeSelection();
    const selected = selectedItem();
    const sources = await Promise.all(items.map(item => previewSource(item)));
    const currentSource = selected ? sources[activeIndex] : "";

    host.innerHTML = `
      <section class="studio-library-shell">
        <header class="studio-section-head">
          <div>
            <p class="studio-kicker">Biblioteca de medios</p>
            <h3>Fotos y video del producto</h3>
            <p>Hasta 5 imágenes y 1 video. Selecciona un medio para editarlo y ver su resultado arriba en la tarjeta.</p>
          </div>
          <div class="studio-header-tools">
            <div class="studio-library-counts">
              <span>${imageCount()}/5 fotos</span>
              <span>${videoCount()}/1 video</span>
            </div>
            <button type="button" class="studio-close-inline" data-close-media>Volver al producto</button>
          </div>
        </header>

        <div class="studio-add-strip">
          ${addTileMarkup("primary", "Agregar foto principal", "Sustituye o define la foto principal.", imageCount() >= 5 && !items.some(item => item.is_primary && item.type !== "video"))}
          ${addTileMarkup("extra", "Agregar más fotos", "Agrega fotos de apoyo para el carrusel.", imageCount() >= 5)}
          ${addTileMarkup("video", "Agregar video", "Un video corto para mostrar mejor el producto.", videoCount() >= 1)}
        </div>

        <div class="studio-media-strip${items.length ? "" : " is-empty"}">
          ${items.length ? sources.map((source, index) => mediaTileMarkup(items[index], index, source)).join("") : `<div class="studio-empty-library">${emptyIllustration()}<strong>Sin medios cargados</strong><p>Agrega una foto principal o algunas imágenes adicionales para empezar.</p></div>`}
        </div>
      </section>
    `;

    adjustHost.hidden = false;
    adjustHost.innerHTML = `${previewBoardMarkup(selected, currentSource)}${inspectorMarkup(selected, currentSource)}`;

    const frame = document.querySelector("#studio-live-frame");
    frame?.addEventListener("load", sendLivePreview, { once: true });
    bindStudioInteractions();
    sendLivePreview();
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

    const selected = selectedItem();
    if (!selected) return;

    adjustHost.querySelectorAll("[data-media-field]").forEach(input => input.addEventListener("input", () => {
      const field = input.dataset.mediaField;
      if (!field || !selectedItem()) return;
      const value = field === "zoom" ? Number(input.value) : Number(input.value);
      selectedItem()[field] = value;
      changed();
    }));

    adjustHost.querySelectorAll("[data-set-fit]").forEach(button => button.addEventListener("click", () => {
      if (!selectedItem()) return;
      selectedItem().fit_mode = button.dataset.setFit === "contain" ? "contain" : "cover";
      changed();
    }));

    adjustHost.querySelectorAll("[data-nudge-x],[data-nudge-y]").forEach(button => button.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      item.focal_x = clamp((item.focal_x ?? 50) + Number(button.dataset.nudgeX || 0), 0, 100);
      item.focal_y = clamp((item.focal_y ?? 50) + Number(button.dataset.nudgeY || 0), 0, 100);
      changed();
    }));

    adjustHost.querySelector("[data-reset-image]")?.addEventListener("click", () => {
      const item = selectedItem();
      if (!item || item.type === "video") return;
      Object.assign(item, { fit_mode: "inherit", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0, flip_x: false, flip_y: false });
      changed();
    });

    adjustHost.querySelector("[data-set-primary]")?.addEventListener("click", () => {
      const current = selectedItem();
      if (!current || current.type === "video") return;
      items = [current, ...items.filter((entry, index) => index !== activeIndex)];
      items.forEach((entry, index) => { entry.is_primary = index === 0 && entry.type !== "video"; });
      activeIndex = 0;
      changed();
    });

    adjustHost.querySelectorAll("[data-move-selected]").forEach(button => button.addEventListener("click", () => {
      const current = selectedItem();
      const from = activeIndex;
      const to = from + Number(button.dataset.moveSelected || 0);
      if (!current || current.type === "video" || current.is_primary || to < 1 || to >= items.length || items[to]?.type === "video") return;
      [items[from], items[to]] = [items[to], items[from]];
      activeIndex = to;
      items = window.DemoStore.validateMedia(items);
      changed();
    }));

    adjustHost.querySelector("[data-delete-selected]")?.addEventListener("click", () => {
      items.splice(activeIndex, 1);
      items = window.DemoStore.validateMedia(items);
      activeIndex = Math.max(0, activeIndex - (activeIndex >= items.length ? 1 : 0));
      changed();
    });
  }

  function set(next) {
    items = window.DemoStore.validateMedia(next || []);
    normalizeMediaOrder();
    activeIndex = items.findIndex(item => item.is_primary);
    if (activeIndex < 0) activeIndex = 0;
    changed();
  }

  function append(next) {
    items = window.DemoStore.validateMedia([...items, ...next]);
    if (!hasItems()) activeIndex = 0;
    changed();
  }

  openStudioButton?.addEventListener("click", () => {
    if (!studio) return;
    previewCatalog = store.catalogType === "external_catalog" ? "external_catalog" : "commerce";
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
      changed();
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
      changed();
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

  window.addEventListener("demo-editor-live-preview-ready", sendLivePreview);

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
