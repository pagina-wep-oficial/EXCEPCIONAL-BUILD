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
    currentSectionId: "",
    mode: "edit"
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
    renderCurrentPage();
    bindActions();
  }

  function currentPage() {
    return state.pages.find(p => p.id === state.currentPageId) || null;
  }

  function currentDraft() {
    const map = state.versions.get(state.currentPageId) || {};
    return map.draft || null;
  }

  function currentSections() {
    return currentDraft()?.content_json?.sections || [];
  }

  function renderPageTabs() {
    const wrap = $("#editor-v2-page-tabs");
    wrap.innerHTML = state.pages.map(page => `
      <button class="editor-page-tab ${page.id === state.currentPageId ? "active" : ""}" type="button" data-page-id="${page.id}">
        ${safe(page.name)}
      </button>
    `).join("");
  }

  function renderCurrentPage() {
    const page = currentPage();
    const draft = currentDraft();
    const sections = draft?.content_json?.sections || [];

    $("#editor-v2-current-page").textContent = page?.name || "Página";
    $("#editor-v2-mode-badge").textContent = state.mode === "preview" ? "Vista previa" : "Modo edición";
    $("#editor-v2-current-state").textContent =
      state.mode === "preview"
        ? "Navega esta página como visitante antes de publicar."
        : "Edita esta página bloque por bloque.";

    const canvas = $("#editor-v2-canvas");
    canvas.classList.toggle("is-edit", state.mode === "edit");

    canvas.innerHTML = sections.length
      ? sections.map(section => renderSection(section)).join("")
      : `<article class="editor-section"><p>Esta página todavía no tiene bloques cargados.</p></article>`;

    if (state.mode === "edit") {
      canvas.querySelectorAll("[data-section-id]").forEach(el => {
        el.addEventListener("click", () => {
          state.currentSectionId = el.dataset.sectionId;
          renderCurrentPage();
          renderSidebar();
        });
      });
    }

    renderSidebar();
  }

  function renderSection(section) {
    const hidden = section.visible === false;
    const active = state.currentSectionId === section.id;
    const data = section.data || {};

    if (section.type === "hero") {
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Hero")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.title || "Título principal")}</h3>
          <p>${safe(data.subtitle || "Subtítulo del bloque hero.")}</p>
          <div class="editor-section-media">Imagen: ${safe(data.image_url || "Sin imagen")}</div>
        </article>
      `;
    }

    if (section.type === "text") {
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Texto")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.heading || "Encabezado")}</h3>
          <p>${safe(data.body || "Texto informativo.")}</p>
        </article>
      `;
    }

    if (section.type === "contact") {
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Contacto")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>Contacto</h3>
          <ul class="editor-section-list">
            <li>WhatsApp: ${safe(data.whatsapp || "Sin definir")}</li>
            <li>Correo: ${safe(data.email || "Sin definir")}</li>
            <li>Dirección: ${safe(data.address || "Sin definir")}</li>
          </ul>
        </article>
      `;
    }

    if (section.type === "hours") {
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Horarios")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.days_text || "Días de atención")}</h3>
          <p>${safe(data.hours_text || "Horario pendiente")}</p>
        </article>
      `;
    }

    if (section.type === "features") {
      const items = Array.isArray(data.items) ? data.items : [];
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Ventajas")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.heading || "Lo que ofreces")}</h3>
          <ul class="editor-section-list">
            ${(items.length ? items : ["Sin elementos todavía"]).map(item => `<li>${safe(item)}</li>`).join("")}
          </ul>
        </article>
      `;
    }

    if (section.type === "gallery") {
      const images = Array.isArray(data.images) ? data.images : [];
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Galería")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.heading || "Galería")}</h3>
          <div class="editor-section-media">${images.length} imagen${images.length === 1 ? "" : "es"} cargada${images.length === 1 ? "" : "s"}</div>
          <ul class="editor-section-list">
            ${(images.length ? images : [{ caption: "Sin imágenes todavía" }]).map(img => `<li>${safe(img.caption || img.alt || img.url || "Imagen")}</li>`).join("")}
          </ul>
        </article>
      `;
    }

    if (section.type === "video") {
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Video")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.title || "Video principal")}</h3>
          <p>${safe(data.description || "Sin descripción todavía.")}</p>
          <div class="editor-section-media">Video: ${safe(data.video_url || "Sin video")}</div>
        </article>
      `;
    }

    if (section.type === "buttons") {
      const items = Array.isArray(data.items) ? data.items : [];
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Botones")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>Acciones</h3>
          <ul class="editor-section-list">
            ${(items.length ? items : [{ label: "Sin botones todavía" }]).map(item => `<li>${safe(item.label || "Botón")}</li>`).join("")}
          </ul>
        </article>
      `;
    }

    if (section.type === "testimonials") {
      const items = Array.isArray(data.items) ? data.items : [];
      return `
        <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
          <div class="editor-section-head">
            <span class="editor-section-tag">${safe(section.label || "Testimonios")}</span>
            <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
          </div>
          <h3>${safe(data.heading || "Opiniones de clientes")}</h3>
          <ul class="editor-section-list">
            ${(items.length ? items : [{ name: "Sin testimonios todavía", text: "" }]).map(item => `<li>${safe(item.name || "Cliente")}${item.text ? `: ${safe(item.text)}` : ""}</li>`).join("")}
          </ul>
        </article>
      `;
    }

    return `
      <article class="editor-section ${hidden ? "editor-section-hidden" : ""} ${active ? "active" : ""}" data-section-id="${section.id}">
        <div class="editor-section-head">
          <span class="editor-section-tag">${safe(section.label || section.type || "Bloque")}</span>
          <span class="editor-section-state">${hidden ? "Oculto" : "Visible"}</span>
        </div>
        <p>Bloque tipo <strong>${safe(section.type)}</strong>. Aquí iremos conectando su editor específico.</p>
      </article>
    `;
  }

  function renderSidebar() {
    const empty = $("#editor-v2-sidebar-empty");
    const form = $("#editor-v2-form");
    const fields = $("#editor-v2-fields");

    if (!state.currentSectionId || state.mode !== "edit") {
      empty.hidden = false;
      form.hidden = true;
      return;
    }

    const section = currentSections().find(s => s.id === state.currentSectionId);
    if (!section) {
      empty.hidden = false;
      form.hidden = true;
      return;
    }

    empty.hidden = true;
    form.hidden = false;

    $("#editor-v2-section-title").textContent = section.label || section.type || "Sección";
    $("#editor-v2-section-visible").checked = section.visible !== false;

    fields.innerHTML = buildFields(section);

    $("#editor-v2-section-visible").onchange = e => {
      section.visible = e.currentTarget.checked;
      renderCurrentPage();
    };

    fields.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("input", e => {
        const key = e.currentTarget.dataset.field;
        section.data = section.data || {};

        if (key === "items_text") {
          section.data.items = String(e.currentTarget.value || "")
            .split("\n")
            .map(v => v.trim())
            .filter(Boolean);
        } else if (key === "images_json") {
          try {
            const parsed = JSON.parse(e.currentTarget.value || "[]");
            section.data.images = Array.isArray(parsed) ? parsed : [];
          } catch {}
        } else if (key === "items_json") {
          try {
            const parsed = JSON.parse(e.currentTarget.value || "[]");
            section.data.items = Array.isArray(parsed) ? parsed : [];
          } catch {}
        } else {
          section.data[key] = e.currentTarget.value;
        }

        renderCurrentPage();
      });
    });
  }

  function buildFields(section) {
    const data = section.data || {};

    if (section.type === "hero") {
      return `
        ${field("Título", "title", data.title || "")}
        ${textareaField("Subtítulo", "subtitle", data.subtitle || "")}
        ${field("Texto del botón", "button_text", data.button_text || "")}
        ${field("URL del botón", "button_url", data.button_url || "")}
        ${field("URL de imagen", "image_url", data.image_url || "")}
        ${field("Texto alternativo", "image_alt", data.image_alt || "")}
      `;
    }

    if (section.type === "text") {
      return `
        ${field("Encabezado", "heading", data.heading || "")}
        ${textareaField("Texto", "body", data.body || "")}
      `;
    }

    if (section.type === "contact") {
      return `
        ${field("Teléfono", "phone", data.phone || "")}
        ${field("WhatsApp", "whatsapp", data.whatsapp || "")}
        ${field("Correo", "email", data.email || "")}
        ${field("Dirección", "address", data.address || "")}
        ${field("Mapa URL", "maps_url", data.maps_url || "")}
      `;
    }

    if (section.type === "hours") {
      return `
        ${field("Días", "days_text", data.days_text || "")}
        ${field("Horario", "hours_text", data.hours_text || "")}
      `;
    }

    if (section.type === "features") {
      return `
        ${field("Encabezado", "heading", data.heading || "")}
        ${textareaField("Elementos (uno por línea)", "items_text", Array.isArray(data.items) ? data.items.join("\n") : "")}
      `;
    }

    if (section.type === "gallery") {
      return `
        ${field("Encabezado", "heading", data.heading || "")}
        ${textareaField("Imágenes JSON", "images_json", JSON.stringify(Array.isArray(data.images) ? data.images : [], null, 2))}
      `;
    }

    if (section.type === "video") {
      return `
        ${field("Título", "title", data.title || "")}
        ${textareaField("Descripción", "description", data.description || "")}
        ${field("URL del video", "video_url", data.video_url || "")}
        ${field("Poster URL", "poster_url", data.poster_url || "")}
      `;
    }

    if (section.type === "buttons") {
      return `
        ${textareaField("Botones JSON", "items_json", JSON.stringify(Array.isArray(data.items) ? data.items : [], null, 2))}
      `;
    }

    if (section.type === "testimonials") {
      return `
        ${field("Encabezado", "heading", data.heading || "")}
        ${textareaField("Testimonios JSON", "items_json", JSON.stringify(Array.isArray(data.items) ? data.items : [], null, 2))}
      `;
    }

    return `<p>Este bloque aún no tiene formulario específico en el MVP inicial.</p>`;
  }

  function field(label, key, value) {
    return `
      <label class="editor-field">
        <span>${safe(label)}</span>
        <input type="text" data-field="${safe(key)}" value="${safe(value)}">
      </label>
    `;
  }

  function textareaField(label, key, value) {
    return `
      <label class="editor-field">
        <span>${safe(label)}</span>
        <textarea data-field="${safe(key)}">${safe(value)}</textarea>
      </label>
    `;
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
    $("#editor-v2-preview").textContent = state.mode === "preview" ? "Seguir editando" : "Vista previa";
    renderCurrentPage();
  }

  function bindActions() {
    $("#editor-v2-page-tabs").addEventListener("click", e => {
      const btn = e.target.closest("[data-page-id]");
      if (!btn) return;
      state.currentPageId = btn.dataset.pageId;
      state.currentSectionId = "";
      renderPageTabs();
      renderCurrentPage();
    });

    $("#editor-v2-save").onclick = saveDraft;
    $("#editor-v2-publish").onclick = publishDraft;
    $("#editor-v2-reset").onclick = resetDraft;
    $("#editor-v2-preview").onclick = togglePreview;
  }

  loadEditor().catch(err => {
    console.error(err);
    setStatus(err.message || "No pudimos abrir el editor.", "error");
  });
})();