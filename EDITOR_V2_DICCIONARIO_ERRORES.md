# Diccionario de errores — Editor V2

Objetivo: el usuario solo ve mensajes limpios con un código. Este archivo traduce cada código a su causa probable y al punto técnico a revisar.

## Regla general

- El usuario ve:
  - mensaje limpio
  - código corto
- El sistema no debe exponer:
  - GitHub
  - Supabase
  - repo
  - branch
  - token
  - JSON
  - mensajes crudos del backend

---

## EB-UNKNOWN-001

- Texto visible:
  - No pudimos completar esta acción. Inténtalo de nuevo en un momento. Código: EB-UNKNOWN-001
- Significado:
  - Error genérico no clasificado
- Revisar:
  - consola del navegador
  - último flujo ejecutado
  - si algún `catch` quedó usando `showEditorError("EB-UNKNOWN-001")` como fallback

---

## EB-LOAD-001

- Texto visible:
  - No pudimos abrir el editor. Vuelve a intentarlo en un momento. Código: EB-LOAD-001
- Significado:
  - Falló la carga inicial del editor
- Revisar:
  - `loadEditor()`
  - lectura del proyecto
  - carga de páginas
  - sesión actual
  - errores de red o backend

---

## EB-LOAD-002

- Texto visible:
  - Este proyecto todavía no está listo. Aún falta terminar su configuración. Código: EB-LOAD-002
- Significado:
  - El proyecto no tiene configuración suficiente para abrirse en el editor
- Revisar:
  - `site_repo_owner`
  - `site_repo_name`
  - `site_repo_branch`
  - configuración general del proyecto

---

## EB-PERM-001

- Texto visible:
  - No tienes acceso a este proyecto. Verifica tu cuenta o pide acceso. Código: EB-PERM-001
- Significado:
  - La sesión existe, pero no tiene permiso para ese proyecto o hubo un problema de autorización
- Revisar:
  - usuario autenticado
  - relación del usuario con el proyecto
  - políticas/RLS
  - respuestas 401/403

---

## EB-DRAFT-001

- Texto visible:
  - No pudimos guardar tus cambios. Si sales ahora, podrías perder lo editado. Código: EB-DRAFT-001
- Significado:
  - Falló el guardado del borrador
- Impacto:
  - riesgo real de perder cambios no publicados
- Revisar:
  - `persistRepoDraftRecord()`
  - endpoint `/api/editor-repo-draft`
  - auth token
  - tabla `client_site_repo_drafts`
  - conectividad

---

## EB-PUBLISH-001

- Texto visible:
  - No pudimos publicar tus cambios. Inténtalo de nuevo en un momento. Código: EB-PUBLISH-001
- Significado:
  - Falló la publicación
- Revisar:
  - `publishDraft()`
  - endpoint `/api/editor-repo-publish`
  - acceso al proyecto
  - credenciales de publicación
  - errores del backend durante escritura

---

## EB-BASE-001

- Texto visible:
  - No pudimos cargar esta versión. Inténtalo de nuevo o sigue editando la versión actual. Código: EB-BASE-001
- Significado:
  - Falló la carga de la versión base
- Revisar:
  - rama base esperada
  - lectura del snapshot base
  - páginas faltantes
  - guardado posterior del draft restaurado

---

## EB-MEDIA-001

- Texto visible:
  - No pudimos subir esta imagen. Revisa tu conexión e inténtalo de nuevo. Código: EB-MEDIA-001
- Significado:
  - Falló la subida de imagen
- Revisar:
  - `uploadPhoto()`
  - storage
  - tamaño/tipo de archivo
  - conexión
  - permisos de storage

---

## EB-MEDIA-002

- Texto visible:
  - No pudimos abrir esta imagen. Prueba con otra imagen o vuelve a intentarlo. Código: EB-MEDIA-002
- Significado:
  - Falló la carga de la imagen para ajuste
- Revisar:
  - `openPhotoEditor()`
  - `loadPhotoForEdit()`
  - URL de imagen
  - formato de imagen
  - acceso al recurso

---

## EB-MEDIA-003

- Texto visible:
  - No pudimos guardar este ajuste. Inténtalo de nuevo. Código: EB-MEDIA-003
- Significado:
  - Falló el guardado de metadata de ajuste
- Revisar:
  - `applyPhotoEdit()`
  - `updateCurrentValue()`
  - estado del elemento activo
  - metadata de imagen

---

## EB-CONTENT-001

- Texto visible:
  - Hay un bloque que no pudimos procesar. Revisa ese contenido o inténtalo otra vez. Código: EB-CONTENT-001
- Significado:
  - El contenido editable no pudo interpretarse
- Revisar:
  - JSON inválido en botones/listas
  - `applyEntryToNode()`
  - estructura del valor guardado
  - contenido manualmente alterado

---

## Flujo recomendado de soporte

1. El usuario reporta el texto y el código.
2. Buscar el código en este archivo.
3. Revisar el bloque/función indicado.
4. Confirmar si hubo:
   - error de sesión
   - error de permisos
   - error de backend
   - error de contenido
   - error de media
5. Corregir la causa sin exponer detalles técnicos al usuario.

---

## Regla de mantenimiento

Cada vez que se agregue un nuevo error visible en el editor:

1. Crear un código nuevo `EB-*`
2. Agregarlo a `EDITOR_ERROR_COPY`
3. Agregarlo a este diccionario
4. Evitar mostrar `error.message` crudo al usuario
