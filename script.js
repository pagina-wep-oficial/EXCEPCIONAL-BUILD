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
const quoteType = document.querySelector("#quote-type");
const quoteDomainOption = document.querySelector("#quote-domain-option");
const quoteDomainOptionWrap = document.querySelector("#quote-domain-option-wrap");
const hostingPriceNote = document.querySelector("#hosting-price-note");
const hostingDomainNote = document.querySelector("#hosting-domain-note");
const quoteUrlPreview = document.querySelector("#quote-url-preview");
const quoteAddressSummary = document.querySelector("#quote-address-summary");
const quoteHostingSummary = document.querySelector("#quote-hosting-summary");
const quoteInitialTotal = document.querySelector("#quote-initial-total");
const quoteYear1Total = document.querySelector("#quote-year1-total");
const quoteYear2Total = document.querySelector("#quote-year2-total");
const quoteYearsTotalWrap = document.querySelector("#quote-years-total-wrap");
const quoteYearsLabel = document.querySelector("#quote-years-label");
const quoteYearsTotal = document.querySelector("#quote-years-total");
const quotePeriod = document.querySelector("#quote-period");
const quotePeriodWrap = document.querySelector("#quote-period-wrap");
const quoteContinue = document.querySelector("#quote-continue");

let selectedDomain = "";
let selectedDomainPrice = null;
let selectedSiteName = "";
let lastHostingPrice = null;
let quoteRef = "";
let quoteRefNegocio = "";
let montoInicial = null;
let montoRenovacion = null;
let montoPeriodo = null;

function formatNum(value) {
  if (value == null || isNaN(value)) return "Por confirmar";
  return `$${Math.round(value * 100) / 100}`;
}

