# Actualización: flujo Prospecto → Invitado → Cliente

Esta actualización cambia el flujo comercial y agrega carga privada de archivos a Google Drive.

## 1. Respaldo

Antes de reemplazar archivos crea un commit o una rama de respaldo en GitHub.

## 2. Supabase

Si tu portal anterior ya funciona, ejecuta solamente:

`supabase-workflow-migration.sql`

Si instalas desde cero usa:

`supabase-schema.sql`

La migración no elimina proyectos existentes.

## 3. Publica el código

Reemplaza los archivos en el repositorio y haz push a la rama que utiliza Cloudflare Pages.

El sitio sigue siendo HTML/CSS/JavaScript estático. Las únicas funciones de servidor nuevas son las Pages Functions dentro de `functions/` para mover archivos hacia Google Drive.

## 4. Google Drive

Para activar la subida de fotos, videos y documentos sigue:

`CONFIGURAR-GOOGLE-DRIVE.md`

El resto del portal puede funcionar aunque todavía no conectes Drive; únicamente la subida de archivos mostrará un error hasta que agregues los secretos.

## 5. Prueba completa

### Cliente que llega por la web

1. Llena el formulario de `index.html`.
2. Revisa que aparezca en CRM > Prospectos.
3. Habla con él.
4. Pulsa **✓ Aceptó**.
5. Define precio, anticipo, saldo y método de pago.
6. Comprueba que aparece en CRM > Invitados.
7. Envía el acceso por WhatsApp.
8. Inicia sesión como ese cliente.
9. Comprueba que desaparece de Invitados y aparece en Clientes.
10. Configura dirección y funciones.
11. Completa información y sube un archivo.
12. Comprueba desde el CRM que ves información y archivo.

### Revisión

1. En CRM > Proyectos abre el proyecto.
2. Etapa = `Revisión`.
3. Agrega URL de vista previa.
4. Visibilidad = `Vista previa`.
5. Guarda.
6. El cliente debe ver **Ver vista previa**.

### Publicado

1. Etapa = `Publicado`.
2. URL publicada = sitio final.
3. Visibilidad = `Publicada`.
4. Guarda.
5. El cliente debe ver **Abrir mi página** y ya no debe tener el cuestionario como tarea principal.

## Flujo final del CRM

- Prospectos: todavía no aceptan.
- Invitados: aceptaron pero aún no activan cuenta.
- Clientes: ya iniciaron sesión.
- Proyectos: trabajo de cada negocio.
- Solicitudes: cambios y mantenimiento.

Una persona puede tener varios proyectos/negocios.
