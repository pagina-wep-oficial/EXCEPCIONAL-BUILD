(() => {
  "use strict";

  const portal = window.EBPortal || {};
  const db = portal.client;
  const $ = (s, r = document) => r.querySelector(s);
  const safe = (v = "") => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const getParam = name => new URLSearchParams(location.search).get(name);

  const state = {
    project: null,
    pages: [],
    versions: new Map(),
    currentPageId: "",
    mode: "published"
  };

  function setStatus(text, tone = "") {
    const el = $("#site-view-status");
    if (!el) return;
    el.textContent = text;
    el.className = `site-view-status${tone ? ` ${tone}` : ""}`;
  }

  async function getSession() {
    return (await db.auth.getSession()).data.session;
  }

  async function requireSessionForDraft() {
    const session = await getSession();
    if (!session) {
      localStorage.setItem(portal.authNextKey, `site-view.html${location.search}`);
      location.replace("acceso.html");
      throw new Error("AUTH_REDIRECT");
    }
    return session;
  }

  function normalizeViewMode() {
    return getParam("mode") === "draft" ? "draft" : "published";
  }

  async function loadSite() {
    const projectId = getParam("project");
    if (!projectId) {
      location.replace("index.html");
      return;
    }

    const mode = normalizeViewMode();
    const slug = getParam("page") || "inicio";

    state.mode = mode;
    if (mode === "draft") await requireSessionForDraft();

    const { data: project, error: projectError } = await db
      .from("client_projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) throw new Error("No encontramos este sitio.");
    state.project = project;

    const { data: pages, error: pagesError } = await db
      .from("client_site_pages")
      .select("id, slug, name, page_order, is_home, is_visible")
      .eq("project_id", projectId)
      .order("page_order", { ascending: true });

    if (pagesError) throw pagesError;
    state.pages = pages || [];
    if (!state.pages.length) throw new Error("Este sitio todavía no tiene páginas publicadas.");

    const pageIds = state.pages.map(p => p.id);
    const { data: versions, error: versionsError } = await db
      .from("client_site_page_versions")
      .select("id, page_id, version_kind, content_json")
      .in("page_id", pageIds);

    if (versionsError) throw versionsError;

    state.versions = new Map();
    for (const row of versions || []) {
      const pageMap = state.versions.get(row.page_id) || {};
      pageMap[row.version_kind] = row;
      state.versions.set(row.page_id, pageMap);
    }

    const bySlug = state.pages.find(p => p.slug === slug);
    const home = state.pages.find(p => p.is_home);
    state.currentPageId = (bySlug || home || state.pages[0]).id;

    renderNav();
    renderPage();
  }

  function currentPage() {
    return state.pages.find(p => p.id === state.currentPageId) || null;
  }

  function currentVersion() {
    const map = state.versions.get(state.currentPageId) || {};
    return map[state.mode] || null;
  }

  function renderNav() {
    const nav = $("#site-view-nav");
    const baseMode = state.mode === "draft" ? "draft" : "published";

    nav.innerHTML = state.pages
      .filter(page => page.is_visible !== false)
      .map(page => {
        const href = `site-view.html?project=${encodeURIComponent(state.project.id)}&mode=${encodeURIComponent(baseMode)}&page=${encodeURIComponent(page.slug || "")}`;
        return `
          <a class="${page.id === state.currentPageId ? "active" : ""}" href="${href}">
            ${safe(page.name)}
          </a>
        `;
      }).join("");
  }

  function renderButtons(items = []) {
    if (!items.length) return "";
    return `<div class="site-hero-actions">${
      items.map(item => {
        const url = String(item.url || "").trim() || "#";
        const external = /^https?:\/\//i.test(url);
        return `<a class="site-btn ${safe(item.style || "primary")}" href="${safe(url)}"${external ? ` target="_blank" rel="noopener"` : ""}>${safe(item.label || "Botón")}</a>`;
      }).join("")
    }</div>`;
  }

  function waNumber(phone = "") {
    return String(phone || "").replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  }

  function editableAttrs(type, key, extra = "") {
    return `data-eb-editable="${safe(type)}" data-eb-key="${safe(key)}"${extra ? ` ${extra}` : ""}`;
  }

  function editableSection(name) {
    return `data-eb-section="${safe(name)}"`;
  }

  function renderImage(url, alt = "", className = "site-image-real", attrs = "") {
    const src = String(url || "").trim();
    if (!src) return "";
    return `<img class="${className}" src="${safe(src)}" alt="${safe(alt || "")}" loading="lazy"${attrs ? ` ${attrs}` : ""}>`;
  }

  function currentElements() {
    return currentVersion()?.content_json?.elements || {};
  }

  function elementValue(key, fallback = "") {
    const entry = currentElements()[key];
    if (!entry) return fallback;
    return entry.value ?? fallback;
  }

  function elementJson(key, fallback) {
    const raw = elementValue(key, "");
    if (!String(raw || "").trim()) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function renderBlock(section) {
    if (section.visible === false) return "";
    const data = section.data || {};

    if (section.type === "hero") {
      const heroTitle = elementValue("hero.title", data.title || "Tu negocio");
      const heroSubtitle = elementValue("hero.subtitle", data.subtitle || "");
      const heroImage = elementValue("hero.image", data.image_url || "");
      const actions = elementJson(
        "hero.buttons",
        data.button_text ? [{ label: data.button_text, url: data.button_url || "", style: "primary" }] : []
      );

      return `
        <section class="site-section site-hero" ${editableSection("hero")}>
          <div class="site-hero-layout">
            <div class="site-hero-copy">
              <h2 ${editableAttrs("text", "hero.title")}>${safe(heroTitle)}</h2>
              <p ${editableAttrs("text", "hero.subtitle")}>${safe(heroSubtitle)}</p>
              ${Array.isArray(actions) && actions.length ? `<div ${editableAttrs("buttons", "hero.buttons")}>${renderButtons(actions)}</div>` : ""}
            </div>
            <div>
              ${renderImage(
                heroImage,
                data.image_alt || heroTitle || "Imagen principal",
                "site-hero-image",
                editableAttrs("image", "hero.image")
              ) || `<div class="site-media-box">Agrega una imagen principal para esta portada.</div>`}
            </div>
          </div>
        </section>
      `;
    }

    if (section.type === "text") {
      const textHeading = elementValue("text.heading", data.heading || "");
      const textBody = elementValue("text.body", data.body || "");

      return `
        <section class="site-section" ${editableSection("text")}>
          ${textHeading ? `<h2 ${editableAttrs("text", "text.heading")}>${safe(textHeading)}</h2>` : ""}
          <p ${editableAttrs("text", "text.body")}>${safe(textBody)}</p>
        </section>
      `;
    }

    if (section.type === "features") {
      const items = Array.isArray(data.items) ? data.items : [];
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          <div class="site-features-grid">
            ${items.length ? items.map(item => `<div>${safe(item)}</div>`).join("") : `<div>Agrega tus ventajas aquí.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "gallery") {
      const images = Array.isArray(data.images) ? data.images : [];
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          <div class="site-gallery">
            ${images.length ? images.map(img => `
              <article class="site-gallery-card">
                ${renderImage(img.url, img.alt || img.caption || "Imagen de galería", "site-gallery-image") || `<div class="site-media-box">Sin imagen</div>`}
                <div class="site-gallery-copy">
                  <strong>${safe(img.caption || img.alt || "Imagen")}</strong>
                </div>
              </article>
            `).join("") : `<div class="site-media-box">Sin imágenes todavía.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "image") {
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          ${renderImage(data.image_url, data.image_alt || data.caption || "Imagen", "site-image-real") || `<div class="site-media-box">Sin imagen todavía.</div>`}
          ${data.caption ? `<div class="site-image-caption">${safe(data.caption)}</div>` : ""}
        </section>
      `;
    }

    if (section.type === "video") {
      const url = String(data.video_url || data.url || "").trim();
      const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
      return `
        <section class="site-section">
          ${(data.title || data.heading) ? `<h2>${safe(data.title || data.heading)}</h2>` : ""}
          ${data.description ? `<p>${safe(data.description)}</p>` : ""}
          <div class="site-video">
            ${m ? `
              <div class="site-video-frame">
                <iframe src="https://www.youtube.com/embed/${safe(m[1])}" title="${safe(data.title || data.heading || "Video")}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
              </div>
            ` : url ? `<a class="site-video-link" href="${safe(url)}" target="_blank" rel="noopener">Ver video</a>` : `<div class="site-media-box">Sin video todavía.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "testimonials") {
      const items = Array.isArray(data.items) ? data.items : [];
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          <div class="site-testimonials">
            ${items.length ? items.map(item => `
              <article class="site-testimonial">
                <p>“${safe(item.text || item.body || "")}”</p>
                <strong>${safe(item.name || item.author || "Cliente")}</strong>
              </article>
            `).join("") : `<div class="site-media-box">Sin testimonios todavía.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "contact") {
      const contactHeading = elementValue("contact.heading", data.heading || "");
      const contactWhatsapp = elementValue("contact.whatsapp", data.whatsapp || "");
      const contactPhone = elementValue("contact.phone", data.phone || "");
      const contactEmail = elementValue("contact.email", data.email || "");
      const contactAddress = elementValue("contact.address", data.address || "");
      const contactMapsUrl = elementValue("contact.maps_url", data.maps_url || "");

      return `
        <section class="site-section" ${editableSection("contact")}>
          ${contactHeading ? `<h2 ${editableAttrs("text", "contact.heading")}>${safe(contactHeading)}</h2>` : `<h2>Contacto</h2>`}
          <div class="site-contact-list">
            ${contactWhatsapp ? `<div class="site-contact-row"><span>WhatsApp</span><a ${editableAttrs("text", "contact.whatsapp")} href="https://wa.me/${safe(waNumber(contactWhatsapp))}" target="_blank" rel="noopener">${safe(contactWhatsapp)}</a></div>` : ""}
            ${contactPhone ? `<div class="site-contact-row"><span>Teléfono</span><a ${editableAttrs("text", "contact.phone")} href="tel:${safe(contactPhone)}">${safe(contactPhone)}</a></div>` : ""}
            ${contactEmail ? `<div class="site-contact-row"><span>Correo</span><a ${editableAttrs("text", "contact.email")} href="mailto:${safe(contactEmail)}">${safe(contactEmail)}</a></div>` : ""}
            ${contactAddress ? `<div class="site-contact-row"><span>Dirección</span><span ${editableAttrs("text", "contact.address")}>${safe(contactAddress)}</span></div>` : ""}
            ${contactMapsUrl ? `<div class="site-contact-row"><span>Ubicación</span><a ${editableAttrs("link", "contact.maps_url")} href="${safe(contactMapsUrl)}" target="_blank" rel="noopener">Ver en el mapa</a></div>` : ""}
            ${!contactWhatsapp && !contactPhone && !contactEmail && !contactAddress && !contactMapsUrl ? `<div class="site-media-box">Todavía no has agregado tus datos de contacto.</div>` : ""}
          </div>
        </section>
      `;
    }

    if (section.type === "hours") {
      const items = Array.isArray(data.items) && data.items.length
        ? data.items
        : (data.days_text ? [{ days: data.days_text, hours: data.hours_text || "" }] : []);
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          <div class="site-hours">
            ${items.length ? items.map(item => `<div class="site-hours-row"><span>${safe(item.days || item.day || "")}</span><span>${safe(item.hours || item.hour || "")}</span></div>`).join("") : `<div class="site-media-box">Sin horarios todavía.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "buttons") {
      const items = Array.isArray(data.items) ? data.items.filter(item => String(item?.label || "").trim()) : [];
      return `
        <section class="site-section">
          ${data.heading ? `<h2>${safe(data.heading)}</h2>` : ""}
          <div class="site-actions-row">
            ${items.length ? renderButtons(items) : `<div class="site-media-box">Agrega botones de acción para esta sección.</div>`}
          </div>
        </section>
      `;
    }

    if (section.type === "menu") {
      const heading = elementValue("menu.heading", data.heading || "Nuestro menú");
      const items = Array.isArray(data.items) ? data.items : [];
      const categories = Array.isArray(data.categories) && data.categories.length
        ? data.categories
        : Array.from(new Set(items.map(item => item.category).filter(Boolean)));
      const showTabs = categories.length > 1;

      return `
        <section class="site-section site-menu" ${editableSection("menu")}>
          <h2 ${editableAttrs("text", "menu.heading")}>${safe(heading)}</h2>
          ${showTabs ? `
            <div class="site-menu-tabs" data-menu-tabs>
              <button class="site-menu-tab active" type="button" data-menu-cat="all">Todo</button>
              ${categories.map(cat => `<button class="site-menu-tab" type="button" data-menu-cat="${safe(cat)}">${safe(cat)}</button>`).join("")}
            </div>
          ` : ""}
          <div class="site-menu-grid">
            ${items.length ? items.map(item => `
              <article class="site-menu-card" data-menu-item data-category="${safe(item.category || "")}">
                ${item.image ? `<div class="site-menu-card-media">${renderImage(item.image, item.name || "Producto", "site-menu-card-img")}</div>` : ""}
                <div class="site-menu-card-body">
                  <div class="site-menu-card-head">
                    <h3>${safe(item.name || "Producto")}</h3>
                    <strong class="site-menu-card-price">$${safe(String(item.price ?? item.price_from ?? ""))}</strong>
                  </div>
                  ${item.description ? `<p>${safe(item.description)}</p>` : ""}
                  ${item.sizes?.length ? `
                    <div class="site-menu-sizes">
                      ${item.sizes.map(size => `<span>${safe(size.label || "")} $${safe(String(size.price ?? ""))}</span>`).join("")}
                    </div>
                  ` : ""}
                  ${item.tag ? `<span class="site-menu-tag">${safe(item.tag)}</span>` : ""}
                </div>
              </article>
            `).join("") : `<div class="site-media-box">Todavía no has agregado productos al menú.</div>`}
          </div>
        </section>
      `;
    }

    return `
      <section class="site-section">
        <h3>${safe(section.label || "Sección")}</h3>
        <p>Este bloque aún no tiene formato específico.</p>
      </section>
    `;
  }

  function renderPage() {
    const page = currentPage();
    const version = currentVersion();
    const sections = version?.content_json?.sections || [];

    $("#site-view-project-name").textContent = state.project?.name || "Sitio";
    $("#site-view-mode-badge").textContent = state.mode === "draft" ? "Borrador" : "Publicado";
    $("#site-view-mode-badge").classList.toggle("draft", state.mode === "draft");
    setStatus(state.mode === "draft"
      ? `Estás viendo el borrador privado de ${page?.name || "la página"}.`
      : `Estás viendo la versión pública publicada de ${page?.name || "la página"}.`);

    document.title = `${page?.name || "Sitio"} | ${state.project?.name || "Sitio"}`;

    const content = $("#site-view-content");
    content.innerHTML = sections.length
      ? sections.map(section => renderBlock(section)).join("")
      : `<section class="site-section"><p>Esta página todavía no tiene contenido publicado.</p></section>`;

    // Filtro por categorías del menú (si hay tabs)
    content.querySelectorAll("[data-menu-tabs]").forEach(tabs => {
      tabs.addEventListener("click", e => {
        const btn = e.target.closest("[data-menu-cat]");
        if (!btn) return;
        tabs.querySelectorAll("[data-menu-cat]").forEach(b => b.classList.toggle("active", b === btn));
        const cat = btn.dataset.menuCat;
        const grid = tabs.parentElement?.querySelector(".site-menu-grid");
        grid?.querySelectorAll("[data-menu-item]").forEach(item => {
          const show = cat === "all" || item.dataset.category === cat;
          item.style.display = show ? "" : "none";
        });
      });
    });
  }

  loadSite().catch(err => {
    console.error(err);
    setStatus(err.message || "No pudimos cargar este sitio.", "error");
  });
})();