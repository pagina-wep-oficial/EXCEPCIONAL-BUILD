# Cambio: historial operable del editor

## Objetivo
Corregir la sincronización del elemento activo tras publicar, hacer claro el historial de versiones, reemplazar confirmaciones del navegador y permitir editar una copia temporal recuperada.

## Reglas
- Una recuperación nunca modifica la versión histórica original.
- Los cambios de una recuperación existen sólo en memoria hasta publicar.
- Cancelar o recargar descarta esa copia temporal.
- Durante recuperación se permiten texto y enlaces.
- Imágenes y videos históricos se conservan, pero no se reemplazan durante recuperación.
- La publicación normal y recuperada se escriben mediante un único commit atómico de GitHub.

## Servicios externos
No requiere migración de Supabase, Neon, R2 ni Workers.
Sólo requiere push a GitHub y despliegue de Cloudflare Pages al finalizar.
