(function () {
  "use strict";
  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const host = document.querySelector("#product-gallery");
  let items = [];
  let busy = false;
  let sequence = 0;
  const changed = () => { window.dispatchEvent(new CustomEvent("demo-gallery-change")); };
  async function draw() {
    const revision = ++sequence;
    host.innerHTML = items.length ? items.map((item, index) => `<article class="gallery-item"><div data-media-preview="${index}"></div><strong>${item.type === "video" ? "Video" : "Imagen"} ${index + 1}</strong><label><input type="radio" name="gallery-primary" data-primary="${index}" ${item.is_primary ? "checked" : ""}> Principal</label><div class="row"><button type="button" data-media-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>←</button><button type="button" data-media-move="${index}" data-direction="1" ${index === items.length - 1 ? "disabled" : ""}>→</button><button type="button" data-media-delete="${index}">Eliminar</button></div>${item.type !== "video" ? `<label>Ajuste<select data-media-fit="${index}"><option value="cover" ${item.fit_mode !== "contain" ? "selected" : ""}>Llenar espacio</option><option value="contain" ${item.fit_mode === "contain" ? "selected" : ""}>Imagen completa</option></select></label><label>Encuadre horizontal<input type="range" data-media-x="${index}" min="0" max="100" value="${item.focal_x ?? 50}"></label><label>Encuadre vertical<input type="range" data-media-y="${index}" min="0" max="100" value="${item.focal_y ?? 50}"></label>` : ""}</article>`).join("") : '<p class="muted">Sin medios. Puedes agregar hasta 5 imágenes y 1 video.</p>';
    await Promise.all(items.map(async (item, index) => {
      const target = host.querySelector(`[data-media-preview="${index}"]`);
      try {
        const url = await window.DemoMedia.resolve(item.source_url);
        if (revision !== sequence || !target) return;
        target.innerHTML = item.type === "video" ? `<video src="${safe(url)}" controls playsinline preload="metadata"></video>` : `<img src="${safe(url)}" alt="Vista previa" style="object-fit:${item.fit_mode === "contain" ? "contain" : "cover"};object-position:${Number(item.focal_x ?? 50)}% ${Number(item.focal_y ?? 50)}%">`;
      } catch { if (target) target.textContent = "Archivo no disponible en este navegador."; }
    }));
  }
  function set(next) { items = window.DemoStore.validateMedia(next || []); draw(); }
  function append(next) { items = window.DemoStore.validateMedia([...items, ...next]); draw(); changed(); }
  const status = message => { document.querySelector("#product-status").textContent = message; };
  document.querySelector("#product-files").addEventListener("change", async event => {
    if (busy) return;
    busy = true;
    const staged = [];
    try {
      const files = Array.from(event.target.files || []);
      window.DemoStore.validateMedia([...items, ...files.map(file => ({ type: file.type.startsWith("video/") ? "video" : "image", source_url: "demo-media:pending" }))]);
      for (const file of files) staged.push(await window.DemoMedia.save(file));
      append(staged); status("Archivos agregados. Guarda el producto para conservar esta selección.");
    } catch (error) { status(error.message); }
    finally { busy = false; event.target.value = ""; }
  });
  document.querySelector("#add-media-url").onclick = () => {
    const input = document.querySelector("#media-url");
    const url = window.DemoStore.safeUrl(input.value);
    if (!url) { status("Escribe una URL HTTP o HTTPS válida."); return; }
    try { append([{ source_url: url, type: document.querySelector("#media-type").value, is_primary: false }]); input.value = ""; status(""); } catch (error) { status(error.message); }
  };
  host.addEventListener("click", event => {
    const button = event.target.closest("[data-media-delete],[data-media-move]");
    if (!button) return;
    if (button.hasAttribute("data-media-delete")) items.splice(Number(button.dataset.mediaDelete), 1);
    else { const index = Number(button.dataset.mediaMove); const next = index + Number(button.dataset.direction); if (next >= 0 && next < items.length) [items[index], items[next]] = [items[next], items[index]]; }
    set(items); changed();
  });
  host.addEventListener("change", event => {
    const input = event.target;
    if (input.hasAttribute("data-primary")) items.forEach((item, index) => { item.is_primary = index === Number(input.dataset.primary); });
    for (const [attribute, field] of [["mediaFit", "fit_mode"], ["mediaX", "focal_x"], ["mediaY", "focal_y"]]) if (input.dataset[attribute] != null) items[Number(input.dataset[attribute])][field] = field === "fit_mode" ? input.value : Number(input.value);
    draw(); changed();
  });
  window.DemoProductGallery = { set, get: () => JSON.parse(JSON.stringify(items)), isBusy: () => busy };
})();
