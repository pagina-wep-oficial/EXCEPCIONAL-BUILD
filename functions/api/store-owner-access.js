import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

function validUuid(value) {
  return UUID_RE.test(String(value || ""));
}

async function isAppAdmin(request, env) {
  const { url, key } = supabaseConfig(env);

  const response = await fetch(`${url}/rest/v1/rpc/is_app_admin`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: bearer(request),
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  return response.ok && (await response.json()) === true;
}

export async function onRequestPost(context) {
  try {
    const request = context.request;
    const env = context.env;
    const body = await request.json().catch(() => null);
    const exceptionalProjectId = String(body?.project_id || "").trim();

    if (!validUuid(exceptionalProjectId)) {
      return json({ ok: false, code: "PROJECT_ID_INVALID" }, 400);
    }

    const user = await getUser(request, env);

    if (!user?.id || !(await isAppAdmin(request, env))) {
      return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    }

    const { url, key } = supabaseConfig(env);
    const projectResponse = await fetch(
      `${url}/rest/v1/client_projects` +
        `?id=eq.${encodeURIComponent(exceptionalProjectId)}` +
        `&select=id,source_itm_project_id`,
      {
        headers: {
          apikey: key,
          Authorization: bearer(request)
        }
      }
    );

    if (!projectResponse.ok) {
      return json({ ok: false, code: "PROJECT_LOOKUP_FAILED" }, 502);
    }

    const project = (await projectResponse.json())?.[0];
    const itmProjectId = String(project?.source_itm_project_id || "").trim();

    if (!project || !validUuid(itmProjectId)) {
      return json({ ok: false, code: "STORE_NOT_CONNECTED" }, 409);
    }

    const sharedSecret = String(env.STORE_OWNER_HANDOFF_SECRET || "").trim();

    if (sharedSecret.length < 32) {
      return json({ ok: false, code: "HANDOFF_NOT_CONFIGURED" }, 503);
    }

    const itmOrigin = String(
      env.ITM_STORE_OWNER_ORIGIN || "https://itm-void-excepcional.pages.dev"
    ).replace(/\/+$/, "");

    const response = await fetch(`${itmOrigin}/api/store-owner-handoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sharedSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "revoke",
        project_id: itmProjectId,
        exceptional_project_id: exceptionalProjectId
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      return json({ ok: false, code: "STORE_ACCESS_REVOKE_FAILED" }, 502);
    }

    return json({
      ok: true,
      revoked_owners: Number(data.revoked_owners || 0),
      revoked_handoffs: Number(data.revoked_handoffs || 0)
    });
  } catch (error) {
    console.error("store owner access revoke failed", error?.message || "");

    return json({ ok: false, code: "STORE_ACCESS_REVOKE_FAILED" }, 500);
  }
}

export async function onRequestGet() {
  return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
}
