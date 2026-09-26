# Editor de imagen - guia adaptada al proyecto actual

## Lo que ya investigaste y es correcto

Tu prueba ya mostró 3 problemas reales del editor actual:

- `Guardar` solo exporta una imagen nueva y recorta;
- la imagen anterior se borra;
- el gesto de dos dedos no es suficiente ni confiable para usuarios normales.

Eso significa que el problema no es solo de interfaz.
El problema real es el modelo de guardado.

---

## La forma correcta para este proyecto

No conviene seguir guardando una foto nueva cada vez que el usuario ajusta.

Lo que sí conviene es esto:

1. El usuario abre la imagen.
2. La ajusta con controles visibles.
3. El editor guarda la configuracion del ajuste.
4. El sitio publico aplica esa configuracion al renderizar.
5. La imagen original sigue intacta.

Ese flujo evita:

- recorte destructivo;
- perdida del archivo original;
- dependencia total de pinch en movil.

---

## Archivos que vas a tocar

- [editor-v2.html](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.html>)
- [editor-v2.css](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.css>)
- [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js>)
- [site-view.js](<C:/Users/manuel/Downloads/planes-publicacion/site-view.js>)

No necesitas tocar Supabase para este MVP si guardas la configuracion dentro de `content_json`.

---

## Tanda unica de implementacion

### 1. `editor-v2.js`

Archivo:

- [editor-v2.js](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.js:1343>)

Que debes hacer:

- dejar `openPhotoEditor()` como punto de entrada de la modal;
- agregar estado de ajuste a la imagen, no solo `scale`, `tx` y `ty`;
- guardar tambien `rotation` y un modo de ajuste claro;
- quitar el borrado automatico de la imagen vieja;
- cambiar `applyPhotoEdit()` para que guarde metadata del ajuste en el draft;
- hacer que `closePhotoEditor()` ocurra solo despues de un guardado exitoso.

En la practica, la imagen editada no debe ser un JPG nuevo por defecto.
Debe ser la misma imagen con datos de ajuste guardados aparte.

---

### 2. `editor-v2.html`

Archivo:

- [editor-v2.html](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.html:103>)

Que debes mantener:

- titulo `Ajustar imagen`;
- texto corto de ayuda;
- botones `Cancelar` y `Guardar`.

Que debes agregar:

- controles visibles para que no dependas solo de dos dedos:
  - `Zoom +`
  - `Zoom -`
  - `Girar izq.`
  - `Girar der.`
  - `Restablecer`

Eso hace el editor usable en movil y en escritorio.

---

### 3. `editor-v2.css`

Archivo:

- [editor-v2.css](<C:/Users/manuel/Downloads/planes-publicacion/editor-v2.css:505>)

Que debes ajustar:

- espacio para la barra de controles;
- modal legible en movil;
- `touch-action: none` donde haga falta;
- area de foto clara y sin elementos apretados.

No rehagas todo el diseño.
Solo prepara la modal para que los controles nuevos se vean bien.

---

### 4. `site-view.js`

Archivo:

- [site-view.js](<C:/Users/manuel/Downloads/planes-publicacion/site-view.js>)

Que debes cambiar:

- leer la metadata del ajuste desde `content_json`;
- aplicar esa metadata al render de la imagen;
- respetar la URL original;
- renderizar la misma imagen con su posicion, zoom o rotacion.

Si no haces este paso, el editor seguira guardando datos que la pagina publica no usa.

---

## Lo minimo que debe guardar el editor

Por cada imagen, guarda algo asi:

- `value`: URL original;
- `meta.fit`: `cover` o `fit`;
- `meta.scale`: numero;
- `meta.x`: numero;
- `meta.y`: numero;
- `meta.rotation`: numero.

Con eso ya puedes reconstruir el ajuste sin destruir la imagen.

---

## Orden correcto para no romper nada

1. `editor-v2.js`
2. `editor-v2.html`
3. `editor-v2.css`
4. `site-view.js`

Primero cambia el modelo de guardado.
Despues cambias la vista.
Al final ajustas el estilo.

---

## Lo que no debes hacer

- no sigas usando dos dedos como unica forma de editar;
- no borres la imagen original al guardar;
- no dependas de exportar JPG para cada ajuste;
- no metas Supabase si todavia puedes resolverlo con `content_json`.

---

## Resultado esperado

Cuando termines, el flujo debe sentirse asi:

- toco imagen;
- la ajusto con botones o arrastre;
- guardo;
- la pagina usa el mismo archivo con otra configuracion;
- no pierdo nada;
- no dependo del pinch para trabajar.
