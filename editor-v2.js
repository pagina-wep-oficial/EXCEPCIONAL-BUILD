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
    currentPageId: "",
    currentKey: "",
    currentType: "",
    currentRole: "",
    currentKind: "",
    currentSection: "",
    currentFuture: "",
    currentNodeMode: "active",
    mode: "edit",
    frameReady: false,
    repoPages: [],
    repoDrafts: new Map(),
    currentNodeValue: "",
    history: [],
    historyIndex: -1
  };

  const EDITOR_BASE_BRANCH = "editor-base";
  const DRAFT_META_KEY = "__editor_meta__";

  function liveRepoBranch(project = state.project) {
    return String(project?.site_repo_branch || "main").trim() || "main";
  }

  function baseRepoBranch() {
    return EDITOR_BASE_BRANCH;
  }

  function readDraftMeta(draft) {
    const raw = draft?.elements?.[DRAFT_META_KEY]?.value || "";
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDraftMeta(draft, patch = {}) {
    if (!draft) return {};
    draft.elements = draft.elements && typeof draft.elements === "object" ? draft.elements : {};
    const next = {
      ...readDraftMeta(draft),
      ...(patch && typeof patch === "object" ? patch : {})
    };
    draft.elements[DRAFT_META_KEY] = {
      type: "__system__",
      value: JSON.stringify(next)
    };
    return next;
  }

  function draftAssetBranch(draft = currentDraft()) {
    return String(readDraftMeta(draft).asset_branch || liveRepoBranch()).trim() || liveRepoBranch();
  }

  const EDITOR_STATUS_COPY = Object.freeze({
    loading_content: "Cargando contenido...",
    content_ready: "Contenido cargado. Toca un elemento editable.",
    undo_done: "Cambio deshecho.",
    redo_done: "Cambio rehecho.",
    loading_base: "Cargando versión base...",
    base_loaded: "Versión base lista. Revisa los cambios y publícalos si quieres usarla.",
    saving_draft: "Guardando cambios...",
    draft_saved: "Cambios guardados.",
    publishing: "Publicando cambios...",
    published_ok: "Cambios publicados. En un momento los verás reflejados en tu página.",
    page_reset: "Esta página volvió a su último estado guardado.",
    image_optimizing: "Preparando imagen...",
    image_uploading: "Subiendo imagen...",
    image_uploaded: "Imagen aplicada.",
    video_uploading: "Subiendo video...",
    video_processing: "Preparando video...",
    video_uploaded: "Video listo.",
    image_prepare: "Preparando imagen...",
    image_adjust_hint: "Mueve, acerca o gira la imagen. Toca 'Guardar' cuando se vea bien.",
    image_adjust_saved: "Ajuste guardado. La imagen original no se modifica.",
    image_pick_first: "Primero elige una imagen para ajustarla.",
    image_direct_only: "Esta imagen no se puede ajustar desde aquí."
  });

  const EDITOR_ERROR_COPY = Object.freeze({
    "EB-UNKNOWN-001": {
      title: "No pudimos completar esta acción",
      text: "Inténtalo de nuevo en un momento. Código: EB-UNKNOWN-001"
    },
    "EB-LOAD-001": {
      title: "No pudimos abrir el editor",
      text: "Vuelve a intentarlo en un momento. Código: EB-LOAD-001"
    },
    "EB-LOAD-002": {
      title: "Este proyecto todavía no está listo",
      text: "Aún falta terminar su configuración. Código: EB-LOAD-002"
    },
    "EB-PERM-001": {
      title: "No tienes acceso a este proyecto",
      text: "Verifica tu cuenta o pide acceso. Código: EB-PERM-001"
    },
    "EB-DRAFT-001": {
      title: "No pudimos guardar tus cambios",
      text: "Si sales ahora, podrías perder lo editado. Código: EB-DRAFT-001"
    },
    "EB-PUBLISH-001": {
      title: "No pudimos publicar tus cambios",
      text: "Inténtalo de nuevo en un momento. Código: EB-PUBLISH-001"
    },
    "EB-BASE-001": {
      title: "No pudimos cargar esta versión",
      text: "Inténtalo de nuevo o sigue editando la versión actual. Código: EB-BASE-001"
    },
    "EB-MEDIA-001": {
      title: "No pudimos subir esta imagen",
      text: "Revisa tu conexión e inténtalo de nuevo. Código: EB-MEDIA-001"
    },
    "EB-MEDIA-002": {
      title: "No pudimos abrir esta imagen",
      text: "Prueba con otra imagen o vuelve a intentarlo. Código: EB-MEDIA-002"
    },
    "EB-MEDIA-003": {
      title: "No pudimos guardar este ajuste",
      text: "Inténtalo de nuevo. Código: EB-MEDIA-003"
    },
    "EB-VIDEO-001": {
      title: "No pudimos subir este video",
      text: "Prueba con otro archivo o inténtalo de nuevo. Código: EB-VIDEO-001"
    },
    "EB-VIDEO-002": {
      title: "Todavía estamos preparando un video",
      text: "Espera a que termine antes de publicar. Código: EB-VIDEO-002"
    },
    "EB-CONTENT-001": {
      title: "Hay un bloque que no pudimos procesar",
      text: "Revisa ese contenido o inténtalo otra vez. Código: EB-CONTENT-001"
    }
  });

  let activeEditorErrorCode = "";

  function writeStatusLine(text, tone = "") {
    const el = $("#editor-v2-status");
    if (!el) return;
    el.textContent = text;
    el.className = `form-status${tone ? ` ${tone}` : ""}`;
  }

  function clearEditorError() {
    activeEditorErrorCode = "";
    const card = $("#editor-v2-error-card");
    if (card) card.hidden = true;
  }

  function showEditorError(code = "EB-UNKNOWN-001") {
    const copy = EDITOR_ERROR_COPY[code] || EDITOR_ERROR_COPY["EB-UNKNOWN-001"];
    const card = $("#editor-v2-error-card");
    const title = $("#editor-v2-error-title");
    const text = $("#editor-v2-error-text");

    activeEditorErrorCode = code;
    writeStatusLine("");

    if (!card || !title || !text) {
      writeStatusLine(copy.text, "error");
      return;
    }

    title.textContent = copy.title;
    text.textContent = copy.text;
    card.hidden = false;
  }

  function setStatus(text, tone = "") {
    if (tone === "error") {
      showEditorError("EB-UNKNOWN-001");
      return;
    }
    if (activeEditorErrorCode) clearEditorError();
    writeStatusLine(text, tone);
  }

  function classifyLoadError(error) {
    const raw = String(error?.message || "").trim().toLowerCase();
    if (!raw || raw === "auth_redirect") return "";
    if (raw.includes("configur") && raw.includes("repo")) return "EB-LOAD-002";
    if (
      raw.includes("no tienes acceso") ||
      raw.includes("forbidden") ||
      raw.includes("permission") ||
      raw.includes("permis") ||
      raw.includes("jwt") ||
      raw.includes("token")
    ) {
      return "EB-PERM-001";
    }
    return "EB-LOAD-001";
  }

  $("#editor-v2-error-close")?.addEventListener("click", clearEditorError);

  // Indicador de carga dentro del area donde se dibuja la pagina a editar.
  // Visible desde el primer paint (viene en el HTML) hasta que el iframe carga.
  let frameLoadingHideTimer = 0;
  function setFrameLoading(text) {
    const el = $("#editor-v2-frame-loading");
    if (!el) return;
    clearTimeout(frameLoadingHideTimer);
    el.classList.remove("is-hidden");
    el.hidden = false;
    const t = $("#editor-v2-frame-loading-text");
    if (t && text) t.textContent = text;
  }
  function hideFrameLoading() {
    const el = $("#editor-v2-frame-loading");
    if (!el || el.hidden) return;
    el.classList.add("is-hidden");
    frameLoadingHideTimer = setTimeout(() => { el.hidden = true; }, 300);
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

    setFrameLoading("Cargando tu proyecto…");

    const { data: project, error: projectError } = await db
      .from("client_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) throw projectError;
    state.project = project;

    if (!project.site_repo_owner || !project.site_repo_name) {
      throw new Error("A este proyecto todavía no se le configuró el repo del Editor V2. Define GitHub owner y repositorio en Administración.");
    }

    setFrameLoading("Cargando el contenido…");
    await loadRepoPages(project);

    $("#editor-v2-project-name").textContent = project.name || "Editor de tu sitio";
    $("#editor-v2-project-copy").textContent = "Edita lo que ves, revisa los cambios y publícalos cuando estés listo.";
    $("#editor-v2-back").href = `proyecto.html?id=${encodeURIComponent(project.id)}`;

    renderPageTabs();
    renderPreviewNav();
    bindActions();
    loadFrame();
    renderSidebar();
    pushHistory();
    updateUndoButtons();
  }

  function repoBasePath(project) {
    const raw = String(project.site_repo_path || "/").trim();
    if (!raw || raw === "/") return "";
    return raw.replace(/^\/+|\/+$/g, "");
  }

  function repoApiUrl(project, path = "", mode = "token", branchOverride = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = String(branchOverride || liveRepoBranch(project)).trim() || "main";
    const params = new URLSearchParams({
      owner: project.site_repo_owner || "",
      repo: project.site_repo_name || "",
      branch,
      path: fullPath,
      mode
    });
    return `/api/repo-contents?${params.toString()}`;
  }

  function githubContentsUrl(project, path = "", branchOverride = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const encodedPath = fullPath
      ? fullPath.split("/").map(seg => encodeURIComponent(seg)).join("/")
      : "";
    const owner = encodeURIComponent(project.site_repo_owner || "");
    const repo = encodeURIComponent(project.site_repo_name || "");
    const branch = encodeURIComponent(String(branchOverride || liveRepoBranch(project)).trim() || "main");
    return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${branch}`;
  }

  function repoReaderStorageKey(project) {
    return `eb_repo_reader_mode_${project.id}`;
  }

  function readRepoReaderState(project) {
    try {
      const raw = localStorage.getItem(repoReaderStorageKey(project));
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        mode: parsed?.mode === "token" ? "token" : "direct",
        fallbackUntil: Number(parsed?.fallbackUntil || 0) || 0,
        lastReason: String(parsed?.lastReason || "")
      };
    } catch {
      return { mode: "direct", fallbackUntil: 0, lastReason: "" };
    }
  }

  function writeRepoReaderState(project, next) {
    localStorage.setItem(repoReaderStorageKey(project), JSON.stringify({
      mode: next?.mode === "token" ? "token" : "direct",
      fallbackUntil: Number(next?.fallbackUntil || 0) || 0,
      lastReason: String(next?.lastReason || "")
    }));
  }

  function getActiveRepoReaderState(project) {
    const current = readRepoReaderState(project);
    const now = Math.floor(Date.now() / 1000);

    if (current.mode === "token" && current.fallbackUntil > now) {
      return current;
    }

    if (current.mode === "token" && current.fallbackUntil && current.fallbackUntil <= now) {
      writeRepoReaderState(project, {
        mode: "direct",
        fallbackUntil: 0,
        lastReason: ""
      });
    }

    return { mode: "direct", fallbackUntil: 0, lastReason: "" };
  }

  function enableRepoReaderFallback(project, resetEpochSeconds = 0, reason = "") {
    const fallbackUntil = Number(resetEpochSeconds || 0) > 0
      ? Number(resetEpochSeconds || 0)
      : Math.floor(Date.now() / 1000) + (15 * 60);

    writeRepoReaderState(project, {
      mode: "token",
      fallbackUntil,
      lastReason: reason || "direct_limit"
    });
  }

  function clearRepoReaderFallback(project) {
    writeRepoReaderState(project, {
      mode: "direct",
      fallbackUntil: 0,
      lastReason: ""
    });
  }

  function readRateLimitHeaders(headers) {
    const remaining = Number(headers.get("x-ratelimit-remaining"));
    const reset = Number(headers.get("x-ratelimit-reset"));

    return {
      remaining: Number.isFinite(remaining) ? remaining : null,
      reset: Number.isFinite(reset) ? reset : 0
    };
  }

  async function readJsonPayload(response) {
    const text = await response.text();
    if (!text) return { text: "", data: null };

    try {
      return { text, data: JSON.parse(text) };
    } catch {
      return { text, data: null };
    }
  }

  function makeHardRepoError(message) {
    const error = new Error(message);
    error.repoHard = true;
    return error;
  }

  async function fetchRepoContentsDirect(project, path = "", branchOverride = "") {
    try {
      const response = await fetch(githubContentsUrl(project, path, branchOverride), {
        headers: {
          Accept: "application/vnd.github+json"
        }
      });

      const { data, text } = await readJsonPayload(response);

      if (response.ok) {
        clearRepoReaderFallback(project);
        return {
          ok: true,
          entries: Array.isArray(data) ? data : [],
          source: "direct"
        };
      }

      const message = String(data?.message || text || "").trim();
      const rate = readRateLimitHeaders(response.headers);

      if (response.status === 404) {
        throw makeHardRepoError("No encontramos ese repo/carpeta/rama en GitHub. Revisa owner, repo, rama y carpeta.");
      }

      if (response.status === 403 || response.status === 429) {
        enableRepoReaderFallback(project, rate.reset, message || `github_${response.status}`);
        return {
          ok: false,
          fallback: true,
          reason: message || `GitHub respondió ${response.status}.`
        };
      }

      throw makeHardRepoError(message || `GitHub respondió ${response.status} al leer el repo.`);
    } catch (error) {
      if (error?.repoHard) throw error;

      enableRepoReaderFallback(project, 0, error?.message || "direct_fetch_failed");
      return {
        ok: false,
        fallback: true,
        reason: error?.message || "No pudimos leer el repo directo."
      };
    }
  }

  async function fetchRepoContentsWithToken(project, path = "", branchOverride = "") {
    const response = await fetch(repoApiUrl(project, path, "token", branchOverride));
    const { data, text } = await readJsonPayload(response);

    if (!response.ok) {
      const message = String(data?.message || text || "").trim();

      if (response.status === 404) {
        throw new Error("No encontramos ese repo/carpeta/rama en GitHub. Revisa owner, repo, rama y carpeta.");
      }

      throw new Error(message || "No pudimos leer el repo con el respaldo.");
    }

    return {
      ok: true,
      entries: Array.isArray(data) ? data : [],
      source: "token"
    };
  }

  async function listRepoEntries(project, path = "", branchOverride = "") {
    const activeState = getActiveRepoReaderState(project);

    setStatus(EDITOR_STATUS_COPY.loading_content);

    if (activeState.mode === "token") {
      return fetchRepoContentsWithToken(project, path, branchOverride);
    }

    const directResult = await fetchRepoContentsDirect(project, path, branchOverride);
    if (directResult.ok) return directResult;

    return fetchRepoContentsWithToken(project, path, branchOverride);
  }

  function repoRawUrl(project, path = "", branchOverride = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = encodeURIComponent(String(branchOverride || liveRepoBranch(project)).trim() || "main");
    return `https://raw.githubusercontent.com/${encodeURIComponent(project.site_repo_owner)}/${encodeURIComponent(project.site_repo_name)}/${branch}/${fullPath}`;
  }

  // El <base> del iframe apunta a NUESTRA API (/api/repo-asset) para servir CSS/JS/imágenes
  // con el MIME correcto y sin depender de CDNs de terceros (raw los sirve como text/plain
  // y el navegador los bloquea, dejando la página sin estilos).
  function repoCdnUrl(project, path = "", branchOverride = "") {
    const base = repoBasePath(project);
    const fullPath = [base, path].filter(Boolean).join("/");
    const branch = String(branchOverride || liveRepoBranch(project)).trim() || "main";
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

  async function readRepoSnapshot(project, branch) {
    const result = await listRepoEntries(project, "", branch);
    const entries = result.entries;

    const htmlFiles = (Array.isArray(entries) ? entries : [])
      .filter(item => item.type === "file" && /\.html?$/i.test(item.name))
      .sort((a, b) => {
        if (a.name === "index.html") return -1;
        if (b.name === "index.html") return 1;
        return a.name.localeCompare(b.name);
      });

    if (!htmlFiles.length) throw new Error(`No encontramos archivos HTML en la rama ${branch}.`);

    const pages = htmlFiles.map((item, index) => ({
      id: item.path,
      slug: item.path,
      name: pageNameFromPath(item.path),
      path: item.path,
      is_home: item.name === "index.html" || index === 0,
      is_visible: true
    }));

    const htmlByPath = new Map();

    await Promise.all(pages.map(async page => {
      const htmlRes = await fetch(repoRawUrl(project, page.path, branch));
      if (!htmlRes.ok) throw new Error(`No pudimos leer ${page.path} en la rama ${branch}.`);
      const html = await htmlRes.text();
      htmlByPath.set(page.path, html);
    }));

    return { source: result.source, branch, pages, htmlByPath };
  }

  async function loadRepoPages(project) {
    const branch = liveRepoBranch(project);
    const snapshot = await readRepoSnapshot(project, branch);

    state.repoPages = snapshot.pages;
    state.pages = snapshot.pages;
    state.currentPageId = state.pages.find(p => p.is_home)?.id || state.pages[0].id;
    state.repoDrafts = new Map();

    snapshot.pages.forEach(page => {
      const html = snapshot.htmlByPath.get(page.path) || "";
      const draft = {
        id: page.id,
        path: page.path,
        original_html: html,
        edited_html: html,
        elements: {}
      };
      writeDraftMeta(draft, { asset_branch: branch });
      state.repoDrafts.set(page.id, draft);
    });

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
        writeDraftMeta(draft, { asset_branch: draftAssetBranch(draft) });
      });
    }

    setStatus(EDITOR_STATUS_COPY.content_ready);
  }

  function currentPage() {
    return state.pages.find(p => p.id === state.currentPageId) || null;
  }

  function draftForPage(pageId) {
    return state.repoDrafts.get(pageId) || null;
  }

  function currentDraft() {
    return draftForPage(state.currentPageId);
  }

  function currentDraftData() {
    return currentDraft()?.elements || {};
  }

  function openPage(pageId, keepSelection = false) {
    state.currentPageId = pageId;
    if (!keepSelection) {
      state.currentKey = "";
      state.currentType = "";
      state.currentRole = "";
      state.currentKind = "";
      state.currentSection = "";
      state.currentFuture = "";
      state.currentNodeMode = "active";
      state.currentNodeValue = "";
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
        ${safe(pageLabel(page.name))}
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
          ${safe(pageLabel(page.name))}
        </button>
      `).join("");
  }

  function loadFrame() {
    const frame = $("#editor-v2-frame");
    if (!frame) return;
    const currentDoc = frame.contentDocument;
    if (currentDoc) resetInlineImageLoader(currentDoc);
    state.frameReady = false;
    $("#editor-v2-current-page").textContent = pageLabel(currentPage()?.name) || "Página";
    $("#editor-v2-mode-badge").textContent = state.mode === "preview" ? "Vista previa" : "Modo edición";
    $("#editor-v2-current-state").textContent =
      state.mode === "preview"
        ? "Revisa la página como la verá un visitante."
        : "Selecciona un elemento de la página para editarlo.";

    renderPreviewNav();

    frame.classList.toggle("is-preview", state.mode === "preview");
    frame.classList.toggle("is-edit", state.mode === "edit");

    const draft = currentDraft();
    const html = prepareRepoHtml(draft?.edited_html || draft?.original_html || "");
    if (frame.srcdoc === html && frame.contentWindow) {
      frame.contentWindow.location.reload();
    } else {
      frame.srcdoc = html;
    }
  }


  function prepareRepoHtml(html) {
    const branch = draftAssetBranch(currentDraft());
    const base = repoCdnUrl(state.project, "", branch);
    const baseHref = base.endsWith("/") ? base : `${base}/`;
    const baseTag = `<base href="${safe(baseHref)}">`;

    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    }

    return `${baseTag}${html}`;
  }

  function renderNodeMetaSummary() {
    const rows = [
      state.currentType ? `Tipo: ${state.currentType}` : "",
      state.currentRole ? `Rol: ${state.currentRole}` : "",
      state.currentKind ? `Kind: ${state.currentKind}` : "",
      state.currentSection ? `Sección: ${state.currentSection}` : "",
      state.currentFuture ? `Future: ${state.currentFuture}` : ""
    ].filter(Boolean);

    if (!rows.length) return "";

    return `
      <div class="editor-node-meta" style="display:grid;gap:6px;margin-bottom:12px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.02);font-size:12px;">
        ${rows.map(row => `<div>${safe(row)}</div>`).join("")}
      </div>
    `;
  }

  function renderFutureNotice() {
    return `
      <div style="display:grid;gap:8px;padding:12px;border:1px dashed rgba(255,179,0,.6);border-radius:12px;background:rgba(255,179,0,.08);">
        <strong>Elemento reservado para una función futura</strong>
        <div>Clave: ${safe(state.currentKey || "sin-clave")}</div>
        <div>Tipo futuro: ${safe(state.currentFuture || "sin-definir")}</div>
        <div>Este nodo ya está preparado, pero todavía no tiene handler real en el editor.</div>
      </div>
    `;
  }

  function renderVideoStreamPendingNotice() {
    const draftValue = currentDraftData()[state.currentKey]?.value || state.currentNodeValue || "";
    const video = parseVideoStreamValue(draftValue);

    return `
      <div style="display:grid;gap:8px;padding:12px;border:1px dashed rgba(183,255,74,.45);border-radius:12px;background:rgba(183,255,74,.08);">
        <strong>video_stream ya quedó reconocido</strong>
        <div>Estado: ${safe(video.status || "empty")}</div>
        <div>Provider: ${safe(video.provider || "raw")}</div>
        <div>Playback: ${safe(video.playback_url || "sin-definir")}</div>
        <div>La UI de reemplazo entra en la siguiente fase.</div>
      </div>
    `;
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
    const value = data[state.currentKey]?.value ?? state.currentNodeValue;
    const type = state.currentType || data[state.currentKey]?.type || "text";

    if (state.currentNodeMode === "future") {
      fields.innerHTML = `${renderNodeMetaSummary()}${renderFutureNotice()}`;
      return;
    }

    fields.innerHTML = `${renderNodeMetaSummary()}${buildInlineFields(type, value)}`;
    bindSidebarFieldEvents(fields);
  }

  function bindSidebarFieldEvents(fields) {
    fields.querySelectorAll("[data-inline-field]").forEach(input => {
      input.addEventListener("input", e => {
        updateCurrentValue(e.currentTarget.value);
      });
    });

    const videoFields = fields.querySelectorAll("[data-video-embed-field]");
    if (videoFields.length) {
      const providerInput = fields.querySelector('[data-video-embed-field="provider"]');
      const urlInput = fields.querySelector('[data-video-embed-field="url"]');

      const commitVideo = () => {
        const next = {
          provider: sanitizeVideoProvider(providerInput?.value || ""),
          url: urlInput?.value || "",
          title: fields.querySelector('[data-video-embed-field="title"]')?.value || "",
          poster_url: fields.querySelector('[data-video-embed-field="poster_url"]')?.value || "",
          aspect_ratio: fields.querySelector('[data-video-embed-field="aspect_ratio"]')?.value || "16 / 9",
          autoplay: !!fields.querySelector('[data-video-embed-field="autoplay"]')?.checked,
          muted: !!fields.querySelector('[data-video-embed-field="muted"]')?.checked,
          loop: !!fields.querySelector('[data-video-embed-field="loop"]')?.checked,
          controls: !!fields.querySelector('[data-video-embed-field="controls"]')?.checked
        };

        updateCurrentValue(stringifyVideoEmbedValue(next));
      };

      videoFields.forEach(input => {
        if (!urlInput || !providerInput) return;

        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(eventName, evt => {
          commitVideo();
          evt.stopPropagation();
        });
      });
    }

    const videoStreamFields = fields.querySelectorAll("[data-video-stream-field]");
    if (videoStreamFields.length) {
      const commitVideoStream = (patch = {}) => {
        const currentRaw = currentDraftData()[state.currentKey]?.value ?? state.currentNodeValue ?? "";
        const current = parseVideoStreamValue(currentRaw);

        const next = {
          ...current,
          title: fields.querySelector('[data-video-stream-field="title"]')?.value || "",
          poster_url: fields.querySelector('[data-video-stream-field="poster_url"]')?.value || "",
          aspect_ratio: fields.querySelector('[data-video-stream-field="aspect_ratio"]')?.value || "16 / 9",
          autoplay: !!fields.querySelector('[data-video-stream-field="autoplay"]')?.checked,
          muted: !!fields.querySelector('[data-video-stream-field="muted"]')?.checked,
          loop: !!fields.querySelector('[data-video-stream-field="loop"]')?.checked,
          controls: !!fields.querySelector('[data-video-stream-field="controls"]')?.checked,
          ...patch
        };

        updateCurrentValue(stringifyVideoStreamValue(next));
      };

      videoStreamFields.forEach(input => {
        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(eventName, evt => {
          commitVideoStream();
          evt.stopPropagation();
        });
      });

      fields.querySelectorAll(".editor-video-stream-input").forEach(input => {
        input.addEventListener("change", e => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          uploadVideoStream(file);
          e.currentTarget.value = "";
        });
      });

      fields.querySelectorAll(".editor-video-stream-remove-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const currentRaw = currentDraftData()[state.currentKey]?.value ?? state.currentNodeValue ?? "";
          const current = parseVideoStreamValue(currentRaw);

          updateCurrentValue(stringifyVideoStreamValue({
            ...current,
            asset_id: "",
            status: "empty",
            playback_url: ""
          }));
          renderSidebar();
        });
      });
    }

    fields.querySelectorAll(".editor-photo-input").forEach(input => {
      input.addEventListener("change", e => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;
        uploadPhoto(file);
        e.currentTarget.value = "";
      });
    });

    fields.querySelectorAll(".editor-photo-edit-btn").forEach(btn => {
      btn.addEventListener("click", () => openPhotoEditor());
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

  function parseVideoUrl(url = "") {
    const raw = String(url || "").trim();
    if (!raw) return null;
    try {
      return new URL(raw);
    } catch {
      try {
        return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      } catch {
        return null;
      }
    }
  }

  function extractYouTubeVideoId(url = "") {
    const raw = String(url || "").trim();
    if (!raw) return "";

    const parsed = parseVideoUrl(raw);
    if (parsed) {
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      const parts = parsed.pathname.split("/").filter(Boolean);

      if (host === "youtu.be") return parts[0] || "";

      if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host.endsWith(".youtube.com")
      ) {
        const byQuery = parsed.searchParams.get("v");
        if (byQuery) return byQuery;

        if (["embed", "shorts", "live"].includes(parts[0])) {
          return parts[1] || "";
        }
      }
    }

    const match = raw.match(/(?:youtube\.com\/watch.*?[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/i);
    return match?.[1] || "";
  }

  function extractVimeoVideoId(url = "") {
    const raw = String(url || "").trim();
    if (!raw) return "";

    const parsed = parseVideoUrl(raw);
    if (parsed) {
      const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      if (host === "vimeo.com" || host === "player.vimeo.com" || host.endsWith(".vimeo.com")) {
        const parts = parsed.pathname.split("/").filter(Boolean).reverse();
        const numeric = parts.find(part => /^\d{6,}$/.test(part));
        if (numeric) return numeric;
      }
    }

    const match = raw.match(/vimeo\.com\/.*?(\d{6,})(?:$|[/?#])/i);
    return match?.[1] || "";
  }

  function sanitizeVideoProvider(value = "") {
    const raw = String(value || "").trim().toLowerCase();
    return raw === "youtube" || raw === "vimeo" || raw === "external" ? raw : "";
  }

  function detectVideoProvider(url = "") {
    if (extractYouTubeVideoId(url)) return "youtube";
    if (extractVimeoVideoId(url)) return "vimeo";
    return String(url || "").trim() ? "external" : "";
  }

  function resolveVideoProvider(model = {}) {
    const url = String(model?.url || "").trim();
    const explicit = sanitizeVideoProvider(model?.provider || "");
    const detected = detectVideoProvider(url);

    if (!explicit) return detected;
    if (explicit === "external") return "external";
    if (explicit === "youtube") return extractYouTubeVideoId(url) ? "youtube" : (detected || "external");
    if (explicit === "vimeo") return extractVimeoVideoId(url) ? "vimeo" : (detected || "external");
    return detected;
  }

  function normalizeVideoAspectRatio(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "16 / 9";

    const match = raw.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
    if (match) return `${match[1]} / ${match[2]}`;

    return "16 / 9";
  }

  function defaultVideoEmbedModel(source = {}) {
    const base = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    const url = String(base.url || "").trim();

    return {
      kind: "video_embed",
      provider: sanitizeVideoProvider(base.provider || ""),
      url,
      title: String(base.title || "").trim(),
      poster_url: String(base.poster_url || "").trim(),
      aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || "16 / 9"),
      autoplay: Boolean(base.autoplay),
      muted: Boolean(base.muted),
      loop: Boolean(base.loop),
      controls: base.controls !== false
    };
  }

  function parseVideoEmbedValue(rawValue) {
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      return defaultVideoEmbedModel(rawValue);
    }

    const raw = String(rawValue || "").trim();
    if (!raw) return defaultVideoEmbedModel({});

    try {
      return defaultVideoEmbedModel(JSON.parse(raw));
    } catch {
      return defaultVideoEmbedModel({ url: raw });
    }
  }

  function stringifyVideoEmbedValue(value) {
    return JSON.stringify(defaultVideoEmbedModel(value));
  }

  function sanitizeVideoStreamProvider(value = "") {
    const raw = String(value || "").trim().toLowerCase();
    return raw === "cloudflare_stream" || raw === "raw" ? raw : "raw";
  }

  function sanitizeVideoStreamStatus(value = "", hasPlayback = false) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "empty" || raw === "processing" || raw === "ready" || raw === "failed") return raw;
    return hasPlayback ? "ready" : "empty";
  }

  function defaultVideoStreamModel(source = {}) {
    const base = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    const playbackUrl = String(base.playback_url || base.source_url || base.url || "").trim();

    return {
      kind: "video_stream",
      asset_id: String(base.asset_id || "").trim(),
      provider: sanitizeVideoStreamProvider(base.provider || ""),
      status: sanitizeVideoStreamStatus(base.status || "", !!playbackUrl),
      playback_url: playbackUrl,
      poster_url: String(base.poster_url || "").trim(),
      title: String(base.title || "").trim(),
      aspect_ratio: normalizeVideoAspectRatio(base.aspect_ratio || "16 / 9"),
      autoplay: Boolean(base.autoplay),
      muted: Boolean(base.muted),
      loop: Boolean(base.loop),
      controls: base.controls !== false
    };
  }

  function parseVideoStreamValue(rawValue) {
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      return defaultVideoStreamModel(rawValue);
    }

    const raw = String(rawValue || "").trim();
    if (!raw) return defaultVideoStreamModel({});

    try {
      return defaultVideoStreamModel(JSON.parse(raw));
    } catch {
      return defaultVideoStreamModel({
        playback_url: raw,
        provider: "raw"
      });
    }
  }

  function stringifyVideoStreamValue(value) {
    return JSON.stringify(defaultVideoStreamModel(value));
  }

  function readVideoStreamNodeValue(node) {
    if (!node || node.tagName !== "VIDEO") return "";

    const sourceNode = node.querySelector("source[src]");
    const playbackUrl =
      sourceNode?.getAttribute("src") ||
      node.getAttribute("src") ||
      node.currentSrc ||
      "";

    return stringifyVideoStreamValue({
      kind: "video_stream",
      provider: "raw",
      status: playbackUrl ? "ready" : "empty",
      playback_url: playbackUrl,
      poster_url: node.getAttribute("poster") || "",
      title: node.getAttribute("title") || node.getAttribute("aria-label") || "",
      aspect_ratio: node.getAttribute("data-eb-aspect-ratio") || "16 / 9",
      autoplay: node.hasAttribute("autoplay"),
      muted: node.hasAttribute("muted"),
      loop: node.hasAttribute("loop"),
      controls: node.hasAttribute("controls")
    });
  }

  function videoStreamStatusLabel(value = "") {
    if (value === "processing") return "Preparando video...";
    if (value === "failed") return "No pudimos preparar este video";
    if (value === "ready") return "Video listo";
    return "Sin video";
  }

  function renderVideoStreamEditorCard(model) {
    const video = defaultVideoStreamModel(model);
    const ratio = safe(video.aspect_ratio || "16 / 9");
    const title = safe(video.title || "Video");
    const posterUrl = String(video.poster_url || "").trim();
    const statusText = safe(videoStreamStatusLabel(video.status));
    const providerText = safe(video.provider === "cloudflare_stream" ? "Stream" : "Archivo");
    const urlText = safe(String(video.playback_url || "").trim() || "Sin video cargado todavía");
    const flags = [
      video.muted ? "Muted" : "",
      video.loop ? "Loop" : "",
      video.controls ? "Controles" : "Sin controles"
    ].filter(Boolean);

    return `
      <div
        class="eb-video-stream-editor-card"
        data-eb-video-preview="edit"
        style="position:relative;display:grid;width:100%;aspect-ratio:${ratio};border-radius:18px;overflow:hidden;background:#0c1a16;color:#fff;"
      >
        ${posterUrl ? `<img src="${safe(posterUrl)}" alt="${title}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">` : ""}
        <div style="position:absolute;inset:0;background:${posterUrl ? "linear-gradient(180deg, rgba(12,26,22,.12) 0%, rgba(12,26,22,.82) 100%)" : "linear-gradient(180deg, #102823 0%, #0c1a16 100%)"};"></div>
        <div style="position:absolute;top:12px;left:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">Modo edición</span>
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(183,255,74,.92);color:#102823;font:900 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">${statusText}</span>
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">${providerText}</span>
        </div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;">
          <span style="display:grid;place-items:center;width:72px;height:72px;border-radius:999px;background:rgba(12,26,22,.62);box-shadow:0 12px 30px rgba(0,0,0,.24);">
            <span style="display:block;width:0;height:0;margin-left:6px;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:22px solid #fff;"></span>
          </span>
        </div>
        <div style="position:absolute;left:14px;right:14px;bottom:14px;display:grid;gap:6px;">
          <strong style="font:800 18px/1.1 'Manrope',sans-serif;">${title}</strong>
          <span style="font:700 12px/1.45 'DM Sans',sans-serif;opacity:.92;word-break:break-word;">${urlText}</span>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(video.aspect_ratio || "16 / 9")}</span>
            ${flags.map(flag => `<span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(flag)}</span>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function videoStreamFrame(node) {
    return node?.closest(".video-frame, .site-video-frame") || node?.parentElement || null;
  }

  function ensureVideoStreamEditorOverlay(node, model) {
    const frame = videoStreamFrame(node);
    const doc = node?.ownerDocument;
    const win = doc?.defaultView;
    if (!frame || !doc || !win) return null;

    if (win.getComputedStyle(frame).position === "static") {
      frame.dataset.ebVideoStreamPositioned = "1";
      frame.style.position = "relative";
    }

    let overlay = frame.querySelector('[data-eb-video-stream-overlay="1"]');
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.setAttribute("data-eb-video-stream-overlay", "1");
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2";
      overlay.style.pointerEvents = "none";
      frame.appendChild(overlay);
    }

    overlay.innerHTML = renderVideoStreamEditorCard(model);
    return overlay;
  }

  function removeVideoStreamEditorOverlay(node) {
    const frame = videoStreamFrame(node);
    if (!frame) return;
    frame.querySelectorAll('[data-eb-video-stream-overlay="1"]').forEach(overlay => overlay.remove());
  }

  function applyVideoStreamDomState(node, model, mode = "preview") {
    if (!node || node.tagName !== "VIDEO") return;

    const video = defaultVideoStreamModel(model);
    const encodedValue = encodeEditorValueAttr(stringifyVideoStreamValue(video));
    const playbackUrl = String(video.playback_url || "").trim();
    const sourceNode = node.querySelector("source") || node.insertBefore(node.ownerDocument.createElement("source"), node.firstChild);
    const currentSrc = sourceNode.getAttribute("src") || node.getAttribute("src") || "";
    const frame = videoStreamFrame(node);

    node.setAttribute("data-eb-value", encodedValue);
    node.setAttribute("data-eb-aspect-ratio", video.aspect_ratio || "16 / 9");
    node.setAttribute("data-eb-video-status", video.status || "empty");

    if (video.title) {
      node.setAttribute("title", video.title);
      node.setAttribute("aria-label", video.title);
    } else {
      node.removeAttribute("title");
      node.removeAttribute("aria-label");
    }

    if (video.poster_url) node.setAttribute("poster", video.poster_url);
    else node.removeAttribute("poster");

    if (video.muted) node.setAttribute("muted", "");
    else node.removeAttribute("muted");

    if (video.loop) node.setAttribute("loop", "");
    else node.removeAttribute("loop");

    node.setAttribute("playsinline", "");
    node.setAttribute("preload", "metadata");
    node.style.display = "block";
    node.style.width = "100%";
    node.style.height = "100%";
    node.style.background = "#000";

    if (frame) frame.style.aspectRatio = video.aspect_ratio || "16 / 9";

    if (!playbackUrl) {
      sourceNode.removeAttribute("src");
      node.removeAttribute("src");
      try { node.load(); } catch {}
    } else if (currentSrc !== playbackUrl) {
      sourceNode.setAttribute("src", playbackUrl);
      node.removeAttribute("src");
      try { node.load(); } catch {}
    }

    if (mode === "edit") {
      node.removeAttribute("controls");
      node.removeAttribute("autoplay");
      try { node.pause(); } catch {}
      ensureVideoStreamEditorOverlay(node, video);
      return;
    }

    removeVideoStreamEditorOverlay(node);

    if (video.autoplay) node.setAttribute("autoplay", "");
    else node.removeAttribute("autoplay");

    if (video.controls) node.setAttribute("controls", "");
    else node.removeAttribute("controls");
  }

  function syncVideoStreamNodes(doc) {
    if (!doc || state.mode !== "edit") return;

    doc.querySelectorAll('[data-eb-editable="video_stream"]').forEach(node => {
      if (node.tagName !== "VIDEO") return;

      const key = node.getAttribute("data-eb-key") || "";
      const draftValue = currentDraftData()[key]?.value || "";
      const encodedValue = decodeEditorValueAttr(node.getAttribute("data-eb-value") || "");
      const rawValue = draftValue || encodedValue || readVideoStreamNodeValue(node);

      applyVideoStreamDomState(node, parseVideoStreamValue(rawValue), "edit");
    });
  }

  function encodeEditorValueAttr(value = "") {
    return encodeURIComponent(String(value || ""));
  }

  function decodeEditorValueAttr(value = "") {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function renderVideoEmbedPreview(model) {
    const video = defaultVideoEmbedModel(model);
    const resolvedProvider = resolveVideoProvider(video);
    const title = safe(video.title || "Video");
    const ratio = safe(video.aspect_ratio || "16 / 9");
    const ratioToken = safe(String(video.aspect_ratio || "16 / 9").replace(/\s+/g, ""));
    const providerToken = safe(resolvedProvider || "");
    const youtubeId = extractYouTubeVideoId(video.url);
    const vimeoId = extractVimeoVideoId(video.url);

    if (resolvedProvider === "youtube" && youtubeId) {
      const params = new URLSearchParams({
        autoplay: video.autoplay ? "1" : "0",
        controls: video.controls ? "1" : "0",
        rel: "0",
        playsinline: "1"
      });

      if (video.autoplay && !video.muted) {
        params.set("mute", "1");
        params.set("autoplay", "1");
      }

      if (video.loop) {
        params.set("loop", "1");
        params.set("playlist", youtubeId);
      }

      if (video.muted) params.set("mute", "1");

      return `
        <div class="site-video-frame" data-video-provider="${providerToken}" data-video-ratio="${ratioToken}" style="aspect-ratio:${ratio};">
          <iframe src="https://www.youtube.com/embed/${safe(youtubeId)}?${safe(params.toString())}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    }

    if (resolvedProvider === "vimeo" && vimeoId) {
      const params = new URLSearchParams({
        autoplay: video.autoplay ? "1" : "0",
        loop: video.loop ? "1" : "0",
        muted: video.muted ? "1" : "0"
      });

      if (video.autoplay && !video.muted) {
        params.set("muted", "1");
        params.set("autoplay", "1");
      }

      return `
        <div class="site-video-frame" data-video-provider="${providerToken}" data-video-ratio="${ratioToken}" style="aspect-ratio:${ratio};">
          <iframe src="https://player.vimeo.com/video/${safe(vimeoId)}?${safe(params.toString())}" title="${title}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    }

    if (video.url && video.poster_url) {
      return `
        <a class="site-video-poster-link" href="${safe(video.url)}" target="_blank" rel="noopener">
          <img class="site-video-poster" src="${safe(video.poster_url)}" alt="${title}" loading="lazy">
          <span class="site-video-link">Ver video</span>
        </a>
      `;
    }

    if (video.url) {
      return `<a class="site-video-link" href="${safe(video.url)}" target="_blank" rel="noopener">Ver video</a>`;
    }

    return `<div class="site-media-box">Sin video todavía.</div>`;
  }

  function videoProviderLabel(value = "") {
    if (value === "youtube") return "YouTube";
    if (value === "vimeo") return "Vimeo";
    if (value === "external") return "Enlace externo";
    return "Video";
  }

  function videoProviderSummary(model) {
    const explicit = sanitizeVideoProvider(model?.provider || "");
    const resolved = resolveVideoProvider(model || {});
    const main = explicit || resolved || "";

    if (!main) return "Sin proveedor";
    if (!explicit || explicit === resolved || !resolved) return videoProviderLabel(main);
    return `${videoProviderLabel(explicit)} · detectado: ${videoProviderLabel(resolved)}`;
  }

  function videoEditPosterUrl(model) {
    const video = defaultVideoEmbedModel(model);
    if (video.poster_url) return video.poster_url;
    const youtubeId = extractYouTubeVideoId(video.url);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    return "";
  }

  function renderVideoEmbedEditorCard(model) {
    const video = defaultVideoEmbedModel(model);
    const ratio = safe(video.aspect_ratio || "16 / 9");
    const title = safe(video.title || "Video");
    const posterUrl = videoEditPosterUrl(video);
    const providerText = safe(videoProviderSummary(video));
    const urlText = safe(String(video.url || "").trim() || "Sin URL todavía");
    const flags = [
      video.autoplay ? "Autoplay" : "",
      video.muted ? "Muted" : "",
      video.loop ? "Loop" : "",
      video.controls ? "Controles" : "Sin controles"
    ].filter(Boolean);

    return `
      <div
        class="eb-video-editor-card"
        data-eb-video-preview="edit"
        style="position:relative;display:grid;width:100%;aspect-ratio:${ratio};border-radius:18px;overflow:hidden;background:#0c1a16;color:#fff;"
      >
        ${posterUrl ? `<img src="${safe(posterUrl)}" alt="${title}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">` : ""}
        <div style="position:absolute;inset:0;background:${posterUrl ? "linear-gradient(180deg, rgba(12,26,22,.12) 0%, rgba(12,26,22,.78) 100%)" : "linear-gradient(180deg, #102823 0%, #0c1a16 100%)"};"></div>
        <div style="position:absolute;top:12px;left:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">Modo edición</span>
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(183,255,74,.92);color:#102823;font:900 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">${providerText}</span>
        </div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;">
          <span style="display:grid;place-items:center;width:72px;height:72px;border-radius:999px;background:rgba(12,26,22,.62);box-shadow:0 12px 30px rgba(0,0,0,.24);">
            <span style="display:block;width:0;height:0;margin-left:6px;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:22px solid #fff;"></span>
          </span>
        </div>
        <div style="position:absolute;left:14px;right:14px;bottom:14px;display:grid;gap:6px;">
          <strong style="font:800 18px/1.1 'Manrope',sans-serif;">${title}</strong>
          <span style="font:700 12px/1.45 'DM Sans',sans-serif;opacity:.92;word-break:break-word;">${urlText}</span>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(video.aspect_ratio || "16 / 9")}</span>
            ${flags.map(flag => `<span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(flag)}</span>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function syncVideoEmbedNodes(doc) {
    if (!doc || state.mode !== "edit") return;

    doc.querySelectorAll('[data-eb-editable="video_embed"]').forEach(node => {
      const encodedValue = node.getAttribute("data-eb-value") || "";
      if (node.dataset.ebRenderMode === "edit" && node.dataset.ebRenderValue === encodedValue) return;

      node.dataset.ebRenderMode = "edit";
      node.dataset.ebRenderValue = encodedValue;
node.innerHTML = renderVideoEmbedEditorCard(parseVideoEmbedValue(decodeEditorValueAttr(encodedValue)));
    });
  }

  function videoProviderLabel(value = "") {
    if (value === "youtube") return "YouTube";
    if (value === "vimeo") return "Vimeo";
    if (value === "external") return "Enlace externo";
    return "Video";
  }

  function videoProviderSummary(model) {
    const explicit = sanitizeVideoProvider(model?.provider || "");
    const resolved = resolveVideoProvider(model || {});
    const main = explicit || resolved || "";

    if (!main) return "Sin proveedor";
    if (!explicit || explicit === resolved || !resolved) return videoProviderLabel(main);
    return `${videoProviderLabel(explicit)} / detectado: ${videoProviderLabel(resolved)}`;
  }

  function videoEditPosterUrl(model) {
    const video = defaultVideoEmbedModel(model);
    if (video.poster_url) return video.poster_url;
    const youtubeId = extractYouTubeVideoId(video.url);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    return "";
  }

  function renderVideoEmbedEditorCard(model) {
    const video = defaultVideoEmbedModel(model);
    const ratio = safe(video.aspect_ratio || "16 / 9");
    const title = safe(video.title || "Video");
    const posterUrl = videoEditPosterUrl(video);
    const providerText = safe(videoProviderSummary(video));
    const urlText = safe(String(video.url || "").trim() || "Sin URL todavia");
    const flags = [
      video.autoplay ? "Autoplay" : "",
      video.muted ? "Muted" : "",
      video.loop ? "Loop" : "",
      video.controls ? "Controles" : "Sin controles"
    ].filter(Boolean);

    return `
      <div
        class="eb-video-editor-card"
        data-eb-video-preview="edit"
        style="position:relative;display:grid;width:100%;aspect-ratio:${ratio};border-radius:18px;overflow:hidden;background:#0c1a16;color:#fff;"
      >
        ${posterUrl ? `<img src="${safe(posterUrl)}" alt="${title}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">` : ""}
        <div style="position:absolute;inset:0;background:${posterUrl ? "linear-gradient(180deg, rgba(12,26,22,.12) 0%, rgba(12,26,22,.78) 100%)" : "linear-gradient(180deg, #102823 0%, #0c1a16 100%)"};"></div>
        <div style="position:absolute;top:12px;left:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">Modo edicion</span>
          <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(183,255,74,.92);color:#102823;font:900 11px/1 'DM Sans',sans-serif;letter-spacing:.03em;text-transform:uppercase;">${providerText}</span>
        </div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;">
          <span style="display:grid;place-items:center;width:72px;height:72px;border-radius:999px;background:rgba(12,26,22,.62);box-shadow:0 12px 30px rgba(0,0,0,.24);">
            <span style="display:block;width:0;height:0;margin-left:6px;border-top:14px solid transparent;border-bottom:14px solid transparent;border-left:22px solid #fff;"></span>
          </span>
        </div>
        <div style="position:absolute;left:14px;right:14px;bottom:14px;display:grid;gap:6px;">
          <strong style="font:800 18px/1.1 'Manrope',sans-serif;">${title}</strong>
          <span style="font:700 12px/1.45 'DM Sans',sans-serif;opacity:.92;word-break:break-word;">${urlText}</span>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(video.aspect_ratio || "16 / 9")}</span>
            ${flags.map(flag => `<span style="display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.14);font:800 11px/1 'DM Sans',sans-serif;">${safe(flag)}</span>`).join("")}
          </div>
        </div>
      </div>
    `;
  }

  function syncVideoEmbedNodes(doc) {
    if (!doc || state.mode !== "edit") return;

    doc.querySelectorAll('[data-eb-editable="video_embed"]').forEach(node => {
      const encodedValue = node.getAttribute("data-eb-value") || "";
      if (node.dataset.ebRenderMode === "edit" && node.dataset.ebRenderValue === encodedValue) return;

      node.dataset.ebRenderMode = "edit";
      node.dataset.ebRenderValue = encodedValue;
      node.innerHTML = renderVideoEmbedEditorCard(
        parseVideoEmbedValue(decodeEditorValueAttr(encodedValue))
      );
    });
  }

  function buildVideoEmbedDraftFromSection(data = {}) {
    return stringifyVideoEmbedValue(defaultVideoEmbedModel({
      ...(data.video_embed && typeof data.video_embed === "object" ? data.video_embed : {}),
      url: data.video_url || data.url || "",
      title: data.title || data.heading || "",
      poster_url: data.poster_url || "",
      aspect_ratio: data.video_aspect_ratio || "16 / 9"
    }));
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
          <span>Foto</span>
          <div class="editor-image-picker">
            <label class="button button-light editor-photo-btn">Elegir foto<input type="file" class="editor-photo-input" accept="image/*" hidden></label>
            <label class="button button-light editor-photo-btn">Tomar foto<input type="file" class="editor-photo-input" accept="image/*" capture="environment" hidden></label>
          </div>
          <button type="button" class="button button-light editor-photo-edit-btn">Ajustar imagen</button>
          <small>Toca "Elegir foto" o "Tomar foto" y la imagen se agrega a tu página.</small>
        </label>
      `;
    }

    if (type === "video_embed") {
      const video = parseVideoEmbedValue(value);
      return `
        <label class="editor-field">
          <span>Proveedor</span>
          <select data-video-embed-field="provider">
            <option value="">Detectar por URL</option>
            <option value="youtube" ${video.provider === "youtube" ? "selected" : ""}>YouTube</option>
            <option value="vimeo" ${video.provider === "vimeo" ? "selected" : ""}>Vimeo</option>
            <option value="external" ${video.provider === "external" ? "selected" : ""}>Enlace externo</option>
          </select>
        </label>

        <label class="editor-field">
          <span>URL del video</span>
          <input type="text" data-video-embed-field="url" value="${safe(video.url)}" placeholder="https://...">
        </label>

        <label class="editor-field">
          <span>Título interno</span>
          <input type="text" data-video-embed-field="title" value="${safe(video.title)}" placeholder="Video principal">
        </label>

        <label class="editor-field">
          <span>Poster opcional</span>
          <input type="text" data-video-embed-field="poster_url" value="${safe(video.poster_url)}" placeholder="https://...">
        </label>

        <label class="editor-field">
          <span>Relación</span>
          <select data-video-embed-field="aspect_ratio">
            <option value="16 / 9" ${video.aspect_ratio === "16 / 9" ? "selected" : ""}>16:9</option>
            <option value="9 / 16" ${video.aspect_ratio === "9 / 16" ? "selected" : ""}>9:16</option>
          </select>
          <small>YouTube/Vimeo: 16:9 recomendado. 9:16 se deja disponible, pero puede recortar controles del player.</small>
        </label>

        <label class="check-line"><input type="checkbox" data-video-embed-field="autoplay" ${video.autoplay ? "checked" : ""}> Autoplay</label>
        <label class="check-line"><input type="checkbox" data-video-embed-field="muted" ${video.muted ? "checked" : ""}> Muted</label>
        <label class="check-line"><input type="checkbox" data-video-embed-field="loop" ${video.loop ? "checked" : ""}> Loop</label>
        <label class="check-line"><input type="checkbox" data-video-embed-field="controls" ${video.controls ? "checked" : ""}> Mostrar controles</label>

        <small>Este tipo guarda configuración del embed. No sube binarios ni copia videos al repo.</small>
      `;
    }

    if (type === "video_stream") {
      const video = parseVideoStreamValue(value);
      const statusLabel = ({
        empty: "Sin video",
        processing: "Preparando video...",
        ready: "Video listo",
        failed: "No pudimos preparar este video"
      })[video.status] || "Sin video";

      return `
        <label class="editor-field">
          <span>Estado</span>
          <input type="text" value="${safe(statusLabel)}" readonly>
        </label>

        <label class="editor-field">
          <span>Video</span>
          <div class="editor-image-picker">
            <label class="button button-light editor-video-stream-pick-btn">Reemplazar video<input type="file" class="editor-video-stream-input" accept="video/*" hidden></label>
          </div>
          <small>${safe(video.playback_url ? "Ya hay un video cargado para este espacio." : "Todavía no hay un video cargado en este espacio.")}</small>
        </label>

        <button type="button" class="button button-light editor-video-stream-remove-btn">Quitar video</button>

        <label class="editor-field">
          <span>Título interno</span>
          <input type="text" data-video-stream-field="title" value="${safe(video.title)}" placeholder="Video principal">
        </label>

        <label class="editor-field">
          <span>Poster opcional</span>
          <input type="text" data-video-stream-field="poster_url" value="${safe(video.poster_url)}" placeholder="https://...">
        </label>

        <label class="editor-field">
          <span>Relación</span>
          <select data-video-stream-field="aspect_ratio">
            <option value="16 / 9" ${video.aspect_ratio === "16 / 9" ? "selected" : ""}>16:9</option>
            <option value="9 / 16" ${video.aspect_ratio === "9 / 16" ? "selected" : ""}>9:16</option>
          </select>
        </label>

        <label class="check-line"><input type="checkbox" data-video-stream-field="autoplay" ${video.autoplay ? "checked" : ""}> Autoplay</label>
        <label class="check-line"><input type="checkbox" data-video-stream-field="muted" ${video.muted ? "checked" : ""}> Muted</label>
        <label class="check-line"><input type="checkbox" data-video-stream-field="loop" ${video.loop ? "checked" : ""}> Loop</label>
        <label class="check-line"><input type="checkbox" data-video-stream-field="controls" ${video.controls ? "checked" : ""}> Mostrar controles</label>

        <label class="editor-field">
          <span>URL actual</span>
          <input type="text" value="${safe(video.playback_url)}" readonly placeholder="Se llenará al subir un video">
        </label>

        <small>Este tipo reemplaza el video del bloque. No copia binarios al repo.</small>
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

  function normalizeDraftValue(type, rawValue) {
    if (type === "video_embed") {
      return stringifyVideoEmbedValue(parseVideoEmbedValue(rawValue));
    }

    if (type === "video_stream") {
      return stringifyVideoStreamValue(parseVideoStreamValue(rawValue));
    }

    if ((type === "image" || type === "link") &&
        rawValue && !/^(https?:\/\/|data:|\/|#)/i.test(rawValue)) {
      return "https://" + rawValue;
    }

    return rawValue;
  }

  function updateCurrentValue(rawValue, photoMeta) {
    const draft = currentDraft();
    if (!draft || !state.currentKey) return;

    rawValue = normalizeDraftValue(state.currentType, rawValue);

    const entry = {
      type: state.currentType || "text",
      value: rawValue
    };
    if (photoMeta) entry.meta = photoMeta;

    draft.elements = draft.elements || {};
    draft.elements[state.currentKey] = entry;

    const stateEl = $("#editor-v2-current-state");
    if (stateEl) stateEl.textContent = "Tienes cambios sin publicar en esta página.";
    applyDraftToFrame();
    scheduleHistory();
    scheduleAutoSave();
  }

  // ---- Deshacer / rehacer de la sesión (máx 30 pasos en memoria) ----
  const HISTORY_MAX = 120;

  function snapshotDraft() {
    const d = currentDraft();
    if (!d) return null;
    return {
      page: state.currentPageId,
      html: d.edited_html || "",
      elements: JSON.parse(JSON.stringify(d.elements || {}))
    };
  }

  function updateUndoButtons() {
    const undo = $("#editor-v2-undo");
    const redo = $("#editor-v2-redo");
    if (!undo || !redo) return;
    undo.disabled = state.historyIndex <= 0;
    redo.disabled = state.historyIndex >= state.history.length - 1;
  }

  function pushHistory() {
    const snap = snapshotDraft();
    if (!snap) return;
    const top = state.history[state.historyIndex] || null;
    if (top && JSON.stringify(snap) === JSON.stringify(top)) return;
    if (state.historyIndex >= 0 && state.historyIndex < state.history.length - 1) {
      state.history.length = state.historyIndex + 1;
    }
    state.history.push(snap);
    if (state.history.length > HISTORY_MAX) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoButtons();
  }

  let historyTimer = 0;
  function scheduleHistory() {
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      historyTimer = 0;
      const cur = snapshotDraft();
      const top = state.history[state.historyIndex] || null;
      if (cur && top && JSON.stringify(cur) === JSON.stringify(top)) return;
      if (cur) pushHistory();
      updateUndoButtons();
    }, 450);
  }

  function restoreSnapshot(snap) {
    if (!snap) return;
    const d = draftForPage(snap.page);
    if (!d) return;
    d.edited_html = snap.html || "";
    d.elements = JSON.parse(JSON.stringify(snap.elements || {}));
    const samePage = snap.page === state.currentPageId;
    const keepKey = samePage ? state.currentKey : "";
    const keepType = samePage ? state.currentType : "";
    state.currentPageId = snap.page;
    state.currentKey = "";
    state.currentType = "";
    state.currentRole = "";
    state.currentKind = "";
    state.currentSection = "";
    state.currentFuture = "";
    state.currentNodeMode = "active";
    state.currentNodeValue = "";
    openPage(snap.page);
    if (keepKey) {
      state.currentKey = keepKey;
      state.currentType = keepType;
      renderSidebar();
    }
  }

  function undoAction() {
    if (state.historyIndex <= 0) return;
    state.historyIndex--;
    restoreSnapshot(state.history[state.historyIndex]);
    setStatus(EDITOR_STATUS_COPY.undo_done);
    updateUndoButtons();
  }

  function redoAction() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex++;
    restoreSnapshot(state.history[state.historyIndex]);
    setStatus(EDITOR_STATUS_COPY.redo_done);
    updateUndoButtons();
  }

  // Restaurar la versión base (la original del sitio).
  async function restoreBase() {
    const branch = baseRepoBranch();
    if (!confirm("¿Usar la versión base?\n\nSe cargarán los cambios base del proyecto. Nada se publicará hasta que pulses Publicar.")) return;

    const baseBtn = $("#editor-v2-base");
    if (baseBtn) baseBtn.disabled = true;

    setStatus(EDITOR_STATUS_COPY.loading_base);
    setFrameLoading("Cargando versión base...");

    try {
      const snapshot = await readRepoSnapshot(state.project, branch);
      const missing = state.pages
        .map(page => page.path)
        .filter(path => !snapshot.htmlByPath.has(path));

      if (missing.length) {
        throw new Error("BASE_PAGES_MISSING");
      }

      pushHistory();

      state.repoDrafts.forEach(draft => {
        const html = snapshot.htmlByPath.get(draft.path);
        if (!html) return;
        draft.edited_html = html;
        draft.elements = {};
        writeDraftMeta(draft, { asset_branch: branch });
      });

      const savedAll = await saveAllRepoDrafts(true);
      if (!savedAll) {
        hideFrameLoading();
        return;
      }

      state.currentKey = "";
      state.currentType = "";
      state.currentRole = "";
      state.currentKind = "";
      state.currentSection = "";
      state.currentFuture = "";
      state.currentNodeMode = "active";
      state.currentNodeValue = "";
      loadFrame();
      renderSidebar();
      pushHistory();
      updateUndoButtons();
      setStatus(EDITOR_STATUS_COPY.base_loaded, "success");
    } catch (error) {
      console.error(error);
      hideFrameLoading();
      showEditorError("EB-BASE-001");
    } finally {
      if (baseBtn) baseBtn.disabled = false;
    }
  }

  function ensureEditorRuntimeStyles(doc) {
    if (!doc || doc.getElementById("eb-editor-runtime-style")) return;

    const style = doc.createElement("style");
    style.id = "eb-editor-runtime-style";
    style.textContent = `
      [data-eb-editable] {
        outline: 2px dashed rgba(183,255,74,.75) !important;
        outline-offset: 3px !important;
        cursor: pointer !important;
      }

      [data-eb-future]:not([data-eb-editable]) {
        outline: 2px dashed rgba(255,179,0,.85) !important;
        outline-offset: 3px !important;
        cursor: pointer !important;
      }

      [data-eb-editable] iframe {
        pointer-events: none !important;
      }

      .editor-inline-image-loader {
        position: absolute !important;
        z-index: 9999 !important;
        display: none !important;
        place-items: center !important;
        pointer-events: none !important;
        box-sizing: border-box !important;
        background: transparent !important;
        overflow: hidden !important;
      }

      .editor-inline-image-loader.is-visible {
        display: grid !important;
      }

      .editor-frame-spinner {
        display: block !important;
        width: 46px !important;
        height: 46px !important;
        border-radius: 50% !important;
        border: 4px solid rgba(16,40,35,.14) !important;
        border-top-color: #b7ff4a !important;
        animation: eb-inline-image-spin .8s linear infinite !important;
        will-change: transform !important;
      }

      .editor-inline-image-loader .editor-frame-spinner {
        width: 30px !important;
        height: 30px !important;
        border-width: 3px !important;
        background: transparent !important;
        box-shadow: none !important;
      }

      .editor-image-loading-target {
        opacity: 1 !important;
        transition: none !important;
      }

      @keyframes eb-inline-image-spin {
        to { transform: rotate(360deg); }
      }
    `;

    (doc.head || doc.documentElement).appendChild(style);
  }

  function cleanEditorRuntimeMarks(doc) {
    doc.getElementById("eb-editor-runtime-style")?.remove();

    doc.querySelectorAll("[data-eb-editable], [data-eb-future]").forEach(node => {
      node.style.removeProperty("outline");
      node.style.removeProperty("outline-offset");
      node.style.removeProperty("cursor");
      if (!node.getAttribute("style")) node.removeAttribute("style");
    });
  }

  function restoreRepoRelativeUrls(doc) {
    const project = state.project;
    const owner = encodeURIComponent(project?.site_repo_owner || "");
    const repo = encodeURIComponent(project?.site_repo_name || "");
    if (!owner || !repo) return;

    const markerBase = `/api/repo-asset/${owner}/${repo}@`;

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

        const idx = url.indexOf(markerBase);
        if (idx === -1) return;

        const branchEnd = url.indexOf("/", idx + markerBase.length);
        if (branchEnd === -1) return;

        const rel = url.slice(branchEnd + 1);
        node.setAttribute(attr, rel || "./");
      });
    });
  }

  function buildRepoExportHtml(doc) {
    const exportDoc = new DOMParser().parseFromString(
      `<!doctype html>\n${doc.documentElement.outerHTML}`,
      "text/html"
    );

    exportDoc.querySelectorAll("base").forEach(base => base.remove());
    exportDoc.getElementById("eb-editor-runtime-style")?.remove();

    exportDoc.querySelectorAll(".editor-inline-image-loader").forEach(node => node.remove());
    exportDoc.querySelectorAll(".editor-image-loading-target").forEach(node => {
      node.classList.remove("editor-image-loading-target");
      if (!node.getAttribute("class")) node.removeAttribute("class");
    });

    exportDoc.querySelectorAll('[data-eb-video-stream-overlay="1"]').forEach(node => node.remove());
    exportDoc.querySelectorAll('[data-eb-editable="video_stream"]').forEach(node => {
      if (node.tagName !== "VIDEO") return;
      const encodedValue = decodeEditorValueAttr(node.getAttribute("data-eb-value") || "");
      const rawValue = encodedValue || readVideoStreamNodeValue(node);
      applyVideoStreamDomState(node, parseVideoStreamValue(rawValue), "preview");
      node.removeAttribute("data-eb-video-status");
    });

    exportDoc.querySelectorAll('[data-eb-video-stream-positioned="1"]').forEach(frame => {
      frame.style.removeProperty("position");
      frame.removeAttribute("data-eb-video-stream-positioned");
      if (!frame.getAttribute("style")) frame.removeAttribute("style");
    });

    exportDoc.querySelectorAll('[data-eb-editable="video_embed"]').forEach(node => {
      const encodedValue = node.getAttribute("data-eb-value") || "";
      const video = parseVideoEmbedValue(decodeEditorValueAttr(encodedValue));
      node.dataset.ebRenderMode = "preview";
      node.dataset.ebRenderValue = encodedValue;
      node.innerHTML = renderVideoEmbedPreview(video);
    });

    cleanEditorRuntimeMarks(exportDoc);
    restoreRepoRelativeUrls(exportDoc);

    return `<!doctype html>\n${exportDoc.documentElement.outerHTML}`;
  }

  function syncRepoDraftFromFrame() {
    const draft = currentDraft();
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!draft || !doc) return;

    draft.edited_html = buildRepoExportHtml(doc);
  }

  function ensureFrameBaseInDoc() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!doc || doc.querySelector("base")) return;

    const branch = draftAssetBranch(currentDraft());
    const base = repoCdnUrl(state.project, "", branch);
    const baseHref = base.endsWith("/") ? base : `${base}/`;

    const tag = doc.createElement("base");
    tag.href = baseHref;
    if (doc.head) doc.head.appendChild(tag);
  }

  async function persistRepoDraftRecord(draft) {
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
      throw new Error(result?.message || "No pudimos guardar el borrador.");
    }
    return result?.draft || null;
  }

  async function saveAllRepoDrafts(silent = false) {
    if (!silent) setStatus(EDITOR_STATUS_COPY.saving_draft);
    try {
      for (const draft of state.repoDrafts.values()) {
        const saved = await persistRepoDraftRecord(draft);
        if (!saved) continue;
        if (typeof saved.edited_html === "string") draft.edited_html = saved.edited_html;
        if (saved.elements && typeof saved.elements === "object") draft.elements = saved.elements;
      }
      if (!silent) setStatus(EDITOR_STATUS_COPY.draft_saved, "success");
      return true;
    } catch (error) {
      console.error(error);
      showEditorError("EB-DRAFT-001");
      return false;
    }
  }

  async function saveRepoDraft(silent = false) {
    syncRepoDraftFromFrame();

    const draft = currentDraft();
    if (!draft) return true;

    if (!silent) setStatus(EDITOR_STATUS_COPY.saving_draft);
    try {
      const saved = await persistRepoDraftRecord(draft);
      if (saved && typeof saved.edited_html === "string") draft.edited_html = saved.edited_html;
      if (saved?.elements && typeof saved.elements === "object") draft.elements = saved.elements;
      if (!silent) setStatus(EDITOR_STATUS_COPY.draft_saved, "success");
      return true;
    } catch (error) {
      console.error(error);
      showEditorError("EB-DRAFT-001");
      return false;
    }
  }

  async function saveDraft(silent) {
    const draft = currentDraft();
    if (!draft) return;
    await saveRepoDraft(silent);
  }

  let autoSaveTimer = 0;
  const AUTOSAVE_DELAY = 2000;
  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = 0;
      saveDraft(true);
    }, AUTOSAVE_DELAY);
  }

  function flushAutoSave() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = 0;
      saveDraft(true);
    }
  }

    function showPublishConfirm() {
    const overlay = $("#editor-v2-confirm");
    if (!overlay) return Promise.resolve(true);
    const ok = $("#editor-v2-confirm-ok");
    const cancel = $("#editor-v2-confirm-cancel");
    const title = $("#editor-v2-confirm-title");
    const copy = $("#editor-v2-confirm .editor-modal-copy");
    const note = $("#editor-v2-confirm-note");
    if (title) title.textContent = "¿Quieres publicar estos cambios?";
    if (copy) copy.textContent = "Tu página se actualizará con lo que editaste.";
    if (note) note.textContent = "Los cambios pueden tardar un momento en verse.";
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

  function hasPendingVideoStreamProcessing() {
    for (const draft of state.repoDrafts.values()) {
      const elements = draft?.elements || {};
      for (const entry of Object.values(elements)) {
        if (!entry || entry.type !== "video_stream") continue;
        const video = parseVideoStreamValue(entry.value);
        if (video.status === "processing") return true;
      }
    }
    return false;
  }

  async function publishDraft() {
    if (hasPendingVideoStreamProcessing()) {
      showEditorError("EB-VIDEO-002");
      return;
    }

    if (!(await showPublishConfirm())) return;
    if (!(await saveRepoDraft())) return;

    if (hasPendingVideoStreamProcessing()) {
      showEditorError("EB-VIDEO-002");
      return;
    }

    const liveBranch = liveRepoBranch(state.project);
    const baseBranch = baseRepoBranch();
    const useBaseSnapshot = [...state.repoDrafts.values()].some(draft => draftAssetBranch(draft) === baseBranch);

    setStatus(EDITOR_STATUS_COPY.publishing);
    const pages = [...state.repoDrafts.values()].map(draft => ({
      path: draft.path,
      edited_html: draft.edited_html,
      elements: draft.elements || {}
    }));

    const response = await fetch("/api/editor-repo-publish", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        project_id: state.project.id,
        pages,
        use_base_snapshot: useBaseSnapshot,
        base_branch: baseBranch
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      showEditorError("EB-PUBLISH-001");
      return;
    }

    (result?.drafts || []).forEach(saved => {
      const draft = state.repoDrafts.get(saved.page_path);
      if (!draft) return;
      if (typeof saved.edited_html === "string") {
        draft.edited_html = saved.edited_html;
        draft.original_html = saved.edited_html;
      }
      if (saved.elements && typeof saved.elements === "object") draft.elements = saved.elements;
      writeDraftMeta(draft, { asset_branch: liveBranch });
    });

    applyDraftToFrame();
    renderSidebar();
    setStatus(EDITOR_STATUS_COPY.published_ok, "success");
  }

  async function resetDraft() {
    const draft = currentDraft();
    if (draft) {
      draft.edited_html = draft.original_html;
      draft.elements = {};
      writeDraftMeta(draft, { asset_branch: liveRepoBranch(state.project) });
    }
    state.currentKey = "";
    state.currentType = "";
    state.currentRole = "";
    state.currentKind = "";
    state.currentSection = "";
    state.currentFuture = "";
    state.currentNodeMode = "active";
    state.currentNodeValue = "";
    loadFrame();
    renderSidebar();
    setStatus(EDITOR_STATUS_COPY.page_reset, "success");
  }

  function togglePreview() {
    state.mode = state.mode === "edit" ? "preview" : "edit";
    state.currentKey = "";
    state.currentType = "";
    state.currentRole = "";
    state.currentKind = "";
    state.currentSection = "";
    state.currentFuture = "";
    state.currentNodeMode = "active";
    state.currentNodeValue = "";
    $("#editor-v2-preview").textContent = state.mode === "preview" ? "Seguir editando" : "Vista previa";
    const stateEl = $("#editor-v2-current-state");
    if (stateEl) {
      stateEl.textContent =
        state.mode === "preview"
          ? "Revisa la página como la verá un visitante."
          : "Selecciona un elemento de la página para editarlo.";
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

  function sectionInfo(type) {
    const sections = {
      hero: ["la", "portada"],
      text: ["el", "texto"],
      about: ["la", "sección Nosotros"],
      contact: ["el", "contacto"],
      features: ["las", "ventajas"],
      gallery: ["la", "galería"],
      video: ["el", "video"],
      testimonials: ["los", "testimonios"],
      hours: ["los", "horarios"],
      menu: ["el", "menú"],
      buttons: ["los", "botones"],
      footer: ["el", "pie de página"],
      cta: ["la", "llamada a la acción"],
      map: ["el", "mapa"],
      whatsapp: ["el", "WhatsApp"]
    };
    return sections[type] || ["", ""];
  }

  function humanFieldName(field) {
    const fields = {
      image: "Foto",
      name: "Nombre",
      price: "Precio",
      description: "Descripción",
      url: "Enlace",
      link: "Enlace",
      caption: "Título de la foto",
      alt: "Texto alternativo",
      days: "Días",
      hours: "Horario",
      label: "Texto del botón",
      style: "Estilo",
      heading: "Título",
      title: "Título",
      subtitle: "Subtítulo",
      text: "Texto",
      items: "Elementos",
      value: "Valor",
      maps_url: "Enlace del mapa",
      whatsapp: "WhatsApp",
      phone: "Teléfono",
      email: "Correo",
      address: "Dirección",
      eyebrow: "Encabezado",
      logo: "Logo",
      credits: "Créditos"
    };
    return fields[field] ||
      String(field || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[._-]+/g, " ").replace(/^./, c => c.toUpperCase()).trim() ||
      "Campo";
  }

  function displayKeyLabel(key) {
    const labels = {
      "hero.title": "Título principal",
      "hero.subtitle": "Subtítulo principal",
      "hero.image": "Imagen principal",
      "hero.buttons": "Botones principales",
      "hero.eyebrow": "Encabezado de la portada",
      "hero.logo": "Logo",
      "text.heading": "Título de texto",
      "text.body": "Contenido de texto",
      "about.heading": "Título de Nosotros",
      "about.image": "Foto de la sección Nosotros",
      "about.text": "Texto de la sección Nosotros",
      "contact.heading": "Título de contacto",
      "contact.title": "Título de contacto",
      "contact.subtitle": "Subtítulo de contacto",
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
      "video.title": "Título de video",
      "video.description": "Descripción de video",
      "testimonials.heading": "Título de testimonios",
      "testimonials.items": "Lista de testimonios",
      "video.hero.file": "Video principal",
      "video.hero.poster": "Poster del video",
      "hours.heading": "Título de horarios",
      "hours.items": "Lista de horarios",
      "buttons.heading": "Título de botones",
      "buttons.items": "Botones de acción",
      "menu.heading": "Título del menú",
      "menu.title": "Título del menú",
      "menu.subtitle": "Subtítulo del menú",
      "menu.eyebrow": "Encabezado del menú",
      "menu.items": "Productos del menú",
      "cta.title": "Título de la llamada a la acción",
      "cta.subtitle": "Subtítulo de la llamada a la acción",
      "cta.buttons": "Botones de la llamada a la acción",
      "footer.text": "Texto del pie de página",
      "footer.credits": "Créditos del pie de página",
      "footer.logo": "Logo del pie de página",
      "map.title": "Título del mapa",
      "map.address": "Dirección del mapa",
      "whatsapp.title": "Título de WhatsApp"
    };

    const { type, field } = splitKey(key);
    if (labels[key]) return labels[key];
    if (labels[baseKey(key)] && !field) return labels[baseKey(key)];
    if (field) {
      const [art, name] = sectionInfo(type);
      const base = `${type}.${field}`;
      if (labels[base]) return labels[base];
      const of = art ? ` de ${art === "el" ? "el" : art} ${name}` : "";
      return humanFieldName(field) + of;
    }
    return humanFieldName(key);
  }

  function pageLabel(name) {
    const map = {
      index: "Portada",
      inicio: "Inicio",
      home: "Inicio",
      menu: "Menú",
      "menu-simple": "Menú",
      about: "Nosotros",
      nosotros: "Nosotros",
      contact: "Contacto",
      contacto: "Contacto",
      galeria: "Galería",
      gallery: "Galería",
      horarios: "Horarios",
      hours: "Horarios",
      ubicacion: "Ubicación",
      location: "Ubicación",
      reservas: "Reservas"
    };
    const raw = String(name || "");
    const n = raw.toLowerCase().replace(/\.html?$/, "");
    return map[n] || n.replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase()) || raw;
  }

  // Subida de fotos: se optimizan en el celular (max 1600px, JPEG ~82%) para que
  // pesen poco y la pagina cargue rapido; luego se guardan en el bucket publico.
  const PHOTO_MAX = 1600;

  function optimizeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.naturalWidth || 800;
          let h = img.naturalHeight || 600;
          if (w > PHOTO_MAX || h > PHOTO_MAX) {
            const r = Math.min(PHOTO_MAX / w, PHOTO_MAX / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const type = file.type === "image/png" ? "image/png" : "image/jpeg";
          const makeCanvas = (cw, ch, src) => {
            const c = document.createElement("canvas");
            c.width = cw;
            c.height = ch;
            const ctx = c.getContext("2d");
            if (!ctx) throw new Error("CANVAS");
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(src, 0, 0, cw, ch);
            return c;
          };
          let canvas;
          try {
            canvas = makeCanvas(w, h, img);
          } catch (err) {
            // Fotos gigantes en celulares: baja por pasos (max 1.5x por salto)
            // para no agotar la memoria del canvas.
            let prev = (() => {
              const c = document.createElement("canvas");
              const cw = Math.min(img.naturalWidth, 2200);
              const ch = Math.round(cw * (img.naturalHeight / img.naturalWidth));
              c.width = cw;
              c.height = ch;
              const ctx = c.getContext("2d");
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, cw, ch);
              ctx.drawImage(img, 0, 0, cw, ch);
              return c;
            })();
            for (; prev.width > 1.5 * w; ) {
              const cw = Math.max(w, Math.round(prev.width / 1.5));
              const ch = Math.max(h, Math.round(prev.height * (cw / prev.width)));
              const c = document.createElement("canvas");
              c.width = cw;
              c.height = ch;
              const ctx = c.getContext("2d");
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, cw, ch);
              ctx.drawImage(prev, 0, 0, cw, ch);
              prev = c;
            }
            canvas = prev;
          }
          URL.revokeObjectURL(url);
          canvas.toBlob(
            blob => {
              if (blob) resolve({ blob, type });
              else reject(new Error("CANVAS"));
            },
            type,
            type === "image/jpeg" ? 0.82 : undefined
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("IMAGE_LOAD"));
      };
      img.src = url;
    });
  }

  async function uploadPhoto(file) {
    const storage = db?.storage;
    if (!storage) {
      showEditorError("EB-MEDIA-001");
      return;
    }

    const imageNode = currentImageNode();
    if (imageNode) showInlineImageLoader(imageNode);

    setStatus(EDITOR_STATUS_COPY.image_optimizing);

    try {
      const { blob, type } = await optimizeImage(file);
      const ext = type === "image/png" ? "png" : "jpg";
      const path = `${state.project.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

      setStatus(EDITOR_STATUS_COPY.image_uploading);

      const { error } = await storage.from("site-images").upload(path, blob, {
        contentType: type,
        cacheControl: "3600",
        upsert: false
      });
      if (error) throw error;

      const { data } = storage.from("site-images").getPublicUrl(path);
      const url = data?.publicUrl;
      state.lastPhotoUpload = { url, blob, type };

      const valueField = $('#editor-v2-fields [data-inline-field="value"]');
      if (valueField) valueField.value = url;

      updateCurrentValue(url);
      setStatus(EDITOR_STATUS_COPY.image_uploaded, "success");
    } catch (err) {
      console.error("upload photo", err);
      if (imageNode) hideInlineImageLoader(imageNode);
      showEditorError("EB-MEDIA-001");
    }
  }

  // ---- Ajustar imagen (no destructivo: guarda metadata sobre la misma foto) ----
  const photoEdit = {
    url: "",
    img: null,
    ar: 4 / 3,
    zoom: 1,
    x: 0,
    y: 0,
    rot: 0,
    mode: "cover",
    radius: "",
    meta: null,
    pointers: new Map(),
    pinchDist: 0,
    pinchAngle: null,
    pinchMidX: 0,
    pinchMidY: 0
  };

  function photoAtValue() {
    const data = currentDraftData();
    return data[state.currentKey]?.value ?? state.currentNodeValue;
  }

  function currentImageNode() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!doc || !state.currentKey) return null;

    const node = doc.querySelector(`[data-eb-key="${CSS.escape(state.currentKey)}"]`);
    return node?.tagName === "IMG" ? node : null;
  }

  function currentVideoStreamValue() {
    const raw = currentDraftData()[state.currentKey]?.value ?? state.currentNodeValue ?? "";
    return parseVideoStreamValue(raw);
  }

  async function uploadVideoStream(file) {
    const storage = db?.storage;
    const page = currentPage();

    if (!storage || !state.project?.id || !page?.id || !state.currentKey) {
      showEditorError("EB-VIDEO-001");
      return;
    }

    const current = currentVideoStreamValue();
    const extRaw = String(file.name || "").split(".").pop()?.toLowerCase() || "mp4";
    const ext = /^[a-z0-9]+$/.test(extRaw) ? extRaw : "mp4";
    const title = current.title || String(file.name || "Video").replace(/\.[^.]+$/, "");
    const path = `${state.project.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    updateCurrentValue(stringifyVideoStreamValue({
      ...current,
      title,
      provider: "raw",
      status: "processing"
    }));
    renderSidebar();
    setStatus(EDITOR_STATUS_COPY.video_uploading);

    let assetId = current.asset_id || "";

    try {
      const { data: inserted, error: insertError } = await db
        .from("client_site_video_assets")
        .insert({
          project_id: state.project.id,
          page_id: page.id,
          asset_key: state.currentKey,
          kind: "video_stream",
          provider: "raw",
          source_url: "",
          playback_url: "",
          poster_url: current.poster_url || "",
          mime_type: file.type || "video/mp4",
          size_bytes: Number(file.size || 0),
          status: "processing",
          source_meta: {
            filename: file.name || "",
            aspect_ratio: current.aspect_ratio || "16 / 9"
          }
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      assetId = inserted?.id || "";

      setStatus(EDITOR_STATUS_COPY.video_processing);

      const { error: uploadError } = await storage.from("site-videos").upload(path, file, {
        contentType: file.type || "video/mp4",
        cacheControl: "3600",
        upsert: false
      });
      if (uploadError) throw uploadError;

      const { data } = storage.from("site-videos").getPublicUrl(path);
      const playbackUrl = data?.publicUrl || "";
      if (!playbackUrl) throw new Error("VIDEO_URL");

      const { error: updateError } = await db
        .from("client_site_video_assets")
        .update({
          source_url: playbackUrl,
          playback_url: playbackUrl,
          poster_url: current.poster_url || "",
          mime_type: file.type || "video/mp4",
          size_bytes: Number(file.size || 0),
          status: "ready",
          source_meta: {
            filename: file.name || "",
            aspect_ratio: current.aspect_ratio || "16 / 9"
          }
        })
        .eq("id", assetId);

      if (updateError) throw updateError;

      updateCurrentValue(stringifyVideoStreamValue({
        ...current,
        kind: "video_stream",
        asset_id: assetId,
        provider: "raw",
        status: "ready",
        playback_url: playbackUrl,
        poster_url: current.poster_url || "",
        title,
        aspect_ratio: current.aspect_ratio || "16 / 9",
        autoplay: !!current.autoplay,
        muted: !!current.muted,
        loop: !!current.loop,
        controls: current.controls !== false
      }));
      renderSidebar();
      setStatus(EDITOR_STATUS_COPY.video_uploaded, "success");
    } catch (err) {
      console.error("upload video", err);

      if (assetId) {
        await db
          .from("client_site_video_assets")
          .update({
            status: "failed",
            source_meta: {
              filename: file.name || "",
              error: String(err?.message || "upload_failed")
            }
          })
          .eq("id", assetId);
      }

      updateCurrentValue(stringifyVideoStreamValue({
        ...current,
        asset_id: assetId,
        provider: "raw",
        status: "failed",
        title,
        aspect_ratio: current.aspect_ratio || "16 / 9"
      }));
      renderSidebar();
      showEditorError("EB-VIDEO-001");
    }
  }

  async function loadPhotoForEdit(url) {
    const last = state.lastPhotoUpload;
    if (last && last.url === url && last.blob) return last.blob;
    const response = await fetch(url);
    if (!response.ok) throw new Error("IMAGE_FETCH");
    return response.blob();
  }

  function photoTargetAspect() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!doc || !state.currentKey) return 4 / 3;
    const node = doc.querySelector(`[data-eb-key="${CSS.escape(state.currentKey)}"]`);
    const target = photoFrameWrapper(node) || node;
    const w = target?.offsetWidth || 0;
    const h = target?.offsetHeight || 0;
    if (w > 8 && h > 8) return w / h;

    const type = splitKey(state.currentKey).type;
    if (type === "gallery") return 1;
    if (type === "hero") return 16 / 9;
    if (type === "banner") return 4;
    return 4 / 3;
  }

  function photoFitMode() {
    const type = splitKey(state.currentKey).type;
    return type === "gallery" ? "fit" : "cover";
  }

  function photoTargetRadius() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    if (!doc || !state.currentKey) return "";
    const node = doc.querySelector(`[data-eb-key="${CSS.escape(state.currentKey)}"]`);
    const target = photoFrameWrapper(node) || node;
    const styles = target?.ownerDocument?.defaultView?.getComputedStyle(target);
    const radius = String(styles?.borderRadius || "").trim();
    return radius && radius !== "0px" ? radius : "";
  }

  function photoMetaZoom(meta) {
    if (Number.isFinite(Number(meta?.zoom))) return Number(meta.zoom);
    if (Number.isFinite(Number(meta?.scale))) return Number(meta.scale);
    return 1;
  }

  function photoComputeLayout(meta, frameW, frameH, naturalW, naturalH) {
    const rawRotation = Number.isFinite(Number(meta?.rotation))
      ? Number(meta.rotation)
      : Number(meta?.rot || 0);
    const rotation = ((rawRotation % 360) + 360) % 360;
    const rad = rotation * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const rotatedW = naturalW * cos + naturalH * sin;
    const rotatedH = naturalW * sin + naturalH * cos;
    const fit = meta?.fit || "cover";
    const baseScale = fit === "fit"
      ? Math.min(frameW / rotatedW, frameH / rotatedH)
      : Math.max(frameW / rotatedW, frameH / rotatedH);
    return {
      rotation,
      zoom: photoMetaZoom(meta),
      x: Number.isFinite(Number(meta?.x)) ? Number(meta.x) : 0,
      y: Number.isFinite(Number(meta?.y)) ? Number(meta.y) : 0,
      baseScale,
      widthPct: (naturalW * baseScale / frameW) * 100,
      heightPct: (naturalH * baseScale / frameH) * 100,
      bboxW: rotatedW * baseScale * photoMetaZoom(meta),
      bboxH: rotatedH * baseScale * photoMetaZoom(meta),
      drawWidth: naturalW * baseScale * photoMetaZoom(meta),
      drawHeight: naturalH * baseScale * photoMetaZoom(meta)
    };
  }

  function photoFrameMetrics() {
    const stage = $("#editor-photo-stage");
    const w = stage?.clientWidth || 400;
    const h = stage?.clientHeight || 300;
    const frameW = Math.min(w, h * photoEdit.ar);
    const frameH = frameW / photoEdit.ar;
    const frameLeft = (w - frameW) / 2;
    const frameTop = (h - frameH) / 2;
    const naturalW = photoEdit.img?.naturalWidth || photoEdit.img?.width || 400;
    const naturalH = photoEdit.img?.naturalHeight || photoEdit.img?.height || 300;
    const layout = photoComputeLayout(photoEdit, frameW, frameH, naturalW, naturalH);
    return {
      w,
      h,
      frameW,
      frameH,
      frameLeft,
      frameTop,
      naturalW,
      naturalH,
      ...layout
    };
  }

  function clampPhotoOffsets(metrics = photoFrameMetrics()) {
    const limitX = metrics.bboxW > metrics.frameW ? (metrics.bboxW - metrics.frameW) / (2 * metrics.frameW) : 0;
    const limitY = metrics.bboxH > metrics.frameH ? (metrics.bboxH - metrics.frameH) / (2 * metrics.frameH) : 0;
    photoEdit.x = Math.max(-limitX, Math.min(limitX, Number.isFinite(photoEdit.x) ? photoEdit.x : 0));
    photoEdit.y = Math.max(-limitY, Math.min(limitY, Number.isFinite(photoEdit.y) ? photoEdit.y : 0));
    return {
      ...metrics,
      x: photoEdit.x,
      y: photoEdit.y,
      centerX: metrics.w / 2 + photoEdit.x * metrics.frameW,
      centerY: metrics.h / 2 + photoEdit.y * metrics.frameH
    };
  }

  function renderPhotoStage() {
    const stage = $("#editor-photo-stage");
    const canvas = $("#editor-photo-canvas");
    const mask = $("#editor-photo-mask");
    if (!stage || !canvas || !mask || !photoEdit.img) return;

    const metrics = clampPhotoOffsets(photoFrameMetrics());
    photoEdit.mw = metrics.frameW;
    photoEdit.mh = metrics.frameH;

    canvas.width = metrics.w;
    canvas.height = metrics.h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, metrics.w, metrics.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(metrics.frameLeft, metrics.frameTop, metrics.frameW, metrics.frameH);
    ctx.clip();
    if (photoEdit.mode === "fit") {
      ctx.fillStyle = "#efece6";
      ctx.fillRect(metrics.frameLeft, metrics.frameTop, metrics.frameW, metrics.frameH);
    }
    ctx.translate(metrics.centerX, metrics.centerY);
    ctx.rotate(metrics.rotation * Math.PI / 180);
    ctx.drawImage(
      photoEdit.img,
      -metrics.drawWidth / 2,
      -metrics.drawHeight / 2,
      metrics.drawWidth,
      metrics.drawHeight
    );
    ctx.restore();

    mask.style.left = `${metrics.frameLeft}px`;
    mask.style.top = `${metrics.frameTop}px`;
    mask.style.width = `${metrics.frameW}px`;
    mask.style.height = `${metrics.frameH}px`;
    mask.style.borderRadius = photoEdit.radius || "6px";
  }

  function zoomPhotoBy(factor) {
    if (!photoEdit.img) return;
    const next = Math.min(6, Math.max(1, photoEdit.zoom * factor));
    if (next === photoEdit.zoom) return;
    photoEdit.zoom = next;
    renderPhotoStage();
  }

  function rotatePhoto(delta) {
    if (!photoEdit.img) return;
    photoEdit.rot = ((photoEdit.rot + delta) % 360 + 360) % 360;
    photoEdit.zoom = 1;
    photoEdit.x = 0;
    photoEdit.y = 0;
    renderPhotoStage();
  }

  function resetPhotoAdjust() {
    if (!photoEdit.img) return;
    photoEdit.rot = 0;
    photoEdit.zoom = 1;
    photoEdit.x = 0;
    photoEdit.y = 0;
    renderPhotoStage();
  }

  function photoMetaOfCurrent() {
    const data = currentDraftData();
    return data[state.currentKey]?.meta || null;
  }

  function photoFrameWrapper(node) {
    const parent = node?.parentElement;
    if (!parent) return null;
    if (parent.getAttribute("data-eb-photo-frame") === "1") return parent;
    if (parent.classList?.contains("site-img-adjust")) return parent;
    return null;
  }

  function ensurePhotoFrame(node, meta) {
    const ratio = Number(meta?.frameRatio);
    if (!node || !Number.isFinite(ratio) || ratio <= 0) return null;

    let frame = photoFrameWrapper(node);
    if (!frame) {
      const parent = node.parentNode;
      if (!parent) return null;
      frame = node.ownerDocument.createElement("div");
      frame.setAttribute("data-eb-photo-frame", "1");
      parent.insertBefore(frame, node);
      frame.appendChild(node);
    }

    const computed = node.ownerDocument?.defaultView?.getComputedStyle(node);
    if (!frame.dataset.ebPhotoRadius) {
      frame.dataset.ebPhotoRadius = String(meta?.radius || computed?.borderRadius || "").trim();
    }
    frame.style.position = "relative";
    frame.style.overflow = "hidden";
    frame.style.display = "block";
    frame.style.width = "100%";
    frame.style.aspectRatio = String(ratio);
    const radius = String(meta?.radius || frame.dataset.ebPhotoRadius || computed?.borderRadius || "").trim();
    if (radius) frame.style.borderRadius = radius;
    if (computed?.minHeight && computed.minHeight !== "0px") {
      frame.style.minHeight = computed.minHeight;
    } else {
      frame.style.removeProperty("min-height");
    }
    return frame;
  }

  function unwrapPhotoFrame(node) {
    const frame = photoFrameWrapper(node);
    const parent = frame?.parentNode;
    if (!frame || !parent) return;
    parent.insertBefore(node, frame);
    frame.remove();
  }

  function applyPhotoMetaStyles(node, meta) {
    if (!node) return;
    if (!meta) {
      unwrapPhotoFrame(node);
      node.style.transform = "";
      node.style.objectFit = "";
      node.style.position = "";
      node.style.inset = "";
      node.style.left = "";
      node.style.top = "";
      node.style.width = "";
      node.style.height = "";
      node.style.maxWidth = "";
      node.style.maxHeight = "";
      node.style.display = "";
      node.style.borderRadius = "";
      node.style.transformOrigin = "";
      return;
    }
    const frame = ensurePhotoFrame(node, meta);
    if (!frame) return;
    if (!node.complete || !node.naturalWidth || !node.naturalHeight) {
      node.addEventListener("load", () => applyPhotoMetaStyles(node, meta), { once: true });
      return;
    }
    const frameW = frame.clientWidth || node.offsetWidth || 0;
    const frameH = frame.clientHeight || node.offsetHeight || 0;
    if (!(frameW > 0 && frameH > 0)) {
      requestAnimationFrame(() => applyPhotoMetaStyles(node, meta));
      return;
    }
    const layout = photoComputeLayout(meta, frameW, frameH, node.naturalWidth, node.naturalHeight);
    node.style.position = "absolute";
    node.style.inset = "auto";
    node.style.left = `${50 + layout.x * 100}%`;
    node.style.top = `${50 + layout.y * 100}%`;
    node.style.width = `${layout.widthPct}%`;
    node.style.height = `${layout.heightPct}%`;
    node.style.maxWidth = "none";
    node.style.maxHeight = "none";
    node.style.display = "block";
    node.style.borderRadius = "0";
    node.style.transformOrigin = "center center";
    node.style.transform = `translate(-50%, -50%) scale(${layout.zoom}) rotate(${layout.rotation}deg)`;
    node.style.objectFit = "fill";
  }

  function inlineImageLoaderTarget(node) {
    return photoFrameWrapper(node) || node || null;
  }

  function positionInlineImageLoader(node, loader) {
    const target = inlineImageLoaderTarget(node);
    const doc = target?.ownerDocument;
    const win = doc?.defaultView;
    if (!target || !doc || !win || !loader) return false;

    const rect = target.getBoundingClientRect();
    const width = Math.max(0, rect.width || 0);
    const height = Math.max(0, rect.height || 0);

    if (width < 8 || height < 8) {
      loader.classList.remove("is-visible");
      return false;
    }

    loader.style.left = `${rect.left + win.scrollX}px`;
    loader.style.top = `${rect.top + win.scrollY}px`;
    loader.style.width = `${width}px`;
    loader.style.height = `${height}px`;
    loader.style.borderRadius = "0";
    return true;
  }

  function ensureInlineImageLoader(node) {
    const target = inlineImageLoaderTarget(node);
    const doc = target?.ownerDocument;
    if (!target || !doc?.body) return null;

    if (doc.__ebFloatingImageLoader && doc.body.contains(doc.__ebFloatingImageLoader)) {
      positionInlineImageLoader(node, doc.__ebFloatingImageLoader);
      return doc.__ebFloatingImageLoader;
    }

    const loader = doc.createElement("div");
    loader.className = "editor-inline-image-loader";
    loader.innerHTML = `<span class="editor-frame-spinner" aria-hidden="true"></span>`;
    loader.__ebOwnerNode = null;
    doc.body.appendChild(loader);
    doc.__ebFloatingImageLoader = loader;
    positionInlineImageLoader(node, loader);
    return loader;
  }

  function stopInlineImageLoaderTracking(doc) {
    const loader = doc?.__ebFloatingImageLoader || null;
    if (!loader?.__ebTrackCleanup) return;
    loader.__ebTrackCleanup();
    loader.__ebTrackCleanup = null;
  }

  function startInlineImageLoaderTracking(node, loader) {
    const doc = node?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win || !loader) return;

    stopInlineImageLoaderTracking(doc);

    let rafId = 0;

    const refresh = () => {
      rafId = 0;
      if (!loader.classList.contains("is-visible")) return;
      if (loader.__ebOwnerNode !== node) return;

      const ok = positionInlineImageLoader(node, loader);
      if (!ok) loader.classList.remove("is-visible");
    };

    const queueRefresh = () => {
      if (rafId) return;
      rafId = win.requestAnimationFrame(refresh);
    };

    win.addEventListener("scroll", queueRefresh, { passive: true });
    win.addEventListener("resize", queueRefresh, { passive: true });

    loader.__ebTrackCleanup = () => {
      if (rafId) {
        win.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      win.removeEventListener("scroll", queueRefresh);
      win.removeEventListener("resize", queueRefresh);
    };
  }

  function resetInlineImageLoader(doc) {
    if (!doc) return;
    const loader = doc.__ebFloatingImageLoader || null;

    stopInlineImageLoaderTracking(doc);

    if (loader) {
      loader.classList.remove("is-visible");
      if (loader.__ebOwnerNode?.classList) {
        loader.__ebOwnerNode.classList.remove("editor-image-loading-target");
      }
      loader.__ebOwnerNode = null;
    }

    doc.querySelectorAll(".editor-image-loading-target").forEach(node => {
      node.classList.remove("editor-image-loading-target");
    });
  }

  function showInlineImageLoader(node) {
    const loader = ensureInlineImageLoader(node);
    if (!loader) return;

    if (loader.__ebOwnerNode && loader.__ebOwnerNode !== node && loader.__ebOwnerNode.classList) {
      loader.__ebOwnerNode.classList.remove("editor-image-loading-target");
    }

    loader.__ebOwnerNode = node;
    const ok = positionInlineImageLoader(node, loader);
    if (!ok) return;

    loader.classList.add("is-visible");
    node.classList.add("editor-image-loading-target");
    startInlineImageLoaderTracking(node, loader);
  }

  function hideInlineImageLoader(node, seq = null) {
    if (!node) return;
    if (seq != null && Number(node.__ebImageLoadSeq || 0) !== Number(seq)) return;

    const doc = node.ownerDocument;
    const loader = doc?.__ebFloatingImageLoader || null;

    if (loader?.__ebOwnerNode && loader.__ebOwnerNode !== node) {
      node.classList.remove("editor-image-loading-target");
      return;
    }

    stopInlineImageLoaderTracking(doc);
    loader?.classList.remove("is-visible");
    if (loader) loader.__ebOwnerNode = null;
    node.classList.remove("editor-image-loading-target");
  }

  function openPhotoEditor() {
    const backdrop = $("#editor-photo-modal");
    if (!backdrop) return;

    const url = photoAtValue();
    if (!url) {
      setStatus(EDITOR_STATUS_COPY.image_pick_first);
      return;
    }

    photoEdit.meta = photoMetaOfCurrent();
    setStatus(EDITOR_STATUS_COPY.image_prepare);
    backdrop.hidden = false;

    loadPhotoForEdit(url)
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          photoEdit.img = img;
          photoEdit.url = url;
          photoEdit.rot = ((photoEdit.meta?.rotation || 0) % 360 + 360) % 360;
          photoEdit.ar = photoTargetAspect();
          photoEdit.mode = photoEdit.meta?.fit || photoFitMode();
          photoEdit.zoom = photoMetaZoom(photoEdit.meta);
          photoEdit.x = Number.isFinite(Number(photoEdit.meta?.x)) ? Number(photoEdit.meta.x) : 0;
          photoEdit.y = Number.isFinite(Number(photoEdit.meta?.y)) ? Number(photoEdit.meta.y) : 0;
          photoEdit.radius = photoEdit.meta?.radius || photoTargetRadius();

          const m = photoEdit.meta;
          if (!m) {
            photoEdit.zoom = 1;
            photoEdit.x = 0;
            photoEdit.y = 0;
          }

          renderPhotoStage();
          setStatus(EDITOR_STATUS_COPY.image_adjust_hint, "success");
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          backdrop.hidden = true;
          showEditorError("EB-MEDIA-002");
        };

        img.src = objectUrl;
      })
      .catch(() => {
        backdrop.hidden = true;
        setStatus(EDITOR_STATUS_COPY.image_direct_only);
      });
  }

  function closePhotoEditor() {
    const backdrop = $("#editor-photo-modal");
    if (backdrop) backdrop.hidden = true;
    photoEdit.img = null;
    photoEdit.pointers.clear();
    photoEdit.pinchDist = 0;
    photoEdit.pinchAngle = null;
  }

  async function applyPhotoEdit() {
    if (!photoEdit.img) return;
    const metrics = clampPhotoOffsets(photoFrameMetrics());

    const meta = {
      model: "frame-v2",
      fit: photoEdit.mode,
      zoom: +photoEdit.zoom.toFixed(6),
      scale: +photoEdit.zoom.toFixed(6),
      frameRatio: +photoEdit.ar.toFixed(6),
      radius: photoEdit.radius || photoTargetRadius(),
      x: +metrics.x.toFixed(6),
      y: +metrics.y.toFixed(6),
      rotation: ((photoEdit.rot % 360) + 360) % 360
    };

    try {
      updateCurrentValue(photoEdit.url, meta);
      closePhotoEditor();
      setStatus(EDITOR_STATUS_COPY.image_adjust_saved, "success");
    } catch (err) {
      console.error("apply photo adjust", err);
      showEditorError("EB-MEDIA-003");
    }
  }

  const EDITABLE_SELECTOR = "[data-eb-editable], [data-eb-future]";

  function watchEditableNodes(doc, scheduled = false) {
    if (!doc || state.mode !== "edit") return;
    if (scheduled) {
      applyDraftToFrame();
      syncVideoEmbedNodes(doc);
      syncVideoStreamNodes(doc);
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
        syncVideoEmbedNodes(doc);
        syncVideoStreamNodes(doc);
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
    if (type === "image" && node.tagName === "IMG") return node.currentSrc || node.src || node.getAttribute("src") || "";
    if (type === "link" && node.tagName === "A") return node.getAttribute("href") || "";
    if (type === "video_stream") return readVideoStreamNodeValue(node);
    if (type === "video_embed") return decodeEditorValueAttr(node.getAttribute("data-eb-value") || "");
    return node.textContent || "";
  }

  function readNodeMeta(node) {
    const type = node?.getAttribute("data-eb-editable") || "";
    const future = node?.getAttribute("data-eb-future") || "";
    const section =
      node?.getAttribute("data-eb-section") ||
      node?.closest("[data-eb-section]")?.getAttribute("data-eb-section") ||
      "";

    return {
      key: node?.getAttribute("data-eb-key") || "",
      type: type || (future ? "future" : "text"),
      role: node?.getAttribute("data-eb-role") || "",
      kind: node?.getAttribute("data-eb-kind") || "",
      section,
      future,
      nodeMode: type ? "active" : (future ? "future" : "unknown")
    };
  }

  function bindEditableNodes(doc) {
    if (!doc || state.mode !== "edit") return;
    ensureEditorRuntimeStyles(doc);

    doc.querySelectorAll(EDITABLE_SELECTOR).forEach(node => {
      if (node.__ebBound) return;
      node.__ebBound = true;

      node.addEventListener("click", evt => {
        evt.preventDefault();
        evt.stopPropagation();

        const meta = readNodeMeta(node);
        state.currentKey = meta.key;
        state.currentType = meta.type || "text";
        state.currentRole = meta.role;
        state.currentKind = meta.kind;
        state.currentSection = meta.section;
        state.currentFuture = meta.future;
        state.currentNodeMode = meta.nodeMode;
        state.currentNodeValue = meta.nodeMode === "active"
          ? readNodeValue(node, meta.type)
          : "";

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
    $("#editor-v2-undo").onclick = undoAction;
    $("#editor-v2-redo").onclick = redoAction;
    $("#editor-v2-base").onclick = restoreBase;

    document.addEventListener("keydown", e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoAction();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redoAction();
      }
    });

    window.addEventListener("pagehide", flushAutoSave);

    const photoBackdrop = $("#editor-photo-modal");
    $("#editor-photo-cancel").onclick = () => closePhotoEditor();
    $("#editor-photo-apply").onclick = () => applyPhotoEdit();

    $("#editor-photo-zoom-in").onclick = () => zoomPhotoBy(1.25);
    $("#editor-photo-zoom-out").onclick = () => zoomPhotoBy(0.8);
    $("#editor-photo-rotate-left").onclick = () => rotatePhoto(-90);
    $("#editor-photo-rotate-right").onclick = () => rotatePhoto(90);
    $("#editor-photo-reset").onclick = () => resetPhotoAdjust();
    photoBackdrop.addEventListener("click", e => {
      if (e.target === photoBackdrop) closePhotoEditor();
    });

    const stage = $("#editor-photo-stage");
    stage.addEventListener("pointerdown", e => {
      stage.setPointerCapture?.(e.pointerId);
      photoEdit.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (photoEdit.pointers.size === 2) {
        const [a, b] = [...photoEdit.pointers.values()];
        photoEdit.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        photoEdit.pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
        photoEdit.pinchMidX = (a.x + b.x) / 2;
        photoEdit.pinchMidY = (a.y + b.y) / 2;
      }
    });
    stage.addEventListener("pointermove", e => {
      const p = photoEdit.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (photoEdit.pointers.size === 1) {
        const metrics = photoFrameMetrics();
        photoEdit.x += dx / (metrics.frameW || 1);
        photoEdit.y += dy / (metrics.frameH || 1);
        renderPhotoStage();
      } else if (photoEdit.pointers.size === 2) {
        const [a, b] = [...photoEdit.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        if (photoEdit.pinchDist > 0) {
          const ratio = dist / photoEdit.pinchDist;
          photoEdit.zoom = Math.min(6, Math.max(1, photoEdit.zoom * ratio));
        }
        if (Number.isFinite(photoEdit.pinchAngle)) {
          let deltaAngle = (angle - photoEdit.pinchAngle) * 180 / Math.PI;
          while (deltaAngle > 180) deltaAngle -= 360;
          while (deltaAngle < -180) deltaAngle += 360;
          photoEdit.rot = ((photoEdit.rot + deltaAngle) % 360 + 360) % 360;
        }
        const metrics = photoFrameMetrics();
        photoEdit.x += (midX - photoEdit.pinchMidX) / (metrics.frameW || 1);
        photoEdit.y += (midY - photoEdit.pinchMidY) / (metrics.frameH || 1);
        photoEdit.pinchDist = dist;
        photoEdit.pinchAngle = angle;
        photoEdit.pinchMidX = midX;
        photoEdit.pinchMidY = midY;
        renderPhotoStage();
      }
    });
    const endPointer = e => {
      photoEdit.pointers.delete(e.pointerId);
      if (photoEdit.pointers.size < 2) {
        photoEdit.pinchDist = 0;
        photoEdit.pinchAngle = null;
      }
    };
    stage.addEventListener("pointerup", endPointer);
    stage.addEventListener("pointercancel", endPointer);
    stage.addEventListener("wheel", e => {
      e.preventDefault();
      const ratio = Math.pow(1.05, -e.deltaY / 50);
      photoEdit.zoom = Math.min(6, Math.max(1, photoEdit.zoom * ratio));
      renderPhotoStage();
    }, { passive: false });

    $("#editor-v2-frame").addEventListener("load", () => {
      state.frameReady = true;
      hideFrameLoading();
      const frame = $("#editor-v2-frame");
      const doc = frame.contentDocument;
      if (!doc) return;

      resetInlineImageLoader(doc);
      applyDraftToFrame();
      syncVideoEmbedNodes(doc);
      syncVideoStreamNodes(doc);
      watchEditableNodes(doc);
    });
  }

  function resolveEntryType(node, entry) {
    return entry?.type || node.getAttribute("data-eb-editable") || "text";
  }

  function applyEntryToNode(node, key, entry) {
    const type = resolveEntryType(node, entry);
    const value = entry?.value ?? "";

    if (type === "text") {
      node.textContent = value;
      return;
    }

    if (type === "image" && node.tagName === "IMG") {
      const nextSrc = String(value || "").trim();
      const prevSrc = String(node.getAttribute("src") || "");
      const pendingSrc = String(node.__ebPendingImageSrc || "");

      if (!nextSrc) {
        if (node.__ebImageLoadTimer) {
          clearTimeout(node.__ebImageLoadTimer);
          node.__ebImageLoadTimer = 0;
        }
        node.__ebPendingImageSrc = "";
        hideInlineImageLoader(node);
        node.removeAttribute("src");
        applyPhotoMetaStyles(node, entry?.meta || null);
        return;
      }

      if (prevSrc === nextSrc) {
        applyPhotoMetaStyles(node, entry?.meta || null);
        if (pendingSrc === nextSrc) {
          showInlineImageLoader(node);
        } else {
          hideInlineImageLoader(node);
        }
        return;
      }

      const seq = Number(node.__ebImageLoadSeq || 0) + 1;
      node.__ebImageLoadSeq = seq;
      node.__ebPendingImageSrc = nextSrc;

      if (node.__ebImageLoadTimer) {
        clearTimeout(node.__ebImageLoadTimer);
        node.__ebImageLoadTimer = 0;
      }

      const done = () => {
        if (Number(node.__ebImageLoadSeq || 0) !== seq) return;
        if (node.__ebImageLoadTimer) {
          clearTimeout(node.__ebImageLoadTimer);
          node.__ebImageLoadTimer = 0;
        }
        node.__ebPendingImageSrc = "";
        hideInlineImageLoader(node, seq);
      };

      node.addEventListener("load", done, { once: true });
      node.addEventListener("error", done, { once: true });

      node.__ebImageLoadTimer = setTimeout(done, 12000);

      showInlineImageLoader(node);
      node.setAttribute("src", nextSrc);
      applyPhotoMetaStyles(node, entry?.meta || null);

      if (node.complete && node.naturalWidth) {
        requestAnimationFrame(done);
      }

      return;
    }

    if (type === "link" && node.tagName === "A") {
      node.setAttribute("href", value || "#");
      if (!node.textContent.trim()) node.textContent = value || "Enlace";
      return;
    }

    if (type === "video_stream" && node.tagName === "VIDEO") {
      applyVideoStreamDomState(
        node,
        parseVideoStreamValue(value),
        state.mode === "edit" ? "edit" : "preview"
      );
      return;
    }

    if (type === "video_embed") {
      const normalized = stringifyVideoEmbedValue(parseVideoEmbedValue(value));
      const encodedValue = encodeEditorValueAttr(normalized);
      const renderMode = state.mode === "edit" ? "edit" : "preview";

      if ((node.getAttribute("data-eb-value") || "") === encodedValue &&
          node.dataset.ebRenderMode === renderMode &&
          node.dataset.ebRenderValue === encodedValue) {
        return;
      }

      node.setAttribute("data-eb-value", encodedValue);
      node.dataset.ebRenderMode = renderMode;
      node.dataset.ebRenderValue = encodedValue;
      node.innerHTML = renderMode === "edit"
        ? renderVideoEmbedEditorCard(parseVideoEmbedValue(normalized))
        : renderVideoEmbedPreview(parseVideoEmbedValue(normalized));
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
        showEditorError("EB-CONTENT-001");
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
        showEditorError("EB-CONTENT-001");
      }
    }
  }

  function applyDraftToFrame() {
    const frame = $("#editor-v2-frame");
    const doc = frame?.contentDocument;
    const draft = currentDraft();
    const elements = draft?.elements || {};
    if (!doc) return;

    Object.entries(elements).forEach(([key, entry]) => {
      const nodes = doc.querySelectorAll(`[data-eb-key="${CSS.escape(key)}"]`);
      nodes.forEach(node => {
        applyEntryToNode(node, key, entry);
      });
    });
  }

  loadEditor().catch(err => {
    console.error(err);
    hideFrameLoading();
    const code = classifyLoadError(err);
    if (!code) return;
    showEditorError(code);
  });
})();
