(function () {
  "use strict";
  document.querySelectorAll("[data-enter-demo]").forEach(link => link.addEventListener("click", event => {
    try { window.DemoStore.selectCatalog(link.dataset.enterDemo); }
    catch (error) { event.preventDefault(); document.querySelector("#demo-entry-status").textContent = error.message; }
  }));
})();
