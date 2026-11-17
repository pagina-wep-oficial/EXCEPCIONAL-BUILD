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
    "admin-overview": [
      { target: "#admin-project-back", title: "Vuelve a tu proyecto", text: "Este enlace siempre te lleva de regreso a las herramientas del proyecto." },
      { target: "#admin-summary-products", title: "Resumen de tu catálogo", text: "Aquí ves productos, visibles, destacados y medios del recorrido actual." },
      { target: "#admin-summary-open-products", title: "Empieza con tus productos", text: "Usa este botón para administrar el contenido de Tienda o Catálogo." }
    ],
    "admin-products": [
      { target: "#new-product", title: "Agrega un producto", text: "Crea un producto con nombre, precio, moneda, medios y visibilidad." },
      { target: "#product-search", title: "Encuentra rápido", text: "Busca productos por nombre o descripción." },
      { target: "#admin-products", title: "Edita cada producto", text: "Aquí puedes editar, ocultar o eliminar los productos del recorrido actual." }
    ],
    "admin-product-form": [
      { target: "#product-title", title: "Datos del producto", text: "Completa los campos para crear o actualizar este producto." },
      { target: "#product-price-fields", title: "Precio y moneda", text: "Define precio actual, precio anterior opcional y la moneda de este producto." },
      { target: "#product-files", title: "Imágenes y video", text: "Puedes subir archivos desde el teléfono o agregar una URL. Después eliges el medio principal." },
      { target: "#product-form [name=\"enabled\"]", title: "Visibilidad", text: "Desactiva esta opción si quieres guardar el producto sin mostrarlo al público." },
      { target: "#product-form .button.primary", title: "Guarda tu producto", text: "Al guardar, el cambio queda solo en este navegador de demostración." }
    ],
    "admin-comments": [
      { target: "#block-visitor", title: "Controla nuevas opiniones", text: "Activa esta opción si quieres impedir nuevas opiniones de la cuenta demo." },
      { target: "#admin-comments", title: "Modera comentarios", text: "Cada comentario puede ocultarse o mostrarse sin afectar un proyecto real." }
    ],
    "admin-settings": [
      { target: "#catalog-type", title: "Elige lo que administras", text: "Tienda y Catálogo conservan productos y configuración por separado." },
      { target: "#store-settings-form", title: "Configura el recorrido", text: "Aquí defines contacto para Tienda o botón, aviso y visibilidad para Catálogo." },
      { target: "#store-settings-form .button.primary", title: "Guarda la configuración", text: "Los cambios se reflejan en el sitio de demo de este navegador." },
      { target: "#reset-demo", title: "Restablece solo la demo", text: "Esta acción borra exclusivamente los datos locales de Casa Nopal." }
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
  let activeTour = page;

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
    button.addEventListener("click", () => start(currentTour()));
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

  function currentAdminView() {
    const section = [...document.querySelectorAll("[data-admin-view]")]
      .find(item => !item.hidden);
    return `admin-${section?.dataset.adminView || "overview"}`;
  }

  function currentTour() {
    return page === "admin" ? currentAdminView() : page;
  }

  function start(tourName = currentTour()) {
    if (active) return;
    activeTour = typeof tourName === "string" ? tourName : currentTour();
    steps = (tours[activeTour] || []).filter(step => visible(document.querySelector(step.target)));
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
    state[activeTour] = true;
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

  function startUnreadAdminTour(name, delay = 260) {
    if (state[name]) return;
    setTimeout(() => {
      if (!active && !state[name]) start(name);
    }, delay);
  }

  function bindAdminContext() {
    document.addEventListener("click", event => {
      if (active) return;

      const view = event.target.closest("[data-view]")?.dataset.view;
      if (view) {
        startUnreadAdminTour(`admin-${view}`);
        return;
      }

      if (event.target.closest("#admin-summary-open-products,[data-view-target=\"products\"]")) {
        startUnreadAdminTour("admin-products");
        return;
      }

      if (event.target.closest("#new-product,[data-edit]")) {
        startUnreadAdminTour("admin-product-form", 340);
      }
    });
  }

  state = readState();
  if (page === "admin") bindAdminContext();

  addEventListener("resize", () => active && highlighted && scheduleLayout(highlighted));
  addEventListener("scroll", () => active && highlighted && scheduleLayout(highlighted), true);

  setTimeout(() => {
    const initialTour = currentTour();
    if (!state[initialTour]) start(initialTour);
  }, 700);
})();
