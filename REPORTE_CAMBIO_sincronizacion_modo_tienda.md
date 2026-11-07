# Reporte: sincronización estable del modo de tienda

## Antes
Al guardar un cambio de versión, el reset del formulario podía devolver el
selector temporalmente a Base. Respuestas antiguas del API podían sobrescribir
la selección recién confirmada.

## Ahora
- El CRM conserva el modo confirmado por ITM por proyecto.
- El reset del formulario restaura ese modo inmediatamente.
- Las consultas antiguas se descartan mediante una revisión consecutiva.
- Una selección pendiente del administrador no se sobrescribe.

## No modificado
No se modificaron productos, existencias, inventario, pedidos, Supabase ni la
configuración real de ITM.
