(() => {
  "use strict";

  const page = document.body?.dataset.portalPage;
  const portal = window.EBPortal || { configured: false, configError: "Supabase no está configurado." };
  const db = portal.client;
  const WHATSAPP = "529811332914";
  const CLAIM_KEY = "eb_project_claim";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safe = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const money = (value) => value == null || value === "" || Number.isNaN(Number(value)) ? "Por confirmar" : new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN" }).format(Number(value));
  const date = (value) => value ? new Intl.DateTimeFormat("es-MX", { day:"numeric", month:"short", year:"numeric" }).format(new Date(value)) : "—";
  const getParam = (name) => new URLSearchParams(location.search).get(name);
  const currentFile = () => location.pathname.split("/").pop() || "panel.html";

  const pendingQuote = () => {
    try { return JSON.parse(localStorage.getItem(portal.pendingQuoteKey || "eb_pending_quote") || "null"); }
    catch (_) { return null; }
  };
  const clearPendingQuote = () => localStorage.removeItem(portal.pendingQuoteKey || "eb_pending_quote");
  const pendingClaim = () => {
    try { return JSON.parse(localStorage.getItem(CLAIM_KEY) || "null"); }
    catch (_) { return null; }
  };
  const clearPendingClaim = () => localStorage.removeItem(CLAIM_KEY);

  function captureClaimFromUrl() {
    const id = getParam("claim");
    const token = getParam("token");
    if (!id || !token) return;
    localStorage.setItem(CLAIM_KEY, JSON.stringify({ id, token }));
  }

  function showConfigWarning() {
    const el = $("#config-warning");
    if (el) {
      el.hidden = false;
      el.textContent = "El portal no está disponible en este momento. Intenta nuevamente más tarde.";
    }
  }

  function setStatus(selector, text, tone = "") {
    const el = $(selector);
    if (!el) return;
    el.textContent = text;
    el.className = `form-status${tone ? ` ${tone}` : ""}`;
  }

  function statusClass(status = "") {
    const s = String(status).toLowerCase();
    if (/publicado|mantenimiento|entregado/.test(s)) return "status-live";
    if (/desarrollo|revisar|aprobado|contenido/.test(s)) return "status-progress";
    if (/esperando|pendiente/.test(s)) return "status-waiting";
    if (/cancelado|descartado/.test(s)) return "status-cancelled";
    if (/revisión|solicitud|cotización/.test(s)) return "status-review";
    return "";
  }

  function profileFromUser(user) {
    const meta = user?.user_metadata || {};
    return {
      id: user.id,
      full_name: meta.full_name || meta.name || "",
      email: user.email || "",
      phone: meta.phone || "",
      location: "",
      avatar_url: meta.avatar_url || meta.picture || "",
      onboarding_completed: false
    };
  }

  async function getSession() {
    if (!portal.configured) return null;
    return (await db.auth.getSession()).data.session;
  }

  async function requireSession() {
    const session = await getSession();
    if (!session) {
      localStorage.setItem(portal.authNextKey, `${currentFile()}${location.search}`);
      location.replace("acceso.html");
      throw new Error("AUTH_REDIRECT");
    }
    return session;
  }

  async function getProfile(user) {
    const { data, error } = await db.from("client_profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data || profileFromUser(user);
  }

  async function upsertProfile(values) {
    const { data, error } = await db.from("client_profiles").upsert(values, { onConflict: "id" }).select().single();
    if (error) throw error;
    return data;
  }

  function fillUserUI(profile, user) {
    $$('[data-user-name]').forEach((el) => el.textContent = profile.full_name || "Cliente");
    $$('[data-user-email]').forEach((el) => el.textContent = user.email || "");
    $$('[data-avatar]').forEach((el) => {
      const avatar = profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
      el.innerHTML = avatar
        ? `<img src="${safe(avatar)}" alt="">`
        : safe((profile.full_name || user.email || "EB").split(/\s+/).map((x) => x[0]).join("").slice(0,2).toUpperCase());
    });
  }

  async function loadContext() {
    const session = await requireSession();
    const profile = await getProfile(session.user);
    if (!profile.onboarding_completed) {
      localStorage.setItem(portal.authNextKey, `${currentFile()}${location.search}`);
      location.replace("acceso.html?complete=1");
      throw new Error("PROFILE_REDIRECT");
    }
    fillUserUI(profile, session.user);
    return { session, profile };
  }

  async function logout() {
    await db.auth.signOut();
    location.assign("acceso.html");
  }
  $$('[data-logout]').forEach((button) => button.addEventListener("click", logout));

  async function claimPendingProject() {
    const claim = pendingClaim();
    if (!claim) return null;
    const { data, error } = await db.rpc("claim_client_project", {
      p_project_id: claim.id,
      p_token: claim.token
    });
    if (error) throw error;
    clearPendingClaim();
    return data || claim.id;
  }

  async function createProjectFromPending(user) {
    const quote = pendingQuote();
    if (!quote) return null;

    let project = null;
    if (quote.quote_ref) {
      const { data: existing, error: existingError } = await db
        .from("client_projects")
        .select("*")
        .eq("quote_ref", quote.quote_ref)
        .maybeSingle();
      if (existingError) throw existingError;
      project = existing;
    }

    if (!project) {
      const { data, error } = await db.from("client_projects").insert({
        user_id: user.id,
        name: quote.project_name || "Nuevo sitio web",
        status: "Solicitud en revisión",
        project_stage: "Cotización",
        site_visibility: "hidden",
        site_url: null,
        preview_url: null,
        address_type: quote.address_type,
        domain: quote.address || quote.domain || null,
        hosting_type: quote.hosting_type,
        quote_ref: quote.quote_ref,
        source_prospect_id: quote.source_ref || null,
        claim_token: null,
        total_price: quote.initial_total,
        client_note: "Recibimos tu cotización. La revisaremos antes de confirmar precio, tiempos y cualquier servicio adicional."
      }).select().single();
      if (error) throw error;
      project = data;
    }

    const { data: existingQuote, error: quoteLookupError } = await db
      .from("client_quotes")
      .select("id")
      .eq("project_id", project.id)
      .limit(1)
      .maybeSingle();
    if (quoteLookupError) throw quoteLookupError;

    if (!existingQuote) {
      const { error: quoteError } = await db.from("client_quotes").insert({
        project_id: project.id,
        user_id: user.id,
        version: 1,
        creation_price: quote.creation_price,
        domain_first_year: quote.domain_first_year,
        domain_renewal: quote.domain_renewal,
        hosting_first_year: quote.hosting_first_year,
        hosting_renewal: quote.hosting_renewal,
        initial_total: quote.initial_total,
        annual_renewal: quote.annual_renewal,
        period_total: quote.period_total,
        period_years: quote.period_years,
        quote_data: quote
      });
      if (quoteError) throw quoteError;
    }

    clearPendingQuote();
    return project;
  }

  async function finishPendingAndRedirect(session, fallback = "panel.html") {
    const claim = pendingClaim();
    if (claim) {
      const projectId = await claimPendingProject();
      location.replace(`proyecto.html?id=${encodeURIComponent(projectId)}`);
      return;
    }

    const quote = pendingQuote();
    if (quote) {
      const project = await createProjectFromPending(session.user);
      location.replace(`proyecto.html?id=${encodeURIComponent(project.id)}`);
      return;
    }

    const next = portal.normalizeNext(localStorage.getItem(portal.authNextKey), fallback);
    localStorage.removeItem(portal.authNextKey);
    location.replace(next || fallback);
  }

  function updateAccessContext() {
    const box = $("#access-context");
    if (!box) return;
    const claim = pendingClaim();
    const quote = pendingQuote();
    if (claim) {
      box.hidden = false;
      box.innerHTML = "<strong>Tienes una invitación a un proyecto.</strong><br>Inicia sesión con Google y lo agregaremos automáticamente a tu cuenta.";
    } else if (quote) {
      box.hidden = false;
      box.innerHTML = `<strong>Tu cotización está lista.</strong><br>Inicia sesión para guardar <b>${safe(quote.project_name || "tu proyecto")}</b> y darle seguimiento.`;
    }
  }

  async function initAccess() {
    captureClaimFromUrl();
    updateAccessContext();
    if (!portal.configured) {
      showConfigWarning();
      if ($("#google-login")) $("#google-login").disabled = true;
      return;
    }

    const session = await getSession();
    const loginView = $("#login-view");
    const profileView = $("#profile-view");

    if (session) {
      const profile = await getProfile(session.user);
      if (profile.onboarding_completed) {
        await finishPendingAndRedirect(session);
        return;
      }

      loginView.hidden = true;
      profileView.hidden = false;
      const form = $("#onboarding-form");
      form.full_name.value = profile.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";
      form.email.value = session.user.email || "";
      form.phone.value = profile.phone || "";
      form.location.value = profile.location || "";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fd = new FormData(form);
        const fullName = String(fd.get("full_name") || "").trim();
        const phone = String(fd.get("phone") || "").replace(/\D/g, "");
        if (!fullName || phone.length < 10) {
          setStatus("#profile-status", "Escribe tu nombre completo y un WhatsApp válido.", "error");
          return;
        }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        setStatus("#profile-status", "Guardando tu perfil…");
        try {
          await upsertProfile({
            id: session.user.id,
            full_name: fullName,
            email: session.user.email,
            phone,
            location: String(fd.get("location") || "").trim(),
            avatar_url: profile.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          });
          setStatus("#profile-status", "Perfil confirmado.", "success");
          await finishPendingAndRedirect(session);
        } catch (error) {
          setStatus("#profile-status", error.message || "No pudimos guardar tu perfil.", "error");
          button.disabled = false;
        }
      });
      return;
    }

    $("#google-login")?.addEventListener("click", async () => {
      const button = $("#google-login");
      button.disabled = true;
      setStatus("#auth-status", "Abriendo Google…");
      const next = getParam("next") || "panel.html";
      localStorage.setItem(portal.authNextKey, next);
      const { error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: portal.callbackUrl(), scopes: "openid email profile" }
      });
      if (error) {
        setStatus("#auth-status", error.message, "error");
        button.disabled = false;
      }
    });
  }

  async function initCallback() {
    if (!portal.configured) { showConfigWarning(); return; }
    const status = $("#callback-status");
    try {
      let session = await getSession();
      const code = getParam("code");
      if (!session && code) {
        status.textContent = "Confirmando tu acceso…";
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (error) throw error;
        session = await getSession();
      }
      if (!session) throw new Error("No se pudo crear la sesión. Vuelve a intentarlo.");
      const profile = await getProfile(session.user);
      if (!profile.onboarding_completed) {
        location.replace("acceso.html?complete=1");
        return;
      }
      status.textContent = "Cuenta confirmada. Preparando tus proyectos…";
      await finishPendingAndRedirect(session);
    } catch (error) {
      status.textContent = error.message || "No se pudo completar el acceso.";
    }
  }

  function projectIsLive(project) {
    return project.site_visibility === "public" && Boolean(project.site_url);
  }

  function projectIsActive(project) {
    return !projectIsLive(project) && !/cancelado|descartado/i.test(project.status || "");
  }

  function friendlyProjectStatus(project) {
    const raw = `${project.project_stage || ""} ${project.status || ""}`.toLowerCase();
    if (project.site_visibility === "public" && project.site_url) return "Tu página ya está publicada y lista para compartir.";
    if (project.site_visibility === "preview" && (project.preview_url || project.site_url)) return "Ya tienes un avance disponible para revisar.";
    if (/cancelado|descartado/.test(raw)) return "Este proyecto no está activo en este momento.";
    if (/esperando|contenido|información/.test(raw)) return "Necesitamos algunos datos tuyos para poder continuar.";
    if (/desarrollo|revisión|revisar/.test(raw)) return "Estamos trabajando en tu página.";
    if (/aprobado|aceptado|anticipo/.test(raw)) return "Tu proyecto está aprobado y listo para avanzar.";
    return "Recibimos tu solicitud y la estamos revisando.";
  }

  function siteAction(project, compact = false) {
    const cls = compact ? "button button-light button-small" : "button button-light";
    if (project.site_visibility === "public" && project.site_url) {
      return `<a class="${cls}" href="${safe(project.site_url)}" target="_blank" rel="noopener">Abrir mi página</a>`;
    }
    if (project.site_visibility === "preview" && (project.preview_url || project.site_url)) {
      return `<a class="${cls}" href="${safe(project.preview_url || project.site_url)}" target="_blank" rel="noopener">Ver avance</a>`;
    }
    return "";
  }

  async function initPanel() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext();
    $('[data-side="projects"]')?.classList.add("active");
    $("#panel-first-name").textContent = (profile.full_name || "cliente").split(/\s+/)[0];

    const banner = $("#pending-banner");
    if (pendingQuote()) banner.hidden = false;
    $("#save-pending-quote")?.addEventListener("click", async () => {
      const btn = $("#save-pending-quote");
      btn.disabled = true;
      btn.textContent = "Guardando…";
      try {
        const project = await createProjectFromPending(session.user);
        location.assign(`proyecto.html?id=${encodeURIComponent(project.id)}`);
      } catch (error) {
        alert(error.message || "No se pudo guardar la cotización.");
        btn.disabled = false;
        btn.textContent = "Guardar cotización";
      }
    });

    const [{ data: projects, error }, { data: requests }] = await Promise.all([
      db.from("client_projects").select("*").order("created_at", { ascending: false }),
      db.from("client_requests").select("id,status").neq("status", "Cerrada")
    ]);
    if (error) throw error;

    $("#stat-projects").textContent = projects.length;
    $("#stat-active").textContent = projects.filter(projectIsActive).length;
    $("#stat-live").textContent = projects.filter(projectIsLive).length;
    $("#stat-requests").textContent = requests?.filter((r) => !/cerrada|resuelta/i.test(r.status || "")).length || 0;

    const grid = $("#projects-grid");
    let filter = "all";

    const render = () => {
      const visible = projects.filter((project) => filter === "all" || (filter === "active" ? projectIsActive(project) : projectIsLive(project)));
      if (!visible.length) {
        grid.innerHTML = `<div class="empty-card" style="grid-column:1/-1"><h3>${projects.length ? "No hay proyectos en esta categoría" : "Aún no tienes proyectos"}</h3><p>${projects.length ? "Prueba otra vista." : "Cuando guardes una cotización o recibas una invitación, aparecerá aquí."}</p>${projects.length ? "" : '<a class="button button-primary" href="cotizar.html">Cotizar mi primera página</a>'}</div>`;
        return;
      }
      grid.innerHTML = visible.map((project) => `
        <article class="project-card">
          <div class="project-card-top"><span class="status-badge ${statusClass(project.status)}">${safe(project.status || "En revisión")}</span><small>${date(project.created_at)}</small></div>
          <h3>${safe(project.name)}</h3>
          <p>${safe(project.domain || "La dirección se definirá más adelante")}</p>
          <p class="project-friendly-status">${safe(friendlyProjectStatus(project))}</p>
          <div class="project-meta"><div><span>En qué vamos</span><strong>${safe(project.project_stage || "Cotización")}</strong></div><div><span>Publicación</span><strong>${project.site_visibility === "public" ? "Página disponible" : project.site_visibility === "preview" ? "Avance disponible" : "Todavía no disponible"}</strong></div></div>
          <div class="card-actions"><a class="button button-primary button-small" href="proyecto.html?id=${encodeURIComponent(project.id)}">Abrir proyecto</a>${siteAction(project, true)}</div>
        </article>`).join("");
    };

    $$("#project-filters [data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        filter = button.dataset.filter;
        $$("#project-filters [data-filter]").forEach((b) => b.classList.toggle("active", b === button));
        render();
      });
    });
    render();
  }

  async function initProfile() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext();
    $('[data-side="profile"]')?.classList.add("active");
    const form = $("#profile-form");
    ["full_name","email","phone","location"].forEach((name) => {
      if (form[name]) form[name].value = name === "email" ? session.user.email || "" : profile[name] || "";
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const phone = String(fd.get("phone") || "").replace(/\D/g, "");
      if (phone.length < 10) { setStatus("#profile-page-status", "Escribe un WhatsApp válido.", "error"); return; }
      button.disabled = true;
      try {
        const saved = await upsertProfile({
          id: session.user.id,
          full_name: String(fd.get("full_name") || "").trim(),
          email: session.user.email,
          phone,
          location: String(fd.get("location") || "").trim(),
          avatar_url: profile.avatar_url,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        });
        fillUserUI(saved, session.user);
        setStatus("#profile-page-status", "Cambios guardados.", "success");
      } catch (error) {
        setStatus("#profile-page-status", error.message || "No pudimos guardar los cambios.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  const requestLabels = {
    mantenimiento:["Necesito mantenimiento","Revisar algo que no funciona o necesita atención."],
    actualizar:["Quiero actualizar información","Cambiar textos, fotos, horarios, precios o datos."],
    cambio:["Quiero hacer un cambio","Modificar una parte de mi página."],
    mejorar:["Quiero agregar algo nuevo","Agregar una sección, función o mejora."],
    dominio:["Quiero un dominio propio","Cambiar el enlace gratuito por una dirección como tunegocio.com."],
    hosting:["Necesito funciones avanzadas","Revisar si mi proyecto necesita alojamiento especializado."]
  };

  const stageLabels = ["Cotización","Aprobación","Contenido","Desarrollo","Publicado"];
  function stagePosition(project) {
    const raw = `${project.project_stage || ""} ${project.status || ""}`.toLowerCase();
    if (/publicado|mantenimiento|entregado/.test(raw)) return 4;
    if (/desarrollo|revisión|revisar/.test(raw)) return 3;
    if (/contenido|información|esperando/.test(raw)) return 2;
    if (/aprobado|aceptado|anticipo/.test(raw)) return 1;
    return 0;
  }

  function renderAvailability(project) {
    const box = $("#project-availability");
    if (!box) return;
    if (project.site_visibility === "public" && project.site_url) {
      box.innerHTML = `<div class="availability-box public"><div><strong>Tu página ya está en internet</strong><span>Puedes abrirla y compartirla con tus clientes.</span></div>${siteAction(project)}</div>`;
      return;
    }
    if (project.site_visibility === "preview" && (project.preview_url || project.site_url)) {
      box.innerHTML = `<div class="availability-box preview"><div><strong>Ya puedes revisar un avance</strong><span>Ábrelo, revísalo con calma y dinos si quieres cambiar algo.</span></div>${siteAction(project)}</div>`;
      return;
    }
    box.innerHTML = `<div class="availability-box hidden-site"><div><strong>Estamos preparando tu página</strong><span>Cuando tengamos algo listo para enseñarte, aquí aparecerá el botón para verlo.</span></div></div>`;
  }

  async function initProject() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext();
    $('[data-side="projects"]')?.classList.add("active");
    const id = getParam("id");
    if (!id) { location.replace("panel.html"); return; }

    const { data: project, error } = await db.from("client_projects").select("*").eq("id", id).single();
    if (error) throw error;
    const [{ data: quotes }, { data: requests }, { data: updates }, briefResult] = await Promise.all([
      db.from("client_quotes").select("*").eq("project_id", id).order("version", { ascending:false }).limit(1),
      db.from("client_requests").select("*").eq("project_id", id).order("created_at", { ascending:false }),
      db.from("client_updates").select("*").eq("project_id", id).order("created_at", { ascending:false }),
      db.from("client_project_briefs").select("*").eq("project_id", id).maybeSingle()
    ]);
    if (briefResult.error) throw briefResult.error;
    let brief = briefResult.data;

    const quote = quotes?.[0];
    document.title = `${project.name} | Excepcional Build`;
    $("#project-title").textContent = project.name;
    $("#project-subtitle").innerHTML = `<span class="status-badge ${statusClass(project.status)}">${safe(project.status)}</span>`;
    $("#project-top-actions").innerHTML = siteAction(project);
    renderAvailability(project);

    const pos = stagePosition(project);
    $("#project-stage-track").innerHTML = stageLabels.map((label, index) => `<div class="stage-step ${index < pos ? "done" : index === pos ? "current" : ""}"><i>${index < pos ? "✓" : index + 1}</i><span>${label}</span></div>`).join("");
    if (project.client_note) {
      $("#project-client-note").hidden = false;
      $("#project-client-note").textContent = project.client_note;
    }

    $("#project-details").innerHTML = [
      ["Dirección de la página", project.domain || "Por definir"],
      ["Tipo de dirección", project.address_type === "dominio" ? "Dominio propio" : "Enlace gratuito"],
      ["Alojamiento", project.hosting_type === "hostinger" ? "Especializado" : "Gratuito"],
      ["Fecha de inicio", date(project.created_at)]
    ].map(([a,b]) => `<div class="detail"><span>${a}</span><strong>${safe(b)}</strong></div>`).join("");

    const briefForm = $("#project-brief-form");
    const briefFields = ["business_description","products_services","address_text","schedule_text","public_phone","social_links","visual_notes","extra_notes"];
    briefFields.forEach((name) => { if (briefForm?.elements[name]) briefForm.elements[name].value = brief?.[name] || ""; });
    const briefWhatsapp = $("#brief-whatsapp");
    if (briefWhatsapp) {
      const briefMessage = [`Hola, soy ${profile.full_name}.`, `Quiero enviar fotografías para mi proyecto: ${project.name}.`, `Referencia: ${project.quote_ref || project.id}`].join("\n");
      briefWhatsapp.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(briefMessage)}`;
    }
    briefForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(briefForm);
      const button = briefForm.querySelector('button[type="submit"]');
      button.disabled = true;
      setStatus("#brief-status", "Guardando información…");
      const payload = { project_id:id, user_id:session.user.id, submitted_at:new Date().toISOString() };
      briefFields.forEach((name) => payload[name] = String(fd.get(name) || "").trim() || null);
      const { data: savedBrief, error: briefError } = await db.from("client_project_briefs").upsert(payload, { onConflict:"project_id" }).select().single();
      if (briefError) {
        setStatus("#brief-status", briefError.message || "No pudimos guardar la información.", "error");
      } else {
        brief = savedBrief;
        setStatus("#brief-status", "Listo. Guardamos la información.", "success");
      }
      button.disabled = false;
    });

    const hasPayments = [project.deposit_amount, project.balance_amount].some((v) => v != null && v !== "") || project.deposit_paid || project.balance_paid;
    if (hasPayments) {
      $("#payment-card").hidden = false;
      $("#project-payments").innerHTML = `
        <div class="payment-box"><span>Total acordado</span><strong>${money(project.total_price)}</strong></div>
        <div class="payment-box"><span>Anticipo</span><strong>${money(project.deposit_amount)}</strong><em class="payment-state ${project.deposit_paid ? "paid" : ""}">${project.deposit_paid ? "Pagado" : "Pendiente"}</em></div>
        <div class="payment-box"><span>Saldo final</span><strong>${money(project.balance_amount)}</strong><em class="payment-state ${project.balance_paid ? "paid" : ""}">${project.balance_paid ? "Pagado" : "Pendiente"}</em></div>`;
    }

    const types = ["mantenimiento","actualizar","cambio","mejorar"];
    if (project.address_type === "gratis") types.push("dominio");
    if (project.hosting_type === "cloudflare") types.push("hosting");
    $("#project-actions").innerHTML = types.map((type) => `<button class="action-card" type="button" data-request-type="${type}"><b>${requestLabels[type][0]}</b><span>${requestLabels[type][1]}</span></button>`).join("");

    $("#quote-summary").innerHTML = quote ? `<div class="project-meta"><div><span>Pago inicial estimado</span><strong>${money(quote.initial_total)}</strong></div><div><span>Renovación anual</span><strong>${Number(quote.annual_renewal) > 0 ? money(quote.annual_renewal) : "Sin renovación"}</strong></div></div><p style="margin:12px 0 0;color:var(--muted);font-size:11px;line-height:1.5">Cotización guardada el ${date(quote.created_at)}. Confirmaremos contigo cualquier cambio antes de cobrar.</p>` : `<p style="color:var(--muted);font-size:12px">Este proyecto todavía no tiene una cotización guardada.</p>`;

    $("#project-timeline").innerHTML = updates?.length
      ? updates.map((u) => `<article class="timeline-item"><h3>${safe(u.title)}</h3><p>${safe(u.description || "")}</p><time>${date(u.created_at)}</time></article>`).join("")
      : `<article class="timeline-item"><h3>Proyecto registrado</h3><p>Cuando actualicemos el avance del trabajo aparecerá aquí.</p><time>${date(project.created_at)}</time></article>`;

    const renderRequests = () => {
      $("#request-list").innerHTML = requests?.length
        ? requests.map((r) => `<article class="request-item"><strong><span>${safe(requestLabels[r.request_type]?.[0] || r.request_type)}</span><small>${safe(r.status)}</small></strong><p>${safe(r.message)}</p><small>${date(r.created_at)}</small></article>`).join("")
        : `<p style="color:var(--muted);font-size:12px">Todavía no has enviado solicitudes.</p>`;
    };
    renderRequests();

    const dialog = $("#request-dialog");
    const form = $("#request-form");
    $$('[data-request-type]').forEach((btn) => btn.addEventListener("click", () => {
      const type = btn.dataset.requestType;
      form.request_type.value = type;
      $("#request-title").textContent = requestLabels[type][0];
      form.message.value = "";
      setStatus("#request-status", "");
      dialog.showModal();
    }));
    $$('[data-dialog-close]').forEach((btn) => btn.addEventListener("click", () => dialog.close()));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const type = String(fd.get("request_type"));
      const message = String(fd.get("message") || "").trim();
      if (!message) { setStatus("#request-status", "Describe lo que necesitas.", "error"); return; }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus("#request-status", "Registrando solicitud…");
      try {
        const { data: req, error: reqError } = await db.from("client_requests").insert({
          project_id: id,
          user_id: session.user.id,
          request_type: type,
          message,
          status: "Nueva"
        }).select().single();
        if (reqError) throw reqError;
        requests.unshift(req);
        renderRequests();
        const text = [
          `Hola, soy ${profile.full_name}.`, "",
          `Quiero: ${requestLabels[type][0]}.`,
          `Proyecto: ${project.name}`,
          `Referencia: ${project.quote_ref || project.id}`,
          project.domain ? `Sitio o dominio: ${project.domain}` : "",
          `Detalles: ${message}`
        ].filter(Boolean).join("\n");
        location.assign(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`);
      } catch (err) {
        setStatus("#request-status", err.message || "No pudimos registrar la solicitud.", "error");
        submit.disabled = false;
      }
    });
  }

  async function start() {
    try {
      if (page === "access") await initAccess();
      else if (page === "callback") await initCallback();
      else if (page === "panel") await initPanel();
      else if (page === "profile") await initProfile();
      else if (page === "project") await initProject();
    } catch (error) {
      if (["AUTH_REDIRECT","PROFILE_REDIRECT"].includes(error.message)) return;
      console.error(error);
      const rawMessage = String(error?.message || "");
      const technical = /supabase|postgres|postgrest|row level|jwt|relation|column|schema|fetch/i.test(rawMessage);
      const message = technical ? "No pudimos cargar esta información. Intenta nuevamente en unos momentos." : (rawMessage || "Ocurrió un problema al cargar el portal.");
      const status = $("#auth-status") || $("#callback-status") || $("#profile-page-status") || $("#request-status");
      if (status) status.textContent = message;
      const grid = $("#projects-grid");
      if (grid) grid.innerHTML = `<div class="empty-card" style="grid-column:1/-1"><h3>No pudimos cargar tus proyectos</h3><p>${safe(message)}</p></div>`;
    }
  }

  start();
})();
