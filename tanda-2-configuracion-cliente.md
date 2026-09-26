# Tanda 2 - Configuracion del cliente sincronizada con Administracion

Objetivo: que `cotizar.html` respete lo que configuraste desde Administracion:

- Si admin eligio direccion, el cliente la ve preseleccionada.
- Si admin bloqueo tipo de direccion, el cliente no cambia entre gratis/dominio.
- Si admin bloqueo dominio escrito, el cliente no cambia el dominio.
- Si admin eligio hosting/plan, el cliente lo ve.
- Si admin bloqueo hosting, el cliente no cambia el alojamiento.
- El resumen calcula creacion + dominio + hosting.
- No tocar invitaciones, pagos, URLs publicadas, etapas ni editor.

Antes de empezar: si ya ejecutaste Tanda 1 en Supabase, primero ejecuta otra vez la funcion corregida `client_project_setup_guard()` de Tanda 1. El trigger anterior no protegia `domain_owned`, precios del dominio ni `domain_verified_at`.

---

## Paso 1 - `cotizar.html`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\cotizar.html`

Reemplaza desde:

```html
    <section class="setup-section"><div class="setup-heading"><span class="setup-number">1</span>
```

hasta antes de:

```html
    <button class="button button-primary button-wide button-large" type="submit">
```

por este bloque:

```html
    <section class="setup-section">
      <div class="setup-heading"><span class="setup-number">1</span><div><h2>Direccion de tu pagina</h2><p>Elige como quieres que la gente abra tu sitio.</p></div></div>
      <p class="setup-lock-note" id="domain-type-lock-note" hidden>Esta parte ya fue acordada con el equipo.</p>
      <div class="choice-cards-mobile setup-choice-grid">
        <label class="choice-card-mobile"><input type="radio" name="address_type" value="gratis" checked><span class="choice-check">✓</span><strong>Enlace gratuito</strong><code>tunegocio.pages.dev</code><small>Sin costo anual. Ideal para empezar rapido.</small></label>
        <label class="choice-card-mobile"><input type="radio" name="address_type" value="dominio"><span class="choice-check">✓</span><strong>Dominio personalizado</strong><code>tunegocio.com</code><small>Mas profesional. Puede tener costo anual.</small></label>
      </div>

      <div class="name-check-card" id="domain-config-card">
        <p class="setup-lock-note" id="domain-value-lock-note" hidden>El dominio ya fue fijado por el equipo.</p>
        <label><span id="setup-name-label">Nombre para tu enlace</span><div class="inline-field"><input id="setup-name" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Ej. abarroteslupita"><button class="button button-light" id="setup-check" type="button">Verificar</button></div></label>
        <p class="field-help" id="setup-name-help">Quedara como abarroteslupita.pages.dev</p>
        <label class="owned-domain-check" id="owned-domain-wrap" hidden><input id="setup-domain-owned" type="checkbox"> <span>Ya tengo este dominio y quiero usarlo</span></label>
        <div id="setup-domain-prices" class="mini-price-grid" hidden><div><span>Primer año</span><strong id="setup-domain-first">—</strong></div><div><span>Renovacion</span><strong id="setup-domain-renew">—</strong></div></div>
        <p class="form-status" id="setup-domain-status"></p>
      </div>
    </section>

    <section class="setup-section">
      <div class="setup-heading"><span class="setup-number">2</span><div><h2>Alojamiento</h2><p>Elige donde vivira tu pagina. Si ya lo acordamos, aparecera marcado aqui.</p></div></div>
      <p class="setup-lock-note" id="hosting-lock-note" hidden>Este alojamiento ya fue acordado con el equipo.</p>
      <div class="choice-cards-mobile setup-choice-grid">
        <label class="choice-card-mobile"><input type="radio" name="hosting_type" value="cloudflare" checked><span class="choice-check">✓</span><strong>Alojamiento incluido</strong><small>Sin costo anual para paginas informativas normales.</small></label>
        <label class="choice-card-mobile"><input type="radio" name="hosting_type" value="hostinger"><span class="choice-check">✓</span><strong>Plan Hostinger</strong><small>Para proyectos que necesitan hosting contratado.</small></label>
        <label class="choice-card-mobile"><input type="radio" name="hosting_type" value="propio"><span class="choice-check">✓</span><strong>Ya tengo hosting</strong><small>Nos contactaremos contigo para conectarlo.</small></label>
      </div>
      <div class="hosting-plan-list" id="setup-hosting-plans" hidden></div>
      <label id="special-note-wrap" hidden><span>Notas sobre alojamiento o dominio</span><textarea name="special_features_note" rows="3" placeholder="Ej. ya tengo Hostinger, despues les mando los accesos por WhatsApp."></textarea></label>
    </section>

    <section class="setup-summary"><p class="eyebrow">Resumen</p><h2>Asi comenzara tu proyecto</h2><div id="setup-summary-lines"></div><p class="setup-note">Si elegiste servicios con renovacion, el costo anual aparecera separado para que no se mezcle con la creacion de tu pagina.</p></section>
```

