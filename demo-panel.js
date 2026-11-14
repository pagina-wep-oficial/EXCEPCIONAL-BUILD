(function () {
  "use strict";
  const mode = "store";
  const projectUrl = `demo-project.html?mode=${mode}`;
  const actions = document.querySelector("#panel-actions");
  const projectCard = document.querySelector(".project-card-simple");
  document.querySelector("#panel-mode-label").textContent = window.DemoStore.catalogType === "external_catalog" ? "Presentación + Catálogo" : "Presentación + Tienda";
  document.querySelector("#panel-site-url").href = "demo-casa-nopal/index.html?mode=store";
  document.querySelector("#panel-year")?.setAttribute("data-year", new Date().getFullYear());
  const link = (href, label, className) => `<a class="button ${className === "accent" ? "button-accent" : "button-light"} button-small" href="${href}">${label} <span>→</span></a>`;
  actions.innerHTML = link(projectUrl, "Abrir proyecto", "accent");
  projectCard?.setAttribute("role", "link");
  projectCard?.setAttribute("tabindex", "0");
  projectCard?.setAttribute("aria-label", "Abrir proyecto Casa Nopal Demo");
  projectCard?.classList.add("is-clickable");
  projectCard?.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    window.location.href = projectUrl;
  });
  projectCard?.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === projectCard) {
      event.preventDefault();
      window.location.href = projectUrl;
    }
  });
})();
