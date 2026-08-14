(() => {
  "use strict";

  const portal = window.EBPortal || {};
  const db = portal.client;
  const $ = (s, r = document) => r.querySelector(s);
  const safe = (v = "") => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c]));
  const getParam = name => new URLSearchParams(location.search).get(name);

  const state = {
    session: null,
    profile: null,
    project: null,
    pages: [],
    versions: new Map(),
    currentPageId: "",
    currentKey: "",
    currentType: "",
    mode: "edit",
    frameReady: false
  };

  function setStatus(text, tone = "") {
    const el = $("#editor-v2-status");
    if (!el) return;
    el.textContent = text;
    el.className = `form-status${tone ? ` ${tone}` : ""}`;
  }

  async function getSession() {
    return (await db.auth.getSession()).data.session;
  }

  async function requireSession() {
    const session = await getSession();
    if (!session) {
      localStorage.setItem(portal.authNextKey, `editor-v2.html${location.search}`);
      location.replace("acceso.html");
      throw new Error("AUTH_REDIRECT");
    }
    return session;
  }

  async function getProfile(user) {
    const { data, error } = await db.from("client_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data || { id: user.id, full_name: user.user_metadata?.full_name || user.email || "Cliente" };
  }

  async function loadEditor() {
    const projectId = getParam("project");
    if (!projectId) {
      location.replace("panel.html");
      return;
    }

    state.session = await requireSession();
    state.profile = await getProfile(state.session.user);

    const { data: project, error: projectError } = await db
      .from("client_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) throw projectError;
    state.project = project;

    const { data: pages, error: prepError } = await db.rpc("client_prepare_site_draft", {
      p_project_id: projectId
    });
    if (prepError) throw prepError;

    state.pages = pages || [];
    if (!state.pages.length) throw new Error("No se pudieron preparar las páginas del editor.");

    const pageIds = state.pages.map(p => p.id);
    const { data: versions, error: versionsError } = await db
      .from("client_site_page_versions")
      .select("*")
      .in("page_id", pageIds);

    if (versionsError) throw versionsError;

    state.versions = new Map();
    for (const row of versions || []) {
      const pageMap = state.versions.get(row.page_id) || {};
      pageMap[row.version_kind] = row;
      state.versions.set(row.page_id, pageMap);
    }

    state.currentPageId = state.pages.find(p => p.is_home)?.id || state.pages[0].id;

    $("#editor-v2-project-name").textContent = project.name || "Editor de tu sitio";
    $("#editor-v2-project-copy").textContent = "Edita por páginas, revisa en vista previa y publica cuando estés listo.";
    $("#editor-v2-back").href = `proyecto.html?id=${encodeURIComponent(project.id)}`;

    renderPageTabs();
    renderPreviewNav();
    bindActions();
    loadFrame();
    renderSidebar();
  }

  function currentPage() {
    return state.pages.find(p => p.id === state.currentPageId) || null;
  }

  function currentDraft() {
    const map = state.versions.get(state.currentPageId) || {};
    return map.draft || null;
  }

  function currentDraftData() {
    return currentDraft()?.content_json?.elements || {};
  }

  function openPage(pageId, keepSelection = false) {
    state.currentPageId = pageId;
    if (!keepSelection) {
      state.currentKey = "";
      state.currentType = "";
    }
    renderPageTabs();
    renderPreviewNav();
    loadFrame();
    renderSidebar();
  }

  function renderPageTabs() {
    const wrap = $("#editor-v2-page-tabs");
    wrap.innerHTML = state.pages.map(page => `
      <button class="editor-page-tab ${page.id === state.currentPageId ? "active" : ""}" type="button" data-page-id="${page.id}">
        ${safe(page.name)}
      </button>
    `).join("");
  }

  function renderPreviewNav() {
    const nav = $("#editor-v2-preview-nav");
    if (!nav) return;

    if (state.mode !== "preview") {
      nav.hidden = true;
      nav.innerHTML = "";
      return;
    }

    nav.hidden = false;
    nav.innerHTML = state.pages
      .filter(page => page.is_visible !== false)
      .map(page => `
        <button class="editor-preview-link ${page.id === state.currentPageId ? "active" : ""}" type="button" data-preview-page-id="${page.id}">
          ${safe(page.name)}
        </button>
      `).join("");
  }

  function currentDraftSlug() {
    return currentPage()?.slug || "inicio";
  }

  function frameUrl() {
    return `site-view.html?project=${encodeURIComponent(state.project.id)}&mode=draft&page=${encodeURIComponent(currentDraftSlug())}`;
  }

  function loadFrame() {
    const frame = $("#editor-v2-frame");
    if (!frame) return;
    state.frameReady = false;
    $("#editor-v2-current-page").textContent = currentPage()?.name || "Página";
    $("#editor-v2-mode-badge").textContent = state.mode === "preview" ? "Vista previa" : "Modo edición";
    $("#editor-v2-current-state").textContent =
      state.mode === "preview"
        ? "Navega la página como visitante antes de publicar."
        : "Haz clic sobre la página para editar lo que ves.";

    renderPreviewNav();

    frame.classList.toggle("is-preview", state.mode === "preview");
    frame.classList.toggle("is-edit", state.mode === "edit");
    frame.src = frameUrl();
  }


  function renderSidebar() {
    const empty = $("#editor-v2-sidebar-empty");
    const form = $("#editor-v2-form");
    const fields = $("#editor-v2-fields");

    if (!state.currentKey || state.mode !== "edit") {
      empty.hidden = false;
      form.hidden = true;
      return;
    }

    empty.hidden = false;
    form.hidden = false;
    empty.hidden = true;

    $("#editor-v2-section-title").textContent = displayKeyLabel(state.currentKey);

    const data = currentDraftData();
    const value = data[state.currentKey]?.value ?? draftSectionValue(state.currentKey);
    const type = state.currentType || data[state.currentKey]?.type || "text";

    fields.innerHTML = buildInlineFields(type, value);

    fields.querySelectorAll("[data-inline-field]").forEach(input => {
      input.addEventListener("input", e => {
        updateCurrentValue(e.currentTarget.value);
      });
    });
  }

  function draftSectionValue(key) {
    const draft = currentDraft();
    const sections = draft?.content_json?.sections || [];
    const dot = key.indexOf(".");
    if (dot < 0) return "";

    const blockType = key.slice(0, dot);
    const field = key.slice(dot + 1);
    const section = sections.find(s => s.type === blockType);
    const data = section?.data || {};

    if (field === "heading") return data.heading || data.title || "";
    if (field === "title") return data.title || data.heading || "";
    if (field === "subtitle") return data.subtitle || "";
    if (field === "description") return data.description || "";

    if (field === "image") {
      return data.image_url || data.image || "";
    }

    if (field === "buttons") {
      const items = [];
      if (data.button_text) {
        items.push({
          label: data.button_text,
          url: data.button_url || "",
          style: "primary"
        });
      }
      return items.length ? JSON.stringify(items, null, 2) : "";
    }

    if (field === "items") {
      const items = Array.isArray(data.items)
        ? data.items.filter(item => item && (String(item?.label || "").trim() || String(item?.text || "").trim() || String(item?.days || "").trim()))
        : [];
      return items.length ? JSON.stringify(items, null, 2) : "";
    }

    return data[field] ?? "";
  }

  function buildInlineFields(type, value) {
    if (type === "text") {
      return `
        <label class="editor-field">
          <span>Texto</span>
          <textarea data-inline-field="value">${safe(value)}</textarea>
        </label>
      `;
    }

    if (type === "image") {
      return `
        <label class="editor-field">
          <span>URL de imagen</span>
          <input type="text" data-inline-field="value" value="${safe(value)}" placeholder="https://...">
        </label>
      `;
    }

    if (type === "link") {
      return `
        <label class="editor-field">
          <span>URL o enlace</span>
          <input type="text" data-inline-field="value" value="${safe(value)}" placeholder="https://...">
        </label>
      `;
    }

    if (type === "buttons") {
      return `
        <label class="editor-field">
          <span>Botones JSON</span>
          <textarea data-inline-field="value" spellcheck="false">${safe(value)}</textarea>
          <small>Ejemplo: [{"label":"Escríbenos","url":"https://wa.me/521...","style":"primary"}]</small>
        </label>
      `;
    }

    return `
      <label class="editor-field">
        <span>Valor</span>
        <input type="text" data-inline-field="value" value="${safe(value)}">
      </label>
    `;
  }

  function updateCurrentValue(rawValue) {
    const draft = currentDraft();
    if (!draft || !state.currentKey) return;

    draft.content_json = draft.content_json || {};
    draft.content_json.elements = draft.content_json.elements || {};

    draft.content_json.elements[state.currentKey] = {
      type: state.currentType || "text",
      value: rawValue
    };

    const stateEl = $("#editor-v2-current-state");
    if (stateEl) stateEl.textContent = "Tienes cambios en esta página. Guarda borrador o publícalos cuando termines.";
    applyDraftToFrame();
  }

  async function saveDraft() {
    const draft = currentDraft();
    if (!draft) return;

    setStatus("Guardando borrador...");
    const { error } = await db
      .from("client_site_page_versions")
      .update({
        content_json: draft.content_json,
        updated_by: state.session.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", draft.id);

    if (error) {
      setStatus(error.message || "No pudimos guardar el borrador.", "error");
      return;
    }

    setStatus("Borrador guardado.", "success");
  }

  async function publishDraft() {
    if (!confirm("¿Quieres publicar estos cambios?")) return;
    setStatus("Publicando cambios...");

    const { error } = await db.rpc("client_publish_site_changes", {
      p_project_id: state.project.id,
      p_notes: "Publicado desde editor MVP"
    });

    if (error) {
      setStatus(error.message || "No pudimos publicar.", "error");
      return;
    }

    setStatus("Cambios publicados correctamente.", "success");
  }

  async function resetDraft() {
    if (!confirm("¿Quieres restablecer el borrador al último publicado?")) return;
    setStatus("Restableciendo borrador...");

    const { error } = await db.rpc("client_reset_site_draft", {
      p_project_id: state.project.id
    });

    if (error) {
      setStatus(error.message || "No pudimos restablecer.", "error");
      return;
    }

    await loadEditor();
    setStatus("Borrador restablecido.", "success");
  }

  function togglePreview() {
    state.mode = state.mode === "edit" ? "preview" : "edit";
    state.currentKey = "";
    state.currentType = "";
    $("#editor-v2-preview").textContent = state.mode === "preview" ? "Seguir editando" : "Vista previa";
    const stateEl = $("#editor-v2-current-state");
    if (stateEl) {
      stateEl.textContent =
        state.mode === "preview"
          ? "Navega la página como visitante antes de publicar."
          : "Haz clic sobre la página para editar lo que ves.";
    }
    renderSidebar();
    loadFrame();
  }

  function displayKeyLabel(key) {
    const labels = {
      "hero.title": "Título principal",
      "hero.subtitle": "Subtítulo principal",
      "hero.image": "Imagen principal",
      "hero.buttons": "Botones principales",
      "text.heading": "Título de texto",
      "text.body": "Contenido de texto",
      "contact.heading": "Título de contacto",
      "contact.whatsapp": "WhatsApp",
      "contact.phone": "Teléfono",
      "contact.email": "Correo",
      "contact.address": "Dirección",
      "contact.maps_url": "Enlace del mapa",
      "features.heading": "Título de ventajas",
      "gallery.heading": "Título de galería",
      "video.heading": "Título de video",
      "video.description": "Descripción de video",
      "testimonials.heading": "Título de testimonios",
      "hours.heading": "Título de horarios",
      "buttons.heading": "Título de botones",
      "buttons.items": "Botones de acción",
      "menu.heading": "Título del menú"
    };

    return labels[key] || key;
  }

  const EDITABLE_SELECTOR = "[data-eb-editable]";

  function watchEditableNodes(doc, scheduled = false) {
    if (!doc || state.mode !== "edit") return;
    if (scheduled) {
      applyDraftToFrame();
      bindEditableNodes(doc);
      return;
    }
    if (doc.__ebWatch) return;
    doc.__ebWatch = true;
    const onChanges = () => {
      if (doc.__ebTimer) return;
      doc.__ebTimer = setTimeout(() => {
        doc.__ebTimer = null;
        applyDraftToFrame();
        bindEditableNodes(doc);
      }, 120);
    };
    onChanges();
    new MutationObserver(onChanges).observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function bindEditableNodes(doc) {
    if (!doc || state.mode !== "edit") return;

    doc.querySelectorAll(EDITABLE_SELECTOR).forEach(node => {
      if (node.__ebBound) return;
      node.__ebBound = true;
      node.style.outline = "2px dashed rgba(183,255,74,.75)";
      node.style.outlineOffset = "3px";
      node.style.cursor = "pointer";

      node.addEventListener("click", evt => {
        evt.preventDefault();
        evt.stopPropagation();

        state.currentKey = node.getAttribute("data-eb-key") || "";
        state.currentType = node.getAttribute("data-eb-editable") || "text";
        renderSidebar();
      });
    });

    doc.querySelectorAll("a").forEach(a => {
      if (a.__ebBound) return;
      a.__ebBound = true;
      a.addEventListener("click", evt => {
        if (state.mode === "edit") {
          evt.preventDefault();
          evt.stopPropagation();
        }
      });
    });
  }

  function bindActions() {
    $("#editor-v2-page-tabs").addEventListener("click", e => {
      const btn = e.target.closest("[data-page-id]");
      if (!btn) return;
      openPage(btn.dataset.pageId);
    });

    $("#editor-v2-preview-nav").addEventListener("click", e => {
      const btn = e.target.closest("[data-preview-page-id]");
      if (!btn) return;
      openPage(btn.dataset.previewPageId, false);
    });

    $("#editor-v2-save").onclick = saveDraft;
    $("#editor-v2-publish").onclick = publishDraft;
    $("#editor-v2-reset").onclick = resetDraft;
    $("#editor-v2-preview").onclick = togglePreview;

    $("#editor-v2-frame").addEventListener("load", () => {
      state.frameReady = true;
      const frame = $("#editor-v2-frame");
      const doc = frame.contentDocument;
      if (!doc) return;

      applyDraftToFrame();
      watchEditableNodes(doc);
    });
  }

  function applyDraftToFrame() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    const draft = currentDraft();
    const elements = draft?.content_json?.elements || {};
    if (!doc) return;

    Object.entries(elements).forEach(([key, entry]) => {
      const nodes = doc.querySelectorAll(`[data-eb-key="${CSS.escape(key)}"]`);
      nodes.forEach(node => {
        const type = entry?.type || node.getAttribute("data-eb-editable") || "text";
        const value = entry?.value ?? "";

        if (type === "text") {
          node.textContent = value;
        } else if (type === "image" && node.tagName === "IMG") {
          node.setAttribute("src", value);
        } else if (type === "link" && node.tagName === "A") {
          node.setAttribute("href", value || "#");
          if (!node.textContent.trim()) node.textContent = value || "Enlace";
        } else if (type === "buttons") {
          try {
            const parsed = JSON.parse(value || "[]");
            if (Array.isArray(parsed)) {
              node.innerHTML = parsed.map(item => {
                const url = String(item?.url || "").trim() || "#";
                const label = String(item?.label || "Botón");
                const style = String(item?.style || "primary");
                return `<a class="site-btn ${safe(style)}" href="${safe(url)}">${safe(label)}</a>`;
              }).join("");
            }
          } catch {}
        }
      });
    });
  }

  loadEditor().catch(err => {
    console.error(err);
    setStatus(err.message || "No pudimos abrir el editor.", "error");
  });
})();