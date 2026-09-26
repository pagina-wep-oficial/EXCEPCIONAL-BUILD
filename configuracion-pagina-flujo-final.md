# Configuracion pagina - flujo final cliente + administracion

Objetivo: convertir `Configurar pagina` en un flujo guiado de preguntas para el cliente, conectado con Administracion. El cliente no debe ver una pantalla tecnica; debe responder decisiones simples. Administracion debe seguir siendo directa y rapida para que tu puedas prellenar o bloquear datos.

No romper base actual. Usar los campos existentes:

- `address_type`: `gratis` o `dominio`
- `domain_owned`: `false` o `true`
- `site_name`
- `domain`
- `domain_first_year`
- `domain_renewal`
- `domain_verified_at`
- `hosting_type`: `cloudflare`, `hostinger`, `propio`
- `hosting_plan_id`
- `hosting_plan_name`
- `hosting_plan_features`
- `hosting_first_year`
- `hosting_renewal`
- `hosting_currency`
- `special_features_note`
- `domain_type_locked`
- `domain_value_locked`
- `hosting_plan_locked`

---

## Resultado visual esperado

### Cliente - `cotizar.html`

El cliente ve un flujo de 2 pasos:

1. Direccion
2. Alojamiento

Al final ve un resumen y pulsa `Guardar y continuar`.

No debe sentirse como formulario largo. Debe sentirse como:

`elige una opcion -> responde lo necesario -> confirma -> siguiente paso`

---

## Paso 1 - Direccion

Pregunta:

`Como quieres que se abra tu pagina?`

Opciones visibles:

1. `Enlace gratuito`
2. `Dominio personalizado`
3. `Ya tengo un dominio`

### Opcion A - Enlace gratuito

Campos:

- input `Nombre para tu enlace`
- preview: `tunegocio.pages.dev`
- boton `Verificar disponibilidad`
- boton `Usar este enlace`

Guarda internamente:

- `address_type = gratis`
- `site_name = nombre`
- `domain = null`
- `domain_owned = false`
- `domain_first_year = null`
- `domain_renewal = null`

Regla:

- Solo puede usarse con `hosting_type = cloudflare`.
- Si despues elige hosting de paga o hosting propio, este paso deja de ser valido.

### Opcion B - Dominio personalizado

Campos:

- input `Dominio que quieres`
- ejemplo: `tunegocio.com`
- boton `Verificar disponibilidad`
- mostrar precio primer ano
- mostrar renovacion anual
- boton `Elegir este dominio`

Hostinger:

- aqui si se puede llamar endpoint para disponibilidad/precio.
- el navegador nunca debe recibir token de Hostinger.
- usar endpoint propio tipo `/api/check-domain` o el endpoint actual equivalente si ya existe.

Guarda internamente:

- `address_type = dominio`
- `domain = dominio_normalizado`
- `site_name = null`
- `domain_owned = false`
- `domain_first_year = precio_primer_ano`
- `domain_renewal = precio_renovacion`
- `domain_verified_at = now()` al confirmar

### Opcion C - Ya tengo un dominio

Campos:

- input `Escribe tu dominio`
- nota opcional: `Cuéntanos algo sobre ese dominio`
- sin verificacion de precio
- mensaje: `Nos pondremos en contacto contigo por WhatsApp para conectarlo.`
- boton `Usar este dominio`

Guarda internamente:

- `address_type = dominio`
- `domain = dominio_normalizado`
- `site_name = null`
- `domain_owned = true`
- `domain_first_year = null`
- `domain_renewal = null`

---

## Paso 2 - Alojamiento

Pregunta:

`Donde vivira tu pagina?`

Opciones visibles:

1. `Alojamiento incluido`
2. `Plan de hosting`
3. `Ya tengo hosting`

### Opcion A - Alojamiento incluido

Uso:

- paginas informativas normales
- costo anual 0

Guarda:

- `hosting_type = cloudflare`
- limpiar plan:
- `hosting_plan_id = null`
- `hosting_plan_name = null`
- `hosting_first_year = null`
- `hosting_renewal = null`

Combinaciones validas:

- enlace gratuito + incluido
- dominio personalizado + incluido
- ya tengo dominio + incluido

### Opcion B - Plan de hosting

Uso:

- cuando el proyecto necesita hosting contratado
- mostrar tarjetas desde `client_hosting_plans`

Campos:

- lista de planes
- cada card muestra:
- nombre
- descripcion
- features
- precio primer ano
- renovacion anual

Guarda:

- `hosting_type = hostinger`
- `hosting_plan_id`
- `hosting_plan_name`
- `hosting_plan_features`
- `hosting_first_year`
- `hosting_renewal`
- `hosting_currency`

Regla critica:

- NO puede usarse con `address_type = gratis`.

Si el cliente eligio enlace gratuito y luego elige plan de hosting:

