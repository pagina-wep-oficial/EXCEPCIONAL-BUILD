(() => {
  "use strict";

  const portal = window.EBPortal || {};
  const db = portal.client;
  const WHATSAPP = "529811332914";
  const PROD_ORIGIN = (location.protocol.startsWith("http") && !["localhost","127.0.0.1"].includes(location.hostname)) ? location.origin : "https://excepcional-build.pages.dev";
  const state = { session:null, prospects:[], clients:[], projects:[], requests:[], quotes:[], currentProject:null };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v="") => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const money = (v) => v == null || v === "" || Number.isNaN(Number(v)) ? "—" : new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v));
  const fmtDate = (v) => v ? new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v)) : "—";
  const localDate = (v=new Date()) => { const d=v instanceof Date?v:new Date(v); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
  const phoneDigits = (v) => String(v||"").replace(/\D/g,"");
  const cleanUrl = (v) => String(v||"").trim() || null;

  function statusClass(value="") {
    const s=value.toLowerCase();
    if(/ganado|publicado|resuelta|cerrada|pagado/.test(s)) return "green";
    if(/interesado|cotización|revisión|nueva/.test(s)) return "orange";
    if(/desarrollo|proceso|aprobación|contenido/.test(s)) return "blue";
    if(/seguimiento|esperando|pendiente/.test(s)) return "yellow";
    if(/descartado|cancelado/.test(s)) return "red";
    return "";
  }

  function toast(message) {
    const el=$("#crm-toast"); if(!el) return;
    el.textContent=message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),2300);
  }

  function setLine(selector,text,tone="") {
    const el=$(selector); if(!el)return; el.textContent=text; el.className=`status-line${tone?` ${tone}`:""}`;
  }

  function clientById(id) { return state.clients.find(c=>c.id===id); }
  function projectById(id) { return state.projects.find(p=>p.id===id); }
  function projectsForClient(id) { return state.projects.filter(p=>p.user_id===id); }
  function projectForProspect(id) { return state.projects.find(p=>String(p.source_prospect_id||"")===String(id)); }

  function setView(name) {
    $$(".crm-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    $$("[data-view-panel]").forEach(p=>p.classList.toggle("active",p.dataset.viewPanel===name));
    const meta={
      dashboard:["Resumen","Vista general del trabajo comercial y los proyectos."],
      prospects:["Prospectos","Personas y negocios antes de convertirse en clientes."],
      clients:["Clientes","Cuentas del portal y su relación con los proyectos."],
      projects:["Proyectos","Controla estado, pagos, enlaces y lo que ve cada cliente."],
      requests:["Solicitudes","Cambios, mantenimiento y servicios pedidos desde el portal."]
    }[name]||["CRM",""];
    $("#view-title").textContent=meta[0]; $("#view-subtitle").textContent=meta[1];
  }

  async function checkAdmin(session) {
    const { data, error } = await db.rpc("is_app_admin");
    if(error) throw error;
    return Boolean(data);
  }

  async function showSession(session) {
    state.session=session;
    if(!session){ $("#crm-login").hidden=false; $("#crm-app").hidden=true; return; }
    try {
      const isAdmin=await checkAdmin(session);
      if(!isAdmin){
        $("#crm-login").hidden=false; $("#crm-app").hidden=true;
        setLine("#crm-login-status","Esta cuenta inició sesión, pero todavía no está registrada como administradora en app_admins.","error");
        return;
      }
      $("#crm-login").hidden=true; $("#crm-app").hidden=false;
      $("#admin-email").textContent=session.user.email||"";
      $("#admin-name").textContent=session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"Administrador";
      await loadAll();
    } catch(error){ setLine("#crm-login-status",error.message||"No pudimos verificar permisos.","error"); }
  }

  async function loadAll() {
    const results=await Promise.all([
      db.from("prospectos").select("*").order("creado_en",{ascending:false}),
      db.from("client_profiles").select("*").order("created_at",{ascending:false}),
      db.from("client_projects").select("*").order("created_at",{ascending:false}),
      db.from("client_requests").select("*").order("created_at",{ascending:false}),
      db.from("client_quotes").select("*").order("created_at",{ascending:false})
    ]);
    const [prospects,clients,projects,requests,quotes]=results;
    for(const r of results) if(r.error) throw r.error;
    state.prospects=prospects.data||[]; state.clients=clients.data||[]; state.projects=projects.data||[]; state.requests=requests.data||[]; state.quotes=quotes.data||[];
    renderAll();
  }

  function renderAll(){ renderDashboard(); renderProspects(); renderClients(); renderProjects(); renderRequests(); fillClientSelect(); }

  function renderDashboard(){
    const activeProspects=state.prospects.filter(p=>!["Ganado","Descartado"].includes(p.estado));
    $("#metric-prospects").textContent=activeProspects.length;
    $("#metric-interested").textContent=state.prospects.filter(p=>["Interesado","Seguimiento","Cotización"].includes(p.estado)).length;
    $("#metric-projects").textContent=state.projects.filter(p=>!/publicado|mantenimiento|cancelado/i.test(`${p.project_stage} ${p.status}`)).length;
    $("#metric-live").textContent=state.projects.filter(p=>p.site_visibility==="public"||/publicado|mantenimiento/i.test(`${p.project_stage} ${p.status}`)).length;
    $("#metric-requests").textContent=state.requests.filter(r=>!/resuelta|cerrada/i.test(r.status||"")).length;

    const today=localDate();
    const next=activeProspects.filter(p=>p.proxima_accion).sort((a,b)=>String(a.proxima_accion).localeCompare(String(b.proxima_accion))).slice(0,6);
    $("#dashboard-next-actions").innerHTML=next.length?next.map(p=>`<div class="mini-item"><div><strong>${esc(p.negocio)}</strong><span>${esc(p.nombre)} · ${p.proxima_accion}${p.proxima_accion<today?" · Vencido":""}</span></div><span class="badge ${statusClass(p.estado)}">${esc(p.estado)}</span></div>`).join(""):`<div class="empty">No hay seguimientos programados.</div>`;
    const recent=state.requests.filter(r=>!/cerrada/i.test(r.status||"")).slice(0,6);
    $("#dashboard-requests").innerHTML=recent.length?recent.map(r=>{const p=projectById(r.project_id);return `<div class="mini-item"><div><strong>${esc(p?.name||"Proyecto")}</strong><span>${esc(r.request_type)} · ${fmtDate(r.created_at)}</span></div><span class="badge ${statusClass(r.status)}">${esc(r.status)}</span></div>`}).join(""):`<div class="empty">No hay solicitudes nuevas.</div>`;
  }

  function renderProspects(){
    const q=$("#prospect-search")?.value.toLowerCase().trim()||""; const filter=$("#prospect-filter")?.value||"";
    const visible=state.prospects.filter(p=>(!filter||p.estado===filter)&&`${p.negocio} ${p.nombre} ${p.municipio} ${p.telefono}`.toLowerCase().includes(q));
    const tbody=$("#prospect-rows");
    tbody.innerHTML=visible.map(p=>{
      const linked=projectForProspect(p.id);
      const quoteUrl=`${PROD_ORIGIN}/cotizar.html?ref=${encodeURIComponent(p.id)}&nombre=${encodeURIComponent(p.nombre||"")}&negocio=${encodeURIComponent(p.negocio||"")}&ubicacion=${encodeURIComponent(p.municipio||"")}&telefono=${encodeURIComponent(p.telefono||"")}`;
      const wa=`https://wa.me/52${phoneDigits(p.telefono).replace(/^52/,"")}?text=${encodeURIComponent(`Hola ${p.nombre||""}, soy de Excepcional Build.`)}`;
      return `<tr><td><strong>${esc(p.negocio)}</strong><span class="sub">${esc(p.municipio||"")}</span></td><td>${esc(p.nombre)}<span class="sub">${esc(p.telefono)}</span></td><td>${esc(p.origen||"—")}</td><td><span class="badge ${statusClass(p.estado)}">${esc(p.estado)}</span></td><td>${esc(p.proxima_accion||"Sin fecha")}</td><td><div class="row-actions"><a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a><a class="link-btn" href="${quoteUrl}" target="_blank" rel="noopener">Cotizador</a>${linked?`<button class="tiny-btn green" data-open-project="${linked.id}">Ver proyecto</button>`:`<button class="tiny-btn orange" data-create-project="${p.id}">Crear proyecto</button>`}<button class="tiny-btn" data-edit-prospect="${p.id}">Editar</button></div></td></tr>`;
    }).join("");
    $("#prospect-empty").hidden=visible.length>0;
  }

  function renderClients(){
    const q=$("#client-search")?.value.toLowerCase().trim()||"";
    const visible=state.clients.filter(c=>`${c.full_name} ${c.email} ${c.phone} ${c.business_name}`.toLowerCase().includes(q));
    $("#clients-grid").innerHTML=visible.length?visible.map(c=>{
      const count=projectsForClient(c.id).length; const published=projectsForClient(c.id).filter(p=>p.site_visibility==="public").length;
      const avatar=c.avatar_url?`<img src="${esc(c.avatar_url)}" alt="">`:esc((c.full_name||c.email||"EB").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase());
      const wa = c.phone ? `https://wa.me/52${phoneDigits(c.phone).replace(/^52/,"")}` : "";
      return `<article class="client-card"><div class="client-card-top"><div class="client-avatar">${avatar}</div><div><h3>${esc(c.full_name||"Cliente")}</h3><p>${esc(c.email||"")}</p></div></div><div class="client-meta"><div><span>WhatsApp</span><strong>${esc(c.phone||"—")}</strong></div><div><span>Negocio</span><strong>${esc(c.business_name||"—")}</strong></div><div><span>Proyectos</span><strong>${count}</strong></div><div><span>Publicados</span><strong>${published}</strong></div></div><div class="row-actions" style="margin-top:12px">${wa?`<a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="tiny-btn" data-client-projects="${c.id}">Ver proyectos</button></div></article>`;
    }).join(""):`<div class="empty">Todavía no hay cuentas de clientes.</div>`;
  }

  function renderProjects(){
    const q=$("#project-search")?.value.toLowerCase().trim()||""; const stage=$("#project-stage-filter")?.value||"";
    const visible=state.projects.filter(p=>{const c=clientById(p.user_id);return (!stage||p.project_stage===stage)&&`${p.name} ${p.domain} ${c?.full_name||""} ${c?.email||""}`.toLowerCase().includes(q)});
    $("#project-rows").innerHTML=visible.map(p=>{
      const c=clientById(p.user_id); const payment=p.total_price?`${money(p.deposit_amount)} / ${money(p.balance_amount)}`:"Sin configurar";
      const visibility={hidden:"Oculto",preview:"Vista previa",public:"Publicado"}[p.site_visibility]||"Oculto";
      return `<tr><td class="project-name"><strong>${esc(p.name)}</strong><span class="sub">${esc(p.domain||"Sin dirección")} · ${fmtDate(p.created_at)}</span></td><td>${c?`${esc(c.full_name||"Cliente")}<span class="sub">${esc(c.email||"")}</span>`:`<span class="badge yellow">Sin cuenta</span>`}</td><td><span class="badge ${statusClass(p.project_stage||p.status)}">${esc(p.project_stage||"Cotización")}</span><span class="sub">${esc(p.status||"")}</span></td><td>${esc(visibility)}</td><td>${payment}<span class="sub">${p.deposit_paid?"Anticipo ✓":"Anticipo pendiente"}</span></td><td><div class="row-actions"><button class="tiny-btn" data-open-project="${p.id}">Administrar</button>${!p.user_id?`<button class="tiny-btn orange" data-copy-invite="${p.id}">Invitación</button>`:""}</div></td></tr>`;
    }).join("");
    $("#project-empty").hidden=visible.length>0;
  }

  function renderRequests(){
    const q=$("#request-search")?.value.toLowerCase().trim()||""; const filter=$("#request-filter")?.value||"";
    const visible=state.requests.filter(r=>{const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id);return (!filter||r.status===filter)&&`${r.message} ${r.request_type} ${p?.name||""} ${c?.full_name||""}`.toLowerCase().includes(q)});
    $("#request-rows").innerHTML=visible.map(r=>{const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id);return `<tr><td><strong>${esc(p?.name||"Proyecto")}</strong></td><td>${esc(c?.full_name||"Cliente")}<span class="sub">${esc(c?.phone||"")}</span></td><td><span class="badge orange">${esc(r.request_type)}</span></td><td class="request-message">${esc(r.message)}</td><td><select class="control request-status" data-request-status="${r.id}"><option${r.status==="Nueva"?" selected":""}>Nueva</option><option${r.status==="En revisión"?" selected":""}>En revisión</option><option${r.status==="En proceso"?" selected":""}>En proceso</option><option${r.status==="Resuelta"?" selected":""}>Resuelta</option><option${r.status==="Cerrada"?" selected":""}>Cerrada</option></select></td><td>${fmtDate(r.created_at)}</td></tr>`}).join("");
    $("#request-empty").hidden=visible.length>0;
  }

  function fillClientSelect(){
    const select=$("#project-form [name=user_id]"); if(!select)return;
    const current=select.value;
    select.innerHTML=`<option value="">Sin cuenta todavía</option>`+state.clients.map(c=>`<option value="${c.id}">${esc(c.full_name||c.email)} · ${esc(c.email||"")}</option>`).join("");
    select.value=current;
  }

  function inviteUrl(project){
    if(!project?.id||!project.claim_token||project.user_id) return "";
    return `${PROD_ORIGIN}/acceso.html?claim=${encodeURIComponent(project.id)}&token=${encodeURIComponent(project.claim_token)}`;
  }

  function setProjectForm(project={}){
    const form=$("#project-form"); state.currentProject=project.id?project:null;
    form.reset(); form.elements.id.value=project.id||""; form.elements.source_prospect_id.value=project.source_prospect_id||"";
    form.elements.name.value=project.name||""; fillClientSelect(); form.elements.user_id.value=project.user_id||"";
    form.elements.project_stage.value=project.project_stage||"Cotización"; form.elements.status.value=project.status||"Solicitud en revisión";
    form.elements.address_type.value=project.address_type||"gratis"; form.elements.domain.value=project.domain||""; form.elements.hosting_type.value=project.hosting_type||"cloudflare"; form.elements.site_visibility.value=project.site_visibility||"hidden";
    form.elements.site_url.value=project.site_url||""; form.elements.preview_url.value=project.preview_url||""; form.elements.total_price.value=project.total_price??750; form.elements.deposit_amount.value=project.deposit_amount??375; form.elements.balance_amount.value=project.balance_amount??375;
    form.elements.deposit_paid.checked=Boolean(project.deposit_paid); form.elements.balance_paid.checked=Boolean(project.balance_paid); form.elements.client_note.value=project.client_note||"";
    $("#project-modal-title").textContent=project.id?project.name:"Nuevo proyecto"; setLine("#project-form-status","");
    const inv=inviteUrl(project); $("#project-invite-box").hidden=!project.id||Boolean(project.user_id);
    $("#project-invite-url").textContent=inv||"Guarda el proyecto para generar una invitación.";
    $("#project-update-box").hidden=!project.id;
    $("#update-title").value=""; $("#update-status").value=""; $("#update-description").value="";
  }

  async function openProject(id){
    const project=projectById(id); if(!project)return;
    if(!project.user_id && !project.claim_token){
      const token=crypto.randomUUID();
      const {data,error}=await db.from("client_projects").update({claim_token:token}).eq("id",id).select().single();
      if(!error){Object.assign(project,data);}
    }
    setProjectForm(project);
    const briefBox = $("#project-brief-admin-content");
    if (briefBox) briefBox.innerHTML = "<span>Cargando información…</span>";
    const { data: brief, error: briefError } = await db.from("client_project_briefs").select("*").eq("project_id", id).maybeSingle();
    if (briefBox) {
      if (briefError) {
        briefBox.innerHTML = `<span>${esc(briefError.message || "No se pudo cargar la información.")}</span>`;
      } else if (!brief) {
        briefBox.innerHTML = "<span>Este proyecto todavía no tiene información adicional.</span>";
      } else {
        const fields = [
          ["Negocio",brief.business_description],["Productos / servicios",brief.products_services],["Dirección",brief.address_text],["Horario",brief.schedule_text],
          ["WhatsApp público",brief.public_phone],["Redes",brief.social_links],["Estilo / colores",brief.visual_notes],["Notas",brief.extra_notes]
        ].filter(([,value])=>value);
        briefBox.innerHTML = fields.length ? fields.map(([label,value])=>`<div><b>${esc(label)}</b><span>${esc(value)}</span></div>`).join("") : "<span>El cliente abrió el formulario, pero todavía no agregó información.</span>";
      }
    }
    $("#project-modal").showModal();
  }

  async function createProjectFromProspect(id){
    const lead=state.prospects.find(p=>String(p.id)===String(id)); if(!lead)return;
    const existing=projectForProspect(id); if(existing){openProject(existing.id);return;}
    const total=Number(lead.monto_inicial)||750; const deposit=Math.round((total/2)*100)/100; const balance=Math.round((total-deposit)*100)/100;
    const domain=lead.dominio||null; const addressType=domain&&!String(domain).includes("pages.dev")?"dominio":"gratis";
    const {data,error}=await db.from("client_projects").insert({
      user_id:lead.client_user_id||null, name:lead.negocio||"Nuevo proyecto", status:"Solicitud en revisión", project_stage:"Cotización", site_visibility:"hidden",
      address_type:addressType, domain, hosting_type:/hostinger|especial/i.test(lead.hosting||"")?"hostinger":"cloudflare", source_prospect_id:String(lead.id), total_price:total,
      deposit_amount:deposit,balance_amount:balance,client_note:"Proyecto registrado. Cuando tengamos una vista lista aparecerá en tu portal."
    }).select().single();
    if(error){toast(error.message||"No se pudo crear el proyecto.");return;}
    state.projects.unshift(data); renderAll(); openProject(data.id); toast("Proyecto creado.");
  }

  async function saveProject(event){
    event.preventDefault(); const form=event.currentTarget; const fd=new FormData(form); const id=String(fd.get("id")||""); const old=projectById(id);
    const userId=String(fd.get("user_id")||"")||null; const siteVisibility=String(fd.get("site_visibility")||"hidden");
    const payload={
      user_id:userId,name:String(fd.get("name")||"").trim(),project_stage:String(fd.get("project_stage")||"Cotización"),status:String(fd.get("status")||"").trim()||String(fd.get("project_stage")||"Cotización"),
      address_type:String(fd.get("address_type")||"gratis"),domain:String(fd.get("domain")||"").trim()||null,hosting_type:String(fd.get("hosting_type")||"cloudflare"),site_visibility:siteVisibility,
      site_url:cleanUrl(fd.get("site_url")),preview_url:cleanUrl(fd.get("preview_url")),total_price:fd.get("total_price")?Number(fd.get("total_price")):null,deposit_amount:fd.get("deposit_amount")?Number(fd.get("deposit_amount")):null,
      balance_amount:fd.get("balance_amount")?Number(fd.get("balance_amount")):null,deposit_paid:fd.get("deposit_paid")==="on",balance_paid:fd.get("balance_paid")==="on",client_note:String(fd.get("client_note")||"").trim()||null,
      source_prospect_id:String(fd.get("source_prospect_id")||"")||null,updated_at:new Date().toISOString()
    };
    if(siteVisibility==="public"&&payload.site_url&&!(old?.published_at)) payload.published_at=new Date().toISOString();
    setLine("#project-form-status","Guardando…");
    let result;
    if(id){ result=await db.from("client_projects").update(payload).eq("id",id).select().single(); }
    else { result=await db.from("client_projects").insert({...payload,claim_token:userId?null:crypto.randomUUID()}).select().single(); }
    if(result.error){setLine("#project-form-status",result.error.message,"error");return;}
    const saved=result.data;
    if(userId && (!old || old.user_id!==userId)){
      await Promise.all([db.from("client_quotes").update({user_id:userId}).eq("project_id",saved.id),db.from("client_updates").update({user_id:userId}).eq("project_id",saved.id)]);
      if(saved.source_prospect_id) await db.from("prospectos").update({client_user_id:userId,client_project_id:saved.id}).eq("id",saved.source_prospect_id).then(()=>{});
    }
    const idx=state.projects.findIndex(p=>p.id===saved.id); if(idx>=0)state.projects[idx]=saved;else state.projects.unshift(saved);
    state.currentProject=saved; renderAll(); setProjectForm(saved); setLine("#project-form-status","Proyecto guardado.","success"); toast("Proyecto actualizado.");
  }

  async function addProjectUpdate(){
    const project=state.currentProject; if(!project)return;
    const title=$("#update-title").value.trim(),description=$("#update-description").value.trim(),status=$("#update-status").value.trim();
    if(!title){toast("Escribe un título para el avance.");return;}
    const {error}=await db.from("client_updates").insert({project_id:project.id,user_id:project.user_id||null,title,description:description||null,status:status||null});
    if(error){toast(error.message);return;} $("#update-title").value="";$("#update-description").value="";$("#update-status").value="";toast("Avance agregado al proyecto.");
  }

  async function renewInvite(){
    const p=state.currentProject;if(!p||p.user_id)return; const token=crypto.randomUUID();
    const {data,error}=await db.from("client_projects").update({claim_token:token}).eq("id",p.id).select().single(); if(error){toast(error.message);return;}
    Object.assign(p,data);setProjectForm(p);toast("Nueva invitación generada.");
  }

  async function copyInvite(id){
    const p=projectById(id); if(!p||p.user_id)return;
    if(!p.claim_token){const {data,error}=await db.from("client_projects").update({claim_token:crypto.randomUUID()}).eq("id",p.id).select().single();if(error){toast(error.message);return;}Object.assign(p,data);}
    const url=inviteUrl(p); await navigator.clipboard.writeText(url); toast("Invitación copiada.");
  }

  async function saveProspect(event){
    event.preventDefault(); const form=event.currentTarget; const fd=new FormData(form); const id=String(fd.get("id")||""); const phone=phoneDigits(fd.get("telefono"));
    if(phone.length<10){setLine("#prospect-status","Escribe un WhatsApp válido.","error");return;}
    const payload={nombre:String(fd.get("nombre")||"").trim(),negocio:String(fd.get("negocio")||"").trim(),municipio:String(fd.get("municipio")||"").trim(),telefono:phone,origen:String(fd.get("origen")||"Otro"),estado:String(fd.get("estado")||"Nuevo"),necesidad:String(fd.get("necesidad")||"").trim(),proxima_accion:fd.get("proxima_accion")||null,notas:String(fd.get("notas")||"").trim()||null};
    setLine("#prospect-status","Guardando…"); const result=id?await db.from("prospectos").update(payload).eq("id",id).select().single():await db.from("prospectos").insert(payload).select().single();
    if(result.error){setLine("#prospect-status",result.error.message||"No pudimos guardar.","error");return;}
    const idx=state.prospects.findIndex(p=>String(p.id)===String(result.data.id));if(idx>=0)state.prospects[idx]=result.data;else state.prospects.unshift(result.data);
    form.reset();form.elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","Prospecto guardado.","success");renderAll();
  }

  function editProspect(id){
    const p=state.prospects.find(x=>String(x.id)===String(id));if(!p)return;const form=$("#prospect-form");
    ["id","negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas"].forEach(k=>{if(form.elements[k])form.elements[k].value=p[k]??""});
    $("#cancel-prospect").hidden=false;form.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function exportProspects(){
    if(!state.prospects.length){toast("No hay prospectos para exportar.");return;}
    const headers=["Negocio","Contacto","Municipio","WhatsApp","Origen","Estado","Necesidad","Próxima acción","Notas","Dominio","Hosting","Monto inicial","Renovación","Fecha"];
    const fields=["negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas","dominio","hosting","monto_inicial","monto_renovacion","creado_en"];
    const csv=[headers,...state.prospects.map(p=>fields.map(f=>p[f]??""))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`excepcional-build-prospectos-${localDate()}.csv`;a.click();URL.revokeObjectURL(url);
  }

  // Auth
  $("#crm-login-form")?.addEventListener("submit",async(e)=>{e.preventDefault();if(!db){setLine("#crm-login-status","Supabase no está configurado.","error");return;}const fd=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;setLine("#crm-login-status","Verificando…");const {error}=await db.auth.signInWithPassword({email:fd.get("email"),password:fd.get("password")});if(error){setLine("#crm-login-status","Correo o contraseña incorrectos.","error");btn.disabled=false;return;}btn.disabled=false;});
  $("#crm-logout")?.addEventListener("click",async()=>{await db.auth.signOut();location.reload();});

  // Navigation / filters
  $$(".crm-nav [data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $("#refresh-all")?.addEventListener("click",()=>loadAll().then(()=>toast("Datos actualizados." )).catch(e=>toast(e.message)));
  $("#prospect-search")?.addEventListener("input",renderProspects);$("#prospect-filter")?.addEventListener("change",renderProspects);$("#client-search")?.addEventListener("input",renderClients);$("#project-search")?.addEventListener("input",renderProjects);$("#project-stage-filter")?.addEventListener("change",renderProjects);$("#request-search")?.addEventListener("input",renderRequests);$("#request-filter")?.addEventListener("change",renderRequests);
  $("#prospect-form")?.addEventListener("submit",saveProspect);$("#cancel-prospect")?.addEventListener("click",()=>{$("#prospect-form").reset();$("#prospect-form").elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","")});$("#export-prospects")?.addEventListener("click",exportProspects);
  $("#project-form")?.addEventListener("submit",saveProject);$("#new-project")?.addEventListener("click",()=>{setProjectForm({total_price:750,deposit_amount:375,balance_amount:375,status:"Solicitud en revisión",project_stage:"Cotización",site_visibility:"hidden"});$("#project-modal").showModal();});$$('[data-close-project]').forEach(b=>b.addEventListener("click",()=>$("#project-modal").close()));
  $("#copy-project-invite")?.addEventListener("click",async()=>{const url=$("#project-invite-url").textContent;if(url&&/^https?:/.test(url)){await navigator.clipboard.writeText(url);toast("Invitación copiada.")}});$("#renew-project-invite")?.addEventListener("click",renewInvite);$("#add-project-update")?.addEventListener("click",addProjectUpdate);

  $("#prospect-rows")?.addEventListener("click",e=>{const edit=e.target.dataset.editProspect,create=e.target.dataset.createProject,open=e.target.dataset.openProject;if(edit)editProspect(edit);if(create)createProjectFromProspect(create);if(open)openProject(open)});
  $("#project-rows")?.addEventListener("click",e=>{const open=e.target.dataset.openProject,copy=e.target.dataset.copyInvite;if(open)openProject(open);if(copy)copyInvite(copy)});
  $("#request-rows")?.addEventListener("change",async e=>{const id=e.target.dataset.requestStatus;if(!id)return;const status=e.target.value;const {data,error}=await db.from("client_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id).select().single();if(error){toast(error.message);return;}const idx=state.requests.findIndex(r=>r.id===id);if(idx>=0)state.requests[idx]=data;renderDashboard();toast("Estado actualizado.")});
  $("#clients-grid")?.addEventListener("click",e=>{const id=e.target.dataset.clientProjects;if(!id)return;const c=clientById(id);setView("projects");$("#project-search").value=c?.full_name||c?.email||"";renderProjects();});

  if(!portal.configured){setLine("#crm-login-status",portal.configError||"Supabase no está configurado.","error");return;}
  db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>showSession(session),0));
  db.auth.getSession().then(({data})=>showSession(data.session));
})();
