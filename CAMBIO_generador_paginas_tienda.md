# Generador de páginas y tiendas

## Objetivo

Crear desde un proyecto CRM una página de presentación y una tienda ITM aislada, con repositorio GitHub privado y Cloudflare Pages enlazado al repositorio.

## Fase 1 y 2 implementadas localmente

- Endpoint CRM `generate-project-site` con operación persistente, reintentos y bloqueo de sobrescritura.
- SQL de Supabase para `client_site_generations`.
- Endpoint ITM firmado para crear una tienda vacía con Tienda, Catálogo y monedas base.
- Plantilla neutral con `dist/`, presentación editable, tienda, detalle, carrito, pedidos y perfil.
- Creación de repo privado con `main` y `editor-base`.
- Creación de Cloudflare Pages de origen GitHub, no Direct Upload, para publicar cada push a `main`.
- Botón `Guardar y crear página` independiente del publicador manual existente.

## Reversión

No aplicar las migraciones ni desplegar los endpoints deja producción intacta. Si ya se crean recursos externos, se eliminan únicamente usando los identificadores guardados en `client_site_generations`; nunca por nombre aproximado.

## Fase 3 pendiente

- Aplicar migración ITM y SQL Supabase con respaldos.
- Configurar secretos de provisión y la identidad administradora ITM.
- Autorizar una vez la aplicación Cloudflare Workers and Pages en la organización GitHub.
- Desplegar ambos proyectos, crear una página de prueba y verificar GitHub → Cloudflare Pages.

## Corrección de plantilla visual

- La plantilla v3 genera una portada neutral con hero, destacados, historia,
  comentarios públicos y contacto.
- La tienda incluye catálogo, detalle, carrito, pedidos, perfil y adaptación
  para Catálogo externo, sin identidad ni datos de Fonda.
- El generador ahora detiene la creación si guardar el proyecto falla; no crea
  recursos externos a partir de datos no confirmados.
- Los repositorios ya generados no se sobrescriben automáticamente. Su cambio
  de plantilla requiere una migración explícita con respaldo.
- Configurar Firebase Auth y rotar credenciales temporales.

## Firebase Auth automático

- Cada página generada registra su hostname exacto `*.pages.dev` en los dominios
  autorizados de Firebase Auth antes de quedar publicada.
- El registro es idempotente: conserva los dominios ya existentes y no duplica
  el hostname si se reintenta una creación.
- La credencial privada se lee únicamente desde el secreto de Cloudflare
  `FIREBASE_AUTH_SERVICE_ACCOUNT_JSON`; nunca se incluye en repositorios,
  respuestas ni sitios generados.
- Si falta la credencial o su permiso, la generación queda en estado reintentable
  sin duplicar la tienda, el repositorio ni el proyecto Pages.
