import { bearer, supabaseConfig } from "../_lib/supabase.js";
import {
  EDITOR_VERSION_LIMIT,
  editorProjectAccess,
  listProjectVersions,
  getVersion,
  readVersionManifest,
  protectedVersionIds,
  deletePublishedVersion,
  versionErrorMessage
} from "../_lib/editor-versions.js";
import {
  cancelRestorePlan,
  createRestorePlan,
  getRestorePlan,
  manifestPagePaths
} from "../_lib/editor-restore-plans.js";
import { createVersionPreviewUrls } from "../_lib/editor-version-preview.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function isActiveRestorePlan(plan) {
  return Boolean(plan && ["draft", "publishing", "failed"].includes(plan.status));
}

function normalizedPagePath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const projectId = url.searchParams.get("project_id");
    const action = String(url.searchParams.get("action") || "");
    if (!projectId) return json({ ok: false, message: "Falta el proyecto." }, 400);

    const access = await editorProjectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);

    const restorePlan = await getRestorePlan(
      context.request,
      context.env,
      projectId
    );

    if (action === "restore-preview") {
      const versionId = String(url.searchParams.get("version_id") || "");

      if (
        !versionId ||
        !isActiveRestorePlan(restorePlan) ||
        String(restorePlan.version_id) !== versionId
      ) {
        return json({
          ok: false,
          code: "RESTORE_PLAN_NOT_READY",
          message: "No hay una recuperación disponible para revisar."
        }, 409);
      }

      const version = await getVersion(
        context.request,
        context.env,
        projectId,
        versionId
      );

      if (!version || version.status !== "published") {
        return json({
          ok: false,
          code: "VERSION_NOT_FOUND",
          message: "La versión ya no está disponible."
        }, 404);
      }

      const manifest = await readVersionManifest(
        context.request,
        context.env,
        version
      );

      const preview = await createVersionPreviewUrls({
        request: context.request,
        env: context.env,
        projectId,
        versionId,
        assets: manifest.assets
      });

      return json({
        ok: true,
        version_id: versionId,
        pages: manifest.pages.map(page => ({
          path: normalizedPagePath(page.path),
          html: String(page.html || "")
        })),
        ...preview
      });
    }

    const [versions, protectedIds] = await Promise.all([
      listProjectVersions(context.request, context.env, projectId),
      protectedVersionIds(context.request, context.env, projectId)
    ]);

    return json({
      ok: true,
      versions,
      limit: EDITOR_VERSION_LIMIT,
      used: versions.length,
      protected_ids: [...protectedIds],
      restore_plan: isActiveRestorePlan(restorePlan) ? restorePlan : null
    });
  } catch (error) {
    console.error(error);
    return json({
      ok: false,
      code: error?.message || "VERSION_HISTORY_FAILED",
      message: versionErrorMessage(error)
    }, 503);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const projectId = String(body.project_id || "");
    const versionId = String(body.version_id || "");

    if (!projectId || !versionId || body.action !== "restore") {
      return json({ ok: false, message: "Faltan datos para recuperar la versión." }, 400);
    }

    const access = await editorProjectAccess(context.request, context.env, projectId);
    if (!access) {
      return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);
    }

    const activePlan = await getRestorePlan(
      context.request,
      context.env,
      projectId
    );

    if (isActiveRestorePlan(activePlan)) {
      throw new Error("RESTORE_PLAN_ACTIVE");
    }

    const version = await getVersion(
      context.request,
      context.env,
      projectId,
      versionId
    );

    if (!version || version.status !== "published") {
      throw new Error("VERSION_NOT_FOUND");
    }

    const manifest = await readVersionManifest(
      context.request,
      context.env,
      version
    );

    const restorePlan = await createRestorePlan({
      request: context.request,
      env: context.env,
      projectId,
      userId: access.user.id,
      version,
      manifest
    });

    return json({
      ok: true,
      version,
      restore_plan: restorePlan,
      restored_pages: manifestPagePaths(manifest).length
    });
  } catch (error) {
    console.error(error);

    const code = String(error?.message || "");
    const status = code === "VERSION_NOT_FOUND"
      ? 404
      : [
          "RESTORE_PLAN_ACTIVE",
          "RESTORE_PLAN_PAGES_MISSING"
        ].includes(code)
        ? 409
        : 503;

    return json({
      ok: false,
      code: code || "VERSION_RESTORE_FAILED",
      message: versionErrorMessage(error)
    }, status);
  }
}

export async function onRequestDelete(context) {
  try {
    const url = new URL(context.request.url);
    const projectId = url.searchParams.get("project_id");
    const versionId = url.searchParams.get("version_id");
    const action = String(url.searchParams.get("action") || "");

    if (!projectId) {
      return json({ ok: false, message: "Falta el proyecto." }, 400);
    }

    const access = await editorProjectAccess(
      context.request,
      context.env,
      projectId
    );

    if (!access) {
      return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);
    }

    if (action === "cancel-restore") {
      const cancelledPlan = await cancelRestorePlan({
        request: context.request,
        env: context.env,
        projectId
      });

      return json({
        ok: true,
        cancelled_plan: cancelledPlan
      });
    }

    if (!versionId) {
      return json({ ok: false, message: "Falta la versión." }, 400);
    }

    const restorePlan = await getRestorePlan(
      context.request,
      context.env,
      projectId
    );

    if (
      isActiveRestorePlan(restorePlan) &&
      String(restorePlan.version_id) === String(versionId)
    ) {
      throw new Error("RESTORE_PLAN_VERSION_ACTIVE");
    }

    await deletePublishedVersion(
      context.request,
      context.env,
      projectId,
      versionId
    );

    return json({ ok: true });
  } catch (error) {
    console.error(error);

    const status = [
      "VERSION_NOT_FOUND",
      "VERSION_PROTECTED",
      "RESTORE_PLAN_VERSION_ACTIVE",
      "RESTORE_PLAN_NOT_FOUND"
    ].includes(error?.message) ? 409 : 503;

    return json({
      ok: false,
      code: error?.message || "VERSION_DELETE_FAILED",
      message: versionErrorMessage(error)
    }, status);
  }
}
