(() => {
  const terms = document.querySelectorAll(".term-help");
  if (!terms.length) return;

  const popover = document.createElement("aside");
  popover.className = "term-popover";
  popover.style.maxHeight = "calc(100vh - 24px)";
  popover.style.overflow = "auto";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Explicación de dominio y hosting");
  popover.innerHTML = `
    <div class="term-popover-head">
      <strong>Dominio y hosting, explicado fácil</strong>
      <button class="term-popover-close" type="button" aria-label="Cerrar explicación">×</button>
    </div>
    <div class="term-popover-body">
      <div class="term-example">
        <span class="term-icon" aria-hidden="true">📍</span>
        <div><strong>Dominio = la dirección</strong><p>Es el nombre que las personas escriben para encontrar tu página. Por ejemplo: <b>minegocio.com</b>.</p></div>
      </div>
      <div class="term-example">
        <span class="term-icon" aria-hidden="true">🏠</span>
        <div><strong>Hosting = la casa</strong><p>Es el lugar donde se guardan los textos, fotos y archivos de tu página para que pueda verse todo el día.</p></div>
      </div>
      <p class="term-summary"><strong>Juntos funcionan así:</strong> la dirección guía a las personas hasta la casa donde vive tu página.</p>
    </div>`;
  document.body.appendChild(popover);

  const closeButton = popover.querySelector(".term-popover-close");
  let activeTerm = null;
  let locked = false;
  let hideTimer;

  const position = (target) => {
    if (window.matchMedia("(max-width: 600px)").matches) return;
    const box = target.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(box.left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - box.bottom;
    const popoverHeight = popover.offsetHeight || 360;
    popover.style.left = `${left}px`;
    popover.style.top = spaceBelow >= popoverHeight + 12
      ? `${box.bottom + 10}px`
      : `${Math.max(12, box.top - popoverHeight - 10)}px`;
  };

  const show = (target, shouldLock = false) => {
    clearTimeout(hideTimer);
    activeTerm = target;
    locked = shouldLock;
    position(target);
    popover.classList.add("open");
    terms.forEach((term) => term.setAttribute("aria-expanded", String(term === target)));
  };

  const hide = () => {
    if (locked) return;
    popover.classList.remove("open");
    terms.forEach((term) => term.setAttribute("aria-expanded", "false"));
    activeTerm = null;
  };

  terms.forEach((term) => {
    term.setAttribute("aria-haspopup", "dialog");
    term.setAttribute("aria-expanded", "false");
    term.addEventListener("mouseenter", () => show(term));
    term.addEventListener("mouseleave", () => { hideTimer = setTimeout(hide, 180); });
    term.addEventListener("focus", () => show(term));
    term.addEventListener("blur", () => { hideTimer = setTimeout(hide, 180); });
    term.addEventListener("click", () => {
      if (activeTerm === term && locked) { locked = false; hide(); return; }
      show(term, true);
    });
  });

  popover.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  popover.addEventListener("mouseleave", () => { if (!locked) hide(); });
  closeButton.addEventListener("click", () => { const previousTerm = activeTerm; locked = false; hide(); previousTerm?.focus(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { locked = false; hide(); } });
  document.addEventListener("click", (event) => {
    if (locked && !popover.contains(event.target) && !event.target.closest(".term-help")) { locked = false; hide(); }
  });
  window.addEventListener("resize", () => { if (activeTerm) position(activeTerm); });
  window.addEventListener("scroll", () => { if (activeTerm && !window.matchMedia("(max-width: 600px)").matches) position(activeTerm); }, { passive: true });
})();
