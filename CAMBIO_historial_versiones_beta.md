# Cambio: historial de versiones beta del editor

## Objetivo
Permitir recuperar una publicación reciente completa como borrador y volverla a publicar con seguridad.

## Alcance
- Historial privado de publicaciones por proyecto.
- Recuperación de HTML, páginas y medios administrados por el editor.
- Retención de siete días y máximo cuarenta publicaciones.
- Limpieza segura de R2.
- Sin cambios a la tienda ITM ni al demo.

## Regla de restauración
Recuperar no altera la web pública. Sólo prepara un borrador.
La web cambia únicamente cuando la persona confirma «Publicar cambios».

## Correcciones obligatorias
1. Restaurar medios archivados desde R2 antes de volver a publicar.
2. Restaurar el conjunto exacto de páginas y retirar páginas posteriores sólo al publicar.
3. Eliminar versiones al vencer expires_at, no siete días después.
4. Rechazar toda prueba HTTP del limpiador si falta su secreto.
5. No perder un respaldo si GitHub publicó pero Supabase falla al confirmar el estado.

## Criterio de terminado
Una publicación anterior recupera textos, páginas, fotos y videos correctos; no quedan páginas nuevas mezcladas; la versión expira correctamente; y el sitio público sólo cambia tras confirmar la publicación.

## Diseño técnico aprobado

### Alcance de una versión
Una versión recupera únicamente:
- Páginas administradas por el editor.
- Textos, secciones y configuración editable.
- Imágenes y videos administrados por el editor.

No intenta restaurar archivos técnicos ajenos al editor, como funciones, configuración, dependencias, robots.txt o cambios manuales de desarrollo.

### Datos persistentes
Supabase conserva:
- El índice de versiones.
- El índice de archivos de cada versión.
- El borrador actual.
- Un plan de restauración activo por proyecto.

R2 privado conserva:
- Un manifiesto JSON por versión.
- La copia de cada imagen y video administrado por el editor.

GitHub conserva:
- La versión pública que ve el visitante.

### Manifiesto de versión
Cada publicación debe conservar:
- Identificador de proyecto y versión.
- Lista completa de páginas administradas.
- HTML final de cada página.
- Lista completa de medios administrados.
- Ruta de cada medio, tipo, tamaño, hash y clave privada de R2.

No basta guardar solamente los medios nuevos: cada versión debe poder recuperar todos sus propios medios.

### Recuperar una versión
Recuperar no modifica GitHub ni la página pública.

El servidor:
1. Valida al usuario y el proyecto.
2. Lee el manifiesto privado en R2.
3. Guarda las páginas recuperadas como borrador.
4. Guarda un plan de restauración activo.
5. Marca como retirables las páginas administradas que existen hoy, pero no pertenecen a la versión recuperada.

El editor muestra exclusivamente las páginas de la versión recuperada.

### Publicar una restauración
Al confirmar Publicar, el servidor:
1. Lee el plan de restauración activo.
2. Verifica que pertenece al proyecto y a la versión seleccionada.
3. Recupera de R2 todos los medios del manifiesto.
4. Escribe esos medios en GitHub.
5. Escribe las páginas recuperadas.
6. Retira únicamente las páginas administradas posteriores.
7. Verifica el commit de GitHub.
8. Marca la versión como publicada y consume el plan de restauración.

Si falla antes de escribir en GitHub, no cambia el sitio público.
Si GitHub ya recibió cambios, el respaldo no se elimina: queda pendiente de confirmar o recuperar.

### Retención
- Máximo: 40 publicaciones recuperables por proyecto.
- Retención: 7 días desde expires_at.
- Borradores pendientes que no terminan: 24 horas.
- Las dos publicaciones más recientes quedan protegidas contra borrado manual.
- Al expirar, se borran archivos R2, índice de archivos y la versión queda marcada como eliminada.
- La expiración no borra el sitio público ni el proyecto.

### Seguridad
- R2 permanece privado.
- Pages usa un Worker puente autenticado con secreto.
- El Worker limpiador no acepta pruebas HTTP si CRON_TEST_SECRET no existe.
- El cron diario funciona sin exponer llaves de R2, Supabase o GitHub al navegador.

