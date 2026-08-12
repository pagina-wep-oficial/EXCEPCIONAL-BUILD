# Editor autogestionable

## Producto

- Nombre: Editor autogestionable
- Cobro: por sitio web, no por cliente completo
- Planes sugeridos:
  - 1 mes: $50 MXN
  - 3 meses: $140 MXN
  - 6 meses: $270 MXN
  - 12 meses: $500 MXN
- Si vence el acceso, la pagina sigue en linea y solo se pausa el editor.
- Cambios especiales, nuevas secciones, sistemas o redisenos se cotizan aparte.
- Ubicacion en el portal: dentro de cada `proyecto.html`, despues de pagos/acciones y antes de `Avances`.

## Reembolso y cancelacion

- No hay reembolso despues de activar el acceso.
- Si hubo cobro duplicado, error de cobro o falla tecnica nuestra, se revisa por WhatsApp.
- Si el cliente cancela, conserva acceso hasta terminar el periodo pagado.
- Problemas de cobro, cancelacion, reembolso o activacion se atienden por WhatsApp.

## Manual antes de automatizar cobros

1. Definir el medio de pago real: transferencia, Mercado Pago, Stripe u otro.
2. Tener datos fiscales listos para declarar ingresos y emitir factura cuando corresponda.
3. Crear en Supabase una tabla para accesos del editor cuando se conecte el pago automatico.
4. Guardar por proyecto: plan, fecha de inicio, fecha de vencimiento, estado y referencia de pago.
5. Crear una vista en CRM para activar, pausar, renovar y revisar accesos del editor.
6. Crear el editor real del sitio: textos, imagenes, videos, horarios, precios y promociones.
7. Proteger el editor con reglas RLS para que cada cliente solo edite sus propios proyectos.

## Estados futuros

- No contratado
- Pendiente de pago
- Activo
- Vence pronto
- Pausado
- Problema de cobro

## Supabase futuro

Tabla sugerida: `client_editor_access`

Campos minimos:

- `id`
- `project_id`
- `user_id`
- `status`
- `plan_months`
- `price_mxn`
- `starts_at`
- `ends_at`
- `payment_reference`
- `created_at`
- `updated_at`
