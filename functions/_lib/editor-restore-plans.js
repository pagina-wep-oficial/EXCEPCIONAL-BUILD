import { bearer, supabaseConfig } from "./supabase.js";

function headers(request, env, extra = {}) {
  const { key } = supabaseConfig(env);
  return {
    apikey: key,
    Authorization: bearer(request),
    "Content-Type": "application/json",
    ...extra
  };
}

async function requestJson(request, env, path, options = {}) {
  const { url } = supabaseConfig(env);
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: headers(request, env, options.headers || {})
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || `RESTORE_PLAN_HTTP_${response.status}`);
  }

  return body;
}

function normalizePath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function isManagedPagePath(path = "") {
  return Boolean(
    path &&
    /\.html?$/i.test(path) &&
    !path.split("/").some(segment => segment === "." || segment === "..")
  );
}

export function normalizeRestorePagePaths(paths = []) {
  const values = Array.isArray(paths) ? paths : [];

  return [...new Set(
    values
      .map(normalizePath)
      .filter(isManagedPagePath)
  )];
}

export function manifestPagePaths(manifest = {}) {
  return normalizeRestorePagePaths(
    (Array.isArray(manifest?.pages) ? manifest.pages : [])
      .map(page => page?.path)
  );
}

export function manifestAssetPaths(manifest = {}) {
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];

  return [...new Set(
    assets
      .map(asset => normalizePath(asset?.path))
      .filter(path =>
        path &&
        !path.split("/").some(segment => segment === "." || segment === "..")
      )
  )];
}

export async function getRestorePlan(request, env, projectId) {
  const rows = await requestJson(
    request,
    env,
    `/rest/v1/client_editor_restore_plans?project_id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`
  );

  return rows?.[0] || null;
}

function isActiveRestorePlan(plan) {
  return Boolean(
    plan &&
    ["draft", "publishing", "failed"].includes(String(plan.status || ""))
  );
}

export async function createRestorePlan({
  request,
  env,
  projectId,
  userId,
  version,
  manifest
}) {
  const existingPlan = await getRestorePlan(request, env, projectId);

  if (isActiveRestorePlan(existingPlan)) {
    throw new Error("RESTORE_PLAN_ACTIVE");
  }

  const pagePaths = manifestPagePaths(manifest);
  const assetPaths = manifestAssetPaths(manifest);

  if (!pagePaths.length) {
    throw new Error("RESTORE_PLAN_PAGES_MISSING");
  }

  const rows = await requestJson(
    request,
    env,
    "/rest/v1/client_editor_restore_plans?on_conflict=project_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        project_id: projectId,
        version_id: version.id,
        user_id: userId,
        status: "draft",
        snapshot_page_paths: pagePaths,
        snapshot_asset_paths: assetPaths,
        last_error: null,
        publishing_at: null,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
    }
  );

  const plan = rows?.[0] || null;

  if (!plan) {
    throw new Error("RESTORE_PLAN_CREATE_FAILED");
  }

  return plan;
}

export async function cancelRestorePlan({
  request,
  env,
  projectId
}) {
  const plan = await getRestorePlan(request, env, projectId);

  if (!isActiveRestorePlan(plan)) {
    throw new Error("RESTORE_PLAN_NOT_FOUND");
  }

  await requestJson(
    request,
    env,
    `/rest/v1/client_editor_restore_plans?project_id=eq.${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal"
      }
    }
  );

  return plan;
}

export async function requireDraftRestorePlan({
  request,
  env,
  projectId,
  versionId
}) {
  const plan = await getRestorePlan(request, env, projectId);

  if (!plan || String(plan.version_id) !== String(versionId)) {
    throw new Error("RESTORE_PLAN_NOT_FOUND");
  }

  if (!["draft", "failed"].includes(String(plan.status))) {
    throw new Error("RESTORE_PLAN_NOT_READY");
  }

  return plan;
}

export async function markRestorePlanPublishing({
  request,
  env,
  projectId,
  versionId
}) {
  const plan = await requireDraftRestorePlan({
    request,
    env,
    projectId,
    versionId
  });

  const rows = await requestJson(
    request,
    env,
    `/rest/v1/client_editor_restore_plans?project_id=eq.${encodeURIComponent(projectId)}&version_id=eq.${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status: "publishing",
        last_error: null,
        publishing_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows?.[0] || plan;
}

export async function markRestorePlanFailed({
  request,
  env,
  projectId,
  versionId,
  error
}) {
  const rows = await requestJson(
    request,
    env,
    `/rest/v1/client_editor_restore_plans?project_id=eq.${encodeURIComponent(projectId)}&version_id=eq.${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status: "failed",
        last_error: String(error?.message || error || "RESTORE_PLAN_FAILED").slice(0, 1200),
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows?.[0] || null;
}

export async function markRestorePlanCompleted({
  request,
  env,
  projectId,
  versionId
}) {
  const rows = await requestJson(
    request,
    env,
    `/rest/v1/client_editor_restore_plans?project_id=eq.${encodeURIComponent(projectId)}&version_id=eq.${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status: "completed",
        last_error: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );

  return rows?.[0] || null;
}
