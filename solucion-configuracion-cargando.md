# Solucion: `Cargando...` en Configurar pagina

Si en `cotizar.html` solo ves:

- `Proyecto`
- `Cargando...`
- `Precio acordado`
- `—`
- `Pago`
- `—`

entonces el formulario no termino de cargar. En este caso, casi siempre el problema esta en Supabase, no en el HTML.

## Causa mas probable

`portal.js` intenta leer:

- `client_projects`
- `client_project_setup`
- `client_hosting_plans`

Si `client_projects` o `client_project_setup` no son visibles para la sesion actual, la pantalla se queda en ese estado.

## Lo que debes revisar en Supabase

Abre `Supabase > SQL Editor` y revisa el proyecto con el `id` que aparece en la URL.

### 1) Ver si el proyecto ya pertenece al cliente

```sql
select id, name, user_id, project_stage, address_type, hosting_type, domain, site_visibility
from public.client_projects
where id = 'e380900b-fcb7-4c1a-a17e-9bc6908e6757';
```

### 2) Ver si existe la configuracion del cliente

```sql
select project_id, user_id, address_type, site_name, domain, domain_owned, hosting_type, completed_at, updated_at
from public.client_project_setup
where project_id = 'e380900b-fcb7-4c1a-a17e-9bc6908e6757';
```

## Que debe pasar

- `client_projects.user_id` debe ser el mismo usuario que usa el cliente en el portal.
- `client_project_setup.user_id` debe ser igual al mismo usuario, o al menos existir para ese proyecto.

Si `user_id` en `client_projects` es `null`, el cliente no tiene permiso para leer el proyecto y `cotizar.html` no termina de cargar.

## Si esta en `null`

Tienes dos opciones:

### Opcion A: usar la invitacion normal

- Reclama el proyecto desde el flujo de invitacion.
- Eso llena `user_id` automaticamente.
- Luego vuelve a abrir `cotizar.html`.

### Opcion B: corregirlo manualmente en Supabase

Solo si ya sabes que ese proyecto debe pertenecer a ese cliente.

```sql
update public.client_projects
set user_id = 'UUID_DEL_CLIENTE'
where id = 'e380900b-fcb7-4c1a-a17e-9bc6908e6757';

update public.client_project_setup
set user_id = 'UUID_DEL_CLIENTE'
where project_id = 'e380900b-fcb7-4c1a-a17e-9bc6908e6757';
```

## Si el proyecto ya tiene user_id pero sigue igual

Entonces revisa:

- que el cliente haya iniciado sesion con esa misma cuenta;
- que no sea otro proyecto distinto;
- que la fila de `client_project_setup` exista para ese `project_id`.

## Lo importante

Esto no se arregla cambiando texto en el HTML. Si la fila no se puede leer por RLS, la pagina no pasa de `Cargando...`.

