(function () {
  "use strict";
  const stateKey = "eb-casa-nopal-combo-v3";
  const editorKey = "eb-casa-nopal-editor-combo-v3";
  const types = new Set(["commerce", "external_catalog"]);
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const fail = message => { throw new Error(message); };
  const currencies = ["MXN", "USD", "EUR", "CAD", "GBP"].map(code => ({ id: `demo-${code.toLowerCase()}`, code, display_label: code, is_system: true, enabled: true }));
  const meals = [
    ["chilaquiles", "Chilaquiles de la casa", "Desayunos", 125, "Totopos con salsa casera, crema, queso y huevo.", "home-chilaquiles-900.jpg"],
    ["enchiladas", "Enchiladas de mole", "Comidas", 145, "Tortillas rellenas de pollo con mole de la casa.", "home-enchiladas-900.jpg"],
    ["tacos", "Tacos de carnitas", "Comidas", 120, "Tres tacos con cebolla, cilantro y salsa.", "home-tacos-carnitas-900.jpg"],
    ["pastor", "Tacos al pastor", "Comidas", 115, "Carne adobada, piña y tortillas recién hechas.", "home-tacos-pastor-900.jpg"]
  ];
  function product(item, prefix = "") {
    return { id: prefix + item[0], name: item[1], category: item[2], price: item[3], description: item[4], image: `assets/${item[5]}`, media: [{ source_url: `assets/${item[5]}`, type: "image", is_primary: true, fit_mode: "cover", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0 }], featured: true, enabled: true, unitLabel: "c/u", compareAtPrice: null, currency_id: "demo-mxn", external_price_visible: true, external_url: prefix ? "https://example.com/" : "" };
  }
  function seed() {
    return { version: 3, active_catalog_type: "commerce", currencies: clone(currencies),
      catalogs: {
        commerce: { products: meals.map(item => product(item)), categories: ["Todos", "Desayunos", "Comidas"], customUnits: [] },
        external_catalog: { products: [product(["cafe", "Café para disfrutar en casa", "Favoritos", 180, "Oferta ficticia para conocer el recorrido hacia otro sitio.", "home-chilaquiles-900.jpg"], "oferta-"), product(["recetas", "Recetas de cocina mexicana", "Favoritos", 250, "Producto de ejemplo. No se realiza ninguna compra desde la demo.", "home-enchiladas-900.jpg"], "oferta-")], categories: ["Todos", "Favoritos"], customUnits: [], settings: { ctaLabel: "Ver oferta", disclosureText: "Abrirás otro sitio. Esta oferta es un ejemplo de demostración.", contactPhone: "", showContactPhone: false, enabled: true } }
      },
      storeSettings: { whatsappCountryCode: "52", whatsappNumber: "5629767176" },
      comments: [{ id: "demo-comment-1", name: "Mariana R.", score: 5, text: "La página se siente clara y el pedido es muy sencillo." }, { id: "demo-comment-2", name: "Carlos M.", score: 5, text: "Todo se ve muy rico y fácil de elegir." }],
      commentModeration: { hiddenIds: [], visitorBlocked: false }, profile: { name: "Cuenta demo", phone: "", location: "", reference: "" }, visitorReview: { score: null, comment: "", updatedAt: "" }, cart: [], orders: [],
      checkout: { customerName: "", shippingType: "Entrega a domicilio", locationMethod: "address", manualLocation: "", deliveryNotes: "", gpsCoords: null, mapCoords: null }
    };
  }
  const parse = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  function normalize(saved) {
    const base = seed();
    if (!saved || typeof saved !== "object") return base;
    for (const key of ["storeSettings", "commentModeration", "profile", "visitorReview", "checkout"]) base[key] = { ...base[key], ...saved[key] };
    for (const key of ["cart", "orders", "comments"]) if (Array.isArray(saved[key])) base[key] = saved[key];
    if (Array.isArray(saved.currencies) && saved.currencies.length) base.currencies = saved.currencies;
    if (types.has(saved.active_catalog_type)) base.active_catalog_type = saved.active_catalog_type;
    for (const type of types) {
      const source = saved.catalogs?.[type];
      if (!source) continue;
      for (const key of ["products", "categories", "customUnits"]) if (Array.isArray(source[key])) base.catalogs[type][key] = source[key];
      if (type === "external_catalog") base.catalogs[type].settings = { ...base.catalogs[type].settings, ...source.settings };
    }
    return base;
  }
  function load() {
    const saved = parse(stateKey);
    if (saved) return normalize(saved);
    const legacy = parse("eb-casa-nopal-store-v2");
    if (!legacy) return seed();
    const migrated = normalize(legacy);
    for (const key of ["products", "categories", "customUnits"]) if (Array.isArray(legacy[key])) migrated.catalogs.commerce[key] = clone(legacy[key]);
    migrated.catalogs.commerce.products.forEach(item => {
      item.currency_id ||= "demo-mxn";
      item.media = (item.media || []).map(media => ({ type: "image", ...media }));
    });
    return migrated;
  }
  let model = load();
  const view = {};
  for (const key of ["products", "categories", "customUnits"]) Object.defineProperty(view, key, { enumerable: true, get: () => model.catalogs[model.active_catalog_type][key], set: value => { model.catalogs[model.active_catalog_type][key] = value; } });
  for (const key of ["storeSettings", "comments", "commentModeration", "profile", "visitorReview", "cart", "orders", "checkout"]) Object.defineProperty(view, key, { enumerable: true, get: () => model[key], set: value => { model[key] = value; } });
  function save() {
    try { localStorage.setItem(stateKey, JSON.stringify(model)); }
    catch { fail("No se pudieron guardar los cambios en este navegador. Revisa el espacio o los permisos de almacenamiento."); }
    window.dispatchEvent(new CustomEvent("demo-casa-nopal-updated", { detail: { catalog_type: model.active_catalog_type } }));
  }
  function selectCatalog(type) {
    if (!types.has(type)) fail("Elige Tienda o Catálogo.");
    const previous = model.active_catalog_type;
    model.active_catalog_type = type;
    try { save(); } catch (error) { model.active_catalog_type = previous; throw error; }
  }
  function safeUrl(value) {
    try { const url = new URL(String(value || "").trim()); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
  }
  const currency = item => model.currencies.find(entry => entry.id === item?.currency_id) || model.currencies.find(entry => entry.code === String(item?.currency || "MXN").toUpperCase()) || currencies[0];
  const amount = (value, item) => `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(Number(value) || 0)} ${item?.currency_display_label || currency(item).display_label}`;
  const currencyUse = currencyId => [...types].flatMap(type => model.catalogs[type].products).filter(item => item.currency_id === currencyId).length;
  function saveCurrency(input, currencyId = null) {
    const existing = model.currencies.find(item => item.id === currencyId);
    const code = String(existing?.code || input.code || "").trim().toUpperCase();
    const label = String(input.display_label || "").trim();
    if (!/^[A-Z]{3,8}$/.test(code)) fail("El código debe tener de 3 a 8 letras.");
    if (!label || label.length > 40) fail("La etiqueta debe tener de 1 a 40 caracteres.");
    if (model.currencies.some(item => item.id !== currencyId && item.code === code)) fail("Ya existe una moneda con ese código.");
    const next = { id: existing?.id || `demo-${id()}`, code, display_label: label, is_system: existing?.is_system || false, enabled: existing?.enabled !== false };
    if (existing) Object.assign(existing, next); else model.currencies.push(next);
    save(); return next;
  }
  function changeCurrency(currencyId, action) {
    const entry = model.currencies.find(item => item.id === currencyId);
    if (!entry) fail("No encontramos esa moneda.");
    if (entry.is_system) fail("Las monedas base siempre están disponibles y no se eliminan.");
    if (action === "delete") {
      if (currencyUse(currencyId)) fail("No puedes eliminar una moneda utilizada por productos de Tienda o Catálogo.");
      model.currencies = model.currencies.filter(item => item.id !== currencyId);
    } else entry.enabled = !entry.enabled;
    save();
  }
  function validateProduct(input, previous = null, type = model.active_catalog_type) {
    if (!types.has(type)) fail("Tipo de catálogo inválido.");
    if (type !== model.active_catalog_type) fail("El catálogo cambió en otra pestaña. Actualiza la vista antes de guardar.");
    const name = String(input.name || "").trim();
    if (!name || name.length > 160) fail("Escribe un nombre de hasta 160 caracteres.");
    const visible = type === "commerce" || input.external_price_visible !== false;
    const next = { ...previous, ...input, id: previous?.id || `demo-${id()}`, name, external_price_visible: visible };
    if (visible) {
      if (input.price === "" || input.price == null || !Number.isFinite(Number(input.price)) || Number(input.price) < 0) fail("Escribe un precio actual válido.");
      next.price = Number(input.price);
      const before = input.compareAtPrice;
      next.compareAtPrice = before === "" || before == null ? null : Number(before);
      if (next.compareAtPrice != null && (!Number.isFinite(next.compareAtPrice) || next.compareAtPrice <= next.price)) fail("El precio anterior debe ser mayor que el precio actual.");
      const selected = model.currencies.find(item => item.id === input.currency_id);
      if (!selected || (!selected.enabled && previous?.currency_id !== selected.id)) fail("Selecciona una moneda disponible.");
      next.currency_id = selected.id;
    } else for (const key of ["price", "compareAtPrice", "currency_id"]) next[key] = previous?.[key] ?? null;
    if (type === "external_catalog") {
      next.external_url = safeUrl(input.external_url);
      if (!next.external_url) fail("Escribe el enlace HTTP o HTTPS donde se consigue el producto.");
    } else next.external_url = "";
    next.description = String(input.description || "").trim().slice(0, 600);
    next.category = String(input.category || "Sin categoría");
    next.unitLabel = String(input.unitLabel || "c/u");
    next.media = validateMedia(input.media || []);
    next.image = next.media.find(item => item.is_primary && item.type !== "video")?.source_url || "";
    return next;
  }
  function validateMedia(items) {
    if (!Array.isArray(items) || items.length > 6) fail("Puedes agregar hasta 5 imágenes y 1 video.");
    if (items.filter(item => item.type === "video").length > 1 || items.filter(item => item.type !== "video").length > 5) fail("Puedes agregar hasta 5 imágenes y 1 video.");
    const result = items.map(item => {
      const url = String(item.source_url || "");
      if (!url.startsWith("demo-media:") && !/^assets\/[\w./-]+$/.test(url) && !safeUrl(url)) fail("El medio debe tener un archivo local o una URL HTTP/HTTPS válida.");
      if (item.type && !["image", "video"].includes(item.type)) fail("Tipo de medio inválido.");
      return { ...item, type: item.type || "image", source_url: url };
    });
    const primary = Math.max(0, result.findIndex(item => item.is_primary));
    return result.map((item, index) => ({ ...item, is_primary: index === primary }));
  }
  function saveProduct(input, type = model.active_catalog_type) {
    if (type !== model.active_catalog_type) fail("El catálogo cambió en otra pestaña. Actualiza la vista antes de guardar.");
    const list = model.catalogs[type]?.products;
    if (!list) fail("Tipo de catálogo inválido.");
    const previous = input.id ? list.find(item => item.id === input.id) : null;
    if (input.id && !previous) fail("El producto no pertenece al catálogo que estás administrando.");
    const next = validateProduct(input, previous, type);
    const index = previous ? list.indexOf(previous) : list.length;
    list[index] = next;
    try { save(); } catch (error) { if (previous) list[index] = previous; else list.pop(); throw error; }
    return next;
  }
  function deleteProduct(productId, type = model.active_catalog_type) {
    if (type !== model.active_catalog_type) fail("El catálogo cambió. Actualiza la vista.");
    model.catalogs[type].products = model.catalogs[type].products.filter(item => item.id !== productId);
    if (type === "commerce") model.cart = model.cart.filter(item => item.id !== productId);
    save();
  }
  function cartCurrency() {
    const lines = model.cart.map(line => ({ ...line, product: model.catalogs.commerce.products.find(item => item.id === line.id) })).filter(line => line.product && line.quantity > 0);
    const identities = new Set(lines.map(line => currency(line.product).id));
    return { mixed: identities.size > 1, currency: lines.length ? currency(lines[0].product) : currencies[0] };
  }
  async function reset() {
    model = seed();
    save();
    localStorage.setItem(editorKey, JSON.stringify({ draft: {}, published: {}, history: [], historyIndex: -1 }));
    if (window.DemoCasaNopal?.clearLocalMedia) await window.DemoCasaNopal.clearLocalMedia();
  }
  if (!localStorage.getItem(editorKey)) {
    const legacyEditor = localStorage.getItem("eb-casa-nopal-editor-store-v2") || localStorage.getItem("eb-casa-nopal-editor-page-v2");
    if (legacyEditor) { try { localStorage.setItem(editorKey, legacyEditor); } catch {} }
  }
  window.addEventListener("storage", event => {
    if (event.key !== stateKey || !event.newValue) return;
    try { model = normalize(JSON.parse(event.newValue)); window.dispatchEvent(new CustomEvent("demo-store-external-change")); } catch {}
  });
  window.DemoStore = { state: view, stateKey, editorKey, seed, save, selectCatalog, safeUrl, currency, amount, currencyUse, saveCurrency, changeCurrency, validateProduct, validateMedia, saveProduct, deleteProduct, cartCurrency, reset,
    get model() { return model; }, get catalogType() { return model.active_catalog_type; }, get catalog() { return model.catalogs[model.active_catalog_type]; }
  };
})();
