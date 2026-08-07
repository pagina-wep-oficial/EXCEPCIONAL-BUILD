// Excepcional Build · página pública
// El flujo privado de clientes vive en portal.js.
const BUSINESS_WHATSAPP = "529811332914";
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

  const payload = {
    nombre: String(data.get("nombre") || "").trim(),
    negocio: String(data.get("negocio") || "").trim(),
    ubicacion: String(data.get("ubicacion") || "").trim(),
    telefono: phone,
    necesidad: String(data.get("necesidad") || "").trim(),
    mensaje: String(data.get("mensaje") || "").trim(),
    consentimiento: true,
    website: String(data.get("website") || ""),
    turnstileToken: String(data.get("cf-turnstile-response") || "")
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
