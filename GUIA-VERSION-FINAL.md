# Excepcional Build · versión final del portal y CRM

Esta versión usa el mismo modelo técnico que ya tienes:

- **GitHub** guarda el código y el historial.
- **Cloudflare Pages** publica el sitio estático.
- **Supabase** maneja autenticación, prospectos, clientes, proyectos, cotizaciones, avances y solicitudes.
- No se necesita hosting tradicional para este portal.

## Flujo comercial definitivo

### Cliente que llega por la página

1. Entra al sitio público.
2. Puede mandar una solicitud breve sin crear cuenta.
3. La solicitud llega a `prospectos` y aparece en el CRM.
4. Después puede abrir el cotizador y preparar una estimación.
5. La cuenta de Google solo se pide cuando desea **guardar la cotización y darle seguimiento**.
6. Al guardar se crea un proyecto en estado `Solicitud en revisión`.
7. El proyecto aparece en el CRM y en el portal del cliente.

### Cliente que tú encuentras directamente

1. Lo registras en **Prospectos** dentro del CRM.
2. Si pregunta precio, puedes pulsar **Cotizador** y mandarle ese enlace por WhatsApp.
3. Si ya aceptó sin usar el cotizador, pulsa **Crear proyecto** directamente en el CRM.
4. El proyecto puede existir aunque el cliente todavía no tenga cuenta.
5. Desde el proyecto copias la **Invitación al portal** y se la mandas por WhatsApp.
6. El cliente entra con Google y el proyecto queda vinculado automáticamente a su cuenta.

No es obligatorio que un cliente que tú cierres por WhatsApp pase primero por la página pública.

## Control de la página que ve el cliente

Cada proyecto tiene tres estados de visibilidad:

- `hidden`: el cliente no ve ningún botón para abrir la página.
- `preview`: aparece **Ver avance** usando la URL de vista previa.
- `public`: aparece **Ver página** usando la URL pública.

Esto se cambia exclusivamente desde el CRM.

## Información que el cliente entrega

Dentro de cada proyecto el cliente tiene un apartado **Información para construir tu página** donde puede guardar descripción del negocio, servicios, dirección, horarios, WhatsApp público, redes, referencias visuales y notas.

Las fotografías se siguen enviando por WhatsApp en esta versión para no obligarte a configurar Supabase Storage todavía. El CRM muestra la información estructurada dentro del proyecto.

## Pagos

El CRM permite guardar:

- precio total acordado;
- anticipo;
- saldo final;
- anticipo pagado / pendiente;
- saldo pagado / pendiente.

Al crear un proyecto manualmente el panel propone una división 50/50. Puedes cambiarla antes de guardar.

## PASOS PARA ACTUALIZAR TU INSTALACIÓN

### 1. Haz respaldo en GitHub

Antes de reemplazar archivos, crea un commit o una rama de respaldo.

### 2. Ejecuta la migración de Supabase

En Supabase abre **SQL Editor**, copia todo el archivo:

`supabase-final-migration.sql`

y ejecútalo.

La migración no borra tus proyectos ni tus tablas `client_*` existentes.

### 3. Autoriza tu cuenta como administrador

En Supabase > SQL Editor ejecuta:

```sql
select id, email from auth.users order by created_at;
```

Busca la cuenta con la que entras al CRM y copia su UUID.

Después ejecuta:

```sql
insert into public.app_admins(user_id)
values ('PEGA_AQUI_TU_UUID')
on conflict do nothing;
```

Sin este paso el nuevo CRM no permitirá administrar datos de clientes.

### 4. Sube los archivos a GitHub

Reemplaza los archivos del proyecto con los de esta carpeta y haz push a la rama que usa Cloudflare Pages.

Si tu Google OAuth y tu `supabase-config.js` ya funcionaban, **no necesitas volver a configurar Google**.

### 5. Cloudflare Pages

Si Cloudflare Pages ya está conectado a GitHub, el push debe lanzar el despliegue automáticamente.

No hay build especial: sigue siendo HTML, CSS y JavaScript estático.

## Pruebas recomendadas

### Prueba A · cliente desde la web

1. Llena el formulario público.
2. Comprueba que aparece en el CRM > Prospectos.
3. Pulsa `Ver mi cotización estimada`.
4. Completa el cotizador.
5. Guarda la cotización e inicia sesión con Google.
6. Comprueba que aparece el proyecto en CRM > Proyectos y en el panel del cliente.

### Prueba B · cliente encontrado por ti

1. Crea un prospecto manual en el CRM.
2. Pulsa `Crear proyecto`.
3. Abre `Administrar`.
4. Copia la invitación al portal.
5. Ábrela en una cuenta de Google de prueba.
6. Confirma que ese proyecto aparece en la cuenta.

### Prueba C · control de la página

1. En CRM > Proyectos abre un proyecto.
2. Deja `Visibilidad del sitio = Oculto` y guarda.
3. Comprueba que el cliente **no** tiene botón de página.
4. Cambia a `Mostrar vista previa`, agrega una URL y guarda.
5. Comprueba que aparece `Ver avance`.
6. Cambia a `Página publicada`, agrega URL pública y guarda.
7. Comprueba que aparece `Ver página`.

### Prueba D · solicitud del cliente

1. Desde el proyecto del cliente pulsa mantenimiento o actualización.
2. Registra la solicitud.
3. Comprueba que aparece en CRM > Solicitudes.
4. Cambia su estado desde el CRM.

## Archivos principales nuevos o actualizados

- `panel.html` · panel del cliente.
- `proyecto.html` · detalle de proyecto.
- `perfil.html` · perfil del cliente.
- `acceso.html` · Google OAuth / alta de cuenta.
- `portal.css` · diseño del portal.
- `portal.js` · funcionamiento del portal.
- `crm-local.html` · CRM administrativo completo.
- `crm.css` · diseño del CRM.
- `crm.js` · lógica del CRM.
- `client_project_briefs` · tabla de información que entrega el cliente para construir su página.
- `supabase-final-migration.sql` · migración para tu proyecto actual.

## Seguridad

No pongas `service_role`, secretos de Google, contraseña de base de datos ni JWT secret en estos archivos públicos.
El navegador solo debe usar la clave pública publishable/anon y Supabase RLS controla los permisos.