---

## Paso 2 - `portal.js`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\portal.js`

Reemplaza completa la funcion:

```js
  async function initConfigure() {
```

hasta justo antes de:

```js
  const briefFields=
```

por este bloque:

```js
  async function initConfigure() {
    const {session}=await loadContext(); const id=getParam("project"); if(!id){location.replace("panel.html");return;}
    const [{data:project,error},{data:setup,error:setupErr},{data:plans,error:plansErr}]=await Promise.all([
      db.from("client_projects").select("*").eq("id",id).single(),
      db.from("client_project_setup").select("*").eq("project_id",id).maybeSingle(),
      db.from("client_hosting_plans").select("*").eq("active",true).order("sort_order",{ascending:true})
    ]);
    if(error||setupErr) throw error||setupErr;
    if(plansErr) console.warn("No se pudieron cargar planes de hosting",plansErr);
    if(archivedClientState(project)||stageIndex(project)>=2){ location.replace(`proyecto.html?id=${encodeURIComponent(id)}`); return; }
    $("#configure-back").href=`proyecto.html?id=${encodeURIComponent(id)}`; $("#configure-mobile-back").href=`proyecto.html?id=${encodeURIComponent(id)}`;
    let savingSetup=false;
    startLiveUpdates(`portal-configure-${id}`,[{table:"client_projects",filter:`id=eq.${id}`},{table:"client_project_setup",filter:`project_id=eq.${id}`}],async()=>{if(!savingSetup)location.reload();});

    const form=$("#setup-form"), input=$("#setup-name"), checkBtn=$("#setup-check");
    const hostingPlans=plans||[];
    let verifiedValue="", domainPrice=null, selectedPlanId=setup?.hosting_plan_id||"";
    const initialAddress=setup?.address_type||project.address_type||"gratis";
    const initialHosting=setup?.hosting_type||project.hosting_type||"cloudflare";
    const lockType=Boolean(setup?.domain_type_locked), lockValue=Boolean(setup?.domain_value_locked), lockHosting=Boolean(setup?.hosting_plan_locked);

    function selectRadio(name,value){const radio=form.querySelector(`[name="${name}"][value="${value}"]`); if(radio)radio.checked=true;}
    function currentPlan(){return hostingPlans.find(p=>p.id===selectedPlanId)||null;}
    function planSnapshot(plan){return plan?{hosting_plan_id:plan.id,hosting_plan_name:plan.name,hosting_plan_features:plan.features||[],hosting_first_year:Number(plan.first_year||0),hosting_renewal:Number(plan.renewal||plan.first_year||0),hosting_currency:plan.currency||"MXN"}:{hosting_plan_id:null,hosting_plan_name:null,hosting_plan_features:[],hosting_first_year:null,hosting_renewal:null,hosting_currency:"MXN"};}
    function setupDomainValue(){
      if(initialAddress==="dominio") return setup?.domain||(/\.pages\.dev$/.test(project.domain||"")?"":project.domain||"");
      return setup?.site_name||String(project.domain||"").replace(/\.pages\.dev$/,"");
    }
    function addressType(){return form.querySelector('[name="address_type"]:checked')?.value||"gratis";}
    function hostingType(){return form.querySelector('[name="hosting_type"]:checked')?.value||"cloudflare";}
    function applyLocks(){
      $$('[name="address_type"]',form).forEach(el=>el.disabled=lockType);
      $("#setup-domain-owned").disabled=lockType||lockValue;
      input.disabled=lockValue;
      checkBtn.disabled=lockValue;
      $$('[name="hosting_type"]',form).forEach(el=>el.disabled=lockHosting);
      $$('[name="hosting_plan_id"]',form).forEach(el=>el.disabled=lockHosting);
      $("#domain-type-lock-note").hidden=!lockType;
      $("#domain-value-lock-note").hidden=!lockValue;
      $("#hosting-lock-note").hidden=!lockHosting;
    }
    function renderHostingPlans(){
      const box=$("#setup-hosting-plans");
      const show=hostingType()==="hostinger";
      box.hidden=!show;
      if(!show){selectedPlanId="";box.innerHTML="";return;}
      if(!hostingPlans.length){box.innerHTML=`<p class="empty-inline">El equipo aun no cargo planes. Puedes continuar y lo confirmamos por WhatsApp.</p>`;return;}
      box.innerHTML=hostingPlans.map(plan=>{
        const checked=plan.id===selectedPlanId?"checked":"";
        const disabled=lockHosting?"disabled":"";
        const features=Array.isArray(plan.features)?plan.features:[];
        return `<label class="hosting-plan-card"><input type="radio" name="hosting_plan_id" value="${safe(plan.id)}" ${checked} ${disabled}><span><b>${safe(plan.name)}</b><small>${safe(plan.description||"")}</small><em>Primer año ${money(plan.first_year)} · Renovacion ${money(plan.renewal||plan.first_year)}</em>${features.length?`<ul>${features.slice(0,4).map(f=>`<li>${safe(f)}</li>`).join("")}</ul>`:""}</span></label>`;
      }).join("");
    }
    function selectedDomainPrice(){
      if(domainPrice)return {first:(domainPrice.first_period_price??domainPrice.price)/100,renew:(domainPrice.price??domainPrice.first_period_price)/100};
      if(setup?.domain_first_year!=null)return {first:Number(setup.domain_first_year||0),renew:Number(setup.domain_renewal||setup.domain_first_year||0)};
      return {first:null,renew:null};
    }
    function renderSetupSummary(){
      const domain=addressType()==="dominio", host=hostingType();
      const name=domain?(normalizeDomain(input.value)||"Dominio por elegir"):(normalizeSiteName(input.value)?`${normalizeSiteName(input.value)}.pages.dev`:"Enlace por elegir");
      const dp=selectedDomainPrice(), plan=currentPlan()||setup;
      const hostingFirst=host==="hostinger"?Number(plan?.hosting_first_year??plan?.first_year??0):0;
      const hostingRenew=host==="hostinger"?Number(plan?.hosting_renewal??plan?.renewal??plan?.first_year??0):0;
      const creation=Number(project.total_price||0);
      const firstTotal=creation+Number(dp.first||0)+hostingFirst;
      const renewalTotal=Number(dp.renew||0)+hostingRenew;
      const hostingLabel=host==="propio"?"El cliente ya tiene hosting":host==="hostinger"?(plan?.hosting_plan_name||plan?.name||"Plan Hostinger por elegir"):"Incluido";
      const lines=[["Creacion de tu pagina",money(creation)||"Acordado"],["Direccion",name],["Alojamiento",hostingLabel],["Total inicial estimado",money(firstTotal)]];
      if(domain&&dp.first!=null){lines.splice(3,0,["Dominio primer año",money(dp.first)],["Renovacion dominio",money(dp.renew)]);}
      if(host==="hostinger"){lines.splice(lines.length-1,0,["Hosting primer año",money(hostingFirst)],["Renovacion hosting",money(hostingRenew)]);}
      if(renewalTotal>0)lines.push(["Renovacion anual estimada",money(renewalTotal)]);
      $("#setup-summary-lines").innerHTML=lines.map(([a,b])=>`<div><span>${safe(a)}</span><strong>${safe(b)}</strong></div>`).join("");
    }
    function updateSetupUI(){
      const domain=addressType()==="dominio", host=hostingType();
      $("#setup-name-label").textContent=domain?"Dominio para tu pagina":"Nombre para tu enlace";
      input.placeholder=domain?"Ej. abarroteslupita.com":"Ej. abarroteslupita";
      $("#setup-name-help").textContent=domain?"Puedes escribir tunegocio.com o solo tunegocio.":"Quedara como tunegocio.pages.dev";
      $("#owned-domain-wrap").hidden=!domain;
      $("#special-note-wrap").hidden=host==="cloudflare";
      if(!domain) $("#setup-domain-owned").checked=false;
      if((host==="hostinger"||host==="propio")&&addressType()==="gratis"&&!lockType){
        selectRadio("address_type","dominio"); verifiedValue=""; domainPrice=null; input.value="";
        $("#setup-domain-prices").hidden=true; setStatus("#setup-domain-status","Este alojamiento necesita dominio personalizado.");
      }
      renderHostingPlans(); applyLocks(); renderSetupSummary(); scheduleSetupSave();
    }
    async function saveSetup({final=false}={}){
      const isDomain=addressType()==="dominio", current=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
      const plan=hostingType()==="hostinger"?(currentPlan()||setup):null;
      const payload={project_id:id,user_id:session.user.id,address_type:isDomain?"dominio":"gratis",hosting_type:hostingType(),special_features_note:String(form.elements.special_features_note.value||"").trim()||null,domain_owned:isDomain&&$("#setup-domain-owned").checked,...planSnapshot(plan)};
      if(verifiedValue&&verifiedValue===current){
        if(isDomain){payload.domain=current;payload.site_name=null;}else{payload.site_name=current;payload.domain=null;}
        const dp=selectedDomainPrice(); if(isDomain&&dp.first!=null){payload.domain_first_year=dp.first;payload.domain_renewal=dp.renew;}
        if(final)payload.domain_verified_at=setup?.domain_verified_at||new Date().toISOString();
      }
      savingSetup=true;
      const {error:saveErr}=await db.from("client_project_setup").upsert(payload,{onConflict:"project_id"});
      savingSetup=false;
      if(saveErr)throw saveErr;
    }
    let setupAutosaveTimer=null;
    const scheduleSetupSave=()=>{clearTimeout(setupAutosaveTimer);setupAutosaveTimer=setTimeout(async()=>{try{await saveSetup();const st=$("#setup-status");st.textContent="Configuracion guardada automaticamente.";st.className="form-status success";setTimeout(()=>{if(st.textContent==="Configuracion guardada automaticamente.")st.className="form-status";},2500);}catch(_){/* el envio final muestra errores */}},900);};
    window.addEventListener("pagehide",()=>{clearTimeout(setupAutosaveTimer);});

    selectRadio("address_type",initialAddress);
    selectRadio("hosting_type",initialHosting);
    form.elements.special_features_note.value=setup?.special_features_note||"";
    $("#setup-domain-owned").checked=Boolean(setup?.domain_owned);
    input.value=setupDomainValue();
    if(input.value)verifiedValue=initialAddress==="dominio"?normalizeDomain(input.value):normalizeSiteName(input.value);
    if(setup?.domain_first_year!=null)domainPrice={first_period_price:Number(setup.domain_first_year)*100,price:Number(setup.domain_renewal||setup.domain_first_year)*100,currency:"MXN"};

    $$('[name="address_type"], [name="hosting_type"]',form).forEach(el=>el.addEventListener("change",updateSetupUI));
    $("#setup-hosting-plans").addEventListener("change",e=>{if(e.target?.name==="hosting_plan_id"){selectedPlanId=e.target.value;renderSetupSummary();scheduleSetupSave();}});
    input.addEventListener("input",()=>{if(lockValue)return;verifiedValue="";domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status","");renderSetupSummary();scheduleSetupSave();});
    $("#setup-domain-owned").addEventListener("change",()=>{verifiedValue="";domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status","");renderSetupSummary();scheduleSetupSave();});
    checkBtn.addEventListener("click",async()=>{
      const isDomain=addressType()==="dominio", value=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
      if(!value){setStatus("#setup-domain-status",isDomain?"Escribe un dominio valido, por ejemplo tunegocio.com.":"Escribe un nombre corto sin espacios ni simbolos.","error");return;}
      if(isDomain && $("#setup-domain-owned").checked){verifiedValue=value;domainPrice=null;$("#setup-domain-prices").hidden=true;setStatus("#setup-domain-status",`Usaremos ${value}. Despues confirmaremos contigo como conectarlo.`,"success");renderSetupSummary();scheduleSetupSave();return;}
      checkBtn.disabled=true;setStatus("#setup-domain-status","Comprobando...");
      const result=await checkName(value,isDomain); checkBtn.disabled=false;
      if(result.availability==="taken"){verifiedValue="";setStatus("#setup-domain-status",`${isDomain?value:`${value}.pages.dev`} ya esta en uso. Prueba otro nombre.`,"error");return;}
      verifiedValue=value; domainPrice=isDomain?result.price:null;
      if(isDomain&&domainPrice){const first=(domainPrice.first_period_price??domainPrice.price)/100,renew=(domainPrice.price??domainPrice.first_period_price)/100;$("#setup-domain-first").textContent=money(first);$("#setup-domain-renew").textContent=money(renew);$("#setup-domain-prices").hidden=false;}
      setStatus("#setup-domain-status",`${isDomain?value:`${value}.pages.dev`} esta disponible.`,"success");renderSetupSummary();scheduleSetupSave();
    });
    form.addEventListener("submit",async e=>{
      e.preventDefault(); const isDomain=addressType()==="dominio", current=isDomain?normalizeDomain(input.value):normalizeSiteName(input.value);
      if(!current){setStatus("#setup-status","Primero escribe el nombre de tu pagina.","error");return;}
      if(!verifiedValue||verifiedValue!==current){setStatus("#setup-status","Pulsa Verificar para confirmar el nombre antes de continuar.","error");return;}
      if((hostingType()==="hostinger"||hostingType()==="propio")&&!isDomain){setStatus("#setup-status","Este alojamiento necesita dominio personalizado.","error");return;}
      if(hostingType()==="hostinger"&&hostingPlans.length&&!selectedPlanId){setStatus("#setup-status","Elige un plan de hosting.","error");return;}
      const button=form.querySelector('button[type="submit"]');button.disabled=true;setStatus("#setup-status","Guardando tu configuracion...");
      try{
        await saveSetup({final:true});
        const {error:applyErr}=await db.rpc("client_apply_project_setup",{p_project_id:id});if(applyErr)throw applyErr;
        setStatus("#setup-status","Listo. Ahora necesitamos la informacion de tu negocio.","success");location.assign(`proyecto.html?id=${encodeURIComponent(id)}#informacion`);
      }catch(err){setStatus("#setup-status",friendlyError(err,"No pudimos guardar la configuracion."),"error");button.disabled=false;}
    });
    updateSetupUI();
  }
