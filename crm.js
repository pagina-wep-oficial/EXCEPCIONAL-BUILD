(() => {
  "use strict";

  const portal=window.EBPortal||{};
  const db=portal.client;
  const crmPage=document.body?.dataset.crmPage||"dashboard";
  const WHATSAPP="525629767176";
  const PROD_ORIGIN=(location.protocol.startsWith("http")&&!['localhost','127.0.0.1'].includes(location.hostname))?location.origin:"https://excepcional-build.pages.dev";
  const state={session:null,rol:null,permissions:{},prospects:[],trash:[],clients:[],projects:[],requests:[],users:[],settings:[],currentProject:null,currentProspect:null,currentClient:null,hostingPlans:[],currentSetup:null,projectStorageAudit:{},projectStorageBusy:{}};
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
  const fmtDateTime=(v)=>v?new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"—";
  const fmtBytes=(v)=>{const bytes=Number(v||0);if(!Number.isFinite(bytes)||bytes<=0)return"0 B";const units=["B","KB","MB","GB","TB"];let size=bytes,idx=0;while(size>=1024&&idx<units.length-1){size/=1024;idx++;}const digits=size>=100||idx===0?0:(size>=10?1:2);return`${size.toFixed(digits)} ${units[idx]}`;};
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

  const DEFAULT_PERMISSIONS={
    dashboard:true,
    prospects:true,
    invited:false,
    clients:false,
    projects:false,
    project_admin:false,
    editor_any:false,
    storage_cleanup:false,
    requests:false,
    users:false,
    settings:false,
    trash:true
  };

  function defaultPermissionsForRole(role="asesor"){
    return role==="administrador"
      ?{
        dashboard:true,
        prospects:true,
        invited:true,
        clients:true,
        projects:true,
        project_admin:true,
        editor_any:true,
        storage_cleanup:true,
        requests:true,
        users:true,
        settings:true,
        trash:true
      }
      :{...DEFAULT_PERMISSIONS};
  }
  function normalizePermissionsLocal(role="asesor",raw={}){
    const base={...defaultPermissionsForRole(role),...(raw&&typeof raw==="object"?raw:{})};
    if(role!=="administrador") return {...DEFAULT_PERMISSIONS};
    if(!base.projects){
      base.project_admin=false;
      base.editor_any=false;
      base.storage_cleanup=false;
    }else if(!base.project_admin){
      base.editor_any=false;
      base.storage_cleanup=false;
    }
    return base;
  }
  function hasPerm(key){return Boolean(state.permissions?.[key]);}
  function canManageUsers(){return state.rol==="administrador"&&hasPerm("users");}
  function canViewSettings(){return state.rol==="administrador"&&hasPerm("settings");}
  function canProjectAdmin(){return state.rol==="administrador"&&hasPerm("project_admin");}
  function allowedCrmViews(){
    const out=["dashboard"];
    if(hasPerm("prospects")) out.push("prospects");
    if(hasPerm("invited")) out.push("invited");
    if(hasPerm("clients")) out.push("clients","client-detail");
    if(hasPerm("projects")) out.push("projects");
    if(hasPerm("requests")) out.push("requests");
    if(canManageUsers()) out.push("users");
    if(canViewSettings()) out.push("settings");
    if(hasPerm("trash")) out.push("trash");
    return out;
  }
  function applyPermissionUi(){
    const allowed=new Set(allowedCrmViews());
    $$(".crm-nav [data-view]").forEach(btn=>{
      btn.hidden=!allowed.has(btn.dataset.view);
    });
    $$("[data-view-panel]").forEach(panel=>{
      const view=panel.dataset.viewPanel;
      if(view==="dashboard"){panel.hidden=false;return;}
      panel.hidden=!allowed.has(view);
    });
    const showClientProjects=hasPerm("clients")||hasPerm("projects");
    $$('[data-prospect-stage="projects"], [data-prospect-panel="projects"]').forEach(el=>{
      el.hidden=!showClientProjects;
    });
  }

  function readCrmUiState(){
    try{return JSON.parse(localStorage.getItem(CRM_UI_KEY)||"{}")||{};}
    catch{return {};}
  }
  function getSavedCrmUi(){
    const saved=readCrmUiState();
    const requestedView=getParam("view");
    const requestedClient=getParam("client");
    const fallbackView=localStorage.getItem(CRM_VIEW_KEY)||"dashboard";
    const rawView=requestedView||saved.view||fallbackView||"dashboard";
    const allowed=allowedCrmViews();
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
    const meta={dashboard:["Resumen","Vista general del negocio."],prospects:["Prospectos","Personas interesadas que todavía no han aceptado."],invited:["Clientes invitados","Aceptaron trabajar contigo y están pendientes de activar su cuenta."],clients:["Clientes","Personas que ya activaron su cuenta."],projects:["Proyectos","Control de producción, pagos y publicación."],requests:["Solicitudes","Cambios y mantenimiento pedidos por clientes."],users:["Usuarios","Cuentas con acceso al CRM y sus permisos."],settings:["Configuración","Opciones internas de Excepcional Build."],trash:["Papelera","Prospectos eliminados que puedes restaurar o borrar definitivamente."]}[name]||["CRM",""];
    $("#view-title").textContent=meta[0];$("#view-subtitle").textContent=meta[1];
  }
  async function loadCrmProfile(){
    const {data,error}=await db.rpc("crm_mi_perfil");
    if(error) throw error;
    if(!data?.rol) return null;
    return {
      rol:data.rol==="administrador"?"administrador":"asesor",
      permisos:normalizePermissionsLocal(data.rol,data.permisos||{})
    };
  }
async function showSession(session){
    state.session=session;
    if(!session){stopCrmRealtime();$("#crm-login").hidden=false;$("#crm-app").hidden=true;document.body.classList.remove("crm-booting");return;}
    try{
      const profile=await loadCrmProfile();
      if(!profile){
        setLine("#crm-login-status","Esta cuenta no tiene acceso al CRM. Si crees que debería tenerlo, pídeselo al administrador.","error");
        $("#crm-login").hidden=false;
        $("#crm-app").hidden=true;
        document.body.classList.remove("crm-booting");
        return;
      }
      state.rol=profile.rol;
      state.permissions=profile.permisos||normalizePermissionsLocal(profile.rol,{});
      startCrmRealtime();
      applyPermissionUi();
      $("#crm-login").hidden=true;
      $("#crm-app").hidden=false;
      if($("#admin-email"))$("#admin-email").textContent=session.user.email||"";
      if($("#admin-name"))$("#admin-name").textContent=session.user.user_metadata?.full_name||session.user.email?.split("@")[0]||"Administrador";
      if($("#admin-rol"))$("#admin-rol").textContent=state.rol==="administrador"?"Administrador":"Asesor";
      document.body.classList.remove("crm-booting");

      if(crmPage==="project-admin"){
        if(!canProjectAdmin()){
          setLine("#crm-login-status","Esta cuenta no tiene permiso para administrar proyectos.","error");
          $("#crm-login").hidden=false;
          $("#crm-app").hidden=true;
          return;
        }
        await loadAll(false);
        await initProjectAdminPage();
        return;
      }

      const savedUi=getSavedCrmUi();
      setView(savedUi.view,false);
      await loadAll(false);
      applyCrmUi(savedUi);
      renderAll();
      if(canManageUsers())await loadUsers();
      if(savedUi.view==="client-detail"){
        state.currentClient=null;
        setView("clients",false);
        rememberCrmUiState({view:"clients",clientId:""});
      }else{
        rememberCrmUiState({view:savedUi.view,clientId:""});
      }
      return;
    }catch(err){setLine("#crm-login-status","No pudimos comprobar tus permisos.","error");$("#crm-login").hidden=false;$("#crm-app").hidden=true;document.body.classList.remove("crm-booting");}
  }
  async function loadAll(render=true){
    const loadProspects=hasPerm("prospects")||hasPerm("trash");
    const loadClients=hasPerm("clients");
    const loadProjects=hasPerm("projects")||hasPerm("project_admin")||hasPerm("editor_any");
    const loadRequests=hasPerm("requests");

    const prospectsR=loadProspects
      ?await db.from("prospectos").select("*").order("creado_en",{ascending:false})
      :{data:[],error:null};

    const clientsR=loadClients
      ?await db.from("client_profiles").select("*").order("created_at",{ascending:false})
      :{data:[],error:null};

    const projectsR=loadProjects
      ?await db.from("client_projects").select("*").order("created_at",{ascending:false})
      :{data:[],error:null};

    const requestsR=loadRequests
      ?await db.from("client_requests").select("*").order("created_at",{ascending:false})
      :{data:[],error:null};

    for(const r of [prospectsR,clientsR,projectsR,requestsR]) if(r.error) throw r.error;

    const allProspects=prospectsR.data||[];
    state.prospects=hasPerm("prospects")?allProspects.filter(p=>!p.borrado_en):[];
    state.trash=hasPerm("trash")?allProspects.filter(p=>p.borrado_en):[];
    state.clients=clientsR.data||[];
    state.projects=projectsR.data||[];
    state.requests=requestsR.data||[];

    if(canViewSettings()){
      try{
        const r=await db.from("crm_settings").select("*");
        if(!r.error) state.settings=r.data||[];
        else state.settings=[];
      }catch(_){state.settings=[];}
    }else{
      state.settings=[];
    }

    await loadHostingPlans();

    if(render){
      renderAll();
      if(canManageUsers()) await loadUsers();
    }
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
if(canManageUsers()) await loadUsers();
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
  function renderAll(){renderDashboard();renderProspects();renderTrash();renderInvited();renderClients();renderClientDetail();renderProjects();renderRequests();fillClientSelect();renderSettings();updateSettingsBanner();}

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

  async function loadUsers(){const {data,error}=await db.rpc("crm_listar_usuarios");if(error)throw error;state.users=(data||[]).map(u=>({...u,permisos:normalizePermissionsLocal(u.rol,u.permisos||{})}));renderUsers();}
  function renderUsers(){
    const rows=$("#user-rows");if(!rows)return;
    const me=state.session?.user?.email||"";
    const puedoAdmin=canManageUsers();
    rows.innerHTML=state.users.map(u=>{
      const esAdmin=u.rol==="administrador",esAsesor=u.rol==="asesor",esCliente=!esAdmin&&!esAsesor;const esYo=String(u.email).toLowerCase()===String(me).toLowerCase();
      const rolBadge=esAdmin?`<span class="badge orange">Administrador</span>`:esAsesor?`<span class="badge blue">Asesor</span>`:`<span class="badge yellow">Cliente</span>`;
      const estado=esCliente?`<span class="badge">Sin acceso</span>`:`<span class="badge ${u.activo?"green":"red"}">${u.activo?"Activo":"Desactivado"}</span>`;
      const acciones=esYo?`<span class="sub">Tú</span>`:(!puedoAdmin?`<span class="sub">Solo lectura</span>`:(esCliente?`<div class="row-actions"><button class="tiny-btn green" data-grant-user="${esc(u.email)}" data-grant-rol="asesor">Dar acceso como asesor</button><button class="tiny-btn orange" data-grant-user="${esc(u.email)}" data-grant-rol="administrador">Hacer administrador</button></div>`:`<div class="row-actions"><select class="control user-rol-select" data-user-email="${esc(u.email)}" ${u.activo?"":"disabled"}><option value="asesor" ${u.rol==="asesor"?"selected":""}>Asesor</option><option value="administrador" ${u.rol==="administrador"?"selected":""}>Administrador</option></select><button class="tiny-btn" data-open-user-permissions="${esc(u.email)}">Permisos</button><button class="tiny-btn ${u.activo?"danger":"green"}" data-toggle-user="${esc(u.email)}">${u.activo?"Desactivar":"Activar"}</button><button class="tiny-btn danger" data-delete-user="${esc(u.email)}">Quitar del CRM</button></div>`));
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
      const res=await db.rpc("crm_agregar_usuario",{p_email:email,p_nombre:nombre,p_rol:rol,p_permisos:defaultPermissionsForRole(rol)});
      if(res.error)throw res.error;
      if(res.data==="NO_EXISTE"){setLine("#user-status","Ese correo todavía no tiene cuenta. Pídele a la persona que entre una vez con Google al portal para crearla, y después la agregas aquí.","error");return;}
      $("#user-email").value="";$("#user-name").value="";setLine("#user-status","Usuario guardado con permiso "+(rol==="administrador"?"administrador":"asesor")+".","success");
      await loadUsers();
    }catch(err){setLine("#user-status",err.message||"No pudimos guardar el usuario.","error");}
    finally{b.disabled=false;}
  }
  async function changeUserRole(email,rol){
    const current=userByEmail(email);
    if(!current||!rol)return;
    const permisos=normalizePermissionsLocal(rol,current.permisos||defaultPermissionsForRole(rol));
    const res=await db.rpc("crm_actualizar_usuario",{p_email:email,p_rol:rol,p_activo:current.activo,p_permisos:permisos});
    if(res.error){toast(res.error.message||"No pudimos cambiar el permiso.");return;}
    toast("Permiso actualizado.");
    await loadUsers();
  }
  async function toggleUser(email,activo){
    const current=userByEmail(email);
    if(!current)return;
    const res=await db.rpc("crm_actualizar_usuario",{p_email:email,p_rol:current.rol,p_activo:activo,p_permisos:current.permisos||defaultPermissionsForRole(current.rol)});
    if(res.error){toast(res.error.message||"No pudimos cambiar el estado.");return;}
    toast(activo?"Usuario activado.":"Usuario desactivado.");
    await loadUsers();
  }
  async function removeUser(email){
    if(!confirm(`¿Quitar a ${email} del CRM? Podrá seguir siendo cliente, pero ya no entrará al CRM.`))return;
    const res=await db.rpc("crm_eliminar_usuario",{p_email:email});
    if(res.error){toast(res.error.message||"No pudimos quitar al usuario.");return;}
    toast("Usuario quitado del CRM.");await loadUsers();
  }
  async function grantUser(email,rol){
    const res=await db.rpc("crm_registrar_usuario",{p_email:email,p_rol:rol,p_permisos:defaultPermissionsForRole(rol)});
    if(res.error){toast(res.error.message||"No pudimos darle acceso.");return;}
    toast(`Acceso otorgado como ${rol==="administrador"?"administrador":"asesor"}.`);
    await loadUsers();
  }

  function userByEmail(email){
    return state.users.find(u=>String(u.email).toLowerCase()===String(email).toLowerCase())||null;
  }

  function openUserPermissions(email){
    const user=userByEmail(email);
    if(!user)return;
    const form=$("#user-permissions-form");
    const perms=normalizePermissionsLocal(user.rol,user.permisos||{});
    form.elements.email.value=user.email||"";
    form.elements.rol.value=user.rol||"asesor";
    form.elements.activo.value=user.activo?"1":"0";
    form.elements.perm_dashboard.checked=!!perms.dashboard;
    form.elements.perm_prospects.checked=!!perms.prospects;
    form.elements.perm_invited.checked=!!perms.invited;
    form.elements.perm_clients.checked=!!perms.clients;
    form.elements.perm_projects.checked=!!perms.projects;
    form.elements.perm_project_admin.checked=!!perms.project_admin;
    form.elements.perm_editor_any.checked=!!perms.editor_any;
    form.elements.perm_storage_cleanup.checked=!!perms.storage_cleanup;
    form.elements.perm_requests.checked=!!perms.requests;
    form.elements.perm_users.checked=!!perms.users;
    form.elements.perm_settings.checked=!!perms.settings;
    form.elements.perm_trash.checked=!!perms.trash;
    setLine("#user-permissions-status","");
    $("#user-permissions-modal").showModal();
  }

  function readUserPermissionsForm(){
    const f=$("#user-permissions-form");
    return normalizePermissionsLocal(f.elements.rol.value,{
      dashboard:f.elements.perm_dashboard.checked,
      prospects:f.elements.perm_prospects.checked,
      invited:f.elements.perm_invited.checked,
      clients:f.elements.perm_clients.checked,
      projects:f.elements.perm_projects.checked,
      project_admin:f.elements.perm_project_admin.checked,
      editor_any:f.elements.perm_editor_any.checked,
      storage_cleanup:f.elements.perm_storage_cleanup.checked,
      requests:f.elements.perm_requests.checked,
      users:f.elements.perm_users.checked,
      settings:f.elements.perm_settings.checked,
      trash:f.elements.perm_trash.checked
    });
  }

  async function saveUserPermissions(e){
    e.preventDefault();
    const f=e.currentTarget;
    const email=f.elements.email.value;
    const rol=f.elements.rol.value;
    const activo=f.elements.activo.value==="1";
    const permisos=readUserPermissionsForm();
    const btn=f.querySelector('button[type="submit"]');
    btn.disabled=true;
    setLine("#user-permissions-status","Guardando…");
    try{
      const res=await db.rpc("crm_actualizar_usuario",{p_email:email,p_rol:rol,p_activo:activo,p_permisos:permisos});
      if(res.error) throw res.error;
      setLine("#user-permissions-status","Permisos guardados.","success");
      $("#user-permissions-modal").close();
      await loadUsers();
    }catch(err){
      setLine("#user-permissions-status",err.message||"No pudimos guardar los permisos.","error");
    }finally{
      btn.disabled=false;
    }
  }

  function settingsRow(){return (state.settings||[]).find(s=>s.key==="supabase_access_token")||null;}
  function tokenExpiry(row){
    const saved=row?.updated_at?new Date(row.updated_at).getTime():Date.now();
    const expires=saved+30*86400000;
    return {saved,expires,remaining:Math.ceil((expires-Date.now())/86400000)};
  }
  function renderSettings(){
    const box=$("#settings-token-status");
    if(!box||!canViewSettings())return;
    const row=settingsRow();
    if(!row||!row.value){
      box.innerHTML=`<div class="empty" style="text-align:left;padding:12px">No hay token guardado todavía. Genera uno en <strong>supabase.com → Account → Access tokens</strong> y pégalo abajo.</div>`;
      return;
    }
    const info=tokenExpiry(row);
    const masked=`sbp_…${String(row.value).slice(-6)}`;
    let level="green",label="",short="";
    if(info.remaining<=0){level="red";label="Token EXPIRADO";short="EXPIRADO";}
    else if(info.remaining===0){level="red";label="Token expira HOY";short="HOY";}
    else if(info.remaining===1){level="orange";label="Token expira mañana";short="1 día";}
    else if(info.remaining<=3){level="yellow";label=`Token expira en ${info.remaining} días`;short=`${info.remaining} días`;}
    else{label=`Token válido · ${info.remaining} días`;short=`${info.remaining} días`;}
    box.innerHTML=`<div class="mini-item"><div><strong>${label}</strong><span class="sub">Guardado: ${fmtDate(new Date(info.saved).toISOString())}</span><span class="sub">Caduca: ${fmtDate(new Date(info.expires).toISOString())}</span><span class="sub">Token actual: ${esc(masked)} <small>(solo el final se muestra)</small></span></div><span class="badge ${level}">${short}</span></div>`;
  }
  function updateSettingsBanner(){
    const banner=$("#dashboard-token-banner");
    if(!banner)return;
    if(!canViewSettings()){banner.hidden=true;return;}
    const row=settingsRow(),info=row?.value?tokenExpiry(row):null;
    const txt=$("#dashboard-token-banner-text");
    if(!info||info.remaining>3){banner.hidden=true;return;}
    const label=info.remaining<=0?"El token de Supabase EXPIRÓ. Cambia el token en Configuración.":info.remaining===0?"El token de Supabase expira HOY. Cambia el token en Configuración.":info.remaining===1?"El token de Supabase expira mañana. Configúralo hoy en Configuración.":`El token de Supabase expira en ${info.remaining} días. Actualízalo en Configuración.`;
    txt.textContent=label;
    banner.className="token-banner "+(info.remaining<=1?"red":"yellow");
    banner.hidden=false;
  }
  async function saveSettingsToken(e){
    e.preventDefault();
    const input=$("#settings-token-input"),raw=String(input.value||"").trim();
    if(raw.length<20){setLine("#settings-token-status-line","Ese valor no parece un token de Supabase (empieza con sbp_).","error");return;}
    const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;
    setLine("#settings-token-status-line","Guardando…");
    try{
      const {data,error}=await db.from("crm_settings").upsert({key:"supabase_access_token",value:raw,updated_at:new Date().toISOString()},{onConflict:"key"}).select().single();
      if(error)throw error;
      const now=new Date().toISOString();
      const existing=settingsRow();
      if(existing){existing.value=raw;existing.updated_at=now;}
      else state.settings=(state.settings||[]).concat([{key:"supabase_access_token",value:raw,updated_at:now}]);
      if(data)Object.assign(data instanceof Object?data:{},data||{});
      input.value="";$("#settings-token-show").checked=false;input.type="password";
      renderSettings();updateSettingsBanner();
      setLine("#settings-token-status-line","Token guardado. Caducará 30 días después de hoy.","success");
    }catch(err){setLine("#settings-token-status-line",err.message||"No pudimos guardar el token.","error");}
    finally{btn.disabled=false;}
  }
  async function verifySettingsToken(){
    const row=settingsRow();
    if(!row?.value){setLine("#settings-token-status-line","Primero guarda un token para poder comprobarlo.","error");return;}
    const btn=$("#settings-token-verify");btn.disabled=true;
    setLine("#settings-token-status-line","Comprobando validez…");
    try{
      const r=await fetch("/api/verificar-sb-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:row.value})});
      const data=await r.json().catch(()=>({}));
      if(data?.ok)setLine("#settings-token-status-line",`Token válido ✓ (acceso a ${data.count??0} proyecto${(data.count??0)===1?"":"s"}).`,"success");
      else if(data?.error==="expirado")setLine("#settings-token-status-line","El token expiró (401). Genera uno nuevo en supabase.com y cámbialo aquí.","error");
      else if(data?.error==="invalido")setLine("#settings-token-status-line","Supabase rechazó el token. Verifícalo y vuelve a guardarlo.","error");
      else setLine("#settings-token-status-line","No pudimos comprobar la validez ahora. Reintenta en unos minutos.","error");
    }catch(_){setLine("#settings-token-status-line","No pudimos comprobar la validez ahora. Revisa tu conexión.","error");}
    finally{btn.disabled=false;}
  }
  async function loadSettings(){
    try{
      const r=await db.from("crm_settings").select("*");
      if(r&&!r.error)state.settings=r.data||[];
    }catch(_){state.settings=state.settings||[];}
    renderSettings();updateSettingsBanner();
    loadGithubQuota();
  }
  async function loadGithubQuota(){
    const box=$("#settings-github-quota");
    if(!box||!canViewSettings())return;
    box.innerHTML=`<div class="empty" style="text-align:left;padding:12px">Consultando el tanque de GitHub…</div>`;
    try{
      const r=await fetch("/api/repo-quota");
      const data=await r.json().catch(()=>null);
      if(!data){box.innerHTML=`<div class="empty" style="text-align:left;padding:12px">No pudimos consultar el estado.</div>`;return;}
      if(!data.token_configured){box.innerHTML=`<div class="empty" style="text-align:left;padding:12px">No hay GITHUB_TOKEN configurado en Cloudflare Pages. Sin él no se puede publicar ni leer repos.</div>`;return;}
      if(!data.token_valid){
        box.innerHTML=`<div class="mini-item"><div><strong>Token de GitHub EXPIRADO o inválido</strong><span class="sub">Genera uno nuevo en github.com → Settings → Developer settings → Tokens y actualízalo en las variables de Cloudflare Pages.</span></div><span class="badge red">EXPIRADO</span></div>`;
        return;
      }
      const remaining=Number(data.remaining||0),limit=Number(data.limit||5000);
      const pct=limit>0?Math.round((remaining/limit)*100):0;
      let level="green",short="Sano";
      if(pct<=10){level="red";short="Crítico";}
      else if(pct<=30){level="yellow";short="Bajo";}
      const reset=data.reset_in_minutes!=null?`Se liberan más peticiones en ${data.reset_in_minutes} min.`:"";
      box.innerHTML=`<div class="mini-item"><div><strong>${esc(String(remaining))} de ${esc(String(limit))} peticiones disponibles (${pct}%)</strong><span class="sub">Usadas esta hora: ${esc(String(data.used??0))}</span><span class="sub">${esc(reset)}</span><span class="sub">El token está vivo y con acceso ✓</span></div><span class="badge ${level}">${short}</span></div>`;
    }catch(_){
      box.innerHTML=`<div class="empty" style="text-align:left;padding:12px">No pudimos consultar el estado. Revisa tu conexión.</div>`;
    }
  }

  function renderInvited(){
    const invited=invitedProjects();
    $("#invited-grid").innerHTML=invited.length?invited.map(p=>{const lead=prospectById(p.source_prospect_id),url=inviteUrl(p);return `<article class="invite-card"><div class="invite-card-head"><div><span class="badge orange">Pendiente de activar</span><h3>${esc(p.name)}</h3><p>${esc(lead?.nombre||"Cliente sin cuenta")}${lead?.telefono?` · ${esc(lead.telefono)}`:""}</p></div><span class="invite-status-dot"></span></div><div class="invite-meta"><div><span>Precio</span><strong>${money(p.total_price)}</strong></div><div><span>Anticipo</span><strong>${money(p.deposit_amount)}</strong></div><div><span>Aceptó</span><strong>${fmtDate(p.accepted_at||p.created_at)}</strong></div><div><span>Invitación</span><strong>${p.invitation_sent_at?`Enviada ${fmtDate(p.invitation_sent_at)}`:"Sin enviar"}</strong></div></div><div class="invite-link">${p.invite_code?`${esc(p.invite_code)} · enlace copiable`:(url?esc(url):"Guarda para generar invitación")}</div><div class="row-actions"><button class="button light small" data-copy-invite="${p.id}">Copiar acceso</button>${lead?.telefono?`<button class="button accent small" data-send-invite="${p.id}">Enviar por WhatsApp</button>`:""}<button class="button light small" data-open-project="${p.id}">Administrar</button><button class="button danger small" data-cancel-invite="${p.id}">Cancelar invitación</button></div></article>`}).join(""):`<div class="empty panel">No hay clientes esperando activar su cuenta.</div>`;
  }

  function renderClients(){
    const q=$("#client-search")?.value.toLowerCase().trim()||"";const visible=state.clients.filter(c=>`${c.full_name} ${c.email} ${c.phone} ${c.location}`.toLowerCase().includes(q));
    $("#clients-grid").innerHTML=visible.length?visible.map(c=>{const projects=projectsForClient(c.id),published=projects.filter(p=>p.site_visibility==="public").length,avatar=c.avatar_url?`<img src="${esc(c.avatar_url)}" alt="">`:esc((c.full_name||c.email||"EB").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()),wa=c.phone?`https://wa.me/${waNumber(c.phone)}`:"";return `<article class="client-card"><div class="client-card-top"><div class="client-avatar">${avatar}</div><div><h3>${esc(c.full_name||"Cliente")}</h3><p>${esc(c.email||"")}</p></div><div class="client-card-menu"><button class="card-menu-btn" type="button" data-client-menu-btn="${esc(c.id)}" aria-label="Opciones del cliente" aria-expanded="false">⋮</button><div class="card-menu-pop" hidden><button type="button" class="card-menu-item danger" data-delete-client="${esc(c.id)}">Eliminar cliente…</button></div></div></div><div class="client-meta"><div><span>WhatsApp</span><strong>${esc(c.phone||"—")}</strong></div><div><span>Ubicación</span><strong>${esc(c.location||"—")}</strong></div><div><span>Proyectos</span><strong>${projects.length}</strong></div><div><span>Publicados</span><strong>${published}</strong></div></div><div class="row-actions" style="margin-top:12px">${wa?`<a class="link-btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<button class="tiny-btn" data-open-client="${c.id}">Ver cliente</button></div></article>`}).join(""):`<div class="empty">Todavía no hay clientes con cuenta activa.</div>`;
  }

  async function deleteClient(id){
    const c=clientById(id);
    if(!c)return;
    const projects=projectsForClient(id);
    const aviso=projects.length?`\n\nBORRARÁ también ${projects.length} proyecto(s) con sus páginas, archivos y fotos.`:"";
    if(!confirm(`¿Eliminar este cliente por completo?\n\n${esc(c.full_name||c.email||"Cliente")}\n${esc(c.email||"")}${aviso}\n\nSu cuenta de Google seguirá existiendo: si vuelve a entrar, empezará de nuevo como cliente nuevo. Esta acción no se puede deshacer.`))return;
    if(!confirm("¿Confirmas la eliminación definitiva de este cliente y todos sus datos?"))return;
    const res=await db.rpc("crm_eliminar_cliente",{p_email:c.email});
    if(res.error){toast(res.error.message||"No pudimos eliminar al cliente.");return;}
    let out=null;
    try{out=res.data?JSON.parse(res.data):null;}catch(_){out=null;}
    if(!out||out.result!=="OK"){toast("No pudimos eliminar al cliente.");return;}
    if(Array.isArray(out.paths)&&out.paths.length){
      try{
        const {error}=await db.storage.from("site-images").remove(out.paths);
        if(error)throw error;
      }catch(_){toast("Cliente eliminado, pero no pudimos borrar algunas fotos.");}
    }
    toast("Cliente eliminado por completo.");await loadAll();
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
      actualizar:"Actualizacion",
      dominio:"Dominio",
      hosting:"Mejora de alojamiento",
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
  const STORAGE_BUCKET="site-images";

  function storagePublicPrefix(){
    const base=String(window.EB_SUPABASE_CONFIG?.url||"").replace(/\/+$/,"");
    return base?`${base}/storage/v1/object/public/${STORAGE_BUCKET}/`:"";
  }

  function escapeRegExp(value=""){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  }

  function storagePublicPathFromString(raw){
    const value=String(raw||"").trim();
    if(!value)return"";
    const prefix=storagePublicPrefix();
    const normalized=value.startsWith("//")?`https:${value}`:value;
    try{
      const url=new URL(normalized,location.origin);
      const marker=`/storage/v1/object/public/${STORAGE_BUCKET}/`;
      const idx=url.pathname.indexOf(marker);
      if(idx<0)return"";
      return decodeURIComponent(url.pathname.slice(idx+marker.length)).replace(/^\/+/,"");
    }catch{
      if(prefix&&value.startsWith(prefix)){
        return decodeURIComponent(value.slice(prefix.length)).split(/[?#]/)[0].replace(/^\/+/,"");
      }
      return"";
    }
  }

  function collectStorageRefsFromValue(value,refs=new Map()){
    const prefix=storagePublicPrefix();
    if(!value||!prefix)return refs;
    const re=new RegExp(`${escapeRegExp(prefix)}[^"'\\s)<>]+`,"g");
    const visit=(current)=>{
      if(current==null)return;
      if(typeof current==="string"){
        const hits=current.match(re)||[];
        hits.forEach(hit=>{
          const path=storagePublicPathFromString(hit);
          if(path)refs.set(path,(refs.get(path)||0)+1);
        });
        const direct=storagePublicPathFromString(current);
        if(direct)refs.set(direct,(refs.get(direct)||0)+1);
        return;
      }
      if(Array.isArray(current)){current.forEach(visit);return;}
      if(typeof current==="object")Object.values(current).forEach(visit);
    };
    visit(value);
    return refs;
  }

  async function listProjectStorageObjects(projectId,prefix=projectId,out=[]){
    let offset=0;
    while(true){
      const {data,error}=await db.storage.from(STORAGE_BUCKET).list(prefix,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      for(const row of rows){
        if(!row?.name)continue;
        const fullPath=`${prefix}/${row.name}`.replace(/\/+/g,"/");
        if(row.id==null&&!row.metadata){
          await listProjectStorageObjects(projectId,fullPath,out);
          continue;
        }
        const size=Number(row?.metadata?.size??row?.metadata?.contentLength??row?.size??0)||0;
        const {data:publicData}=db.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath);
        out.push({
          name:row.name,
          path:fullPath,
          url:publicData?.publicUrl||"",
          size,
          createdAt:row.created_at||row.createdAt||"",
          updatedAt:row.updated_at||row.last_accessed_at||row.created_at||""
        });
      }
      if(rows.length<100)break;
      offset+=rows.length;
    }
    return out;
  }

  function storageReasonLabels(meta){
    const out=[];
    if(meta.repoDraft)out.push(`Repo borrador (${meta.repoDraft})`);
    return out;
  }

  function selectedProjectStoragePaths(){
    return $$('[data-storage-path]:checked',$("#project-storage-list")).map(input=>input.dataset.storagePath).filter(Boolean);
  }

  function updateProjectStorageButtons(){
    const projectId=state.currentProject?.id||"";
    const audit=state.projectStorageAudit[projectId]||null;
    const selected=selectedProjectStoragePaths();
    const selectedBtn=$("#project-storage-delete-selected");
    const unusedBtn=$("#project-storage-delete-unused");
    if(selectedBtn){
      selectedBtn.disabled=!audit?.safeDelete||!selected.length;
      selectedBtn.textContent=selected.length?`Borrar seleccionados (${selected.length})`:"Borrar seleccionados";
    }
    if(unusedBtn){
      unusedBtn.disabled=!audit?.safeDelete||!audit?.candidateFiles;
      unusedBtn.textContent=audit?.candidateFiles?`Borrar candidatos (${audit.candidateFiles})`:"Borrar candidatos";
    }
  }

  function renderProjectStorageAudit(audit){
    const summary=$("#project-storage-summary"),count=$("#project-storage-count"),list=$("#project-storage-list");
    if(!summary||!count||!list)return;
    summary.innerHTML=`<article class="storage-stat-card"><span>Total en Supabase</span><strong>${fmtBytes(audit.totalBytes)}</strong><small>${audit.totalFiles} archivo${audit.totalFiles===1?"":"s"} del editor dentro de Supabase.</small></article><article class="storage-stat-card"><span>En uso</span><strong>${fmtBytes(audit.usedBytes)}</strong><small>${audit.usedFiles} archivo${audit.usedFiles===1?"":"s"} con referencias activas.</small></article><article class="storage-stat-card"><span>Candidatos</span><strong>${fmtBytes(audit.candidateBytes)}</strong><small>${audit.candidateFiles} archivo${audit.candidateFiles===1?"":"s"} sin referencias actuales.</small></article><article class="storage-stat-card"><span>Estado</span><strong>${audit.safeDelete?"Listo para limpiar":"Análisis incompleto"}</strong><small>${audit.safeDelete?`Última revisión: ${fmtDateTime(audit.scannedAt)}.`:"No borres hasta resolver los avisos del análisis."}</small></article>`;
    count.textContent=audit.totalFiles?`${audit.totalFiles} archivo${audit.totalFiles===1?"":"s"}`:"";
    list.innerHTML=audit.files.length?audit.files.map(file=>`<div class="storage-file-row ${file.used?"used":"candidate"}"><label class="storage-file-check">${audit.safeDelete&&!file.used?`<input type="checkbox" data-storage-path="${esc(file.path)}">`:`<input type="checkbox" disabled>`}</label><div class="storage-file-main"><div class="storage-file-title"><strong title="${esc(file.path)}">${esc(file.name)}</strong><span class="storage-pill ${file.used?"used":"candidate"}">${file.used?"En uso":"Candidato"}</span></div><div class="storage-file-meta"><span>${fmtBytes(file.size)}</span><span>${fmtDateTime(file.updatedAt||file.createdAt)}</span><span>${esc(file.reasons.join(" · ")||"Sin referencias actuales")}</span></div></div><div class="storage-file-actions">${file.url?`<a class="tiny-btn" href="${file.url}" target="_blank" rel="noopener">Abrir</a>`:""}</div></div>`).join(""):`<div class="storage-empty">No hay archivos del editor en Supabase para este proyecto.</div>`;
    updateProjectStorageButtons();
  }

  function resetProjectStoragePanel(project={}){
    const summary=$("#project-storage-summary"),count=$("#project-storage-count"),list=$("#project-storage-list");
    if(!summary||!count||!list)return;
    const audit=project?.id?state.projectStorageAudit[project.id]:null;
    if(audit){renderProjectStorageAudit(audit);return;}
    summary.innerHTML=`<article class="storage-stat-card"><span>Total en Supabase</span><strong>—</strong><small>Abre Analizar para revisar este proyecto.</small></article><article class="storage-stat-card"><span>En uso</span><strong>—</strong><small>Se llena al terminar el análisis.</small></article><article class="storage-stat-card"><span>Candidatos</span><strong>—</strong><small>Archivos sin referencias actuales.</small></article><article class="storage-stat-card"><span>Estado</span><strong>Sin análisis</strong><small>La limpieza manual se habilita solo cuando el análisis termina completo.</small></article>`;
    count.textContent="";
    list.innerHTML=project?.id?`<div class="storage-empty">Abre este apartado y pulsa Analizar.</div>`:`<div class="storage-empty">Guarda el proyecto primero.</div>`;
    setLine("#project-storage-line",project?.id?"Aquí verás el consumo del editor en Supabase y los candidatos a limpieza.":"Guarda el proyecto para poder analizar su almacenamiento.");
    updateProjectStorageButtons();
  }

  async function analyzeProjectStorage(force=false){
    const project=state.currentProject;
    if(!project?.id)return;
    if(state.projectStorageBusy[project.id])return;
    if(!force&&state.projectStorageAudit[project.id]){
      renderProjectStorageAudit(state.projectStorageAudit[project.id]);
      return;
    }
    state.projectStorageBusy[project.id]=true;
    setLine("#project-storage-line","Analizando almacenamiento del editor…");
    try{
      const warnings=[];
      let repoDrafts=[];

      try{
        const repoResult=await db.from("client_site_repo_drafts").select("page_path,edited_html,original_html,elements,updated_at,published_at").eq("project_id",project.id);
        if(repoResult.error)throw repoResult.error;
        repoDrafts=repoResult.data||[];
      }catch(err){
        warnings.push("No se pudieron revisar los borradores del modo repo.");
        console.error("storage repo drafts",err);
      }

      const refMeta=new Map();
      const register=(bucket,value)=>{
        const hits=collectStorageRefsFromValue(value,new Map());
        hits.forEach((count,path)=>{
          const current=refMeta.get(path)||{repoDraft:0};
          current[bucket]=(current[bucket]||0)+count;
          refMeta.set(path,current);
        });
      };

      repoDrafts.forEach(row=>{
        register("repoDraft",row.edited_html);
        register("repoDraft",row.original_html);
        register("repoDraft",row.elements||{});
      });

      const files=(await listProjectStorageObjects(project.id)).map(file=>{
        const meta=refMeta.get(file.path)||{repoDraft:0};
        const reasons=storageReasonLabels(meta);
        return {...file,used:Boolean(reasons.length),reasons};
      }).sort((a,b)=>{
        if(a.used!==b.used)return a.used?1:-1;
        return (b.size||0)-(a.size||0);
      });

      const totalBytes=files.reduce((sum,file)=>sum+file.size,0);
      const usedFiles=files.filter(file=>file.used);
      const candidateFiles=files.filter(file=>!file.used);
      const audit={
        projectId:project.id,
        scannedAt:new Date().toISOString(),
        warnings,
        safeDelete:!warnings.length,
        files,
        totalFiles:files.length,
        totalBytes,
        usedFiles:usedFiles.length,
        usedBytes:usedFiles.reduce((sum,file)=>sum+file.size,0),
        candidateFiles:candidateFiles.length,
        candidateBytes:candidateFiles.reduce((sum,file)=>sum+file.size,0)
      };

      state.projectStorageAudit[project.id]=audit;
      renderProjectStorageAudit(audit);
      setLine("#project-storage-line",warnings.length?`Análisis terminado con avisos: ${warnings.join(" ")}`:`Análisis terminado. Ya puedes revisar y limpiar candidatos.` ,warnings.length?"error":"success");
    }catch(err){
      console.error("analyze project storage",err);
      setLine("#project-storage-line",err?.message||"No pudimos analizar el almacenamiento del editor.","error");
    }finally{
      delete state.projectStorageBusy[project.id];
    }
  }

  async function ensureProjectStorageAudit(force=false){
    const project=state.currentProject;
    if(!project?.id)return;
    if(force||!state.projectStorageAudit[project.id]){
      await analyzeProjectStorage(true);
      return;
    }
    renderProjectStorageAudit(state.projectStorageAudit[project.id]);
  }

  async function deleteProjectStoragePaths(paths){
    const project=state.currentProject;
    const list=(paths||[]).filter(Boolean);
    if(!project?.id||!list.length)return;
    const audit=state.projectStorageAudit[project.id];
    if(!audit?.safeDelete){
      setLine("#project-storage-line","El análisis no está completo. No borres archivos hasta resolver los avisos.","error");
      return;
    }
    if(!confirm(`¿Borrar ${list.length} archivo(s) de Supabase para ${project.name||"este proyecto"}? Esta acción no se puede deshacer.`))return;
    setLine("#project-storage-line",`Borrando ${list.length} archivo(s)…`);
    const {error}=await db.storage.from(STORAGE_BUCKET).remove(list);
    if(error){
      setLine("#project-storage-line",error.message||"No pudimos borrar los archivos.","error");
      return;
    }
    delete state.projectStorageAudit[project.id];
    setLine("#project-storage-line",`${list.length} archivo(s) borrados.`,"success");
    await ensureProjectStorageAudit(true);
  }
  function setProjectTab(name="summary"){
    const projectId=state.currentProject?.id||$("#project-form")?.elements?.id?.value||"new";
    try{ localStorage.setItem(projectTabKey(projectId),name); }catch{}
    $$("[data-project-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.projectTab===name));
    $$("[data-project-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.projectPanel===name));
    if(name==="storage")ensureProjectStorageAudit();
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
    if(/editor_enabled|editor_visible_to_client|editor_access_status|editor_access_starts_at|editor_access_ends_at|editor_plan_months|editor_price_mxn|editor_launch_url|site_repo_owner|site_repo_name|site_repo_branch|site_repo_path|site_live_url|site_publish_provider|site_editor_mode/i.test(text)) return "Falta configurar los campos del editor/repositorio en Supabase. Ejecuta la migracion del editor y vuelve a intentar.";
    return error?.message||"No pudimos actualizar el editor.";
  }
  function currentEditorVisibleValue(project){
    const field=$("#project-editor-visible");
    return field ? Boolean(field.checked) : Boolean(project?.editor_visible_to_client);
  }
  function updateEditorAdminUI(project){
    const badge=$("#project-editor-badge"),status=$("#project-editor-status"),dates=$("#project-editor-dates"),copy=$("#project-editor-copy");
    if(!badge||!status||!dates||!copy)return;
    const access=editorState(project);
    // La interfaz debe reflejar el valor confirmado por Supabase, no el valor
    // temporal que pudiera conservar la casilla antes de terminar la recarga.
    const visible=Boolean(project?.editor_visible_to_client);
    const visibleToggle=$("#project-editor-visible"),visibleNote=$("#project-editor-visible-note");
    const liveUrl=$("#project-site-live-url"),owner=$("#project-site-repo-owner"),repo=$("#project-site-repo-name"),branch=$("#project-site-repo-branch"),path=$("#project-site-repo-path"),provider=$("#project-site-publish-provider");
    if(visibleToggle)visibleToggle.checked=visible;
    if(visibleNote)visibleNote.textContent=visible?"Visible para el cliente. Vera planes o el boton Abrir editor segun su acceso.":"Oculto para el cliente. No vera planes ni boton del editor.";
    if(liveUrl)liveUrl.value=project?.site_live_url||project?.site_url||"";
    if(owner)owner.value=project?.site_repo_owner||"";
    if(repo)repo.value=project?.site_repo_name||"";
    if(branch)branch.value=project?.site_repo_branch||"main";
    if(path)path.value=project?.site_repo_path||"/";
    if(provider)provider.value=project?.site_publish_provider||"github_pages";

    if(access.status==="active"){
      badge.className=visible?"badge green":"badge";
      badge.textContent=visible?"Activo":"Activo oculto";
      status.textContent=visible?"Editor activo":"Editor activo pero oculto";
      dates.textContent=`Activo hasta ${fmtDate(access.ends)}${project?.editor_plan_months?` · ${project.editor_plan_months} mes${project.editor_plan_months===1?"":"es"}`:""}`;
      copy.textContent=visible?"El cliente ya puede entrar al editor de su sitio.":"El acceso esta activo, pero la herramienta sigue oculta para el cliente.";
      return;
    }
    if(access.status==="expired"){
      badge.className=visible?"badge red":"badge";
      badge.textContent=visible?"Vencido":"Vencido oculto";
      status.textContent=visible?"Acceso vencido":"Acceso vencido y oculto";
      dates.textContent=access.ends?`Venció el ${fmtDate(access.ends)}.`:"El acceso del editor ya no esta activo.";
      copy.textContent=visible?"Puedes renovarlo con un plan nuevo o dejarlo vencido para que el cliente vea los planes.":"La herramienta esta oculta. Si luego la muestras, el cliente vera los planes para renovarla.";
      return;
    }

    badge.className="badge";
    badge.textContent=visible?"Visible sin acceso":"Oculto";
    status.textContent=visible?"Sin acceso activo":"Herramienta oculta";
    dates.textContent=visible?"El cliente vera los planes del editor, pero todavia no tiene acceso activo.":"El cliente no vera esta herramienta.";
    copy.textContent=visible?"El cliente ya ve los planes del editor. Activalo cuando quieras.":"Activa 'Mostrar herramienta editor al cliente' para que aparezca en su portal.";
  }
  const CONSULTAR_ENDPOINT="https://scaebulgcuvqpucondws.supabase.co/functions/v1/consultar-dominio";
  function normalizeSiteName(raw){let v=String(raw||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");v=v.replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"").replace(/^-+|-+$/g,"");return v.slice(0,63);}
  function normalizeDomain(raw){let v=String(raw||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");v=v.replace(/^[a-z]+:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/^\.+|\.+$/g,"");if(!v)return "";if(!v.includes("."))v+=".com";return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(v)?v:"";}
  async function fetchTimeout(url,ms=20000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,{signal:c.signal});}finally{clearTimeout(t);}}
  async function loadHostingPlans(){try{const {data,error}=await db.from("client_hosting_plans").select("*").order("sort_order",{ascending:true});if(error)throw error;state.hostingPlans=data||[];}catch(e){state.hostingPlans=[];}}
  function hostingPlanById(id){return state.hostingPlans.find(p=>p.id===id);}
  function hostingLabel(value){return ({cloudflare:"Alojamiento incluido",hostinger:"Plan de hosting",propio:"El cliente ya tiene hosting"}[value]||"Alojamiento incluido");}
  function renderHostingPlans(selectedId){
    const grid=$("#hosting-plans-grid"); if(!grid)return;
    const setupPlan=state.currentSetup?.hosting_plan_id&&!hostingPlanById(selectedId)?state.currentSetup:null;
    let cards=state.hostingPlans.map(p=>{
      const price=p.first_year!=null?`${money(p.first_year)}/año`:(p.renewal!=null?`${money(p.renewal)}/año`:"—");
      return `<label class="hosting-plan-card"><input type="radio" name="hosting_plan_id" value="${esc(p.id)}"><span><strong>${esc(p.name)}</strong>${p.description?`<small>${esc(p.description)}</small>`:""}${Array.isArray(p.features)&&p.features.length?`<em>${esc(p.features.join(" · "))}</em>`:""}</span><b>${price}</b></label>`;
    }).join("");
    if(setupPlan&&setupPlan.hosting_plan_id){
      cards+=`<label class="hosting-plan-card old"><input type="radio" name="hosting_plan_id" value="${esc(setupPlan.hosting_plan_id)}" checked><span><strong>${esc(setupPlan.hosting_plan_name||"Plan anterior")}</strong><small>Este plan ya no está en el catálogo, pero se conservó el de ese proyecto.</small></span><b>${setupPlan.hosting_first_year!=null?`${money(setupPlan.hosting_first_year)}/año`:"—"}</b></label>`;
    }
    grid.innerHTML=cards;
    const radio=grid.querySelector(`input[name="hosting_plan_id"][value="${esc(selectedId||"")}"]`);
    if(radio){radio.checked=true;radio.closest(".hosting-plan-card")?.classList.add("selected");}
    const show=String($("#project-form")?.elements?.hosting_type?.value||"cloudflare")==="hostinger";
    grid.hidden=!show||!cards.length;
  }
  function syncAddressRadios(addressType,owned){
    const f=$("#project-form"); if(!f)return;
    const type=addressType==="dominio"?"dominio":"gratis";
    const radio=[...f.querySelectorAll('[name="address_type"]')].find(r=>r.value===type&&(r.dataset.owned==="1")===Boolean(owned));
    if(radio)radio.checked=true;
    const hidden=f.querySelector('[name="domain_owned"]');
    if(hidden)hidden.value=radio&&radio.dataset.owned==="1"?"on":"";
  }
  function applySetupToForm(setup){
    const f=$("#project-form"); if(!f)return;
    const el=f.elements;
    if(setup){
      state.currentSetup=setup;
      syncAddressRadios(setup.address_type||"gratis",Boolean(setup.domain_owned));
      if(el.domain_type_locked)el.domain_type_locked.checked=Boolean(setup.domain_type_locked);
      if(el.domain_value_locked)el.domain_value_locked.checked=Boolean(setup.domain_value_locked);
      if(el.domain_verified_at)el.domain_verified_at.value=setup.domain_verified_at||"";
      if(el.hosting_plan_locked)el.hosting_plan_locked.checked=Boolean(setup.hosting_plan_locked);
      if(el.domain)el.domain.value=setup.address_type==="dominio"?(setup.domain||""):(setup.site_name?`${setup.site_name}.pages.dev`:"");
      if(el.offer_domain_enabled)el.offer_domain_enabled.checked=Boolean(setup.offer_domain_enabled);
      if(el.offer_domain_price)el.offer_domain_price.value=setup.offer_domain_price??"";
      if(el.offer_domain_note)el.offer_domain_note.value=setup.offer_domain_note||"";
      if(el.offer_hosting_enabled)el.offer_hosting_enabled.checked=Boolean(setup.offer_hosting_enabled);
      if(el.offer_hosting_price)el.offer_hosting_price.value=setup.offer_hosting_price??"";
      if(el.offer_hosting_note)el.offer_hosting_note.value=setup.offer_hosting_note||"";
      const status=$("#verify-domain-status");if(status) status.textContent=setup.domain_verified_at?`Dominio verificado (${fmtDate(setup.domain_verified_at)})`:"";
      renderHostingPlans(setup.hosting_plan_id||"");
    }else{
      state.currentSetup=null;
      if($("#verify-domain-status"))$("#verify-domain-status").textContent="";
      if(el.offer_domain_enabled)el.offer_domain_enabled.checked=false;
      if(el.offer_domain_price)el.offer_domain_price.value="";
      if(el.offer_domain_note)el.offer_domain_note.value="";
      if(el.offer_hosting_enabled)el.offer_hosting_enabled.checked=false;
      if(el.offer_hosting_price)el.offer_hosting_price.value="";
      if(el.offer_hosting_note)el.offer_hosting_note.value="";
      renderHostingPlans("");
    }
    updateConfigUI();
  }
  function updateConfigUI(){
    const f=$("#project-form"); if(!f)return;
    const address=f.elements.address_type?.value||"gratis", hosting=f.elements.hosting_type?.value||"cloudflare";
    const domainInput=$("#publication-config-domain-label input[name=domain]");
    if(domainInput)domainInput.placeholder=address==="dominio"?"Ej. tunegocio.com":"Ej. tunegocio.pages.dev";
    const owned=f.elements.domain_owned;
    if(owned){const wrap=owned.closest(".checks");if(wrap)wrap.style.visibility=address==="dominio"?"visible":"hidden";owned.disabled=address!=="dominio";if(address!=="dominio"){owned.checked=false;owned.value="";}}
    const picks=$$("#project-form [name=domain_value_locked]");
    picks.forEach(p=>{p.disabled=!String(f.elements.domain?.value||"").trim();if(p.disabled)p.checked=false;});
    const grid=$("#hosting-plans-grid");
    if(grid)grid.hidden=hosting!=="hostinger";
    const warn=$("#hosting-combo-warn");
    if(warn)warn.hidden=!(hosting!=="cloudflare"&&address==="gratis");
  }
  async function verifyAdminDomain(){
    const f=$("#project-form"); if(!f)return;
    const address=f.elements.address_type?.value||"gratis";
    const raw=String(f.elements.domain?.value||"").trim();
    const status=$("#verify-domain-status"); if(!status)return;
    if(!raw){status.textContent="Escribe primero la dirección.";return;}
    status.textContent="Verificando…";
    try{
      const target=address==="dominio"?normalizeDomain(raw):`${normalizeSiteName(raw)}.pages.dev`;
      if(!target)throw new Error("Dominio inválido");
      const r=await fetchTimeout(`${CONSULTAR_ENDPOINT}?dominio=${encodeURIComponent(target)}`,15000);
      if(!r.ok)throw new Error();
      const d=await r.json();
      if(d?.ok!==true)throw new Error();
      const libre=d.disponible;
      if(address==="dominio"){status.textContent=libre===true?"El dominio está libre y se puede comprar.":libre===false?"El dominio ya está registrado (tiene dueño).":"No se pudo confirmar el dominio.";}
      else{status.textContent=libre===true?`${target} está disponible para usar.`:libre===false?`${target} ya está tomado.`:"No se pudo confirmar la disponibilidad.";}
      if(f.elements.domain_verified_at)f.elements.domain_verified_at.value=new Date().toISOString();
    }catch(_){status.textContent="No pudimos verificar. Revisa que el formato sea correcto.";}
  }

  async function saveEditorRepoConfig(){
    const project=state.currentProject;
    if(!project?.id)return;
    const editorVisible=Boolean($("#project-editor-visible")?.checked);
    const payload={
      site_live_url:String($("#project-site-live-url")?.value||"").trim()||null,
      site_repo_owner:String($("#project-site-repo-owner")?.value||"").trim()||null,
      site_repo_name:String($("#project-site-repo-name")?.value||"").trim()||null,
      site_repo_branch:String($("#project-site-repo-branch")?.value||"").trim()||"main",
      site_repo_path:String($("#project-site-repo-path")?.value||"").trim()||"/",
      site_publish_provider:String($("#project-site-publish-provider")?.value||"github_pages"),
      editor_visible_to_client:editorVisible,
      site_editor_mode:"html_repo",
      updated_at:new Date().toISOString()
    };
    setLine("#project-editor-line","Guardando configuración del repo...");
    const {data,error}=await db.from("client_projects").update(payload).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState({...data,editor_visible_to_client:editorVisible});
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
    const editorVisible=Boolean($("#project-editor-visible")?.checked);
    const payload={
      editor_enabled:true,
      editor_visible_to_client:editorVisible,
      editor_access_status:"activo",
      editor_access_starts_at:now.toISOString(),
      editor_access_ends_at:ends.toISOString(),
      editor_plan_months:Number(months),
      editor_price_mxn:Number(price),
      updated_at:new Date().toISOString()
    };
    const {data,error}=await db.from("client_projects").update(payload).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState({...data,editor_visible_to_client:editorVisible});
    setLine("#project-editor-line",`Editor activado por ${months} mes${months===1?"":"es"}.`,"success");
    toast("Editor activado.");
  }
  async function cancelEditorAccess(){
    const project=state.currentProject;
    if(!project?.id)return;
    if(!confirm(`¿Quitar el acceso al editor de ${project.name||"este proyecto"}?`))return;
    setLine("#project-editor-line","Cancelando acceso al editor…");
    const editorVisible=Boolean($("#project-editor-visible")?.checked);
    const {data,error}=await db.from("client_projects").update({editor_enabled:false,editor_visible_to_client:editorVisible,editor_access_status:"cancelado",updated_at:new Date().toISOString()}).eq("id",project.id).select().single();
    if(error){setLine("#project-editor-line",editorAdminError(error),"error");return;}
    syncProjectState({...data,editor_visible_to_client:editorVisible});
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
    const f=$("#project-form"),el=f.elements;state.currentProject=project.id?project:null;const savedTab=(project.id?localStorage.getItem(projectTabKey(project.id)):null)||"summary";f.reset();el.id.value=project.id||"";el.source_prospect_id.value=project.source_prospect_id||"";el.name.value=project.name||"";fillClientSelect();el.user_id.value=project.user_id||"";el.project_stage.value=project.project_stage||"Invitación";el.status.value=project.status||"Pendiente de activar cuenta";syncAddressRadios(project.address_type||"gratis",Boolean(project.domain_owned));el.domain.value=project.domain||"";el.hosting_type.value=project.hosting_type||"cloudflare";el.site_visibility.value=project.site_visibility||"hidden";el.site_url.value=project.site_url||"";el.preview_url.value=project.preview_url||"";el.total_price.value=project.total_price??750;el.deposit_amount.value=project.deposit_amount??375;el.balance_amount.value=project.balance_amount??375;el.payment_method.value=project.payment_method||"Transferencia";el.deposit_paid.checked=Boolean(project.deposit_paid);el.balance_paid.checked=Boolean(project.balance_paid);el.client_note.value=project.client_note||"";$("#project-modal-title").textContent=project.id?project.name:"Nuevo proyecto";setLine("#project-form-status","");setLine("#project-editor-line","");const inv=inviteUrl(project);$("#project-invite-box").hidden=!project.id||Boolean(project.user_id);$("#project-invite-url").textContent=inv||"Guarda el proyecto para generar una invitación.";$("#update-title").value="";$("#update-status").value="";$("#update-description").value="";setProjectTab(savedTab);updateProjectSummary();updateProjectLifecycleUI(project);updateEditorAdminUI(project);resetProjectStoragePanel(project);updateConfigUI();renderHostingPlans(project.id?state.currentSetup?.hosting_plan_id||"":"");resetPublishPanel(project);
    // Restaura la configuracion (setup) al formulario: la opcion "ya tiene dominio",
    // los candados y el plan. Sin esto, al guardar/abrir el formulario se repintaba
    // con la opcion equivocada por un instante (parpadeo), porque client_projects
    // no guarda domain_owned ni los candados: viven en client_project_setup.
    if(state.currentSetup&&state.currentSetup.project_id===project.id)applySetupToForm(state.currentSetup);
  }

  async function downloadAdminFile(fileId,fileName){try{const r=await fetch(`/api/project-file?id=${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${state.session.access_token}`}});if(!r.ok)throw new Error();const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName||"archivo";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast("No pudimos descargar el archivo.");}}

  // ---------- Publicación del sitio ----------
  const publishState={files:[],publishing:false};
  function slugifyText(text){return String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90);}
  function resetPublishPanel(project={}){
    publishState.files=[];
    const list=$("#publish-files-list");if(list)list.innerHTML="";
    $$("#publish-folder,#publish-files").forEach(i=>{if(i)i.value="";});
    const clear=$("#publish-clear-list");if(clear)clear.remove();
    const repoInput=$("#publish-repo-name");if(repoInput)repoInput.value=project.site_repo_name||slugifyText(project.name||"");
    const open=$("#publish-open"),copy=$("#publish-copy");if(open)open.hidden=true;if(copy)copy.hidden=true;
    const result=$("#publish-result");if(result){result.hidden=true;result.innerHTML="";}
    setLine("#publish-status","");
  }
  const publishAllowedExt=/\.(html?|css|js|mjs|json|svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|md|woff2?|ttf|otf|eot|pdf|map|mp4|webm|ogg|mp3|wav|zip)$/i;
  function addPublishFiles(fileList){
    if(!fileList)return;
    const all=[...fileList];
    const allowed=all.filter(f=>publishAllowedExt.test(f.name)&&!f.name.startsWith(".")&&f.size<=25*1024*1024);
    let added=0;
    for(const file of allowed){
      const path=file.webkitRelativePath?file.webkitRelativePath.replace(/\\/g,"/"):file.name;
      if(!publishState.files.some(f=>f.path===path)){publishState.files.push({file,path});added++;}
    }
    renderPublishFiles();
    const skipped=all.length-allowed.length;
    setLine("#publish-status",skipped?`Se omitieron ${skipped} archivo(s) no compatibles.`:"");
    toast(added?`${added} archivo(s) agregados.`:(skipped?"No se agregaron archivos.":""));
  }
  function renderPublishFiles(){
    const list=$("#publish-files-list");if(!list)return;
    const total=publishState.files.reduce((s,f)=>s+f.file.size,0);
    const shown=publishState.files.slice(0,60);
    list.innerHTML=publishState.files.length?`<div class="publish-files-head"><span>${publishState.files.length} archivo(s) · ${(total/1024/1024).toFixed(1)} MB</span><button type="button" class="tiny-btn" id="publish-clear-list">Quitar todos</button></div>${shown.map(f=>`<div class="publish-file-row"><strong>${esc(f.path)}</strong><span>${(f.file.size/1024).toFixed(1)} KB</span></div>`).join("")}${publishState.files.length>60?`<span class="publish-more">+${publishState.files.length-60} archivos más…</span>`:""}`:"";
    const clear=$("#publish-clear-list");if(clear)clear.addEventListener("click",()=>{publishState.files=[];renderPublishFiles();});
  }
  function readPublishFilesAsBase64(){
    return Promise.all(publishState.files.map(f=>new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve({path:f.path,data:String(r.result||"").split(",")[1]||""});
      r.onerror=()=>reject(new Error("No pudimos leer "+f.path));
      r.readAsDataURL(f.file);
    })));
  }
  async function publishSite(){
    if(publishState.publishing)return;
    const projectId=$("#project-form")?.elements?.id?.value;
    if(!projectId){toast("Guarda primero el proyecto.");return;}
    if(!publishState.files.length){setLine("#publish-status","Selecciona los archivos del sitio antes de publicar.","error");return;}
    const repoName=String($("#publish-repo-name")?.value||"").trim();
    if(!repoName){setLine("#publish-status","Escribe el nombre del repositorio.","error");return;}
    const cloudflare=Boolean($("#publish-cf")?.checked);
    const githubPages=Boolean($("#publish-gh")?.checked);
    if(!cloudflare&&!githubPages){setLine("#publish-status","Elige al menos una plataforma.","error");return;}
    publishState.publishing=true;
    const btn=$("#publish-btn");if(btn){btn.disabled=true;btn.textContent="Publicando…";}
    setLine("#publish-status","Subiendo archivos y publicando…");
    try{
      const files=await readPublishFilesAsBase64();
      const r=await fetch("/api/publish-site",{method:"POST",headers:{Authorization:`Bearer ${state.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({project_id:projectId,repo_name:repoName,cloudflare,github_pages,files})});
      const data=await r.json().catch(()=>({ok:false,message:"Respuesta inválida del servidor."}));
      if(!r.ok||!data.ok){const msg=data.message||"No pudimos publicar.";setLine("#publish-status",msg,"error");toast(msg);return;}
      setLine("#publish-status","¡Publicado!");toast("Sitio publicado correctamente.");
      const links=[];
      if(data.results?.cloudflare_url)links.push(["Cloudflare Pages",data.results.cloudflare_url]);
      if(data.results?.github_pages_url)links.push(["GitHub Pages",data.results.github_pages_url]);
      const result=$("#publish-result");
      if(result){result.hidden=false;result.innerHTML=`<div class="publish-result-row"><span>Repositorio</span><a href="${esc(data.results?.repo_url||"#")}" target="_blank" rel="noopener">${esc(data.results?.owner||"")}/${esc(data.results?.repo||repoName)}</a></div>${links.map(([n,u])=>`<div class="publish-result-row"><span>${n}</span><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`).join("")}${(data.warnings||[]).map(w=>`<p class="publish-warning">${esc(w)}</p>`).join("")}`;}
      const primaryUrl=data.results?.cloudflare_url||data.results?.github_pages_url;
      const open=$("#publish-open"),copy=$("#publish-copy");
      if(open&&primaryUrl){open.hidden=false;open.onclick=()=>window.open(primaryUrl,"_blank");}
      if(copy&&primaryUrl){copy.hidden=false;copy.onclick=()=>{navigator.clipboard.writeText(primaryUrl).then(()=>toast("Enlace copiado.")).catch(()=>toast("No pudimos copiar."));};}
      const p=projectById(projectId);
      if(p){p.site_repo_owner=data.results?.owner||p.site_repo_owner;p.site_repo_name=data.results?.repo||repoName;p.site_repo_branch=data.results?.branch||"main";p.site_live_url=primaryUrl||p.site_live_url;p.site_publish_provider=cloudflare&&githubPages?"both":cloudflare?"cloudflare":"github_pages";updateEditorAdminUI(p);}
    }catch(e){
      setLine("#publish-status","No pudimos publicar: "+(e.message||""),"error");toast("Error al publicar.");
    }finally{
      publishState.publishing=false;
      const btn=$("#publish-btn");if(btn){btn.disabled=false;btn.textContent="Publicar";}
    }
  }
  function initPublishPanel(){
    const dropzone=$("#publish-dropzone");
    if(!dropzone)return;
    $("#publish-pick-folder")?.addEventListener("click",()=>$("#publish-folder")?.click());
    $("#publish-pick-files")?.addEventListener("click",()=>$("#publish-files")?.click());
    $("#publish-folder")?.addEventListener("change",e=>addPublishFiles(e.target.files));
    $("#publish-files")?.addEventListener("change",e=>addPublishFiles(e.target.files));
    $("#publish-btn")?.addEventListener("click",publishSite);
    ["dragover","dragenter"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add("dragging");}));
    ["dragleave","drop"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove("dragging");}));
    dropzone.addEventListener("drop",e=>addPublishFiles(e.dataTransfer.files));
  }

  async function loadProjectDetails(id,showDialog=true){
    const p=projectById(id);if(!p)return;
    if(!p.user_id&&!p.claim_token){const token=crypto.randomUUID();const {data}=await db.from("client_projects").update({claim_token:token}).eq("id",id).select().single();if(data)Object.assign(p,data);}
    await ensureInvite(p);
    $("#project-setup-admin-content").innerHTML="<span>Cargando…</span>";$("#project-brief-admin-content").innerHTML="<span>Cargando…</span>";$("#project-files-admin").innerHTML="<span>Cargando…</span>";
    const [setupR,briefR,filesR]=await Promise.all([db.from("client_project_setup").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_briefs").select("*").eq("project_id",id).maybeSingle(),db.from("client_project_files").select("*").eq("project_id",id).order("created_at",{ascending:false})]);
    const setup=setupR.data,brief=briefR.data,files=filesR.data||[];
    state.currentSetup=setup||null;
    // Repintar el formulario solo hasta tener la configuracion: asi la opcion
    // "ya tiene dominio", los candados y el plan aparecen desde el primer momento
    // (antes se marcaba la opcion equivocada y luego daba un salto).
    setProjectForm(p);
    applySetupToForm(setup||null);
    const hostingPlanName=setup?.hosting_plan_id?(setup?.hosting_plan_name||"Plan elegido"):(setup?.hosting_type==="hostinger"?"Plan pendiente de definir":null);
    const lockedRows=[setup?.domain_type_locked&&["Tipo de dirección fijo","Sí"],setup?.domain_value_locked&&["Dirección fija","Sí"],setup?.hosting_plan_locked&&["Alojamiento fijo","Sí"]].filter(Boolean);
    $("#project-setup-admin-content").innerHTML=setup?[["Dirección",setup.address_type==="dominio"?setup.domain:`${setup.site_name||""}.pages.dev`],["Dominio del cliente",setup.domain_owned?"Sí":"No"],["Primer año dominio",setup.domain_first_year!=null?money(setup.domain_first_year):"—"],["Renovación",setup.domain_renewal!=null?money(setup.domain_renewal):"—"],["Alojamiento",hostingLabel(setup.hosting_type)],...(hostingPlanName?[["Plan alojamiento",hostingPlanName],["Primer año plan",setup.hosting_first_year!=null?money(setup.hosting_first_year):"—"],["Renovación plan",setup.hosting_renewal!=null?money(setup.hosting_renewal):"—"]]:[]),...lockedRows,["Nota especial",setup.special_features_note||"—"],["Verificación dominio",setup.domain_verified_at?`${fmtDate(setup.domain_verified_at)}`:"—"],["Enviado",setup.completed_at?fmtDate(setup.completed_at):"—"]].map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join(""):`<span>El cliente todavía no ha configurado su página.</span>`;
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
    const hostingLocked=fd.get("hosting_plan_locked")==="on",hostingTypeForm=String(fd.get("hosting_type")||"cloudflare");
    if(hostingLocked&&hostingTypeForm==="hostinger"){
      const planElegido=String(fd.get("hosting_plan_id")||"").trim();
      const setupPrevio=state.currentSetup&&state.currentSetup.project_id===id?state.currentSetup:null;
      if(!planElegido&&!setupPrevio?.hosting_plan_id){setLine("#project-form-status","Para fijar el alojamiento primero elige un plan de hosting.","error");return;}
    }
    const repoFields=$("#project-site-repo-owner")?{site_live_url:String($("#project-site-live-url")?.value||"").trim()||null,site_repo_owner:String($("#project-site-repo-owner")?.value||"").trim()||null,site_repo_name:String($("#project-site-repo-name")?.value||"").trim()||null,site_repo_branch:String($("#project-site-repo-branch")?.value||"").trim()||"main",site_repo_path:String($("#project-site-repo-path")?.value||"").trim()||"/",site_publish_provider:String($("#project-site-publish-provider")?.value||"github_pages"),site_editor_mode:"html_repo"}:{};
    const editorVisibilityFields=$("#project-editor-visible")?{editor_visible_to_client:Boolean($("#project-editor-visible").checked)}:{};
    const payload={...repoFields,...editorVisibilityFields,user_id:userId,name:String(fd.get("name")||"").trim(),project_stage:stage,status:String(fd.get("status")||"").trim()||stage,address_type:String(fd.get("address_type")||"gratis"),domain:String(fd.get("domain")||"").trim()||null,hosting_type:String(fd.get("hosting_type")||"cloudflare"),site_visibility:String(fd.get("site_visibility")||"hidden"),site_url:String(fd.get("site_url")||"").trim()||null,preview_url:String(fd.get("preview_url")||"").trim()||null,total_price:fd.get("total_price")?Number(fd.get("total_price")):null,deposit_amount:fd.get("deposit_amount")?Number(fd.get("deposit_amount")):null,balance_amount:fd.get("balance_amount")?Number(fd.get("balance_amount")):null,payment_method:String(fd.get("payment_method")||"").trim()||null,deposit_paid:fd.get("deposit_paid")==="on",balance_paid:fd.get("balance_paid")==="on",client_note:String(fd.get("client_note")||"").trim()||null,source_prospect_id:String(fd.get("source_prospect_id")||"")||null,updated_at:new Date().toISOString()};
    if(stage==="Revisión"&&!old?.review_ready_at)payload.review_ready_at=new Date().toISOString();if(stage==="Publicado"&&!old?.published_at)payload.published_at=new Date().toISOString();
    setLine("#project-form-status","Guardando…");const result=id?await db.from("client_projects").update(payload).eq("id",id).select().single():(async()=>{const {data,error}=await db.from("client_projects").insert({...payload,claim_token:null,accepted_at:new Date().toISOString()}).select().single();if(!error&&data&&!userId){const {data:updated}=await db.from("client_projects").update({claim_token:crypto.randomUUID()}).eq("id",data.id).select().single();if(updated)Object.assign(data,updated);await ensureInvite(data);}return {data,error};})();
    if(result.error){setLine("#project-form-status",result.error.message||"No pudimos guardar.","error");return;}
    let saved=result.data;
    // Guardado explícito: la casilla del editor debe sobrevivir a la recarga
    // en tiempo real y no depender de que el primer update devuelva el campo.
    if(id&&$("#project-editor-visible")){
      const editorVisible=Boolean($("#project-editor-visible").checked);
      const visibilityResult=await db.from("client_projects").update({editor_visible_to_client:editorVisible,updated_at:new Date().toISOString()}).eq("id",id).select().single();
      if(visibilityResult.error){setLine("#project-form-status",visibilityResult.error.message||"No pudimos guardar la visibilidad del editor.","error");return;}
      saved=visibilityResult.data||saved;
      if(Boolean(saved.editor_visible_to_client)!==editorVisible){setLine("#project-form-status","Supabase no confirmó la visibilidad del editor.","error");return;}
    }
    const idx=state.projects.findIndex(p=>p.id===saved.id);if(idx>=0)state.projects[idx]=saved;else state.projects.unshift(saved);
    if(saved.source_prospect_id)await db.from("prospectos").update({client_user_id:userId,client_project_id:saved.id}).eq("id",saved.source_prospect_id).then(()=>{});
    await saveProjectSetup(saved,fd);
    setProjectForm(saved);if(crmPage!=="project-admin")renderAll();renderClientDetail();setLine("#project-form-status","Proyecto guardado.","success");toast("Proyecto actualizado.");
  }
  async function saveProjectSetup(saved,fd){
    const setupAnterior=state.currentSetup&&state.currentSetup.project_id===saved.id?state.currentSetup:null;
    const addressType=String(fd.get("address_type")||"gratis");
    const hostingType=String(fd.get("hosting_type")||"cloudflare");
    if(hostingType!=="cloudflare"&&addressType!=="dominio"){
      setLine("#project-form-status","Este alojamiento requiere dominio personalizado. Elige primero uno en Dirección.","error");
      return;
    }
    if(hostingType==="hostinger"&&fd.get("hosting_plan_locked")==="on"&&!String(fd.get("hosting_plan_id")||"").trim()){
      setLine("#project-form-status","Elige primero el plan de hosting para poder fijarlo.","error");
      return;
    }
    const rawDomain=String(fd.get("domain")||"").trim();
    const isDomain=addressType==="dominio";
    const siteName=isDomain?null:normalizeSiteName(rawDomain.replace(/\.pages\.dev$/,""));
    const domain=isDomain?normalizeDomain(rawDomain):null;
    const hostingChanged=!setupAnterior||setupAnterior.hosting_type!==hostingType;
    let plan={hosting_plan_id:null,hosting_plan_name:null,hosting_plan_features:null,hosting_first_year:null,hosting_renewal:null,hosting_currency:"MXN"};
    if(hostingType==="hostinger"){
      const planId=String(fd.get("hosting_plan_id")||"").trim()||null;
      if(planId){
        const p=hostingPlanById(planId);
        plan={hosting_plan_id:p?.id||planId,hosting_plan_name:p?.name||setupAnterior?.hosting_plan_name||null,hosting_plan_features:p?.features||null,hosting_first_year:p?.first_year??null,hosting_renewal:p?.renewal??null,hosting_currency:p?.currency||"MXN"};
      }else if(setupAnterior){
        plan={hosting_plan_id:setupAnterior.hosting_plan_id||null,hosting_plan_name:setupAnterior.hosting_plan_name||null,hosting_plan_features:setupAnterior.hosting_plan_features||null,hosting_first_year:setupAnterior.hosting_first_year??null,hosting_renewal:setupAnterior.hosting_renewal??null,hosting_currency:setupAnterior.hosting_currency||"MXN"};
      }
    }else if(hostingChanged||!setupAnterior){
      plan={hosting_plan_id:null,hosting_plan_name:null,hosting_plan_features:null,hosting_first_year:null,hosting_renewal:null,hosting_currency:"MXN"};
    }else{
      plan={hosting_plan_id:setupAnterior.hosting_plan_id||null,hosting_plan_name:setupAnterior.hosting_plan_name||null,hosting_plan_features:setupAnterior.hosting_plan_features||null,hosting_first_year:setupAnterior.hosting_first_year??null,hosting_renewal:setupAnterior.hosting_renewal??null,hosting_currency:setupAnterior.hosting_currency||"MXN"};
    }
    const payload={
      project_id:saved.id,
      user_id:saved.user_id||setupAnterior?.user_id||null,
      address_type:addressType,
      site_name:siteName,
      domain,
      domain_owned:isDomain&&fd.get("domain_owned")==="on",
      domain_type_locked:fd.get("domain_type_locked")==="on",
      domain_value_locked:fd.get("domain_value_locked")==="on"&&!!(siteName||domain),
      domain_verified_at:String(fd.get("domain_verified_at")||"")||setupAnterior?.domain_verified_at||null,
      hosting_type:hostingType,
      hosting_plan_locked:fd.get("hosting_plan_locked")==="on",
      offer_domain_enabled:fd.get("offer_domain_enabled")==="on",
      offer_domain_price:fd.get("offer_domain_price")?Number(fd.get("offer_domain_price")):null,
      offer_domain_note:String(fd.get("offer_domain_note")||"").trim()||null,
      offer_hosting_enabled:fd.get("offer_hosting_enabled")==="on",
      offer_hosting_price:fd.get("offer_hosting_price")?Number(fd.get("offer_hosting_price")):null,
      offer_hosting_note:String(fd.get("offer_hosting_note")||"").trim()||null,
      ...plan,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await db.from("client_project_setup").upsert(payload,{onConflict:"project_id"}).select().single();
    if(error&&!/locked|fijad|configuraci/i.test(error.message||"")){setLine("#project-form-status",`El proyecto se guardó, pero no la configuración: ${error.message}`,"error");return;}
    if(data)state.currentSetup=data;
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
  $("#project-form")?.addEventListener("submit",saveProject);$$('[data-close-project]').forEach(b=>b.addEventListener("click",()=>$("#project-modal").close()));$("#new-project")?.addEventListener("click",()=>{state.currentSetup=null;setProjectForm({project_stage:"Invitación",status:"Pendiente de activar cuenta",site_visibility:"hidden",total_price:750,deposit_amount:375,balance_amount:375,payment_method:"Transferencia"});$("#project-setup-admin-content").innerHTML="<span>Sin configuración.</span>";$("#project-brief-admin-content").innerHTML="<span>Sin información.</span>";$("#project-files-admin").innerHTML="<span>No hay archivos.</span>";$("#project-modal").showModal();});
  $("#copy-project-invite")?.addEventListener("click",()=>state.currentProject&&copyInvite(state.currentProject.id));$("#whatsapp-project-invite")?.addEventListener("click",()=>state.currentProject&&sendInvite(state.currentProject.id));$("#renew-project-invite")?.addEventListener("click",renewInvite);$("#cancel-project-invite")?.addEventListener("click",()=>state.currentProject&&cancelInvite(state.currentProject.id));$("#archive-project-cancel")?.addEventListener("click",()=>archiveProjectState("cancel"));$("#archive-project-discontinue")?.addEventListener("click",()=>archiveProjectState("discontinue"));$("#restore-project")?.addEventListener("click",restoreArchivedProject);$("#delete-project-permanently")?.addEventListener("click",()=>deleteProjectPermanently());$("#add-project-update")?.addEventListener("click",addUpdate);
  $$("[data-editor-activate]").forEach(b=>b.addEventListener("click",()=>activateEditorAccess(Number(b.dataset.editorActivate),Number(b.dataset.editorPrice))));
  $("#save-editor-repo")?.addEventListener("click",saveEditorRepoConfig);
  $("#cancel-editor-access")?.addEventListener("click",cancelEditorAccess);
  $("#project-storage-refresh")?.addEventListener("click",()=>ensureProjectStorageAudit(true));
  $("#project-storage-delete-selected")?.addEventListener("click",()=>deleteProjectStoragePaths(selectedProjectStoragePaths()));
  $("#project-storage-delete-unused")?.addEventListener("click",()=>{
  const audit=state.projectStorageAudit[state.currentProject?.id||""];
  const paths=(audit?.files||[]).filter(file=>!file.used).map(file=>file.path);
  deleteProjectStoragePaths(paths);
});
$("#project-storage-list")?.addEventListener("change",e=>{
  if(e.target?.matches("[data-storage-path]"))updateProjectStorageButtons();
});
  $$("[data-project-tab]").forEach(b=>b.addEventListener("click",()=>setProjectTab(b.dataset.projectTab)));
  initPublishPanel();
  $$("[data-prospect-stage]").forEach(b=>b.addEventListener("click",()=>setProspectStage(b.dataset.prospectStage)));
  ["user_id","project_stage","site_visibility","total_price"].forEach(name=>$("#project-form")?.elements?.[name]?.addEventListener("input",updateProjectSummary));
  ["user_id","project_stage","site_visibility"].forEach(name=>$("#project-form")?.elements?.[name]?.addEventListener("change",updateProjectSummary));
  $("#verify-domain-btn")?.addEventListener("click",verifyAdminDomain);
  $("#project-form")?.addEventListener("change",e=>{
    const t=e.target;
    if(t&&(t.name==="address_type"||t.name==="hosting_type"||t.name==="domain")){
      if(t.name==="address_type"){const hid=$("#project-form [name=domain_owned]");if(hid)hid.value=t.dataset.owned==="1"?"on":"";}
      if(t.name==="domain"){$$("#project-form [name=domain_value_locked]").forEach(p=>{p.disabled=!String(t.value||"").trim();if(p.disabled)p.checked=false;});}
      updateConfigUI();
    }
    if(t&&t.name==="hosting_type"){if(t.value!=="hostinger"){const r=$("#project-form [name=hosting_plan_id]");if(r)r.checked=false;}renderHostingPlans($("#project-form [name=hosting_plan_id]:checked")?.value||"");}
    if(t&&t.name==="hosting_plan_locked"&&t.checked){
      const ht=$("#project-form [name=hosting_type]")?.value||"cloudflare";
      const plan=$("#project-form [name=hosting_plan_id]:checked")?.value||"";
      if(ht==="hostinger"&&!plan){t.checked=false;toast("Elige primero el plan de hosting para poder fijarlo.");}
    }
  });
  $$("#project-form [name=domain_value_locked]").forEach(p=>p.addEventListener("change",()=>{if(p.checked&&!String($("#project-form [name=domain]")?.value||"").trim())p.checked=false;}));
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
  $("#clients-grid")?.addEventListener("click",e=>{const t=e.target;const id=t.dataset.openClient;if(id){openClient(id);return;}if(t.dataset.clientMenuBtn){document.querySelectorAll(".card-menu-pop").forEach(p=>{p.hidden=true;});const pop=t.closest(".client-card-menu")?.querySelector(".card-menu-pop");if(pop)pop.hidden=!pop.hidden;return;}if(t.dataset.deleteClient){deleteClient(t.dataset.deleteClient);return;}});
  document.addEventListener("click",e=>{if(!e.target.closest(".card-menu-pop")&&!e.target.closest("[data-client-menu-btn]"))document.querySelectorAll(".card-menu-pop").forEach(p=>{p.hidden=true;});});
  $("#client-detail-projects")?.addEventListener("click",e=>{const t=e.target,id=t.dataset.openProject;if(id)openProject(id);if(t.dataset.restoreProject)restoreArchivedProject(t.dataset.restoreProject);if(t.dataset.deleteProject)deleteProjectPermanently(t.dataset.deleteProject);});
  $("#client-detail-actions")?.addEventListener("click",e=>{if(e.target.dataset.openClients)setView("clients");});
  $("#client-detail-back")?.addEventListener("click",()=>setView("clients"));
  $("#client-detail-new-project")?.addEventListener("click",()=>{const client=clientById(state.currentClient);if(!client)return;state.currentSetup=null;setProjectForm({user_id:client.id,project_stage:"Invitación",status:"Pendiente de activar cuenta",site_visibility:"hidden",total_price:750,deposit_amount:375,balance_amount:375,payment_method:"Transferencia"});$("#project-setup-admin-content").innerHTML="<span>Sin configuración.</span>";$("#project-brief-admin-content").innerHTML="<span>Sin información.</span>";$("#project-files-admin").innerHTML="<span>No hay archivos.</span>";$("#project-modal").showModal();});
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
  $("#user-rows")?.addEventListener("click",async e=>{
    const t=e.target;
    if(t.dataset.openUserPermissions){openUserPermissions(t.dataset.openUserPermissions);return;}
    if(t.dataset.toggleUser){
      const u=userByEmail(t.dataset.toggleUser);
      if(u) await toggleUser(u.email,!u.activo);
      return;
    }
    if(t.dataset.deleteUser){await removeUser(t.dataset.deleteUser);return;}
    if(t.dataset.grantUser){await grantUser(t.dataset.grantUser,t.dataset.grantRol);return;}
  });
  $("#user-rows")?.addEventListener("change",async e=>{
    const t=e.target;
    if(t.dataset.userEmail) await changeUserRole(t.dataset.userEmail,t.value);
  });
  $("#user-permissions-form")?.addEventListener("submit",saveUserPermissions);
  $$('[data-close-user-permissions]').forEach(b=>b.addEventListener("click",()=>$("#user-permissions-modal").close()));
  $("#crm-token-form")?.addEventListener("submit",saveSettingsToken);
  $("#settings-token-verify")?.addEventListener("click",verifySettingsToken);
  $("#settings-github-refresh")?.addEventListener("click",()=>{setLine("#settings-github-status-line","");loadGithubQuota();});
  $("#settings-token-show")?.addEventListener("change",e=>{$("#settings-token-input").type=e.target.checked?"text":"password";});
  $("#dashboard-token-banner")?.addEventListener("click",()=>setView("settings"));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshCrmLive().catch(err=>console.error("crm visibility refresh",err));});
  window.addEventListener("pagehide",stopCrmRealtime);

  (async()=>{if(!portal.configured){setLine("#crm-login-status","El CRM no está disponible en este momento.","error");return;}const {data:{session}}=await db.auth.getSession();await showSession(session);db.auth.onAuthStateChange((_e,s)=>{showSession(s||null);});})().catch(err=>{console.error(err);setLine("#crm-login-status","No pudimos cargar el CRM.","error");});
})();
