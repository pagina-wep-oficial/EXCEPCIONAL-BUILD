# Cambio: panel adaptado a cliente y administración

## Objetivo

Presentar una búsqueda y una invitación a nueva página adecuadas a cada tipo de
vista, sin exponer términos administrativos a clientes.

## Alcance

- Cliente: busca sus páginas o direcciones.
- Administración: busca por página, cliente o dirección.
- La invitación para solicitar otra página aparece solo cuando la vista tiene
  al menos un proyecto propio y no muestra proyectos de otras personas.
- La navegación móvil pasa a dos opciones si la invitación no aplica.

## Límites

- No se cambia RLS, permisos, APIs, datos ni los enlaces de WhatsApp.
- La detección usa únicamente los proyectos que el panel ya puede leer.
