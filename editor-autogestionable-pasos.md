# Checklist manual del editor autogestionable

## Antes de empezar

1. Abre [editor-autogestionable-manual.sql](/C:/Users/manuel/Downloads/planes-publicacion/editor-autogestionable-manual.sql).
2. Entra a Supabase SQL Editor.
3. Ejecuta ese archivo una sola vez.

Eso agrega a `client_projects` estos campos:

- `editor_enabled`
- `editor_access_status`
- `editor_access_starts_at`
- `editor_access_ends_at`
- `editor_plan_months`
- `editor_price_mxn`
- `editor_launch_url`

## Lo que ya hace el portal

- Si no hay acceso activo, el cliente ve planes.
- Si el acceso esta activo, el cliente ve `Abrir editor`.
- Si el acceso ya vencio, el cliente ve `Tu acceso al editor expiro`.
- Si llenas `editor_launch_url`, `Abrir editor` abre tu herramienta externa.
- Si no llenas `editor_launch_url`, `Abrir editor` abre `editor.html`.

## Flujo manual completo

### Caso 1: el cliente paga

1. Busca el `project_id` del proyecto.
2. Decide que plan compro:
   - `1 mes`
   - `3 meses`
   - `6 meses`
   - `12 meses`
3. En Supabase ejecuta el bloque de activacion correspondiente en [editor-autogestionable-manual.sql](/C:/Users/manuel/Downloads/planes-publicacion/editor-autogestionable-manual.sql).
4. Si el editor real vive en otro sitio tuyo, llena `editor_launch_url`.
5. Si ese otro sistema necesita cuenta, creala alla tambien.

Resultado:

- el cliente entra a su proyecto
- desaparecen los planes
- aparece `Abrir editor`

### Caso 2: el cliente usa tu editor interno temporal

No llenes `editor_launch_url`.

Resultado:

- `Abrir editor` manda a `editor.html?project=ID`

### Caso 3: el cliente usa tu editor externo real

1. Crea su cuenta en tu otro sistema.
2. Copia su URL de entrada.
3. Guarda esa URL en `editor_launch_url`.

Resultado:

- `Abrir editor` manda a tu herramienta externa

### Caso 4: el cliente cancela

1. Ejecuta el bloque `Cancelar y quitar acceso inmediato`.
2. Si usas un editor externo, quitale acceso alla tambien.

Resultado:

- desaparece `Abrir editor`
- vuelven a salir los planes

### Caso 5: el tiempo se vencio

Si no haces nada:

- el portal detecta que `editor_access_ends_at` ya paso
- deja de mostrar `Abrir editor`
- muestra estado vencido

Si quieres dejarlo ordenado tambien en la base:

1. Ejecuta el bloque `Marcar como vencido manualmente`.

### Caso 6: el cliente renueva

1. Cobra.
2. Ejecuta otra vez el bloque del nuevo plan.
3. Si usas editor externo y el acceso ya no existe, vuelvelo a crear.

Resultado:

- reaparece `Abrir editor`

## Lo que tienes que guardar por cada cliente

- nombre del proyecto
- `project_id`
- plan comprado
- monto cobrado
- fecha de activacion
- fecha de vencimiento
- si usa `editor.html` o `editor_launch_url`

## Regla simple para trabajar sin errores

1. Cobra.
2. Activa en Supabase.
3. Si aplica, crea acceso en el editor externo.
4. Verifica en el portal que aparezca `Abrir editor`.
5. Si cancela o vence, quita acceso.
