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
  const overlay = document.querySelector("[data-highlights-overlay]");
  const openButton = document.querySelector("[data-open-highlights]");
  if (!overlay || !openButton) return;

  const closeButtons = overlay.querySelectorAll("[data-close-highlights]");
  let previousFocus = null;

  function openHighlights(){
    previousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("highlights-is-open");
    overlay.querySelector(".highlights-close")?.focus();
  }

  function closeHighlights(){
    overlay.hidden = true;
    document.body.classList.remove("highlights-is-open");
    previousFocus?.focus?.();
  }

  openButton.addEventListener("click", openHighlights);
  closeButtons.forEach(button => button.addEventListener("click", closeHighlights));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !overlay.hidden) closeHighlights();
  });
})();
