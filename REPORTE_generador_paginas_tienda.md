# Reporte — generador de páginas y tiendas

## Estado

Fase 1 y Fase 2 están implementadas en worktrees aislados y no se han aplicado a Neon, Supabase, GitHub ni Cloudflare.

## Worktrees

- CRM: `/home/pancho/Documentos/PANCHO/excepcional-generador-paginas`
- ITM: `/home/pancho/Documents/PANCHO/itm-generador-paginas`

## Respaldos

- CRM: `/home/pancho/Documentos/PANCHO/respaldos/excepcional-antes-generador-20261114-183339`
- ITM: `/home/pancho/Documentos/PANCHO/respaldos/itm-antes-generador-20261114-183339`

## Validaciones locales

- Sintaxis de los endpoints CRM e ITM.
- `npm run check` de ITM.
- Integridad de la plantilla generada y ausencia de identidad de Fonda.
- `git diff --check` en ambos worktrees.

## No realizado todavía

- Aplicación de SQL en Supabase y Neon.
- Deploy, push, creación real de repositorio o Cloudflare Pages.

## Pendiente de validación publicada

- Publicar la plantilla visual v3 en Excepcional Build.
- Crear un proyecto nuevo para comprobar la versión v3 sin reutilizar datos.
- Migrar los repositorios de prueba existentes únicamente tras respaldo.
- Configurar dominio y Firebase Auth al final del flujo.
- Autorización de GitHub para Pages.
- Configuración Firebase Auth.