function renderQuote() {
  if (!quoteAddress || !quoteHosting) return;

  const usesCustomDomain = quoteAddress.value === "dominio";
  const usesHostinger = quoteHosting.value === "hostinger";
  const esEspecial = quoteType?.value === "especial";
  const periodo = Number(quotePeriod?.value || 1);

  if (quoteDomainOptionWrap) {
    quoteDomainOptionWrap.hidden = !usesCustomDomain;
  }

  const domainCheckLabel = document.querySelector("#domain-check-label");
  const domainCheckHint = document.querySelector("#domain-check-hint");
  if (domainCheckLabel && domainCheckHint) {
    if (usesCustomDomain) {
      domainCheckLabel.textContent = quoteDomainOption?.value === "ya_tengo"
        ? "Escribe el dominio que ya tienes y úsalo directamente."
        : "Elige el nombre que quieres para tu dominio. Verificaremos disponibilidad y precio, y te daremos alternativas.";
      domainCheckHint.textContent = quoteDomainOption?.value === "ya_tengo"
        ? "Esta es tu dirección actual, por ejemplo: tunegocio.com"
        : "Solo minúsculas, sin espacios ni símbolos. Puedes terminarlo con .mx, .com u otro. Ej. abarroteslupita.mx";
    } else {
      domainCheckLabel.textContent = "Elige el nombre que quieres para tu sitio web.";
      domainCheckHint.textContent = "Solo minúsculas, sin espacios ni símbolos. Ej. abarroteslupita";
    }
  }

  const domainButtonText = document.querySelector("#domain-check-button");
  if (domainButtonText) {
    domainButtonText.textContent = usesCustomDomain && quoteDomainOption?.value === "ya_tengo"
      ? "Usar mi dominio"
      : "Verificar";
  }

  if (usesCustomDomain) {
    const yaTengo = quoteDomainOption?.value === "ya_tengo";
    quoteUrlPreview.textContent = selectedDomain
      ? yaTengo
        ? `Dominio propio (ya tengo): ${selectedDomain}.`
        : `Dominio elegido: ${selectedDomain}. Confirmaremos disponibilidad y precio antes de contratar.`
      : yaTengo
        ? "Escribe abajo el dominio que ya tienes."
        : "Ejemplo: tunegocio.com. Confirmaremos disponibilidad y precio antes de contratar.";
    quoteAddressSummary.textContent = selectedDomain
      ? selectedDomainPrice != null
        ? `Dominio propio: ${selectedDomain} — ${formatPrice(selectedDomainPrice)}`
        : `Dominio propio: ${selectedDomain} (disponibilidad por confirmar)`
      : "Dominio propio: precio por confirmar";
  } else {
    quoteUrlPreview.textContent = selectedSiteName
      ? `Tu enlace gratuito será: ${selectedSiteName}.pages.dev`
      : quoteRefNegocio && !selectedDomain
        ? `Cotización preparada para ${quoteRefNegocio}. Confirma o ajusta los datos y el paquete.`
        : "Ejemplo: nombre-del-negocio.pages.dev";
    quoteAddressSummary.textContent = selectedSiteName
      ? `Enlace gratuito: ${selectedSiteName}.pages.dev — $0 al año`
      : "Enlace gratuito: $0 al año";
  }

  if (usesHostinger) {
    const precio = lastHostingPrice
      ? `desde $${(lastHostingPrice.price / 100).toFixed(2)} MXN/mes (${lastHostingPrice.nombre || "VPS"})`
      : "precio por confirmar";
    quoteHostingSummary.textContent =
      `Hosting especializado de Hostinger: ${precio}`;
    if (hostingPriceNote) {
      hostingPriceNote.textContent = lastHostingPrice
        ? `Precio mínimo encontrado: $${(lastHostingPrice.price / 100).toFixed(2)} MXN/mes (${lastHostingPrice.nombre || "VPS"}).`
        : "Consultando precios reales de Hostinger...";
      hostingPriceNote.hidden = false;
    }
    if (hostingDomainNote) {
      const aYaTengo = quoteDomainOption?.value === "ya_tengo";
      hostingDomainNote.textContent = aYaTengo
        ? "Para poder elegir este hosting necesitas un dominio propio. Escribe el dominio que ya tienes abajo y pulsa “Usar mi dominio”: no hace falta verificarlo."
        : "Para poder elegir este hosting necesitas un dominio propio. Elige el nombre que quieras abajo, verifica disponibilidad y precio, y te daremos alternativas si ya está ocupado.";
      hostingDomainNote.hidden = false;
    }
  } else {
    quoteHostingSummary.textContent =
      "Cloudflare Pages: $0 al año";
    if (hostingPriceNote) hostingPriceNote.hidden = true;
    if (hostingDomainNote) hostingDomainNote.hidden = true;
  }

  if (quotePeriodWrap) {
    quotePeriodWrap.hidden = !usesHostinger && !usesCustomDomain;
  }

  if (esEspecial) {
    quoteInitialTotal.textContent = "Personalizado";
    if (quoteYear1Total) quoteYear1Total.textContent = "Según proyecto";
    if (quoteYear2Total) quoteYear2Total.textContent = "Según proyecto";
    if (quoteYearsTotalWrap) quoteYearsTotalWrap.hidden = true;
    return;
  }

  const domPrimerAno = usesCustomDomain && selectedDomainPrice?.first_period_price != null
    ? selectedDomainPrice.first_period_price / 100
    : 0;
  const domRenovacion = usesCustomDomain && selectedDomainPrice?.price != null
    ? selectedDomainPrice.price / 100
    : domPrimerAno;
  const hostMensual = usesHostinger && lastHostingPrice ? lastHostingPrice.price / 100 : 0;
  const hostAnual = hostMensual * 12;

  const totalAno1 = 750 + domPrimerAno + hostAnual;
  const totalAno2 = domRenovacion + hostAnual;
  const totalPeriodo = totalAno1 + totalAno2 * (periodo - 1);

  const conPrecios = usesCustomDomain && selectedDomainPrice == null
    ? false
    : true;

  if (conPrecios) {
    quoteInitialTotal.textContent = formatNum(totalAno1);
    if (quoteYear1Total) quoteYear1Total.textContent = formatNum(totalAno1);
    if (totalAno2 > 0) {
      if (quoteYear2Total) quoteYear2Total.textContent = formatNum(totalAno2);
      if (quoteYearsTotalWrap && periodo > 1) {
        quoteYearsLabel.textContent = String(periodo);
        quoteYearsTotal.textContent = formatNum(totalPeriodo);
        quoteYearsTotalWrap.hidden = false;
      } else if (quoteYearsTotalWrap) {
        quoteYearsTotalWrap.hidden = true;
      }
    } else {
      if (quoteYear2Total) quoteYear2Total.textContent = "Sin renovaciones";
      if (quoteYearsTotalWrap) quoteYearsTotalWrap.hidden = true;
    }
  } else {
    quoteInitialTotal.textContent = "$750 + dominio";
    if (quoteYear1Total) quoteYear1Total.textContent = "Por confirmar";
    if (quoteYear2Total) quoteYear2Total.textContent = "Por confirmar";
    if (quoteYearsTotalWrap) quoteYearsTotalWrap.hidden = true;
  }
}

function precargarDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  quoteRef = params.get("ref") || "";
  quoteRefNegocio = params.get("negocio") || "";
  if (!quoteRef) return;
  const llenar = (name, value) => {
    const campo = document.querySelector(`[name="${name}"]`);
    if (campo && value) campo.value = value;
  };
  llenar("nombre", params.get("nombre"));
  llenar("negocio", params.get("negocio"));
  llenar("ubicacion", params.get("ubicacion"));
  llenar("telefono", params.get("telefono"));
  renderQuote();
}

quoteAddress?.addEventListener("change", () => {
  if (quoteAddress.value === "gratis" && quoteHosting?.value === "hostinger") {
    quoteHosting.value = "cloudflare";
  }
  renderQuote();
  updateLivePreview();
});

quoteHosting?.addEventListener("change", async () => {
  if (quoteHosting.value === "hostinger" && quoteAddress?.value === "gratis") {
    quoteAddress.value = "dominio";
    const aYaTengo = quoteDomainOption?.value === "ya_tengo";
    setDomainStatus(
      aYaTengo
        ? "Para poder elegir este hosting necesitas un dominio propio. Escribe abajo el dominio que ya tienes y pulsa “Usar mi dominio”."
        : "Para poder elegir este hosting necesitas un dominio propio. Escribe abajo el nombre que quieres y verifícalo.",
      ""
    );
  }

  if (quoteHosting.value === "hostinger" && !lastHostingPrice) {
    try {
      const data = await checkDomainViaEdge("");
      const precio = data.precios?.hosting?.[0];
      if (precio) lastHostingPrice = precio;
    } catch (_) {
      // Sin conexión o catálogo no disponible: se muestra "precio por confirmar".
    }
  }

  renderQuote();
  updateLivePreview();
});

quoteType?.addEventListener("change", () => {
  renderQuote();
  updateLivePreview();
});

quotePeriod?.addEventListener("change", renderQuote);

quoteDomainOption?.addEventListener("change", () => {
  const yaTengo = quoteDomainOption.value === "ya_tengo";
  if (domainButton) domainButton.textContent = yaTengo ? "Usar mi dominio" : "Verificar";
  if (quoteHosting?.value === "hostinger") {
    setDomainStatus(
      yaTengo
        ? "Para poder elegir este hosting necesitas un dominio propio. Escribe abajo el dominio que ya tienes y pulsa “Usar mi dominio”."
        : "Para poder elegir este hosting necesitas un dominio propio. Escribe abajo el nombre que quieres y verifícalo.",
      ""
    );
  }
  renderQuote();
  updateLivePreview();
});

renderQuote();
precargarDesdeUrl();

// Verificador de nombre / dominio en tiempo real
const domainInput = document.querySelector("#domain-check-input");
const domainButton = document.querySelector("#domain-check-button");
const domainStatus = document.querySelector("#domain-check-status");
const domainCheckLive = document.querySelector("#domain-check-live");
const domainSuggestions = document.querySelector("#domain-suggestions");
const domainUseButton = document.querySelector("#domain-use-button");
let lastCheckedDomain = "";
let lastDomainPrice = null;

