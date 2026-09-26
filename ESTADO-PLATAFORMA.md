# Estado de la plataforma Excepcional Build (22 ago 2026)

## Motor del editor

**Único motor activo = `html_repo`** (HTML real del repo de GitHub).

- El modo `sections` fue eliminado por completo del runtime:
  - editor-v2.js ya no tiene `sourceMode`, `state.versions`, `draftSectionValue`, `frameUrl` ni ramas de doble motor.
  - project-admin.html ya no muestra el selector "Fuente del editor".
  - crm.js siempre guarda `site_editor_mode: "html_repo"`.
- El viewer viejo (`site-view.html`, `site-view.js`, `site-view.css`) fue **borrado del proyecto web** y da 404 en producción.
- Portal: solo abre URLs reales guardadas (`site_url` / `preview_url`). Si falta la URL, muestra aviso y no abre nada.

## Flujo actual del editor V2

1. Carga páginas desde el repo vía `/api/repo-contents` (fallback directo → token).
2. Edición sobre iframe con srcdoc; videos `video_embed` se muestran como tarjeta estática en edición y como iframe real en preview/publicado.
3. Guardar borrador = `syncRepoDraftFromFrame()` → exporta una COPIA limpia del DOM (`buildRepoExportHtml`) → `/api/editor-repo-draft`.
4. Publicar = `/api/editor-repo-publish` (usa GITHUB_TOKEN en Cloudflare Pages).
5. Acceso: dueño del proyecto O admin en `app_admins` (decidido por RLS de Supabase).

## Legado (NO borrar todavía)

Archivos históricos movidos a `_legado/`. Referencia solamente; ya no aplican al código vivo.

En Supabase se deja quieto por ahora (fuera del flujo del editor):
- tabla `client_site_page_versions`
- RPCs `client_prepare_site_draft`, `client_publish_site_changes`, `client_reset_site_draft`

## Pendiente siguiente

Desarrollo nuevo: mejoras de videos.