### Correcciones obligatorias
1. Crear client_editor_restore_plans para persistir una restauración pendiente.
2. Guardar todos los medios administrados en cada manifiesto.
3. Rehidratar medios desde R2 al publicar una restauración.
4. Retirar páginas posteriores sólo al confirmar Publicar.
5. Corregir limpieza: expires_at <= fecha actual.
6. Corregir el Worker para rechazar pruebas sin secreto.
7. Conservar el respaldo si GitHub publicó pero falla la confirmación en Supabase.

### Sincronización de páginas configuradas
client_projects.site_editor_pages es la fuente de páginas que el editor puede cargar y publicar.

Durante una recuperación:
- Antes de publicar, site_editor_pages no cambia.
- El editor muestra las rutas de snapshot_page_paths del plan activo.
- Al confirmar Publicar, el servidor escribe las páginas recuperadas, retira sólo páginas administradas posteriores y actualiza site_editor_pages con las rutas de la versión restaurada.
- Si la publicación falla, site_editor_pages conserva la lista actual.
- Una ruta histórica perteneciente al manifiesto puede restaurarse aunque ya no exista en la configuración actual; el servidor la acepta sólo si pertenece a la versión, al proyecto y al plan activo.

### Publicación atómica de una restauración

Una restauración no escribe archivos uno por uno mediante la API Contents.

El servidor usa la API Git Data de GitHub para:

1. Leer el commit y árbol actual de la rama publicada.
2. Crear blobs para todos los medios recuperados desde R2 y todas las páginas del manifiesto.
3. Crear un árbol nuevo basado en el árbol actual.
4. Incluir únicamente eliminaciones de páginas administradas que existían en `site_editor_pages` pero no pertenecen a la versión recuperada.
5. Crear un único commit con el árbol completo.
6. Actualizar la referencia de la rama con `force: false`.

Si GitHub rechaza el cambio de referencia, no se publica ningún archivo parcial.

Después de que GitHub acepte el único commit, el servidor:
1. Guarda el SHA del commit en la versión nueva.
2. Actualiza `client_projects.site_editor_pages` con las rutas de la versión recuperada.
3. Marca el plan como `completed`.

Si falla Supabase después de que GitHub ya aceptó el commit, nunca se borra el respaldo R2. El plan queda recuperable para completar la sincronización sin perder archivos.

### Limpieza segura de versiones

El limpiador usa `expires_at <= ahora`; la fecha de expiración ya se calcula al crear cada versión, por lo que no aplica una segunda espera de siete días.

Las versiones `pending` abandonadas se limpian tras 24 horas. Antes de borrar una versión, el limpiador consulta los planes de restauración y excluye cualquier versión asociada a un plan `draft`, `publishing` o `failed`.

El endpoint HTTP de prueba sólo funciona si `CRON_TEST_SECRET` existe y coincide exactamente. Sin secreto, devuelve 404 y no ejecuta ninguna limpieza.

### Corrección: revisión aislada de una restauración

Esta sección sustituye cualquier instrucción anterior que indicara guardar una recuperación en `client_site_repo_drafts` antes de publicar.

Una recuperación no modifica borradores normales. El manifiesto privado en R2 es la fuente temporal de las páginas y medios históricos; el plan de restauración sólo conserva versión, rutas, estado y datos de control.

Al recuperar:
1. El servidor valida la versión y crea un plan de revisión.
2. No inserta ni actualiza `client_site_repo_drafts`.
3. El editor obtiene las páginas exactas del manifiesto autorizado y sus medios usan URLs temporales firmadas.
4. Los borradores normales del usuario permanecen intactos.
5. Un plan `draft`, `publishing` o `failed` no puede ser sustituido por otra restauración.

Al cancelar:
1. El servidor elimina el plan activo.
2. No modifica borradores normales, GitHub, R2 ni el sitio publicado.
3. El editor descarta únicamente la vista histórica y vuelve a cargar el trabajo normal.

Al publicar una restauración:
1. El servidor valida el plan y el manifiesto.
2. Publica el commit único y atómico en GitHub.
3. Sólo después actualiza `site_editor_pages` y reemplaza los borradores normales por el estado publicado de la versión restaurada.
4. El plan conserva un identificador de operación y el SHA de GitHub para reanudar la sincronización si GitHub acepta el commit pero Supabase falla después.
5. Una repetición nunca debe crear un segundo commit de restauración para la misma operación.