```

---

## Paso 3 - `portal.css`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\portal.css`

Agrega este bloque despues de `.owned-domain-check...`:

```css
.setup-choice-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.setup-lock-note{margin:0 0 10px;padding:9px 11px;border-radius:12px;background:#fff7df;color:#705018;font-size:10px;font-weight:800}
.choice-card-mobile:has(input:disabled),.hosting-plan-card:has(input:disabled),.name-check-card:has(input:disabled){opacity:.72;cursor:not-allowed}
.hosting-plan-list{display:grid;gap:9px;margin-top:12px}
.hosting-plan-card{position:relative;display:grid!important;grid-template-columns:auto 1fr;gap:10px!important;padding:14px;border:1px solid var(--line);border-radius:16px;background:#fff;color:var(--ink)!important;cursor:pointer}
.hosting-plan-card:has(input:checked){border-color:rgba(16,42,36,.38);background:#eff4ee;box-shadow:0 0 0 2px rgba(16,42,36,.04)}
.hosting-plan-card input{width:18px!important;height:18px!important;min-height:18px;margin-top:2px}
.hosting-plan-card b{display:block;font:800 14px "Manrope"}
.hosting-plan-card small{display:block;margin-top:3px;color:var(--muted);font-size:10px!important;line-height:1.45}
.hosting-plan-card em{display:block;margin-top:7px;color:#355047;font-style:normal;font-size:10px;font-weight:900}
.hosting-plan-card ul{margin:8px 0 0;padding-left:16px;color:var(--muted);font-size:10px;line-height:1.55}
@media (max-width:760px){.setup-choice-grid{grid-template-columns:1fr}.inline-field{grid-template-columns:1fr}.inline-field .button{width:100%}}
```

