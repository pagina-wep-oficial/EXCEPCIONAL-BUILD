// Agrega aquí el número de WhatsApp de la empresa, con código de país y sin signos.
// Ejemplo para México: "529811234567".
const BUSINESS_WHATSAPP = "529811332914";
const PROSPECT_ENDPOINT = "https://scaebulgcuvqpucondws.supabase.co/functions/v1/registrar-prospecto";
const CONSULTAR_ENDPOINT = "https://scaebulgcuvqpucondws.supabase.co/functions/v1/consultar-dominio";

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

let selectedDomain = "";
let selectedDomainPrice = null;

function renderQuote() {
  if (!quoteAddress || !quoteHosting) return;

  const usesCustomDomain = quoteAddress.value === "dominio";
  const usesHostinger = quoteHosting.value === "hostinger";

  if (usesCustomDomain) {
    quoteUrlPreview.textContent = selectedDomain
      ? `Dominio elegido: ${selectedDomain}. Confirmaremos disponibilidad y precio antes de contratar.`
      : "Ejemplo: tunegocio.com. Confirmaremos disponibilidad y precio antes de contratar.";
    quoteAddressSummary.textContent = selectedDomain
      ? selectedDomainPrice != null
        ? `Dominio propio: ${selectedDomain} — ${formatPrice(selectedDomainPrice)}`
        : `Dominio propio: ${selectedDomain} (disponibilidad por confirmar)`
      : "Dominio propio: precio por confirmar";
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

// Verificador de dominios en tiempo real
const domainInput = document.querySelector("#domain-check-input");
const domainButton = document.querySelector("#domain-check-button");
const domainStatus = document.querySelector("#domain-check-status");
const domainSuggestions = document.querySelector("#domain-suggestions");
const domainUseButton = document.querySelector("#domain-use-button");
let lastCheckedDomain = "";
let lastDomainPrice = null;

function normalizeDomain(raw) {
  let value = String(raw || "").trim().toLowerCase();
  value = value.replace(/^[a-z]+:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split(/[/?#]/)[0];
  value = value.replace(/^\.+/, "").replace(/\.+$/, "");
  if (!value) return "";
  if (!value.includes(".")) value += ".com";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) return "";
  return value;
}

function setDomainStatus(text, tone) {
  if (!domainStatus) return;
  domainStatus.textContent = text;
  domainStatus.classList.remove("success", "error");
  if (tone) domainStatus.classList.add(tone);
}

async function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function domainStatusRDAP(name) {
  const response = await fetchWithTimeout(`https://rdap.org/domain/${name}`);
  if (response.ok) return "taken";
  if (response.status === 404) return "free";
  return "unknown";
}

async function domainStatusDNS(name) {
  const response = await fetchWithTimeout(`https://dns.google/resolve?name=${name}&type=NS`);
  const data = await response.json().catch(() => null);
  if (!data) return "unknown";
  if (data.Status === 3) return "free";
  if (
    data.Status === 0 &&
    Array.isArray(data.Answer) &&
    data.Answer.some((record) => record.type === 2)
  ) {
    return "taken";
  }
  return "unknown";
}

async function checkDomainAvailability(name) {
  try {
    const rdap = await domainStatusRDAP(name);
    if (rdap !== "unknown") return rdap;
  } catch (error) {
    // Si RDAP falla (red o CORS), seguimos con DNS.
  }
  try {
    return await domainStatusDNS(name);
  } catch (error) {
    return "unknown";
  }
}

async function checkDomainViaEdge(name) {
  const url = `${CONSULTAR_ENDPOINT}?dominio=${encodeURIComponent(name)}`;
  const response = await fetchWithTimeout(url, 20000);
  if (!response.ok) throw new Error("edge no disponible");
  const data = await response.json();
  if (!data || data.ok !== true) throw new Error("edge respuesta inválida");
  return data;
}

function formatPrice(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    return `≈ US$${value.toFixed(2)}/año`;
  }
  if (typeof value === "object" && typeof value.price === "number") {
    const moneda = value.currency || "MXN";
    const anual = (value.price / 100).toFixed(2);
    const promo =
      typeof value.first_period_price === "number"
        ? (value.first_period_price / 100).toFixed(2)
        : null;
    return promo != null
      ? `≈ $${promo} ${moneda} el primer año (luego $${anual}/año)`
      : `≈ $${anual} ${moneda}/año`;
  }
  return `≈ ${String(value)}`;
}

async function checkDomainWithPricing(name) {
  try {
    const data = await checkDomainViaEdge(name);
    let availability = "unknown";
    if (data.disponible === true) availability = "free";
    else if (data.disponible === false) availability = "taken";
    lastDomainPrice = data.precioDominio ?? null;
    return { availability, fuente: data.fuente || "hostinger" };
  } catch (error) {
    // Si la Edge Function no responde (red o CORS), usamos la comprobación local RDAP/DNS.
    const availability = await checkDomainAvailability(name);
    return { availability, fuente: "rdap-dns" };
  }
}

function buildSuggestions(name) {
  const base = name.includes(".") ? name.slice(0, name.indexOf(".")) : name;
  return [`${base}.mx`, `${base}.net`, `${base}.org`, `${base}-negocio.com`];
}

function renderSuggestions(names) {
  if (!domainSuggestions) return;
  domainSuggestions.hidden = false;
  domainSuggestions.textContent = "";
  domainSuggestions.append("Quizá te guste: ");
  names.forEach((candidate) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = candidate;
    chip.addEventListener("click", () => useDomain(candidate));
    domainSuggestions.appendChild(chip);
  });
}

function useDomain(name) {
  const clean = normalizeDomain(name);
  if (!clean || !quoteAddress) return;
  selectedDomain = clean;
  selectedDomainPrice = lastDomainPrice;
  quoteAddress.value = "dominio";
  if (domainInput) domainInput.value = clean;
  if (domainSuggestions) domainSuggestions.hidden = true;
  if (domainUseButton) domainUseButton.hidden = true;
  setDomainStatus(`Dominio ${clean} anotado en tu cotización.`, "success");
  renderQuote();
}

async function runDomainCheck() {
  const name = normalizeDomain(domainInput?.value);
  if (!name) {
    setDomainStatus("Escribe un nombre válido, por ejemplo: tunegocio o tunegocio.com", "error");
    return;
  }

  setDomainStatus(`Comprobando ${name}...`, "");
  if (domainSuggestions) domainSuggestions.hidden = true;
  if (domainUseButton) domainUseButton.hidden = true;
  if (domainButton) domainButton.disabled = true;

  try {
    const { availability } = await checkDomainWithPricing(name);
    lastCheckedDomain = name;
    if (availability === "free") {
      const priceText = lastDomainPrice != null ? ` ${formatPrice(lastDomainPrice)}` : "";
      setDomainStatus(
        `¡Buenas noticias! ${name} parece estar disponible${priceText}.`,
        "success"
      );
      if (domainUseButton) domainUseButton.hidden = false;
    } else if (availability === "taken") {
      setDomainStatus(`${name} ya está registrado. Aquí tienes algunas alternativas:`, "error");
      renderSuggestions(buildSuggestions(name));
    } else {
      setDomainStatus("No pudimos comprobarlo ahora mismo. Podemos confirmarlo contigo por WhatsApp.");
    }
  } catch (error) {
    setDomainStatus("Ocurrió un problema de conexión. Inténtalo de nuevo.", "error");
  } finally {
    if (domainButton) domainButton.disabled = false;
  }
}

domainButton?.addEventListener("click", runDomainCheck);
domainInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runDomainCheck();
  }
});

domainUseButton?.addEventListener("click", () => {
  if (lastCheckedDomain) useDomain(lastCheckedDomain);
});

quoteContinue?.addEventListener("click", () => {
  const leadForm = document.querySelector("#lead-form");
  const needSelect = leadForm?.querySelector('[name="necesidad"]');
  const messageField = leadForm?.querySelector('[name="mensaje"]');

  if (!leadForm || !quoteAddress || !quoteHosting) return;

  const addressText =
    quoteAddress.value === "dominio"
      ? selectedDomain
        ? selectedDomainPrice != null
          ? `Dominio propio: ${selectedDomain} (disponible: ${formatPrice(selectedDomainPrice)})`
          : `Dominio propio: ${selectedDomain} (disponibilidad por confirmar)`
        : "Dominio propio, disponibilidad y precio por confirmar"
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
