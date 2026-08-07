(() => {
  "use strict";
  const page = document.body?.dataset.portalPage;
  const portal = window.EBPortal || { configured: false, configError: "Supabase no está configurado." };
  const db = portal.client;
  const WHATSAPP = "529811332914";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const safe = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const money = (value) => value == null || Number.isNaN(Number(value)) ? "Por confirmar" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
  const date = (value) => value ? new Intl.DateTimeFormat("es-MX", { day:"numeric", month:"short", year:"numeric" }).format(new Date(value)) : "—";
  const getParam = (name) => new URLSearchParams(location.search).get(name);
  const pendingQuote = () => { try { return JSON.parse(localStorage.getItem(portal.pendingQuoteKey || "eb_pending_quote") || "null"); } catch (_) { return null; } };
  const clearPendingQuote = () => localStorage.removeItem(portal.pendingQuoteKey || "eb_pending_quote");

  function showConfigWarning() {
    const el = $("#config-warning");
    if (el) { el.hidden = false; el.textContent = portal.configError || "Falta configurar Supabase."; }
  }
  function setStatus(selector, text, tone = "") {
    const el = $(selector); if (!el) return;
    el.textContent = text; el.className = `form-status${tone ? ` ${tone}` : ""}`;
  }
  function statusClass(status = "") {
    const s = status.toLowerCase();
    if (/publicado|mantenimiento/.test(s)) return "status-live";
    if (/desarrollo|revisar|aprobado/.test(s)) return "status-progress";
    if (/esperando/.test(s)) return "status-waiting";
    if (/cancelado/.test(s)) return "status-cancelled";
    if (/revisión|solicitud/.test(s)) return "status-review";
    return "";
  }
  function profileFromUser(user) {
    const meta = user?.user_metadata || {};
    return {
      id: user.id,
      full_name: meta.full_name || meta.name || "",
      email: user.email || "",
      phone: meta.phone || "",
      business_name: "",
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
      localStorage.setItem(portal.authNextKey, `${location.pathname.split("/").pop()}${location.search}`);
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
    $$('[data-user-name]').forEach(el => el.textContent = profile.full_name || "Cliente");
    $$('[data-user-email]').forEach(el => el.textContent = user.email || "");
    $$('[data-avatar]').forEach(el => {
      const avatar = profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
      el.innerHTML = avatar ? `<img src="${safe(avatar)}" alt="">` : safe((profile.full_name || user.email || "EB").split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase());
    });
  }
  async function logout() { await db.auth.signOut(); location.assign("acceso.html"); }
  $$('[data-logout]').forEach(button => button.addEventListener("click", logout));

  async function createProjectFromPending(user) {
    const quote = pendingQuote();
    if (!quote) return null;
    const siteUrl = quote.address_type === "gratis" && quote.address ? `https://${quote.address}` : null;
    let project = null;
    if (quote.quote_ref) {
      const { data: existing, error: existingError } = await db.from("client_projects").select("*").eq("quote_ref", quote.quote_ref).maybeSingle();
      if (existingError) throw existingError;
      project = existing;
    }
    if (!project) {
      const { data, error: projectError } = await db.from("client_projects").insert({
        user_id: user.id,
        name: quote.project_name || "Nuevo sitio web",
        status: "Cotización preparada",
        site_url: siteUrl,
        address_type: quote.address_type,
        domain: quote.address || quote.domain || null,
        hosting_type: quote.hosting_type,
        quote_ref: quote.quote_ref
      }).select().single();
      if (projectError) throw projectError;
      project = data;
    }
    const { data: existingQuote, error: quoteLookupError } = await db.from("client_quotes").select("id").eq("project_id", project.id).limit(1).maybeSingle();
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

  async function initAccess() {
    if (!portal.configured) { showConfigWarning(); $("#google-login").disabled = true; return; }
    const session = await getSession();
    const loginView = $("#login-view"); const profileView = $("#profile-view");
    if (session) {
      const profile = await getProfile(session.user);
      if (profile.onboarding_completed) { await finishPendingAndRedirect(session); return; }
      loginView.hidden = true; profileView.hidden = false;
      const form = $("#onboarding-form");
      form.full_name.value = profile.full_name || session.user.user_metadata?.full_name || "";
      form.email.value = session.user.email || "";
      form.phone.value = profile.phone || "";
      form.business_name.value = profile.business_name || "";
      form.location.value = profile.location || "";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fd = new FormData(form);
        const fullName = String(fd.get("full_name") || "").trim();
        const phone = String(fd.get("phone") || "").replace(/\D/g, "");
        if (!fullName || phone.length < 10) { setStatus("#profile-status", "Escribe tu nombre completo y un número de WhatsApp válido.", "error"); return; }
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        setStatus("#profile-status", "Guardando tu perfil…");
        try {
          await upsertProfile({
            id: session.user.id, full_name: fullName, email: session.user.email, phone,
            business_name: String(fd.get("business_name") || "").trim(),
            location: String(fd.get("location") || "").trim(),
            avatar_url: profile.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
            onboarding_completed: true, updated_at: new Date().toISOString()
          });
          setStatus("#profile-status", "Perfil confirmado.", "success");
          await finishPendingAndRedirect(session);
        } catch (error) { setStatus("#profile-status", error.message || "No pudimos guardar tu perfil.", "error"); button.disabled = false; }
      });
      return;
    }
    $("#google-login").addEventListener("click", async () => {
      const button = $("#google-login"); button.disabled = true; setStatus("#auth-status", "Abriendo Google…");
      const next = getParam("next") || (getParam("quote") ? "panel.html" : "panel.html");
      localStorage.setItem(portal.authNextKey, next);
      const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: portal.callbackUrl(), scopes: "openid email profile" } });
      if (error) { setStatus("#auth-status", error.message, "error"); button.disabled = false; }
    });
  }

  async function initCallback() {
    if (!portal.configured) { showConfigWarning(); return; }
    const status = $("#callback-status");
    try {
      let session = await getSession();
      const code = getParam("code");
      if (!session && code) {
        status.textContent = "Confirmando el acceso con Supabase…";
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (error) throw error;
        session = await getSession();
      }
      if (!session) throw new Error("No se pudo crear la sesión. Vuelve a intentarlo.");
      const profile = await getProfile(session.user);
      if (!profile.onboarding_completed) { location.replace("acceso.html?complete=1"); return; }
      status.textContent = "Cuenta confirmada. Preparando tus proyectos…";
      await finishPendingAndRedirect(session);
    } catch (error) { status.textContent = error.message || "No se pudo completar el acceso."; }
  }

  async function loadContext() {
    const session = await requireSession();
    const profile = await getProfile(session.user);
    if (!profile.onboarding_completed) { location.replace("acceso.html?complete=1"); throw new Error("PROFILE_REDIRECT"); }
    fillUserUI(profile, session.user);
    return { session, profile };
  }

  async function initPanel() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext();
    $("#panel-first-name").textContent = (profile.full_name || "cliente").split(" ")[0];
    $('[data-side="projects"]')?.classList.add("active");
    const banner = $("#pending-banner");
    if (pendingQuote()) banner.hidden = false;
    $("#save-pending-quote")?.addEventListener("click", async () => {
      const btn = $("#save-pending-quote"); btn.disabled = true; btn.textContent = "Guardando…";
      try { const project = await createProjectFromPending(session.user); location.assign(`proyecto.html?id=${project.id}`); }
      catch (error) { alert(error.message || "No se pudo guardar la cotización."); btn.disabled = false; }
    });
    const { data: projects, error } = await db.from("client_projects").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const { data: requests } = await db.from("client_requests").select("id,status").neq("status", "Cerrada");
    $("#stat-projects").textContent = projects.length;
    $("#stat-live").textContent = projects.filter(p => /publicado|mantenimiento/i.test(p.status)).length;
    $("#stat-requests").textContent = requests?.length || 0;
    const grid = $("#projects-grid");
    if (!projects.length) {
      grid.innerHTML = `<div class="empty-card" style="grid-column:1/-1"><h3>Aún no tienes proyectos</h3><p>Prepara una cotización y guárdala para crear tu primer proyecto.</p><a class="button button-primary" href="cotizar.html">Comenzar cotización</a></div>`;
      return;
    }
    grid.innerHTML = projects.map(project => `<article class="project-card"><div class="project-card-top"><span class="status-badge ${statusClass(project.status)}">${safe(project.status)}</span><small>${date(project.created_at)}</small></div><h3>${safe(project.name)}</h3><p>${safe(project.domain || "Dirección por definir")}</p><div class="project-meta"><div><span>Dirección</span><strong>${project.address_type === "dominio" ? "Dominio propio" : "Enlace gratuito"}</strong></div><div><span>Alojamiento</span><strong>${project.hosting_type === "hostinger" ? "Especializado" : "Gratuito"}</strong></div></div><div class="card-actions">${project.site_url ? `<a class="button button-light button-small" href="${safe(project.site_url)}" target="_blank" rel="noopener">Abrir sitio</a>` : ""}<a class="button button-primary button-small" href="proyecto.html?id=${encodeURIComponent(project.id)}">Ver proyecto</a></div></article>`).join("");
  }

  async function initProfile() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext();
    $('[data-side="profile"]')?.classList.add("active");
    const form = $("#profile-form");
    ["full_name","email","phone","business_name","location"].forEach(name => { if (form[name]) form[name].value = name === "email" ? session.user.email || "" : profile[name] || ""; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); const fd = new FormData(form); const button=form.querySelector('button[type="submit"]'); button.disabled=true;
      try { const saved=await upsertProfile({ id:session.user.id, full_name:String(fd.get("full_name")||"").trim(), email:session.user.email, phone:String(fd.get("phone")||"").replace(/\D/g,""), business_name:String(fd.get("business_name")||"").trim(), location:String(fd.get("location")||"").trim(), avatar_url:profile.avatar_url, onboarding_completed:true, updated_at:new Date().toISOString() }); fillUserUI(saved,session.user); setStatus("#profile-page-status","Cambios guardados.","success"); }
      catch(error){setStatus("#profile-page-status",error.message||"No pudimos guardar los cambios.","error");} finally{button.disabled=false;}
    });
  }

  const requestLabels = {
    mantenimiento:["Solicitar mantenimiento","Revisar errores, enlaces o funcionamiento del sitio."],
    actualizar:["Actualizar mi sitio","Cambiar textos, fotografías, horarios, precios o secciones."],
    cambio:["Solicitar una modificación","Agregar o ajustar una función específica."],
    mejorar:["Mejorar mi proyecto","Agregar secciones, formularios, catálogos o automatizaciones."],
    dominio:["Quiero un dominio propio","Cambiar el enlace gratuito por una dirección profesional."],
    hosting:["Necesito hosting y dominio","Evaluar servidor, base de datos o funciones avanzadas."]
  };
  async function initProject() {
    if (!portal.configured) { location.replace("acceso.html"); return; }
    const { session, profile } = await loadContext(); $('[data-side="projects"]')?.classList.add("active");
    const id=getParam("id"); if(!id){location.replace("panel.html");return;}
    const { data:project,error }=await db.from("client_projects").select("*").eq("id",id).single(); if(error) throw error;
    const [{data:quotes},{data:requests},{data:updates}]=await Promise.all([
      db.from("client_quotes").select("*").eq("project_id",id).order("version",{ascending:false}).limit(1),
      db.from("client_requests").select("*").eq("project_id",id).order("created_at",{ascending:false}),
      db.from("client_updates").select("*").eq("project_id",id).order("created_at",{ascending:false})
    ]);
    const quote=quotes?.[0]; document.title=`${project.name} | Excepcional Build`; $("#project-title").textContent=project.name; $("#project-subtitle").innerHTML=`<span class="status-badge ${statusClass(project.status)}">${safe(project.status)}</span>`;
    const top=$("#project-top-actions"); top.innerHTML=`${project.site_url?`<a class="button button-light" href="${safe(project.site_url)}" target="_blank" rel="noopener">Abrir sitio ↗</a>`:""}<a class="button button-primary" href="cotizar.html">Cotizar otro proyecto</a>`;
    $("#project-details").innerHTML=[
      ["Dirección web",project.domain||"Por definir"],["Tipo de dirección",project.address_type==="dominio"?"Dominio personalizado":"Enlace gratuito"],["Alojamiento",project.hosting_type==="hostinger"?"Especializado":"Gratuito"],["Creado",date(project.created_at)]
    ].map(([a,b])=>`<div class="detail"><span>${a}</span><strong>${safe(b)}</strong></div>`).join("");
    const types=["mantenimiento","actualizar","cambio","mejorar"];
    if(project.address_type==="gratis") types.push("dominio");
    if(project.hosting_type==="cloudflare") types.push("hosting");
    $("#project-actions").innerHTML=types.map(type=>`<button class="action-card" type="button" data-request-type="${type}"><b>${requestLabels[type][0]}</b><span>${requestLabels[type][1]}</span></button>`).join("");
    $("#quote-summary").innerHTML=quote?`<div class="project-meta"><div><span>Pago inicial</span><strong>${money(quote.initial_total)}</strong></div><div><span>Renovación anual</span><strong>${Number(quote.annual_renewal)>0?money(quote.annual_renewal):"Sin renovaciones"}</strong></div><div><span>Años calculados</span><strong>${quote.period_years||1}</strong></div><div><span>Versión</span><strong>${quote.version}</strong></div></div><small>Estimación creada el ${date(quote.created_at)}. Los precios se confirman antes de comprar servicios.</small>`:`<p>No hay una cotización guardada.</p>`;
    $("#project-timeline").innerHTML=updates?.length?updates.map(u=>`<article class="timeline-item"><h3>${safe(u.title)}</h3><p>${safe(u.description||"")}</p><time>${date(u.created_at)}</time></article>`).join(""):`<article class="timeline-item"><h3>Cotización preparada</h3><p>Tu proyecto fue guardado. Cuando revisemos la solicitud aparecerán aquí los siguientes avances.</p><time>${date(project.created_at)}</time></article>`;
    const renderRequests=()=>{$("#request-list").innerHTML=requests?.length?requests.map(r=>`<article class="request-item"><strong><span>${safe(requestLabels[r.request_type]?.[0]||r.request_type)}</span><small>${safe(r.status)}</small></strong><p>${safe(r.message)}</p><small>${date(r.created_at)}</small></article>`).join(""):`<p style="color:var(--muted)">Todavía no has enviado solicitudes.</p>`;}; renderRequests();
    const dialog=$("#request-dialog"), form=$("#request-form");
    $$('[data-request-type]').forEach(btn=>btn.addEventListener("click",()=>{const type=btn.dataset.requestType; form.request_type.value=type; $("#request-title").textContent=requestLabels[type][0]; form.message.value=""; dialog.showModal();}));
    $$('[data-dialog-close]').forEach(btn=>btn.addEventListener("click",()=>dialog.close()));
    form.addEventListener("submit",async(event)=>{event.preventDefault();const fd=new FormData(form),type=String(fd.get("request_type")),message=String(fd.get("message")||"").trim();if(!message){setStatus("#request-status","Describe lo que necesitas.","error");return;}const submit=form.querySelector('button[type="submit"]');submit.disabled=true;setStatus("#request-status","Registrando solicitud…");try{const {data:req,error:reqError}=await db.from("client_requests").insert({project_id:id,user_id:session.user.id,request_type:type,message,status:"Nueva"}).select().single();if(reqError)throw reqError;requests.unshift(req);renderRequests();const text=[`Hola, soy ${profile.full_name}.`,"",`Quiero: ${requestLabels[type][0]}.`,`Proyecto: ${project.name}`,`Referencia: ${project.quote_ref||project.id}`,project.domain?`Sitio o dominio: ${project.domain}`:"",`Detalles: ${message}`].filter(Boolean).join("\n");location.assign(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`);}catch(err){setStatus("#request-status",err.message||"No pudimos registrar la solicitud.","error");submit.disabled=false;}});
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
      const message = error.message || "Ocurrió un problema al cargar el portal.";
      const status = $("#auth-status") || $("#callback-status") || $("#profile-page-status") || $("#request-status");
      if (status) status.textContent = message;
      const grid = $("#projects-grid");
      if (grid) grid.innerHTML = `<div class="empty-card" style="grid-column:1/-1"><h3>No pudimos cargar tus proyectos</h3><p>${safe(message)}</p></div>`;
    }
  }
  start();
})();