---

## Paso 4 - `supabase-schema.sql`

Archivo:

`C:\Users\manuel\Downloads\planes-publicacion\supabase-schema.sql`

Reemplaza completa la funcion `client_apply_project_setup(p_project_id uuid)` por esta:

```sql
create or replace function public.client_apply_project_setup(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_setup public.client_project_setup%rowtype;
begin
  if v_user is null then raise exception 'Debes iniciar sesión.'; end if;

  select s.* into v_setup
  from public.client_project_setup s
  join public.client_projects p on p.id = s.project_id
  where s.project_id = p_project_id
    and (s.user_id = v_user or s.user_id is null)
    and (p.user_id = v_user or p.user_id is null)
    and coalesce(p.project_stage, 'Invitación') in ('Invitación','Configuración','Cotización','Aprobación','Información')
  order by s.user_id is null
  limit 1;

  if not found then raise exception 'No se encontró la configuración de este proyecto.'; end if;

  if v_setup.hosting_type in ('hostinger','propio') and v_setup.address_type <> 'dominio' then
    raise exception 'Este alojamiento requiere dominio personalizado.';
  end if;

  if v_setup.address_type = 'gratis' and nullif(trim(coalesce(v_setup.site_name,'')), '') is null then
    raise exception 'Falta el nombre del enlace gratuito.';
  end if;

  if v_setup.address_type = 'dominio' and nullif(trim(coalesce(v_setup.domain,'')), '') is null then
    raise exception 'Falta el dominio personalizado.';
  end if;

  update public.client_project_setup
  set user_id = coalesce(user_id, v_user),
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where project_id = p_project_id and (user_id = v_user or user_id is null);

  update public.client_projects
  set user_id = coalesce(user_id, v_user),
      address_type = v_setup.address_type,
      domain = case
        when v_setup.address_type = 'gratis' then nullif(trim(v_setup.site_name), '') || '.pages.dev'
        else nullif(trim(v_setup.domain), '')
      end,
      hosting_type = v_setup.hosting_type,
      setup_completed_at = coalesce(setup_completed_at, now()),
      project_stage = case when project_stage in ('Invitación','Configuración','Cotización','Aprobación') then 'Información' else project_stage end,
      status = case when project_stage in ('Invitación','Configuración','Cotización','Aprobación') then 'Configuración lista · completa la información de tu negocio' else status end,
      updated_at = now()
  where id = p_project_id and (user_id = v_user or user_id is null);

  return p_project_id;
end;
$$;

revoke all on function public.client_apply_project_setup(uuid) from public;
grant execute on function public.client_apply_project_setup(uuid) to authenticated;
```

