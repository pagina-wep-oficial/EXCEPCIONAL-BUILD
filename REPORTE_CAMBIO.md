# Reporte: panel sin recargas completas

## Qué cambió

- `portal.js` reemplaza el booleano de eventos pendientes por una cola agrupada
  por tabla y registro.
- La cola procesa el último cambio de cada proyecto o perfil después de una
  pausa de 350 ms, sin usar `location.reload()` para el panel.
- Al volver a enfocar `panel.html`, se consulta el estado actual de proyectos
  de manera silenciosa y se mantiene el documento abierto.
- Cada tarjeta incluye `data-project-id` y una firma de contenido; solo se
  sustituye si sus datos visibles cambiaron.
- La búsqueda, el scroll y las tarjetas sin cambios se conservan.

## Qué no cambió

- Supabase, tablas, políticas, API, permisos, autenticación y rutas.
- Los flujos de `proyecto.html`, `configurar.html` y editor conservan su
  comportamiento actual.

## Validación ejecutada

- `node --check portal.js`.
- `git diff --check`.
- Comprobación estática de cola, sincronización de visibilidad y ausencia de
  recarga del panel.

## Prueba manual pendiente

1. Abrir el panel y dejar una búsqueda escrita.
2. Modificar un proyecto desde otra sesión.
3. Confirmar que solo cambia su tarjeta y la búsqueda permanece intacta.
4. Cambiar de pestaña y volver; confirmar que no hay recarga completa.

## Panel adaptado a cliente y administración

- La búsqueda dice `Buscar mis páginas o direcciones` cuando solo hay proyectos
  propios; en una vista con proyectos de otras personas permite buscar también
  por cliente.
- `¿Necesitas otra página?` y el acceso móvil de nueva página aparecen solo
  para una cuenta con al menos un proyecto propio, fuera de la vista
  administrativa.
- Al ocultar ese acceso móvil, la barra inferior usa dos columnas y no deja un
  espacio vacío.
