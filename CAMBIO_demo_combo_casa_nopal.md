# Demo Casa Nopal: presentación + Tienda base o Catálogo

## Solicitud
Actualizar y publicar una única demostración completa de Casa Nopal: elección
Tienda/Catálogo, presentación, proyecto, editor y administración. Sin Solo página,
Tienda completa, inventario avanzado, pagos, API Keys ni equipo. WhatsApp abre
mensajes [DEMO], nunca los envía automáticamente. Cambios guardados por navegador.

## Aislamiento
- Base remota: 04e46682f1de2b1b41a43e13b00baaf1a6d74a65.
- Rama: cambio/demo-combo-casa-nopal; carpeta excepcional-demo-combo.
- Respaldo privado: ../respaldos/excepcional-antes-demo-combo-20261114-120613/.
- La carpeta Exepcional build contiene cambios ajenos y permanece intacta.
- Se importan solo demo, imágenes y estilos necesarios. El CSS del editor demo
  se aísla como demo-editor-shell.css; no se modifica el editor de clientes.

## Diseño e impacto
Estado común versionado por navegador con dos catálogos aislados, monedas
compartidas y datos personales/carrito/pedidos demo separados de servicios reales.
Migración no destructiva de claves v2; editor de presentación compartido.
Adaptador DemoCasaNopal conserva presentación, opiniones, ubicación y perfil;
recursos visuales de Fonda no contienen su conexión al backend ni el editor UI.
Administración y galería se adaptan a medios locales/URLs y precios por producto.

## Bloques verificables
1. Respaldo y worktree desde main: completado.
2. Estado, migración, validación y operaciones aisladas por catálogo.
3. Render público, carrito, historial, WhatsApp, perfil y editor compartido.
4. Administración, monedas, categorías, unidades, medios y cambios sin guardar.
5. Entrada única y diseño publicado de Fonda.
6. Sintaxis, pruebas automáticas y staging sin archivos privados o SQL.
7. Publicación en el proyecto Pages existente y verificación HTTP.

## Publicación
Revisión del usuario en el sitio publicado, sin pedirle pruebas locales.
La cuenta propietaria de Excepcional Build quedó autorizada mediante OAuth en el
perfil separado `excepcional-demo`, sin reemplazar la sesión de Fonda. El script
verifica cuenta y proyecto existentes antes de publicar. No hay migraciones SQL
ni cambios en APIs o Fonda.