function normalizeSiteName(raw) {
  let value = String(raw || "").trim().toLowerCase();
  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  value = value.replace(/^[a-z]+:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split(/[/?#]/)[0];
  value = value.replace(/\s+/g, "-");
  value = value.replace(/[^a-z0-9.-]/g, "");
  value = value.replace(/^\.+/, "").replace(/\.+$/, "");
  return value.slice(0, 63);
}

function normalizeDomain(raw) {
  let value = String(raw || "").trim().toLowerCase();
  value = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
  const url = name
    ? `${CONSULTAR_ENDPOINT}?dominio=${encodeURIComponent(name)}`
    : `${CONSULTAR_ENDPOINT}?hosting=1`;
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

function buildNameSuggestions(name) {
  const base = name.replace(/\.pages\.dev$/, "").replace(/\..*$/, "");
  return [`${base}-negocio`, `${base}-tienda`, `${base}mx`, `${base}1`];
}

function renderSuggestions(names, onClick) {
  if (!domainSuggestions) return;
  domainSuggestions.hidden = false;
  domainSuggestions.textContent = "";
  domainSuggestions.append("Quizá te guste: ");
  names.forEach((candidate) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "suggestion-chip";
    chip.textContent = candidate;
    chip.addEventListener("click", () => onClick(candidate));
    domainSuggestions.appendChild(chip);
  });
}

function useDomain(name) {
  const clean = normalizeDomain(name);
  if (!clean || !quoteAddress) return;
  selectedDomain = clean;
  selectedDomainPrice = lastDomainPrice;
  selectedSiteName = "";
  quoteAddress.value = "dominio";
  if (domainInput) domainInput.value = clean;
  if (domainSuggestions) domainSuggestions.hidden = true;
  if (domainUseButton) domainUseButton.hidden = true;
  setDomainStatus(`Dominio ${clean} anotado en tu cotización.`, "success");
  renderQuote();
}

function useSiteName(name) {
  const clean = normalizeSiteName(name);
  if (!clean || !quoteAddress) return;
  selectedSiteName = clean;
  selectedDomain = "";
  selectedDomainPrice = null;
  quoteAddress.value = "gratis";
  if (domainInput) domainInput.value = clean;
  if (domainSuggestions) domainSuggestions.hidden = true;
  if (domainUseButton) domainUseButton.hidden = true;
  setDomainStatus(`Nombre anotado: quedará como ${clean}.pages.dev`, "success");
  renderQuote();
}

async function checkPagesDevName(name) {
  try {
    const data = await checkDomainViaEdge(name);
    if (data.disponible === true) return "free";
    if (data.disponible === false) return "taken";
    return "unknown";
  } catch (error) {
    const response = await fetchWithTimeout(`https://dns.google/resolve?name=${name}.pages.dev&type=NS`);
    const dns = await response.json().catch(() => null);
    if (!dns) return "unknown";
    if (dns.Status === 3) return "free";
    return "taken";
  }
}

function isFreeLinkMode() {
  return quoteAddress?.value !== "dominio";
}

function runChecker() {
  const usarDominio = isFreeLinkMode() ? false : true;
  const name = usarDominio
    ? normalizeDomain(domainInput?.value)
    : normalizeSiteName(domainInput?.value);
  if (!name) {
    setDomainStatus(
      usarDominio
        ? "Escribe un nombre válido, por ejemplo: tunegocio o tunegocio.com"
        : "Escribe un nombre válido: solo minúsculas, sin espacios ni símbolos. Ej. abarroteslupita",
      "error"
    );
    return;
  }

  setDomainStatus(usarDominio ? `Comprobando ${name}...` : `Comprobando ${name}.pages.dev...`, "");
  if (domainSuggestions) domainSuggestions.hidden = true;
  if (domainUseButton) domainUseButton.hidden = true;
  if (domainButton) domainButton.disabled = true;

  const finalizar = () => {
    if (domainButton) domainButton.disabled = false;
  };

  if (usarDominio) {
    checkDomainWithPricing(name)
      .then(({ availability }) => {
        lastCheckedDomain = name;
        if (availability === "free") {
          const priceText = lastDomainPrice != null ? ` ${formatPrice(lastDomainPrice)}` : "";
          setDomainStatus(
            `¡Buenas noticias! ${name} parece estar disponible${priceText}.`,
            "success"
          );
          if (domainUseButton) domainUseButton.hidden = false;
        } else if (availability === "taken") {
          setDomainStatus(`${name} ya está registrado. Prueba con otro nombre o usa una alternativa:`, "error");
          renderSuggestions(buildSuggestions(name), (candidate) => {
            domainInput.value = candidate;
            runChecker();
          });
        } else {
          setDomainStatus("No pudimos comprobarlo ahora mismo. Podemos confirmarlo contigo por WhatsApp.");
        }
      })
      .catch(() => setDomainStatus("Ocurrió un problema de conexión. Inténtalo de nuevo.", "error"))
      .finally(finalizar);
    return;
  }

  checkPagesDevName(name)
    .then((availability) => {
      lastCheckedDomain = name;
      if (availability === "free") {
        setDomainStatus(`¡Disponible! Tu enlace quedará así: ${name}.pages.dev`, "success");
        if (domainUseButton) domainUseButton.hidden = false;
      } else if (availability === "taken") {
        setDomainStatus(`${name}.pages.dev ya está en uso. Prueba con otro nombre o usa una alternativa:`, "error");
        renderSuggestions(buildNameSuggestions(name), (candidate) => {
          domainInput.value = candidate;
          runChecker();
        });
      } else {
        setDomainStatus("No pudimos comprobarlo ahora mismo. Confirmaremos el nombre contigo por WhatsApp.");
      }
    })
    .catch(() => setDomainStatus("Ocurrió un problema de conexión. Inténtalo de nuevo.", "error"))
    .finally(finalizar);
}

function handleDomainAction() {
  if (quoteDomainOption?.value === "ya_tengo") {
    const name = normalizeDomain(domainInput?.value);
    if (!name) {
      setDomainStatus("Escribe el dominio que ya tienes, por ejemplo: tunegocio.com", "error");
      return;
    }
    lastCheckedDomain = name;
    useDomain(name);
    return;
  }
  runChecker();
}

function updateLivePreview() {
  if (!domainCheckLive) return;
  const raw = domainInput?.value || "";
  if (!raw.trim()) {
    domainCheckLive.textContent = "";
    return;
  }
  if (isFreeLinkMode()) {
    const name = normalizeSiteName(raw);
    domainCheckLive.textContent = name
      ? `Quedará así: ${name}.pages.dev`
      : "Quita espacios, símbolos y mayúsculas: solo minúsculas, letras y números.";
  } else {
    const name = normalizeDomain(raw);
    domainCheckLive.textContent = name
      ? `Se revisará: ${name}`
      : "Puedes terminarlo con .mx, .com u otro. Ej. abarroteslupita.mx";
  }
}

domainButton?.addEventListener("click", handleDomainAction);
domainInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleDomainAction();
  }
});
domainInput?.addEventListener("input", updateLivePreview);

