const PENDING_HOURS = 24;

function requiredEnv(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function versionBucket(env) {
  const bucket = env.EDITOR_VERSIONS;
  if (!bucket || typeof bucket.delete !== "function") {
    throw new Error("EDITOR_VERSIONS_MISSING");
  }
  return bucket;
}

function supabaseHeaders(env) {
  const key = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function supabaseJson(env, path, options = {}) {
  const baseUrl = requiredEnv(env, "SUPABASE_URL").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...supabaseHeaders(env), ...(options.headers || {}) }
  });

  if (!response.ok) {
    throw new Error(`SUPABASE_${response.status}: ${await response.text()}`);
  }

  return response.json().catch(() => []);
}

async function cleanExpired(env) {
  const bucket = versionBucket(env);
  const now = new Date().toISOString();
  const pendingBefore = new Date(
    Date.now() - PENDING_HOURS * 60 * 60 * 1000
  ).toISOString();

  const candidatesQuery = new URLSearchParams({
    or: `(and(status.eq.published,expires_at.lte.${now}),and(status.eq.pending,created_at.lt.${pendingBefore}))`,
    select: "id,status"
  });

  const [candidates, activePlans] = await Promise.all([
    supabaseJson(
      env,
      `/rest/v1/client_editor_versions?${candidatesQuery.toString()}`
    ),
    supabaseJson(
      env,
      "/rest/v1/client_editor_restore_plans?status=in.(draft,publishing,failed)&select=version_id"
    )
  ]);

  const protectedVersionIds = new Set(
    (activePlans || []).map(plan => String(plan.version_id))
  );

  let removed = 0;
  let protectedCount = 0;

  for (const version of candidates || []) {
    if (protectedVersionIds.has(String(version.id))) {
      protectedCount++;
      continue;
    }

    const files = await supabaseJson(
      env,
      `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}&select=r2_key`
    );

    await Promise.all(
      (files || []).map(file => bucket.delete(file.r2_key))
    );

    await supabaseJson(
      env,
      `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}`,
      {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      }
    );

    const deletedAt = new Date().toISOString();

    await supabaseJson(
      env,
      `/rest/v1/client_editor_versions?id=eq.${encodeURIComponent(version.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "deleted",
          deleted_at: deletedAt,
          updated_at: deletedAt
        })
      }
    );

    removed++;
  }

  return {
    removed,
    protected: protectedCount
  };
}

export default {
  async scheduled(controller, env, context) {
    context.waitUntil(
      cleanExpired(env).catch(error =>
        console.error("editor version cleanup failed", error)
      )
    );
  },

  async fetch(request, env) {
    const testSecret = String(env.CRON_TEST_SECRET || "").trim();

    if (
      !testSecret ||
      request.method !== "POST" ||
      request.headers.get("X-Cron-Test") !== testSecret
    ) {
      return new Response("Not found", { status: 404 });
    }

    return Response.json({
      ok: true,
      ...(await cleanExpired(env))
    });
  }
};