1. mostrar mensaje:

`Para usar un plan de hosting necesitas un dominio personalizado. El dominio tambien tiene renovacion anual.`

2. botones:

- `Elegir dominio personalizado`
- `Volver`

3. si pulsa `Elegir dominio personalizado`:

- seleccionar visualmente `Dominio personalizado`
- regresar al Paso 1
- conservar el plan de hosting elegido en memoria
- despues de confirmar dominio, volver automaticamente al Paso 2 con ese plan marcado

### Opcion C - Ya tengo hosting

Campos:

- nota opcional
- mensaje: `Nos pondremos en contacto contigo por WhatsApp para conectarlo.`

Guarda:

- `hosting_type = propio`
- limpiar plan hostinger
- guardar nota en `special_features_note`

Regla:

- NO puede usarse con `address_type = gratis`.
- requiere `Dominio personalizado` o `Ya tengo dominio`.

Si venia de enlace gratuito:

- mismo mensaje de correccion que plan de hosting.

---

## Combinaciones validas

```text
gratis + cloudflare = valido
dominio comprado + cloudflare = valido
dominio comprado + hostinger = valido
dominio comprado + propio = valido
dominio del cliente + cloudflare = valido
dominio del cliente + hostinger = valido
dominio del cliente + propio = valido
```

## Combinaciones invalidas

```text
gratis + hostinger = invalido
gratis + propio = invalido
```

---

## Administracion

En CRM no debe ser flujo de preguntas. Debe ser captura directa.

Apartado `Direccion`:

- selector/tarjetas:
- `Enlace gratuito`
- `Dominio personalizado`
- `Cliente ya tiene dominio`
- campo `Direccion`
- boton `Verificar`
- precio primer ano
- renovacion
- bloqueo `Fijar tipo de direccion`
- bloqueo `Fijar direccion escrita`

Apartado `Alojamiento`:

- selector:
- `Alojamiento incluido`
- `Plan de hosting`
- `Cliente ya tiene hosting`
- tarjetas de planes si es `Plan de hosting`
- nota interna/cliente si aplica
- bloqueo `Fijar alojamiento`

Administracion escribe en el mismo `client_project_setup`.

Si admin prellena algo:

- cliente lo ve ya escrito.
- si no esta bloqueado, puede cambiarlo.
- si esta bloqueado, aparece aviso:

`Esto ya fue acordado con el equipo. Si necesitas cambiarlo, escribenos por WhatsApp.`

---

## Mapa Administracion -> Cliente

```text
Admin elige Enlace gratuito
address_type = gratis
domain_owned = false
Cliente ve Enlace gratuito marcado

Admin elige Dominio personalizado
address_type = dominio
domain_owned = false
Cliente ve Dominio personalizado marcado

Admin elige Cliente ya tiene dominio
address_type = dominio
domain_owned = true
Cliente ve Ya tengo un dominio marcado

Admin elige Alojamiento incluido
hosting_type = cloudflare
Cliente ve Alojamiento incluido marcado

Admin elige Plan de hosting
hosting_type = hostinger
hosting_plan_id = plan
Cliente ve Plan de hosting marcado

Admin elige Cliente ya tiene hosting
hosting_type = propio
Cliente ve Ya tengo hosting marcado
```

---

## Archivos a modificar

### 1. `cotizar.html`

Cambiar la estructura actual de `setup-form`.

Debe quedar con:

- contenedor de pasos
- paso direccion
- paso alojamiento
- resumen final
- botones:
- `Volver`
- `Siguiente`
- `Guardar y continuar`

IDs recomendados:

```html
#setup-step-address
#setup-step-hosting
#setup-step-summary
#setup-address-options
#setup-hosting-options
#setup-name
#setup-check
#setup-domain-prices
#setup-hosting-plans
#setup-invalid-combo
#setup-summary-lines
```

### 2. `portal.js`

Rehacer `initConfigure()` para manejar estado guiado.

Estado recomendado:

```js
const configureState = {
  step: "address",
  addressChoice: "gratis", // gratis | dominio | owned-domain
  hostingChoice: "cloudflare", // cloudflare | hostinger | propio
  pendingHostingChoice: "",
  selectedPlanId: "",
  verifiedValue: "",
  domainPrice: null
};
```

Funciones necesarias:

```js
setStep(step)
addressChoice()
hostingChoice()
renderAddressFields()
renderHostingFields()
renderHostingPlans()
validateAddress()
validateHosting()
forceDomainForHosting()
buildSetupPayload({final})
saveSetup({final})
renderSetupSummary()
applyLocks()
```

Reglas importantes en `portal.js`:

- si `hostingChoice` es `hostinger` o `propio`, entonces `addressChoice` no puede ser `gratis`.
- si detecta combinacion invalida, no guardar final.
- si el usuario acepta corregir, moverlo a `Dominio personalizado`.
- conservar `selectedPlanId`.
- autosave solo si cambia la firma real del setup.
- no recargar por realtime cuando el cambio es el mismo autosave.

