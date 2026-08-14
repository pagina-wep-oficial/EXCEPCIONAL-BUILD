(() => {
  "use strict";

  const portal=window.EBPortal||{};
  const db=portal.client;
  const crmPage=document.body?.dataset.crmPage||"dashboard";
  const WHATSAPP="529811332914";
  const PROD_ORIGIN=(location.protocol.startsWith("http")&&!['localhost','127.0.0.1'].includes(location.hostname))?location.origin:"https://excepcional-build.pages.dev";
  const state={session:null,rol:null,prospects:[],trash:[],clients:[],projects:[],requests:[],users:[],currentProject:null,currentProspect:null,currentClient:null};
  let crmRealtimeChannel=null;
  let crmRefreshTimer=0;
  let crmLiveBusy=false;
  let crmLiveQueued=false;

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
  const isArchivedProject=(project)=>/(cancelado|descontinuado)/i.test(`${project?.project_stage||""} ${project?.status||""}`);
  const archivedKind=(project)=>/descontinuado/i.test(`${project?.project_stage||""} ${project?.status||""}`)?"descontinuado":(/cancelado/i.test(`${project?.project_stage||""} ${project?.status||""}`)?"cancelado":"");
  const editorState=(project)=>{const raw=String(project?.editor_access_status||"").toLowerCase(),ends=project?.editor_access_ends_at||"";const expired=ends&&new Date(ends).getTime()<Date.now();if(project?.editor_enabled&&!expired)return{status:"active",ends};if(/activo|active/.test(raw)&&!expired)return{status:"active",ends};if(expired||/vencido|expired|cancelado|paused|pausado/.test(raw))return{status:"expired",ends};return{status:"none",ends:""};};
  const projectVisibilityLabel=(value)=>({hidden:"Oculta",preview:"Vista previa",public:"Publicada"}[value]||"Oculta");
  const getParam=(name)=>new URLSearchParams(location.search).get(name);
  function crmReturnHref(view="dashboard",clientId=""){
    const params=new URLSearchParams();
    if(view) params.set("view",view);
    if(clientId) params.set("client",clientId);
    const query=params.toString();
    return `crm-local.html${query?`?${query}`:""}`;
  }
  function currentCrmReturnState(){
    if(crmPage==="project-admin"){
      return {view:getParam("from")||"dashboard",clientId:getParam("client")||""};
    }
    const saved=readCrmUiState();
    if(state.currentClient && document.querySelector('[data-view-panel="client-detail"]')?.classList.contains("active")){
      return {view:"client-detail",clientId:state.currentClient};
    }
    return {view:saved.view||localStorage.getItem(CRM_VIEW_KEY)||"dashboard",clientId:saved.clientId||""};
  }
  function projectAdminHref(id,source=currentCrmReturnState()){
    const params=new URLSearchParams({id});
    if(source?.view) params.set("from",source.view);
    if(source?.clientId) params.set("client",source.clientId);
    return `project-admin.html?${params.toString()}`;
  }
  const CRM_VIEW_KEY="eb_crm_view";
  const CRM_UI_KEY="eb_crm_ui";
  const projectTabKey=(id)=>`eb_project_tab_${id||"new"}`;
  let prospectStage="new";

  function readCrmUiState(){
    try{return JSON.parse(localStorage.getItem(CRM_UI_KEY)||"{}")||{};}
    catch{return {};}
  }
  function getSavedCrmUi(role){
    const saved=readCrmUiState();
    const requestedView=getParam("view");
    const requestedClient=getParam("client");
    const fallbackView=localStorage.getItem(CRM_VIEW_KEY)||"dashboard";
    const rawView=requestedView||saved.view||fallbackView||"dashboard";
    const allowed=role==="administrador"
      ?["dashboard","prospects","invited","clients","client-detail","projects","requests","users","trash"]
      :["dashboard","prospects","trash"];
    return {
      view:allowed.includes(rawView)?rawView:"dashboard",
      clientId:requestedClient||saved.clientId||"",
      prospectStage:saved.prospectStage||"new",
      prospectSearch:saved.prospectSearch||"",
      prospectFilter:saved.prospectFilter||"",
      trashSearch:saved.trashSearch||"",
      clientSearch:saved.clientSearch||"",
      projectSearch:saved.projectSearch||"",
      projectStageFilter:saved.projectStageFilter||"",
      requestSearch:saved.requestSearch||"",
      requestFilter:saved.requestFilter||""
    };
  }
  function applyCrmUi(saved){
    if($("#prospect-search"))$("#prospect-search").value=saved.prospectSearch||"";
    if($("#prospect-filter"))$("#prospect-filter").value=saved.prospectFilter||"";
    if($("#trash-search"))$("#trash-search").value=saved.trashSearch||"";
    if($("#client-search"))$("#client-search").value=saved.clientSearch||"";
    if($("#project-search"))$("#project-search").value=saved.projectSearch||"";
    if($("#project-stage-filter"))$("#project-stage-filter").value=saved.projectStageFilter||"";
    if($("#request-search"))$("#request-search").value=saved.requestSearch||"";
    if($("#request-filter"))$("#request-filter").value=saved.requestFilter||"";
    prospectStage=saved.prospectStage||"new";
    setProspectStage(prospectStage,false);
  }
  function rememberCrmUiState(overrides={}){
    if(crmPage==="project-admin")return;
    const activeDetail=document.querySelector('[data-view-panel="client-detail"]')?.classList.contains("active");
    const activeNav=$$(".crm-nav [data-view]").find(b=>b.classList.contains("active"))?.dataset.view||"dashboard";
    const view=overrides.view||(activeDetail&&state.currentClient?"client-detail":activeNav);
    const next={
      view,
      clientId:view==="client-detail"?(overrides.clientId??state.currentClient??""):(overrides.clientId??""),
      prospectStage:overrides.prospectStage??prospectStage,
      prospectSearch:overrides.prospectSearch??($("#prospect-search")?.value||""),
      prospectFilter:overrides.prospectFilter??($("#prospect-filter")?.value||""),
      trashSearch:overrides.trashSearch??($("#trash-search")?.value||""),
      clientSearch:overrides.clientSearch??($("#client-search")?.value||""),
      projectSearch:overrides.projectSearch??($("#project-search")?.value||""),
      projectStageFilter:overrides.projectStageFilter??($("#project-stage-filter")?.value||""),
      requestSearch:overrides.requestSearch??($("#request-search")?.value||""),
      requestFilter:overrides.requestFilter??($("#request-filter")?.value||"")
    };
    try{
      localStorage.setItem(CRM_UI_KEY,JSON.stringify(next));
      if(view!=="client-detail")localStorage.setItem(CRM_VIEW_KEY,view);
    }catch{}
  }

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
  function inviteUrl(project){
    if(!project?.id||!project?.claim_token||project.user_id)return "";
    if(project.invite_code)return `${PROD_ORIGIN}/acceso.html?invite=${encodeURIComponent(project.invite_code)}&token=${encodeURIComponent(project.claim_token)}`;
    return `${PROD_ORIGIN}/acceso.html?claim=${encodeURIComponent(project.id)}&token=${encodeURIComponent(project.claim_token)}`;
  }
  async function ensureInvite(project){
    if(!project?.id||!project?.claim_token||project.user_id)return project;
    if(!project.invite_code){
      const {data,error}=await db.rpc("ensure_project_invite_code",{p_project_id:project.id});
      if(!error&&data)project.invite_code=data;
    }
    return project;
  }
  function inviteMessage(project){const p=prospectById(project.source_prospect_id),name=p?.nombre||"";return `Hola${name?` ${name}`:""}. Tu proyecto con Excepcional Build ya está preparado.\n\nActiva tu cuenta aquí para continuar con la configuración de tu página y enviarnos la información del negocio:\n${inviteUrl(project)}`;}

  function setView(name,persist=true){
    if(crmPage!=="project-admin") localStorage.setItem(CRM_VIEW_KEY,name==="client-detail"?"clients":name);
    $$(".crm-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name||(name==="client-detail"&&b.dataset.view==="clients")));
    $$('[data-view-panel]').forEach(p=>p.classList.toggle("active",p.dataset.viewPanel===name));
    if(persist)rememberCrmUiState({view:name,clientId:name==="client-detail"?(state.currentClient||""):""});
    if(name==="client-detail"){
      $("#view-title").textContent="Cliente";
      $("#view-subtitle").textContent="Vista dedicada para administrar solo a este cliente.";
      return;
    }
    const meta={dashboard:["Resumen","Vista general del negocio."],prospects:["Prospectos","Personas interesadas que todavía no han aceptado."],invited:["Clientes invitados","Aceptaron trabajar contigo y están pendientes de activar su cuenta."],clients:["Clientes","Personas que ya activaron su cuenta."],projects:["Proyectos","Control de producción, pagos y publicación."],requests:["Solicitudes","Cambios y mantenimiento pedidos por clientes."],users:["Usuarios","Cuentas con acceso al CRM y sus permisos."],trash:["Papelera","Prospectos eliminados que puedes restaurar o borrar definitivamente."]}[name]||["CRM",""];
    $("#view-title").textContent=meta[0];$("#view-subtitle").textContent=meta[1];
  }
  function resolveInitialView(role){
    return getSavedCrmUi(role).view;
  }
  async function checkAdmin(){const {data,error}=await db.rpc("mi_rol_crm");if(error)throw error;return data==="administrador"?data:"asesor";}
  async function showSession(session){
    state.session=session;
    if(!session){stopCrmRealtime();$("#crm-login").hidden=false;$("#crm-app").hidden=true;document.body.classList.remove("crm-booting");return;}
    try{
      const rol=await checkAdmin();
      if(!rol){setLine("#crm-login-status","Esta cuenta no tiene acceso al CRM. Si crees que debería tenerlo, pídeselo al administrador.","error");$("#crm-login").hidden=false;$("#crm-app").hidden=true;document.body.classList.remove("crm-booting");return;}
      state.rol=rol;
      startCrmRealtime();
      const esAdmin=rol==="administrador";
      $$(".admin-only").forEach(el=>el.hidden=!esAdmin);
      $("#crm-login").hidden=true;$("#crm-app").hidden=false;if($("#admin-email"))$("#admin-email").textContent=session.user.email||"";if($("#admin-name"))$("#admin-name").textContent=session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"Administrador";if($("#admin-rol"))$("#admin-rol").textContent=esAdmin?"Administrador":"Asesor";
      document.body.classList.remove("crm-booting");
      if(crmPage==="project-admin"){ await loadAll(false); await initProjectAdminPage(); return; }
      const savedUi=getSavedCrmUi(rol);
      setView(savedUi.view,false);
      await loadAll(false);
      applyCrmUi(savedUi);
      renderAll();
      if(state.rol==="administrador")await loadUsers();
      if(savedUi.view==="client-detail"){
        // Nunca restaurar el detalle de cliente al volver/recargar: Chrome puede
        // descartar y recargar la pestaña en segundo plano, y el usuario aparecería
        // dentro del detalle de un cliente sin saber cómo llegó. Se restaura la lista.
        state.currentClient=null;
        setView("clients",false);
        rememberCrmUiState({view:"clients",clientId:""});
      }else{
        rememberCrmUiState({view:savedUi.view,clientId:""});
      }
      return;
    }
    catch(err){setLine("#crm-login-status","No pudimos comprobar tus permisos.","error");$("#crm-login").hidden=false;$("#crm-app").hidden=true;document.body.classList.remove("crm-booting");}
  }
  async function loadAll(render=true){
    const results=await Promise.all([
      db.from("prospectos").select("*").order("creado_en",{ascending:false}),
      db.from("client_profiles").select("*").order("created_at",{ascending:false}),
      db.from("client_projects").select("*").order("created_at",{ascending:false}),
      db.from("client_requests").select("*").order("created_at",{ascending:false})
    ]);
    for(const r of results)if(r.error)throw r.error;
    const all=results[0].data||[];state.prospects=all.filter(p=>!p.borrado_en);state.trash=all.filter(p=>p.borrado_en);state.clients=results[1].data||[];state.projects=results[2].data||[];state.requests=results[3].data||[];
    if(render){renderAll();if(state.rol==="administrador")await loadUsers();}
  }
  function patchCollection(list,row,event,key="id"){
    const oldId=row?.old?.[key];
    const newRow=row?.new||null;
    const newId=newRow?.[key];
    if(event==="DELETE"){
      return list.filter(item=>String(item?.[key])!==String(oldId));
    }
    const next=[...list];
    const idx=next.findIndex(item=>String(item?.[key])===String(newId));
    if(idx>=0) next[idx]=newRow;
    else next.unshift(newRow);
    return next;
  }
  function applyCrmRealtimePatch(table,payload){
    const event=payload?.eventType||payload?.event||"*";
    if(table==="prospectos"){
      const merged=[...state.prospects,...state.trash];
      const patched=patchCollection(merged,payload,event,"id");
      state.prospects=patched.filter(p=>!p?.borrado_en);
      state.trash=patched.filter(p=>p?.borrado_en);
      renderAll();
      return true;
    }
    if(table==="client_profiles"){
      state.clients=patchCollection(state.clients,payload,event,"id");
      renderAll();
      return true;
    }
    if(table==="client_projects"){
      state.projects=patchCollection(state.projects,payload,event,"id");
      if(state.currentProject?.id){
        const fresh=state.projects.find(p=>String(p.id)===String(state.currentProject.id));
        if(fresh) state.currentProject=fresh;
      }
      renderAll();
      if(state.currentClient && document.querySelector('[data-view-panel="client-detail"]')?.classList.contains("active")){
        renderClientDetail();
      }
      return true;
    }
    if(table==="client_requests"){
      state.requests=patchCollection(state.requests,payload,event,"id");
      renderDashboard();
      renderRequests();
      return true;
    }
    return false;
  }
  async function refreshCrmLive(force=false){
    if(!state.session)return;
    if(crmLiveBusy){
      crmLiveQueued=true;
      return;
    }
    crmLiveBusy=true;
    try{
      if(force||crmPage==="project-admin"){
        if(crmPage==="project-admin"){
          await loadAll(false);
          const currentId=state.currentProject?.id||getParam("id");
          if(currentId) await loadProjectDetails(currentId,false);
          else await initProjectAdminPage();
          if(state.rol==="administrador") await loadUsers();
          return;
        }
        await loadAll();
        const projectModal=$("#project-modal");
        if(state.currentProject?.id && projectModal?.open){
          await loadProjectDetails(state.currentProject.id,false);
        }
        if(state.currentClient && document.querySelector('[data-view-panel="client-detail"]')?.classList.contains("active")){
          renderClientDetail();
        }
        return;
      }
      renderAll();
      if(state.currentClient && document.querySelector('[data-view-panel="client-detail"]')?.classList.contains("active")){
        renderClientDetail();
      }
    }finally{
      crmLiveBusy=false;
      if(crmLiveQueued){
        crmLiveQueued=false;
        refreshCrmLive(true).catch(err=>console.error("crm live refresh",err));
      }
    }
  }
  function scheduleCrmRefresh(force=false){
    clearTimeout(crmRefreshTimer);
    crmRefreshTimer=setTimeout(()=>refreshCrmLive(force).catch(err=>console.error("crm live refresh",err)),force?120:90);
  }
  function stopCrmRealtime(){
    clearTimeout(crmRefreshTimer);
    crmLiveBusy=false;
    crmLiveQueued=false;
    if(crmRealtimeChannel){
      db.removeChannel(crmRealtimeChannel);
      crmRealtimeChannel=null;
    }
  }
  function startCrmRealtime(){
    stopCrmRealtime();
    if(!state.session||!db?.channel)return;
    const channel=db.channel(`crm-live-${crmPage}`);
    ["prospectos","client_profiles","client_projects","client_requests"].forEach(table=>{
      channel.on("postgres_changes",{event:"*",schema:"public",table},payload=>{
        const handled=applyCrmRealtimePatch(table,payload);
        if(!handled)scheduleCrmRefresh(true);
      });
    });
    ["client_updates","client_project_setup","client_project_briefs","client_project_files","app_admins"].forEach(table=>{
      channel.on("postgres_changes",{event:"*",schema:"public",table},()=>scheduleCrmRefresh(true));
    });
    crmRealtimeChannel=channel;
    channel.subscribe();
  }
  function renderAll(){renderDashboard();renderProspects();renderTrash();renderInvited();renderClients();renderClientDetail();renderProjects();renderRequests();fillClientSelect();}

  function renderDashboard(){
    const active=state.prospects.filter(p=>{
      const linked=projectForProspect(p.id);
      return !linked && !["Ganado","Descartado"].includes(p.estado);
    });
    $("#metric-prospects").textContent=active.length;$("#metric-invited").textContent=invitedProjects().length;$("#metric-clients").textContent=state.clients.length;$("#metric-projects").textContent=state.projects.filter(p=>/producción|produccion|revisión|revision|información|informacion|configuración|configuracion/i.test(p.project_stage||"")).length;$("#metric-requests").textContent=state.requests.filter(r=>!/resuelta|cerrada/i.test(r.status||"")).length;$("#nav-invited-count").textContent=invitedProjects().length?invitedProjects().length:"";$("#nav-trash-count").textContent=state.trash.length?state.trash.length:"";
    const next=[];
    invitedProjects().slice(0,3).forEach(p=>{const lead=prospectById(p.source_prospect_id);next.push(`<div class="mini-item"><div><strong>${esc(p.name)}</strong><span>${lead?esc(lead.nombre):"Cliente"} · Falta activar cuenta</span></div><button class="tiny-btn orange" data-copy-invite="${p.id}">Invitación</button></div>`);});
    active.filter(p=>p.proxima_accion).sort((a,b)=>String(a.proxima_accion).localeCompare(String(b.proxima_accion))).slice(0,4).forEach(p=>next.push(`<div class="mini-item"><div><strong>${esc(p.negocio)}</strong><span>${esc(p.nombre)} · ${esc(p.proxima_accion)}</span></div><span class="badge ${statusClass(p.estado)}">${esc(p.estado)}</span></div>`));
    $("#dashboard-next-actions").innerHTML=next.length?next.join(""):`<div class="empty">No hay acciones pendientes.</div>`;
    const recent=state.requests.filter(r=>!/cerrada/i.test(r.status||"")).slice(0,6);$("#dashboard-requests").innerHTML=recent.length?recent.map(r=>{const p=projectById(r.project_id);return `<div class="mini-item"><div><strong>${esc(p?.name||"Proyecto")}</strong><span>${esc(r.request_type)} · ${fmtDate(r.created_at)}</span></div><span class="badge ${statusClass(r.status)}">${esc(r.status)}</span></div>`}).join(""):`<div class="empty">No hay solicitudes nuevas.</div>`;
  }

  function renderProspects(){
    const q=$("#prospect-search")?.value.toLowerCase().trim()||"", filter=$("#prospect-filter")?.value||"";
    const visible=state.prospects.filter(p=>{
      const linked=projectForProspect(p.id);
      return !linked && (!filter||p.estado===filter) && `${p.negocio} ${p.nombre} ${p.municipio} ${p.telefono}`.toLowerCase().includes(q);
    });
    const accepted=invitedProjects().filter(p=>{
      const lead=prospectById(p.source_prospect_id);
      return `${p.name||""} ${lead?.nombre||""} ${lead?.negocio||""} ${lead?.municipio||""} ${lead?.telefono||""}`.toLowerCase().includes(q);
    });
    const groupedClients=state.clients.map(client=>{
      const projects=projectsForClient(client.id).filter(p=>`${client.full_name||""} ${client.email||""} ${p.name||""} ${p.domain||""}`.toLowerCase().includes(q));
      return {client,projects};
    }).filter(group=>group.projects.length);
    $("#prospect-rows").innerHTML=visible.map(p=>{
      const wa=`https://wa.me/${waNumber(p.telefono)}?text=${encodeURIComponent(`Hola ${p.nombre||""}, soy de Excepcional Build.`)}`;
      return `<tr><td><strong>${esc(p.negocio)}</strong><span class="sub">${esc(p.municipio||"")}</span></td><td>${esc(p.nombre)}<span class="sub">${esc(p.telefono)}</span></td><td>${esc(p.origen||"—")}</td><td><span class="badge ${statusClass(p.estado)}">${esc(p.estado||"Nuevo")}</span></td><td>${esc(p.proxima_accion||"Sin fecha")}</td><td><div class="row-actions"><a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a><button class="tiny-btn orange" data-accept-prospect="${p.id}">✓ Aceptó</button><button class="tiny-btn" data-edit-prospect="${p.id}">Editar</button><button class="tiny-btn danger" data-trash-prospect="${p.id}">Eliminar</button></div></td></tr>`;
    }).join("");$("#prospect-empty").hidden=visible.length>0;
    $("#accepted-rows").innerHTML=accepted.map(project=>{
      const lead=prospectById(project.source_prospect_id);
      return `<tr><td><strong>${esc(lead?.negocio||project.name)}</strong><span class="sub">${esc(lead?.municipio||"")}</span></td><td>${esc(lead?.nombre||"Cliente")}${lead?.telefono?`<span class="sub">${esc(lead.telefono)}</span>`:""}</td><td><strong>${esc(project.name||"Proyecto")}</strong><span class="sub">${esc(project.domain||"Dirección por definir")}</span></td><td>${fmtDate(project.accepted_at||project.created_at)}</td><td>${project.invitation_sent_at?`Enviada ${fmtDate(project.invitation_sent_at)}`:"Sin enviar"}</td><td><div class="row-actions"><button class="tiny-btn orange" data-copy-invite="${project.id}">Invitación</button><button class="tiny-btn green" data-open-project="${project.id}">Administrar</button></div></td></tr>`;
    }).join("");
    $("#accepted-empty").hidden=accepted.length>0;
    const groups=$("#client-project-groups"), groupsEmpty=$("#client-project-groups-empty");
    if(groups) groups.innerHTML=groupedClients.map(({client,projects})=>{
      const published=projects.filter(p=>p.site_visibility==="public").length;
      const pending=projects.filter(p=>!isArchivedProject(p)&&p.project_stage!=="Publicado"&&p.project_stage!=="Mantenimiento").length;
      return `<details class="client-project-group"><summary><div><strong>${esc(client.full_name||client.email||"Cliente")}</strong><span>${esc(client.email||"")}</span></div><div class="client-project-stats"><b>${projects.length} proyecto${projects.length===1?"":"s"}</b><b>${published} publicados</b><b>${pending} pendientes</b></div></summary><div class="client-project-list">${projects.map(project=>`<div class="client-project-item"><div class="client-project-copy"><strong>${esc(project.name)}</strong><span>${esc(project.project_stage||"Configuración")} · ${esc(project.status||"Sin estado")}</span></div><div class="row-actions"><button class="tiny-btn green" data-open-project="${project.id}">Administrar</button></div></div>`).join("")}</div></details>`;
    }).join("");
    if(groups&&groupedClients.length){
      [...groups.querySelectorAll(".client-project-group")].forEach((groupEl,groupIndex)=>{
        const group=groupedClients[groupIndex];
        if(!group)return;
        [...groupEl.querySelectorAll(".client-project-item .row-actions")].forEach((actionsEl,projectIndex)=>{
          if(!actionsEl||actionsEl.querySelector("[data-open-client]"))return;
          const project=group.projects[projectIndex];
          if(!project)return;
          actionsEl.insertAdjacentHTML("afterbegin",`<button class="tiny-btn" data-open-client="${group.client.id}">Ver cliente</button>`);
        });
      });
    }
    if(groupsEmpty) groupsEmpty.hidden=groupedClients.length>0;
  }

  function renderTrash(){
    const q=$("#trash-search")?.value.toLowerCase().trim()||"";
    const visible=state.trash.filter(p=>`${p.negocio} ${p.nombre} ${p.municipio} ${p.telefono}`.toLowerCase().includes(q));
    $("#trash-rows").innerHTML=visible.map(p=>`<tr><td><strong>${esc(p.negocio)}</strong><span class="sub">${esc(p.municipio||"")}</span></td><td>${esc(p.nombre)}<span class="sub">${esc(p.telefono)}</span></td><td>${esc(p.origen||"—")}</td><td><span class="badge ${statusClass(p.estado)}">${esc(p.estado||"Nuevo")}</span></td><td>${fmtDate(p.borrado_en)}</td><td><div class="row-actions"><button class="tiny-btn green" data-restore-prospect="${p.id}">↩ Restaurar</button><button class="tiny-btn danger" data-delete-prospect-forever="${p.id}">Borrar definitivamente</button></div></td></tr>`).join("");
    $("#trash-empty").hidden=visible.length>0;
    const emptyBtn=$("#empty-trash");if(emptyBtn)emptyBtn.disabled=!state.trash.length;
  }

  async function trashProspect(id){const p=prospectById(id);if(!p)return;if(!confirm(`¿Mover "${p.negocio}" a la papelera?`))return;const {error}=await db.from("prospectos").update({borrado_en:new Date().toISOString()}).eq("id",id);if(error){toast("No pudimos eliminar el prospecto.");return;}state.prospects=state.prospects.filter(x=>String(x.id)!==String(id));state.trash.unshift({...p,borrado_en:new Date().toISOString()});renderAll();toast("Prospecto enviado a la papelera.");}
  async function restoreProspect(id){const p=state.trash.find(x=>String(x.id)===String(id));if(!p)return;const {error}=await db.from("prospectos").update({borrado_en:null}).eq("id",id);if(error){toast("No pudimos restaurar el prospecto.");return;}state.trash=state.trash.filter(x=>String(x.id)!==String(id));state.prospects.unshift({...p,borrado_en:null});renderAll();toast("Prospecto restaurado.");}
  async function deleteProspectForever(id){const p=state.trash.find(x=>String(x.id)===String(id));if(!p)return;if(!confirm(`¿Borrar "${p.negocio}" definitivamente? Esta acción no se puede deshacer.`))return;const {error}=await db.from("prospectos").delete().eq("id",id);if(error){toast("No pudimos borrar el prospecto.");return;}state.trash=state.trash.filter(x=>String(x.id)!==String(id));renderAll();toast("Prospecto borrado permanentemente.");}
  async function emptyTrash(){if(!state.trash.length)return;if(!confirm(`¿Vaciar la papelera? Se borrarán ${state.trash.length} prospectos definitivamente.`))return;const ids=state.trash.map(p=>p.id);const {error}=await db.from("prospectos").delete().in("id",ids);if(error){toast("No pudimos vaciar la papelera.");return;}state.trash=[];renderAll();toast("Papelera vaciada.");}

  async function loadUsers(){const {data,error}=await db.rpc("crm_listar_usuarios");if(error)throw error;state.users=data||[];renderUsers();}
  function renderUsers(){
    const rows=$("#user-rows");if(!rows)return;
    const me=state.session?.user?.email||"";
    const puedoAdmin=state.rol==="administrador";
    rows.innerHTML=state.users.map(u=>{
      const esAdmin=u.rol==="administrador",esAsesor=u.rol==="asesor",esCliente=!esAdmin&&!esAsesor;const esYo=String(u.email).toLowerCase()===String(me).toLowerCase();
      const rolBadge=esAdmin?`<span class="badge orange">Administrador</span>`:esAsesor?`<span class="badge blue">Asesor</span>`:`<span class="badge yellow">Cliente</span>`;
      const estado=esCliente?`<span class="badge">Sin acceso</span>`:`<span class="badge ${u.activo?"green":"red"}">${u.activo?"Activo":"Desactivado"}</span>`;
      const acciones=esYo?`<span class="sub">Tú</span>`:(!puedoAdmin?`<span class="sub">Solo lectura</span>`:(esCliente?`<div class="row-actions"><button class="tiny-btn green" data-grant-user="${esc(u.email)}" data-grant-rol="asesor">Dar acceso como asesor</button><button class="tiny-btn orange" data-grant-user="${esc(u.email)}" data-grant-rol="administrador">Hacer administrador</button></div>`:`<div class="row-actions"><select class="control user-rol-select" data-user-email="${esc(u.email)}" data-user-rol="${esc(u.rol)}" ${u.activo?"":"disabled"}><option value="asesor" ${u.rol==="asesor"?"selected":""}>Asesor</option><option value="administrador" ${u.rol==="administrador"?"selected":""}>Administrador</option></select><button class="tiny-btn ${u.activo?"danger":"green"}" data-toggle-user="${esc(u.email)}">${u.activo?"Desactivar":"Activar"}</button><button class="tiny-btn danger" data-delete-user="${esc(u.email)}">Quitar del CRM</button></div>`));
      return `<tr><td><strong>${esc(u.nombre||u.email)}</strong>${u.nombre?`<span class="sub">${esc(u.email)}</span>`:""}<span class="sub">${esYo?"Cuenta actual":""}</span></td><td>${rolBadge}</td><td>${estado}</td><td>${acciones}</td></tr>`;
    }).join("");
    $("#user-empty").hidden=state.users.length>0;
  }
  async function addUser(e){
    e.preventDefault();
    const email=String($("#user-email").value||"").trim().toLowerCase(),nombre=String($("#user-name").value||"").trim(),rol=$("#user-role").value;
    if(!email||!nombre){setLine("#user-status","Escribe el correo y el nombre de la persona.","error");return;}
    const b=e.currentTarget.querySelector('button[type="submit"]');b.disabled=true;setLine("#user-status","Guardando…");
    try{
      const res=await db.rpc("crm_agregar_usuario",{p_email:email,p_nombre:nombre,p_rol:rol});
      if(res.error)throw res.error;
      if(res.data==="NO_EXISTE"){setLine("#user-status","Ese correo todavía no tiene cuenta. Pídele a la persona que entre una vez con Google al portal para crearla, y después la agregas aquí.","error");return;}
      $("#user-email").value="";$("#user-name").value="";setLine("#user-status","Usuario guardado con permiso "+(rol==="administrador"?"administrador":"asesor")+".","success");
      await loadUsers();
    }catch(err){setLine("#user-status",err.message||"No pudimos guardar el usuario.","error");}
    finally{b.disabled=false;}
  }
  async function changeUserRole(email,rol){
    if(!email||!rol)return;
    const res=await db.rpc("crm_actualizar_usuario",{p_email:email,p_rol:rol,p_activo:true});
    if(res.error){toast(res.error.message||"No pudimos cambiar el permiso.");return;}
    toast("Permiso actualizado.");await loadUsers();
  }
  async function toggleUser(email,activo){
    const current=state.users.find(u=>String(u.email).toLowerCase()===String(email).toLowerCase());
    if(!current)return;
    const res=await db.rpc("crm_actualizar_usuario",{p_email:email,p_rol:current.rol,p_activo:activo});
    if(res.error){toast(res.error.message||"No pudimos cambiar el estado.");return;}
    toast(activo?"Usuario activado.":"Usuario desactivado.");await loadUsers();
  }
  async function removeUser(email){
    if(!confirm(`¿Quitar a ${email} del CRM? Podrá seguir siendo cliente, pero ya no entrará al CRM.`))return;
    const res=await db.rpc("crm_eliminar_usuario",{p_email:email});
    if(res.error){toast(res.error.message||"No pudimos quitar al usuario.");return;}
    toast("Usuario quitado del CRM.");await loadUsers();
  }
  async function grantUser(email,rol){
    const res=await db.rpc("crm_registrar_usuario",{p_email:email,p_rol:rol});
    if(res.error){toast(res.error.message||"No pudimos darle acceso.");return;}
    toast(`Acceso otorgado como ${rol==="administrador"?"administrador":"asesor"}.`);await loadUsers();
  }

  function renderInvited(){
    const invited=invitedProjects();
    $("#invited-grid").innerHTML=invited.length?invited.map(p=>{const lead=prospectById(p.source_prospect_id),url=inviteUrl(p);return `<article class="invite-card"><div class="invite-card-head"><div><span class="badge orange">Pendiente de activar</span><h3>${esc(p.name)}</h3><p>${esc(lead?.nombre||"Cliente sin cuenta")}${lead?.telefono?` · ${esc(lead.telefono)}`:""}</p></div><span class="invite-status-dot"></span></div><div class="invite-meta"><div><span>Precio</span><strong>${money(p.total_price)}</strong></div><div><span>Anticipo</span><strong>${money(p.deposit_amount)}</strong></div><div><span>Aceptó</span><strong>${fmtDate(p.accepted_at||p.created_at)}</strong></div><div><span>Invitación</span><strong>${p.invitation_sent_at?`Enviada ${fmtDate(p.invitation_sent_at)}`:"Sin enviar"}</strong></div></div><div class="invite-link">${p.invite_code?`${esc(p.invite_code)} · enlace copiable`:(url?esc(url):"Guarda para generar invitación")}</div><div class="row-actions"><button class="button light small" data-copy-invite="${p.id}">Copiar acceso</button>${lead?.telefono?`<button class="button accent small" data-send-invite="${p.id}">Enviar por WhatsApp</button>`:""}<button class="button light small" data-open-project="${p.id}">Administrar</button><button class="button danger small" data-cancel-invite="${p.id}">Cancelar invitación</button></div></article>`}).join(""):`<div class="empty panel">No hay clientes esperando activar su cuenta.</div>`;
  }

  function renderClients(){
    const q=$("#client-search")?.value.toLowerCase().trim()||"";const visible=state.clients.filter(c=>`${c.full_name} ${c.email} ${c.phone} ${c.location}`.toLowerCase().includes(q));
    $("#clients-grid").innerHTML=visible.length?visible.map(c=>{const projects=projectsForClient(c.id),published=projects.filter(p=>p.site_visibility==="public").length,avatar=c.avatar_url?`<img src="${esc(c.avatar_url)}" alt="">`:esc((c.full_name||c.email||"EB").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()),wa=c.phone?`https://wa.me/${waNumber(c.phone)}`:"";return `<article class="client-card"><div class="client-card-top"><div class="client-avatar">${avatar}</div><div><h3>${esc(c.full_name||"Cliente")}</h3><p>${esc(c.email||"")}</p></div></div><div class="client-meta"><div><span>WhatsApp</span><strong>${esc(c.phone||"—")}</strong></div><div><span>Ubicación</span><strong>${esc(c.location||"—")}</strong></div><div><span>Proyectos</span><strong>${projects.length}</strong></div><div><span>Publicados</span><strong>${published}</strong></div></div><div class="row-actions" style="margin-top:12px">${wa?`<a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="tiny-btn" data-open-client="${c.id}">Ver cliente</button></div></article>`}).join(""):`<div class="empty">Todavía no hay clientes con cuenta activa.</div>`;
  }

  function renderClientDetail(){
    const client=clientById(state.currentClient);
    const summary=$("#client-detail-summary"),projectsBox=$("#client-detail-projects"),actions=$("#client-detail-actions");
    if(!summary||!projectsBox||!actions)return;
    if(!client){
      $("#client-detail-name").textContent="Cliente";
      $("#client-detail-subtitle").textContent="Aquí ves solo la información y proyectos de este cliente.";
      summary.innerHTML=`<div><span>Estado</span><strong>Selecciona un cliente</strong></div>`;
      projectsBox.innerHTML=`<div class="empty">Abre un cliente desde la pestaña Clientes.</div>`;
      actions.innerHTML="";
      return;
    }
    const projects=projectsForClient(client.id);
    const activeProjects=projects.filter(project=>!isArchivedProject(project));
    const archivedProjects=projects.filter(project=>isArchivedProject(project));
    const published=projects.filter(p=>p.site_visibility==="public").length;
    const active=activeProjects.length;
    const wa=client.phone?`https://wa.me/${waNumber(client.phone)}`:"";
    $("#client-detail-name").textContent=client.full_name||client.email||"Cliente";
    $("#client-detail-subtitle").textContent=client.email||"Cliente activo del portal.";
    summary.innerHTML=[["Correo",client.email||"—"],["WhatsApp",client.phone||"—"],["Ubicación",client.location||"—"],["Proyectos activos",String(active)],["Publicados",String(published)],["Total de proyectos",String(projects.length)]].map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("");
    actions.innerHTML=`${wa?`<a class="button light small" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="button light small" type="button" data-open-clients>Ver todos</button>`;
    projectsBox.innerHTML=(activeProjects.length||archivedProjects.length)?`${activeProjects.length?`<section class="client-detail-section"><div class="client-detail-section-head"><strong>Proyectos activos</strong><span>${activeProjects.length}</span></div>${activeProjects.map(project=>`<article class="client-detail-project"><div><strong>${esc(project.name||"Proyecto")}</strong><span>${esc(project.project_stage||"Configuración")} · ${esc(project.status||"Sin estado")}</span><span>${esc(project.domain||project.site_url||"Dirección por definir")}</span></div><div class="row-actions"><button class="tiny-btn green" data-open-project="${project.id}">Administrar</button></div></article>`).join("")}</section>`:""}${archivedProjects.length?`<section class="client-detail-section archived"><div class="client-detail-section-head"><strong>Historial: cancelados o descontinuados</strong><span>${archivedProjects.length}</span></div>${archivedProjects.map(project=>`<article class="client-detail-project archived"><div><strong>${esc(project.name||"Proyecto")}</strong><span>${esc(project.project_stage||"Cancelado")} · ${esc(project.status||"Sin estado")}</span><span>${esc(project.domain||project.site_url||"Dirección por definir")}</span></div><div class="row-actions"><button class="tiny-btn green" data-open-project="${project.id}">Administrar</button><button class="tiny-btn" data-restore-project="${project.id}">Reactivar</button><button class="tiny-btn danger" data-delete-project="${project.id}">Borrar</button></div></article>`).join("")}</section>`:""}`:`<div class="empty">Este cliente aún no tiene proyectos.</div>`;
  }

  function openClient(id,persist=true){
    if(!clientById(id))return;
    state.currentClient=id;
    renderClientDetail();
    setView("client-detail",persist);
    if(persist)rememberCrmUiState({view:"client-detail",clientId:id});
  }

  function renderProjects(){
    const q=$("#project-search")?.value.toLowerCase().trim()||"",stage=$("#project-stage-filter")?.value||"";
    const visible=state.projects.filter(p=>{const c=clientById(p.user_id),lead=prospectById(p.source_prospect_id);return(!stage||p.project_stage===stage)&&`${p.name} ${p.domain} ${c?.full_name||""} ${lead?.nombre||""}`.toLowerCase().includes(q)});
    $("#project-rows").innerHTML=visible.map(p=>{const c=clientById(p.user_id),lead=prospectById(p.source_prospect_id),pageState={hidden:"Oculta",preview:"Vista previa",public:"Publicada"}[p.site_visibility]||"Oculta";return `<tr><td><strong>${esc(p.name)}</strong><span class="sub">${esc(p.domain||"Dirección por definir")}</span></td><td>${c?`${esc(c.full_name||"Cliente")}<span class="sub">${esc(c.email||"")}</span>`:`<span class="badge yellow">${esc(lead?.nombre||"Invitado")}</span>`}</td><td><span class="badge ${statusClass(p.project_stage)}">${esc(p.project_stage||"Configuración")}</span><span class="sub">${esc(p.status||"")}</span></td><td>${pageState}</td><td>${money(p.total_price)}<span class="sub">${p.deposit_paid?"Anticipo ✓":"Anticipo pendiente"}</span></td><td><div class="row-actions"><button class="tiny-btn" data-open-project="${p.id}">Administrar</button>${!p.user_id?`<button class="tiny-btn orange" data-copy-invite="${p.id}">Invitación</button>`:""}</div></td></tr>`}).join("");$("#project-empty").hidden=visible.length>0;
    const rows=[...($("#project-rows")?.querySelectorAll("tr")||[])];
    rows.forEach((row,index)=>{
      const project=visible[index],actions=row.querySelector(".row-actions");
      if(!project?.user_id||!actions||actions.querySelector("[data-open-client]"))return;
      actions.insertAdjacentHTML("afterbegin",`<button class="tiny-btn" data-open-client="${project.user_id}">Ver cliente</button>`);
    });
  }

  function requestStateMeta(value=""){
    const raw=String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const map={
      nueva:{label:"Nueva",group:"new",tone:"yellow"},
      revisada:{label:"Revisada",group:"new",tone:"yellow"},
      aceptada:{label:"Aceptada",group:"work",tone:"blue"},
      "en proceso":{label:"En proceso",group:"work",tone:"blue"},
      en_proceso:{label:"En proceso",group:"work",tone:"blue"},
      "en revision":{label:"En revisión",group:"work",tone:"orange"},
      "en revisión":{label:"En revisión",group:"work",tone:"orange"},
      en_revision:{label:"En revisión",group:"work",tone:"orange"},
      pospuesta:{label:"Pospuesta",group:"work",tone:"yellow"},
      completada:{label:"Completada",group:"closed",tone:"green"},
      resuelta:{label:"Completada",group:"closed",tone:"green"},
      cerrada:{label:"Completada",group:"closed",tone:"green"},
      rechazada:{label:"Rechazada",group:"closed",tone:"red"},
      archivada:{label:"Archivada",group:"closed",tone:"red"}
    };
    return map[raw]||{label:value||"Nueva",group:"new",tone:"yellow"};
  }
  function requestTypeTitle(value=""){
    return ({
      cambio:"Cambio",
      mantenimiento:"Mantenimiento",
      actualizar:"Actualización",
      dominio:"Dominio",
      hosting:"Funciones especiales",
      mejorar:"Mejora"
    })[String(value||"").toLowerCase()]||value||"Solicitud";
  }
  function requestVisibleTitle(request){
    return String(request?.admin_title||request?.client_title||request?.public_title||"").trim()||requestTypeTitle(request?.request_type);
  }
  function requestVisibleSummary(request){
    return String(request?.admin_summary||request?.message||"").trim()||"Sin detalles.";
  }
  function requestTimelineMeta(request){
    const status=requestNormalizedStatus(request?.status||"Nueva");
    const title=requestVisibleTitle(request);
    const summary=requestVisibleSummary(request);
    if(status==="Aceptada") return {title:`${title} aceptada`,description:`Aceptamos tu solicitud. ${summary}`,status:"Aceptada"};
    if(status==="En proceso") return {title:`${title} en proceso`,description:`Ya estamos trabajando en esta solicitud. ${summary}`,status:"En proceso"};
    if(status==="En revisión") return {title:`${title} en revisión`,description:`Terminamos este cambio y está listo para revisión. ${summary}`,status:"En revisión"};
    if(status==="Completada") return {title:`${title} completada`,description:`Esta solicitud quedó completada. ${summary}`,status:"Completada"};
    if(status==="Pospuesta") return {title:`${title} pospuesta`,description:`Esta solicitud quedó pospuesta por ahora. ${summary}`,status:"Pospuesta"};
    if(status==="Rechazada") return {title:`${title} rechazada`,description:`Esta solicitud no fue aprobada. ${summary}`,status:"Rechazada"};
    return null;
  }
  async function registerRequestUpdate(request){
    const meta=requestTimelineMeta(request);
    if(!meta||!request?.project_id)return;
    const payload={
      project_id:request.project_id,
      user_id:request.user_id||null,
      title:meta.title,
      description:meta.description,
      status:meta.status
    };
    const {error}=await db.from("client_updates").insert(payload);
    if(error) throw error;
  }
  function requestNormalizedStatus(value="Nueva"){
    const label=requestStateMeta(value).label;
    if(label==="Completada") return "Completada";
    if(label==="En revisión") return "En revisión";
    if(label==="En proceso") return "En proceso";
    if(label==="Aceptada") return "Aceptada";
    if(label==="Revisada") return "Revisada";
    if(label==="Pospuesta") return "Pospuesta";
    if(label==="Rechazada") return "Rechazada";
    if(label==="Archivada") return "Archivada";
    return "Nueva";
  }
  function openRequestEditor(id){
    const request=state.requests.find(r=>String(r.id)===String(id));
    if(!request)return;
    const form=$("#request-edit-form");
    form.reset();
    form.elements.id.value=request.id||"";
    form.elements.request_type.value=request.request_type||"cambio";
    form.elements.admin_title.value=requestVisibleTitle(request);
    form.elements.admin_summary.value=String(request?.admin_summary||request?.message||"").trim();
    form.elements.status.value=requestNormalizedStatus(request.status);
    form.elements.message_original.value=String(request?.message||"").trim();
    setLine("#request-edit-status","");
    $("#request-modal").showModal();
  }
  async function saveRequestEditor(e){
    e.preventDefault();
    const form=e.currentTarget,fd=new FormData(form),id=String(fd.get("id")||"");
    const current=state.requests.find(r=>String(r.id)===String(id));
    const previousStatus=requestNormalizedStatus(current?.status||"Nueva");
    const status=requestNormalizedStatus(String(fd.get("status")||"Nueva"));
    const payload={
      request_type:String(fd.get("request_type")||"cambio"),
      admin_title:String(fd.get("admin_title")||"").trim(),
      admin_summary:String(fd.get("admin_summary")||"").trim()||null,
      status,
      updated_at:new Date().toISOString()
    };
    if(status==="Completada") payload.completed_at=new Date().toISOString();
    if(status!=="Completada") payload.completed_at=null;
    setLine("#request-edit-status","Guardando…");
    const {data,error}=await db.from("client_requests").update(payload).eq("id",id).select().single();
    if(error){setLine("#request-edit-status",error.message||"No pudimos guardar la solicitud.","error");return;}
    if(previousStatus!==status){
      try{await registerRequestUpdate(data);}catch(updateError){setLine("#request-edit-status",updateError.message||"La solicitud se guardó, pero no pudimos registrar el avance.","error");}
    }
    const idx=state.requests.findIndex(r=>String(r.id)===String(id));
    if(idx>=0) state.requests[idx]=data;
    renderDashboard();
    renderRequests();
    setLine("#request-edit-status","Solicitud guardada.","success");
    $("#request-modal").close();
    toast("Solicitud actualizada.");
  }
  function renderRequests(){
    const REQUEST_GROUP_VISIBLE_LIMIT=4;
    const q=$("#request-search")?.value.toLowerCase().trim()||"",filter=$("#request-filter")?.value||"";
    const visible=state.requests.filter(r=>{
      const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id),status=requestStateMeta(r.status).label;
      return (!filter||status===filter)&&`${r.message||""} ${r.request_type||""} ${r.admin_title||""} ${r.admin_summary||""} ${p?.name||""} ${c?.full_name||""} ${c?.email||""}`.toLowerCase().includes(q);
    });
    const groups={new:[],work:[],closed:[]};
    const sortByRecent=(a,b)=>{
      const ad=new Date(a.completed_at||a.updated_at||a.created_at||0).getTime();
      const bd=new Date(b.completed_at||b.updated_at||b.created_at||0).getTime();
      return bd-ad;
    };
    visible.forEach(r=>groups[requestStateMeta(r.status).group].push(r));
    groups.new.sort(sortByRecent);
    groups.work.sort(sortByRecent);
    groups.closed.sort(sortByRecent);

    const renderCard=(r)=>{
      const p=projectById(r.project_id),c=clientById(r.user_id||p?.user_id),meta=requestStateMeta(r.status);
      return `<article class="request-card"><div class="request-card-top"><span class="badge ${meta.tone}">${esc(meta.label)}</span><small>${fmtDate(r.completed_at||r.updated_at||r.created_at)}</small></div><strong>${esc(requestVisibleTitle(r))}</strong><div class="request-card-owner"><span><b>Cliente</b>${esc(c?.full_name||"Cliente")}</span><span><b>Proyecto</b>${esc(p?.name||"Proyecto")}</span></div><p class="request-card-message">${esc(requestVisibleSummary(r))}</p><div class="request-card-meta"><b>${esc(requestTypeTitle(r.request_type))}</b><div class="row-actions"><button class="tiny-btn" data-edit-request="${r.id}">Editar</button>${c?.id?`<button class="tiny-btn" data-open-client="${c.id}">Ver cliente</button>`:""}<button class="tiny-btn" data-open-project="${r.project_id}">Abrir proyecto</button></div></div><div class="request-card-actions"><select class="control request-status" data-request-status="${r.id}"><option${requestStateMeta(r.status).label==="Nueva"?" selected":""}>Nueva</option><option${requestStateMeta(r.status).label==="Revisada"?" selected":""}>Revisada</option><option${requestStateMeta(r.status).label==="Aceptada"?" selected":""}>Aceptada</option><option${requestStateMeta(r.status).label==="En proceso"?" selected":""}>En proceso</option><option${requestStateMeta(r.status).label==="En revisión"?" selected":""}>En revisión</option><option${requestStateMeta(r.status).label==="Pospuesta"?" selected":""}>Pospuesta</option><option${requestStateMeta(r.status).label==="Completada"?" selected":""}>Completada</option><option${requestStateMeta(r.status).label==="Rechazada"?" selected":""}>Rechazada</option><option${requestStateMeta(r.status).label==="Archivada"?" selected":""}>Archivada</option></select></div></article>`;
    };

    const groupRequestsByClientProject=(items)=>{
      const map=new Map();
      items.forEach(r=>{
        const p=projectById(r.project_id);
        const c=clientById(r.user_id||p?.user_id);
        const clientId=c?.id||`guest:${p?.id||r.id}`;
        const projectId=p?.id||`project:${r.project_id||r.id}`;
        if(!map.has(clientId)){
          map.set(clientId,{
            client:c||null,
            clientName:c?.full_name||c?.email||"Cliente sin cuenta",
            clientEmail:c?.email||"",
            projects:new Map(),
            recent:new Date(r.completed_at||r.updated_at||r.created_at||0).getTime()
          });
        }
        const clientGroup=map.get(clientId);
        clientGroup.recent=Math.max(clientGroup.recent,new Date(r.completed_at||r.updated_at||r.created_at||0).getTime());
        if(!clientGroup.projects.has(projectId)){
          clientGroup.projects.set(projectId,{
            project:p||null,
            projectName:p?.name||"Proyecto",
            items:[],
            recent:new Date(r.completed_at||r.updated_at||r.created_at||0).getTime()
          });
        }
        const projectGroup=clientGroup.projects.get(projectId);
        projectGroup.items.push(r);
        projectGroup.recent=Math.max(projectGroup.recent,new Date(r.completed_at||r.updated_at||r.created_at||0).getTime());
      });

      return [...map.values()]
        .map(clientGroup=>({
          ...clientGroup,
          projects:[...clientGroup.projects.values()]
            .sort((a,b)=>b.recent-a.recent)
            .map(projectGroup=>({
              ...projectGroup,
              items:projectGroup.items.sort(sortByRecent)
            }))
        }))
        .sort((a,b)=>b.recent-a.recent);
    };

    const renderProjectGroup=(projectGroup,clientGroup,columnKey)=>{
      const visibleItems=projectGroup.items.slice(0,REQUEST_GROUP_VISIBLE_LIMIT);
      const hiddenItems=projectGroup.items.slice(REQUEST_GROUP_VISIBLE_LIMIT);
      const hiddenId=`request-hidden-${columnKey}-${projectGroup.project?.id||Math.random().toString(36).slice(2)}`;
      const toggleId=`request-toggle-${columnKey}-${projectGroup.project?.id||Math.random().toString(36).slice(2)}`;
      return `<section class="request-project-group"><div class="request-project-head"><div><strong>${esc(projectGroup.projectName)}</strong><small>${projectGroup.items.length} solicitud${projectGroup.items.length===1?"":"es"}</small></div><div class="row-actions">${clientGroup.client?.id?`<button class="tiny-btn" data-open-client="${clientGroup.client.id}">Ver cliente</button>`:""}${projectGroup.project?.id?`<button class="tiny-btn" data-open-project="${projectGroup.project.id}">Abrir proyecto</button>`:""}</div></div><div class="request-project-items">${visibleItems.map(renderCard).join("")}</div>${hiddenItems.length?`<div class="request-project-items request-project-items-hidden" id="${hiddenId}" hidden>${hiddenItems.map(renderCard).join("")}</div><button class="tiny-btn request-group-toggle" id="${toggleId}" type="button" data-target="${hiddenId}" data-more="${hiddenItems.length}" data-less="0">Ver ${hiddenItems.length} más</button>`:""}</section>`;
    };

    const renderClientGroup=(clientGroup,columnKey)=>{
      return `<article class="request-client-group"><div class="request-client-group-head"><div><h3>${esc(clientGroup.clientName)}</h3><p>${esc(clientGroup.clientEmail||"Sin correo visible")}</p></div><span>${clientGroup.projects.length} proyecto${clientGroup.projects.length===1?"":"s"}</span></div><div class="request-client-group-body">${clientGroup.projects.map(projectGroup=>renderProjectGroup(projectGroup,clientGroup,columnKey)).join("")}</div></article>`;
    };

    const renderColumn=(items,columnKey,emptyText)=>{
      if(!items.length)return `<div class="empty-inline">${emptyText}</div>`;
      return groupRequestsByClientProject(items).map(clientGroup=>renderClientGroup(clientGroup,columnKey)).join("");
    };

    $("#request-col-new").innerHTML=renderColumn(groups.new,"new","Sin solicitudes nuevas.");
    $("#request-col-work").innerHTML=renderColumn(groups.work,"work","Sin trabajo en curso.");
    $("#request-col-closed").innerHTML=renderColumn(groups.closed,"closed","Sin solicitudes cerradas.");
    $("#request-count-new").textContent=groups.new.length;
    $("#request-count-work").textContent=groups.work.length;
    $("#request-count-closed").textContent=groups.closed.length;
    $("#request-empty").hidden=visible.length>0;
    $("#request-board").hidden=!visible.length;
  }

  function fillClientSelect(){const select=$("#project-form [name=user_id]");if(!select)return;const current=select.value;select.innerHTML=`<option value="">Sin cuenta todavía</option>`+state.clients.map(c=>`<option value="${c.id}">${esc(c.full_name||c.email)} · ${esc(c.email||"")}</option>`).join("");select.value=current;}
  function updateProjectSummary(){
    const form=$("#project-form"); if(!form) return;
    const userId=form.elements.user_id.value;
    const client=clientById(userId);
    $("#project-summary-client").textContent=client?.full_name||client?.email||"Sin asignar";
    $("#project-summary-stage").textContent=form.elements.project_stage.value||"Invitación";
    $("#project-summary-visibility").textContent=projectVisibilityLabel(form.elements.site_visibility.value);
    $("#project-summary-payment").textContent=money(form.elements.total_price.value||0);
  }
  function setProjectTab(name="summary"){
    const projectId=state.currentProject?.id||$("#project-form")?.elements?.id?.value||"new";
    try{ localStorage.setItem(projectTabKey(projectId),name); }catch{}
    $$("[data-project-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.projectTab===name));
    $$("[data-project-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.projectPanel===name));
  }
  function setProspectStage(name="new",persist=true){
    prospectStage=name;
    $$("[data-prospect-stage]").forEach(btn=>btn.classList.toggle("active",btn.dataset.prospectStage===name));
    $$("[data-prospect-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.prospectPanel===name));
    if(persist)rememberCrmUiState({prospectStage:name});
  }
  async function initProjectAdminPage(){
    const id=new URLSearchParams(location.search).get("id");
    if(!id){ setLine("#project-form-status","Falta el proyecto a administrar.","error"); return; }
    const backLink=document.querySelector(".back-link");
    if(backLink){
      const target=currentCrmReturnState();
      backLink.href=crmReturnHref(target.view,target.clientId);
    }
    await loadProjectDetails(id,false);
  }
  function activeStageForRestore(project){
    if(project?.site_visibility==="public") return "Mantenimiento";
    if(project?.preview_url||project?.site_url) return "Revisión";
    return "Configuración";
  }
  function syncProjectState(saved){
    const idx=state.projects.findIndex(p=>p.id===saved.id);
    if(idx>=0) state.projects[idx]=saved;
    else state.projects.unshift(saved);
    state.currentProject=saved;
    try { renderAll(); renderClientDetail(); setProjectForm(saved); } catch(e) { /* Vistas parciales (project-admin standalone) no tienen todos los nodos; el estado ya quedo sincronizado. */ }
  }
  function updateProjectLifecycleUI(project){
    const archived=isArchivedProject(project);
    const kind=archivedKind(project);
    const cancelBtn=$("#archive-project-cancel"), discontinueBtn=$("#archive-project-discontinue"), restoreBtn=$("#restore-project"), deleteBtn=$("#delete-project-permanently"), copy=$("#project-lifecycle-copy"), updateBox=$("#project-update-box");
    if(cancelBtn) cancelBtn.hidden=archived||!project?.id;
    if(discontinueBtn) discontinueBtn.hidden=archived||!project?.id;
    if(restoreBtn) restoreBtn.hidden=!archived||!project?.id;
    if(deleteBtn) deleteBtn.hidden=!archived||!project?.id;
    if(copy) copy.textContent=archived?(kind==="descontinuado"?"Este proyecto quedó descontinuado. Puedes reactivarlo o borrarlo permanentemente.":"Este proyecto quedó cancelado. Puedes reactivarlo o borrarlo permanentemente."):"Si el proyecto ya no sigue, puedes cancelarlo o marcarlo como descontinuado sin perder el historial.";
    if(updateBox) updateBox.hidden=archived;
  }
  function editorAdminError(error){
    const text=String(error?.message||"");
    if(/editor_enabled|editor_access_status|editor_access_starts_at|editor_access_ends_at|editor_plan_months|editor_price_mxn|editor_launch_url|site_repo_owner|site_repo_name|site_repo_branch|site_repo_path|site_live_url|site_publish_provider|site_editor_mode/i.test(text)) return "Falta configurar los campos del editor/repositorio en Supabase. Ejecuta la migración del editor y vuelve a intentar.";
    return error?.message||"No pudimos actualizar el editor.";
  }
  function updateEditorAdminUI(project){
    const badge=$("#project-editor-badge"),status=$("#project-editor-status"),dates=$("#project-editor-dates"),url=$("#project-editor-url"),copy=$("#project-editor-copy");
    if(!badge||!status||!dates||!url||!copy)return;
    const access=editorState(project);
    url.value=project?.editor_launch_url||"";
    const liveUrl=$("#project-site-live-url"),owner=$("#project-site-repo-owner"),repo=$("#project-site-repo-name"),branch=$("#project-site-repo-branch"),path=$("#project-site-repo-path"),provider=$("#project-site-publish-provider"),mode=$("#project-site-editor-mode");
    if(liveUrl)liveUrl.value=project?.site_live_url||project?.site_url||"";
    if(owner)owner.value=project?.site_repo_owner||"";
    if(repo)repo.value=project?.site_repo_name||"";
    if(branch)branch.value=project?.site_repo_branch||"main";
    if(path)path.value=project?.site_repo_path||"/";
    if(provider)provider.value=project?.site_publish_provider||"github_pages";
    if(mode)mode.value=project?.site_editor_mode||"html_repo";
    if(access.status==="active"){
      badge.className="badge green";
      badge.textContent="Activo";
      status.textContent="Editor activo";
      dates.textContent=`Activo hasta ${fmtDate(access.ends)}${project?.editor_plan_months?` · ${project.editor_plan_months} mes${project.editor_plan_months===1?"":"es"}`:""}`;
      copy.textContent="El cliente ya puede entrar a su editor. Si guardas una URL externa, el botón del portal abrirá ese servicio.";
      return;
    }
    if(access.status==="expired"){
      badge.className="badge red";
      badge.textContent="Vencido";
      status.textContent="Acceso vencido";
      dates.textContent=access.ends?`Venció el ${fmtDate(access.ends)}.`:"El acceso del editor ya no está activo.";
      copy.textContent="Puedes renovarlo con un plan nuevo o dejarlo vencido para que el cliente vuelva a ver los planes.";
      return;
    }
    badge.className="badge";
    badge.textContent="No activo";
    status.textContent="Sin acceso activo";
    dates.textContent="Todavía no tiene acceso al editor.";
    copy.textContent="Actívalo por tiempo y decide a qué editor entrará el cliente.";
  }
  async function saveEditorLaunchUrl(){
    const project=state.currentProject,url=String($("#project-editor-url")?.value||"").trim()||null;
    if(!project?.id)return;
    setLine("#project-editor-line","Guardando URL del editor…");
    const {data,error}=await db.from("client_projects").update({editor_launch_url:url,updated_at:new Date().toISOString()}).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState(data);
    setLine("#project-editor-line","URL del editor guardada.","success");
    toast("URL del editor guardada.");
  }
  async function saveEditorRepoConfig(){
    const project=state.currentProject;
    if(!project?.id)return;
    const payload={
      site_live_url:String($("#project-site-live-url")?.value||"").trim()||null,
      site_repo_owner:String($("#project-site-repo-owner")?.value||"").trim()||null,
      site_repo_name:String($("#project-site-repo-name")?.value||"").trim()||null,
      site_repo_branch:String($("#project-site-repo-branch")?.value||"").trim()||"main",
      site_repo_path:String($("#project-site-repo-path")?.value||"").trim()||"/",
      site_publish_provider:String($("#project-site-publish-provider")?.value||"github_pages"),
      site_editor_mode:String($("#project-site-editor-mode")?.value||"html_repo"),
      updated_at:new Date().toISOString()
    };
    setLine("#project-editor-line","Guardando configuración del repo...");
    const {data,error}=await db.from("client_projects").update(payload).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState(data);
    setLine("#project-editor-line","Configuración del repo guardada.","success");
    toast("Repo del sitio guardado.");
  }
  async function activateEditorAccess(months,price){
    const project=state.currentProject;
    if(!project?.id)return;
    const now=new Date();
    const ends=new Date(now);
    ends.setMonth(ends.getMonth()+Number(months));
    setLine("#project-editor-line",`Activando editor por ${months} mes${months===1?"":"es"}…`);
    const payload={editor_enabled:true,editor_access_status:"activo",editor_access_starts_at:now.toISOString(),editor_access_ends_at:ends.toISOString(),editor_plan_months:Number(months),editor_price_mxn:Number(price),updated_at:new Date().toISOString()};
    const {data,error}=await db.from("client_projects").update(payload).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState(data);
    setLine("#project-editor-line",`Editor activado por ${months} mes${months===1?"":"es"}.`,"success");
    toast("Editor activado.");
  }
  async function cancelEditorAccess(){
    const project=state.currentProject;
    if(!project?.id)return;
    if(!confirm(`¿Quitar el acceso al editor de ${project.name||"este proyecto"}?`))return;
    setLine("#project-editor-line","Cancelando acceso al editor…");
    const {data,error}=await db.from("client_projects").update({editor_enabled:false,editor_access_status:"cancelado",updated_at:new Date().toISOString()}).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState(data);
    setLine("#project-editor-line","Acceso del editor cancelado.","success");
    toast("Editor cancelado.");
  }

  function openAgreement(id){const p=prospectById(id);if(!p)return;state.currentProspect=p;const f=$("#agreement-form"),el=f.elements;f.reset();el.prospect_id.value=p.id;el.project_name.value=p.negocio||"Nuevo proyecto";el.total_price.value=750;el.deposit_amount.value=375;el.balance_amount.value=375;el.payment_method.value="Transferencia";el.client_note.value="Tu proyecto ya está preparado. Activa tu cuenta para configurar la dirección de tu página y enviarnos la información del negocio.";setLine("#agreement-status","");$("#agreement-modal").showModal();}
  async function saveAgreement(e){
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f),lead=prospectById(fd.get("prospect_id"));if(!lead)return;
    const total=Number(fd.get("total_price")),deposit=Number(fd.get("deposit_amount")),balance=Number(fd.get("balance_amount"));if(Math.abs(total-(deposit+balance))>0.01){setLine("#agreement-status","El anticipo y el saldo deben sumar el precio total.","error");return;}
    const existing=state.projects.find(p=>!p.user_id&&String(p.source_prospect_id||"")===String(lead.id));
    if(existing&&!confirm(`Este prospecto ya tiene una invitación activa${existing.name?` (${existing.name})`:""}. ¿Crear otra de todas formas?`))return;
    const b=f.querySelector('button[type="submit"]');b.disabled=true;setLine("#agreement-status","Creando proyecto…");
    try{
      const token=crypto.randomUUID();
      const {data,error}=await db.from("client_projects").insert({user_id:null,name:String(fd.get("project_name")||"").trim(),status:"Pendiente de activar cuenta",project_stage:"Invitación",site_visibility:"hidden",address_type:"gratis",hosting_type:"cloudflare",source_prospect_id:String(lead.id),total_price:total,deposit_amount:deposit,balance_amount:balance,payment_method:String(fd.get("payment_method")||"").trim(),accepted_at:new Date().toISOString(),claim_token:token,client_note:String(fd.get("client_note")||"").trim()||null}).select().single();if(error)throw error;
      await ensureInvite(data);
      await db.from("prospectos").update({estado:"Ganado",client_project_id:data.id}).eq("id",lead.id);
      state.projects.unshift(data);lead.estado="Ganado";lead.client_project_id=data.id;$("#agreement-modal").close();renderAll();toast("Proyecto e invitación creados.");setView("invited");
    }catch(err){setLine("#agreement-status",err.message||"No pudimos crear el proyecto.","error");b.disabled=false;}
  }

  async function markInviteSent(project){if(!project)return;const now=new Date().toISOString();const {data,error}=await db.from("client_projects").update({invitation_sent_at:now}).eq("id",project.id).select().single();if(!error){Object.assign(project,data);renderInvited();}}
  async function copyInvite(id){const p=projectById(id);if(!p)return;await ensureInvite(p);const url=inviteUrl(p);if(!url){toast("Genera una invitación desde el proyecto.");return;}await navigator.clipboard.writeText(url);await markInviteSent(p);toast("Invitación copiada.");}
  async function sendInvite(id){const p=projectById(id),lead=prospectById(p?.source_prospect_id);if(!p||!lead?.telefono)return;await ensureInvite(p);await markInviteSent(p);window.open(`https://wa.me/${waNumber(lead.telefono)}?text=${encodeURIComponent(inviteMessage(p))}`,"_blank","noopener");}
  async function cancelInvite(id){
    const p=projectById(id),lead=prospectById(p?.source_prospect_id);
    if(!p||p.user_id)return;
    if(!confirm(`¿Cancelar la invitación de ${p.name||lead?.negocio||"este proyecto"} y regresar el contacto a Prospectos?`))return;
    const cleanup=await Promise.all([
      db.from("client_updates").delete().eq("project_id",id),
      db.from("client_project_setup").delete().eq("project_id",id),
      db.from("client_project_briefs").delete().eq("project_id",id),
      db.from("client_project_files").delete().eq("project_id",id)
    ]);
    const cleanupErr=cleanup.find(r=>r.error)?.error;
    if(cleanupErr){toast(cleanupErr.message||"No pudimos limpiar la invitación.");return;}
    const deleted=await db.from("client_projects").delete().eq("id",id);
    if(deleted.error){toast(deleted.error.message||"No pudimos cancelar la invitación.");return;}
    if(lead){
      const restored=await db.from("prospectos").update({estado:"Interesado",client_project_id:null,client_user_id:null}).eq("id",lead.id).select().single();
      if(restored.error){toast(restored.error.message||"Se canceló la invitación, pero no pudimos regresar el prospecto.");return;}
      const idx=state.prospects.findIndex(x=>String(x.id)===String(lead.id));
      if(idx>=0) state.prospects[idx]=restored.data;
    }
    state.projects=state.projects.filter(x=>x.id!==id);
    if(state.currentProject?.id===id) state.currentProject=null;
    if(crmPage==="project-admin"){ const target=currentCrmReturnState(); location.assign(crmReturnHref(target.view,target.clientId)); return; }
    renderAll();
    toast("Invitación cancelada. El prospecto volvió a Prospectos.");
  }

  function setProjectForm(project={}){
    const f=$("#project-form"),el=f.elements;state.currentProject=project.id?project:null;const savedTab=(project.id?localStorage.getItem(projectTabKey(project.id)):null)||"summary";f.reset();el.id.value=project.id||"";el.source_prospect_id.value=project.source_prospect_id||"";el.name.value=project.name||"";fillClientSelect();el.user_id.value=project.user_id||"";el.project_stage.value=project.project_stage||"Invitación";el.status.value=project.status||"Pendiente de activar cuenta";el.address_type.value=project.address_type||"gratis";el.domain.value=project.domain||"";el.hosting_type.value=project.hosting_type||"cloudflare";el.site_visibility.value=project.site_visibility||"hidden";el.site_url.value=project.site_url||"";el.preview_url.value=project.preview_url||"";el.total_price.value=project.total_price??750;el.deposit_amount.value=project.deposit_amount??375;el.balance_amount.value=project.balance_amount??375;el.payment_method.value=project.payment_method||"Transferencia";el.deposit_paid.checked=Boolean(project.deposit_paid);el.balance_paid.checked=Boolean(project.balance_paid);el.client_note.value=project.client_note||"";$("#project-modal-title").textContent=project.id?project.name:"Nuevo proyecto";setLine("#project-form-status","");setLine("#project-editor-line","");const inv=inviteUrl(project);$("#project-invite-box").hidden=!project.id||Boolean(project.user_id);$("#project-invite-url").textContent=inv||"Guarda el proyecto para generar una invitación.";$("#update-title").value="";$("#update-status").value="";$("#update-description").value="";setProjectTab(savedTab);updateProjectSummary();updateProjectLifecycleUI(project);updateEditorAdminUI(project);
  }

  async function downloadAdminFile(fileId,fileName){try{const r=await fetch(`/api/project-file?id=${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok)throw new Error();const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName||"archivo";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast("No pudimos descargar el archivo.");}}

  async function loadProjectDetails(id,showDialog=true){
    const p=projectById(id);if(!p)return;
    if(!p.user_id&&!p.claim_token){const token=crypto.randomUUID();const {data}=await db.from("client_projects").update({claim_token:token}).eq("id",id).select().single();if(data)Object.assign(p,data);}
    await ensureInvite(p);
    setProjectForm(p);$("#project-setup-admin-content").innerHTML="<span>Cargando…</span>";$("#project-brief-admin-content").innerHTML="<span>Cargando…</span>";$("#project-files-admin").innerHTML="<span>Cargando…</span>";
    const [setupR,briefR,filesR]=await Promise.all([db.from("client_project_setup").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_briefs").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_files").select("*").eq("project_id",id).order("created_at",{ascending:false})]);
    const setup=setupR.data,brief=briefR.data,files=filesR.data||[];
    $("#project-setup-admin-content").innerHTML=setup?[["Dirección",setup.address_type==="dominio"?setup.domain:`${setup.site_name||""}.pages.dev`],["Dominio del cliente",setup.domain_owned?"Sí":"No"],["Primer año dominio",setup.domain_first_year!=null?money(setup.domain_first_year):"—"],["Renovación",setup.domain_renewal!=null?money(setup.domain_renewal):"—"],["Alojamiento",setup.hosting_type==="hostinger"?"Funciones especiales":"Incluido"],["Nota especial",setup.special_features_note||"—"]].map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join(""):`<span>El cliente todavía no ha configurado su página.</span>`;
    $("#project-brief-admin-content").innerHTML=brief?[["Negocio",brief.business_name],["Descripción",brief.business_description],["Productos / servicios",brief.products_services],["Dirección",brief.address_text],["Horario",brief.schedule_text],["WhatsApp público",brief.public_phone],["Google Maps",brief.maps_url],["Facebook",brief.facebook_url],["Instagram",brief.instagram_url],["TikTok",brief.tiktok_url],["Qué quiere mostrar",Array.isArray(brief.content_options)?brief.content_options.join(", "):""],["Estilo",brief.visual_notes],["Referencias",brief.reference_links],["Notas",brief.extra_notes]].filter(([,v])=>v).map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")||"<span>Abrió el formulario, pero todavía no agregó información.</span>":`<span>El cliente todavía no ha enviado información.</span>`;
    $("#project-files-count").textContent=files.length?`${files.length} archivo${files.length===1?"":"s"}`:"";$("#project-files-admin").innerHTML=files.length?files.map(f=>`<div class="admin-file-row"><div><strong>${esc(f.file_name)}</strong><span>${esc(f.category)} · ${fmtDate(f.created_at)}</span></div><button type="button" class="tiny-btn" data-admin-download="${f.id}" data-file-name="${esc(f.file_name)}">Descargar</button></div>`).join(""):`<span>No hay archivos.</span>`;
    $$('[data-admin-download]',$("#project-files-admin")).forEach(b=>b.addEventListener("click",()=>downloadAdminFile(b.dataset.adminDownload,b.dataset.fileName)));
    if(showDialog) $("#project-modal").showModal();
  }
  async function openProject(id){
    if(crmPage==="project-admin"){ await loadProjectDetails(id,false); return; }
    location.assign(projectAdminHref(id,currentCrmReturnState()));
  }

  async function archiveProjectState(mode){
    const project=state.currentProject;
    if(!project?.id)return;
    const label=mode==="cancel"?"cancelado":"descontinuado";
    if(!confirm(`¿Marcar ${project.name||"este proyecto"} como ${label}?`))return;
    setLine("#project-form-status",`Marcando como ${label}…`);
    const payload={project_stage:mode==="cancel"?"Cancelado":"Descontinuado",status:mode==="cancel"?"Proyecto cancelado":"Proyecto descontinuado",updated_at:new Date().toISOString()};
    const {data,error}=await db.from("client_projects").update(payload).eq("id",project.id).select().single();
    if(error){setLine("#project-form-status",error.message||"No pudimos cambiar el estado.","error");return;}
    const idx=state.projects.findIndex(p=>p.id===data.id);if(idx>=0)state.projects[idx]=data;else state.projects.unshift(data);
    setProjectForm(data);renderAll();renderClientDetail();setLine("#project-form-status",`Proyecto ${label}.`,"success");toast(`Proyecto ${label}.`);
  }

  async function restoreArchivedProject(id=state.currentProject?.id){
    const project=projectById(id);
    if(!project?.id||!isArchivedProject(project))return;
    if(!confirm(`¿Reactivar ${project.name||"este proyecto"}?`))return;
    const stage=activeStageForRestore(project);
    setLine("#project-form-status","Reactivando proyecto…");
    const {data,error}=await db.from("client_projects").update({project_stage:stage,status:"Proyecto reactivado",updated_at:new Date().toISOString()}).eq("id",project.id).select().single();
    if(error){setLine("#project-form-status",error.message||"No pudimos reactivar el proyecto.","error");return;}
    const idx=state.projects.findIndex(p=>p.id===data.id);if(idx>=0)state.projects[idx]=data;else state.projects.unshift(data);
    setProjectForm(data);renderAll();renderClientDetail();setLine("#project-form-status","Proyecto reactivado.","success");toast("Proyecto reactivado.");
  }

  async function deleteProjectPermanently(id=state.currentProject?.id){
    const project=projectById(id);
    if(!project?.id||!isArchivedProject(project))return;
    if(!confirm(`¿Borrar permanentemente ${project.name||"este proyecto"}? Esta acción no se puede deshacer.`))return;
    setLine("#project-form-status","Borrando proyecto…");
    const cleanup=await Promise.all([
      db.from("client_updates").delete().eq("project_id",project.id),
      db.from("client_project_setup").delete().eq("project_id",project.id),
      db.from("client_project_briefs").delete().eq("project_id",project.id),
      db.from("client_project_files").delete().eq("project_id",project.id)
    ]);
    const cleanupErr=cleanup.find(r=>r.error)?.error;
    if(cleanupErr){setLine("#project-form-status",cleanupErr.message||"No pudimos limpiar el proyecto.","error");return;}
    if(project.source_prospect_id) await db.from("prospectos").update({client_project_id:null}).eq("id",project.source_prospect_id);
    const removed=await db.from("client_projects").delete().eq("id",project.id);
    if(removed.error){setLine("#project-form-status",removed.error.message||"No pudimos borrar el proyecto.","error");return;}
    state.projects=state.projects.filter(p=>p.id!==project.id);
    if(state.currentProject?.id===project.id) state.currentProject=null;
    renderAll();
    if(crmPage==="project-admin"){ const target=currentCrmReturnState(); location.assign(crmReturnHref(target.view,target.clientId)); return; }
    $("#project-modal")?.close();
    toast("Proyecto borrado permanentemente.");
  }

  async function saveProject(e){
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get("id")||""),old=projectById(id),userId=String(fd.get("user_id")||"")||null,stage=String(fd.get("project_stage")||"Configuración");
    const payload={user_id:userId,name:String(fd.get("name")||"").trim(),project_stage:stage,status:String(fd.get("status")||"").trim()||stage,address_type:String(fd.get("address_type")||"gratis"),domain:String(fd.get("domain")||"").trim()||null,hosting_type:String(fd.get("hosting_type")||"cloudflare"),site_visibility:String(fd.get("site_visibility")||"hidden"),site_url:String(fd.get("site_url")||"").trim()||null,preview_url:String(fd.get("preview_url")||"").trim()||null,total_price:fd.get("total_price")?Number(fd.get("total_price")):null,deposit_amount:fd.get("deposit_amount")?Number(fd.get("deposit_amount")):null,balance_amount:fd.get("balance_amount")?Number(fd.get("balance_amount")):null,payment_method:String(fd.get("payment_method")||"").trim()||null,deposit_paid:fd.get("deposit_paid")==="on",balance_paid:fd.get("balance_paid")==="on",client_note:String(fd.get("client_note")||"").trim()||null,source_prospect_id:String(fd.get("source_prospect_id")||"")||null,updated_at:new Date().toISOString()};
    if(stage==="Revisión"&&!old?.review_ready_at)payload.review_ready_at=new Date().toISOString();if(stage==="Publicado"&&!old?.published_at)payload.published_at=new Date().toISOString();
    setLine("#project-form-status","Guardando…");const result=id?await db.from("client_projects").update(payload).eq("id",id).select().single():(async()=>{const {data,error}=await db.from("client_projects").insert({...payload,claim_token:null,accepted_at:new Date().toISOString()}).select().single();if(!error&&data&&!userId){const {data:updated}=await db.from("client_projects").update({claim_token:crypto.randomUUID()}).eq("id",data.id).select().single();if(updated)Object.assign(data,updated);await ensureInvite(data);}return {data,error};})();
    if(result.error){setLine("#project-form-status",result.error.message||"No pudimos guardar.","error");return;}
    const saved=result.data,idx=state.projects.findIndex(p=>p.id===saved.id);if(idx>=0)state.projects[idx]=saved;else state.projects.unshift(saved);
    if(saved.source_prospect_id)await db.from("prospectos").update({client_user_id:userId,client_project_id:saved.id}).eq("id",saved.source_prospect_id).then(()=>{});
    setProjectForm(saved);if(crmPage!=="project-admin")renderAll();renderClientDetail();setLine("#project-form-status","Proyecto guardado.","success");toast("Proyecto actualizado.");
  }

  async function addUpdate(){const p=state.currentProject;if(!p?.id)return;const title=$("#update-title").value.trim();if(!title){toast("Escribe un título para el avance.");return;}const payload={project_id:p.id,user_id:p.user_id||null,title,description:$("#update-description").value.trim()||null,status:$("#update-status").value.trim()||null};const {error}=await db.from("client_updates").insert(payload);if(error){toast(error.message||"No pudimos agregar el avance.");return;}$("#update-title").value="";$("#update-status").value="";$("#update-description").value="";toast("Avance agregado.");}
  async function renewInvite(){const p=state.currentProject;if(!p?.id||p.user_id)return;const token=crypto.randomUUID();const {data,error}=await db.from("client_projects").update({claim_token:token,invitation_sent_at:null}).eq("id",p.id).select().single();if(error){toast("No pudimos generar otra invitación.");return;}Object.assign(p,data);await ensureInvite(p);setProjectForm(p);renderInvited();toast("Nueva invitación generada.");}

  async function saveProspect(e){e.preventDefault();const f=e.currentTarget,fd=new FormData(f),id=String(fd.get("id")||""),phone=digits(fd.get("telefono"));if(phone.length<10){setLine("#prospect-status","Escribe un WhatsApp válido.","error");return;}const payload={negocio:String(fd.get("negocio")||"").trim(),nombre:String(fd.get("nombre")||"").trim(),municipio:String(fd.get("municipio")||"").trim(),telefono:phone,origen:String(fd.get("origen")||"Otro"),estado:String(fd.get("estado")||"Nuevo"),necesidad:String(fd.get("necesidad")||"").trim()||"Sin especificar",proxima_accion:String(fd.get("proxima_accion")||"")||null,notas:String(fd.get("notas")||"").trim()||""};setLine("#prospect-status","Guardando…");const result=id?await db.from("prospectos").update(payload).eq("id",id).select().single():await db.from("prospectos").insert(payload).select().single();if(result.error){setLine("#prospect-status",result.error.message||"No pudimos guardar.","error");return;}const idx=state.prospects.findIndex(p=>String(p.id)===String(result.data.id));if(idx>=0)state.prospects[idx]=result.data;else state.prospects.unshift(result.data);f.reset();f.elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","Prospecto guardado.","success");renderAll();}
  function editProspect(id){const p=prospectById(id);if(!p)return;const f=$("#prospect-form");["negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas"].forEach(n=>{if(f[n])f[n].value=p[n]||""});f.elements.id.value=p.id;$("#cancel-prospect").hidden=false;f.scrollIntoView({behavior:"smooth",block:"start"});}
  function exportProspects(){if(!state.prospects.length){toast("No hay prospectos para exportar.");return;}const fields=["negocio","nombre","municipio","telefono","origen","estado","necesidad","proxima_accion","notas"],headers=fields.map(x=>x.toUpperCase()),csv=[headers,...state.prospects.map(p=>fields.map(f=>p[f]??""))].map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`excepcional-build-prospectos-${localDate()}.csv`;a.click();URL.revokeObjectURL(url);}

  $$(".crm-nav [data-view]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  $("#refresh-all")?.addEventListener("click",()=>{
    rememberCrmUiState();
    refreshCrmLive(true).catch(err=>console.error("crm manual refresh",err));
  });
  $("#crm-logout")?.addEventListener("click",async()=>{await db.auth.signOut();location.reload();});
  $("#crm-google-login")?.addEventListener("click",async()=>{
    const button=$("#crm-google-login");
    const target=crmPage==="project-admin"?`project-admin.html${location.search}`:"crm-local.html";
    button.disabled=true;
    setLine("#crm-login-status","Abriendo Google…");
    localStorage.setItem(portal.authNextKey,target);
    const redirectTo=`${portal.callbackUrl()}?next=${encodeURIComponent(target)}`;
    const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo,scopes:"openid email profile"}});
    if(error){
      localStorage.removeItem(portal.authNextKey);
      setLine("#crm-login-status","No pudimos abrir Google. Intenta nuevamente.","error");
      button.disabled=false;
    }
  });
  $("#prospect-form")?.addEventListener("submit",saveProspect);$("#cancel-prospect")?.addEventListener("click",()=>{$("#prospect-form").reset();$("#prospect-form").elements.id.value="";$("#cancel-prospect").hidden=true;setLine("#prospect-status","")});$("#export-prospects")?.addEventListener("click",exportProspects);
  $("#agreement-form")?.addEventListener("submit",saveAgreement);$$('[data-close-agreement]').forEach(b=>b.addEventListener("click",()=>$("#agreement-modal").close()));
  $("#request-edit-form")?.addEventListener("submit",saveRequestEditor);$$('[data-close-request]').forEach(b=>b.addEventListener("click",()=>$("#request-modal").close()));
  $("#project-form")?.addEventListener("submit",saveProject);$$('[data-close-project]').forEach(b=>b.addEventListener("click",()=>$("#project-modal").close()));$("#new-project")?.addEventListener("click",()=>{setProjectForm({project_stage:"Invitación",status:"Pendiente de activar cuenta",site_visibility:"hidden",total_price:750,deposit_amount:375,balance_amount:375,payment_method:"Transferencia"});$("#project-setup-admin-content").innerHTML="<span>Sin configuración.</span>";$("#project-brief-admin-content").innerHTML="<span>Sin información.</span>";$("#project-files-admin").innerHTML="<span>No hay archivos.</span>";$("#project-modal").showModal();});
  $("#copy-project-invite")?.addEventListener("click",()=>state.currentProject&&copyInvite(state.currentProject.id));$("#whatsapp-project-invite")?.addEventListener("click",()=>state.currentProject&&sendInvite(state.currentProject.id));$("#renew-project-invite")?.addEventListener("click",renewInvite);$("#cancel-project-invite")?.addEventListener("click",()=>state.currentProject&&cancelInvite(state.currentProject.id));$("#archive-project-cancel")?.addEventListener("click",()=>archiveProjectState("cancel"));$("#archive-project-discontinue")?.addEventListener("click",()=>archiveProjectState("discontinue"));$("#restore-project")?.addEventListener("click",restoreArchivedProject);$("#delete-project-permanently")?.addEventListener("click",()=>deleteProjectPermanently());$("#add-project-update")?.addEventListener("click",addUpdate);
  $$("[data-editor-activate]").forEach(b=>b.addEventListener("click",()=>activateEditorAccess(Number(b.dataset.editorActivate),Number(b.dataset.editorPrice))));
  $("#save-editor-url")?.addEventListener("click",saveEditorLaunchUrl);
  $("#save-editor-repo")?.addEventListener("click",saveEditorRepoConfig);
  $("#cancel-editor-access")?.addEventListener("click",cancelEditorAccess);
  $$("[data-project-tab]").forEach(b=>b.addEventListener("click",()=>setProjectTab(b.dataset.projectTab)));
  $$("[data-prospect-stage]").forEach(b=>b.addEventListener("click",()=>setProspectStage(b.dataset.prospectStage)));
  ["user_id","project_stage","site_visibility","total_price"].forEach(name=>$("#project-form")?.elements?.[name]?.addEventListener("input",updateProjectSummary));
  ["user_id","project_stage","site_visibility"].forEach(name=>$("#project-form")?.elements?.[name]?.addEventListener("change",updateProjectSummary));
  $("#prospect-search")?.addEventListener("input",e=>{rememberCrmUiState({prospectSearch:e.currentTarget.value});renderProspects();});
  $("#prospect-filter")?.addEventListener("change",e=>{rememberCrmUiState({prospectFilter:e.currentTarget.value});renderProspects();});
  $("#trash-search")?.addEventListener("input",e=>{rememberCrmUiState({trashSearch:e.currentTarget.value});renderTrash();});
  $("#empty-trash")?.addEventListener("click",emptyTrash);
  $("#client-search")?.addEventListener("input",e=>{rememberCrmUiState({clientSearch:e.currentTarget.value});renderClients();});
  $("#project-search")?.addEventListener("input",e=>{rememberCrmUiState({projectSearch:e.currentTarget.value});renderProjects();});
  $("#project-stage-filter")?.addEventListener("change",e=>{rememberCrmUiState({projectStageFilter:e.currentTarget.value});renderProjects();});
  $("#request-search")?.addEventListener("input",e=>{rememberCrmUiState({requestSearch:e.currentTarget.value});renderRequests();});
  $("#request-filter")?.addEventListener("change",e=>{rememberCrmUiState({requestFilter:e.currentTarget.value});renderRequests();});
  $("#prospect-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.acceptProspect)openAgreement(t.dataset.acceptProspect);if(t.dataset.editProspect)editProspect(t.dataset.editProspect);if(t.dataset.openProject)openProject(t.dataset.openProject);if(t.dataset.trashProspect)trashProspect(t.dataset.trashProspect);});
  $("#accepted-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.copyInvite)copyInvite(t.dataset.copyInvite);if(t.dataset.openProject)openProject(t.dataset.openProject);});
  $("#client-project-groups")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.openProject)openProject(t.dataset.openProject);if(t.dataset.openClient)openClient(t.dataset.openClient);});
  $("#trash-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.restoreProspect)restoreProspect(t.dataset.restoreProspect);if(t.dataset.deleteProspectForever)deleteProspectForever(t.dataset.deleteProspectForever);});
  $("#invited-grid")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.copyInvite)copyInvite(t.dataset.copyInvite);if(t.dataset.sendInvite)sendInvite(t.dataset.sendInvite);if(t.dataset.openProject)openProject(t.dataset.openProject);if(t.dataset.cancelInvite)cancelInvite(t.dataset.cancelInvite);});
  $("#project-rows")?.addEventListener("click",e=>{const t=e.target;if(t.dataset.openProject)openProject(t.dataset.openProject);if(t.dataset.copyInvite)copyInvite(t.dataset.copyInvite);if(t.dataset.openClient)openClient(t.dataset.openClient);});
  $("#clients-grid")?.addEventListener("click",e=>{const id=e.target.dataset.openClient;if(!id)return;openClient(id);});
  $("#client-detail-projects")?.addEventListener("click",e=>{const t=e.target,id=t.dataset.openProject;if(id)openProject(id);if(t.dataset.restoreProject)restoreArchivedProject(t.dataset.restoreProject);if(t.dataset.deleteProject)deleteProjectPermanently(t.dataset.deleteProject);});
  $("#client-detail-actions")?.addEventListener("click",e=>{if(e.target.dataset.openClients)setView("clients");});
  $("#client-detail-back")?.addEventListener("click",()=>setView("clients"));
  $("#client-detail-new-project")?.addEventListener("click",()=>{const client=clientById(state.currentClient);if(!client)return;setProjectForm({user_id:client.id,project_stage:"Invitación",status:"Pendiente de activar cuenta",site_visibility:"hidden",total_price:750,deposit_amount:375,balance_amount:375,payment_method:"Transferencia"});$("#project-setup-admin-content").innerHTML="<span>Sin configuración.</span>";$("#project-brief-admin-content").innerHTML="<span>Sin información.</span>";$("#project-files-admin").innerHTML="<span>No hay archivos.</span>";$("#project-modal").showModal();});
  $("#request-board")?.addEventListener("click",e=>{
    const t=e.target;
    if(t.dataset.openProject)openProject(t.dataset.openProject);
    if(t.dataset.editRequest)openRequestEditor(t.dataset.editRequest);
    if(t.dataset.openClient)openClient(t.dataset.openClient);
    if(t.dataset.target){
      const box=document.getElementById(t.dataset.target);
      if(!box)return;
      const expanded=t.dataset.less==="1";
      box.hidden=expanded;
      t.dataset.less=expanded?"0":"1";
      t.textContent=expanded?`Ver ${t.dataset.more} más`:"Mostrar menos";
    }
  });
  $("#request-board")?.addEventListener("change",async e=>{const id=e.target.dataset.requestStatus;if(!id)return;const current=state.requests.find(x=>String(x.id)===String(id));const previousStatus=requestNormalizedStatus(current?.status||"Nueva");const status=requestNormalizedStatus(e.target.value);const payload={status,updated_at:new Date().toISOString()};if(status==="Completada")payload.completed_at=new Date().toISOString();if(status!=="Completada")payload.completed_at=null;const {data,error}=await db.from("client_requests").update(payload).eq("id",id).select().single();if(error){toast("No pudimos actualizar la solicitud.");return;}if(previousStatus!==status){try{await registerRequestUpdate(data);}catch(_){toast("La solicitud cambió, pero no pudimos registrar el avance.");}}const r=state.requests.find(x=>String(x.id)===String(id));if(r)Object.assign(r,data);renderDashboard();renderRequests();toast("Solicitud actualizada.");});
  $("#dashboard-next-actions")?.addEventListener("click",e=>{if(e.target.dataset.copyInvite)copyInvite(e.target.dataset.copyInvite);});
  $("#crm-user-form")?.addEventListener("submit",addUser);
  $("#user-rows")?.addEventListener("click",async e=>{const t=e.target;if(t.dataset.toggleUser){const u=state.users.find(x=>String(x.email).toLowerCase()===String(t.dataset.toggleUser).toLowerCase());if(u)await toggleUser(u.email,!u.activo);}if(t.dataset.deleteUser)await removeUser(t.dataset.deleteUser);if(t.dataset.grantUser)await grantUser(t.dataset.grantUser,t.dataset.grantRol);});
  $("#user-rows")?.addEventListener("change",async e=>{const t=e.target;if(t.dataset.userEmail)await changeUserRole(t.dataset.userEmail,t.value);});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshCrmLive().catch(err=>console.error("crm visibility refresh",err));});
  window.addEventListener("pagehide",stopCrmRealtime);

  (async()=>{if(!portal.configured){setLine("#crm-login-status","El CRM no está disponible en este momento.","error");return;}const {data:{session}}=await db.auth.getSession();await showSession(session);db.auth.onAuthStateChange((_e,s)=>{showSession(s||null);});})().catch(err=>{console.error(err);setLine("#crm-login-status","No pudimos cargar el CRM.","error");});
})();
