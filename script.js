// Excepcional Build · página pública
// El flujo privado de clientes vive en portal.js.
const BUSINESS_WHATSAPP = "525629767176";
const PROSPECT_ENDPOINT = "https://scaebulgcuvqpucondws.supabase.co/functions/v1/registrar-prospecto";

const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector("#site-nav");

menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  nav?.classList.toggle("open", !open);
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
} else {
  document.querySelectorAll(".reveal").forEach((item) => item.classList.add("visible"));
}

let turnstileState = "loading";

window.onTurnstileSuccess = function () {
  turnstileState = "ready";
};

window.onTurnstileExpired = function () {
  turnstileState = "expired";
  setStatus("La verificación expiró. Se renovará automáticamente; intenta enviar otra vez.", "error");
};

window.onTurnstileError = function () {
  turnstileState = "error";
  setStatus("No se pudo verificar el navegador. Intenta nuevamente sin recargar la página.", "error");
};

const leadPanels = [...document.querySelectorAll("[data-lead-panel]")];
const leadNext = document.querySelector("#lead-next-step");
const leadBack = document.querySelector("#lead-back");
const leadProgressLabel = document.querySelector("#lead-progress-label");
const leadProgressBar = document.querySelector("#lead-progress-bar");
let leadStep = 1;

function updateLeadStep() {
  leadPanels.forEach((panel) => {
    panel.hidden = Number(panel.dataset.leadPanel) !== leadStep;
  });
  if (leadProgressLabel) leadProgressLabel.textContent = `Paso ${leadStep} de ${leadPanels.length}`;
  if (leadProgressBar) leadProgressBar.style.width = `${(leadStep / leadPanels.length) * 100}%`;
  if (leadBack) leadBack.hidden = leadStep === 1;
  if (leadNext) leadNext.hidden = leadStep === leadPanels.length;
  const finalFields = document.querySelector("[data-lead-final]");
  if (finalFields) finalFields.hidden = leadStep !== leadPanels.length;
}

function validateLeadStep() {
  const panel = document.querySelector(`[data-lead-panel="${leadStep}"]`);
  if (!panel) return true;
  const fields = [...panel.querySelectorAll("input, select, textarea")];
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

leadNext?.addEventListener("click", () => {
  if (!validateLeadStep()) return;
  leadStep = Math.min(leadPanels.length, leadStep + 1);
  updateLeadStep();
});

leadBack?.addEventListener("click", () => {
  leadStep = Math.max(1, leadStep - 1);
  updateLeadStep();
});

const form = document.querySelector("#lead-form");
const status = document.querySelector("#form-status");

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function setStatus(message, tone = "") {
  if (!status) return;
  status.textContent = message;
  status.className = `form-status${tone ? ` ${tone}` : ""}`;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const required = [
    ["nombre", "tu nombre"],
    ["negocio", "el nombre del negocio"],
    ["ubicacion", "tu municipio o ciudad"],
    ["telefono", "tu WhatsApp"],
    ["necesidad", "qué necesitas"]
  ];

  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  const missing = [];
  for (const [name, label] of required) {
    const field = form.elements[name];
    if (!field || !String(field.value || "").trim()) {
      missing.push(label);
      field?.classList.add("invalid");
    }
  }

  const phone = digits(data.get("telefono"));
  if (phone && phone.length !== 10) {
    missing.push("un WhatsApp de 10 dígitos");
    form.elements.telefono?.classList.add("invalid");
  }

  const consent = form.elements.consentimiento;
  if (consent && !consent.checked) {
    setStatus("Marca la casilla para autorizar que te contactemos.", "error");
    consent.focus();
    return;
  }

  if (missing.length) {
    setStatus(`Revisa: ${missing.join(", ")}.`, "error");
    form.querySelector(".invalid")?.focus();
    return;
  }

  const turnstileToken = String(
    form.querySelector('[name="cf-turnstile-response"]')?.value ||
    data.get("cf-turnstile-response") ||
    ""
  ).trim();

  if (!turnstileToken) {
    turnstileState = "expired";
    setStatus(
      "Espera un momento a que termine la verificación y vuelve a pulsar el botón. No perderás tus datos.",
      "error"
    );
    window.turnstile?.reset();
    return;
  }

  const payload = {
    nombre: String(data.get("nombre") || "").trim(),
    negocio: String(data.get("negocio") || "").trim(),
    ubicacion: String(data.get("ubicacion") || "").trim(),
    telefono: phone,
    necesidad: String(data.get("necesidad") || "").trim(),
    mensaje: String(data.get("mensaje") || "").trim(),
    consentimiento: true,
    website: String(data.get("website") || ""),
    turnstileToken
  };

  const whatsappText = [
    "Hola, quiero solicitar información para una página web.",
    "",
    `Nombre: ${payload.nombre}`,
    `Negocio: ${payload.negocio}`,
    `Ubicación: ${payload.ubicacion}`,
    `WhatsApp: ${payload.telefono}`,
    `Necesito: ${payload.necesidad}`,
    `Detalles: ${payload.mensaje || "Sin detalles adicionales"}`
  ].join("\n");

  submitButton.disabled = true;
  setStatus("Guardando tu solicitud…");

  try {
    const response = await fetch(PROSPECT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.mensaje || "No pudimos registrar tu solicitud.");

    const whatsappUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`;
    const whatsappLink = document.querySelector("#lead-whatsapp-link");
    const next = document.querySelector("#lead-next");
    if (whatsappLink) whatsappLink.href = whatsappUrl;
    if (next) next.hidden = false;

    setStatus("Listo. Recibimos tu solicitud y te contactaremos para revisar lo que necesitas.", "success");
    window.turnstile?.reset();
  } catch (error) {
    const message = String(error?.message || "");
    if (/anti-spam|verificaci|turnstile/i.test(message)) {
      status.innerHTML = `No pudimos completar la verificación. Intenta nuevamente o <a href="https://wa.me/${BUSINESS_WHATSAPP}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.`;
      status.className = "form-status error";
    } else {
      setStatus(message || "Ocurrió un problema. Intenta nuevamente.", "error");
    }
    window.turnstile?.reset();
  } finally {
    submitButton.disabled = false;
  }
});

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();


