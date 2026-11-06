# Cambio: ciclo de vida de proyectos

## Objetivo

Corregir la reactivación de proyectos cancelados o descontinuados y conservar
el estado exacto que tenían antes de archivarse.

## Alcance

- Cancelar y descontinuar guardan etapa y estado anteriores.
- Reactivar usa el proyecto actualmente abierto, aun si la lista local quedó
  desactualizada.
- Los proyectos antiguos sin historial mantienen la recuperación compatible
  basada en su publicación o vista previa.

## Dependencia

Ejecutar `crm-project-lifecycle.sql` en Supabase antes de publicar `crm.js`.
El código conserva un fallback compatible si la migración aún no está aplicada.
