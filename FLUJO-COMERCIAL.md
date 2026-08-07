# Flujo comercial final de Excepcional Build

## 1. Prospecto

Una persona todavía **no es cliente**.

Puede llegar de dos maneras:

- llena el formulario de `index.html`;
- tú la registras manualmente en **CRM > Prospectos**.

Aquí solo guardamos los datos de contacto, necesidad, origen y seguimiento. No necesita cuenta de Google.

## 2. Aceptó trabajar contigo

Cuando la persona acepta precio y forma de pago, en **CRM > Prospectos** pulsa **✓ Aceptó**.

El CRM pide:

- nombre del proyecto/negocio;
- precio total;
- anticipo;
- saldo;
- método de pago;
- mensaje inicial.

Al guardar:

1. se crea un proyecto en etapa `Invitación`;
2. el prospecto queda relacionado con ese proyecto;
3. aparece en **CRM > Invitados**;
4. se genera un enlace privado para activar la cuenta.

El prospecto no se duplica. El proyecto conserva `source_prospect_id` y cuando el cliente activa su cuenta se guarda también `client_user_id`.

## 3. Cliente invitado

En **CRM > Invitados** puedes:

- copiar el acceso;
- enviarlo por WhatsApp;
- administrar el proyecto.

Cuando la persona entra con Google, el proyecto se vincula a su cuenta y desaparece de Invitados. Desde ese momento aparece como cliente activo.

## 4. Configuración de la página

Después de activar la cuenta, el cliente entra a `cotizar.html?project=...`, pero esa página **ya no funciona como cotizador público**.

Ahora sirve para decidir:

- enlace gratuito `.pages.dev` o dominio propio;
- alojamiento incluido o funciones especiales.

El precio de creación ya está acordado en el CRM. Dominio y alojamiento especializado se muestran como servicios adicionales.

Al terminar, el proyecto pasa a `Información`.

## 5. Información y archivos

Dentro de `proyecto.html` el cliente completa un asistente sencillo:

1. negocio;
2. contacto y ubicación;
3. contenido que desea mostrar;
4. fotos, videos, logo y documentos.

Puede guardar y continuar después. Cuando termina pulsa **Ya terminé · enviar información para comenzar**.

El proyecto pasa a `Producción`.

### Archivos

Los archivos reales se guardan en **Google Drive**. Supabase guarda solamente metadatos: nombre, tipo, tamaño, proyecto y el identificador interno de Drive.

## 6. Producción

El cliente ya no ve todas las preguntas como pantalla principal. Ve un mensaje simple:

> Estamos preparando tu página. Por ahora no necesitas hacer nada.

Tú puedes registrar avances desde el CRM.

## 7. Revisión

Desde el CRM:

1. cambia la etapa a `Revisión`;
2. agrega la URL de vista previa;
3. usa `Visibilidad = Vista previa`.

El cliente verá **Ver vista previa** y podrá mandar una solicitud de cambio.

## 8. Publicación

Cuando la página esté lista:

1. cambia la etapa a `Publicado`;
2. agrega la URL pública;
3. cambia `Visibilidad = Publicada`.

El cliente ya no ve el cuestionario principal. Ve su página y opciones de:

- actualizar contenido;
- mantenimiento;
- dominio propio si usa enlace gratuito;
- funciones especiales si usa alojamiento incluido;
- mejoras futuras.

## Una persona puede tener varios negocios

La cuenta representa a la persona. Los negocios pertenecen a los proyectos.

Ejemplo:

```text
Juan Pérez
├── Abarrotes Lupita
├── Restaurante Lupita
└── Taller El Centro
```

Nunca uses el campo de perfil personal como “nombre del negocio”.
