(() => {
  "use strict";

  // Contrato de vista previa de la tienda.
  // El administrador carga el sitio con ?store_preview=1 y le envía el producto
  // en edición por postMessage. El sitio renderiza con SU propio código.
  if (!new URLSearchParams(location.search).has("store_preview")) return;

  const SECTIONS = new Set(["featured", "store", "detail"]);

  const post = (payload) => window.parent.postMessage(payload, "*");

  const isolationCss = [
    "body[data-store-preview] > *:not(#store-preview-mount){display:none!important}",
    "body[data-store-preview]{min-height:100vh!important;margin:0!important;padding:0!important;background:transparent!important}",
    "body[data-store-preview] #store-preview-mount{display:block!important;box-sizing:border-box!important;min-height:100vh!important;padding:16px!important}",
    "body[data-store-preview] #store-preview-mount *{animation:none!important;transition:none!important;opacity:1!important;visibility:visible!important}",
    "body[data-store-preview] [data-motion-ghost]{display:none!important}"
  ].join("\n");

  const mount = () => {
    const style = document.createElement("style");
    style.id = "store-preview-isolation";
    style.textContent = isolationCss;
    document.head.appendChild(style);

    const node = document.createElement("div");
    node.id = "store-preview-mount";
    document.body.appendChild(node);

    document.body.dataset.storePreview = "1";
    document.body.dataset.catalogState = "ready";
    document.body.dataset.catalogType = "commerce";

    post({ type: "store-preview-ready" });
  };

  const render = (data) => {
    const section = SECTIONS.has(data.section) ? data.section : "store";
    const product = data.product || {};
    const design = data.design || null;
    const renderers = window.__siteRender || {};

    if (typeof renderers[section] !== "function") {
      post({ type: "store-preview-error", code: "SECTION_RENDERER_MISSING", section });
      return;
    }

    try {
      if (design && typeof window.__siteApplyDesign === "function") {
        window.__siteApplyDesign(design);
      }

      const holder = document.getElementById("store-preview-mount");
      if (holder) holder.innerHTML = renderers[section](product, { preview: true, design });
      post({ type: "store-preview-rendered", section });
    } catch (error) {
      post({
        type: "store-preview-error",
        code: "RENDER_FAILED",
        message: String(error?.message || error)
      });
    }
  };

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "store-preview-render") render(data);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
