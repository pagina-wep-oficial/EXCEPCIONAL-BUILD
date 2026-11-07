# Cambio: sincronización estable del modo de tienda

## Objetivo
Evitar que el selector de versión vuelva temporalmente a Base tras guardar.

## Causa
El reset del formulario y respuestas asíncronas antiguas podían sobrescribir
la selección confirmada por ITM.

## Decisión
ITM mantiene la fuente de verdad. El CRM conserva una caché visual por proyecto,
restaura el valor tras reset y descarta respuestas antiguas.
