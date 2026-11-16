# Reporte de navegación demo Casa Nopal

## Alcance

La demostración conserva el recorrido elegido con `catalog=commerce` o `catalog=external_catalog`.

## Resultado técnico

- Selector, panel, proyecto, editor, Administración y sitio público comparten navegación.
- Tienda conserva carrito y pedidos demo.
- Catálogo no muestra carrito ni pedidos.
- Los datos locales de cada recorrido permanecen separados.
- Administración está disponible desde ambos recorridos.
- Los formularios con cambios sin guardar conservan su confirmación existente.
- No se incorporaron servicios reales, credenciales ni datos de clientes.

## Validaciones

- Sintaxis de JavaScript: correcta.
- `git diff --check`: correcto.
- Publicación: se registra al terminar el deploy.
- Reversión: restaurar los archivos desde `backup/demo-navegacion-fase1-*` y `backup/demo-navegacion-fase2-*`, después eliminar `demo-navigation.js`.