(function initHighlightsOverlay(){
  const overlay = document.querySelector('[data-highlights-overlay]');
  const openButton = document.querySelector('[data-open-highlights]');
  if (!overlay || !openButton) return;

  const frame = overlay.querySelector('[data-story-frame]');
  const progressBar = overlay.querySelector('[data-story-progress]');
  const counter = overlay.querySelector('[data-story-counter]');
  const status = overlay.querySelector('[data-story-status]');
  const toggleButton = overlay.querySelector('[data-story-toggle]');
  const closeButtons = [...overlay.querySelectorAll('[data-close-highlights]:not(.highlights-backdrop)')];
  const previousButton = overlay.querySelector('[data-story-prev]');
  const nextButton = overlay.querySelector('[data-story-next]');
  const focusableSelector = 'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])';

  let previousFocus = null;
  let frameReady = false;
  let isPaused = true;
  let currentScene = 0;
  let totalScenes = 7;
  let progress = 0;

  function sendToPresentation(type, extra = {}) {
    if (!frameReady || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type, ...extra }, window.location.origin);
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function updateCounter() {
    if (counter) counter.textContent = `Destacados · ${Math.min(currentScene + 1, totalScenes)} de ${totalScenes}`;
  }

  function renderProgressSegments(total) {
    if (!progressBar) return;
    totalScenes = Math.max(1, Math.min(30, Number(total) || 1));
    progressBar.replaceChildren();

    for (let index = 0; index < totalScenes; index += 1) {
      const segment = document.createElement('span');
      segment.className = 'highlights-progress-segment';
      const fill = document.createElement('i');
      segment.append(fill);
      progressBar.append(segment);
    }

    updateCounter();
    updateProgress(progress);
  }

  function updateProgress(value) {
    progress = Math.max(0, Math.min(1, Number(value) || 0));
    if (!progressBar) return;

    const segments = [...progressBar.querySelectorAll('.highlights-progress-segment i')];
    segments.forEach((fill, index) => {
      const amount = index < currentScene ? 1 : index === currentScene ? progress : 0;
      fill.style.transform = `scaleX(${amount})`;
    });

    const overall = ((currentScene + progress) / totalScenes) * 100;
    progressBar.setAttribute('aria-valuenow', String(Math.round(overall)));
  }

  function setScene(index, total = totalScenes) {
    const parsedTotal = Number(total);
    if (Number.isFinite(parsedTotal) && parsedTotal > 0 && parsedTotal !== totalScenes) {
      renderProgressSegments(parsedTotal);
    }
    currentScene = Math.max(0, Math.min(totalScenes - 1, Number(index) || 0));
    updateCounter();
    updateProgress(0);
  }

  function setPaused(paused, announce = true, notifyPresentation = true) {
    isPaused = Boolean(paused);
    if (notifyPresentation) sendToPresentation(isPaused ? 'presentation-pause' : 'presentation-play');

    if (toggleButton) {
      toggleButton.setAttribute('aria-label', isPaused ? 'Reanudar presentación' : 'Pausar presentación');
      toggleButton.title = isPaused ? 'Reanudar presentación' : 'Pausar presentación';
      toggleButton.innerHTML = isPaused
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
    }
    if (announce) setStatus(isPaused ? 'Presentación en pausa.' : 'Presentación reproduciéndose.');
  }

  function startPresentation() {
    if (!frameReady) return;
    sendToPresentation('presentation-restart');
    setPaused(false, false, true);
    setStatus('Destacados reproduciéndose.');
  }

  function navigate(direction) {
    if (!frameReady) return;
    sendToPresentation(direction === 'next' ? 'presentation-next' : 'presentation-previous');
    setStatus(direction === 'next' ? 'Siguiente escena.' : 'Escena anterior.');
  }

  function openHighlights() {
    previousFocus = document.activeElement;
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('highlights-is-open');
    currentScene = 0;
    progress = 0;
    renderProgressSegments(7);
    setPaused(false, false, false);
    overlay.querySelector('.highlights-icon-button[aria-label^="Cerrar"]')?.focus();
    setStatus('Destacados abiertos.');
    if (frameReady) startPresentation();
  }

  function closeHighlights() {
    if (overlay.hidden) return;
    setPaused(true, false, true);
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('highlights-is-open');
    previousFocus?.focus?.();
    setStatus('Destacados cerrados.');
  }

  openButton.addEventListener('click', openHighlights);
  closeButtons.forEach(button => button.addEventListener('click', closeHighlights));
  toggleButton?.addEventListener('click', () => setPaused(!isPaused));
  previousButton?.addEventListener('click', () => navigate('previous'));
  nextButton?.addEventListener('click', () => navigate('next'));
  overlay.querySelector('.highlights-backdrop')?.addEventListener('click', closeHighlights);

  frame?.addEventListener('load', () => {
    frameReady = true;
    if (overlay.hidden) sendToPresentation('presentation-pause');
    else startPresentation();
  });

  try {
    if (frame?.contentDocument?.readyState === 'complete') frameReady = true;
  } catch (error) {
    frameReady = false;
  }

  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeHighlights();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigate('previous');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigate('next');
      return;
    }
    if (event.key === ' ' && !/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) {
      event.preventDefault();
      setPaused(!isPaused);
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...overlay.querySelectorAll(focusableSelector)]
        .filter(item => item.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !overlay.hidden) setPaused(true);
  });

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'presentation-close-request') {
      closeHighlights();
    } else if (data.type === 'presentation-scene') {
      setScene(data.index, data.total);
    } else if (data.type === 'presentation-progress') {
      if (Number.isFinite(Number(data.total)) && Number(data.total) > 0 && Number(data.total) !== totalScenes) {
        renderProgressSegments(data.total);
      }
      if (Number.isFinite(Number(data.index))) {
        currentScene = Math.max(0, Math.min(totalScenes - 1, Number(data.index)));
      }
      updateCounter();
      updateProgress(data.progress);
    } else if (data.type === 'presentation-ended') {
      currentScene = totalScenes - 1;
      updateCounter();
      updateProgress(1);
      setPaused(true, false, false);
      setStatus('Presentación finalizada.');
    } else if (data.type === 'presentation-state') {
      if (typeof data.paused === 'boolean') setPaused(data.paused, false, false);
    }
  });
})();
