(() => {
  "use strict";

  const portal=window.EBPortal||{};
  const db=portal.client;
  const WHATSAPP="529811332914";
  const PROD_ORIGIN=(location.protocol.startsWith("http")&&!['localhost','127.0.0.1'].includes(location.hostname))?location.origin:"https://excepcional-build.pages.dev";
  const state={session:null,prospects:[],clients:[],projects:[],requests:[],currentProject:null,currentProspect:null};

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v="")=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const digits=(v)=>String(v||"").replace(/\D/g,"");
  const money=(v)=>v==null||v===""||Number.isNaN(Number(v))?"—":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v));
  const fmtDate=(v)=>v?new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v)):"—";
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
  const waNumber=(phone)=>{const d=digits(phone);return d.startsWith("52")?d:`52${d}`;};
  const clientById=(id)=>state.clients.find(c=>c.id===id);
  const projectById=(id)=>state.projects.find(p=>p.id===id);
  const prospectById=(id)=>state.prospects.find(p=>String(p.id)===String(id));
  const projectForProspect=(id)=>state.projects.find(p=>String(p.source_prospect_id||"")===String(id));
  const projectsForClient=(id)=>state.projects.filter(p=>p.user_id===id);
  const invitedProjects=()=>state.projects.filter(p=>!p.user_id);

  function statusClass(value=""){
    const s=String(value).toLowerCase();
    if(/publicado|resuelta|cerrada|pagado/.test(s))return "green";
    if(/invitación|invitacion|interesado|nuevo|revisión|revision/.test(s))return "orange";
    if(/producción|produccion|desarrollo|configuración|configuracion/.test(s))return "blue";
    if(/información|informacion|seguimiento|esperando|pendiente/.test(s))return "yellow";
    if(/descartado|cancelado/.test(s))return "red";
    return "";
  }
  function toast(message){const el=$("#crm-toast");if(!el)return;el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2300);}
  function setLine(selector,text,tone=""){const el=$(selector);if(!el)return;el.textContent=text;el.className=`status-line${tone?` ${tone}`:""}`;}
  function inviteUrl(project){return project?.id&&project?.claim_token&&!project.user_id?`${PROD_ORIGIN}/acceso.html?claim=${encodeURIComponent(project.id)}&token=${encodeURIComponent(project.claim_token)}`:"";}
  function inviteMessage(project){const p=prospectById(project.source_prospect_id),name=p?.nombre||"";return `Hola${name?` ${name}`:""}. Tu proyecto con Excepcional Build ya está preparado.\n\nActiva tu cuenta aquí para continuar con la configuración de tu página y enviarnos la información del negocio:\n${inviteUrl(project)}`;}

  function setView(name){
    $$(".crm-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    $$('[data-view-panel]').forEach(p=>p.classList.toggle("active",p.dataset.viewPanel===name));
    const meta={dashboard:["Resumen","Vista general del negocio."],prospects:["Prospectos","Personas interesadas que todavía no han aceptado."],invited:["Clientes invitados","Aceptaron trabajar contigo y están pendientes de activar su cuenta."],clients:["Clientes","Personas que ya activaron su cuenta."],projects:["Proyectos","Control de producción, pagos y publicación."],requests:["Solicitudes","Cambios y mantenimiento pedidos por clientes."]}[name]||["CRM",""];
    $("#view-title").textContent=meta[0];$("#view-subtitle").textContent=meta[1];
  }
  async function checkAdmin(){const {data,error}=await db.rpc("is_app_admin");if(error)throw error;return Boolean(data);}
  async function showSession(session){
    state.session=session;
    if(!session){$("#crm-login").hidden=false;$("#crm-app").hidden=true;return;}
    try{if(!await checkAdmin()){setLine("#crm-login-status","Esta cuenta no tiene permisos de administrador.","error");$("#crm-login").hidden=false;$("#crm-app").hidden=true;return;}$("#crm-login").hidden=true;$("#crm-app").hidden=false;$("#admin-email").textContent=session.user.email||"";$("#admin-name").textContent=session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"Administrador";await loadAll();}
    catch(err){setLine("#crm-login-status","No pudimos comprobar tus permisos.","error");}
  }
  async function loadAll(){
    const results=await Promise.all([
      db.from("prospectos").select("*").order("creado_en",{ascending:false}),
      db.from("client_profiles").select("*").order("created_at",{ascending:false}),
      db.from("client_projects").select("*").order("created_at",{ascending:false}),
      db.from("client_requests").select("*").order("created_at",{ascending:false})
    ]);
    for(const r of results)if(r.error)throw r.error;
    state.prospects=results[0].data||[];state.clients=results[1].data||[];state.projects=results[2].data||[];state.requests=results[3].data||[];renderAll();
  }
  function renderAll(){renderDashboard();renderProspects();renderInvited();renderClients();renderProjects();renderRequests();fillClientSelect();}

  function renderDashboard(){
    const active=state.prospects.filter(p=>!["Ganado","Descartado"].includes(p.estado));
    $("#metric-prospects").textContent=active.length;$("#metric-invited").textContent=invitedProjects().length;$("#metric-clients").textContent=state.clients.length;$("#metric-projects").textContent=state.projects.filter(p=>/producción|produccion|revisión|revision|información|informacion|configuración|configuracion/i.test(p.project_stage||"")).length;$("#metric-requests").textContent=state.requests.filter(r=>!/resuelta|cerrada/i.test(r.status||"")).length;$("#nav-invited-count").textContent=invitedProjects().length?invitedProjects().length:"";
    const next=[];
    invitedProjects().slice(0,3).forEach(p=>{const lead=prospectById(p.source_prospect_id);next.push(`<div class="mini-item"><div><strong>${esc(p.name)}</strong><span>${lead?esc(lead.nombre):"Cliente"} · Falta activar cuenta</span></div><button class="tiny-btn orange" data-copy-invite="${p.id}">Invitación</button></div>`);});
    active.filter(p=>p.proxima_accion).sort((a,b)=>String(a.proxima_accion).localeCompare(String(b.proxima_accion))).slice(0,4).forEach(p=>next.push(`<div class="mini-item"><div><strong>${esc(p.negocio)}</strong><span>${esc(p.nombre)} · ${esc(p.proxima_accion)}</span></div><span class="badge ${statusClass(p.estado)}">${esc(p.estado)}</span></div>`));
    $("#dashboard-next-actions").innerHTML=next.length?next.join(""):`<div class="empty">No hay acciones pendientes.</div>`;
    const recent=state.requests.filter(r=>!/cerrada/i.test(r.status||"")).slice(0,6);$("#dashboard-requests").innerHTML=recent.length?recent.map(r=>{const p=projectById(r.project_id);return `<div class="mini-item"><div><strong>${esc(p?.name||"Proyecto")}</strong><span>${esc(r.request_type)} · ${fmtDate(r.created_at)}</span></div><span class="badge ${statusClass(r.status)}">${esc(r.status)}</span></div>`}).join(""):`<div class="empty">No hay solicitudes nuevas.</div>`;
  }

  function renderProspects(){
    const q=$("#prospect-search")?.value.toLowerCase().trim()||"", filter=$("#prospect-filter")?.value||"";
    const visible=state.prospects.filter(p=>(!filter||p.estado===filter)&&`${p.negocio} ${p.nombre} ${p.municipio} ${p.telefono}`.toLowerCase().includes(q));
    $("#prospect-rows").innerHTML=visible.map(p=>{
      const linked=projectForProspect(p.id),wa=`https://wa.me/${waNumber(p.telefono)}?text=${encodeURIComponent(`Hola ${p.nombre||""}, soy de Excepcional Build.`)}`;
      return `<tr><td><strong>${esc(p.negocio)}</strong><span class="sub">${esc(p.municipio||"")}</span></td><td>${esc(p.nombre)}<span class="sub">${esc(p.telefono)}</span></td><td>${esc(p.origen||"—")}</td><td><span class="badge ${statusClass(p.estado)}">${esc(p.estado||"Nuevo")}</span></td><td>${esc(p.proxima_accion||"Sin fecha")}</td><td><div class="row-actions"><a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>${linked?`<button class="tiny-btn green" data-open-project="${linked.id}">${linked.user_id?"Ver proyecto":"Ver invitación"}</button>`:`<button class="tiny-btn orange" data-accept-prospect="${p.id}">✓ Aceptó</button>`}<button class="tiny-btn" data-edit-prospect="${p.id}">Editar</button></div></td></tr>`;
    }).join("");$("#prospect-empty").hidden=visible.length>0;
  }

  function renderInvited(){
    const invited=invitedProjects();
    $("#invited-grid").innerHTML=invited.length?invited.map(p=>{const lead=prospectById(p.source_prospect_id),url=inviteUrl(p);return `<article class="invite-card"><div class="invite-card-head"><div><span class="badge orange">Pendiente de activar</span><h3>${esc(p.name)}</h3><p>${esc(lead?.nombre||"Cliente sin cuenta")}${lead?.telefono?` · ${esc(lead.telefono)}`:""}</p></div><span class="invite-status-dot"></span></div><div class="invite-meta"><div><span>Precio</span><strong>${money(p.total_price)}</strong></div><div><span>Anticipo</span><strong>${money(p.deposit_amount)}</strong></div><div><span>Aceptó</span><strong>${fmtDate(p.accepted_at||p.created_at)}</strong></div><div><span>Invitación</span><strong>${p.invitation_sent_at?`Enviada ${fmtDate(p.invitation_sent_at)}`:"Sin enviar"}</strong></div></div><div class="invite-link">${esc(url)}</div><div class="row-actions"><button class="button light small" data-copy-invite="${p.id}">Copiar acceso</button>${lead?.telefono?`<button class="button accent small" data-send-invite="${p.id}">Enviar por WhatsApp</button>`:""}<button class="button light small" data-open-project="${p.id}">Administrar</button></div></article>`}).join(""):`<div class="empty panel">No hay clientes esperando activar su cuenta.</div>`;
  }

  function renderClients(){
    const q=$("#client-search")?.value.toLowerCase().trim()||"";const visible=state.clients.filter(c=>`${c.full_name} ${c.email} ${c.phone} ${c.location}`.toLowerCase().includes(q));
    $("#clients-grid").innerHTML=visible.length?visible.map(c=>{const projects=projectsForClient(c.id),published=projects.filter(p=>p.site_visibility==="public").length,avatar=c.avatar_url?`<img src="${esc(c.avatar_url)}" alt="">`:esc((c.full_name||c.email||"EB").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()),wa=c.phone?`https://wa.me/${waNumber(c.phone)}`:"";return `<article class="client-card"><div class="client-card-top"><div class="client-avatar">${avatar}</div><div><h3>${esc(c.full_name||"Cliente")}</h3><p>${esc(c.email||"")}</p></div></div><div class="client-meta"><div><span>WhatsApp</span><strong>${esc(c.phone||"—")}</strong></div><div><span>Ubicación</span><strong>${esc(c.location||"—")}</strong></div><div><span>Proyectos</span><strong>${projects.length}</strong></div><div><span>Publicados</span><strong>${published}</strong></div></div><div class="row-actions" style="margin-top:12px">${wa?`<a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="tiny-btn" data-client-projects="${c.id}">Ver proyectos</button></div></article>`}).join(""):`<div class="empty">Todavía no hay clientes con cuenta activa.</div>`;
  }

  function renderProjects(){
    const q=$("#project-search")?.value.toLowerCase().trim()||"",stage=$("#project-stage-filter")?.value||"";
    const visible=state.projects.filter(p=>{const c=clientById(p.user_id),lead=prospectById(p.source_prospect_id);return(!stage||p.project_stage===stage)&&`${p.name} ${p.domain} ${c?.full_name||""} ${lead?.nombre||""}`.toLowerCase().includes(q)});
    $("#project-rows").innerHTML=visible.map(p=>{const c=clientById(p.user_id),lead=prospectById(p.source_prospect_id),pageState={hidden:"Oculta",preview:"Vista previa",public:"Publicada"}[p.site_visibility]||"Oculta";return `<tr><td><strong>${esc(p.name)}</strong><span class="sub">${esc(p.domain||"Dirección por definir")}</span></td><td>${c?`${esc(c.full_name||"Cliente")}<span class="sub">${esc(c.email||"")}</span>`:`<span class="badge yellow">${esc(lead?.nombre||"Invitado")}</span>`}</td><td><span class="badge ${statusClass(p.project_stage)}">${esc(p.project_stage||"Configuración")}</span><span class="sub">${esc(p.status||"")}</span></td><td>${pageState}</td><td>${money(p.total_price)}<span class="sub">${p.deposit_paid?"Anticipo ✓":"Anticipo pendiente"}</span></td><td><div class="row-actions"><button class="tiny-btn" data-open-project="${p.id}">Administrar</button>${!p.user_id?`<button class="tiny-btn orange" data-copy-invite="${p.id}">Invitación</button>`:""}</div></td></tr>`}).join("");$("#project-empty").hidden=visible.length>0;
  }

  function renderRequests(){
    const q=$("#request-search")?.value.toLowerCase().trim()||"",filter=$("#request-filter")?.value||"";
    const visible=state.requests.filter(r=>{const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id);return(!filter||r.status===filter)&&`${r.message} ${r.request_type} ${p?.name||""} ${c?.full_name||""}`.toLowerCase().includes(q)});
    $("#request-rows").innerHTML=visible.map(r=>{const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id);return `<tr><td><strong>${esc(p?.name||"Proyecto")}</strong></td><td>${esc(c?.full_name||"Cliente")}</td><td><span class="badge orange">${esc(r.request_type)}</span></td><td class="request-message">${esc(r.message)}</td><td><select class="control request-status" data-request-status="${r.id}"><option${r.status==="Nueva"?" selected":""}>Nueva</option><option${r.status==="En revisión"?" selected":""}>En revisión</option><option${r.status==="En proceso"?" selected":""}>En proceso</option><option${r.status==="Resuelta"?" selected":""}>Resuelta</option><option${r.status==="Cerrada"?" selected":""}>Cerrada</option></select></td><td>${fmtDate(r.created_at)}</td></tr>`}).join("");$("#request-empty").hidden=visible.length>0;
  }

  function fillClientSelect(){const select=$("#project-form [name=user_id]");if(!select)return;const current=select.value;select.innerHTML=`<option value="">Sin cuenta todavía</option>`+state.clients.map(c=>`<option value="${c.id}">${esc(c.full_name||c.email)} · ${esc(c.email||"")}</option>`).join("");select.value=current;}

  function openAgreement(id){const p=prospectById(id);if(!p)return;state.currentProspect=p;const f=$("#agreement-form"),el=f.elements;f.reset();el.prospect_id.value=p.id;el.project_name.value=p.negocio||"Nuevo proyecto";el.total_price.value=750;el.deposit_amount.value=375;el.balance_amount.value=375;el.payment_method.value="Transferencia";el.client_note.value="Tu proyecto ya está preparado. Activa tu cuenta para configurar la dirección de tu página y enviarnos la información del negocio.";setLine("#agreement-status","");$("#agreement-modal").showModal();}
  async function saveAgreement(e){
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f),lead=prospectById(fd.get("prospect_id"));if(!lead)return;
    const total=Number(fd.get("total_price")),deposit=Number(fd.get("deposit_amount")),balance=Number(fd.get("balance_amount"));if(Math.abs(total-(deposit+balance))>0.01){setLine("#agreement-status","El anticipo y el saldo deben sumar el precio total.","error");return;}
    const b=f.querySelector('button[type="submit"]');b.disabled=true;setLine("#agreement-status","Creando proyecto…");
    try{
      const {data,error}=await db.from("client_projects").insert({user_id:null,name:String(fd.get("project_name")||"").trim(),status:"Pendiente de activar cuenta",project_stage:"Invitación",site_visibility:"hidden",address_type:"gratis",hosting_type:"cloudflare",source_prospect_id:String(lead.id),total_price:total,deposit_amount:deposit,balance_amount:balance,payment_method:String(fd.get("payment_method")||"").trim(),accepted_at:new Date().toISOString(),client_note:String(fd.get("client_note")||"").trim()||null}).select().single();if(error)throw error;
      await db.from("prospectos").update({estado:"Ganado",client_project_id:data.id}).eq("id",lead.id);
      state.projects.unshift(data);lead.estado="Ganado";lead.client_project_id=data.id;$("#agreement-modal").close();renderAll();toast("Proyecto e invitación creados.");setView("invited");
    }catch(err){setLine("#agreement-status",err.message||"No pudimos crear el proyecto.","error");b.disabled=false;}
  }

  async function markInviteSent(project){if(!project)return;const now=new Date().toISOString();const {data,error}=await db.from("client_projects").update({invitation_sent_at:now}).eq("id",project.id).select().single();if(!error){Object.assign(project,data);renderInvited();}}
  async function copyInvite(id){const p=projectById(id),url=inviteUrl(p);if(!url){toast("Genera una invitación desde el proyecto.");return;}await navigator.clipboard.writeText(url);await markInviteSent(p);toast("Invitación copiada.");}
  async function sendInvite(id){const p=projectById(id),lead=prospectById(p?.source_prospect_id);if(!p||!lead?.telefono)return;await markInviteSent(p);window.open(`https://wa.me/${waNumber(lead.telefono)}?text=${encodeURIComponent(inviteMessage(p))}`,"_blank","noopener");}

  function setProjectForm(project={}){
    const f=$("#project-form"),el=f.elements;state.currentProject=project.id?project:null;f.reset();el.id.value=project.id||"";el.source_prospect_id.value=project.source_prospect_id||"";el.name.value=project.name||"";fillClientSelect();el.user_id.value=project.user_id||"";el.project_stage.value=project.project_stage||"Invitación";el.status.value=project.status||"Pendiente de activar cuenta";el.address_type.value=project.address_type||"gratis";el.domain.value=project.domain||"";el.hosting_type.value=project.hosting_type||"cloudflare";el.site_visibility.value=project.site_visibility||"hidden";el.site_url.value=project.site_url||"";el.preview_url.value=project.preview_url||"";el.total_price.value=project.total_price??750;el.deposit_amount.value=project.deposit_amount??375;el.balance_amount.value=project.balance_amount??375;el.payment_method.value=project.payment_method||"Transferencia";el.deposit_paid.checked=Boolean(project.deposit_paid);el.balance_paid.checked=Boolean(project.balance_paid);el.client_note.value=project.client_note||"";$("#project-modal-title").textContent=project.id?project.name:"Nuevo proyecto";setLine("#project-form-status","");const inv=inviteUrl(project);$("#project-invite-box").hidden=!project.id||Boolean(project.user_id);$("#project-invite-url").textContent=inv||"Guarda el proyecto para generar una invitación.";$("#update-title").value="";$("#update-status").value="";$("#update-description").value="";
  }

  async function downloadAdminFile(fileId,fileName){try{const r=await fetch(`/api/project-file?id=${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok)throw new Error();const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName||"archivo";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast("No pudimos descargar el archivo.");}}

  async function openProject(id){
    const p=projectById(id);if(!p)return;
    if(!p.user_id&&!p.claim_token){const token=crypto.randomUUID();const {data}=await db.from("client_projects").update({claim_token:token}).eq("id",id).select().single();if(data)Object.assign(p,data);}
    setProjectForm(p);$("#project-setup-admin-content").innerHTML="<span>Cargando…</span>";$("#project-brief-admin-content").innerHTML="<span>Cargando…</span>";$("#project-files-admin").innerHTML="<span>Cargando…</span>";
    const [setupR,briefR,filesR]=await Promise.all([db.from("client_project_setup").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_briefs").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_files").select("*").eq("project_id",id).order("created_at",{ascending:false})]);
    const setup=setupR.data,brief=briefR.data,files=filesR.data||[];
    $("#project-setup-admin-content").innerHTML=setup?[["Dirección",setup.address_type==="dominio"?setup.domain:`${setup.site_name||""}.pages.dev`],["Dominio del cliente",setup.domain_owned?"Sí":"No"],["Primer año dominio",setup.domain_first_year!=null?money(setup.domain_first_year):"—"],["Renovación",setup.domain_renewal!=null?money(setup.domain_renewal):"—"],["Alojamiento",setup.hosting_type==="hostinger"?"Funciones especiales":"Incluido"],["Nota especial",setup.special_features_note||"—"]].map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join(""):`<span>El cliente todavía no ha configurado su página.</span>`;
    $("#project-brief-admin-content").innerHTML=brief?[["Negocio",brief.business_name],["Descripción",brief.business_description],["Productos / servicios",brief.products_services],["Dirección",brief.address_text],["Horario",brief.schedule_text],["WhatsApp público",brief.public_phone],["Google Maps",brief.maps_url],["Facebook",brief.facebook_url],["Instagram",brief.instagram_url],["TikTok",brief.tiktok_url],["Qué quiere mostrar",Array.isArray(brief.content_options)?brief.content_options.join(", "):""],["Estilo",brief.visual_notes],["Referencias",brief.reference_links],["Notas",brief.extra_notes]].filter(([,v])=>v).map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")||"<span>Abrió el formulario, pero todavía no agregó información.</span>":`<span>El cliente todavía no ha enviado información.</span>`;
    $("#project-files-count").textContent=files.length?`${files.length} archivo${files.length===1?"":"s"}`:"";$("#project-files-admin").innerHTML=files.length?files.map(f=>`<div class="admin-file-row"><div><strong>${esc(f.file_name)}</strong><span>${esc(f.category)} · ${fmtDate(f.created_at)}</span></div><button type="button" class="tiny-btn" data-admin-download="${f.id}" data-file-name="${esc(f.file_name)}">Descargar</button></div>`).join(""):`<span>No hay archivos.</span>`;
    $$('[data-admin-download]',$("#project-files-admin")).forEach(b=>b.addEventListener("click",()=>downloadAdminFile(b.dataset.adminDownload,b.dataset.fileName)));
    $("#project-modal").showModal();
  }

  async function saveProject(e){
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get("id")||""),old=projectById(id),userId=String(fd.get("user_id")||"")||null,stage=String(fd.get("project_stage")||"Configuración");
    const payload={user_id:userId,name:String(fd.get("name")||"").trim(),project_stage:stage,status:String(fd.get("status")||"").trim()||stage,address_type:String(fd.get("address_type")||"gratis"),domain:String(fd.get("domain")||"").trim()||null,hosting_type:String(fd.get("hosting_type")||"cloudflare"),site_visibility:String(fd.get("site_visibility")||"hidden"),site_url:String(fd.get("site_url")||"").trim()||null,preview_url:String(fd.get("preview_url")||"").trim()||null,total_price:fd.get("total_price")?Number(fd.get("total_price")):null,deposit_amount:fd.get("deposit_amount")?Number(fd.get("deposit_amount")):null,balance_amount:fd.get("balance_amount")?Number(fd.get("balance_amount")):null,payment_method:String(fd.get("payment_method")||"").trim()||null,deposit_paid:fd.get("deposit_paid")==="on",balance_paid:fd.get("balance_paid")==="on",client_note:String(fd.get("client_note")||"").trim()||null,source_prospect_id:String(fd.get("source_prospect_id")||"")||null,updated_at:new Date().toISOString()};
    if(stage==="Revisión"&&!old?.review_ready_at)payload.review_ready_at=new Date().toISOString();if(stage==="Publicado"&&!old?.published_at)payload.published_at=new Date().toISOString();
    setLine("#project-form-status","Guardando…");const result=id?await db.from("client_projects").update(payload).eq("id",id).select().single():await db.from("client_projects").insert({...payload,accepted_at:new Date().toISOString()}).select().single();
    if(result.error){setLine("#project-form-status",result.error.message||"No pudimos guardar.","error");return;}
    const saved=result.data,idx=state.projects.findIndex(p=>p.id===saved.id);if(idx>=0)state.projects[idx]=saved;else state.projects.unshift(saved);
    if(saved.source_prospect_id)await db.from("prospectos").update({client_user_id:userId,client_project_id:saved.id}).eq("id",saved.source_prospect_id).then(()=>{});
    setProjectForm(saved);renderAll();setLine("#project-form-status","Proyecto guardado.","success");toast("Proyecto actualizado.");
  }

  async function addUpdate(){const p=state.currentProject;if(!p?.id)return;const title=$("#update-title").value.trim();if(!title){toast("Escribe un título para el avance.");return;}const payload={project_id:p.id,user_id:p.user_id||null,title,description:$("#update-description").value.trim()||null,status:$("#update-status").value.trim()||null};const {error}=await db.from("client_updates").insert(payload);if(error){toast(error.message||"No pudimos agregar el avance.");return;}$("#update-title").value="";$("#update-status").value="";$("#update-description").value="";toast("Avance agregado.");}
  async function renewInvite(){const p=state.currentProject;if(!p?.id||p.user_id)return;const token=crypto.randomUUID();const {data,error}=await db.from("client_projects").update({claim_token:token,invitation_sent_at:null}).eq("id",p.id).select().single();if(error){toast("No pudimos generar otra invitación.");return;}Object.assign(p,data);setProjectForm(p);renderInvited();toast("Nueva invitación generada.");}

  async function saveProspect(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get("id")||""),phone=digits(fd.get("telefono"));if(phone.length<10){setLine("#prospect-status","Escribe un WhatsApp válido.","error");return;}const payload={negocio:String(fd.get("negocio")||"").trim(),nombre:String(fd.get("nombre")||"").trim(),municipio:String(fd.get("municipio")||"").trim(),telefono:phone,origen:String(fd.get("origen")||"Otro"),estado:String(fd.get("estado")||"Nuevo"),necesidad:String(fd.get("necesidad")||"").trim()||null,proxima_accion:String(fd.get("proxima_accion")||"")||null,notas:String(fd.get("notas")||"").trim()||null};setLine("#prospect-status","Guardando…");const result=id?await db.from("prospectos").update(payload).eq("id",id).select().single():await db.from("prospectos").insert(payload).select().single();if(result.error){setLine("#prospect-status",result.error.message||"No pudimos guardar.","error");return;}const idx=state.prospects.findIndex(p=>String(p.id)===String(result.data.id));if(idx>=0)state.prospects[idx]=result.data;else state.prospects.unshift(result.data);f.reset();f.elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","Prospecto guardado.","success");renderAll();}
  function editProspect(id){const p=prospectById(id);if(!p)return;const f=$("#prospect-form");["negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas"].forEach(n=>{if(f[n])f[n].value=p[n]||""});f.elements.id.value=p.id;$("#cancel-prospect").hidden=false;f.scrollIntoView({behavior:"smooth",block:"start"});}
  function exportProspects(){if(!state.prospects.length){toast("No hay prospectos para exportar.");return;}const fields=["negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas"],headers=fields.map(x=>x.toUpperCase()),csv=[headers,...state.prospects.map(p=>fields.map(f=>p[f]??""))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`excepcional-build-prospectos-${localDate()}.csv`;a.click();URL.revokeObjectURL(url);}

  $$(".crm-nav [data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $("#refresh-all")?.addEventListener("click",loadAll);$("#crm-logout")?.addEventListener("click",async()=>{await db.auth.signOut();location.reload();});
  $("#crm-login-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type="submit"]');b.disabled=true;setLine("#crm-login-status","Entrando…");const {data,error}=await db.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});if(error){setLine("#crm-login-status","Correo o contraseña incorrectos.","error");b.disabled=false;return;}await showSession(data.session);b.disabled=false;});
  $("#prospect-form")?.addEventListener("submit",saveProspect);$("#cancel-prospect")?.addEventListener("click",()=>{$("#prospect-form").reset();$("#prospect-form").elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","")});$("#export-prospects")?.addEventListener("click",exportProspects);
  $("#agreement-form")?.addEventListener("submit",saveAgreement);$$('[data-close-agreement]').forEach(b=>b.addEventListener("click",()=>$("#agreement-modal").close()));
  $("#project-form")?.addEventListener("submit",saveProject);$$('[data-close-project]').forEach(b=>b.addEventListener("click",()=>$("#project-modal").close()));$("#new-project")?.addEventListener("click",()=>{setProjectForm({project_stage:"Invitación",status:"Pendiente de activar cuenta",site_visibility:"hidden",total_price:750,deposit_amount:375,balance_amount:375,payment_method:"Transferencia"});$("#project-setup-admin-content").innerHTML="<span>Sin configuración.</span>";$("#project-brief-admin-content").innerHTML="<span>Sin información.</span>";$("#project-files-admin").innerHTML="<span>No hay archivos.</span>";$("#project-modal").showModal();});
  $("#copy-project-invite")?.addEventListener("click",()=>state.currentProject&&copyInvite(state.currentProject.id));$("#whatsapp-project-invite")?.addEventListener("click",()=>state.currentProject&&sendInvite(state.currentProject.id));$("#renew-project-invite")?.addEventListener("click",renewInvite);$("#add-project-update")?.addEventListener("click",addUpdate);
  $("#prospect-search")?.addEventListener("input",renderProspects);$("#prospect-filter")?.addEventListener("change",renderProspects);$("#client-search")?.addEventListener("input",renderClients);$("#project-search")?.addEventListener("input",renderProjects);$("#project-stage-filter")?.addEventListener("change",renderProjects);$("#request-search")?.addEventListener("input",renderRequests);$("#request-filter")?.addEventListener("change",renderRequests);
  $("#prospect-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.acceptProspect)openAgreement(t.dataset.acceptProspect);if(t.dataset.editProspect)editProspect(t.dataset.editProspect);if(t.dataset.openProject)openProject(t.dataset.openProject);});
  $("#invited-grid")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.copyInvite)copyInvite(t.dataset.copyInvite);if(t.dataset.sendInvite)sendInvite(t.dataset.sendInvite);if(t.dataset.openProject)openProject(t.dataset.openProject);});
  $("#project-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.openProject)openProject(t.dataset.openProject);if(t.dataset.copyInvite)copyInvite(t.dataset.copyInvite);});
  $("#clients-grid")?.addEventListener("click",e=>{const id=e.target.dataset.clientProjects;if(!id)return;setView("projects");$("#project-search").value=clientById(id)?.full_name||"";renderProjects();});
  $("#request-rows")?.addEventListener("change",async e=>{const id=e.target.dataset.requestStatus;if(!id)return;const {error}=await db.from("client_requests").update({status:e.target.value}).eq("id",id);if(error){toast("No pudimos actualizar la solicitud.");return;}const r=state.requests.find(x=>x.id===id);if(r)r.status=e.target.value;renderDashboard();toast("Solicitud actualizada.");});
  $("#dashboard-next-actions")?.addEventListener("click",e=>{if(e.target.dataset.copyInvite)copyInvite(e.target.dataset.copyInvite);});

  (async()=>{if(!portal.configured){setLine("#crm-login-status","El CRM no está disponible en este momento.","error");return;}const {data:{session}}=await db.auth.getSession();await showSession(session);db.auth.onAuthStateChange((_e,s)=>{if(!s)showSession(null);});})().catch(err=>{console.error(err);setLine("#crm-login-status","No pudimos cargar el CRM.","error");});
})();