### 3. `portal.css`

Agregar estilos para:

- pasos activos/inactivos
- tarjetas de respuesta
- bloque de correccion por combinacion invalida
- cards de hosting
- resumen compacto
- estado bloqueado
- mobile

No cambiar todo el diseño. Mantener el estilo actual del portal.

### 4. `crm-local.html`

Ajustar el bloque de Administracion dentro del modal del proyecto:

- mantener campos existentes
- mejorar textos
- direccion con 3 opciones
- alojamiento con 3 opciones
- bloqueos visibles
- no convertirlo en preguntas

### 5. `project-admin.html`

Aplicar el mismo cambio que `crm-local.html`.

Debe quedar identico en el bloque de proyecto.

### 6. `crm.js`

Ajustar:

- `syncAddressRadios()`
- `applySetupToForm()`
- `updateConfigUI()`
- `saveProject()` o la funcion que arma `client_project_setup`
- `renderHostingPlans()`
- validacion:
- si `hosting_type` es `hostinger` o `propio`, `address_type` debe ser `dominio`
- si `hosting_type` es `hostinger` y `hosting_plan_locked` esta marcado, debe existir plan

No borrar compatibilidad con datos viejos.

### 7. `supabase-schema.sql`

Por ahora no cambiar estructura.

Solo confirmar que `client_apply_project_setup()` tenga esta regla:

```sql
if v_setup.hosting_type in ('hostinger','propio') and v_setup.address_type <> 'dominio' then
  raise exception 'Este alojamiento requiere dominio personalizado.';
end if;
```

Y confirmar que el check permita:

```sql
hosting_type in ('cloudflare','hostinger','propio')
```

---

## API Hostinger

### Dominio

Usar API solo para disponibilidad/precio de dominio.

Flujo:

```text
cliente escribe dominio
portal llama endpoint propio
endpoint consulta Hostinger
endpoint devuelve disponible + precio
portal muestra precio
```

El token nunca va al navegador.

Endpoint esperado:

```text
/api/check-domain?domain=tunegocio.com
```

Respuesta esperada:

```json
{
  "ok": true,
  "available": true,
  "first_year": 199,
  "renewal": 299,
  "currency": "MXN"
}
```

### Hosting

No depender del catalogo vivo de Hostinger para mostrar planes al cliente.

Usar:

```text
client_hosting_plans
```

Motivo:

- tu controlas que planes vendes
- tu controlas nombre/precio
- evitas que un cambio externo rompa el flujo

Despues se puede crear sincronizador manual/API.

---

## Orden de implementacion

1. Revisar `cotizar.html` actual y reemplazar solo `setup-form`.
2. Rehacer `initConfigure()` en `portal.js`.
3. Agregar estilos en `portal.css`.
4. Ajustar textos/opciones en `crm-local.html`.
5. Repetir mismo bloque en `project-admin.html`.
6. Ajustar logica de `crm.js`.
7. Ejecutar:

```powershell
node --check portal.js
node --check crm.js
git diff --check
```

8. Probar local/produccion.
9. Commit y push.

---

## Pruebas obligatorias

### Caso 1

`Enlace gratuito + Alojamiento incluido`

Debe:

- verificar `pages.dev`
- guardar
- pasar a informacion del negocio

### Caso 2

`Enlace gratuito + Plan de hosting`

Debe:

- mostrar bloqueo
- explicar que necesita dominio personalizado
- mandar a `Dominio personalizado`
- conservar plan elegido

### Caso 3

`Dominio personalizado + Plan de hosting`

Debe:

- verificar dominio
- mostrar precio dominio
- elegir plan
- mostrar total inicial y renovacion anual
- guardar

### Caso 4

`Ya tengo dominio + Ya tengo hosting`

Debe:

- pedir dominio
- pedir nota opcional
- no verificar precio
- guardar
- mostrar mensaje de contacto por WhatsApp

### Caso 5

Admin prellena y bloquea dominio.

Cliente debe:

- ver dominio ya escrito
- no poder cambiarlo
- poder continuar si lo demas esta completo

### Caso 6

Admin prellena hosting plan y bloquea.

Cliente debe:

- ver plan marcado
- no poder cambiar alojamiento
- guardar sin perder plan

---

## Resultado final esperado

El cliente solo responde preguntas simples.

Administracion controla los mismos datos de forma directa.

La base sigue usando `client_project_setup`.

Las reglas importantes quedan claras:

- hosting de paga requiere dominio personalizado
- hosting propio requiere dominio personalizado o dominio existente
- dominio gratis solo sirve con alojamiento incluido
- si admin bloquea algo, cliente lo ve pero no lo edita

