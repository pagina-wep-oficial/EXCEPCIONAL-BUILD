# Reporte: demo Casa Nopal

## Qué cambió
- Entrada `demo.html`: un combo con dos recorridos, Tienda y Catálogo.
- `demo-state.js`: estado v3 local, migración no destructiva de Tienda v2,
  catálogos aislados, monedas compartidas, validaciones y restablecimiento.
- `demo-media.js` y `demo-product-gallery.js`: archivos en IndexedDB, imágenes
  JPG/PNG/WebP hasta 5 MB, videos MP4/WebM hasta 25 MB, hasta cinco imágenes y un
  video por producto, URLs, reemplazo, eliminación, orden y medio principal.
- `demo-store-admin.*`: productos, configuración, categorías, unidades, monedas,
  comentarios y decisiones guardar/descartar/cancelar. Sin funciones avanzadas.
- `demo-casa-nopal/`: presentación y tienda pública ficticias, detalle, perfil,
  carrito e historial demo. Recursos visuales de Plastilina, navegación de vidrio,
  sombras, adaptación móvil y movimiento reducido de la apariencia de Fonda.
- `demo-editor*`: editor aislado para la presentación, con borrador, historial,
  publicación local y fotografías persistentes en IndexedDB.
- `demo-panel.*`, `demo-project.*`, `demo-workspace.html`: navegación del combo;
  enlaces antiguos con `mode=page` siguen entrando al combo.
- `index.html`: botón Probar demo, conservando las demás acciones.
- `scripts/publish-demo.mjs`: stage público limpio, comprobación de cuenta y
  proyecto existentes; excluye secretos, SQL, respaldos y documentación.

## Comportamiento y límites
Catálogo no permite carrito ni pedidos, tampoco entrando por sus rutas directas.
Su precio se oculta sin borrar valores; CTA, aviso, teléfono y visibilidad son
configurables. Tienda conserva WhatsApp base: abre un mensaje [DEMO], no lo envía
ni afirma que WhatsApp confirmó el pedido. Los pedidos guardan precios y monedas
históricos; un carrito no mezcla monedas. Cambiar de catálogo no borra datos.

Todo se guarda en el navegador del visitante. Los archivos no se suben al servidor.
Restablecer requiere confirmación y elimina solo el estado/medios de la demo;
las claves v2 y el almacenamiento ajeno se conservan. Una pestaña que detecta
cambios de otra debe actualizarse antes de escribir. No es un sistema multiusuario.
Mapas, recursos públicos y enlaces externos pueden usar sus respectivos servicios;
no existen peticiones a APIs reales de administración, clientes, ITM ni Fonda.

## Aislamiento y respaldo
Base remota: `04e46682f1de2b1b41a43e13b00baaf1a6d74a65`.
Rama: `cambio/demo-combo-casa-nopal`.
Carpeta: `/home/pancho/Documentos/PANCHO/excepcional-demo-combo`.
Respaldo privado: `/home/pancho/Documentos/PANCHO/respaldos/excepcional-antes-demo-combo-20261114-120613`.
La carpeta original con cambios pendientes permanece intacta. No se modificaron
funciones, SQL, credenciales, editor de clientes ni el sitio de Fonda.

## Validaciones ejecutadas
- `node --check` en todos los JavaScript demo y scripts de los HTML.
- `node /tmp/fonda-motion-validation/check-demo.mjs`: pruebas con jsdom y
  fake-indexeddb de ambos catálogos, migración, monedas, descuentos, precios
  ocultos, rutas, perfil, carrito mezclado, WhatsApp [DEMO], formularios sin
  guardar, MIME, IndexedDB, editor y fotografía persistente tras navegar.
- Análisis CSS con css-tree y verificación de recursos HTML locales.
- El arnés rechaza cualquier `fetch` de la demo; no se llamó a APIs reales.
- `node scripts/publish-demo.mjs --stage-only`: stage sin archivos privados.
- `npx --no-install wrangler pages functions build --outdir /tmp/excepcional-demo-functions-build`:
  funciones existentes compiladas correctamente, sin modificarlas.
- `git diff --check` y comprobación del contenido preparado antes del commit.

## Publicación y reversión
Proyecto existente: `excepcional-build`; rama de publicación: `main`.
Cuenta propietaria: `d197c3a221e755e9479ed6065ee16b3f`.
Perfil OAuth separado: `excepcional-demo`; la sesión de Fonda no se sustituye.
Comando: `node scripts/publish-demo.mjs`.
URL de revisión: https://excepcional-build.pages.dev/demo.html
Publicación previa: `d412dc3b-2a47-4067-bb22-589a57b8c6ee`.
Para revertir, restaurar esa publicación desde Pages > excepcional-build >
Deployments > Rollback. No hay migraciones de servidor que revertir.
El estado local v3 se mantiene aislado y no altera las claves antiguas.

## Revisión del usuario en la página publicada
1. Abrir demo.html y elegir Tienda; visitar presentación, panel, editor y tienda.
2. En Administrar tienda, crear un producto con imagen/video; editarlo, cambiar
   medio principal, reemplazar y eliminar medios; guardar y recargar.
3. Comprobar precio anterior mayor al actual y moneda por producto; intentar
   eliminar una moneda utilizada y mezclar monedas en el carrito: se rechaza.
4. Preparar un pedido demo: WhatsApp abre [DEMO] y no envía automáticamente.
5. Cambiar a Catálogo con un formulario pendiente: probar cancelar, descartar y
   guardar. Los productos de Tienda deben seguir guardados por separado.
6. Cambiar CTA/aviso/teléfono y visibilidad; comprobar detalle, precio oculto y
   ausencia de carrito/pedidos en presentación, perfil y rutas directas.
7. Editar una fotografía de presentación, publicar localmente y navegar: persiste.
8. Revisar en móvil y restablecer demo tras confirmar; no cambia ningún proyecto real.

La validación visual final del usuario se realiza en la URL publicada, no en local.
