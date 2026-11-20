(function () {
  "use strict";
  const store = window.DemoStore;
  const gallery = window.DemoProductGallery;
  const query = selector => document.querySelector(selector);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const productForm = query("#product-form");
  const settingsForm = query("#store-settings-form");
  const productDialog = query("#product-dialog");
  const managerDialog = query("#manager-dialog");
  const defaults = ["c/u", "pieza", "paquete", "kg", "litro", "porción"];
  let productBaseline = "";
  let settingsBaseline = "";
  let editingType = store.catalogType;
  let manager = "categories";
  let externalChange = false;
  const FUTURE_LOCAL_CAPABILITIES = Object.freeze({
    inventory: false,
    orders: false,
    staff: false
  });
  const show = dialog => typeof dialog.showModal === "function" ? dialog.showModal() : dialog.setAttribute("open", "");
  const close = dialog => typeof dialog.close === "function" ? dialog.close() : dialog.removeAttribute("open");
  const signature = form => JSON.stringify([...new FormData(form)]);
  const productSignature = () => signature(productForm) + JSON.stringify(gallery.get());
  const productDirty = () => productDialog.open && productSignature() !== productBaseline;
  const settingsDirty = () => signature(settingsForm) !== settingsBaseline;
  const status = message => { query("#admin-status").textContent = message; };
  function options(select, values, selected) {
    select.innerHTML = values.map(value => `<option value="${safe(value)}">${safe(value)}</option>`).join("");
    if (values.includes(selected)) select.value = selected;
  }
  function refreshOptions() {
    options(productForm.elements.category, [...new Set(["Sin categoría", ...store.state.categories.filter(name => name !== "Todos")])], productForm.elements.category.value);
    options(productForm.elements.unitLabel, [...defaults, ...store.state.customUnits], productForm.elements.unitLabel.value);
    const selected = productForm.elements.currency_id.value;
    productForm.elements.currency_id.innerHTML = store.model.currencies.map(item => `<option value="${safe(item.id)}" ${!item.enabled && item.id !== selected ? "disabled" : ""}>${safe(item.code)} · ${safe(item.display_label)}${!item.enabled ? " (retirada)" : ""}</option>`).join("");
    if (store.model.currencies.some(item => item.id === selected)) productForm.elements.currency_id.value = selected;
  }
  function syncPrice() {
    const visible = store.catalogType === "commerce" || productForm.elements.external_price_visible.checked;
    query("#product-price-fields").hidden = !visible;
    for (const name of ["price", "compareAtPrice", "currency_id"]) productForm.elements[name].disabled = !visible;
    productForm.elements.price.required = visible;
    productForm.elements.currency_id.required = visible;
  }
  function catalogLabel() {
    return store.catalogType === "external_catalog" ? "Catálogo" : "Tienda";
  }
  function renderOverview() {
    const products = store.state.products || [];
    const visible = products.filter(item => item.enabled).length;
    const featured = products.filter(item => item.featured).length;
    const media = products.reduce((total, item) => total + (item.media?.length || (item.image ? 1 : 0)), 0);
    const values = {
      "#admin-summary-products": products.length,
      "#admin-summary-visible": visible,
      "#admin-summary-featured": featured,
      "#admin-summary-media": media
    };
    Object.entries(values).forEach(([selector, value]) => {
      const element = query(selector);
      if (element) element.textContent = String(value);
    });
    const currentCatalog = query("#admin-current-catalog");
    if (currentCatalog) currentCatalog.textContent = catalogLabel();
  }
  function setView(view) {
    const allowed = new Set(["overview", "products", "comments", "settings"]);
    const next = allowed.has(view) ? view : "overview";
    document.querySelectorAll("[data-admin-view]").forEach(section => {
      section.hidden = section.dataset.adminView !== next;
    });
    document.querySelectorAll("[data-view]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.view === next);
    });
    if (next === "overview") renderOverview();
    if (next === "comments") renderComments();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const productFallbackMarkup = () => '<div class="admin-product-placeholder" aria-label="Producto sin imagen"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 3-3 5 5"/></svg></div>';

  function productMediaMarkup(item) {
    const media = Array.isArray(item.media) ? item.media : [];
    const primary = media.find(entry => entry.is_primary) || media[0] || null;
    const source = primary?.source_url || primary?.url || primary?.src || item.image || "";
    if (!source) return productFallbackMarkup();
    if (primary?.type === "video") {
      return `<video muted playsinline preload="metadata" data-admin-media="${safe(source)}" aria-label="Video de ${safe(item.name)}"></video><span class="admin-product-media-kind">Video</span>`;
    }
    return `<img src="demo-casa-nopal/assets/producto-generico.svg" data-admin-media="${safe(source)}" alt="Imagen de ${safe(item.name)}" loading="lazy">`;
  }

  function hydrateProductMedia() {
    document.querySelectorAll("[data-admin-media]").forEach(async element => {
      const source = element.dataset.adminMedia;
      try {
        const url = await window.DemoMedia.resolve(source);
        if (!element.isConnected || element.dataset.adminMedia !== source) return;
        element.onerror = () => {
          element.onerror = null;
          const container = element.closest(".admin-product-media");
          if (container) container.innerHTML = productFallbackMarkup();
        };
        element.src = url;
        if (element.tagName === "VIDEO") element.load();
      } catch {
        const container = element.closest(".admin-product-media");
        if (container) container.innerHTML = productFallbackMarkup();
      }
    });
  }
  function renderProducts() {
    const search = query("#product-search").value.trim().toLowerCase();
    const products = store.state.products.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search));
    query("#admin-products").innerHTML = products.map(item => `<article class="panel admin-product"><div class="admin-product-media">${productMediaMarkup(item)}</div><div class="admin-product-content"><span class="admin-product-state">${safe(item.category)} · ${item.enabled ? "Visible" : "Oculto"}</span><h2>${safe(item.name)}</h2><p>${safe(item.description)}</p><strong>${store.catalogType === "external_catalog" && item.external_price_visible === false ? "Precio oculto" : safe(store.amount(item.price, item))}</strong><div class="actions"><button type="button" data-edit="${safe(item.id)}">Editar</button><button type="button" data-toggle="${safe(item.id)}">${item.enabled ? "Ocultar" : "Mostrar"}</button><button type="button" data-delete="${safe(item.id)}">Eliminar</button></div></div></article>`).join("") || '<p>No encontramos productos.</p>';
    hydrateProductMedia();
    renderOverview();
  }
  function renderSettings() {
    const external = store.catalogType === "external_catalog";
    query("#catalog-type").value = store.catalogType;
    query("#admin-mode-label").textContent = external ? "Catálogo" : "Tienda";
    const currentCatalog = query("#admin-current-catalog");
    if (currentCatalog) currentCatalog.textContent = catalogLabel();
    query("#commerce-settings").hidden = external;
    query("#catalog-settings").hidden = !external;
    const values = { ...store.state.storeSettings, ...store.state.imageSettings, ...store.model.catalogs.external_catalog.settings };
    for (const name of ["whatsappCountryCode", "whatsappNumber", "ctaLabel", "disclosureText", "contactPhone", "imageFit", "imageAspect", "imageRadius", "imageBackground", "imagePadding"]) settingsForm.elements[name].value = values[name] ?? "";
    settingsForm.elements.showContactPhone.checked = values.showContactPhone;
    settingsForm.elements.catalogEnabled.checked = values.enabled;
    for (const field of query("#commerce-settings").querySelectorAll("input")) field.disabled = external;
    for (const field of query("#catalog-settings").querySelectorAll("input,textarea")) field.disabled = !external;
    settingsBaseline = signature(settingsForm);
    renderOverview();
  }
  function saveSettings() {
    if (externalChange) throw new Error("Actualiza la vista antes de guardar.");
    store.state.imageSettings = {
      fitMode: settingsForm.elements.imageFit.value,
      aspect: settingsForm.elements.imageAspect.value,
      radius: settingsForm.elements.imageRadius.value,
      background: settingsForm.elements.imageBackground.value,
      padding: Number(settingsForm.elements.imagePadding.value || 12)
    };
    if (store.catalogType === "commerce") {
      const country = settingsForm.elements.whatsappCountryCode.value.replace(/\D/g, "");
      const number = settingsForm.elements.whatsappNumber.value.replace(/\D/g, "");
      if (!/^[0-9]{1,4}$/.test(country) || !/^[0-9]{8,15}$/.test(country + number)) throw new Error("Escribe un código de país y un número de WhatsApp válidos.");
      store.state.storeSettings = { whatsappCountryCode: country, whatsappNumber: number };
    } else {
      const cta = settingsForm.elements.ctaLabel.value.trim();
      const phone = settingsForm.elements.contactPhone.value.replace(/\D/g, "");
      if (cta.length < 2 || cta.length > 60) throw new Error("El texto del botón debe tener de 2 a 60 caracteres.");
      if (phone && !/^[0-9]{8,15}$/.test(phone)) throw new Error("El teléfono debe tener de 8 a 15 dígitos.");
      if (settingsForm.elements.showContactPhone.checked && !phone) throw new Error("Agrega un teléfono para mostrarlo al público.");
      Object.assign(store.catalog.settings, { ctaLabel: cta, disclosureText: settingsForm.elements.disclosureText.value.trim(), contactPhone: phone, showContactPhone: settingsForm.elements.showContactPhone.checked, enabled: settingsForm.elements.catalogEnabled.checked });
    }
    store.save(); settingsBaseline = signature(settingsForm); query("#settings-status").textContent = "Configuración guardada en este navegador. Abre el sitio para verla.";
  }
  function saveProduct() {
    if (externalChange || gallery.isBusy()) throw new Error("Espera a que terminen los archivos o actualiza la vista si cambió en otra pestaña.");
    const values = Object.fromEntries(new FormData(productForm));
    store.saveProduct({ ...values, id: values.id || undefined, external_price_visible: productForm.elements.external_price_visible.checked, featured: productForm.elements.featured.checked, enabled: productForm.elements.enabled.checked, media: gallery.get() }, editingType);
    productBaseline = productSignature(); close(productDialog); renderProducts();
    window.DemoMedia.prune().catch(error => status(error.message));
    status("Producto guardado en este navegador.");
  }
  function decision() {
    const dialog = query("#decision-dialog");
    show(dialog);
    return new Promise(resolve => {
      const finish = value => { close(dialog); dialog.onclick = null; dialog.oncancel = null; resolve(value); };
      dialog.onclick = event => { const button = event.target.closest("[data-decision]"); if (button) finish(button.dataset.decision); };
      dialog.oncancel = event => { event.preventDefault(); finish("cancel"); };
    });
  }
  async function leave() {
    if (gallery.isBusy()) { status("Espera a que termine la carga de archivos."); return false; }
    if (!productDirty() && !settingsDirty()) return true;
    const answer = await decision();
    if (answer === "cancel") return false;
    if (answer === "save") {
      try { if (productDirty()) saveProduct(); if (settingsDirty()) saveSettings(); }
      catch (error) { status(error.message); query("#product-status").textContent = error.message; return false; }
    }
    if (answer === "discard") { close(productDialog); renderSettings(); productBaseline = productSignature(); window.DemoMedia.prune().catch(() => {}); }
    return true;
  }
  function openProduct(productId = null) {
    if (externalChange) return status("Actualiza la vista antes de editar.");
    editingType = store.catalogType;
    const item = store.state.products.find(product => product.id === productId) || { id: "", name: "", category: "Sin categoría", unitLabel: "c/u", price: "", compareAtPrice: "", currency_id: "demo-mxn", description: "", external_url: "", external_price_visible: true, enabled: true, featured: false, media: [] };
    productForm.reset(); refreshOptions();
    for (const name of ["id", "name", "category", "unitLabel", "price", "compareAtPrice", "currency_id", "description", "external_url"]) productForm.elements[name].value = item[name] ?? "";
    refreshOptions();
    for (const name of ["external_price_visible", "enabled", "featured"]) productForm.elements[name].checked = item[name] !== false && (name !== "featured" || Boolean(item.featured));
    document.querySelectorAll("[data-external-product]").forEach(node => { node.hidden = editingType !== "external_catalog"; });
    document.querySelectorAll("[data-commerce-product]").forEach(node => { node.hidden = editingType !== "commerce"; });
    productForm.elements.external_url.required = editingType === "external_catalog";
    productForm.elements.external_url.disabled = editingType !== "external_catalog";
    gallery.set(item.media?.length ? item.media : item.image ? [{ source_url: item.image, type: "image", is_primary: true }] : []);
    syncPrice(); query("#product-status").textContent = ""; productBaseline = productSignature(); show(productDialog);
  }
  function renderManager() {
    query("#manager-title").textContent = { categories: "Personalizar categorías", units: "Personalizar unidades", currencies: "Personalizar monedas" }[manager];
    query("#manager-code-field").hidden = manager !== "currencies";
    query("#manager-name-label").textContent = manager === "currencies" ? "Etiqueta pública" : "Nombre";
    query("#manager-form").elements.label.maxLength = manager === "currencies" ? 40 : 80;
    const list = manager === "currencies" ? store.model.currencies : (manager === "units" ? [...defaults, ...store.state.customUnits] : store.state.categories.filter(name => name !== "Todos")).map(name => ({ id: name, display_label: name, is_system: manager === "units" && defaults.includes(name) }));
    query("#manager-list").innerHTML = list.map(item => `<article class="manager-row"><div><strong>${safe(item.code || "")} ${safe(item.display_label)}</strong><p class="muted">${item.is_system ? "Base: siempre disponible" : "Personalizada"}${manager === "currencies" ? ` · ${store.currencyUse(item.id)} productos · ${item.enabled ? "Disponible" : "Retirada"}` : ""}</p></div><div class="actions">${manager !== "units" || !item.is_system ? `<button type="button" data-manager-edit="${safe(item.id)}">Editar${manager === "currencies" ? " etiqueta" : ""}</button>` : ""}${!item.is_system ? `<button type="button" data-manager-delete="${safe(item.id)}">Eliminar</button>${manager === "currencies" ? `<button type="button" data-manager-toggle="${safe(item.id)}">${item.enabled ? "Retirar" : "Reactivar"}</button>` : ""}` : ""}</div></article>`).join("") || "Todavía no hay elementos personalizados.";
  }
  document.querySelectorAll("[data-view]").forEach(button => button.onclick = () => setView(button.dataset.view));
  document.querySelectorAll("[data-view-target]").forEach(button => button.onclick = () => setView(button.dataset.viewTarget));
  query("#admin-summary-open-products").onclick = () => setView("products");
  query("#new-product").onclick = () => openProduct();
  query("#product-search").oninput = renderProducts;
  query("#admin-products").onclick = event => {
    const button = event.target.closest("[data-edit],[data-toggle],[data-delete]"); if (!button) return;
    if (button.dataset.edit) return openProduct(button.dataset.edit);
    try {
      if (externalChange) throw new Error("Actualiza la vista antes de modificar productos.");
      const item = store.state.products.find(product => product.id === (button.dataset.toggle || button.dataset.delete));
      if (button.dataset.toggle) { item.enabled = !item.enabled; store.save(); }
      else if (window.confirm(`¿Eliminar «${item.name}» de ${store.catalogType === "commerce" ? "Tienda" : "Catálogo"}?`)) store.deleteProduct(item.id);
      renderProducts();
    } catch (error) { status(error.message); }
  };
  productForm.onsubmit = event => { event.preventDefault(); try { saveProduct(); } catch (error) { query("#product-status").textContent = error.message; } };
  settingsForm.onsubmit = event => { event.preventDefault(); try { saveSettings(); } catch (error) { query("#settings-status").textContent = error.message; } };
  productForm.elements.external_price_visible.onchange = syncPrice;
  const closeProduct = async () => { if (await leave()) { close(productDialog); window.DemoMedia.prune().catch(() => {}); } };
  query("#close-product").onclick = closeProduct; query("#cancel-product").onclick = closeProduct;
  productDialog.oncancel = event => { event.preventDefault(); closeProduct(); };
  query("#catalog-type").onchange = async event => { const type = event.target.value; if (!(await leave())) { event.target.value = store.catalogType; return; } try { store.selectCatalog(type); renderSettings(); renderProducts(); status("Tipo cambiado. Los datos del otro recorrido siguen guardados."); } catch (error) { status(error.message); } };
  document.querySelectorAll("[data-manager]").forEach(button => button.onclick = () => { manager = button.dataset.manager; query("#manager-form").reset(); query("#manager-status").textContent = ""; renderManager(); show(managerDialog); });
  query("#close-manager").onclick = () => { close(managerDialog); refreshOptions(); };
  query("#manager-form").onsubmit = event => {
    event.preventDefault();
    try {
      if (externalChange) throw new Error("Actualiza la vista antes de personalizar.");
      const form = event.currentTarget; const name = form.elements.label.value.trim();
      if (!name || name.toLowerCase() === "todos") throw new Error("Escribe un nombre válido.");
      if (manager === "currencies") store.saveCurrency({ code: form.elements.code.value, display_label: name });
      else { const list = manager === "units" ? store.state.customUnits : store.state.categories; if ([...list, ...(manager === "units" ? defaults : [])].some(item => item.toLowerCase() === name.toLowerCase())) throw new Error("Ese nombre ya existe."); list.push(name); store.save(); }
      form.reset(); renderManager(); refreshOptions();
    } catch (error) { query("#manager-status").textContent = error.message; }
  };
  query("#manager-list").onclick = event => {
    const button = event.target.closest("[data-manager-edit],[data-manager-delete],[data-manager-toggle]"); if (!button) return;
    try {
      if (externalChange) throw new Error("Actualiza la vista antes de personalizar.");
      const key = button.dataset.managerEdit || button.dataset.managerDelete || button.dataset.managerToggle;
      if (manager === "currencies") {
        if (button.dataset.managerEdit) { const entry = store.model.currencies.find(item => item.id === key); const label = window.prompt("Etiqueta que verá el cliente", entry.display_label); if (label != null) store.saveCurrency({ display_label: label }, key); }
        else if (button.dataset.managerToggle) store.changeCurrency(key, "toggle");
        else if (window.confirm("¿Eliminar esta moneda? Si está utilizada en algún catálogo no se podrá eliminar.")) store.changeCurrency(key, "delete");
      } else {
        const list = manager === "units" ? store.state.customUnits : store.state.categories;
        const field = manager === "units" ? "unitLabel" : "category";
        if (button.dataset.managerEdit) { const name = window.prompt("Nuevo nombre", key)?.trim(); if (!name || name === key) return; if (name.length > 80 || name.toLowerCase() === "todos" || [...list, ...(manager === "units" ? defaults : [])].some(item => item.toLowerCase() === name.toLowerCase())) throw new Error("Nombre inválido o repetido."); list.splice(list.indexOf(key), 1, name); store.state.products.forEach(item => { if (item[field] === key) item[field] = name; }); if (productForm.elements[field].value === key) { const option = document.createElement("option"); option.value = option.textContent = name; productForm.elements[field].append(option); productForm.elements[field].value = name; } }
        else if (window.confirm(`¿Eliminar «${key}»? Los productos quedarán con ${manager === "units" ? "c/u" : "Sin categoría"}.`)) { list.splice(list.indexOf(key), 1); store.state.products.forEach(item => { if (item[field] === key) item[field] = manager === "units" ? "c/u" : "Sin categoría"; }); }
        store.save();
      }
      renderManager(); refreshOptions(); renderProducts();
    } catch (error) { query("#manager-status").textContent = error.message; }
  };
  function renderComments() {
    const hidden = store.state.commentModeration.hiddenIds;
    query("#block-visitor").checked = store.state.commentModeration.visitorBlocked;
    query("#admin-comments").innerHTML = store.state.comments.map(item => `<article class="panel"><strong>${safe(item.name)}</strong><p>${safe(item.text)}</p><button type="button" data-comment="${safe(item.id)}">${hidden.includes(item.id) ? "Mostrar" : "Ocultar"}</button></article>`).join("");
  }
  query("#admin-comments").onclick = event => { const button = event.target.closest("[data-comment]"); if (!button) return; const hidden = store.state.commentModeration.hiddenIds; const index = hidden.indexOf(button.dataset.comment); if (index < 0) hidden.push(button.dataset.comment); else hidden.splice(index, 1); store.save(); renderComments(); };
  query("#block-visitor").onchange = event => { store.state.commentModeration.visitorBlocked = event.target.checked; store.save(); };
  query("#reset-demo").onclick = async () => { if (!window.confirm("¿Restablecer toda esta demo? Se borrarán sus cambios, medios, perfil y contenido local. No afecta proyectos reales.")) return; try { await store.reset(); await window.DemoMedia.clear(); location.reload(); } catch (error) { status(error.message); } };
  query("#reload-demo").onclick = () => { if (window.confirm("Se descartarán cambios no guardados de esta pantalla. ¿Actualizar con los datos de la otra pestaña?")) { productBaseline = productSignature(); settingsBaseline = signature(settingsForm); location.reload(); } };
  window.addEventListener("demo-store-external-change", () => { externalChange = true; query("#reload-demo").hidden = false; status("La demo cambió en otra pestaña. Actualiza la vista antes de guardar para no mezclar catálogos."); });
  window.addEventListener("beforeunload", event => { if (productDirty() || settingsDirty()) { event.preventDefault(); event.returnValue = ""; } });
  document.addEventListener("click", async event => { const link = event.target.closest("a[href]"); if (!link || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || (!productDirty() && !settingsDirty())) return; event.preventDefault(); if (await leave()) location.href = link.href; });
  renderSettings(); renderProducts(); renderComments(); setView("overview");
})();
