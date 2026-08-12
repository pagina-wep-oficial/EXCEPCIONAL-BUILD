# Guia maestra del editor autogestionable

## Lo que ya esta hecho

Ya te deje el archivo paso a paso.

Esta aqui:

- [editor-autogestionable-pasos.md](/C:/Users/manuel/Downloads/planes-publicacion/editor-autogestionable-pasos.md)
- [editor-autogestionable-manual.sql](/C:/Users/manuel/Downloads/planes-publicacion/editor-autogestionable-manual.sql)

Tambien deje listo el portal para que:

- si llenas `editor_launch_url`, `Abrir editor` mande a tu herramienta externa
- si no lo llenas, use `editor.html` como base interna

Lo subi a `main` en el commit `0a84a34`.

## Tu orden de trabajo ahora

1. Ejecuta `editor-autogestionable-manual.sql` en Supabase.
2. Sigue `editor-autogestionable-pasos.md`.
3. Cuando un cliente pague, activas su proyecto con el bloque SQL del plan.
4. Si usaras otro sitio como editor real, llenas `editor_launch_url`.

## Paso 1. Ejecutar SQL en Supabase

Abre Supabase SQL Editor y ejecuta una sola vez:

- [editor-autogestionable-manual.sql](/C:/Users/manuel/Downloads/planes-publicacion/editor-autogestionable-manual.sql)

Ese archivo agrega estos campos en `client_projects`:

- `editor_enabled`
- `editor_access_status`
- `editor_access_starts_at`
- `editor_access_ends_at`
- `editor_plan_months`
- `editor_price_mxn`
- `editor_launch_url`

## Paso 2. Lo que ya hace el portal

- Si el proyecto no tiene acceso activo, el cliente ve los planes.
- Si el proyecto tiene acceso activo, el cliente ve `Abrir editor`.
- Si el tiempo ya vencio, el cliente ve `Tu acceso al editor expiro`.
- Si llenas `editor_launch_url`, `Abrir editor` manda a tu herramienta externa.
- Si no llenas `editor_launch_url`, `Abrir editor` manda a `editor.html`.

## Paso 3. Cuando un cliente pague

Haz esto:

1. Busca el `project_id`.
2. Mira que plan compro.
3. Pega en Supabase el bloque SQL del plan.
4. Si usara una herramienta externa, crea su acceso alla y llena `editor_launch_url`.

## SQL rapido por plan

### Activar 1 mes

```sql
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '1 month',
  editor_plan_months = 1,
  editor_price_mxn = 50
where id = 'PROJECT_ID_AQUI';
```

### Activar 3 meses

```sql
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '3 months',
  editor_plan_months = 3,
  editor_price_mxn = 140
where id = 'PROJECT_ID_AQUI';
```

### Activar 6 meses

```sql
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '6 months',
  editor_plan_months = 6,
  editor_price_mxn = 270
where id = 'PROJECT_ID_AQUI';
```

### Activar 12 meses

```sql
update client_projects
set
  editor_enabled = true,
  editor_access_status = 'activo',
  editor_access_starts_at = now(),
  editor_access_ends_at = now() + interval '12 months',
  editor_plan_months = 12,
  editor_price_mxn = 500
where id = 'PROJECT_ID_AQUI';
```

## Paso 4. Si usaras una herramienta externa

Haz esto manualmente:

1. Crea la cuenta del cliente en ese otro sitio.
2. Copia la URL de entrada del cliente.
3. Guardala en `editor_launch_url`.

Ejemplo:

```sql
update client_projects
set
  editor_launch_url = 'https://TU-SITIO-EDITOR.com/?project=PROJECT_ID_AQUI'
where id = 'PROJECT_ID_AQUI';
```

Si no vas a usar herramienta externa:

- no llenes `editor_launch_url`
- el portal abrira `editor.html?project=ID`

## Paso 5. Si el cliente cancela

Quita acceso inmediato con esto:

```sql
update client_projects
set
  editor_enabled = false,
  editor_access_status = 'cancelado'
where id = 'PROJECT_ID_AQUI';
```

Y si usas herramienta externa:

1. quitale acceso alla tambien

## Paso 6. Si el tiempo se vence

Si no haces nada:

- el portal detecta la fecha vencida
- desaparece `Abrir editor`
- aparecen planes otra vez

Si quieres dejarlo marcado manualmente:

```sql
update client_projects
set
  editor_enabled = false,
  editor_access_status = 'vencido',
  editor_access_ends_at = now()
where id = 'PROJECT_ID_AQUI';
```

## Paso 7. Si renueva

1. Cobras.
2. Ejecutas otra vez el SQL del plan nuevo.
3. Si usas herramienta externa y ya no tenia acceso, lo vuelves a crear.

## Paso 8. Como comprobar que si quedo

Despues de activar, revisa el proyecto del cliente:

- debe desaparecer la seccion de planes
- debe aparecer el boton `Abrir editor`

Si quieres revisar en SQL:

```sql
select
  id,
  name,
  editor_enabled,
  editor_access_status,
  editor_access_starts_at,
  editor_access_ends_at,
  editor_plan_months,
  editor_price_mxn,
  editor_launch_url
from client_projects
where id = 'PROJECT_ID_AQUI';
```

## Regla simple para no equivocarte

1. Cliente paga.
2. Tu activas en Supabase.
3. Si aplica, creas acceso en el editor externo.
4. Revisas que aparezca `Abrir editor`.
5. Si cancela o vence, quitas acceso.
