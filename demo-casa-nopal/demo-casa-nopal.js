(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const mode = "store";
  const store = window.DemoStore;
  const external = store.catalogType === "external_catalog";
  const page = document.body.dataset.page || "inicio";
  const stateKey = store.stateKey;
  const editorKey = store.editorKey;
  const defaultWhatsappNumber = "525629767176";
  const storeLocation = {
    name: "Casa Nopal · punto de demostración",
    address: "Centro, Mérida, Yucatán",
    hours: "Lunes a viernes de 8:00 am a 4:00 pm",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=20.999769979845297,-89.62416438649322&travelmode=driving"
  };
  const fallbackCoords = { latitude: 20.99977, longitude: -89.624164 };
  const mapStyles = {
    calle: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
    satelite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri" }
  };

  sessionStorage.setItem("eb-demo-mode", mode);
  document.body.dataset.demoMode = mode;

  const money = (value, snapshot = null) => store.amount(value, snapshot || { currency_id: store.cartCurrency().currency.id });
  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const imageBase = "assets/";
  const productImages = ["home-chilaquiles-900.jpg", "home-enchiladas-900.jpg", "home-tacos-900.jpg", "home-tacos-carnitas-900.jpg", "home-tacos-pastor-900.jpg"];
  const seed = store.seed();
  const load = () => store.state;
  const state = store.state;
  const save = () => store.save();
  const digitsOnly = (value) => String(value || "").replace(/\D/g, "");
  const configuredWhatsappNumber = () => {
    const country = digitsOnly(state.storeSettings?.whatsappCountryCode || "52");
    const local = digitsOnly(state.storeSettings?.whatsappNumber || "");
    return country && local ? `${country}${local}` : defaultWhatsappNumber;
  };
  const isProductVisible = product => Boolean(product) && product.enabled !== false && (!external || store.catalog.settings.enabled);
  const productGallery = (product) => {
    const media = Array.isArray(product?.media) ? product.media.filter((item) => item?.source_url) : [];
    return media.length ? media : (product?.image ? [{ source_url: product.image, is_primary: true, fit_mode: "cover", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0 }] : []);
  };
  const productPrimaryMedia = (product) => productGallery(product).find((item) => item.is_primary) || productGallery(product)[0] || { source_url: mediaFallback, fit_mode: "cover", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0 };
  const productImageStyle = (media) => `object-fit:${media?.fit_mode === "contain" ? "contain" : "cover"};object-position:${Math.max(0, Math.min(100, Number(media?.focal_x ?? 50)))}% ${Math.max(0, Math.min(100, Number(media?.focal_y ?? 50)))}%;transform:scale(${Math.max(1, Math.min(3, Number(media?.zoom ?? 1)))}) rotate(${Math.max(-180, Math.min(180, Number(media?.rotation ?? 0)))}deg)`;

  const mediaDatabaseName = "eb-casa-nopal-demo-media-v1";
  const mediaStoreName = "files";
  const mediaPrefix = `${stateKey}:`;
  const mediaFallback = `${imageBase}home-chilaquiles-900.jpg`;
  const mediaObjectUrls = new Map();
  let mediaDatabasePromise;
  const isLocalMedia = (value) => String(value || "").startsWith("demo-media:");
  const openMediaDatabase = () => {
    if (mediaDatabasePromise) return mediaDatabasePromise;
    mediaDatabasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(mediaDatabaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(mediaStoreName, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
    });
    return mediaDatabasePromise;
  };
  const mediaRequest = async (mode, value) => {
    const database = await openMediaDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(mediaStoreName, ["read", "get"].includes(mode) ? "readonly" : "readwrite");
      const request = value === undefined ? transaction.objectStore(mediaStoreName).getAllKeys() : transaction.objectStore(mediaStoreName)[mode](value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo actualizar la imagen local."));
    });
  };
  const saveMedia = async (file) => {
    if (!file?.type?.startsWith("image/")) throw new Error("Elige una imagen válida.");
    const key = `${mediaPrefix}${crypto.randomUUID()}`;
    await mediaRequest("put", { key, blob: file, updatedAt: new Date().toISOString() });
    return `demo-media:${key}`;
  };
  const resolveMediaUrl = async (image) => {
    if (!isLocalMedia(image)) return image || mediaFallback;
    const key = String(image).slice("demo-media:".length);
    if (mediaObjectUrls.has(key)) return mediaObjectUrls.get(key);
    const record = await mediaRequest("get", key);
    if (!record?.blob) return mediaFallback;
    const url = URL.createObjectURL(record.blob);
    mediaObjectUrls.set(key, url);
    return url;
  };
  const hydrateMediaImages = (scope = document) => {
    scope.querySelectorAll?.("[data-demo-media]").forEach(async (node) => {
      const image = node.dataset.demoMedia;
      try { node.src = await resolveMediaUrl(image); } catch (error) { node.src = mediaFallback; }
    });
  };
  const imageMarkup = (image, alt, className = "") => {
    const local = isLocalMedia(image);
    const attributes = local ? ` data-demo-media="${safe(image)}"` : "";
    return `<img${className ? ` class="${className}"` : ""} src="${safe(local ? mediaFallback : image || mediaFallback)}"${attributes} alt="${safe(alt)}">`;
  };
  const productImageMarkup = (product, className = "") => {
    const media = productPrimaryMedia(product);
    const local = isLocalMedia(media.source_url);
    if (media.type === "video") return `<video class="${safe(className)}" ${local ? `data-demo-media="${safe(media.source_url)}"` : `src="${safe(media.source_url)}"`} controls playsinline preload="metadata" aria-label="${safe(product.name)}"></video>`;
    return `<img${className ? ` class="${className}"` : ""} src="${safe(local ? mediaFallback : media.source_url || mediaFallback)}"${local ? ` data-demo-media="${safe(media.source_url)}"` : ""} alt="${safe(product.name)}" style="${productImageStyle(media)}">`;
  };
  const clearLocalMedia = async () => {
    const keys = await mediaRequest("read");
    await Promise.all(keys.filter((key) => String(key).startsWith(mediaPrefix)).map((key) => mediaRequest("delete", key)));
    mediaObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    mediaObjectUrls.clear();
  };
  const isStoreMode = mode === "store";
  const localPath = (path) => `${path}${path.includes("?") ? "&" : "?"}mode=${encodeURIComponent(mode)}`;
  const toast = (message) => {
    const node = document.querySelector("[data-toast]");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 2800);
  };
  const productById = (id) => state.products.find((product) => product.id === id);
  const cartCount = () => state.cart.reduce((total, item) => total + (store.model.catalogs.commerce.products.some(product => product.id === item.id) ? Math.max(0, Number(item.quantity) || 0) : 0), 0);
  const cartItems = () => state.cart.map((line) => ({ product: productById(line.id), quantity: Number(line.quantity) || 0 })).filter((line) => line.product && line.quantity > 0);
  const cartTotal = () => cartItems().reduce((total, line) => total + line.product.price * line.quantity, 0);
  const updateCartCount = () => document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = String(cartCount());
    node.classList.remove("cart-count-bump");
    void node.offsetWidth;
    node.classList.add("cart-count-bump");
  });
  const profileInitials = () => (state.profile.name || "Cuenta demo").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "CD";
  const renderProfileAvatars = () => document.querySelectorAll("[data-profile-avatar]").forEach((node) => { node.textContent = profileInitials(); });
  const formatDate = (date) => new Date(date).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const mapsLink = (coords) => `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=driving`;
  const formatCoords = (coords) => `${Number(coords.latitude).toFixed(6)}, ${Number(coords.longitude).toFixed(6)}`;
  const toggle = (node, visible) => node?.toggleAttribute("hidden", !visible);

  const addDemoContextBar = () => {
    if (params.get("editor") === "1" || document.querySelector(".demo-context-bar")) return;
    document.body.classList.add("has-demo-context-bar");
    document.body.insertAdjacentHTML("afterbegin", `<div class="demo-context-bar"><span class="demo-context-label"><b>Modo demo</b><em>${external ? "Presentación + Catálogo" : "Presentación + Tienda"}</em></span><nav aria-label="Navegación de demo"><a class="demo-context-action" href="../demo-project.html?mode=${mode}">← Volver al proyecto</a><a class="demo-context-action demo-context-action-secondary" href="../demo.html">Elegir recorrido</a></nav></div>`);
  };
  const preserveModeInLinks = () => {
    document.querySelectorAll("a[href]").forEach((anchor) => {
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|https?:\/\/wa\.me\/)/i.test(rawHref)) return;
      const url = new URL(rawHref, window.location.href);
      if (!url.pathname.endsWith(".html")) return;
      url.searchParams.set("mode", mode);
      anchor.href = url.href;
    });
  };
  const appNavIcon = (name) => ({
    tienda: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16l-1.3 10H5.3L4 10Z"/><path d="M8 10V8a4 4 0 0 1 8 0v2"/></svg>',
    carrito: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h2l2 9h8l2-6H8"/><path d="M10 20h.01"/><path d="M17 20h.01"/></svg>',
    pedidos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7z"/><path d="M9.5 8h5"/><path d="M9.5 12h5"/><path d="M9.5 16h3"/></svg>'
  }[name] || "");
  const initAppNavigation = () => {
    if (!isStoreMode || !["tienda", "detalle", "carrito", "mis-pedidos", "perfil"].includes(page) || document.querySelector(".app-nav")) return;
    const activePage = page === "carrito" || page === "mis-pedidos" ? page : "tienda";
    const links = external ? [{ id: "tienda", label: "Catálogo", href: localPath("tienda.html"), icon: "tienda" }] : [
      { id: "tienda", label: "Pedir", href: localPath("tienda.html"), icon: "tienda" },
      { id: "carrito", label: "Carrito", href: localPath("carrito.html"), icon: "carrito", badge: true },
      { id: "mis-pedidos", label: "Mis pedidos", href: localPath("mis-pedidos.html"), icon: "pedidos" }
    ];
    document.body.insertAdjacentHTML("beforeend", `<nav class="app-nav" aria-label="Navegación principal">${links.map((link) => `<a class="${activePage === link.id ? "active" : ""}" href="${link.href}" aria-label="${link.label}"><span class="app-nav-icon">${appNavIcon(link.icon)}${link.badge ? '<span class="app-nav-badge" data-cart-count>0</span>' : ""}</span><span>${link.label}</span></a>`).join("")}</nav>`);
  };
  const bindProfileShortcut = () => document.querySelectorAll("[data-profile-corner]").forEach((button) => button.addEventListener("click", () => { window.location.href = localPath("perfil-de-usuario.html"); }));

  const editorMode = params.get("editor") === "1";
  const editorState = () => {
    try { return JSON.parse(localStorage.getItem(editorKey) || "null") || { draft: {}, published: {}, history: [] }; } catch (error) { return { draft: {}, published: {}, history: [] }; }
  };
  const applyEditorState = () => Object.entries(editorState().published || {}).forEach(([key, value]) => document.querySelectorAll(`[data-eb-key="${CSS.escape(key)}"]`).forEach((node) => {
    if (node.dataset.ebEditable === "image") { if (isLocalMedia(value)) resolveMediaUrl(value).then(url => { node.src = url; }).catch(() => { node.src = mediaFallback; }); else node.src = value; }
    else if (node.dataset.ebEditable === "link") node.href = value;
    else node.textContent = value;
  }));
  let editorFrameMode = "edit";
  const editorRuntimeStyle = "[data-eb-editable]{outline:2px dashed rgba(183,255,74,.75)!important;outline-offset:3px!important;cursor:pointer!important}[data-eb-editable] iframe{pointer-events:none!important}";
  const setEditorRuntimeMode = (nextMode) => {
    if (!editorMode) return;
    editorFrameMode = nextMode === "preview" ? "preview" : "edit";
    let style = document.querySelector("#eb-demo-editor-runtime-style");
    if (editorFrameMode === "edit" && !style) {
      style = document.createElement("style");
      style.id = "eb-demo-editor-runtime-style";
      style.textContent = editorRuntimeStyle;
      document.head.appendChild(style);
    } else if (editorFrameMode === "preview") {
      style?.remove();
    }
  };
  const bindEditorBridge = () => {
    if (!editorMode) return;
    setEditorRuntimeMode("edit");
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (event.origin !== window.location.origin || event.source !== window.parent || !data || data.source !== "eb-demo-editor") return;
      if (data.type === "set-mode") setEditorRuntimeMode(data.mode);
      if (data.type === "apply-values") Object.entries(data.values || {}).forEach(([key, value]) => document.querySelectorAll(`[data-eb-key="${CSS.escape(key)}"]`).forEach((node) => {
        if (node.dataset.ebEditable === "image") { if (isLocalMedia(value)) resolveMediaUrl(value).then(url => { node.src = url; }).catch(() => { node.src = mediaFallback; }); else node.src = value; }
        else if (node.dataset.ebEditable === "link") node.href = value;
        else node.textContent = value;
      }));
    });
    document.addEventListener("click", (event) => {
      if (editorFrameMode === "preview") return;
      const node = event.target.closest?.("[data-eb-editable]");
      if (!node) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const value = node.dataset.ebEditable === "image" ? (node.currentSrc || node.src) : node.dataset.ebEditable === "link" ? node.href : node.textContent.trim();
      window.parent.postMessage({ source: "eb-demo-frame", type: "editable-click", key: node.dataset.ebKey, editable: node.dataset.ebEditable, role: node.dataset.ebRole, value }, window.location.origin);
    }, true);
  };

  const addToCart = (id, quantity = 1) => {
    const product = productById(id);
    const amount = Math.max(1, Number.parseInt(quantity, 10) || 1);
    if (external || !isProductVisible(product)) return;
    if (cartItems().length && store.cartCurrency().currency.id !== store.currency(product).id) { toast("No puedes mezclar monedas. Retira los otros productos o termina ese pedido primero."); return; }
    const line = state.cart.find((item) => item.id === id);
    if (line) line.quantity += amount;
    else state.cart.push({ id, quantity: amount });
    save();
    updateCartCount();
    toast(amount > 1 ? `${amount} productos agregados al carrito demo.` : "Producto agregado al carrito demo.");
  };
  const setCartQuantity = (id, quantity) => {
    const line = state.cart.find((item) => item.id === id);
    if (!line) return;
    const amount = Number.parseInt(quantity, 10) || 0;
    if (amount <= 0) state.cart = state.cart.filter((item) => item !== line);
    else line.quantity = amount;
    save();
    updateCartCount();
    renderCart();
  };
  const priceMarkup = product => {
    if (external && product.external_price_visible === false) return "";
    const current = product.price;
    if (current == null || current === "") return "";
    const before = Number(product.compareAtPrice) > Number(current) ? `<del>${safe(money(product.compareAtPrice, product))}</del> ` : "";
    return `<span class="price">${before}${safe(money(current, product))}</span>`;
  };
  const productCard = product => `<article class="product-card" data-product-id="${safe(product.id)}"><div class="product-media-frame" data-product-field="media">${productImageMarkup(product)}</div><div class="product-body"><div class="product-meta"><span class="category">${safe(product.category)}</span><span data-product-field="price">${priceMarkup(product)}</span></div><h2 data-product-field="name">${safe(product.name)}</h2><p data-product-field="description">${safe(product.description)}</p><div class="product-actions">${external ? "" : `<button class="button primary" data-add-product="${safe(product.id)}" data-add="${safe(product.id)}" type="button">Agregar</button>`}<a class="button secondary" data-product-detail-link href="${localPath(`detalle.html?id=${encodeURIComponent(product.id)}`)}">Ver producto</a></div></div></article>`;
  const renderCatalog = () => {
    const grid = document.querySelector("#productGrid");
    if (!grid) return;
    const query = String(document.querySelector("#searchInput")?.value || "").toLowerCase();
    const category = document.querySelector("[data-active-category]")?.dataset.activeCategory || "Todos";
    const visible = state.products.map((product, index) => ({ product, index })).filter(({ product }) => isProductVisible(product) && (category === "Todos" || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query)).sort((left, right) => {
      if (category !== "Todos") return left.index - right.index;
      return Math.max(0, state.categories.indexOf(left.product.category)) - Math.max(0, state.categories.indexOf(right.product.category)) || left.index - right.index;
    }).map(({ product }) => product);
    grid.innerHTML = visible.length ? visible.map(productCard).join("") : '<p class="muted">No encontramos productos con ese filtro.</p>';
    hydrateMediaImages(grid);
    grid.querySelectorAll("[data-add-product]").forEach((button) => button.addEventListener("click", () => addToCart(button.dataset.addProduct)));
  };
  const renderCategories = () => {
    const wrapper = document.querySelector("#categoryFilters");
    if (!wrapper) return;
    wrapper.innerHTML = state.categories.map((category, index) => `<button class="chip${index === 0 ? " active" : ""}" type="button" data-category="${safe(category)}">${safe(category)}</button>`).join("");
    wrapper.dataset.activeCategory = "Todos";
    wrapper.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
      wrapper.dataset.activeCategory = button.dataset.category;
      wrapper.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderCatalog();
    }));
  };
  const renderFeatured = () => {
    const grid = document.querySelector("#homeFeaturedProducts");
    if (!grid) return;
    grid.innerHTML = state.products.filter((product) => isProductVisible(product) && product.featured).slice(0, 6).map((product) => `<article class="home-featured-card"><div class="home-featured-image">${productImageMarkup(product)}</div><div class="home-featured-body"><span class="home-featured-category">${safe(product.category)}</span><h3>${safe(product.name)}</h3><p class="home-featured-description">${safe(product.description)}</p><div class="home-featured-bottom">${priceMarkup(product)}<a class="button primary" href="${localPath(`detalle.html?id=${encodeURIComponent(product.id)}`)}">Ver producto</a></div></div></article>`).join("");
    hydrateMediaImages(grid);
  };
  const renderDetail = () => {
    const product = productById(params.get("id"));
    const view = document.querySelector("#detailView");
    if (!view) return;
    if (!isProductVisible(product)) { view.innerHTML = '<div class="empty-state"><strong>Este producto no está disponible.</strong><a class="button secondary" href="tienda.html?mode=store">Volver</a></div>'; return; }
    const gallery = productGallery(product);
    const settings = store.catalog.settings;
    const offerUrl = external ? store.safeUrl(product.external_url) : "";
    const phone = external ? String(settings.contactPhone || "").replace(/\D/g, "") : "";
    const contact = external && settings.showContactPhone && /^[0-9]{8,15}$/.test(phone) ? `<p>Contacto: <a href="tel:+${phone}">+${phone}</a></p>` : "";
    const action = external ? `${settings.disclosureText ? `<p class="external-offer-disclosure">${safe(settings.disclosureText)}</p>` : ""}${contact}${offerUrl ? `<a class="button primary external-offer-cta" href="${safe(offerUrl)}" target="_blank" rel="noopener noreferrer">${safe(settings.ctaLabel || "Ver oferta")} ↗</a>` : '<p>Enlace no disponible.</p>'}` : `<div class="detail-quantity"><span>Cantidad</span><div class="quantity quantity-input"><button type="button" data-detail-minus aria-label="Quitar uno">−</button><input id="detailQuantity" type="number" min="1" value="1" inputmode="numeric"><button type="button" data-detail-plus aria-label="Agregar uno">+</button></div></div><div class="detail-actions"><button class="button primary" data-add="${safe(product.id)}" id="detailAdd" type="button">Agregar al carrito</button><a class="button secondary" href="${localPath("carrito.html")}">Ir al carrito</a></div>`;
    view.innerHTML = `<div class="detail-gallery"><div class="detail-media">${productImageMarkup(product, "detail-main-image")}</div>${gallery.length > 1 ? `<div class="detail-thumbnails">${gallery.map((media, index) => `<button type="button" class="detail-thumbnail${media.is_primary ? " active" : ""}" data-detail-media="${index}" aria-label="Ver medio ${index + 1}">${media.type === "video" ? "▶ Video" : imageMarkup(media.source_url, product.name)}</button>`).join("")}</div>` : ""}</div><div class="detail-copy"><span class="section-kicker">${safe(product.category)}</span><h1>${safe(product.name)}</h1><p>${safe(product.description)}</p>${priceMarkup(product)}${action}</div>`;
    hydrateMediaImages(view);
    view.querySelectorAll("[data-detail-media]").forEach(button => button.addEventListener("click", () => {
      const media = gallery[Number(button.dataset.detailMedia)];
      if (!media) return;
      view.querySelector(".detail-media").innerHTML = productImageMarkup({ ...product, media: [{ ...media, is_primary: true }] }, "detail-main-image");
      hydrateMediaImages(view);
      view.querySelectorAll("[data-detail-media]").forEach(item => item.classList.toggle("active", item === button));
    }));
    if (external) return;
    const input = view.querySelector("#detailQuantity");
    const quantity = () => { input.value = Math.max(1, Number.parseInt(input.value, 10) || 1); return Number(input.value); };
    view.querySelector("[data-detail-minus]").onclick = () => { input.value = Math.max(1, quantity() - 1); };
    view.querySelector("[data-detail-plus]").onclick = () => { input.value = quantity() + 1; };
    input.onchange = quantity;
    view.querySelector("#detailAdd").onclick = () => addToCart(product.id, quantity());
  };
  const renderCart = () => {
    const list = document.querySelector("#cartItems");
    if (!list) return;
    const items = cartItems();
    const hasItems = items.length > 0;
    const layout = document.querySelector(".cart-layout");
    const checkoutForm = document.querySelector("#checkoutForm");
    layout?.classList.toggle("is-empty", !hasItems);
    layout?.setAttribute("aria-busy", "false");
    toggle(checkoutForm, hasItems);
    if (hasItems) checkoutForm?.style.removeProperty("display");
    toggle(document.querySelector("#clearCartBtn"), hasItems);
    toggle(document.querySelector("#continueShoppingLink"), hasItems);
    const total = document.querySelector("#cartTotal");
    const invalid = store.cartCurrency().mixed || items.some(line => !isProductVisible(line.product));
    if (total) total.textContent = invalid ? "—" : money(cartTotal());
    const submit = document.querySelector("#checkoutForm [type=submit]");
    if (submit) submit.disabled = invalid;
    document.querySelector("#cartCurrencyNotice")?.remove();
    if (invalid) list.insertAdjacentHTML("afterend", '<p class="notice" id="cartCurrencyNotice" role="status">Retira productos no disponibles o de otra moneda antes de continuar.</p>');
    if (!hasItems) {
      list.innerHTML = `<div class="empty-state"><strong>Tu carrito está vacío</strong><span>Cuando agregues productos, aquí podrás revisar tu pedido y elegir cómo obtenerlo.</span><a class="button secondary" href="${localPath("tienda.html")}">Explorar productos</a></div>`;
      return;
    }
    list.innerHTML = items.map(({ product, quantity }) => `<article class="cart-item">${productImageMarkup(product)}<div class="cart-item-main"><h2>${safe(product.name)}</h2><p>${safe(money(product.price, product))}</p><a class="button secondary cart-product-link" href="${localPath(`detalle.html?id=${encodeURIComponent(product.id)}`)}">Ver producto</a></div><div class="cart-item-controls"><div class="quantity compact" aria-label="Cantidad de ${safe(product.name)}"><button type="button" data-cart-action="dec" data-cart-id="${safe(product.id)}" aria-label="Quitar uno">−</button><span>${quantity}</span><button type="button" data-cart-action="inc" data-cart-id="${safe(product.id)}" aria-label="Agregar uno">+</button></div><strong>${safe(money(product.price * quantity, product))}</strong><button class="remove-icon" type="button" data-cart-action="remove" data-cart-id="${safe(product.id)}">Quitar</button></div></article>`).join("");
    hydrateMediaImages(list);
    list.querySelectorAll("[data-cart-action]").forEach((button) => button.addEventListener("click", () => {
      const line = state.cart.find((item) => item.id === button.dataset.cartId);
      if (!line) return;
      const action = button.dataset.cartAction;
      setCartQuantity(line.id, action === "inc" ? line.quantity + 1 : action === "dec" ? line.quantity - 1 : 0);
    }));
  };

  let mapPicker = null;
  let mapMarker = null;
  let mapLayer = null;
  let pendingMapCoords = null;
  let mapStyleKey = "calle";
  const ensureLeaflet = () => {
    if (window.L) return Promise.resolve(window.L);
    if (document.querySelector("#demo-leaflet-script")) return new Promise((resolve, reject) => {
      document.querySelector("#demo-leaflet-script").addEventListener("load", () => resolve(window.L), { once: true });
      document.querySelector("#demo-leaflet-script").addEventListener("error", reject, { once: true });
    });
    if (!document.querySelector("#demo-leaflet-style")) {
      const style = document.createElement("link");
      style.id = "demo-leaflet-style";
      style.rel = "stylesheet";
      style.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(style);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.id = "demo-leaflet-script";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error("LEAFLET_LOAD_FAILED"));
      document.head.appendChild(script);
    });
  };
  const setMapPreview = (kind, coords) => {
    const prefix = kind === "gps" ? "gps" : "map";
    const preview = document.querySelector(`#${prefix}Preview`);
    if (!coords) {
      preview?.classList.remove("show");
      return;
    }
    const text = document.querySelector(`#${prefix}PreviewText`);
    const link = document.querySelector(`#${prefix}PreviewLink`);
    if (text) text.textContent = formatCoords(coords);
    if (link) link.href = mapsLink(coords);
    preview?.classList.add("show");
  };
  const selectedLocationCoords = () => state.checkout.locationMethod === "gps" ? state.checkout.gpsCoords : state.checkout.locationMethod === "map" ? state.checkout.mapCoords : null;
  const selectedLocationText = () => {
    if (state.checkout.locationMethod === "address") return state.checkout.manualLocation.trim();
    const coords = selectedLocationCoords();
    return coords ? `${state.checkout.locationMethod === "gps" ? "Ubicación GPS" : "Punto del mapa"}: ${formatCoords(coords)}\n${mapsLink(coords)}` : "";
  };
  const updateLocationStatus = () => {
    const status = document.querySelector("#locationStatus");
    if (!status) return;
    const hasLocation = Boolean(selectedLocationText());
    status.textContent = hasLocation ? `${state.checkout.locationMethod === "gps" ? "Ubicación GPS" : state.checkout.locationMethod === "map" ? "Punto del mapa" : "Dirección escrita"} lista.` : state.checkout.locationMethod === "gps" ? "Detecta tu ubicación para usar GPS." : state.checkout.locationMethod === "map" ? "Elige un punto en el mapa." : "";
  };
  const updateLocationPanels = () => {
    document.querySelectorAll("[data-location-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.locationPanel === state.checkout.locationMethod));
    document.querySelectorAll("input[name='locationMethod']").forEach((input) => { input.checked = input.value === state.checkout.locationMethod; });
    updateLocationStatus();
  };
  const applyShippingMode = () => {
    const delivery = state.checkout.shippingType === "Entrega a domicilio";
    toggle(document.querySelector("#deliveryPanel"), delivery);
    toggle(document.querySelector("#pickupPanel"), !delivery);
  };
  const writeCheckoutDraft = () => {
    const name = document.querySelector("#customerName");
    const address = document.querySelector("#manualLocation");
    const notes = document.querySelector("#deliveryNotes");
    if (name) state.checkout.customerName = name.value.trim();
    if (address) state.checkout.manualLocation = address.value.trim();
    if (notes) state.checkout.deliveryNotes = notes.value.trim();
    save();
  };
  const hydrateCheckout = () => {
    const name = document.querySelector("#customerName");
    const address = document.querySelector("#manualLocation");
    const notes = document.querySelector("#deliveryNotes");
    if (name) name.value = state.checkout.customerName || state.profile.name || "";
    if (address) address.value = state.checkout.manualLocation || state.profile.location || "";
    if (notes) notes.value = state.checkout.deliveryNotes || state.profile.reference || "";
    document.querySelectorAll("input[name='shippingType']").forEach((input) => { input.checked = input.value === state.checkout.shippingType; });
    const pickupName = document.querySelector("#pickupName");
    const pickupAddress = document.querySelector("#pickupAddress");
    const directions = document.querySelector("#storeDirectionsLink");
    if (pickupName) pickupName.textContent = storeLocation.name;
    if (pickupAddress) pickupAddress.textContent = `${storeLocation.address} · ${storeLocation.hours}`;
    if (directions) directions.href = storeLocation.directionsUrl;
    setMapPreview("gps", state.checkout.gpsCoords);
    setMapPreview("map", state.checkout.mapCoords);
    applyShippingMode();
    updateLocationPanels();
  };
  const requestUserCoords = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
  const setLocationLoading = (visible) => document.querySelector("#locationLoading")?.classList.toggle("show", visible);
  const setMapStyle = (key) => {
    if (!mapPicker || !window.L || !mapStyles[key] || key === mapStyleKey) return;
    const nextLayer = window.L.tileLayer(mapStyles[key].url, { maxZoom: 19, attribution: mapStyles[key].attribution });
    nextLayer.addTo(mapPicker);
    nextLayer.bringToBack();
    mapLayer?.remove();
    mapLayer = nextLayer;
    mapStyleKey = key;
    document.querySelectorAll("#mapStyleSwitch button").forEach((button) => button.classList.toggle("active", button.dataset.style === key));
  };
  const openMapPicker = async () => {
    const modal = document.querySelector("#mapModal");
    const status = document.querySelector("#mapModalStatus");
    const locationRequest = requestUserCoords();
    modal?.classList.add("open");
    if (status) status.textContent = "Cargando mapa…";
    try {
      const L = await ensureLeaflet();
      const start = state.checkout.mapCoords || state.checkout.gpsCoords || fallbackCoords;
      if (!mapPicker) {
        mapPicker = L.map("mapPicker", { zoomControl: true }).setView([start.latitude, start.longitude], 17);
        mapLayer = L.tileLayer(mapStyles[mapStyleKey].url, { maxZoom: 19, attribution: mapStyles[mapStyleKey].attribution }).addTo(mapPicker);
        mapMarker = L.marker([start.latitude, start.longitude], { draggable: true }).addTo(mapPicker);
        const updatePending = ({ lat, lng }) => {
          pendingMapCoords = { latitude: lat, longitude: lng };
          if (status) status.textContent = `Punto: ${formatCoords(pendingMapCoords)}`;
        };
        mapMarker.on("dragend", () => updatePending(mapMarker.getLatLng()));
        mapPicker.on("click", (event) => {
          mapMarker.setLatLng(event.latlng);
          updatePending(event.latlng);
        });
      }
      mapPicker.setView([start.latitude, start.longitude], 17);
      mapMarker.setLatLng([start.latitude, start.longitude]);
      pendingMapCoords = { latitude: start.latitude, longitude: start.longitude };
      if (status) status.textContent = `Punto: ${formatCoords(pendingMapCoords)}`;
      window.setTimeout(() => mapPicker.invalidateSize(), 80);
      void locationRequest.then((detectedCoords) => {
        if (!detectedCoords || state.checkout.mapCoords || !mapPicker || !mapMarker) return;
        mapPicker.setView([detectedCoords.latitude, detectedCoords.longitude], 17);
        mapMarker.setLatLng([detectedCoords.latitude, detectedCoords.longitude]);
        pendingMapCoords = detectedCoords;
        if (status) status.textContent = `Punto: ${formatCoords(pendingMapCoords)}`;
      });
    } catch (error) {
      modal?.classList.remove("open");
      toast("El mapa no se pudo cargar. Escribe tu dirección para continuar.");
    }
  };
  const closeMapPicker = () => {
    document.querySelector("#mapModal")?.classList.remove("open");
    pendingMapCoords = null;
  };
  const buildOrderMessage = (order) => [
    "[DEMO] CASA NOPAL",
    `[DEMO] *Pedido de prueba ${order.id}*`,
    "",
    "━━━━━━━━━━━━━━",
    "",
    "*Cliente:*",
    order.customerName,
    "",
    "*Tipo de envío:*",
    order.shippingType,
    "",
    "*Productos:*",
    ...order.items.flatMap((item) => [`• ${item.quantity} x ${item.name}`, `  ${money(item.price)} = *${safe(money(item.price * item.quantity, item))}*`]),
    "",
    "*Total:*",
    `*${safe(money(order.total, order))}*`,
    "",
    "*Pago:*",
    "Confirmar por WhatsApp",
    "",
    ...(order.shippingType === "Pasar a buscar" ? ["*Recoger en:*", storeLocation.address, "", "*Cómo llegar:*", storeLocation.directionsUrl] : ["*Dirección de entrega:*", order.locationText || "Dirección no especificada"]),
    "",
    "Este mensaje pertenece a una demostración local."
  ].join("\n");
  const makeOrder = () => {
    const items = cartItems();
    const order = {
      id: `DEMO-${crypto.randomUUID().slice(0, 8)}`,
      currency: store.cartCurrency().currency.code,
      currency_id: store.cartCurrency().currency.id,
      currency_display_label: store.cartCurrency().currency.display_label,
      createdAt: new Date().toISOString(),
      customerName: state.checkout.customerName,
      shippingType: state.checkout.shippingType,
      locationText: state.checkout.shippingType === "Entrega a domicilio" ? [selectedLocationText(), state.checkout.deliveryNotes ? `Referencia: ${state.checkout.deliveryNotes}` : ""].filter(Boolean).join("\n") : "",
      locationMethod: state.checkout.locationMethod,
      paymentMethod: "whatsapp",
      paymentStatus: "Preparado para WhatsApp",
      whatsappNumber: configuredWhatsappNumber(),
      total: cartTotal(),
      items: items.map(({ product, quantity }) => ({ id: product.id, name: product.name, price: product.price, quantity, currency: store.currency(product).code, currency_display_label: store.currency(product).display_label }))
    };
    order.message = buildOrderMessage(order);
    return order;
  };
  const whatsappChatUrl = (order) => `https://wa.me/${order.whatsappNumber || configuredWhatsappNumber()}?text=${encodeURIComponent(`[DEMO] Hola, ¿cómo va mi pedido? (${order.id})`)}`;
  const bindCart = () => {
    hydrateCheckout();
    document.querySelector("#clearCartBtn")?.addEventListener("click", () => {
      state.cart = [];
      save();
      updateCartCount();
      renderCart();
    });
    document.querySelectorAll("input[name='shippingType']").forEach((input) => input.addEventListener("change", () => {
      state.checkout.shippingType = input.value;
      save();
      applyShippingMode();
    }));
    document.querySelectorAll("input[name='locationMethod']").forEach((input) => input.addEventListener("change", () => {
      state.checkout.locationMethod = input.value;
      save();
      updateLocationPanels();
    }));
    ["#customerName", "#manualLocation", "#deliveryNotes"].forEach((selector) => document.querySelector(selector)?.addEventListener("input", writeCheckoutDraft));
    document.querySelector("#detectLocationBtn")?.addEventListener("click", async () => {
      state.checkout.locationMethod = "gps";
      updateLocationPanels();
      setLocationLoading(true);
      const coords = await requestUserCoords();
      setLocationLoading(false);
      if (!coords) {
        toast("No pudimos detectar tu ubicación. Puedes escribirla o elegirla en el mapa.");
        return;
      }
      state.checkout.gpsCoords = coords;
      save();
      setMapPreview("gps", coords);
      updateLocationStatus();
    });
    document.querySelector("#clearGpsBtn")?.addEventListener("click", () => {
      state.checkout.gpsCoords = null;
      save();
      setMapPreview("gps", null);
      updateLocationStatus();
    });
    document.querySelector("#openMapBtn")?.addEventListener("click", openMapPicker);
    document.querySelector("#clearMapBtn")?.addEventListener("click", () => {
      state.checkout.mapCoords = null;
      save();
      setMapPreview("map", null);
      updateLocationStatus();
    });
    document.querySelector("#cancelMapBtn")?.addEventListener("click", closeMapPicker);
    document.querySelector("#mapModal")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeMapPicker(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMapPicker(); });
    document.querySelector("#confirmMapBtn")?.addEventListener("click", () => {
      if (!pendingMapCoords) return;
      state.checkout.locationMethod = "map";
      state.checkout.mapCoords = pendingMapCoords;
      save();
      setMapPreview("map", pendingMapCoords);
      updateLocationPanels();
      closeMapPicker();
    });
    document.querySelectorAll("#mapStyleSwitch button").forEach((button) => button.addEventListener("click", () => setMapStyle(button.dataset.style)));
    document.querySelector("#checkoutForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      writeCheckoutDraft();
      if (!cartItems().length) return;
      if (!state.checkout.customerName) {
        toast("Escribe tu nombre para enviar el pedido demo.");
        document.querySelector("#customerName")?.focus();
        return;
      }
      if (state.checkout.shippingType === "Entrega a domicilio" && !selectedLocationText()) {
        toast("Elige o escribe la ubicación de entrega.");
        return;
      }
      if (store.cartCurrency().mixed || cartItems().some(line => !isProductVisible(line.product))) { toast("Revisa los productos y monedas del carrito antes de continuar."); return; }
      const order = makeOrder();
      state.orders.unshift(order);
      state.cart = [];
      save();
      updateCartCount();
      document.querySelector("#whatsappLoading")?.classList.add("show");
      window.open(`https://wa.me/${configuredWhatsappNumber()}?text=${encodeURIComponent(order.message)}`, "_blank", "noopener");
      window.setTimeout(() => { window.location.href = localPath("mis-pedidos.html"); }, 250);
    });
  };

  const renderProfile = () => {
    const form = document.querySelector("#customer-profile-form");
    if (!form) return;
    form.hidden = false;
    const status = document.querySelector("#customer-account-status");
    if (status) {
      status.hidden = false;
      status.textContent = "Cuenta demo local: tus datos no se envían a ningún servicio.";
    }
    [["#customerName", state.profile.name], ["#customerPhone", state.profile.phone], ["#manualLocation", state.profile.location], ["#customerReference", state.profile.reference]].forEach(([selector, value]) => {
      const field = document.querySelector(selector);
      if (field) field.value = value || "";
    });
    document.querySelector("#save-customer-profile-btn")?.removeAttribute("hidden");
    document.querySelector("#save-customer-profile-btn")?.removeAttribute("disabled");
  };
  const bindProfile = () => document.querySelector("#customer-profile-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.profile = {
      name: document.querySelector("#customerName").value.trim() || "Cuenta demo",
      phone: document.querySelector("#customerPhone").value.trim(),
      location: external ? state.profile.location : document.querySelector("#manualLocation").value.trim(),
      reference: external ? state.profile.reference : document.querySelector("#customerReference").value.trim()
    };
    state.checkout.customerName = state.profile.name;
    state.checkout.manualLocation ||= state.profile.location;
    state.checkout.deliveryNotes ||= state.profile.reference;
    save();
    renderProfileAvatars();
    document.querySelector("#customer-account-status").textContent = "Perfil demo guardado localmente ✓";
  });
  const renderOrders = () => {
    const notice = document.querySelector("#historyNotice");
    if (notice) notice.innerHTML = "<div class=\"notice-card\"><strong>Cuenta demo</strong><p>Tus pedidos solo se guardan en este navegador y se confirman por WhatsApp.</p></div>";
    toggle(document.querySelector("#ordersWorkspace"), false);
    toggle(document.querySelector("#completedOrdersHeading"), false);
    toggle(document.querySelector("#completedOrders"), false);
    const heading = document.querySelector("#whatsappOrdersHeading");
    const holder = document.querySelector("#whatsappOrders");
    const clearButton = document.querySelector("#clearWhatsappHistoryBtn");
    const orders = state.orders.filter((order) => order.paymentMethod === "whatsapp");
    toggle(heading, orders.length > 0);
    toggle(holder, orders.length > 0);
    toggle(clearButton, orders.length > 0);
    if (holder) holder.innerHTML = orders.map((order) => {
      const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
      return `<article class="current-order-card whatsapp-order"><div class="current-order-head"><div><p class="section-kicker">Pedido demo</p><h2>Preparado para WhatsApp</h2><p>${safe(order.customerName)} · ${safe(formatDate(order.createdAt))}</p></div><strong>${safe(money(order.total, order))}</strong></div><p class="whatsapp-order-note">Este pedido es una demostración. La confirmación ocurre en el chat de WhatsApp.</p><ul class="whatsapp-order-items">${order.items.map((item) => `<li>${item.quantity} x ${safe(item.name)} <strong>${safe(money(item.price * item.quantity, item))}</strong></li>`).join("")}</ul><div class="whatsapp-order-foot"><a class="button whatsapp full" href="${safe(whatsappChatUrl(order))}" target="_blank" rel="noopener">Abrir chat de WhatsApp</a><p class="muted">${itemCount} producto${itemCount === 1 ? "" : "s"} · ${safe(order.shippingType)}</p></div></article>`;
    }).join("");
    clearButton?.addEventListener("click", () => {
      state.orders = state.orders.filter((order) => order.paymentMethod !== "whatsapp");
      save();
      renderOrders();
      toast("Pedidos demo eliminados de este navegador.");
    }, { once: true });
  };
  const bindComments = () => {
    const list = document.querySelector("[data-opinions-list]");
    if (!list) return;
    let ratingDraft = null;
    const review = () => ({ ...seed.visitorReview, ...(state.visitorReview || {}) });
    const moderation = () => ({ ...seed.commentModeration, ...(state.commentModeration || {}) });
    const ownCommentId = "demo-visitor-review";
    const isHidden = (id) => moderation().hiddenIds.includes(id);
    const setStatus = (message = "") => { const status = document.querySelector("[data-opinions-status]"); if (status) status.textContent = message; };
    const ratingPicker = document.querySelector("[data-opinions-rating]");
    const ratingSave = document.querySelector("[data-opinions-save-rating]");
    const savedScore = () => Number(review().score || 0);
    const renderRatingPicker = () => {
      const score = ratingDraft === null ? savedScore() : ratingDraft;
      document.querySelectorAll("[data-opinions-score]").forEach((button) => {
        const selected = Number(button.dataset.opinionsScore) <= score;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (ratingSave) ratingSave.hidden = !ratingDraft || ratingDraft === savedScore();
    };
    const syncActions = () => {
      const current = review();
      const commentLabel = document.querySelector("[data-opinions-comment-label]");
      const ratingLabel = document.querySelector("[data-opinions-rating-label]");
      if (commentLabel) commentLabel.textContent = current.comment ? "Editar comentario" : "Dejar comentario";
      if (ratingLabel) ratingLabel.textContent = current.score ? "Modificar calificación" : "Calificar la experiencia";
      renderRatingPicker();
    };
    const draw = () => {
      const current = review();
      const visibleComments = state.comments.filter((comment) => !isHidden(comment.id));
      const ownVisible = !isHidden(ownCommentId);
      const ratings = [...visibleComments, ...(current.score && ownVisible ? [{ score: current.score }] : [])];
      const ownComment = current.comment && ownVisible ? `<article class="fonda-comment-card fonda-comment-card-own" style="--comment-index:0"><header><strong>${safe(state.profile.name || "Cuenta demo")}</strong><span>${current.score ? "★".repeat(Number(current.score)) : "Comentario demo"}</span></header><p>${safe(current.comment)}</p><div class="fonda-comment-actions"><button class="fonda-comment-action-link" type="button" data-opinions-edit-comment>Editar</button><button class="fonda-comment-action-link is-danger" type="button" data-opinions-delete-comment>Eliminar</button></div></article>` : "";
      const presetComments = visibleComments.map((comment, index) => `<article class="fonda-comment-card" style="--comment-index:${index + (ownComment ? 1 : 0)}"><header><strong>${safe(comment.name)}</strong><span>${"★".repeat(Number(comment.score) || 0)}</span></header><p>${safe(comment.text)}</p></article>`).join("");
      list.innerHTML = ownComment || presetComments ? `${ownComment}${presetComments}` : '<p class="fonda-comments-empty">Aún no hay comentarios.</p>';
      const average = ratings.reduce((sum, item) => sum + Number(item.score || 0), 0) / (ratings.length || 1);
      const averageNode = document.querySelector("[data-opinions-average]");
      const countNode = document.querySelector("[data-opinions-count]");
      if (averageNode) averageNode.textContent = ratings.length ? average.toFixed(1) : "—";
      if (countNode) countNode.textContent = ratings.length ? `${ratings.length} ${ratings.length === 1 ? "reseña demo" : "reseñas demo"}` : "Aún no hay reseñas";
      list.querySelector("[data-opinions-edit-comment]")?.addEventListener("click", openCommentEditor);
      list.querySelector("[data-opinions-delete-comment]")?.addEventListener("click", () => { state.visitorReview = { ...review(), comment: "", updatedAt: new Date().toISOString() }; save(); draw(); setStatus("Tu comentario demo fue eliminado."); });
      syncActions();
    };
    const isVisitorBlocked = () => moderation().visitorBlocked === true;
    const openCommentEditor = () => {
      if (isVisitorBlocked()) { setStatus("La Cuenta demo está bloqueada para publicar comentarios."); return; }
      const composer = document.querySelector("[data-opinions-composer]");
      if (!composer) return;
      document.querySelector("#fondaOpinionText").value = review().comment || "";
      composer.hidden = false;
      composer.querySelector("textarea")?.focus();
    };
    document.querySelector("[data-opinions-open-comment]")?.addEventListener("click", openCommentEditor);
    document.querySelector("[data-opinions-open-rating]")?.addEventListener("click", () => {
      if (isVisitorBlocked()) { setStatus("La Cuenta demo está bloqueada para publicar calificaciones."); return; }
      ratingDraft = null;
      ratingPicker.hidden = false;
      renderRatingPicker();
    });
    document.querySelectorAll("[data-opinions-cancel]").forEach((button) => button.addEventListener("click", (event) => {
      const form = event.target.closest("form");
      if (form === ratingPicker) { ratingDraft = null; renderRatingPicker(); syncActions(); }
      form.hidden = true;
    }));
    document.querySelector("[data-opinions-composer]")?.addEventListener("submit", (event) => { event.preventDefault(); const text = document.querySelector("#fondaOpinionText").value.trim(); if (!text) { setStatus("Escribe un comentario antes de guardarlo."); return; } state.visitorReview = { ...review(), comment: text, updatedAt: new Date().toISOString() }; save(); event.currentTarget.hidden = true; draw(); setStatus("Tu comentario demo fue guardado."); toast("Comentario guardado localmente."); });
    const ratingOptions = document.querySelector(".fonda-rating-options");
    const setRatingPreview = (score = 0) => document.querySelectorAll("[data-opinions-score]").forEach((button) => button.classList.toggle("is-preview", Number(button.dataset.opinionsScore) <= score));
    const celebrateRating = () => {
      if (!ratingOptions) return;
      ratingOptions.classList.remove("is-celebrating");
      void ratingOptions.offsetWidth;
      ratingOptions.classList.add("is-celebrating");
      window.setTimeout(() => ratingOptions.classList.remove("is-celebrating"), 560);
    };
    document.querySelectorAll("[data-opinions-score]").forEach((button) => {
      button.addEventListener("pointerenter", () => { if (!ratingPicker.hidden) setRatingPreview(Number(button.dataset.opinionsScore)); });
      button.addEventListener("focus", () => { if (!ratingPicker.hidden) setRatingPreview(Number(button.dataset.opinionsScore)); });
      button.addEventListener("pointerleave", () => { setRatingPreview(); renderRatingPicker(); });
      button.addEventListener("blur", () => { setRatingPreview(); renderRatingPicker(); });
      button.addEventListener("click", () => {
        if (isVisitorBlocked()) { setStatus("La Cuenta demo está bloqueada para publicar calificaciones."); return; }
        ratingDraft = Number(button.dataset.opinionsScore);
        renderRatingPicker();
        setStatus(ratingDraft === savedScore() ? "No hay cambios por guardar." : "Pulsa Aceptar para guardar tu calificación.");
      });
    });
    ratingSave?.addEventListener("click", () => {
      if (!ratingDraft || ratingDraft === savedScore()) return;
      state.visitorReview = { ...review(), score: ratingDraft, updatedAt: new Date().toISOString() };
      save();
      ratingDraft = null;
      ratingPicker.hidden = true;
      celebrateRating();
      draw();
      setStatus("Tu calificación demo fue guardada.");
      toast("Calificación guardada localmente.");
    });
    draw();
  };
  const syncCatalogInterface = () => {
    document.body.dataset.catalogType = store.catalogType;
    document.body.dataset.catalogState = "ready";
    document.querySelectorAll('a[href*="carrito.html"],a[href*="mis-pedidos.html"]').forEach(link => { if (external) link.hidden = true; });
    document.querySelectorAll('.fonda-nav-order,.nav a[href*="tienda.html"]').forEach(link => { link.textContent = external ? "Ver catálogo" : "Hacer pedido"; });
    document.querySelectorAll("#manualLocation,#customerReference").forEach(input => { if (external && page === "perfil") { input.closest("label").hidden = true; input.disabled = true; } });
    const back = document.querySelector("[data-catalog-back-link],.back-link[href^='tienda']");
    if (back) back.textContent = external ? "Volver al catálogo" : "Volver a tienda";
    if (page === "tienda") {
      const heading = document.querySelector(".page-title h1"); if (heading) heading.textContent = external ? "Explora el catálogo" : "Elige tu pedido";
      const kicker = document.querySelector(".page-title .section-kicker"); if (kicker) kicker.textContent = external ? "Productos disponibles" : "Pedidos por WhatsApp";
      document.querySelectorAll(".store-hours").forEach(node => { node.hidden = external; });
      if (params.has("catalog_notice")) document.querySelector("main")?.insertAdjacentHTML("afterbegin", '<p class="notice">En Catálogo no se usan carrito ni pedidos. Puedes explorar los productos aquí.</p>');
    }
  };
  const guardPageMode = () => {
    syncCatalogInterface();
    if (external && ["carrito", "mis-pedidos"].includes(page)) {
      document.querySelector("main")?.setAttribute("hidden", "");
      window.location.replace("tienda.html?mode=store&catalog_notice=1");
      return true;
    }
    if (external && !store.catalog.settings.enabled && ["tienda", "detalle"].includes(page)) {
      const main = document.querySelector("main");
      if (main) main.innerHTML = '<div class="empty-state"><strong>Este catálogo está oculto temporalmente.</strong><a href="../demo-store-admin.html">Administrar demo</a></div>';
      return true;
    }
    return false;
  };

  if (!guardPageMode()) {
    addDemoContextBar();
    preserveModeInLinks();
    applyEditorState();
    bindEditorBridge();
    initAppNavigation();
    updateCartCount();
    renderProfileAvatars();
    bindProfileShortcut();
    if (page === "inicio") {
      if (isStoreMode) renderFeatured();
      bindComments();
    }
    if (page === "tienda") {
      renderCategories();
      renderCatalog();
      document.querySelector("#searchInput")?.addEventListener("input", renderCatalog);
    }
    if (page === "detalle") renderDetail();
    if (page === "carrito") {
      renderCart();
      bindCart();
    }
    if (page === "perfil") {
      renderProfile();
      bindProfile();
    }
    if (page === "mis-pedidos") renderOrders();
  }

  window.DemoCasaNopal = {
    mode,
    state,
    seed: clone(seed),
    stateKey,
    editorKey,
    save,
    load,
    editorState,
    applyEditorState,
    saveMedia,
    resolveMediaUrl,
    isLocalMedia,
    configuredWhatsappNumber,
    reset: async () => {
      await clearLocalMedia().catch(() => {});
      await store.reset();
      window.location.reload();
    },
    money,
    clearLocalMedia
  };
  window.addEventListener("demo-store-external-change", () => window.location.reload());
})();
