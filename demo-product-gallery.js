(function () {
  "use strict";
  const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const host = document.querySelector("#product-gallery");
  let items = [];
  let busy = false;
  let sequence = 0;
  const changed = () => {
    window.dispatchEvent(new CustomEvent("demo-gallery-change"));
    const summary = document.querySelector("#media-summary-text");
    if (summary) {
      const images = items.filter(item => item.type !== "video").length;
      const videos = items.filter(item => item.type === "video").length;
      summary.textContent = images || videos
        ? `${images} imagen${images === 1 ? "" : "es"}${videos ? ` · ${videos} video` : ""}. Pulsa Gestionar para editar los medios.`
        : "Agrega imágenes para mostrar mejor tu producto.";
    }
  };
  async function draw() {
    const revision = ++sequence;
    const fitLabel = item => item.fit_mode === "cover"
      ? "Llenar espacio"
      : item.fit_mode === "contain"
        ? "Mostrar completa"
        : "Configuración general";

    host.innerHTML = items.length ? items.map((item, index) => `
      <article class="gallery-item${item.is_primary ? " is-primary" : ""}">
        <div class="gallery-item-head">
          <div>
            <strong>${item.type === "video" ? "Video" : "Imagen"} ${index + 1}</strong>
            <small>${item.is_primary ? "Medio principal" : "Medio adicional"}</small>
          </div>
          ${item.is_primary ? '<span class="gallery-primary-badge">Principal</span>' : ""}
        </div>

        <div class="gallery-preview" data-media-preview="${index}">
          <span class="gallery-preview-loading">Cargando vista previa…</span>
        </div>

        <div class="gallery-item-actions">
          <label class="gallery-primary-choice">
            <input type="radio" name="gallery-primary" data-primary="${index}" ${item.is_primary ? "checked" : ""}>
            Usar como principal
          </label>
          <button type="button" data-media-delete="${index}" class="gallery-delete">Eliminar</button>
        </div>

        <div class="gallery-order-actions">
          <button type="button" data-media-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>← Mover atrás</button>
          <button type="button" data-media-move="${index}" data-direction="1" ${index === items.length - 1 ? "disabled" : ""}>Mover adelante →</button>
        </div>

        ${item.type !== "video" ? `
          <details class="gallery-adjustments">
            <summary>Ajustar imagen <span>${fitLabel(item)}</span></summary>
            <label>Ajuste
              <select data-media-fit="${index}">
                <option value="inherit" ${!["cover", "contain"].includes(item.fit_mode) ? "selected" : ""}>Usar configuración general</option>
                <option value="cover" ${item.fit_mode === "cover" ? "selected" : ""}>Llenar espacio</option>
                <option value="contain" ${item.fit_mode === "contain" ? "selected" : ""}>Mostrar completa</option>
              </select>
            </label>
            <label>Encuadre horizontal
              <input type="range" data-media-x="${index}" min="0" max="100" value="${item.focal_x ?? 50}">
            </label>
            <label>Encuadre vertical
              <input type="range" data-media-y="${index}" min="0" max="100" value="${item.focal_y ?? 50}">
            </label>
            <label>Acercar
              <input type="range" data-media-zoom="${index}" min="1" max="3" step="0.01" value="${item.zoom ?? 1}">
            </label>
            <label>Girar
              <input type="range" data-media-rotation="${index}" min="-180" max="180" step="1" value="${item.rotation ?? 0}">
            </label>
          </details>
        ` : '<p class="gallery-video-note">El video conserva sus controles al publicarse.</p>'}
      </article>
    `).join("") : '<p class="muted gallery-empty">Todavía no hay imágenes ni video.</p>';

    await Promise.all(items.map(async (item, index) => {
      const target = host.querySelector(`[data-media-preview="${index}"]`);
      try {
        const url = await window.DemoMedia.resolve(item.source_url);
        if (revision !== sequence || !target) return;
        target.innerHTML = item.type === "video"
          ? `<video src="${safe(url)}" controls playsinline preload="metadata"></video>`
          : `<img src="${safe(url)}" alt="Vista previa" style="object-fit:${item.fit_mode === "contain" ? "contain" : item.fit_mode === "cover" ? "cover" : (window.DemoStore?.state.imageSettings?.fitMode || "contain")};object-position:${Number(item.focal_x ?? 50)}% ${Number(item.focal_y ?? 50)}%;transform:scale(${Number(item.zoom ?? 1)}) rotate(${Number(item.rotation ?? 0)}deg)">`;
      } catch {
        if (target) target.innerHTML = '<span class="gallery-preview-error">No se pudo cargar este medio.</span>';
      }
    }));
  }
  function set(next) { items = window.DemoStore.validateMedia(next || []); draw(); }
  function append(next) { items = window.DemoStore.validateMedia([...items, ...next]); draw(); changed(); }
  const status = message => { document.querySelector("#product-status").textContent = message; };
  const uploadInput = document.querySelector("#product-files");

  document.querySelectorAll("[data-upload-intent]").forEach(control => {
    control.addEventListener("click", () => {
      uploadInput.dataset.intent = control.dataset.uploadIntent || "extra";
    });
  });

  uploadInput.addEventListener("change", async event => {
    if (busy) return;
    busy = true;
    const staged = [];
    const intent = uploadInput.dataset.intent || "extra";

    try {
      const files = Array.from(event.target.files || []);
      const accepted = intent === "video"
        ? files.filter(file => file.type.startsWith("video/"))
        : files.filter(file => file.type.startsWith("image/"));

      if (!accepted.length) throw new Error(intent === "video" ? "Elige un video válido." : "Elige una imagen válida.");
      if (intent === "primary" && accepted.length > 1) throw new Error("Elige una sola imagen principal.");

      for (const file of accepted) {
        staged.push(await window.DemoMedia.save(file));
      }

      if (intent === "video") {
        items = items.filter(item => item.type !== "video");
        items = window.DemoStore.validateMedia([...items, ...staged]);
      } else if (intent === "primary") {
        const next = staged[0];
        items = items.filter(item => !(item.type !== "video" && item.is_primary));
        items = window.DemoStore.validateMedia([
          { ...next, is_primary: true },
          ...items
        ]);
      } else {
        append(staged);
      }

      draw();
      changed();
      status(intent === "video" ? "Video agregado. Guarda el producto para conservarlo." : "Imagen agregada. Guarda el producto para conservarla.");
    } catch (error) {
      status(error.message);
    } finally {
      busy = false;
      event.target.value = "";
      delete event.target.dataset.intent;
    }
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
    for (const [attribute, field] of [["mediaFit", "fit_mode"], ["mediaX", "focal_x"], ["mediaY", "focal_y"], ["mediaZoom", "zoom"], ["mediaRotation", "rotation"]]) if (input.dataset[attribute] != null) items[Number(input.dataset[attribute])][field] = field === "fit_mode" ? input.value : Number(input.value);
    draw(); changed();
  });
  const studio = document.querySelector("#media-studio");
  const openStudio = document.querySelector("#open-media-studio");

  const closeStudio = () => {
    if (!studio) return;
    studio.hidden = true;
    studio.classList.remove("is-open");
  };

  openStudio?.addEventListener("click", () => {
    studio.hidden = false;
    studio.classList.add("is-open");
    draw();
    changed();
  });

  studio?.addEventListener("click", event => {
    if (event.target.closest("[data-close-media]")) closeStudio();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && studio?.classList.contains("is-open")) closeStudio();
  });

  window.addEventListener("demo-gallery-change", () => {
    const summary = document.querySelector("#media-summary-text");
    if (!summary) return;
    const images = items.filter(item => item.type !== "video").length;
    const videos = items.filter(item => item.type === "video").length;
    summary.textContent = images || videos
      ? `${images} imagen${images === 1 ? "" : "es"}${videos ? ` · ${videos} video` : ""}. Pulsa Gestionar para editar los medios.`
      : "Agrega imágenes para mostrar mejor tu producto.";
  });

  window.DemoProductGallery = { set, get: () => JSON.parse(JSON.stringify(items)), isBusy: () => busy };
})();
