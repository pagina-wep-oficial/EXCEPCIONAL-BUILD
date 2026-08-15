(() => {
  "use strict";

  const page = document.body?.dataset.portalPage;
  const portal = window.EBPortal || { configured:false, configError:"El portal no está disponible." };
  const db = portal.client;
  const WHATSAPP = "529811332914";
  const CLAIM_KEY = "eb_project_claim";
  const CONSULTAR_ENDPOINT = "https://scaebulgcuvqpucondws.supabase.co/functions/v1/consultar-dominio";
  let liveChannel = null;
  let liveRefreshTimer = 0;
  let liveRefreshBusy = false;
  let liveRefreshQueued = false;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const safe = (v="") => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const getParam = (name) => new URLSearchParams(location.search).get(name);
  const currentFile = () => location.pathname.split("/").pop() || "panel.html";
  const digits = (v) => String(v||"").replace(/\D/g, "");
  const money = (v) => v == null || v === "" || Number.isNaN(Number(v)) ? "—" : new Intl.NumberFormat("es-MX", {style:"currency",currency:"MXN"}).format(Number(v));
  const date = (v) => v ? new Intl.DateTimeFormat("es-MX", {day:"numeric",month:"short",year:"numeric"}).format(new Date(v)) : "—";
  const stageKey = (p) => String(p?.project_stage || p?.status || "").toLowerCase();
  const archivedClientState = (project) => /cancelad/.test(stageKey(project)) ? "cancelado" : (/descontinuad/.test(stageKey(project)) ? "descontinuado" : "");

  function friendlyError(error, fallback="No pudimos completar esta acción.") {
    const raw = String(error?.message || "");
    if (!raw) return fallback;
    if (/supabase|postgres|postgrest|row level|jwt|relation|column|schema|fetch|networkerror|failed to fetch/i.test(raw)) return fallback;
    return raw;
  }
  function setStatus(selector, text, tone="") {
    const el=$(selector); if(!el) return;
    el.textContent=text; el.className=`form-status${tone?` ${tone}`:""}`;
  }
  function statusClass(status="") {
    const s=String(status).toLowerCase();
    if(/publicad|entregad|mantenimiento/.test(s)) return "status-live";
    if(/producción|produccion|desarrollo|constru/.test(s)) return "status-progress";
    if(/revisión|revision|revisar/.test(s)) return "status-review";
    if(/información|informacion|contenido|esperando/.test(s)) return "status-waiting";
    if(/cancelad|descartad|descontinuad/.test(s)) return "status-cancelled";
    return "";
  }
  function stageIndex(project) {
    const s=stageKey(project);
    if(/cancelad|descontinuad/.test(s)) return 99;
    if(/publicado|mantenimiento/.test(s)) return 4;
    if(/revisión|revision/.test(s)) return 3;
    if(/producción|produccion|desarrollo/.test(s)) return 2;
    if(/información|informacion|contenido/.test(s)) return 1;
    return 0;
  }
function nextStepText(project) {
    const archived=archivedClientState(project);
    if(archived==="cancelado") return ["Proyecto cancelado","Contáctanos por WhatsApp si quieres retomarlo."];
    if(archived==="descontinuado") return ["Proyecto descontinuado","Contáctanos por WhatsApp si quieres retomarlo."];
    const i=stageIndex(project);
    if(i===0) return ["Configura tu página","Elige la dirección y cómo la vamos a publicar."];
    if(i===1) return ["Envíanos la información del negocio","Completa los datos, fotos y archivos que usaremos."];
    if(i===2) return ["Estamos construyendo tu página","Por ahora no necesitas hacer nada."];
    if(i===3) return ["Revisa tu página","Mira la vista previa y dinos si quieres cambiar algo."];
    return ["Tu página está publicada","Puedes pedir cambios o mantenimiento cuando lo necesites."];
  }
  function projectBaseTimeline(project) {
    const archived=archivedClientState(project);
    if(archived==="cancelado"){
      return [
        {title:"Proyecto creado",description:"Tu proyecto fue registrado correctamente.",dateValue:project.created_at},
        {title:"Proyecto cancelado",description:"Este proyecto fue cancelado y ya no sigue en proceso.",dateValue:project.updated_at||project.created_at}
      ];
    }
    if(archived==="descontinuado"){
      return [
        {title:"Proyecto creado",description:"Tu proyecto fue registrado correctamente.",dateValue:project.created_at},
        {title:"Proyecto descontinuado",description:"Este proyecto se pausó y quedó fuera de seguimiento por ahora.",dateValue:project.updated_at||project.created_at}
      ];
    }
    const items=[
      {title:"Proyecto creado",description:"Tu proyecto fue registrado correctamente.",dateValue:project.created_at}
    ];
    const stage=stageIndex(project);
    if(stage>=0){
      items.push({
        title:"Configuración recibida",
        description:"Ya registraste la dirección y la forma en que quieres publicar tu página.",
        dateValue:project.created_at
      });
    }
    if(stage>=1){
      items.push({
        title:"Información recibida",
        description:"Ya recibimos la información base de tu negocio para trabajar en la página.",
        dateValue:project.updated_at||project.created_at
      });
    }
    if(stage>=2){
      items.push({
        title:"Estamos construyendo tu página",
        description:"Tu proyecto ya entró en producción.",
        dateValue:project.updated_at||project.created_at
      });
    }
    if(stage>=3){
      items.push({
        title:"Tu página está en revisión",
        description:"Ya puedes revisar la versión actual antes de publicarla.",
        dateValue:project.review_ready_at||project.updated_at||project.created_at
      });
    }
    if(stage>=4){
      items.push({
        title:"Tu página fue publicada",
        description:"Tu proyecto ya está activo y disponible.",
        dateValue:project.published_at||project.updated_at||project.created_at
      });
    }
    if(/mantenimiento/i.test(String(project?.project_stage||""))){
      items.push({
        title:"Tu página está en mantenimiento",
        description:"El proyecto sigue activo y puede recibir ajustes o mejoras.",
        dateValue:project.updated_at||project.published_at||project.created_at
      });
    }
    return items;
  }
  function projectPrimaryHref(project) {
    if(archivedClientState(project)) return `proyecto.html?id=${encodeURIComponent(project.id)}`;
    if(stageIndex(project)===0) return `cotizar.html?project=${encodeURIComponent(project.id)}`;
    return `proyecto.html?id=${encodeURIComponent(project.id)}`;
  }
  function projectPrimaryLabel(project) {
    if(archivedClientState(project)) return "Ver estado";
    const i=stageIndex(project);
    return ["Configurar ahora","Completar información","Ver avance","Revisar página","Abrir proyecto"][i] || "Abrir proyecto";
  }
  function publicSiteHref(project, mode="published", page="inicio") {
    return `site-view.html?project=${encodeURIComponent(project.id)}&mode=${encodeURIComponent(mode)}&page=${encodeURIComponent(page)}`;
  }

  function siteAction(project, label) {
    if(project.site_visibility === "public") {
      const href = project.site_url || publicSiteHref(project, "published", "inicio");
      return `<a class="button button-primary" href="${safe(href)}" target="_blank" rel="noopener">${safe(label||"Abrir mi página")} →</a>`;
    }
    if(project.site_visibility === "preview") {
      const href = project.preview_url || publicSiteHref(project, "published", "inicio");
      return `<a class="button button-primary" href="${safe(href)}" target="_blank" rel="noopener">${safe(label||"Ver avance")} →</a>`;
    }
    return "";
  }
  function continueProjectHref(project, profile, source="portal-cliente") {
    const state=archivedClientState(project)||"pausado";
    const text=[`Hola, soy ${profile?.full_name||"cliente"}.`,`Quiero continuar con mi proyecto ${project?.name||""}.`,`Estado actual: ${state}.`,`Proyecto ID: ${project?.id||""}.`,`Origen: ${source}.`].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  }
  function editorSupportHref(project, profile, topic="suscripcion") {
    const text=[
      `Hola, soy ${profile?.full_name||"cliente"}.`,
      `Necesito ayuda con mi ${topic} del editor de mi sitio.`,
      `Proyecto: ${project?.name||""}.`,
      `Proyecto ID: ${project?.id||""}.`
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  }
  function editorPlanHref(project, profile, months, price, action="activar") {
    const text=[
      `Hola, soy ${profile?.full_name||"cliente"}.`,
      `Quiero ${action} el editor autogestionable para mi sitio ${project?.name||""}.`,
      `Plan: ${months} mes${months==="1"?"":"es"} por $${price} MXN.`,
      `Proyecto ID: ${project?.id||""}.`
    ].join("\n");
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  }
  function editorAccessState(project) {
    const raw=String(project?.editor_access_status||project?.editor_status||"").toLowerCase();
    const ends=project?.editor_access_ends_at||project?.editor_ends_at||"";
    const expired=ends&&new Date(ends).getTime()<Date.now();
    if(project?.editor_enabled&& !expired) return {status:"active",ends};
    if(/activo|active/.test(raw)&&!expired) return {status:"active",ends};
    if(expired||/vencido|expired|pausado|paused|cancelado/.test(raw)) return {status:"expired",ends};
    return {status:"none",ends:""};
  }
  function editorLaunchHref(project) {
    const external=String(project?.editor_launch_url||"").trim();
    if(external) return external;
    return `editor-v2.html?project=${encodeURIComponent(project.id)}`;
  }
  function stopLiveUpdates(){
    clearTimeout(liveRefreshTimer);
    liveRefreshBusy=false;
    liveRefreshQueued=false;
    if(liveChannel){
      db.removeChannel(liveChannel);
      liveChannel=null;
    }
  }
  function refreshVisiblePortalPage(){
    if(document.visibilityState!=="visible") return;
    if(["panel","project","configure","editor"].includes(page)) location.reload();
  }
  async function runLiveHandler(handler,payload,spec){
    if(liveRefreshBusy){
      liveRefreshQueued=true;
      return;
    }
    liveRefreshBusy=true;
    try{
      await handler(payload,spec);
    }finally{
      liveRefreshBusy=false;
      if(liveRefreshQueued){
        liveRefreshQueued=false;
        refreshVisiblePortalPage();
      }
    }
  }
  function startLiveUpdates(name,specs,handler){
    stopLiveUpdates();
    if(!db?.channel||!specs?.length)return;
    const channel=db.channel(name);
    specs.forEach(spec=>{
      const config={event:"*",schema:"public",table:spec.table};
      if(spec.filter) config.filter=spec.filter;
      channel.on("postgres_changes",config,(payload)=>{
        clearTimeout(liveRefreshTimer);
        liveRefreshTimer=setTimeout(()=>runLiveHandler(handler,payload,spec).catch(err=>console.error("portal live refresh",err)),120);
      });
    });
    liveChannel=channel;
    channel.subscribe();
  }

  async function captureClaimFromUrl() {
    const id=getParam("claim"), token=getParam("token"), code=getParam("invite");
    if(id && token) localStorage.setItem(CLAIM_KEY, JSON.stringify({id,token}));
    else if(code && token){
      try{
        const {data,error}=await db.rpc("get_invite_by_code",{p_code:code});
        if(!error && data && data[0]) localStorage.setItem(CLAIM_KEY, JSON.stringify({id:data[0].project_id,token,name:data[0].project_name}));
      }catch(_){/* si falla, se ignora: el usuario puede reclamar desde su propio panel */}
    }
  }
  function pendingClaim() {
    try { return JSON.parse(localStorage.getItem(CLAIM_KEY) || "null"); } catch { return null; }
  }
  function clearClaim(){ localStorage.removeItem(CLAIM_KEY); }

  function profileFromUser(user) {
    const meta=user?.user_metadata||{};
    return {id:user.id,full_name:meta.full_name||meta.name||"",email:user.email||"",phone:meta.phone||"",location:"",avatar_url:meta.avatar_url||meta.picture||"",onboarding_completed:false};
  }
  async function getSession() {
    if(!portal.configured) return null;
    return (await db.auth.getSession()).data.session;
  }
  async function requireSession() {
    const session=await getSession();
    if(!session){ localStorage.setItem(portal.authNextKey, `${currentFile()}${location.search}`); location.replace("acceso.html"); throw new Error("AUTH_REDIRECT"); }
    return session;
  }
  async function getProfile(user) {
    const {data,error}=await db.from("client_profiles").select("*").eq("id",user.id).maybeSingle();
    if(error) throw error;
    return data || profileFromUser(user);
  }
  async function upsertProfile(values) {
    const {data,error}=await db.from("client_profiles").upsert(values,{onConflict:"id"}).select().single();
    if(error) throw error; return data;
  }
  function fillUserUI(profile,user) {
    $$('[data-user-name]').forEach(el=>el.textContent=profile.full_name||"Cliente");
    $$('[data-user-email]').forEach(el=>el.textContent=user.email||"");
    $$('[data-avatar]').forEach(el=>{
      const avatar=profile.avatar_url||user.user_metadata?.avatar_url||user.user_metadata?.picture;
      el.innerHTML=avatar?`<img src="${safe(avatar)}" alt="">`:safe((profile.full_name||user.email||"EB").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase());
    });
  }
  async function loadContext() {
    const session=await requireSession();
    const profile=await getProfile(session.user);
    if(!profile.onboarding_completed){ localStorage.setItem(portal.authNextKey, `${currentFile()}${location.search}`); location.replace("acceso.html?complete=1"); throw new Error("PROFILE_REDIRECT"); }
    fillUserUI(profile,session.user); return {session,profile};
  }
  async function logout(){ await db.auth.signOut(); location.assign("acceso.html"); }
  $$('[data-logout]').forEach(btn=>btn.addEventListener("click",logout));

  async function claimPendingProject() {
    const claim=pendingClaim(); if(!claim) return null;
    const {data,error}=await db.rpc("claim_client_project",{p_project_id:claim.id,p_token:claim.token});
    if(error) throw error; clearClaim(); return data||claim.id;
  }
  async function finishAccess(session) {
    const claim=pendingClaim();
    if(claim){ const id=await claimPendingProject(); location.replace(`proyecto.html?id=${encodeURIComponent(id)}`); return; }
    const rawNext=localStorage.getItem(portal.authNextKey);
    const next=portal.normalizeNext(rawNext,"panel.html");
    localStorage.removeItem(portal.authNextKey);
    location.replace(next||"panel.html");
  }

  async function initAccess() {
    await captureClaimFromUrl();
    if(!portal.configured){ $("#config-warning").hidden=false; $("#config-warning").textContent="El acceso no está disponible en este momento."; $("#google-login").disabled=true; return; }
    const claim=pendingClaim();
    if(claim){ const box=$("#access-context"); box.hidden=false; box.innerHTML=`<strong>Tu proyecto${claim.name?` ${safe(claim.name)}`:""} ya está preparado.</strong><br>Entra con Google para activarlo y continuar.`; }
    let session=await getSession();
    const invited = Boolean(getParam("claim")||getParam("invite")||claim);
    if(session&&invited){ await db.auth.signOut(); session=null; }
    const login=$("#login-view"), profileView=$("#profile-view");
    if(session){
      const profile=await getProfile(session.user);
      if(profile.onboarding_completed){ await finishAccess(session); return; }
      login.hidden=true; profileView.hidden=false;
      const form=$("#onboarding-form");
      form.full_name.value=profile.full_name||session.user.user_metadata?.full_name||session.user.user_metadata?.name||"";
      form.phone.value=profile.phone||""; form.location.value=profile.location||""; form.email.value=session.user.email||"";
      form.addEventListener("submit",async e=>{
        e.preventDefault();
        const fd=new FormData(form), full=String(fd.get("full_name")||"").trim(), phone=digits(fd.get("phone"));
        if(full.length<3||phone.length<10){ setStatus("#profile-status","Escribe tu nombre completo y un WhatsApp válido.","error"); return; }
        const button=form.querySelector('button[type="submit"]'); button.disabled=true; setStatus("#profile-status","Guardando…");
        try{
          await upsertProfile({id:session.user.id,full_name:full,email:session.user.email||"",phone,location:String(fd.get("location")||"").trim()||null,avatar_url:profile.avatar_url||session.user.user_metadata?.avatar_url||session.user.user_metadata?.picture||null,onboarding_completed:true});
          setStatus("#profile-status","Listo.","success"); await finishAccess(session);
        }catch(err){ setStatus("#profile-status",friendlyError(err,"No pudimos guardar tus datos."),"error"); button.disabled=false; }
      });
      return;
    }
    $("#google-login").addEventListener("click",async()=>{
      const button=$("#google-login"); button.disabled=true; setStatus("#auth-status","Abriendo Google…");
      const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo:portal.callbackUrl(),scopes:"openid email profile"}});
      if(error){ setStatus("#auth-status","No pudimos abrir Google. Intenta nuevamente.","error"); button.disabled=false; }
    });
  }
  async function initCallback() {
    if(!portal.configured) return;
    const status=$("#callback-status");
    try{
      const storedNext=localStorage.getItem(portal.authNextKey);
      const nextParam=getParam("next")||storedNext;
      const normalizedNext=portal.normalizeNext(nextParam,"panel.html");
      const isCrmTarget=/^(crm-local\.html|project-admin\.html(\?|$))/i.test(normalizedNext);
      const code=getParam("code");
      if(code){
        status.textContent="Confirmando tu acceso…";
        const {error}=await db.auth.exchangeCodeForSession(code);
        if(error) throw error;
      }
      let session=await getSession();
      if(!session) throw new Error("No pudimos confirmar el acceso.");
      if(isCrmTarget){
        localStorage.removeItem(portal.authNextKey);
        status.textContent="Listo. Abriendo el CRM…";
        location.replace(normalizedNext);
        return;
      }
      const profile=await getProfile(session.user);
      if(!profile.onboarding_completed){ location.replace("acceso.html?complete=1"); return; }
      status.textContent="Listo. Abriendo tu proyecto…";
      await finishAccess(session);
    }catch(err){ status.textContent=friendlyError(err,"No pudimos completar el acceso. Vuelve a intentarlo."); }
  }

  async function initPanel() {
    const {session,profile}=await loadContext();
    $("#panel-first-name").textContent=(profile.full_name||"cliente").split(/\s+/)[0];
    const uid=session.user.id;
    const grid=$("#projects-grid"), allBlock=$("#all-projects-block"), allGrid=$("#projects-grid-all"), search=$("#projects-search");
    let mine=[], others=[], ownerById=new Map();
    function projectCard(p){
      const [title,copy]=nextStepText(p), url=projectPrimaryHref(p), action=projectPrimaryLabel(p);
      const archived=archivedClientState(p);
      const publicBadge=archived?(archived==="cancelado"?"Proyecto cancelado":"Proyecto descontinuado"):(p.site_visibility==="public"?"Pagina publicada":p.site_visibility==="preview"?"Vista previa lista":title);
      const ownerTag=p.user_id===uid?`<span class="mine-tag">Tuyo</span>`:`<span class="owner-tag">Proyecto de: ${safe(ownerById.get(p.user_id)||"Pendiente de activar")}</span>`;
      const footerAction=(stageIndex(p)<2||archived)?`<a href="${url}">${safe(action)} ></a>`:"";
      return `<article class="project-card-simple"><a class="project-card-main" href="${url}"><div class="project-card-icon">${stageIndex(p)===4?"OK":archived?"!":"EB"}</div><div class="project-card-copy"><span class="status-badge ${statusClass(p.status||p.project_stage)}">${safe(publicBadge)}</span><h3>${safe(p.name)}</h3><p>${safe(copy)}</p><small>${safe(p.domain||"Direccion por definir")}</small></div><span class="project-chevron">></span></a><div class="project-card-footer">${ownerTag}<span>${date(p.created_at)}</span>${footerAction}</div></article>`;
    }
    const render=()=>{
      const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const q=norm(search?.value);
      const match=p=>!q||norm(`${p.name} ${p.domain||""} ${ownerById.get(p.user_id)||""}`).includes(q);
      const own=mine.filter(match), other=others.filter(match);
      const actionable=mine.find(p=>stageIndex(p)<4&&!archivedClientState(p));
      const box=$("#panel-next-step"); if(actionable){ const [title,copy]=nextStepText(actionable); box.hidden=false; box.innerHTML=`<div class="next-step-icon">></div><div><span>Lo siguiente</span><strong>${safe(title)}</strong><p>${safe(copy)}</p></div><a class="button button-primary" href="${projectPrimaryHref(actionable)}">Continuar</a>`; } else if(box){ box.hidden=true; box.innerHTML=""; }
      grid.innerHTML=own.length?own.map(projectCard).join(""):`<div class="empty-card"><div class="empty-icon">○</div><h3>${q?"Sin resultados":mine.length?"":"Todavía no tienes proyectos"}</h3>${q?"":mine.length?"":"<p>Cuando aceptes una página con nosotros, aparecerá aquí.</p><a class=\"button button-light\" href=\"https://wa.me/${WHATSAPP}\" target=\"_blank\" rel=\"noopener\">Hablar por WhatsApp</a>"}</div>`;
      const showAll=allBlock&&others.length>0;
      if(allBlock)allBlock.hidden=!showAll;
      if(showAll){ allGrid.innerHTML=other.length?other.map(projectCard).join(""):`<div class="empty-card"><div class="empty-icon">…</div><h3>Sin resultados</h3><p>Intenta con otro nombre o cliente.</p></div>`; }
    };
    const refreshPanel=async()=>{
      const [projectsR,profilesR]=await Promise.all([
        db.from("client_projects").select("*").order("created_at",{ascending:false}),
        db.from("client_profiles").select("id,full_name")
      ]);
      if(projectsR.error) throw projectsR.error;
      if(profilesR.error) throw profilesR.error;
      const projects=projectsR.data||[];
      ownerById=new Map((profilesR.data||[]).map(p=>[p.id,p.full_name||p.email||"Cliente"]));
      mine=projects.filter(p=>p.user_id===uid);
      others=projects.filter(p=>!p.user_id||p.user_id!==uid);
      render();
    };
    if(search&&!search.dataset.liveBound){
      search.dataset.liveBound="1";
      search.addEventListener("input",render);
    }
    await refreshPanel();
    startLiveUpdates(`portal-panel-${uid}`,[{table:"client_projects"},{table:"client_profiles"}],async(payload,spec)=>{
      const event=payload?.eventType||payload?.event||"*";
      if(spec.table==="client_profiles"){
        const row=payload?.new||null;
        const oldId=payload?.old?.id;
        if(event==="DELETE"){
          ownerById.delete(oldId);
        }else if(row?.id){
          ownerById.set(row.id,row.full_name||row.email||"Cliente");
        }
        render();
        return;
      }
      if(spec.table==="client_projects"){
        const row=payload?.new||null;
        const oldId=payload?.old?.id;
        const all=[...mine,...others];
        let next=event==="DELETE"
          ?all.filter(p=>String(p.id)!==String(oldId))
          :(()=>{
              const copy=[...all];
              const idx=copy.findIndex(p=>String(p.id)===String(row?.id));
              if(idx>=0) copy[idx]=row;
              else if(row) copy.unshift(row);
              return copy;
            })();
        next=next.sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime());
        mine=next.filter(p=>p.user_id===uid);
        others=next.filter(p=>!p.user_id||p.user_id!==uid);
        render();
        return;
      }
      await refreshPanel();
    });
  }

  async function initProfile() {
    const {session,profile}=await loadContext(); const form=$("#profile-form");
    ["full_name","phone","location"].forEach(n=>{ if(form[n]) form[n].value=profile[n]||""; }); form.email.value=session.user.email||"";
    form.addEventListener("submit",async e=>{
      e.preventDefault(); const fd=new FormData(form), full=String(fd.get("full_name")||"").trim(), phone=digits(fd.get("phone"));
      if(full.length<3||phone.length<10){setStatus("#profile-page-status","Revisa tu nombre y WhatsApp.","error");return;}
      const b=form.querySelector('button[type="submit"]'); b.disabled=true; setStatus("#profile-page-status","Guardando…");
      try{await upsertProfile({id:session.user.id,full_name:full,email:session.user.email||"",phone,location:String(fd.get("location")||"").trim()||null,avatar_url:profile.avatar_url,onboarding_completed:true});setStatus("#profile-page-status","Cambios guardados.","success");}
      catch(err){setStatus("#profile-page-status",friendlyError(err,"No pudimos guardar los cambios."),"error");} finally{b.disabled=false;}
    });
  }

  function normalizeSiteName(raw) {
    let value=String(raw||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    value=value.replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").replace(/^-+|-+$/g,"");
    return value.slice(0,63);
  }
  function normalizeDomain(raw) {
    let value=String(raw||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    value=value.replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/^\.+|\.+$/g,"");
    if(!value)return ""; if(!value.includes("."))value+=".com";
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)?value:"";
  }
  async function fetchTimeout(url,ms=20000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{signal:c.signal});}finally{clearTimeout(t);}}
  async function checkName(value,isDomain){
    const url=`${CONSULTAR_ENDPOINT}?dominio=${encodeURIComponent(value)}`;
    try{const r=await fetchTimeout(url); if(!r.ok)throw new Error(); const d=await r.json(); if(d?.ok!==true)throw new Error(); return {availability:d.disponible===true?"free":d.disponible===false?"taken":"unknown",price:d.precioDominio||null};}
    catch{
      const target=isDomain?value:`${value}.pages.dev`;
      try{const r=await fetchTimeout(`https://dns.google/resolve?name=${encodeURIComponent(target)}&type=NS`,9000),d=await r.json();return {availability:d?.Status===3?"free":"taken",price:null};}catch{return {availability:"unknown",price:null};}
    }
  }

  async function initConfigure() {
    const {session}=await loadContext(); const id=getParam("project"); if(!id){location.replace("panel.html");return;}
    const [{data:project,error},{data:setup,error:setupErr}]=await Promise.all([db.from("client_projects").select("*").eq("id",id).single(),db.from("client_project_setup").select("*").eq("project_id",id).maybeSingle()]);
    if(error||setupErr) throw error||setupErr;
    if(archivedClientState(project)||stageIndex(project)>=2){ location.replace(`proyecto.html?id=${encodeURIComponent(id)}`); return; }
    $("#configure-back").href=`proyecto.html?id=${encodeURIComponent(id)}`; $("#configure-mobile-back").href=`proyecto.html?id=${encodeURIComponent(id)}`;
    startLiveUpdates(`portal-configure-${id}`,[{table:"client_projects",filter:`id=eq.${id}`},{table:"client_project_setup",filter:`project_id=eq.${id}`}],async()=>location.reload());
    const form=$("#setup-form"), input=$("#setup-name"), checkBtn=$("#setup-check");
    let verifiedValue="", domainPrice=null;
    const initialAddress=setup?.address_type||project.address_type||"gratis", initialHosting=setup?.hosting_type||project.hosting_type||"cloudflare";
    form.querySelector(`[name="address_type"][value="${initialAddress}"]`).checked=true;
    form.querySelector(`[name="hosting_type"][value="${initialHosting}"]`).checked=true;
    form.elements.special_features_note.value=setup?.special_features_note||"";
    $("#setup-domain-owned").checked=Boolean(setup?.domain_owned);
    input.value=initialAddress==="dominio"?(setup?.domain||(/\.pages\.dev$/.test(project.domain||"")?"":project.domain||"")):(setup?.site_name||String(project.domain||"").replace(/\.pages\.dev$/,""));
    if(input.value) verifiedValue=initialAddress==="dominio"?normalizeDomain(input.value):normalizeSiteName(input.value);
    domainPrice=setup?.domain_first_year!=null?{first_period_price:Number(setup.domain_first_year)*100,price:Number(setup.domain_renewal||setup.domain_first_year)*100,currency:"MXN"}:null;

    function addressType(){return form.querySelector('[name="address_type"]:checked')?.value||"gratis";}
    function hostingType(){return form.querySelector('[name="hosting_type"]:checked')?.value||"cloudflare";}
    function updateSetupUI(){
      const domain=addressType()==="dominio";
      $("#setup-name-label").textContent=domain?"Nombre de tu dominio":"Nombre para tu enlace";
      input.placeholder=domain?"Ej. abarroteslupita.com":"Ej. abarroteslupita";
      $("#setup-name-help").textContent=domain?"Puedes escribir tunegocio.com o solo tunegocio.":"Quedará como tunegocio.pages.dev";
      $("#special-note-wrap").hidden=hostingType()!=="hostinger";
      $("#owned-domain-wrap").hidden=!domain;
      if(!domain) $("#setup-domain-owned").checked=false;
      if(hostingType()==="hostinger"&&addressType()==="gratis"){
        const d=form.querySelector('[name="address_type"][value="dominio"]');d.checked=true;verifiedValue="";domainPrice=null;input.value="";$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status","Las funciones especiales requieren un dominio propio. Elige el nombre de tu dominio.");
      }
      renderSetupSummary();
      scheduleSetupSave();
    }
    let setupAutosaveTimer=null;
    const scheduleSetupSave=()=>{
      clearTimeout(setupAutosaveTimer);
      setupAutosaveTimer=setTimeout(async()=>{
        const isDomain=addressType()==="dominio", current=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
        const payload={project_id:id,user_id:session.user.id,address_type:isDomain?"dominio":"gratis",hosting_type:hostingType(),special_features_note:String(form.elements.special_features_note.value||"").trim()||null,domain_owned:isDomain&&$("#setup-domain-owned").checked};
        if(verifiedValue&&verifiedValue===current){
          if(isDomain){payload.domain=current;payload.site_name=null;}else{payload.site_name=current;payload.domain=null;}
          if(isDomain&&domainPrice){payload.domain_first_year=(domainPrice.first_period_price??domainPrice.price)/100;payload.domain_renewal=(domainPrice.price??domainPrice.first_period_price)/100;}
        }
        try{
          const {error:saveErr}=await db.from("client_project_setup").upsert(payload,{onConflict:"project_id"});
          if(saveErr)return;
          const st=$("#setup-status"); st.textContent="Configuración guardada automáticamente."; st.className="form-status success";
          setTimeout(()=>{if(st.textContent==="Configuración guardada automáticamente.")st.className="form-status";},2500);
        }catch(_){/* el envío final sigue mostrando errores */}
      },900);
    };
    window.addEventListener("pagehide",()=>{clearTimeout(setupAutosaveTimer);});
    function renderSetupSummary(){
      const domain=addressType()==="dominio", host=hostingType()==="hostinger";
      const name=domain?(normalizeDomain(input.value)||"Dominio por elegir"):(normalizeSiteName(input.value)?`${normalizeSiteName(input.value)}.pages.dev`:"Enlace por elegir");
      const lines=[
        ["Creación de tu página",money(project.total_price)||"Acordado"],
        ["Dirección",name],
        ["Alojamiento",host?"Funciones especiales · se cotiza aparte":"Incluido · sin costo anual"]
      ];
      if(domain&&domainPrice){const first=(domainPrice.first_period_price??domainPrice.price)/100,renew=(domainPrice.price??domainPrice.first_period_price)/100;lines.push(["Dominio · primer año",money(first)]);lines.push(["Renovación del dominio",money(renew)]);}
      $("#setup-summary-lines").innerHTML=lines.map(([a,b])=>`<div><span>${safe(a)}</span><strong>${safe(b)}</strong></div>`).join("");
    }
    $$('[name="address_type"], [name="hosting_type"]',form).forEach(el=>el.addEventListener("change",updateSetupUI));
    input.addEventListener("input",()=>{verifiedValue="";domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status","");renderSetupSummary();scheduleSetupSave();});
    $("#setup-domain-owned").addEventListener("change",()=>{verifiedValue="";domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status","");renderSetupSummary();scheduleSetupSave();});
    checkBtn.addEventListener("click",async()=>{
      const isDomain=addressType()==="dominio", value=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
      if(!value){setStatus("#setup-domain-status",isDomain?"Escribe un dominio válido, por ejemplo tunegocio.com.":"Escribe un nombre corto sin espacios ni símbolos.","error");return;}
      if(isDomain && $("#setup-domain-owned").checked){verifiedValue=value;domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status",`Usaremos ${value}. Después confirmaremos contigo cómo conectarlo.`,"success");renderSetupSummary();return;}
      checkBtn.disabled=true;setStatus("#setup-domain-status","Comprobando…");
      const result=await checkName(value,isDomain); checkBtn.disabled=false;
      if(result.availability==="taken"){verifiedValue="";setStatus("#setup-domain-status",`${isDomain?value:`${value}.pages.dev`} ya está en uso. Prueba otro nombre.`,"error");return;}
      verifiedValue=value; domainPrice=isDomain?result.price:null;
      if(isDomain&&domainPrice){const first=(domainPrice.first_period_price??domainPrice.price)/100,renew=(domainPrice.price??domainPrice.first_period_price)/100;$("#setup-domain-first").textContent=money(first);$("#setup-domain-renew").textContent=money(renew);$("#setup-domain-prices").hidden=false;}
      const msg=result.availability==="free"?`${isDomain?value:`${value}.pages.dev`} está disponible.`:`Anotamos ${isDomain?value:`${value}.pages.dev`}. Confirmaremos la disponibilidad antes de publicar.`;
      setStatus("#setup-domain-status",msg,"success");renderSetupSummary();scheduleSetupSave();
    });
    form.addEventListener("submit",async e=>{
      e.preventDefault(); const isDomain=addressType()==="dominio", current=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
      if(!current){setStatus("#setup-status","Primero escribe el nombre de tu página.","error");return;}
      if(!verifiedValue||verifiedValue!==current){setStatus("#setup-status","Pulsa “Verificar” para confirmar el nombre antes de continuar.","error");return;}
      if(hostingType()==="hostinger"&&!isDomain){setStatus("#setup-status","Las funciones especiales necesitan dominio propio.","error");return;}
      const button=form.querySelector('button[type="submit"]');button.disabled=true;setStatus("#setup-status","Guardando tu configuración…");
      try{
        const first=isDomain&&domainPrice?(domainPrice.first_period_price??domainPrice.price)/100:null, renew=isDomain&&domainPrice?(domainPrice.price??domainPrice.first_period_price)/100:null;
        const payload={project_id:id,user_id:session.user.id,address_type:isDomain?"dominio":"gratis",site_name:isDomain?null:current,domain:isDomain?current:null,domain_owned:isDomain&&$("#setup-domain-owned").checked,domain_first_year:first,domain_renewal:renew,hosting_type:hostingType(),special_features_note:String(form.elements.special_features_note.value||"").trim()||null};
        const {error:saveErr}=await db.from("client_project_setup").upsert(payload,{onConflict:"project_id"});if(saveErr)throw saveErr;
        const {error:applyErr}=await db.rpc("client_apply_project_setup",{p_project_id:id});if(applyErr)throw applyErr;
        setStatus("#setup-status","Listo. Ahora necesitamos la información de tu negocio.","success");location.assign(`proyecto.html?id=${encodeURIComponent(id)}#informacion`);
      }catch(err){setStatus("#setup-status",friendlyError(err,"No pudimos guardar la configuración."),"error");button.disabled=false;}
    });
    updateSetupUI();
  }

  const briefFields=["business_name","business_description","products_services","address_text","schedule_text","public_phone","maps_url","facebook_url","instagram_url","tiktok_url","visual_notes","reference_links","extra_notes","social_links"];
  function briefCompletion(form,filesCount=0){
    const keys=["business_name","business_description","products_services","address_text","schedule_text","public_phone"];
    let done=keys.filter(k=>String(form.elements[k]?.value||"").trim()).length;
    if($$('input[name="content_options"]:checked',form).length) done++;
    if(filesCount>0||String(form.elements.reference_links?.value||form.elements.social_links?.value||"").trim())done++;
    return Math.round(done/8*100);
  }
  const FILE_RULES={foto:/^image\//,logo:/^image\//,video:/^video\//,documento:/^(application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)/,otro:/.*/};
  const FILE_HINTS={foto:"Solo imágenes · máximo 25 MB por archivo",logo:"Solo imágenes (PNG, JPG o SVG) · máximo 25 MB",video:"Solo videos · máximo 25 MB por archivo",documento:"Solo documentos · máximo 25 MB por archivo",otro:"Cualquier archivo · máximo 25 MB por archivo"};
  function categoryMatches(category,file){
    const rule=FILE_RULES[category]||FILE_RULES.otro;
    return rule.test(String(file.type||"").split(";")[0].trim().toLowerCase())||(file.type===""&&category==="otro");
  }
  function renderFiles(files,session){
    const box=$("#project-file-list"); if(!box)return;
    box.innerHTML=files?.length?files.map(f=>`<article class="file-item"><span class="file-type">${f.category==="foto"?"IMG":f.category==="video"?"VID":f.category==="logo"?"LOGO":"DOC"}</span><div><strong>${safe(f.file_name)}</strong><small>${f.size_bytes?`${(Number(f.size_bytes)/1024/1024).toFixed(1)} MB`:safe(f.mime_type||"")}</small></div><div class="file-actions"><button type="button" class="file-prev" data-preview-file="${f.id}" data-file-name="${safe(f.file_name)}">Ver</button><button type="button" class="file-remove" data-remove-file="${f.id}" data-file-name="${safe(f.file_name)}" aria-label="Quitar ${safe(f.file_name)}">×</button></div></article>`).join(""):`<div class="file-empty">Todavía no has subido archivos.</div>`;
    $$('[data-preview-file]',box).forEach(btn=>btn.addEventListener("click",async()=>{
      btn.disabled=true; const old=btn.textContent;btn.textContent="Abriendo…";
      try{const r=await fetch(`/api/project-file?id=${encodeURIComponent(btn.dataset.previewFile)}`,{headers:{Authorization:`Bearer ${session.access_token}`}});if(!r.ok)throw new Error();const blob=await r.blob();const url=URL.createObjectURL(blob);const full=document.createElement("div");full.className="lightbox";const img=document.createElement("img");img.src=url;full.appendChild(img);full.addEventListener("click",()=>{full.remove();URL.revokeObjectURL(url);});document.body.appendChild(full);}catch{alert("No pudimos abrir este archivo.");}finally{btn.disabled=false;btn.textContent=old;}
    }));
    $$('[data-remove-file]',box).forEach(btn=>btn.addEventListener("click",async()=>{
      if(!confirm(`¿Quitar "${btn.dataset.fileName||"este archivo"}"?`))return;
      btn.disabled=true;
      try{const r=await fetch(`/api/delete-project-file?id=${encodeURIComponent(btn.dataset.removeFile)}`,{method:"DELETE",headers:{Authorization:`Bearer ${session.access_token}`}});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||"No se pudo eliminar.");files=files.filter(f=>f.id!==btn.dataset.removeFile);renderFiles(files,session);setStatus("#upload-status","Archivo eliminado.","success");}
      catch(err){setStatus("#upload-status",friendlyError(err,"No pudimos eliminar el archivo."),"error");}finally{btn.disabled=false;}
    }));
  }

  const requestLabels={
    cambio:{title:"Solicitar un cambio",help:"Dinos qué quieres corregir antes de publicar.",publicTitle:"Cambio solicitado"},
    mantenimiento:{title:"Solicitar mantenimiento",help:"Revisar un problema o algo que dejó de funcionar.",publicTitle:"Mantenimiento solicitado"},
    actualizar:{title:"Actualizar mi página",help:"Cambiar textos, fotos, horarios, productos o precios.",publicTitle:"Actualización solicitada"},
    dominio:{title:"Quiero un dominio propio",help:"Cambiar el enlace gratuito por una dirección profesional.",publicTitle:"Dominio solicitado"},
    hosting:{title:"Necesito funciones especiales",help:"Agregar sistema, usuarios, base de datos u otras funciones.",publicTitle:"Funciones especiales solicitadas"},
    mejorar:{title:"Mejorar mi proyecto",help:"Agregar nuevas secciones o funciones.",publicTitle:"Mejora solicitada"}
  };
  function requestStateMeta(value=""){
    const key=String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const states={
      nueva:{label:"Recibida",tone:"waiting",group:"active"},
      revisada:{label:"Revisada",tone:"waiting",group:"active"},
      aceptada:{label:"Aceptada",tone:"progress",group:"active"},
      "en proceso":{label:"En proceso",tone:"progress",group:"active"},
      en_proceso:{label:"En proceso",tone:"progress",group:"active"},
      "en revision":{label:"En revisión",tone:"review",group:"active"},
      "en revisión":{label:"En revisión",tone:"review",group:"active"},
      en_revision:{label:"En revisión",tone:"review",group:"active"},
      completada:{label:"Completada",tone:"live",group:"closed"},
      resuelta:{label:"Completada",tone:"live",group:"closed"},
      cerrada:{label:"Completada",tone:"live",group:"closed"},
      pospuesta:{label:"Pospuesta",tone:"waiting",group:"active"},
      rechazada:{label:"Rechazada",tone:"cancelled",group:"closed"},
      archivada:{label:"Archivada",tone:"cancelled",group:"closed"}
    };
    return states[key]||{label:value||"Recibida",tone:"waiting",group:"active"};
  }
  function requestDisplayTitle(request){
    const clean=String(request?.admin_title||request?.client_title||"").trim();
    if(clean) return clean;
    return requestLabels[request?.request_type]?.publicTitle||"Solicitud";
  }
  function requestDisplaySummary(request){
    return String(request?.admin_summary||request?.message||"").trim()||"Recibimos tu solicitud y la revisaremos contigo.";
  }
  function requestTimelineSteps(request){
    const current=requestStateMeta(request?.status).label;
    const steps=["Recibida","Aceptada","En proceso","En revisión","Completada"];
    const index=steps.indexOf(current);
    return steps.map((label,i)=>{
      const done=index>-1&&i<index;
      const active=index===i;
      const pending=index===-1||i>index;
      return {label,done,active,pending};
    });
  }

  async function initProject() {
    const {session,profile}=await loadContext(); const id=getParam("id"); if(!id){location.replace("panel.html");return;}
    let project;
    const loadProject=async()=>{const {data,error}=await db.from("client_projects").select("*").eq("id",id).single();if(error)throw error;project=data;};
    await loadProject();
    const results=await Promise.all([
db.from("client_requests").select("*").eq("project_id",id).order("created_at",{ascending:false}),
      db.from("client_project_briefs").select("*").eq("project_id",id).maybeSingle(),
      db.from("client_project_files").select("*").eq("project_id",id).order("created_at",{ascending:false})
    ]);
    for(const r of results) if(r.error) throw r.error;
    let requests=results[0].data||[], brief=results[1].data, files=results[2].data||[];
    startLiveUpdates(`portal-project-${id}`,[{table:"client_projects",filter:`id=eq.${id}`},{table:"client_requests",filter:`project_id=eq.${id}`}],async(payload,spec)=>{
      if(spec.table==="client_requests"){
        const event=payload?.eventType||payload?.event||"*";
        const row=payload?.new||null;
        const oldId=payload?.old?.id;
        if(event==="DELETE"){
          requests=requests.filter(r=>String(r.id)!==String(oldId));
        }else if(row){
          const idx=requests.findIndex(r=>String(r.id)===String(row.id));
          if(idx>=0) requests[idx]=row;
          else requests.unshift(row);
        }
        requests=requests.sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime());
        renderProjectRequests();
        return;
      }
      location.reload();
    });
    document.title=`${project.name} | Excepcional Build`; $("#project-title").textContent=project.name; $("#project-subtitle").innerHTML=`<span class="status-badge ${statusClass(project.status||project.project_stage)}">${safe(project.status||project.project_stage)}</span>`; $("#project-top-actions").innerHTML=siteAction(project);
    const labels=["Configurar","Enviar información","Construcción","Revisión","Publicada"], pos=stageIndex(project);
    $("#project-stage-track").innerHTML=labels.map((label,i)=>`<div class="stage-step ${i<pos?"done":i===pos?"current":""}"><i>${i<pos?"✓":i+1}</i><span>${safe(label)}</span><small>${i===pos?"Ahora":""}</small></div>`).join("");
    if(project.client_note && stageIndex(project) === 0){$("#project-client-note").hidden=false;$("#project-client-note").textContent=project.client_note;}

    const focus=$("#project-focus"), briefCard=$("#project-brief-card"), actionsCard=$("#project-actions-card");
    const archivedState=archivedClientState(project);
    if(archivedState){
      const isCancelled=archivedState==="cancelado";
      const contactHref=continueProjectHref(project,profile,isCancelled?"cancelado":"descontinuado");
      $("#project-top-actions").innerHTML=`<a class="button button-primary" href="${contactHref}" target="_blank" rel="noopener">Quiero continuar →</a>`;
      $("#project-stage-track").innerHTML=`<div class="stage-step current archived"><i>!</i><span>${isCancelled?"Cancelado":"Descontinuado"}</span><small>Contáctanos para retomarlo</small></div>`;
      $("#project-client-note").hidden=false;
      $("#project-client-note").innerHTML=`Este proyecto está <strong>${isCancelled?"cancelado":"descontinuado"}</strong>. Si quieres retomarlo, escríbenos y revisamos contigo cómo seguir.`;
      focus.innerHTML=`<div class="focus-icon archived">!</div><div><span>${isCancelled?"Proyecto cancelado":"Proyecto descontinuado"}</span><h2>${isCancelled?"Tu proyecto fue cancelado":"Tu proyecto fue descontinuado"}</h2><p>${isCancelled?"Si quieres retomarlo, podemos revisarlo contigo y reactivarlo.":"Si quieres continuar con este proyecto, escríbenos y lo revisamos contigo."}</p></div><a class="button button-primary" href="${contactHref}" target="_blank" rel="noopener">Quiero continuar con el proyecto →</a>`;
      briefCard.hidden=true;
      actionsCard.hidden=true;
      $("#payment-card").hidden=true;
    } else {
    if(pos===0){focus.innerHTML=`<div class="focus-icon">1</div><div><span>Lo que sigue</span><h2>Elige la dirección de tu página</h2><p>Decide si quieres empezar gratis o usar un dominio propio.</p></div><a class="button button-primary" href="cotizar.html?project=${encodeURIComponent(id)}">Configurar mi página →</a>`;}
    if(pos===1){focus.innerHTML=`<div class="focus-icon">2</div><div><span>Lo que sigue</span><h2>Envíanos la información de tu negocio</h2><p>Completa lo que puedas y sube las fotos o archivos que quieras usar.</p></div><a class="button button-primary" href="#informacion">Comenzar →</a>`;briefCard.hidden=false;briefCard.id="informacion";}
    if(pos===2){focus.innerHTML=`<div class="focus-icon done">✓</div><div><span>Información recibida</span><h2>Estamos preparando tu página</h2><p>Por ahora no necesitas hacer nada. Te avisaremos cuando tengamos una vista lista.</p></div><button class="button button-light" id="show-brief-again" type="button">Ver lo que envié</button>`;briefCard.hidden=true;setTimeout(()=>$("#show-brief-again")?.addEventListener("click",()=>{briefCard.hidden=false;briefCard.scrollIntoView({behavior:"smooth"});}),0);}
    if(pos===3){focus.innerHTML=`<div class="focus-icon">3</div><div><span>Lista para revisar</span><h2>Mira tu página antes de publicarla</h2><p>Revísala con calma. Si quieres cambiar algo, envíanos una solicitud.</p></div>${siteAction(project,"Ver vista previa")||"<span class=\"muted-box\">La vista previa estará disponible en cuanto la activemos.</span>"}`;actionsCard.hidden=false;}
    if(pos===4){focus.innerHTML=`<div class="focus-icon done">✓</div><div><span>Proyecto publicado</span><h2>Tu página ya está en internet</h2><p>Puedes compartirla y pedir cambios o mantenimiento cuando lo necesites.</p></div>${siteAction(project,"Abrir mi página")||""}`;actionsCard.hidden=false;}
    }

    const hasPayments=[project.total_price,project.deposit_amount,project.balance_amount].some(v=>v!=null&&v!=="");
    if(!archivedState&&hasPayments){$("#payment-card").hidden=false;$("#project-payments").innerHTML=`<div class="payment-box"><span>Total acordado</span><strong>${money(project.total_price)}</strong><small>${safe(project.payment_method||"")}</small></div><div class="payment-box"><span>Anticipo</span><strong>${money(project.deposit_amount)}</strong><em class="payment-state ${project.deposit_paid?"paid":""}">${project.deposit_paid?"Pagado":"Pendiente"}</em></div><div class="payment-box"><span>Saldo final</span><strong>${money(project.balance_amount)}</strong><em class="payment-state ${project.balance_paid?"paid":""}">${project.balance_paid?"Pagado":"Pendiente"}</em></div>`;}

    const editorCard=$("#project-editor-card");
    if(editorCard && !archivedState){
      const access=editorAccessState(project);
      const active=access.status==="active";
      const expired=access.status==="expired";
      const action=expired?"renovar":"activar";
      const planButtons=[["1","50","1 mes"],["3","140","3 meses"],["6","270","6 meses"],["12","500","12 meses"]].map(([months,price,label])=>`<a class="editor-plan-card ${months==="12"?"featured":""}" href="${editorPlanHref(project,profile,months,price,action)}" target="_blank" rel="noopener"><span>${label}</span><strong>$${price}</strong><small>${months==="1"?"Para cambios puntuales.":months==="12"?"Mejor precio anual.":"Para mantenerlo activo."}</small></a>`).join("");
      editorCard.hidden=false;
      editorCard.innerHTML=active?`
        <div class="editor-project-head">
          <div><p class="eyebrow">Editor autogestionable</p><h2>Tu editor esta activo</h2><p>Cambia textos, imagenes, videos, horarios, precios y promociones por tu cuenta.</p></div>
          <span class="editor-badge active">Activo${access.ends?` hasta ${date(access.ends)}`:""}</span>
        </div>
        <div class="editor-active-box">
          <a class="button button-primary" href="${safe(editorLaunchHref(project))}" target="_blank" rel="noopener">Abrir editor</a>
          <a class="button button-light" href="${editorSupportHref(project,profile)}" target="_blank" rel="noopener">Ayuda con suscripcion</a>
        </div>
        <div class="editor-flow-note"><b>OK</b><span>Mientras el acceso este activo, este boton abre la herramienta de edicion de este sitio.</span></div>`:`
        <div class="editor-project-head">
          <div><p class="eyebrow">Editor autogestionable</p><h2>${expired?"Tu acceso al editor expiro":"Controla esta pagina tu mismo"}</h2><p>${expired?"Renueva para volver a editar este sitio por tu cuenta.":"Cambia textos, imagenes, videos, horarios, precios y promociones sin esperar soporte."}</p></div>
          <span class="editor-badge ${expired?"expired":""}">${expired?"Vencido":"Por sitio web"}</span>
        </div>
        <div class="editor-flow-note"><b>1</b><span>Elige un plan. Cuando el pago se confirme, los planes desaparecen y aqui aparece el boton Abrir editor.</span></div>
        <div class="editor-plan-grid">${planButtons}</div>
        <div class="editor-rules"><p>El acceso dura el periodo pagado. Si vence, tu pagina sigue en linea, pero el editor se pausa.</p><a href="politicas-editor.html?id=${encodeURIComponent(id)}">Ver reglas de cancelacion y reembolso</a></div>
        <div class="editor-support"><div><strong>Problemas con tu suscripcion?</strong><span>Cobro, cancelacion, reembolso o activacion se atienden por WhatsApp.</span></div><a class="button button-light" href="${editorSupportHref(project,profile)}" target="_blank" rel="noopener">Ayuda por WhatsApp</a></div>`;
    } else if(editorCard){
      editorCard.hidden=true;
    }

    const briefForm=$("#project-brief-form"); if(briefForm && !archivedState){
      briefFields.forEach(n=>{if(briefForm.elements[n])briefForm.elements[n].value=brief?.[n]||"";});
      let options=Array.isArray(brief?.content_options)?brief.content_options:[]; $$('input[name="content_options"]',briefForm).forEach(c=>c.checked=options.includes(c.value));
      let briefPage=1;
      const showBriefPage=(n)=>{briefPage=Math.max(1,Math.min(4,n));$$('[data-brief-page]',briefForm).forEach(s=>s.hidden=Number(s.dataset.briefPage)!==briefPage);$$('[data-brief-go]').forEach(b=>b.classList.toggle("active",Number(b.dataset.briefGo)===briefPage));$("#brief-prev").hidden=briefPage===1;$("#brief-next").hidden=briefPage===4;};
      $$('[data-brief-go]').forEach(b=>b.addEventListener("click",()=>showBriefPage(Number(b.dataset.briefGo))));$("#brief-prev").addEventListener("click",()=>showBriefPage(briefPage-1));$("#brief-next").addEventListener("click",()=>showBriefPage(briefPage+1));
      const updatePercent=()=>{$("#brief-progress-number").textContent=`${briefCompletion(briefForm,files.length)}%`;};
      let autosaveTimer=null, autosaveDirty=false;
      const scheduleAutosave=()=>{
        autosaveDirty=true; clearTimeout(autosaveTimer);
        autosaveTimer=setTimeout(async()=>{
          if(!autosaveDirty)return; autosaveDirty=false;
          try{
            await saveBrief(false,true);
            const st=$("#brief-status"); st.textContent="Avance guardado automáticamente."; st.className="form-status success";
            setTimeout(()=>{if(st.textContent==="Avance guardado automáticamente.")st.className="form-status";},2500);
          }catch(_){/* el guardado manual y el envío siguen mostrando errores */}
        },900);
      };
      briefForm.addEventListener("input",()=>{updatePercent();scheduleAutosave();});briefForm.addEventListener("change",()=>{updatePercent();scheduleAutosave();});updatePercent();showBriefPage(1);
      const saveBrief=async(submit=false,auto=false)=>{
        const payload={project_id:id,user_id:session.user.id};briefFields.forEach(n=>{if(briefForm.elements[n])payload[n]=String(briefForm.elements[n].value||"").trim()||null;});payload.content_options=$$('input[name="content_options"]:checked',briefForm).map(c=>c.value);payload.completion_percent=briefCompletion(briefForm,files.length);
        if(!auto)setStatus("#brief-status",submit?"Enviando información…":"Guardando…");
        const {data,error}=await db.from("client_project_briefs").upsert(payload,{onConflict:"project_id"}).select().single();if(error)throw error;brief=data;
        if(submit){if(payload.completion_percent<50)throw new Error("Completa un poco más de información antes de enviarla.");const {error:rpcError}=await db.rpc("client_submit_project_brief",{p_project_id:id});if(rpcError)throw rpcError;setStatus("#brief-status","Listo. Ya recibimos tu información.","success");setTimeout(()=>location.reload(),700);}else if(!auto){setStatus("#brief-status","Avance guardado.","success");}
      };
      window.addEventListener("pagehide",()=>{if(autosaveDirty){autosaveDirty=false;clearTimeout(autosaveTimer);saveBrief(false,true).catch(()=>{});}});
      $("#brief-submit").addEventListener("click",async()=>{const btn=$("#brief-submit");btn.disabled=true;try{await saveBrief(true);}catch(err){setStatus("#brief-status",friendlyError(err,"No pudimos enviar la información."),"error");btn.disabled=false;}});

      renderFiles(files,session);
      const catSelect=$("#file-category"), fileInput=$("#project-files"), acceptHint=$("#file-accept-hint");
      const syncCategory=()=>{const cat=catSelect.value;acceptHint.textContent=FILE_HINTS[cat]||FILE_HINTS.otro;fileInput.accept={foto:"image/*",logo:"image/*",video:"video/*",documento:".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx",otro:"*/*"}[cat]||"*/*";fileInput.classList.toggle("take-photo",cat==="foto"||cat==="logo");fileInput.value="";$("#upload-status").textContent="";};
      catSelect.addEventListener("change",syncCategory);syncCategory();
      let uploading=false;
      fileInput.addEventListener("change",async()=>{
        if(uploading)return;
        const cat=catSelect.value, selected=[...(fileInput.files||[])];
        fileInput.value="";
        if(!selected.length)return;
        const invalid=selected.filter(f=>!categoryMatches(cat,f));
        if(invalid.length){setStatus("#upload-status",cat==="foto"||cat==="logo"?`${invalid[0].name} no es una imagen. Elige ${cat==="foto"?"fotos":"imágenes"} o cambia el tipo de archivo.`:`${invalid[0].name} no es un archivo ${cat}. Revisa el tipo de archivo elegido.`,"error");return;}
        const tooBig=selected.find(f=>f.size>25*1024*1024);if(tooBig){setStatus("#upload-status",`${tooBig.name} pesa más de 25 MB. Para videos grandes pega un enlace de Drive en el campo de abajo.`,"error");return;}
        uploading=true;let ok=0;
        try{
          for(let i=0;i<selected.length;i++){
            const f=selected[i];setStatus("#upload-status",`Subiendo ${i+1} de ${selected.length}: ${f.name}`);
            const fd=new FormData();fd.append("project_id",id);fd.append("category",cat);fd.append("file",f);
            try{const r=await fetch("/api/upload-project-file",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},body:fd});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||"");if(data.file){files.unshift(data.file);ok++;renderFiles(files,session);}}
            catch(err){setStatus("#upload-status",friendlyError(err,"No pudimos subir uno de los archivos. Revisa la conexión de Google Drive."),"error");break;}
          }
          if(ok>0){setStatus("#upload-status",`${ok} archivo${ok===1?"":"s"} subido${ok===1?"":"s"} correctamente.`,"success");updatePercent();}
        }finally{uploading=false;}
      });
    }
    if(actionsCard&&!actionsCard.hidden && !archivedState){
      const types=pos===3?["cambio"]:["actualizar","mantenimiento","mejorar"];
      if(pos===4&&project.address_type==="gratis")types.push("dominio"); if(pos===4&&project.hosting_type==="cloudflare")types.push("hosting");
      $("#project-actions").innerHTML=types.map(t=>`<button class="action-card" type="button" data-request-type="${t}"><b>${requestLabels[t].title}</b><span>${requestLabels[t].help}</span></button>`).join("");
    }

    const baseTimeline=projectBaseTimeline(project);
    $("#project-timeline").innerHTML=baseTimeline.length?baseTimeline.map(item=>`<article class="timeline-item"><h3>${safe(item.title)}</h3><p>${safe(item.description||"")}</p><time>${date(item.dateValue)}</time></article>`).join(""):`<article class="timeline-item"><h3>Proyecto creado</h3><p>Tu proyecto fue registrado correctamente.</p><time>${date(project.created_at)}</time></article>`;

    const ACTIVE_REQUEST_LIMIT=3;
    const CLOSED_REQUEST_LIMIT=6;
    const renderClientRequestCard=(request)=>{
      const meta=requestStateMeta(request.status);
      const specialState=/^(Pospuesta|Rechazada)$/i.test(meta.label)?`<div class="request-special-state ${meta.tone}">${safe(meta.label)}</div>`:"";
      const timeline=requestTimelineSteps(request).map((step,i,arr)=>`<div class="request-step ${step.done?"done":step.active?"active":"pending"}"><i>${step.done?"✓":i+1}</i><span>${safe(step.label)}</span>${i<arr.length-1?`<b></b>`:""}</div>`).join("");
      return `<article class="request-client-card"><div class="request-client-top"><span class="status-badge status-${meta.tone}">${safe(meta.label)}</span><small>${date(request.completed_at||request.updated_at||request.created_at)}</small></div><h3>${safe(requestDisplayTitle(request))}</h3><p>${safe(requestDisplaySummary(request))}</p>${specialState}<div class="request-mini-timeline">${timeline}</div><div class="request-client-meta"><b>${safe(requestLabels[request.request_type]?.title||"Solicitud")}</b><span>${safe(project.name||"Proyecto")}</span></div></article>`;
    };
    const wireRequestToggle=(toggle,extraBox,extraCount,label)=>{
      if(!toggle||!extraBox||extraCount<=0)return;
      toggle.hidden=false;
      toggle.dataset.expanded="0";
      toggle.textContent=`Ver ${extraCount} más`;
      extraBox.hidden=true;
      toggle.onclick=()=>{
        const expanded=toggle.dataset.expanded==="1";
        extraBox.hidden=expanded;
        toggle.dataset.expanded=expanded?"0":"1";
        toggle.textContent=expanded?`Ver ${extraCount} más`:`Mostrar menos ${label}`;
      };
    };
    const renderProjectRequests=()=>{
      const activeRequests=requests.filter(r=>requestStateMeta(r.status).group==="active");
      const closedRequests=requests.filter(r=>requestStateMeta(r.status).group==="closed");

      const activeBox=$("#project-requests-active");
      const activeMoreBox=$("#project-requests-active-more");
      const activeToggle=$("#project-requests-active-toggle");
      const activeCount=$("#project-requests-active-count");

      const closedBox=$("#project-requests-closed");
      const closedMoreBox=$("#project-requests-closed-more");
      const closedToggle=$("#project-requests-closed-toggle");
      const history=$("#project-requests-history");
      const historySummary=$("#project-requests-history-summary");

      const activeVisible=activeRequests.slice(0,ACTIVE_REQUEST_LIMIT);
      const activeExtra=activeRequests.slice(ACTIVE_REQUEST_LIMIT);
      const closedVisible=closedRequests.slice(0,CLOSED_REQUEST_LIMIT);
      const closedExtra=closedRequests.slice(CLOSED_REQUEST_LIMIT);

      if(activeCount)activeCount.textContent=activeRequests.length?`${activeRequests.length} activa${activeRequests.length===1?"":"s"}`:"Sin solicitudes activas";

      if(activeBox)activeBox.innerHTML=activeRequests.length?activeVisible.map(renderClientRequestCard).join(""):`<div class="empty-inline">No tienes solicitudes activas.</div>`;
      if(activeMoreBox){
        activeMoreBox.innerHTML=activeExtra.map(renderClientRequestCard).join("");
        activeMoreBox.hidden=!activeExtra.length;
      }
      if(activeToggle){
        activeToggle.hidden=!activeExtra.length;
        activeToggle.onclick=null;
      }
      wireRequestToggle(activeToggle,activeMoreBox,activeExtra.length,"solicitudes");

      if(closedBox)closedBox.innerHTML=closedRequests.length?closedVisible.map(renderClientRequestCard).join(""):`<div class="empty-inline">Todavía no hay solicitudes cerradas.</div>`;
      if(closedMoreBox){
        closedMoreBox.innerHTML=closedExtra.map(renderClientRequestCard).join("");
        closedMoreBox.hidden=!closedExtra.length;
      }
      if(closedToggle){
        closedToggle.hidden=!closedExtra.length;
        closedToggle.onclick=null;
      }
      wireRequestToggle(closedToggle,closedMoreBox,closedExtra.length,"del historial");

      if(history){
        history.hidden=!closedRequests.length;
        if(!closedRequests.length)history.removeAttribute("open");
      }
      if(historySummary)historySummary.textContent=closedRequests.length?`Ver historial de solicitudes (${closedRequests.length})`:"Ver historial de solicitudes";
    };
    renderProjectRequests();

    const dialog=$("#request-dialog"), reqForm=$("#request-form");
    $$('[data-request-type]').forEach(btn=>btn.addEventListener("click",()=>{const type=btn.dataset.requestType;reqForm.request_type.value=type;$("#request-title").textContent=requestLabels[type].title;reqForm.message.value="";setStatus("#request-status","");dialog.showModal();}));
    $$('[data-dialog-close]').forEach(btn=>btn.addEventListener("click",()=>dialog.close()));
    reqForm.addEventListener("submit",async e=>{
      e.preventDefault();const fd=new FormData(reqForm),type=String(fd.get("request_type")),message=String(fd.get("message")||"").trim();if(!message){setStatus("#request-status","Cuéntanos qué quieres cambiar.","error");return;}
      const b=reqForm.querySelector('button[type="submit"]');b.disabled=true;setStatus("#request-status","Enviando…");
      try{
        const payload={
          project_id:id,
          user_id:session.user.id,
          request_type:type,
          message:message,
          status:"Nueva",
          admin_title:requestLabels[type].publicTitle,
          admin_summary:message
        };
        const {error}=await db.from("client_requests").insert(payload);
        if(error)throw error;
        const text=[`Hola, soy ${profile.full_name}.`,`Proyecto: ${project.name}`,`Quiero: ${requestLabels[type].title}`,`Detalles: ${message}`].join("\n");
        location.assign(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`);
      }catch(err){setStatus("#request-status",friendlyError(err,"No pudimos enviar la solicitud."),"error");b.disabled=false;}
    });
  }

  async function initEditor() {
    const {session,profile}=await loadContext(); const id=getParam("project"); if(!id){location.replace("panel.html");return;}
    const [{data:project,error},{data:brief,error:briefErr}]=await Promise.all([
      db.from("client_projects").select("*").eq("id",id).single(),
      db.from("client_project_briefs").select("*").eq("project_id",id).maybeSingle()
    ]);
    if(error||briefErr) throw error||briefErr;
    startLiveUpdates(`portal-editor-${id}`,[{table:"client_projects",filter:`id=eq.${id}`}],async()=>location.reload());
    const access=editorAccessState(project);
    if(access.status!=="active"){
      location.replace(`proyecto.html?id=${encodeURIComponent(id)}`);
      return;
    }
    $("#editor-back-link").href=`proyecto.html?id=${encodeURIComponent(id)}`;
    $("#editor-project-title").textContent=project.name||"Editor de tu sitio";
    $("#editor-project-copy").textContent=project.domain?`Editando ${project.domain}`:"Haz cambios basicos sin esperar soporte.";
    $("#editor-access-badge").textContent=access.ends?`Activo hasta ${date(access.ends)}`:"Activo";

    const form=$("#editor-demo-form");
    if(form){
      form.headline.value=brief?.business_name||project.name||"";
      form.description.value=brief?.business_description||"";
      form.items.value=brief?.products_services||"";
      form.schedule.value=brief?.schedule_text||"";
      form.phone.value=brief?.public_phone||profile.phone||"";
      form.address.value=brief?.address_text||"";
      const syncPreview=()=>{
        $("#editor-preview-title").textContent=form.headline.value||project.name||"Tu negocio";
        $("#editor-preview-description").textContent=form.description.value||"Aqui se vera el texto principal del sitio.";
      };
      form.addEventListener("input",syncPreview);
      syncPreview();
    }
    $$("[data-editor-section]").forEach(btn=>btn.addEventListener("click",()=>{
      const target=btn.dataset.editorSection;
      $$("[data-editor-section]").forEach(b=>b.classList.toggle("active",b===btn));
      $$("[data-editor-panel]").forEach(panel=>panel.hidden=panel.dataset.editorPanel!==target);
    }));
    $("#editor-save-demo")?.addEventListener("click",()=>setStatus("#editor-save-status","Esta pantalla ya esta lista. Falta conectar el guardado real.","success"));
  }

  async function start(){
    try{
      if(page==="access")await initAccess();
      else if(page==="callback")await initCallback();
      else if(page==="panel")await initPanel();
      else if(page==="profile")await initProfile();
      else if(page==="configure")await initConfigure();
      else if(page==="project")await initProject();
      else if(page==="editor")await initEditor();
    }catch(error){
      if(["AUTH_REDIRECT","PROFILE_REDIRECT"].includes(error.message))return;
      console.error(error);const msg=friendlyError(error,"No pudimos cargar esta información. Intenta nuevamente.");
      const status=$("#auth-status")||$("#callback-status")||$("#profile-page-status")||$("#setup-status")||$("#brief-status")||$("#request-status");if(status)status.textContent=msg;
      const grid=$("#projects-grid");if(grid)grid.innerHTML=`<div class="empty-card empty-card-wide"><h3>No pudimos cargar tus proyectos</h3><p>${safe(msg)}</p></div>`;
    }
  }
  document.addEventListener("visibilitychange",refreshVisiblePortalPage);
  window.addEventListener("pagehide",stopLiveUpdates);
  start();
})();
