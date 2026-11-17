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
      { target: "#editor-v2-frame", title: "Toca lo que quieras cambiar", text: "Selecciona un texto, imagen o botón dentro de esta vista." },
      { target: "#editor-v2-save", title: "Guarda tu borrador", text: "Tus cambios quedan guardados en este navegador para continuar después." },
      { target: "#editor-v2-preview", title: "Revisa antes de publicar", text: "Vista previa muestra la página sin los controles de edición." },
      { target: "#editor-v2-publish", title: "Publica la demostración", text: "En esta demo, publicar solo actualiza lo que ves en este navegador." }
    ]
  };

  const key = "eb-casa-nopal-demo-guide-v1";
  let state = {};
  let active = false;
  let index = 0;
  let steps = [];
  let highlighted;

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
    return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
  }

  function setupLayer() {
    const layer = document.createElement("div");
    layer.className = "demo-guide-layer";
    layer.hidden = true;
    layer.innerHTML = `
      <div class="demo-guide-shade"></div>
      <section class="demo-guide-card" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="demo-guide-title">
        <p class="demo-guide-kicker">Guía de demostración</p>
        <h2 id="demo-guide-title"></h2>
        <p id="demo-guide-text"></p>
        <div class="demo-guide-footer">
          <span id="demo-guide-progress"></span>
          <div class="demo-guide-actions">
            <button type="button" class="demo-guide-skip">Omitir</button>
            <button type="button" class="demo-guide-next">Siguiente</button>
          </div>
        </div>
      </section>`;

    document.body.append(layer);

    layer.querySelector(".demo-guide-next").addEventListener("click", next);
    layer.querySelector(".demo-guide-skip").addEventListener("click", finish);
    document.addEventListener("keydown", event => {
      if (active && event.key === "Escape") finish();
    });

    return layer;
  }

  function setupTrigger() {
    const button = document.createElement("button");
    button.className = "demo-guide-trigger";
    button.type = "button";
    button.setAttribute("aria-label", "Abrir guía de esta página");
    button.title = "Ver guía";
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11.6v4.1c2.8 2.2 8.2 2.2 11 0v-4.1"/><path d="M21.5 9.5v5.2"/><circle cx="21.5" cy="16.5" r="1"/></svg>`;
    button.addEventListener("click", () => start(true));
    document.body.append(button);
  }

  const layer = setupLayer();
  setupTrigger();

  function clearHighlight() {
    if (highlighted) highlighted.classList.remove("demo-guide-target");
    highlighted = null;
  }

  function positionCard(target) {
    const card = layer.querySelector(".demo-guide-card");
    const rect = target.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow > 230 ? Math.min(rect.bottom + 16, window.innerHeight - 205) : Math.max(16, rect.top - 205);
    card.style.top = `${top}px`;
    card.style.left = `${Math.min(Math.max(16, rect.left), window.innerWidth - card.offsetWidth - 16)}px`;
  }

  function render() {
    clearHighlight();
    const step = steps[index];
    if (!step) return finish();

    const target = document.querySelector(step.target);
    if (!visible(target)) {
      index += 1;
      render();
      return;
    }

    if (step.open) step.open();
    highlighted = target;
    target.classList.add("demo-guide-target");

    layer.querySelector("#demo-guide-title").textContent = step.title;
    layer.querySelector("#demo-guide-text").textContent = step.text;
    layer.querySelector("#demo-guide-progress").textContent = `${index + 1} de ${steps.length}`;
    layer.querySelector(".demo-guide-next").textContent = index === steps.length - 1 ? "Terminar" : "Siguiente";

    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    requestAnimationFrame(() => positionCard(target));
  }

  function start(manual) {
    steps = (tours[page] || []).filter(step => visible(document.querySelector(step.target)));
    if (!steps.length) return;
    active = true;
    index = 0;
    layer.hidden = false;
    document.body.classList.add("demo-guide-open");
    if (manual) state[page] = true;
    render();
  }

  function next() {
    index += 1;
    if (index >= steps.length) finish();
    else render();
  }

  function finish() {
    active = false;
    clearHighlight();
    layer.hidden = true;
    document.body.classList.remove("demo-guide-open");
    state[page] = true;
    saveState();
  }

  state = readState();
  window.addEventListener("resize", () => {
    if (active && highlighted) positionCard(highlighted);
  });

  window.setTimeout(() => {
    if (!state[page]) start(false);
  }, 700);
})();
