# Más adelante — Estadísticas del sitio

Fecha: 2026-08-29
Estado: pendiente de implementación

## Objetivo

Agregar un módulo de estadísticas útil para el cliente dentro de su proyecto, compatible con:

- Cloudflare Pages
- GitHub Pages
- dominio propio

La idea no es mostrar detalles técnicos. La idea es que el cliente vea valor real en su panel.

## Regla principal

No mezclar este módulo con `client_project_setup`.

`client_project_setup` sigue siendo para:

- dirección
- dominio
- hosting
- bloqueos
- ofertas

Las estadísticas van aparte.

## Diseño base recomendado

Crear una tabla nueva:

- `client_project_metrics`

Campos base planeados:

- `project_id`
- `metrics_enabled`
- `metrics_visible_to_client`
- `analytics_provider`
- `public_hostname`
- `status`
- `status_note`
- `show_visits`
- `show_top_pages`
- `show_sources`
- `show_whatsapp`
- `show_calls`
- `show_maps`
- `show_forms`
- `show_search_console`
- `snapshot_today`
- `snapshot_7d`
- `snapshot_30d`
- `last_sync_at`
- `created_at`
- `updated_at`

Estados sugeridos:

- `draft`
- `pending`
- `connected`
- `error`

Proveedor inicial sugerido:

- `cloudflare_web_analytics`

## Clave de compatibilidad

La compatibilidad no se resuelve por proveedor de hosting.

Se resuelve por `public_hostname`.

Ejemplos:

- `tunegocio.pages.dev`
- `usuario.github.io`
- `www.tunegocio.com`

Con eso, el mismo módulo sirve para:

- link gratis
- GitHub Pages
- dominio propio

## Vista para cliente

Crear una vista segura tipo:

- `client_project_metrics_client_view`

Debe exponer solo lo necesario para el cliente:

- `project_id`
- `metrics_visible_to_client`
- `status`
- `status_note`
- `show_*`
- `snapshot_today`
- `snapshot_7d`
- `snapshot_30d`
- `last_sync_at`

No exponer:

- tokens
- ids internos
- detalles técnicos de conexión

## CRM / administración

Agregar una pestaña nueva en `project-admin.html`:

- `Métricas`

Ese panel debe servir para:

### 1. Activación

- activar métricas
- mostrar métricas al cliente

### 2. Conexión lógica

- proveedor de métricas
- hostname público
- estado
- última sincronización
- nota técnica

### 3. Widgets visibles al cliente

- visitas
- páginas más vistas
- fuentes de tráfico
- clics en WhatsApp
- clics en llamada
- clics en mapa
- formularios
- Search Console

### 4. Snapshot de prueba

Mostrar resumen simple:

- visitas hoy
- visitas 7 días
- top página
- top fuente
- clics WhatsApp
- formularios

## Portal del cliente

Agregar una tarjeta nueva dentro de `proyecto.html` / `portal.js`.

Nombre visible sugerido:

- `Estadísticas`
o
- `Actividad del sitio`

La tarjeta debe mostrar solo datos simples:

- visitas hoy
- visitas últimos 7 días
- página más vista
- fuente principal
- clics en WhatsApp
- formularios
- última actualización de datos

Si no hay datos todavía, no mostrar error técnico.

Texto sugerido:

- “Estamos empezando a reunir datos de tu sitio.”
- “Vuelve más tarde para ver actividad.”

## Fases sugeridas cuando se retome

### Fase 1

- tabla `client_project_metrics`
- vista `client_project_metrics_client_view`

### Fase 2

- tab `Métricas` en admin
- carga / guardado en `crm.js`

### Fase 3

- tarjeta `Estadísticas` en cliente
- render en `portal.js`

### Fase 4

- snapshot manual de prueba
- QA para `.pages.dev`, GitHub Pages y dominio propio

### Fase 5

- sincronización real con proveedor
- Search Console real
- mejoras visuales

## QA mínimo planeado

Probar estos casos:

1. proyecto con `.pages.dev`
2. proyecto con GitHub Pages
3. proyecto con dominio propio
4. métricas activas pero ocultas al cliente
5. métricas visibles sin datos
6. métricas visibles con snapshot manual

## No meter todavía

- cron
- jobs automáticos
- gráficas complejas
- Search Console real
- lógica de cobro / suscripción

Primero cerrar bien el contrato de datos y la UI base.
