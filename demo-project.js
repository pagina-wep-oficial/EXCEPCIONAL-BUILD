(function () {
  "use strict";
  const mode = "store";
  const panelUrl = `demo-panel.html?mode=${mode}`;
  const siteUrl = `demo-casa-nopal/index.html?mode=${mode}`;
  const editorUrl = `demo-editor.html?mode=${mode}`;
  const siteToolIcon = (kind) => {
    if (kind === "editor") return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 16.5V20h3.5L18.4 9.1l-3.5-3.5L4 16.5Z"></path><path d="m13.9 6.6 3.5 3.5"></path><path d="M4 4h6"></path></svg>`;
    if (kind === "store") return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 10h16l-1 10H5L4 10Z"></path><path d="m6 10 1-6h10l1 6"></path><path d="M9 14h6"></path></svg>`;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 7h14"></path><path d="M5 12h14"></path><path d="M5 17h14"></path></svg>`;
  };
  document.querySelector("#project-mode-label").textContent = window.DemoStore.catalogType === "external_catalog" ? "Presentación + Catálogo" : "Presentación + Tienda";
  document.querySelectorAll("#project-back-link,#project-back-top,#project-back-bottom,#project-mobile-back").forEach((link) => { link.href = panelUrl; });
  document.querySelector("#project-site-link").href = siteUrl;
  const tools = document.querySelector("#project-tools-list");
  document.querySelector("#project-tools-summary-icon").innerHTML = siteToolIcon("tools");
  const tool = (href, title, copy, kind) => `<section class="site-tool"><span class="site-tool-icon site-tool-${kind}" aria-hidden="true">${siteToolIcon(kind)}</span><div class="site-tool-copy"><span>Herramienta</span><strong>${title}</strong><p>${copy}</p></div><div class="site-tool-action"><a class="button button-primary tool-open-button" href="${href}">Abrir →</a></div></section>`;
  const toolItems = [tool(editorUrl, "Editar sitio", "Cambia textos, imágenes y secciones de la página.", "editor")];
  if (mode === "store") {
    toolItems.push(tool("demo-store-admin.html?mode=store", "Administrar tienda", "Gestiona productos, medios, categorías, monedas y configuración de demostración.", "store"));
    document.querySelector("#project-catalog-card").hidden = false;
  }
  tools.innerHTML = toolItems.join("");
  document.querySelector("#project-tools-count").textContent = `${toolItems.length} ${toolItems.length === 1 ? "herramienta disponible" : "herramientas disponibles"}`;
})();