domainUseButton?.addEventListener("click", () => {
  if (lastCheckedDomain) {
    if (isFreeLinkMode()) {
      useSiteName(lastCheckedDomain);
    } else {
      useDomain(lastCheckedDomain);
    }
  }
});

quoteContinue?.addEventListener("click", () => {
  const leadForm = document.querySelector("#lead-form");
  const needSelect = leadForm?.querySelector('[name="necesidad"]');
  const messageField = leadForm?.querySelector('[name="mensaje"]');

  if (!leadForm || !quoteAddress || !quoteHosting) return;

  if (quoteHosting.value === "hostinger" && !selectedDomain) {
    setDomainStatus(
      "Para poder elegir el hosting de Hostinger necesitas un dominio propio. Escribe el nombre arriba (con .mx, .com u otro) y verifícalo.",
      "error"
    );
    domainInput?.focus();
    hostingDomainNote?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const tipoText =
    quoteType?.value === "especial"
      ? "Sitio con funciones especiales (cotización personalizada)"
      : "Sitio informativo (desde $750)";

  const addressText =
    quoteAddress.value === "dominio"
      ? selectedDomain
        ? quoteDomainOption?.value === "ya_tengo"
          ? `Dominio propio (ya tengo): ${selectedDomain}${selectedDomainPrice != null ? ` (${formatPrice(selectedDomainPrice)})` : ""}`
          : selectedDomainPrice != null
            ? `Dominio propio (que me lo consigan): ${selectedDomain} (disponible: ${formatPrice(selectedDomainPrice)})`
            : `Dominio propio (que me lo consigan): ${selectedDomain} (disponibilidad por confirmar)`
        : "Dominio propio, disponibilidad y precio por confirmar"
      : selectedSiteName
        ? `Enlace gratuito de Cloudflare Pages: ${selectedSiteName}.pages.dev, $0 al año`
        : "Enlace gratuito de Cloudflare Pages, $0 al año";

  const hostingPrecioTexto = lastHostingPrice
    ? `desde $${(lastHostingPrice.price / 100).toFixed(2)} MXN/mes`
    : "precio por confirmar";

  const hostingText =
    quoteHosting.value === "hostinger"
      ? `Hosting especializado de Hostinger: ${hostingPrecioTexto}`
      : "Cloudflare Pages incluido, $0 al año";

  const periodo = Number(quotePeriod?.value || 1);

  montoInicial = null;
  montoRenovacion = null;
  if (quoteType?.value !== "especial") {
    const usoDominio = quoteAddress.value === "dominio";
    const precioConocido = usoDominio ? selectedDomainPrice != null : true;
    if (precioConocido) {
      const promoDom = usoDominio && typeof selectedDomainPrice?.first_period_price === "number"
        ? selectedDomainPrice.first_period_price / 100
        : 0;
      const anualDom = usoDominio && typeof selectedDomainPrice?.price === "number"
        ? selectedDomainPrice.price / 100
        : promoDom;
      const hostMensual = quoteHosting.value === "hostinger" && lastHostingPrice
        ? lastHostingPrice.price / 100
        : 0;
      const hostAnual = hostMensual * 12;
      montoInicial = Math.round((750 + promoDom + hostAnual) * 100) / 100;
      montoRenovacion = Math.round((anualDom + hostAnual) * 100) / 100;
      montoPeriodo = Math.round((montoInicial + montoRenovacion * (periodo - 1)) * 100) / 100;
    }
  }

  const totalAno1 = quoteYear1Total?.textContent || (montoInicial != null ? formatNum(montoInicial) : "Por confirmar");
  const totalAno2 = quoteYear2Total?.textContent || (montoRenovacion != null ? formatNum(montoRenovacion) : "Por confirmar");

  const quoteDetails = [
    `Tipo de sitio: ${tipoText}.`,
    "Precio base: $750.",
    `Dirección: ${addressText}.`,
    `Alojamiento: ${hostingText}.`,
    `Periodo de pago: ${periodo} año(s).`,
    `Total año 1: ${totalAno1}.`,
    `Renovación año 2: ${totalAno2}.`,
    `Pago inicial estimado: ${quoteInitialTotal?.textContent || "$750"}.${montoInicial != null ? ` (≈ $${montoInicial.toFixed(2)} MXN)` : ""}`
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

  const camposRequeridos = [
    ["nombre", "Tu nombre"],
    ["negocio", "Nombre del negocio"],
    ["ubicacion", "Municipio o ciudad"],
    ["telefono", "Tu WhatsApp"]
  ];

  form.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
  const faltantes = [];
  for (const [name, etiqueta] of camposRequeridos) {
    const campo = form.querySelector(`[name="${name}"]`);
    if (!campo || !String(campo.value || "").trim()) {
      faltantes.push(etiqueta);
      campo?.classList.add("invalid");
    }
  }
  const telefono = String(data.get("telefono") || "").replace(/\D/g, "");
  if (telefono && telefono.length !== 10) {
    faltantes.push("Tu WhatsApp (10 dígitos)");
    form.querySelector('[name="telefono"]')?.classList.add("invalid");
  }
  const consentimiento = form.querySelector('[name="consentimiento"]');
  if (consentimiento && !consentimiento.checked) {
    consentimiento.classList.add("invalid");
  }

  if (faltantes.length > 0) {
    status.textContent = `Completa: ${faltantes.join(", ")}.`;
    status.className = "form-status error";
    form.querySelector(".invalid")?.focus();
    return;
  }

  if (consentimiento && !consentimiento.checked) {
    status.textContent = "Marca la casilla para autorizar que te contactemos.";
    status.className = "form-status error";
    return;
  }

  const payload = {
    nombre: data.get("nombre"),
    negocio: data.get("negocio"),
    ubicacion: data.get("ubicacion"),
    telefono: data.get("telefono"),
    necesidad: data.get("necesidad"),
    mensaje: data.get("mensaje"),
    consentimiento: data.get("consentimiento") === "on",
    website: data.get("website"),
    turnstileToken,
    ref: quoteRef || "",
    tipo_sitio: quoteType?.value || "",
    dominio_opcion: quoteDomainOption?.value || "",
    dominio: quoteAddress?.value === "dominio" ? selectedDomain || "" : selectedSiteName ? `${selectedSiteName}.pages.dev` : "",
    dominio_precio:
      typeof selectedDomainPrice?.price === "number"
        ? selectedDomainPrice.price / 100
        : null,
    hosting: quoteHosting?.value || "",
    hosting_precio: lastHostingPrice ? lastHostingPrice.price / 100 : null,
    periodo: Number(quotePeriod?.value || 1),
    monto_inicial: montoInicial,
    monto_renovacion: montoRenovacion,
    monto_periodo: montoPeriodo
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
    const mensaje = error.message || "Ocurrió un problema. Inténtalo nuevamente.";
    if (/anti-spam|verificaci|turnstile/i.test(mensaje)) {
      status.innerHTML =
        `No pudimos completar la verificación anti-spam. Espera un momento y vuelve a intentarlo, ` +
        `o escríbenos directo: <a href="https://wa.me/${BUSINESS_WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a>.`;
      status.className = "form-status error";
    } else {
      status.textContent = mensaje;
      status.className = "form-status error";
    }
    window.turnstile?.reset();
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();
