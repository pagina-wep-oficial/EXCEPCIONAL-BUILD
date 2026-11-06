# Cambio: ciclo de vida de proyectos

## Objetivo

Corregir la reactivación de proyectos cancelados o descontinuados y conservar
el estado exacto que tenían antes de archivarse.

## Alcance

- Cancelar y descontinuar guardan etapa y estado anteriores.
- Reactivar usa el proyecto actualmente abierto, aun si la lista local quedó
  desactualizada.
- Borrar permanentemente también resuelve el proyecto abierto y exige que
  Supabase confirme la eliminación antes de actualizar la interfaz.
- La sincronización repinta primero el proyecto abierto y separa las vistas
  secundarias, evitando que una vista ausente obligue a recargar la página.
- Los proyectos antiguos sin historial mantienen la recuperación compatible
  basada en su publicación o vista previa.

## Dependencia

Ejecutar `crm-project-lifecycle.sql` en Supabase antes de publicar `crm.js`.
El código conserva un fallback compatible si la migración aún no está aplicada.
