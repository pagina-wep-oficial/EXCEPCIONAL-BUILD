import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES = new Set(["whatsapp_catalog", "managed_orders"]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function validUuid(value) {
  return UUID_RE.test(String(value || ""));
}

async function isAppAdmin(request, env) {
  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/rpc/is_app_admin`, {
    method: "POST",
    headers: { apikey: key, Authorization: bearer(request), "Content-Type": "application/json" },
    body: "{}"
  });
  return response.ok && (await response.json()) === true;
}

async function linkedStoreProject(request, env, exceptionalProjectId) {
  const { url, key } = supabaseConfig(env);
  const response = await fetch(
    `${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(exceptionalProjectId)}&select=id,source_itm_project_id`,
    { headers: { apikey: key, Authorization: bearer(request) } }
  );
  if (!response.ok) return null;
  const project = (await response.json())?.[0] || null;
  const itmProjectId = String(project?.source_itm_project_id || "").trim();
  return project && validUuid(itmProjectId) ? { project, itmProjectId } : null;
}

export async function onRequest(context) {
  try {
    if (context.request.method !== "GET" && context.request.method !== "POST") {
      return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
    }

    const request = context.request;
    const user = await getUser(request, context.env);
    if (!user?.id || !(await isAppAdmin(request, context.env))) {
      return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    }

    const body = context.request.method === "POST"
      ? await request.json().catch(() => null)
      : Object.fromEntries(new URL(request.url).searchParams);
    const exceptionalProjectId = String(body?.project_id || "").trim();

    if (!validUuid(exceptionalProjectId)) return json({ ok: false, code: "PROJECT_ID_INVALID" }, 400);

    const linked = await linkedStoreProject(request, context.env, exceptionalProjectId);
    if (!linked) return json({ ok: false, code: "STORE_NOT_CONNECTED" }, 409);

    const secret = String(context.env.STORE_OWNER_HANDOFF_SECRET || "").trim();
    if (secret.length < 32) return json({ ok: false, code: "HANDOFF_NOT_CONFIGURED" }, 503);

    const action = context.request.method === "POST" ? "set" : "get";
    const storeMode = String(body?.store_mode || "").trim();
    if (action === "set" && !MODES.has(storeMode)) {
      return json({ ok: false, code: "STORE_MODE_INVALID" }, 400);
    }

    const origin = String(
      context.env.ITM_STORE_OWNER_ORIGIN || "https://itm-void-excepcional.pages.dev"
    ).replace(/\/+$/, "");
    const upstream = await fetch(`${origin}/api/store-admin-mode`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        project_id: linked.itmProjectId,
        exceptional_project_id: exceptionalProjectId,
        ...(action === "set" ? { store_mode: storeMode } : {})
      })
    });
    const data = await upstream.json().catch(() => null);

    if (!upstream.ok || !data?.ok) {
      return json({ ok: false, code: String(data?.code || "STORE_MODE_REQUEST_FAILED") }, upstream.status || 502);
    }
    return json({ ok: true, store_mode: data.store_mode });
  } catch (error) {
    console.error("exceptional store admin mode failed", error?.message || "");
    return json({ ok: false, code: "STORE_MODE_REQUEST_FAILED" }, 502);
  }
}
