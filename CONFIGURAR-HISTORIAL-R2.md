# Configurar historial en R2 de Ontiveros

El proyecto `excepcional-build` está en otra cuenta de Cloudflare. Por eso Pages no puede usar un binding R2 de la cuenta de Francisco directamente. La solución usa un Worker puente en la cuenta de Francisco; Pages solo llama al Worker con un secreto privado.

## 1. Crear el bucket en la cuenta de Francisco

Inicia sesión en Wrangler con la cuenta de Cloudflare de ITM/Ontiveros y verifica que sea la cuenta correcta:

```bash
npx wrangler logout
npx wrangler login
npx wrangler whoami
npx wrangler r2 bucket create excepcional-editor-versions
```

Si R2 aún no está habilitado, actívalo primero en el panel de esa cuenta. No uses el proyecto `excepcional-build` como prueba: pertenece a la otra cuenta.

## 2. Crear y desplegar el puente

Desde esta carpeta, genera un secreto largo y guárdalo temporalmente en una variable de la terminal, sin pegarlo en Git:

```bash
export BRIDGE_SECRET="pon-aqui-un-secreto-largo-y-aleatorio"
printf '%s' "$BRIDGE_SECRET" | npx wrangler secret put EDITOR_VERSIONS_BRIDGE_SECRET --config workers/editor-version-storage-bridge.wrangler.toml
npx wrangler deploy --config workers/editor-version-storage-bridge.wrangler.toml
```

Conserva la URL `workers.dev` que entregue Wrangler. El Worker solo permite claves bajo `projects/{uuid}/versions/{uuid}/` y el bucket no es público.

## 3. Variables de Pages en `excepcional-build`

En Cloudflare Pages, cuenta `paginawepoficial`, agrega en **Settings > Variables and Secrets > Production**:

- `VERSION_STORAGE_BRIDGE_URL`: URL `workers.dev` del puente, sin `/objects` al final.
- `EDITOR_VERSIONS_BRIDGE_SECRET`: el mismo secreto usado en el Worker puente.

No pongas aquí una clave de R2 ni hagas público el bucket.

## 4. Configurar el limpiador diario en la cuenta de Francisco

El limpiador elimina objetos expirados después de siete días y pendientes abandonados después de 24 horas. En la cuenta de Francisco configura estos secretos para el Worker `editor-version-cleaner`:

```bash
printf '%s' 'https://TU-PROYECTO.supabase.co' | npx wrangler secret put SUPABASE_URL --config workers/editor-version-cleaner.wrangler.toml
printf '%s' 'TU_SERVICE_ROLE_KEY' | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config workers/editor-version-cleaner.wrangler.toml
npx wrangler deploy --config workers/editor-version-cleaner.wrangler.toml
```

Usa el `service_role` únicamente como secreto de Wrangler; nunca lo incluyas en el navegador ni en Git.

## 5. Base de datos

Ejecuta `editor-history-r2.sql` en el proyecto Supabase actual de Excepcional antes de publicar por primera vez.

Después de estos pasos, despliega Pages normalmente. Si falta una variable, el editor mostrará que el historial R2 aún no está configurado en vez de publicar sin respaldo.

## 6. Secretos adicionales y limpieza segura

En Cloudflare Pages, cuenta `paginawepoficial`, configura también en Production:

- `EDITOR_VERSION_PREVIEW_SECRET`: secreto aleatorio exclusivo para firmar vistas temporales de medios históricos. No debe coincidir con el secreto del puente R2.

En el Worker `editor-version-cleaner`, cuenta de Francisco/Ontiveros, configura además:

```bash
export CRON_TEST_SECRET="genera-un-secreto-largo-y-aleatorio"
printf '%s' "$CRON_TEST_SECRET" | npx wrangler secret put CRON_TEST_SECRET --config workers/editor-version-cleaner.wrangler.toml
```

El cron diario no necesita este secreto. Sólo habilita una prueba manual autenticada:

```bash
curl -i -X POST "https://editor-version-cleaner.TU_SUBDOMINIO.workers.dev/" \
  -H "X-Cron-Test: $CRON_TEST_SECRET"
```

La limpieza elimina versiones publicadas cuando `expires_at <= ahora`, no siete días después. También elimina versiones pendientes abandonadas tras 24 horas. Nunca elimina una versión mientras exista un plan de restauración en estado `draft`, `publishing` o `failed`.
