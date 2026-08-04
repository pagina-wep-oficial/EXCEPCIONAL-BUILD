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
    "Hola, quiero solicitar un diagnóstico para mi negocio.",
    "",
    `Nombre: ${payload.nombre}`,
    `Negocio: ${payload.negocio}`,
    `Ubicación: ${payload.ubicacion}`,
    `Mi WhatsApp: ${payload.telefono}`,
    `Necesito: ${payload.necesidad}`,
    `Detalles: ${payload.mensaje || "Sin detalles adicionales"}`
  ].join("\n");

  submitButton.disabled = true;
  status.textContent = "Registrando tu solicitud...";
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

    status.textContent = "Solicitud registrada. Abriendo WhatsApp...";
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
