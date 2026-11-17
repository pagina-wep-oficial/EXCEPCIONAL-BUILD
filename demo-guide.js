(function () {
  "use strict";
  const page = document.body.dataset.demoGuidePage;
  if (!page) return;

  const tours = {
    entry: [
      { target: ".demo-option.featured", title: "Elige tu recorrido", text: "Prueba Tienda para ver productos, carrito y contacto por WhatsApp." },
      { target: ".demo-option:not(.featured)", title: "También puedes probar Catálogo", text: "Aquí los productos llevan a una oferta externa y no muestran carrito." }
    ],
    panel: [
      { target: ".demo-welcome", title: "Este es tu espacio de demostración", text: "Aquí puedes recorrer el proyecto sin crear una cuenta real." },
      { target: ".project-card-simple", title: "Tu proyecto de muestra", text: "Tócalo para abrir las herramientas y conocer cómo se organiza un proyecto." },
      { target: "#panel-site-url", title: "Página pública", text: "Desde aquí puedes abrir el sitio que verían tus visitantes." }
    ],
    project: [
      { target: "#project-site-link", title: "Abre tu página", text: "Revisa la presentación y el catálogo como lo haría una visita." },
      { target: "#project-tools-disclosure summary", title: "Herramientas del sitio", text: "Aquí encontrarás el Editor y Administrar tienda." },
      { target: "#project-back-bottom", title: "Siempre puedes volver", text: "Usa Mi demo para regresar a tu lista de proyectos." }
    ],
    editor: [
      { target: ".editor-page-tabs", title: "Elige una página", text: "Cambia entre las páginas disponibles para editar su contenido." },
      { target: "#editor-v2-current-state", title: "Toca lo que quieras cambiar", text: "La vista de abajo es tu página. Selecciona un texto, imagen o botón para editarlo." },
      { target: "#editor-v2-save", title: "Guarda tu borrador", text: "Tus cambios quedan guardados en este navegador para continuar después." },
      { target: "#editor-v2-preview", title: "Revisa antes de publicar", text: "Vista previa muestra la página sin los controles de edición." },
      { target: "#editor-v2-publish", title: "Publica la demostración", text: "En esta demo, publicar solo actualiza lo que ves en este navegador." }
    ],
    admin: [
      { target: "#admin-summary-open-products", title: "Organiza tu catálogo", text: "Desde aquí administras los productos de este recorrido." },
      { target: "#new-product", title: "Agrega un producto", text: "Crea productos con precio, moneda, imágenes, video o enlaces.", open: () => document.querySelector('.admin-side-nav [data-view="products"]')?.click() },
      { target: "#product-search", title: "Encuentra tus productos", text: "Busca, edita, oculta o elimina productos guardados en este catálogo." },
      { target: "#block-visitor", title: "Revisa opiniones", text: "Las opiniones son de demostración y puedes decidir si permites nuevas.", open: () => document.querySelector('.admin-side-nav [data-view="comments"]')?.click() },
      { target: "#catalog-type", title: "Configura cada recorrido", text: "Tienda y Catálogo conservan sus datos por separado al cambiar aquí.", open: () => document.querySelector('.admin-side-nav [data-view="settings"]')?.click() },
      { target: "#admin-project-back", title: "Vuelve a tu proyecto", text: "Usa este enlace para regresar a las herramientas del proyecto." }
    ]
  };

  const key = "eb-casa-nopal-demo-guide-v1";
  let state = {};
  let active = false;
  let index = 0;
  let steps = [];
  let highlighted = null;
  let layoutTimer = 0;
  let openingGuideSection = false;

  function readState() {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); }
    catch { return {}; }
  }

  function saveState() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch {}
  }

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      getComputedStyle(element).visibility !== "hidden";
  }

  function setupLayer() {
    const layer = document.createElement("div");
    layer.className = "demo-guide-layer";
    layer.hidden = true;
    layer.innerHTML = `
      <div class="demo-guide-shade" aria-hidden="true"></div>
      <div class="demo-guide-spotlight" aria-hidden="true" hidden></div>
      <section class="demo-guide-card" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="demo-guide-title">
        <p class="demo-guide-kicker">Guía de demostración</p>
        <h2 id="demo-guide-title"></h2>
        <p id="demo-guide-text"></p>
        <div class="demo-guide-footer">
          <span id="demo-guide-progress"></span>
          <div class="demo-guide-actions">
            <button type="button" class="demo-guide-back">Atrás</button>
            <button type="button" class="demo-guide-skip">Omitir</button>
            <button type="button" class="demo-guide-next">Siguiente</button>
          </div>
        </div>
      </section>`;
    document.body.append(layer);
    layer.querySelector(".demo-guide-back").addEventListener("click", previous);
    layer.querySelector(".demo-guide-next").addEventListener("click", next);
    layer.querySelector(".demo-guide-skip").addEventListener("click", finish);
    return layer;
  }

  function setupTrigger() {
    const button = document.createElement("button");
    button.className = "demo-guide-trigger";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir guía de esta página");
    button.title = "Ver guía";
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11.6v4.1c2.8 2.2 8.2 2.2 11 0v-4.1"/><path d="M21.5 9.5v5.2"/><circle cx="21.5" cy="16.5" r="1"/></svg>`;
    button.addEventListener("click", start);
    document.body.append(button);
  }

  const layer = setupLayer();
  setupTrigger();

  function clearHighlight() {
    clearTimeout(layoutTimer);
    if (highlighted) highlighted.classList.remove("demo-guide-target");
    highlighted = null;
    layer.querySelector(".demo-guide-spotlight").hidden = true;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function updateSpotlight(target) {
    const spot = layer.querySelector(".demo-guide-spotlight");
    const rect = target.getBoundingClientRect();
    const pad = 8;
    spot.style.left = `${Math.max(4, rect.left - pad)}px`;
    spot.style.top = `${Math.max(4, rect.top - pad)}px`;
    spot.style.width = `${Math.min(innerWidth - 8, rect.width + pad * 2)}px`;
    spot.style.height = `${Math.min(innerHeight - 8, rect.height + pad * 2)}px`;
    spot.hidden = false;
  }

  function positionCard(target) {
    const card = layer.querySelector(".demo-guide-card");
    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const pad = 16, gap = 24, width = cardRect.width, height = cardRect.height;
    const maxLeft = innerWidth - width - pad, maxTop = innerHeight - height - pad;
    const options = [
      { top: rect.top - height - gap, left: clamp(rect.left, pad, maxLeft), fits: rect.top - gap >= height + pad },
      { top: rect.bottom + gap, left: clamp(rect.left, pad, maxLeft), fits: innerHeight - rect.bottom - gap >= height + pad },
      { top: clamp(rect.top, pad, maxTop), left: rect.right + gap, fits: innerWidth - rect.right - gap >= width + pad },
      { top: clamp(rect.top, pad, maxTop), left: rect.left - width - gap, fits: rect.left - gap >= width + pad }
    ];
    const order = innerWidth <= 700 ? [0, 1, 2, 3] : [2, 3, 0, 1];
    const chosen = order.map(i => options[i]).find(item => item.fits) || {
      top: pad, left: clamp((innerWidth - width) / 2, pad, maxLeft)
    };
    card.style.top = `${clamp(chosen.top, pad, maxTop)}px`;
    card.style.left = `${clamp(chosen.left, pad, maxLeft)}px`;
  }

  function scheduleLayout(target) {
    const card = layer.querySelector(".demo-guide-card");
    card.style.visibility = "hidden";
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      if (!active || target !== highlighted) return;
      updateSpotlight(target);
      positionCard(target);
      card.style.visibility = "";
    }, 330);
  }

  function render() {
    clearHighlight();
    const step = steps[index];
    if (!step) return finish();
    if (step.open) {
      openingGuideSection = true;
      step.open();
      openingGuideSection = false;
    }

    const target = document.querySelector(step.target);
    if (!visible(target)) {
      index += 1;
      render();
      return;
    }

    highlighted = target;
    target.classList.add("demo-guide-target");
    layer.querySelector("#demo-guide-title").textContent = step.title;
    layer.querySelector("#demo-guide-text").textContent = step.text;
    layer.querySelector("#demo-guide-progress").textContent = `${index + 1} de ${steps.length}`;
    layer.querySelector(".demo-guide-next").textContent = index === steps.length - 1 ? "Terminar" : "Siguiente";
    layer.querySelector(".demo-guide-back").disabled = index === 0;

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    scheduleLayout(target);
  }

  function start() {
    steps = (tours[page] || []).filter(step => visible(document.querySelector(step.target)));
    if (!steps.length) return;
    active = true;
    index = 0;
    layer.hidden = false;
    document.body.classList.add("demo-guide-open");
    render();
  }

  function previous() {
    if (index > 0) {
      index -= 1;
      render();
    }
  }

  function next() {
    index += 1;
    index >= steps.length ? finish() : render();
  }

  function finish() {
    active = false;
    clearHighlight();
    layer.hidden = true;
    document.body.classList.remove("demo-guide-open");
    state[page] = true;
    saveState();
  }

  function blockPage(event) {
    if (!active || openingGuideSection || event.target.closest(".demo-guide-card")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  ["pointerdown", "click", "submit"].forEach(type => {
    document.addEventListener(type, blockPage, true);
  });

  document.addEventListener("keydown", event => {
    if (!active) return;
    if (event.key === "Escape") { event.preventDefault(); finish(); }
    if (event.key === "ArrowLeft") { event.preventDefault(); previous(); }
    if (event.key === "ArrowRight") { event.preventDefault(); next(); }
  });

  state = readState();
  addEventListener("resize", () => active && highlighted && scheduleLayout(highlighted));
  addEventListener("scroll", () => active && highlighted && scheduleLayout(highlighted), true);
  setTimeout(() => { if (!state[page]) start(); }, 700);
})();
