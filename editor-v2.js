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
    frameReady: false,
    sourceMode: "sections",
    repoPages: [],
    repoDrafts: new Map(),
    currentNodeValue: ""
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

    if (project.site_editor_mode === "html_repo" && project.site_repo_owner && project.site_repo_name) {
      state.sourceMode = "html_repo";
      await loadRepoPages(project);
    } else {
      state.sourceMode = "sections";

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
    }

    $("#editor-v2-project-name").textContent = project.name || "Editor de tu sitio";
    $("#editor-v2-project-copy").textContent = "Edita por páginas, revisa en vista previa y publica cuando estés listo.";
    $("#editor-v2-back").href = `proyecto.html?id=${encodeURIComponent(project.id)}`;

    renderPageTabs();
    renderPreviewNav();
    bindActions();
    loadFrame();
    renderSidebar();
  }

  function repoBasePath(project) {
    const raw = String(project.site_repo_path || "/").trim();
    if (!raw || raw === "/") return "";
    return raw.replace(/^\/+|\/+$/g, "");
  }

  function repoApiUrl(project, path = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = encodeURIComponent(project.site_repo_branch || "main");
    return `https://api.github.com/repos/${encodeURIComponent(project.site_repo_owner)}/${encodeURIComponent(project.site_repo_name)}/contents/${fullPath}?ref=${branch}`;
  }

  function repoRawUrl(project, path = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = encodeURIComponent(project.site_repo_branch || "main");
    return `https://raw.githubusercontent.com/${encodeURIComponent(project.site_repo_owner)}/${encodeURIComponent(project.site_repo_name)}/${branch}/${fullPath}`;
  }

  // El <base> del iframe apunta a NUESTRA API (/api/repo-asset) para servir CSS/JS/imágenes
  // con el MIME correcto y sin depender de CDNs de terceros (raw los sirve como text/plain
  // y el navegador los bloquea, dejando la página sin estilos).
  function repoCdnUrl(project, path = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = project.site_repo_branch || "main";
    const prefix = `${encodeURIComponent(project.site_repo_owner)}/${encodeURIComponent(project.site_repo_name)}@${encodeURIComponent(branch)}`;
    return `/api/repo-asset/${prefix}/${fullPath}`;
  }

  function pageNameFromPath(path = "") {
    const file = String(path).split("/").pop() || "pagina.html";
    const name = file.replace(/\.html?$/i, "");
    if (name === "index") return "Inicio";
    return name
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  async function loadRepoPages(project) {
    setStatus("Leyendo páginas del repo...");
    const res = await fetch(repoApiUrl(project));
    if (!res.ok) throw new Error("No pudimos leer el repo de GitHub. Revisa owner, repo, rama y carpeta.");
    const entries = await res.json();

    const htmlFiles = (Array.isArray(entries) ? entries : [])
      .filter(item => item.type === "file" && /\.html?$/i.test(item.name))
      .sort((a, b) => {
        if (a.name === "index.html") return -1;
        if (b.name === "index.html") return 1;
        return a.name.localeCompare(b.name);
      });

    if (!htmlFiles.length) throw new Error("No encontramos archivos HTML en ese repo/carpeta.");

    state.repoPages = htmlFiles.map((item, index) => ({
      id: item.path,
      slug: item.path,
      name: pageNameFromPath(item.path),
      path: item.path,
      is_home: item.name === "index.html" || index === 0,
      is_visible: true
    }));

    state.pages = state.repoPages;
    state.currentPageId = state.pages.find(p => p.is_home)?.id || state.pages[0].id;

    await Promise.all(state.pages.map(async page => {
      const htmlRes = await fetch(repoRawUrl(project, page.path));
      if (!htmlRes.ok) throw new Error(`No pudimos leer ${page.path}.`);
      const html = await htmlRes.text();
      state.repoDrafts.set(page.id, {
        id: page.id,
        path: page.path,
        original_html: html,
        edited_html: html,
        elements: {}
      });
    }));

    const draftResponse = await fetch(`/api/editor-repo-draft?project_id=${encodeURIComponent(project.id)}`, {
      headers: { Authorization: `Bearer ${state.session.access_token}` }
    });

    if (draftResponse.ok) {
      const draftResult = await draftResponse.json().catch(() => null);
      (draftResult?.drafts || []).forEach(saved => {
        const draft = state.repoDrafts.get(saved.page_path);
        if (!draft) return;
        draft.edited_html = saved.edited_html || draft.original_html;
        draft.elements = saved.elements || {};
      });
    }

    setStatus("Repo cargado. Toca un elemento editable.");
  }

  function currentPage() {
    return state.pages.find(p => p.id === state.currentPageId) || null;
  }

  function currentDraft() {
    if (state.sourceMode === "html_repo") {
      return state.repoDrafts.get(state.currentPageId) || null;
    }

    const map = state.versions.get(state.currentPageId) || {};
    return map.draft || null;
  }

  function currentDraftData() {
    if (state.sourceMode === "html_repo") {
      return currentDraft()?.elements || {};
    }

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
    if (state.sourceMode === "html_repo") return "about:blank";
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

    if (state.sourceMode === "html_repo") {
      const draft = currentDraft();
      const html = prepareRepoHtml(draft?.edited_html || draft?.original_html || "");
      if (frame.srcdoc === html && frame.contentWindow) {
        frame.contentWindow.location.reload();
      } else {
        frame.srcdoc = html;
      }
    } else {
      frame.removeAttribute("srcdoc");
      frame.src = frameUrl();
    }
  }


  function prepareRepoHtml(html) {
    const base = repoCdnUrl(state.project, "");
    const baseHref = base.endsWith("/") ? base : `${base}/`;
    const baseTag = `<base href="${safe(baseHref)}">`;

    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    }

    return `${baseTag}${html}`;
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
    const value = data[state.currentKey]?.value ?? (state.sourceMode === "html_repo" ? state.currentNodeValue : draftSectionValue(state.currentKey));
    const type = state.currentType || data[state.currentKey]?.type || "text";

    fields.innerHTML = buildInlineFields(type, value);

    fields.querySelectorAll("[data-inline-field]").forEach(input => {
      input.addEventListener("input", e => {
        updateCurrentValue(e.currentTarget.value);
      });
    });
  }

  function splitKey(key) {
    // "block.id.field" (nuevo) o "block.field" (viejo)
    const parts = String(key || "").split(".");
    if (parts.length >= 3) return { type: parts[0], id: parts[1], field: parts[2] };
    if (parts.length === 2) return { type: parts[0], id: "", field: parts[1] };
    return { type: "", id: "", field: "" };
  }

  function baseKey(key) {
    const { type, field } = splitKey(key);
    return field ? `${type}.${field}` : key;
  }

  function draftSectionValue(key) {
    const draft = currentDraft();
    const sections = draft?.content_json?.sections || [];
    const { type, id, field } = splitKey(key);
    if (!type || !field) return "";

    const section = id
      ? sections.find(s => s.type === type && String(s.id) === String(id))
      : sections.find(s => s.type === type);
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

    if (field === "images") {
      const images = Array.isArray(data.images) ? data.images : [];
      return images.length ? JSON.stringify(images, null, 2) : "";
    }

    if (field === "items") {
      const items = Array.isArray(data.items) ? data.items : [];
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

    if (type === "json") {
      return `
        <label class="editor-field">
          <span>Contenido JSON</span>
          <textarea data-inline-field="value" spellcheck="false">${safe(value)}</textarea>
          <small>${safe(jsonHelpText(state.currentKey))}</small>
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

    if (state.sourceMode === "html_repo") {
      draft.elements = draft.elements || {};
      draft.elements[state.currentKey] = {
        type: state.currentType || "text",
        value: rawValue
      };
    } else {
      draft.content_json = draft.content_json || {};
      draft.content_json.elements = draft.content_json.elements || {};

      draft.content_json.elements[state.currentKey] = {
        type: state.currentType || "text",
        value: rawValue
      };
    }

    const stateEl = $("#editor-v2-current-state");
    if (stateEl) stateEl.textContent = "Tienes cambios en esta página. Guarda borrador o publícalos cuando termines.";
    applyDraftToFrame();
  }

  function cleanEditorRuntimeMarks(doc) {
    doc.querySelectorAll("[data-eb-editable]").forEach(node => {
      node.style.removeProperty("outline");
      node.style.removeProperty("outline-offset");
      node.style.removeProperty("cursor");
      if (!node.getAttribute("style")) node.removeAttribute("style");
    });
  }

  function restoreRepoRelativeUrls(doc) {
    const project = state.project;
    const repoPath = `${project.site_repo_owner}/${project.site_repo_name}@${project.site_repo_branch || "main"}/`;
    const marker = "/api/repo-asset/" + repoPath;
    doc.querySelectorAll("[src],[href]").forEach(node => {
      ["src", "href"].forEach(attr => {
        const raw = node.getAttribute(attr);
        if (!raw || raw.startsWith("data:") || raw.startsWith("#")) return;
        let url = raw;
        try {
          url = new URL(raw, location.href).href;
        } catch {
          return;
        }
        const idx = url.indexOf(marker);
        if (idx === -1) return;
        const rel = url.slice(idx + marker.length);
        node.setAttribute(attr, rel || "./");
      });
    });
  }

  function syncRepoDraftFromFrame() {
    if (state.sourceMode !== "html_repo") return;
    const draft = currentDraft();
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!draft || !doc) return;

    doc.querySelectorAll("base").forEach(base => base.remove());
    cleanEditorRuntimeMarks(doc);
    restoreRepoRelativeUrls(doc);
    draft.edited_html = `<!doctype html>\n${doc.documentElement.outerHTML}`;
    ensureFrameBaseInDoc();
  }

  function ensureFrameBaseInDoc() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!doc || doc.querySelector("base")) return;
    const base = repoCdnUrl(state.project, "");
    const baseHref = base.endsWith("/") ? base : `${base}/`;
    const tag = doc.createElement("base");
    tag.href = baseHref;
    if (doc.head) doc.head.appendChild(tag);
  }

  async function saveRepoDraft() {
    syncRepoDraftFromFrame();

    const draft = currentDraft();
    if (!draft) return;

    setStatus("Guardando borrador...");
    const response = await fetch("/api/editor-repo-draft", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        project_id: state.project.id,
        page_path: draft.path,
        original_html: draft.original_html,
        edited_html: draft.edited_html,
        elements: draft.elements || {}
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setStatus(result?.message || "No pudimos guardar el borrador.", "error");
      return;
    }

    setStatus("Borrador guardado.", "success");
  }

  async function saveDraft() {
    const draft = currentDraft();
    if (!draft) return;

    if (state.sourceMode === "html_repo") {
      await saveRepoDraft();
      return;
    }

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

    function showPublishConfirm() {
    const overlay = $("#editor-v2-confirm");
    if (!overlay) return Promise.resolve(true);
    const ok = $("#editor-v2-confirm-ok");
    const cancel = $("#editor-v2-confirm-cancel");
    return new Promise(resolve => {
      overlay.hidden = false;
      const done = result => {
        overlay.hidden = true;
        ok.onclick = null;
        cancel.onclick = null;
        resolve(result);
      };
      ok.onclick = () => done(true);
      cancel.onclick = () => done(false);
      ok.focus();
    });
  }

  async function publishDraft() {
    if (state.sourceMode === "html_repo") {
      if (!(await showPublishConfirm())) return;
      await saveRepoDraft();

      setStatus("Publicando en GitHub...");
      const pages = [...state.repoDrafts.values()].map(draft => ({
        path: draft.path,
        edited_html: draft.edited_html
      }));

      const response = await fetch("/api/editor-repo-publish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.session.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project_id: state.project.id,
          pages
        })
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setStatus(result?.message || "No pudimos publicar.", "error");
        return;
      }

      setStatus("Cambios publicados en GitHub. La página puede tardar unos segundos en actualizarse.", "success");
      return;
    }

    if (!(await showPublishConfirm())) return;
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
    if (state.sourceMode === "html_repo") {
      const draft = currentDraft();
      if (draft) {
        draft.edited_html = draft.original_html;
        draft.elements = {};
      }
      state.currentKey = "";
      state.currentType = "";
      loadFrame();
      renderSidebar();
      setStatus("Borrador restablecido.", "success");
      return;
    }

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

  function jsonHelpText(key) {
    const help = {
      "features.items": 'Ejemplo: ["Servicio rápido","Atención personalizada","Entrega a domicilio"]',
      "gallery.images": 'Ejemplo: [{"url":"https://...","caption":"Frente del negocio","alt":"Fachada"}]',
      "testimonials.items": 'Ejemplo: [{"name":"María","text":"Muy buen servicio"}]',
      "hours.items": 'Ejemplo: [{"days":"Lunes a viernes","hours":"8:00 AM a 6:00 PM"}]',
      "menu.items": 'Ejemplo: [{"name":"Pizza grande","price":180,"category":"Pizzas","description":"8 rebanadas"}]'
    };

    return help[key] || help[baseKey(key)] || "Pega aquí una lista JSON válida.";
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
      "features.items": "Lista de ventajas",
      "gallery.heading": "Título de galería",
      "gallery.images": "Imágenes de galería",
      "video.heading": "Título de video",
      "video.description": "Descripción de video",
      "testimonials.heading": "Título de testimonios",
      "testimonials.items": "Lista de testimonios",
      "hours.heading": "Título de horarios",
      "hours.items": "Lista de horarios",
      "buttons.heading": "Título de botones",
      "buttons.items": "Botones de acción",
      "menu.heading": "Título del menú",
      "menu.items": "Productos del menú"
    };

    return labels[key] || labels[baseKey(key)] || key;
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

  function readNodeValue(node, type) {
    if (!node) return "";
    if (type === "image" && node.tagName === "IMG") return node.getAttribute("src") || "";
    if (type === "link" && node.tagName === "A") return node.getAttribute("href") || "";
    return node.textContent || "";
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
        state.currentNodeValue = readNodeValue(node, state.currentType);
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
    const elements = state.sourceMode === "html_repo"
      ? (draft?.elements || {})
      : (draft?.content_json?.elements || {});
    if (!doc) return;

    Object.entries(elements).forEach(([key, entry]) => {
      const nodes = doc.querySelectorAll(`[data-eb-key="${CSS.escape(key)}"]`);
      nodes.forEach(node => {
        const type = entry?.type || node.getAttribute("data-eb-editable") || "text";
        const value = entry?.value ?? "";

        if (type === "text") {
          node.textContent = value;
          return;
        }

        if (type === "image" && node.tagName === "IMG") {
          node.setAttribute("src", value);
          return;
        }

        if (type === "link" && node.tagName === "A") {
          node.setAttribute("href", value || "#");
          if (!node.textContent.trim()) node.textContent = value || "Enlace";
          return;
        }

        if (type === "buttons") {
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
          } catch {
            setStatus("El formato JSON de botones no es válido.", "error");
          }
          return;
        }

        if (type === "json") {
          try {
            const parsed = JSON.parse(value || "[]");
            if (!Array.isArray(parsed)) throw new Error("JSON_LIST_REQUIRED");
            const listKey = baseKey(key);

            if (listKey === "features.items") {
              node.innerHTML = parsed.length
                ? parsed.map(item => `<div>${safe(typeof item === "string" ? item : (item?.text || item?.label || ""))}</div>`).join("")
                : `<div>Agrega tus ventajas aquí.</div>`;
            } else if (listKey === "gallery.images") {
              node.innerHTML = parsed.length
                ? parsed.map(img => `
                    <article class="site-gallery-card">
                      ${img?.url ? `<img class="site-gallery-image" src="${safe(img.url)}" alt="${safe(img.alt || img.caption || "Imagen de galería")}" loading="lazy">` : `<div class="site-media-box">Sin imagen</div>`}
                      <div class="site-gallery-copy">
                        <strong>${safe(img?.caption || img?.alt || "Imagen")}</strong>
                      </div>
                    </article>
                  `).join("")
                : `<div class="site-media-box">Sin imágenes todavía.</div>`;
            } else if (listKey === "testimonials.items") {
              node.innerHTML = parsed.length
                ? parsed.map(item => `
                    <article class="site-testimonial">
                      <p>“${safe(item?.text || item?.body || "")}”</p>
                      <strong>${safe(item?.name || item?.author || "Cliente")}</strong>
                    </article>
                  `).join("")
                : `<div class="site-media-box">Sin testimonios todavía.</div>`;
            } else if (listKey === "hours.items") {
              node.innerHTML = parsed.length
                ? parsed.map(item => `<div class="site-hours-row"><span>${safe(item?.days || item?.day || "")}</span><span>${safe(item?.hours || item?.hour || "")}</span></div>`).join("")
                : `<div class="site-media-box">Sin horarios todavía.</div>`;
            } else if (listKey === "menu.items") {
              node.innerHTML = parsed.length
                ? parsed.map(item => `
                    <article class="site-menu-card" data-menu-item data-category="${safe(item?.category || "")}">
                      ${item?.image ? `<div class="site-menu-card-media"><img class="site-menu-card-img" src="${safe(item.image)}" alt="${safe(item?.name || "Producto")}" loading="lazy"></div>` : ""}
                      <div class="site-menu-card-body">
                        <div class="site-menu-card-head">
                          <h3>${safe(item?.name || "Producto")}</h3>
                          <strong class="site-menu-card-price">$${safe(String(item?.price ?? item?.price_from ?? ""))}</strong>
                        </div>
                        ${item?.description ? `<p>${safe(item.description)}</p>` : ""}
                        ${item?.sizes?.length ? `
                          <div class="site-menu-sizes">
                            ${item.sizes.map(size => `<span>${safe(size?.label || "")} $${safe(String(size?.price ?? ""))}</span>`).join("")}
                          </div>
                        ` : ""}
                        ${item?.tag ? `<span class="site-menu-tag">${safe(item.tag)}</span>` : ""}
                      </div>
                    </article>
                  `).join("")
                : `<div class="site-media-box">Todavía no has agregado productos al menú.</div>`;
            }
          } catch {
            setStatus(`El contenido de ${displayKeyLabel(key)} no tiene un JSON válido.`, "error");
          }
        }
      });
    });
  }

  loadEditor().catch(err => {
    console.error(err);
    setStatus(err.message || "No pudimos abrir el editor.", "error");
  });
})();