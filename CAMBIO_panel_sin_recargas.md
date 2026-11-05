# Cambio: panel sin recargas completas

## Objetivo

Evitar que `panel.html` reinicie el documento completo al recibir cambios en
tiempo real o al volver a enfocar la pestaña.

## Causa

- La cola global de eventos terminaba en `location.reload()` cuando coincidían
  cambios consecutivos.
- El evento `visibilitychange` también recargaba la página completa.
- La cuadrícula de proyectos se reconstruía entera aun cuando cambiaba una sola
  tarjeta.

## Alcance

- Cola agrupada de eventos de Supabase.
- Sincronización silenciosa del panel al volver a la pestaña.
- Tarjetas identificadas por proyecto y actualizadas de forma puntual.

## Límites

- No cambiar tablas, RLS, API, permisos, autenticación ni datos de proyectos.
- No modificar los flujos de `proyecto.html`, `configurar.html` ni el editor en
  esta entrega.

## Validación

1. Dos cambios seguidos no recargan el documento.
2. Un cambio de proyecto actualiza solo su tarjeta.
3. La búsqueda y el desplazamiento se conservan.
4. Volver a la pestaña sincroniza sin recargar.
