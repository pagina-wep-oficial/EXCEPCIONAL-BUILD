(function () {
  "use strict";

  const store = window.DemoStore;
  const TYPES = new Set(["commerce", "external_catalog"]);

  function currentCatalog() {
    const value = new URLSearchParams(location.search).get("catalog");
    if (TYPES.has(value)) return value;
    return store && TYPES.has(store.catalogType)
      ? store.catalogType
      : "commerce";
  }

  function applyCatalogFromUrl() {
    const type = new URLSearchParams(location.search).get("catalog");
    if (store && TYPES.has(type) && store.catalogType !== type) {
      store.selectCatalog(type);
    }
    return currentCatalog();
  }

  function route(path, type) {
    const url = new URL(path, location.href);
    url.searchParams.delete("mode");
    url.searchParams.set("catalog", type || currentCatalog());
    return url.href;
  }

  function syncLinks() {
    const type = currentCatalog();
    document.querySelectorAll("a[href]").forEach((link) => {
      const raw = link.getAttribute("href");
      if (!raw || raw.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(raw)) return;
      const url = new URL(raw, location.href);
      if (!/(demo[^/]*\.html|index\.html|tienda\.html|detalle\.html|carrito\.html|mis-pedidos\.html|perfil-de-usuario\.html)$/.test(url.pathname)) return;
      url.searchParams.delete("mode");
      url.searchParams.set("catalog", type);
      link.href = url.href;
    });
  }

  window.DemoNavigation = { currentCatalog, applyCatalogFromUrl, route, syncLinks };
  applyCatalogFromUrl();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncLinks, { once: true });
  } else {
    syncLinks();
  }
}());
