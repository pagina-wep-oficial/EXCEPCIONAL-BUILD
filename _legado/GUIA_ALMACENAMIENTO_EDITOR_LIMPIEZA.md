# Guía: panel de almacenamiento del editor + limpieza de referencias del editor viejo

Estado de esta guía:

- No modifiqué el proyecto.
- Solo inspeccioné el código para dejarte los pasos exactos.
- El objetivo es:
  - dejar un solo editor visible: `editor-v2`
  - agregar un tab `Almacenamiento` por proyecto
  - ver cuánto ocupan las imágenes del editor en Supabase
  - permitir limpieza manual segura de candidatos

Importante:

- Esta guía está pensada para `project-admin.html`, que es donde hoy abre la administración del proyecto.
- `crm-local.html` tiene un modal viejo, pero por ahora no hace falta tocarlo para este flujo.

---

## 1. Cambiar la navegación de tabs del proyecto

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\project-admin.html`

Busca este bloque:

```html
<div class="project-sections-nav"><button class="project-tab active" type="button" data-project-tab="summary">Resumen</button><button class="project-tab" type="button" data-project-tab="content">Contenido</button><button class="project-tab" type="button" data-project-tab="files">Archivos</button><button class="project-tab" type="button" data-project-tab="client">Cliente</button><button class="project-tab" type="button" data-project-tab="publish">Publicación</button></div>
```

Reemplázalo por:

```html
<div class="project-sections-nav"><button class="project-tab active" type="button" data-project-tab="summary">Resumen</button><button class="project-tab" type="button" data-project-tab="content">Contenido</button><button class="project-tab" type="button" data-project-tab="files">Archivos</button><button class="project-tab" type="button" data-project-tab="storage">Almacenamiento</button><button class="project-tab" type="button" data-project-tab="client">Cliente</button><button class="project-tab" type="button" data-project-tab="publish">Publicación</button></div>
```

---

## 2. Agregar el nuevo panel `Almacenamiento`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\project-admin.html`

Busca este bloque:

```html
<section class="project-panel" data-project-panel="files"><div class="brief-admin"><div class="admin-section-title"><strong>Archivos del proyecto</strong><span id="project-files-count"></span></div><div class="admin-files" id="project-files-admin"><span>No hay archivos.</span></div></div></section>
```

Justo debajo agrega:

```html
<section class="project-panel" data-project-panel="storage"><div class="panel form-panel"><div class="storage-admin-head"><div><strong>Almacenamiento del editor</strong><p>Ve cuánto ocupan las imágenes del editor en Supabase y limpia archivos candidatos de forma manual.</p></div><div class="row-actions"><button class="button light small" type="button" id="project-storage-refresh">Analizar</button><button class="button light small" type="button" id="project-storage-delete-selected" disabled>Borrar seleccionados</button><button class="button danger small" type="button" id="project-storage-delete-unused" disabled>Borrar candidatos</button></div></div><p class="status-line" id="project-storage-line">Aquí verás el consumo del editor en Supabase y los candidatos a limpieza.</p><div class="storage-summary-grid" id="project-storage-summary"><article class="storage-stat-card"><span>Total en Supabase</span><strong>—</strong><small>Abre Analizar para revisar este proyecto.</small></article><article class="storage-stat-card"><span>En uso</span><strong>—</strong><small>Se llena al terminar el análisis.</small></article><article class="storage-stat-card"><span>Candidatos</span><strong>—</strong><small>Archivos sin referencias actuales.</small></article><article class="storage-stat-card"><span>Estado</span><strong>Sin análisis</strong><small>La limpieza manual se habilita solo cuando el análisis termina completo.</small></article></div><div class="brief-admin storage-files-box"><div class="admin-section-title"><strong>Archivos del editor</strong><span id="project-storage-count"></span></div><div class="storage-file-list" id="project-storage-list"><span>Abre este apartado y pulsa Analizar.</span></div></div></div></section>
```

---

## 3. Limpiar referencias visibles del editor viejo en `project-admin.html`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\project-admin.html`

### 3.1 Cambiar el texto del editor

Busca:

```html
<p id="project-editor-copy">Actívalo por tiempo y decide a qué editor entrará el cliente.</p>
```

Reemplázalo por:

```html
<p id="project-editor-copy">Actívalo por tiempo para que el cliente entre al editor de su sitio.</p>
```

### 3.2 Quitar la URL externa del editor

Busca este bloque y elimínalo completo:

```html
<label class="wide">URL del editor externo<input class="control" id="project-editor-url" type="url" placeholder="https://tu-editor.com/..."></label>
```

### 3.3 Cambiar el selector de modo para que ya no hable del editor anterior

