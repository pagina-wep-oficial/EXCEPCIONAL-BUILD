// Agrega aquí el número de WhatsApp de la empresa, con código de país y sin signos.
// Ejemplo para México: "529811234567".
const BUSINESS_WHATSAPP = "529811332914";
const PROSPECT_ENDPOINT = "https://scaebulgcuvqpucondws.supabase.co/functions/v1/registrar-prospecto";

const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector("#site-nav");

menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  nav.classList.toggle("open", !open);
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));

const quoteAddress = document.querySelector("#quote-address");
const quoteHosting = document.querySelector("#quote-hosting");
const quoteUrlPreview = document.querySelector("#quote-url-preview");
const quoteAddressSummary = document.querySelector("#quote-address-summary");
const quoteHostingSummary = document.querySelector("#quote-hosting-summary");
const quoteInitialTotal = document.querySelector("#quote-initial-total");
const quoteRenewalTotal = document.querySelector("#quote-renewal-total");
const quoteContinue = document.querySelector("#quote-continue");

function renderQuote() {
  if (!quoteAddress || !quoteHosting) return;

  const usesCustomDomain = quoteAddress.value === "dominio";
  const usesHostinger = quoteHosting.value === "hostinger";

  if (usesCustomDomain) {
    quoteUrlPreview.textContent =
      "Ejemplo: tunegocio.com. Confirmaremos disponibilidad y precio antes de contratar.";
    quoteAddressSummary.textContent =
      "Dominio propio: precio por confirmar";
  } else {
    quoteUrlPreview.textContent =
      "Ejemplo: nombre-del-negocio.pages.dev";
    quoteAddressSummary.textContent =
      "Enlace gratuito: $0 al año";
  }

  if (usesHostinger) {
    quoteHostingSummary.textContent =
      "Hosting especializado de Hostinger: precio por confirmar";
  } else {
    quoteHostingSummary.textContent =
      "Cloudflare Pages: $0 al año";
  }

  if (!usesCustomDomain && !usesHostinger) {
    quoteInitialTotal.textContent = "$750";
    quoteRenewalTotal.textContent = "$0";
    return;
  }

  if (usesCustomDomain && !usesHostinger) {
    quoteInitialTotal.textContent = "$750 + dominio";
    quoteRenewalTotal.textContent = "Dominio";
    return;
  }

  quoteInitialTotal.textContent = "$750 + dominio + hosting";
  quoteRenewalTotal.textContent = "Dominio + hosting";
}

quoteAddress?.addEventListener("change", () => {
  if (quoteAddress.value === "gratis" && quoteHosting?.value === "hostinger") {
    quoteHosting.value = "cloudflare";
  }

  renderQuote();
});

quoteHosting?.addEventListener("change", () => {
  if (quoteHosting.value === "hostinger" && quoteAddress?.value === "gratis") {
    quoteAddress.value = "dominio";
  }

  renderQuote();
});

renderQuote();

quoteContinue?.addEventListener("click", () => {
  const leadForm = document.querySelector("#lead-form");
  const needSelect = leadForm?.querySelector('[name="necesidad"]');
  const messageField = leadForm?.querySelector('[name="mensaje"]');

  if (!leadForm || !quoteAddress || !quoteHosting) return;

  const addressText =
    quoteAddress.value === "dominio"
      ? "Dominio propio, disponibilidad y precio por confirmar"
      : "Enlace gratuito de Cloudflare Pages, $0 al año";

  const hostingText =
    quoteHosting.value === "hostinger"
      ? "Hosting especializado de Hostinger, precio por confirmar"
      : "Cloudflare Pages incluido, $0 al año";

  const quoteDetails = [
    "Quiero cotizar el Sitio Esencial.",
    "Precio base: $750.",
    `Dirección: ${addressText}.`,
    `Alojamiento: ${hostingText}.`,
    `Pago inicial estimado: ${quoteInitialTotal?.textContent || "$750"}.`,
    `Renovación estimada: ${quoteRenewalTotal?.textContent || "$0"}.`
  ].join("\n");

  if (needSelect) {
    needSelect.value = "Quiero que mi negocio aparezca en internet";
  }

  if (messageField) {
    messageField.value = quoteDetails;
  }

  leadForm.scrollIntoView({ behavior: "smooth", block: "start" });

  window.setTimeout(() => {
    leadForm.querySelector('[name="nombre"]')?.focus();
  }, 450);
});

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.addEventListener("click", () => {
    const select = document.querySelector('[name="necesidad"]');
    const message = document.querySelector('[name="mensaje"]');
    if (select) select.value = "Quiero que mi negocio aparezca en internet";
    if (message) message.value = `Me interesa el ${button.dataset.plan}.`;
  });
});

const form = document.querySelector("#lead-form");
const status = document.querySelector("#form-status");
const isQuoteRequest = Boolean(document.querySelector("#quote-form"));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const turnstileToken = data.get("cf-turnstile-response");

  const payload = {
    nombre: data.get("nombre"),
    negocio: data.get("negocio"),
    ubicacion: data.get("ubicacion"),
    telefono: data.get("telefono"),
    necesidad: data.get("necesidad"),
    mensaje: data.get("mensaje"),
    consentimiento: data.get("consentimiento") === "on",
    website: data.get("website"),
    turnstileToken
  };

  const text = [
    isQuoteRequest
      ? "Hola, preparé una cotización para el sitio web de mi negocio."
      : "Hola, quiero solicitar un diagnóstico para mi negocio.",
    "",
    `Nombre: ${payload.nombre}`,
    `Negocio: ${payload.negocio}`,
    `Ubicación: ${payload.ubicacion}`,
    `Mi WhatsApp: ${payload.telefono}`,
    `Necesito: ${payload.necesidad}`,
    `Detalles: ${payload.mensaje || "Sin detalles adicionales"}`
  ].join("\n");

  submitButton.disabled = true;
  status.textContent = isQuoteRequest
    ? "Registrando tu cotización..."
    : "Registrando tu solicitud...";
  status.className = "form-status";

  try {
    const response = await fetch(PROSPECT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(
        result.mensaje || "No pudimos registrar tu solicitud."
      );
    }

    status.textContent = isQuoteRequest
      ? "Cotización registrada. Abriendo WhatsApp..."
      : "Solicitud registrada. Abriendo WhatsApp...";
    status.className = "form-status success";

    const whatsappUrl =
      `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(text)}`;

    form.reset();
    window.turnstile?.reset();

    window.location.assign(whatsappUrl);
  } catch (error) {
    status.textContent =
      error.message || "Ocurrió un problema. Inténtalo nuevamente.";
    status.className = "form-status error";
    window.turnstile?.reset();
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