Despues ejecutas esta funcion en Supabase junto con la funcion corregida del trigger.

---

## Paso 5 - Verificacion

Ejecuta:

```powershell
cd C:\Users\manuel\Downloads\planes-publicacion
node --check portal.js
git diff --check
```

Si pasa:

```powershell
git add cotizar.html portal.js portal.css supabase-schema.sql
git commit -m "Mejora configuracion cliente con bloqueos y hosting"
git push
```

Luego en Supabase SQL Editor:

1. Ejecuta la funcion corregida `client_project_setup_guard()`.
2. Ejecuta la funcion nueva `client_apply_project_setup()`.

Pruebas en produccion:

1. Admin: abre un proyecto sin cliente, elige `dominio`, escribe dominio, bloquea tipo/dominio y guarda.
2. Cliente: entra a configuracion. Debe ver dominio prellenado y bloqueado.
3. Admin: elige `hostinger`, selecciona plan, bloquea hosting y guarda.
4. Cliente: debe ver plan marcado y no editable.
5. Cliente: guardar y continuar debe pasar a `proyecto.html#informacion`.
6. Proyecto en administracion debe conservar `address_type`, `domain`, `hosting_type`, URLs, pagos y etapa.

Si `node --check portal.js` falla, casi seguro es por comillas en la linea del `querySelector` indicada en el Paso 2.