Busca:

```html
<label>Modo editor<select class="control" id="project-site-editor-mode"><option value="html_repo">HTML real marcado</option><option value="sections">Editor anterior por secciones</option></select></label>
```

Reemplázalo por:

```html
<label>Fuente del editor<select class="control" id="project-site-editor-mode"><option value="html_repo">HTML real del sitio</option><option value="sections">Secciones del sitio</option></select></label>
```

### 3.4 Quitar el botón `Guardar URL`

Busca este botón y elimínalo:

```html
<button class="button light small" type="button" id="save-editor-url">Guardar URL</button>
```

---

## 4. Agregar estilos del panel de almacenamiento

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.css`

Ve al final del archivo y agrega este bloque completo:

```css
.storage-admin-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
.storage-admin-head p{margin:6px 0 0;color:var(--muted);font-size:12px}
.storage-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0 16px}
.storage-stat-card{border:1px solid var(--line);border-radius:18px;background:#fff;padding:14px 16px;display:grid;gap:6px}
.storage-stat-card span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.storage-stat-card strong{font:800 24px "Manrope";letter-spacing:-.04em;color:var(--ink)}
.storage-stat-card small{color:var(--muted);font-size:12px;line-height:1.45}
.storage-files-box{margin-top:0}
.storage-file-list{display:grid;gap:10px}
.storage-file-row{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:16px;background:#fff}
.storage-file-row.candidate{border-color:#f0c36d;background:#fffaf0}
.storage-file-row.used{border-color:#b9dfc8;background:#f5fcf7}
.storage-file-check{display:grid;place-items:center}
.storage-file-check input{width:16px;height:16px}
.storage-file-main{min-width:0;display:grid;gap:5px}
.storage-file-title{display:flex;align-items:center;gap:8px;min-width:0}
.storage-file-title strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.storage-file-meta{display:flex;flex-wrap:wrap;gap:8px 14px;color:var(--muted);font-size:12px}
.storage-file-meta span{display:inline-flex;align-items:center;gap:4px}
.storage-file-actions{display:flex;align-items:center;gap:8px}
.storage-pill{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800}
.storage-pill.used{background:#def5e5;color:#167c42}
.storage-pill.candidate{background:#ffe7b0;color:#9a6200}
.storage-empty{color:var(--muted);font-size:13px}
@media(max-width:980px){.storage-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:700px){.storage-admin-head{flex-direction:column}.storage-admin-head .row-actions{width:100%;display:grid;grid-template-columns:1fr}.storage-admin-head .row-actions .button{width:100%}.storage-summary-grid{grid-template-columns:1fr}.storage-file-row{grid-template-columns:1fr}.storage-file-check{justify-content:flex-start}.storage-file-actions{justify-content:flex-start}}
```

---

## 5. Cambiar `editorLaunchHref` para que siempre use `editor-v2`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\portal.js`

Busca esta función:

```js
function editorLaunchHref(project) {
  const external=String(project?.editor_launch_url||"").trim();
  if(external) return external;
  return `editor-v2.html?project=${encodeURIComponent(project.id)}`;
}
```

Reemplázala por:

```js
function editorLaunchHref(project) {
  return `editor-v2.html?project=${encodeURIComponent(project.id)}`;
}
```

Resultado:

- el portal ya no intentará abrir un editor externo
- el flujo visible queda con un solo editor

---

## 6. Quitar la ruta demo vieja del editor en `portal.js`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\portal.js`

### 6.1 Eliminar `initEditor`

Busca desde:

```js
async function initEditor() {
```

hasta el `}` que cierra esa función, y borra la función completa.

### 6.2 Quitar la llamada en `start()`

Busca:

```js
else if(page==="editor")await initEditor();
```

Elimínala.

Resultado:

- desaparece la ruta demo vieja del portal
- ya no quedan llamadas al editor anterior desde `portal.js`

---

## 7. Preparar el estado nuevo en `crm.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Busca esta línea:

```js
const state={session:null,rol:null,prospects:[],trash:[],clients:[],projects:[],requests:[],users:[],settings:[],currentProject:null,currentProspect:null,currentClient:null,hostingPlans:[],currentSetup:null};
```

Reemplázala por:

```js
const state={session:null,rol:null,prospects:[],trash:[],clients:[],projects:[],requests:[],users:[],settings:[],currentProject:null,currentProspect:null,currentClient:null,hostingPlans:[],currentSetup:null,projectStorageAudit:{},projectStorageBusy:{}};
```

---

## 8. Agregar helpers para el panel de almacenamiento

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Debajo de:

```js
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
```

agrega:

```js
const fmtDateTime=(v)=>v?new Intl.DateTimeFormat("es-MX",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(v)):"—";
const fmtBytes=(v)=>{const bytes=Number(v||0);if(!Number.isFinite(bytes)||bytes<=0)return"0 B";const units=["B","KB","MB","GB","TB"];let size=bytes,idx=0;while(size>=1024&&idx<units.length-1){size/=1024;idx++;}const digits=size>=100||idx===0?0:(size>=10?1:2);return`${size.toFixed(digits)} ${units[idx]}`;};
```

Ahora, debajo de:

```js
function updateProjectSummary(){
```

y antes de:

```js
function setProjectTab(name="summary"){
```

agrega este bloque completo:

```js
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
    if(meta.sectionsDraft)out.push(`Secciones borrador (${meta.sectionsDraft})`);
    if(meta.sectionsPublished)out.push(`Secciones publicadas (${meta.sectionsPublished})`);
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
      let pageVersions=[];

      try{
        const repoResult=await db.from("client_site_repo_drafts").select("page_path,edited_html,original_html,elements,updated_at,published_at").eq("project_id",project.id);
        if(repoResult.error)throw repoResult.error;
        repoDrafts=repoResult.data||[];
      }catch(err){
        warnings.push("No se pudieron revisar los borradores del modo repo.");
        console.error("storage repo drafts",err);
      }

      try{
        const pagesResult=await db.from("client_site_pages").select("id").eq("project_id",project.id);
        if(pagesResult.error)throw pagesResult.error;
        const pageIds=(pagesResult.data||[]).map(row=>row.id).filter(Boolean);
        if(pageIds.length){
          const versionsResult=await db.from("client_site_page_versions").select("page_id,version_kind,content_json,updated_at").in("page_id",pageIds);
          if(versionsResult.error)throw versionsResult.error;
          pageVersions=versionsResult.data||[];
        }
      }catch(err){
        warnings.push("No se pudo revisar el modo por secciones.");
        console.error("storage section versions",err);
      }

      const refMeta=new Map();
      const register=(bucket,value)=>{
        const hits=collectStorageRefsFromValue(value,new Map());
        hits.forEach((count,path)=>{
          const current=refMeta.get(path)||{repoDraft:0,sectionsDraft:0,sectionsPublished:0};
          current[bucket]=(current[bucket]||0)+count;
          refMeta.set(path,current);
        });
      };

      repoDrafts.forEach(row=>{
        register("repoDraft",row.edited_html);
        register("repoDraft",row.original_html);
        register("repoDraft",row.elements||{});
      });
      pageVersions.forEach(row=>{
        register(row.version_kind==="published"?"sectionsPublished":"sectionsDraft",row.content_json||{});
      });

      const files=(await listProjectStorageObjects(project.id)).map(file=>{
        const meta=refMeta.get(file.path)||{repoDraft:0,sectionsDraft:0,sectionsPublished:0};
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
```

---

## 9. Hacer que el tab `Almacenamiento` cargue el análisis

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Busca esta función:

```js
function setProjectTab(name="summary"){
  const projectId=state.currentProject?.id||$("#project-form")?.elements?.id?.value||"new";
  try{ localStorage.setItem(projectTabKey(projectId),name); }catch{}
  $$("[data-project-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.projectTab===name));
  $$("[data-project-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.projectPanel===name));
}
```

Reemplázala por:

```js
function setProjectTab(name="summary"){
  const projectId=state.currentProject?.id||$("#project-form")?.elements?.id?.value||"new";
  try{ localStorage.setItem(projectTabKey(projectId),name); }catch{}
  $$("[data-project-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.projectTab===name));
  $$("[data-project-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.projectPanel===name));
  if(name==="storage")ensureProjectStorageAudit();
}
```

---

## 10. Cambiar `updateEditorAdminUI` para quitar la lógica de URL externa

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Busca la función completa:

```js
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
    badge.className="badge orange";
    badge.textContent="Vencido";
    status.textContent="Editor vencido";
    dates.textContent=access.ends?`Venció el ${fmtDate(access.ends)}.`:"El acceso del editor ya no está activo.";
    copy.textContent="Puedes reactivarlo con un nuevo periodo cuando el cliente quiera volver a editar.";
    return;
  }
  badge.className="badge";
  badge.textContent="No activo";
  status.textContent="No activo";
  dates.textContent="Todavía no tiene acceso al editor.";
  copy.textContent="Actívalo por tiempo y decide a qué editor entrará el cliente.";
}
```

Reemplázala por:

```js
function updateEditorAdminUI(project){
  const badge=$("#project-editor-badge"),status=$("#project-editor-status"),dates=$("#project-editor-dates"),copy=$("#project-editor-copy");
  if(!badge||!status||!dates||!copy)return;
  const access=editorState(project);
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
    copy.textContent="El cliente ya puede entrar al editor de su sitio.";
    return;
  }
  if(access.status==="expired"){
    badge.className="badge orange";
    badge.textContent="Vencido";
    status.textContent="Editor vencido";
    dates.textContent=access.ends?`Venció el ${fmtDate(access.ends)}.`:"El acceso del editor ya no está activo.";
    copy.textContent="Puedes reactivarlo con un nuevo periodo cuando el cliente quiera volver a editar.";
    return;
  }
  badge.className="badge";
  badge.textContent="No activo";
  status.textContent="No activo";
  dates.textContent="Todavía no tiene acceso al editor.";
  copy.textContent="Actívalo por tiempo para que el cliente entre al editor de su sitio.";
}
```

---

## 11. Eliminar `saveEditorLaunchUrl`

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

### 11.1 Borrar la función

Busca:

```js
async function saveEditorLaunchUrl(){
```

y elimina esa función completa.

### 11.2 Borrar el event listener

Busca:

```js
$("#save-editor-url")?.addEventListener("click",saveEditorLaunchUrl);
```

Elimínalo.

---

## 12. Resetear el panel de almacenamiento al cargar un proyecto

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Busca dentro de `setProjectForm(project)` esta parte:

```js
setProjectTab(savedTab);updateProjectSummary();updateProjectLifecycleUI(project);updateEditorAdminUI(project);updateConfigUI();renderHostingPlans(project.id?state.currentSetup?.hosting_plan_id||"":"");resetPublishPanel(project);
```

Reemplázala por:

```js
setProjectTab(savedTab);updateProjectSummary();updateProjectLifecycleUI(project);updateEditorAdminUI(project);resetProjectStoragePanel(project);updateConfigUI();renderHostingPlans(project.id?state.currentSetup?.hosting_plan_id||"":"");resetPublishPanel(project);
```

---

## 13. Agregar listeners del panel de almacenamiento

Mismo archivo:

`C:\Users\manuel\Downloads\planes-publicacion\crm.js`

Busca esta zona al final, donde están los listeners del editor:

```js
$$("[data-editor-activate]").forEach(b=>b.addEventListener("click",()=>activateEditorAccess(Number(b.dataset.editorActivate),Number(b.dataset.editorPrice))));
$("#save-editor-repo")?.addEventListener("click",saveEditorRepoConfig);
$("#cancel-editor-access")?.addEventListener("click",cancelEditorAccess);
```

Déjala así:

```js
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
```

---

## 14. Qué debe hacer el análisis

Cuando termines los pasos anteriores, el tab `Almacenamiento` quedará así:

- lista archivos dentro de `site-images/<project_id>/...`
- revisa referencias en:
  - `client_site_repo_drafts`
  - `client_site_page_versions`
- marca cada archivo como:
  - `En uso`
  - `Candidato`
- solo habilita borrado cuando el análisis fue completo

Eso es importante:

- si falla revisar alguna fuente, la limpieza queda deshabilitada
- así no borras archivos cuando el análisis está incompleto

---

## 15. Prueba manual recomendada

Haz esta prueba:

1. Abre un proyecto real en `project-admin.html`.
2. Entra al tab `Almacenamiento`.
3. Pulsa `Analizar`.
4. Debes ver:
   - total usado
   - archivos en uso
   - candidatos
   - lista de archivos
5. Ve al editor y reemplaza una imagen.
6. Publica.
7. Regresa al tab `Almacenamiento`.
8. Pulsa `Analizar` otra vez.
9. La imagen nueva debe quedar `En uso`.
10. La vieja debería aparecer como `Candidato` si ya no tiene referencias.
11. Borra solo un candidato.
12. Verifica que la página siga mostrando la imagen nueva.

También prueba esto:

1. Desde el portal del cliente, pulsa `Abrir editor`.
2. Debe abrir siempre `editor-v2.html?project=...`
3. Ya no debe haber flujo a editor externo.

---

## 16. Si algo falla

Si te falla uno de estos puntos:

- `client_site_repo_drafts` no existe
- `client_site_pages` / `client_site_page_versions` no existen
- `db.storage.from("site-images").list(...)` no devuelve datos
- no deja borrar aunque seas admin

entonces no sigas con la limpieza todavía.

En ese caso dime exactamente:

- qué paso estabas haciendo
- qué mensaje salió
- qué línea o bloque pegaste

y yo te doy el siguiente ajuste mínimo.
