# Navegación de demo Casa Nopal

## Fase 1 — Rutas base

- Fuente única: `catalog=commerce` o `catalog=external_catalog`.
- Tienda y Catálogo conservan sus datos separados en el navegador.
- Los enlaces internos mantienen el recorrido elegido.
- Respaldo: `backup/demo-navegacion-fase1-continuacion-20261116-145929`.
- Reversión: restaurar esos archivos y eliminar `demo-navigation.js`.

## Fase 2 — Navegación visible y móvil

- Panel móvil: Elegir demo, Abrir proyecto y Salir.
- Proyecto móvil: Mi demo, Abrir página y Salir.
- Sitio público: barra fija con Mi proyecto, tipo Tienda/Catálogo y menú compacto.
- El menú incluye Cambiar recorrido, Crear cuenta y Salir de la demo.
- Administración queda disponible en ambos recorridos.
- Editor y Administración mantienen su enlace visible a Mi proyecto.
- Los avisos de cambios sin guardar no se modificaron.
- Respaldo: `backup/demo-navegacion-fase2-20261116-150544`.

## Fase 3 — Validación y publicación

- Validación estática completada: 2026-11-16T15:08:51-06:00.
- Se verificó sintaxis JavaScript, rutas centrales, navegación móvil, menú público y acceso a Administración en ambos recorridos.
- Pruebas manuales pendientes tras despliegue: Tienda, Catálogo, retornos, Editor, Administración y cambios sin guardar.
