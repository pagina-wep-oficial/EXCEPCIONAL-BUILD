# Editor de imagen - tanda unica

## Diagnostico real

El editor de imagen actual ya existe, pero hoy funciona como una herramienta de recorte y reemplazo, no como un editor amigable.

Archivos reales involucrados:

- [editor-v2.html](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.html>)
- [editor-v2.css](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.css>)
- [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js>)
- [site-view.js](<C:/Users/manuel/Downloads/planes-publicacion/site-view.js>)

Lo que hace hoy:

- abre una modal de imagen;
- permite mover y hacer zoom;
- guarda una nueva imagen en `site-images`;
- actualiza el campo de la pagina;
- cierra la modal al terminar.

Lo que esta mal:

- el guardado exporta un JPG recortado;
- la imagen vieja se borra;
- no hay rotacion real;
- en movil, el gesto de dos dedos no es confiable si el navegador no entrega bien los pointer events;
- el flujo no conserva la imagen original como respaldo.

---

## Por que pasa

En `editor-v2.js` la funcion `applyPhotoEdit()`:

- calcula un recorte;
- dibuja ese recorte en un canvas;
- crea un nuevo JPG;
- lo sube a `site-images`;
- reemplaza la URL en el draft;
- y borra el archivo anterior.

Por eso al guardar ves:

- recorte;
- perdida de la imagen anterior;
- y una experiencia tecnica, no visual.

Ademas:

- `photoFitMode()` usa `cover` para casi todo menos `gallery`;
- eso hace que la salida visual tienda a recortar;
- y `openPhotoEditor()` no tiene controles claros de zoom/rotacion para usuarios simples.

---

## Objetivo correcto

El usuario debe poder:

1. abrir una imagen;
2. ajustarla con controles simples;
3. ver el cambio sin perder la original;
4. guardar;
5. volver al editor sin sentir que se rompio algo.

Si quieres que no recorte al guardar, el cambio real no es solo visual:

- hay que dejar de guardar una imagen rasterizada nueva como unico resultado;
- hay que guardar tambien la configuracion del ajuste.

---

## Tanda unica: que archivos tocar

### 1) `editor-v2.html`

Archivo:

- [editor-v2.html](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.html:103>)

Que debes hacer:

- dejar la modal como `Ajustar imagen`;
- mantener `Cancelar` y `Guardar`;
- agregar controles claros para usuario comun:
  - zoom `-`
  - zoom `+`
  - rotar izquierda
  - rotar derecha
  - o un slider de zoom si no quieres botones extra

No dependas solo de gesto con dos dedos.

---

### 2) `editor-v2.css`

Archivo:

- [editor-v2.css](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.css:505>)

Que debes hacer:

- aplicar `touch-action: none` tambien al `canvas`, no solo al contenedor;
- dejar el area de ajuste clara en movil;
- si agregas barra de herramientas, darle espacio suficiente;
- no rehacer el diseño entero.

Este punto es importante porque el gesto de dos dedos puede fallar si el navegador sigue interpretando la interaccion como gesto nativo.

---

### 3) `editor-v2.js`

Archivos y funciones:

- `openPhotoEditor()` -> [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1343>)
- `renderPhotoStage()` -> [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1281>)
- `applyPhotoEdit()` -> [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1395>)
- `closePhotoEditor()` -> [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1389>)
- eventos tactiles -> [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1579>)

Que debes cambiar:

- abrir la modal solo como editor, no como recorte tecnico;
- mostrar el estado actual de la imagen al entrar;
- agregar controles de zoom/rotacion visibles;
- dejar de depender solo del pinch;
- al guardar, no borrar la original automaticamente;
- si quieres cierre inmediato, que `closePhotoEditor()` ocurra solo cuando ya se guardo bien;
- si quieres que el usuario siga ajustando, no cierres la modal y solo refresca la vista previa.

La parte clave es esta:

- hoy `applyPhotoEdit()` genera un archivo nuevo y eso recorta;
- si quieres comportamiento pro, guarda el ajuste como metadata del elemento y no como una imagen nueva.

---

### 4) `site-view.js`

Archivo:

- [site-view.js](<C:/Users/manuel/Downloads/planes-publicacion/site-view.js>)

Que debes hacer si quieres solucion real:

- leer la metadata del ajuste;
- renderizar la imagen con esa configuracion;
- no depender solo de la URL nueva.

Hoy `site-view.js` solo pinta la URL de la imagen.

Si solo cambias `editor-v2.js`, seguiras teniendo una imagen nueva recortada.

---

## Flujo que yo te recomiendo

### Opcion corta

Si quieres arreglar lo minimo:

- mantener el modal abierto hasta que la subida termine;
- quitar el borrado automatico del archivo viejo;
- agregar botones de zoom y rotacion;
- dejar el pinch como extra, no como unica forma.

### Opcion correcta

Si quieres que el editor quede bien de verdad:

- guardar en el draft la URL original;
- guardar aparte la configuracion del ajuste;
- hacer que el sitio lea esa configuracion;
- no exportar un JPG nuevo cada vez.

La opcion correcta es mas trabajo, pero es la que evita el recorte destructivo.

---

## Orden de trabajo

1. `editor-v2.html`
2. `editor-v2.css`
3. `editor-v2.js`
4. `site-view.js`

Primero dejas la experiencia utilizable.
Luego cambias el modelo para que el ajuste no recorte la imagen original.

---

## Resultado esperado

Cuando termines, el usuario debe poder:

- tocar la imagen;
- verla en una ventana clara;
- moverla, acercarla y rotarla;
- guardar sin perder la original;
- volver al editor sin una experiencia rota.
