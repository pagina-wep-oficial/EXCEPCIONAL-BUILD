import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const RPC_SIGNATURE = "public.import_itm_finalized_project(uuid,text,text,text,text,text,text,text,text,text)";

export async function onRequestPost(context) {
  try {
    const request = context.request;
    const user = await getUser(request, context.env);
    if (!user?.id || !(await isAppAdmin(request, context.env))) {
      return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    }

    const body = await request.json().catch(() => null);
    const managementToken = String(body?.management_token || "").trim();
    if (!managementToken.startsWith("sbp_") || managementToken.length < 20) {
      return json({ ok: false, code: "SUPABASE_TOKEN_INVALID" }, 400);
    }

    const projectsResponse = await fetch("https://api.supabase.com/v1/projects", {
      headers: { Authorization: `Bearer ${managementToken}` }
    });
    if (!projectsResponse.ok) {
      return json({ ok: false, code: "SUPABASE_TOKEN_INVALID" }, 401);
    }

    const queryResponse = await fetch(
      "https://api.supabase.com/v1/projects/scaebulgcuvqpucondws/database/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: `grant execute on function ${RPC_SIGNATURE} to anon;` })
      }
    );

    if (!queryResponse.ok) {
      return json({ ok: false, code: "SUPABASE_PERMISSION_UPDATE_FAILED" }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("setup-itm-finalization failed", error?.message || "");
    return json({ ok: false, code: "SUPABASE_PERMISSION_UPDATE_FAILED" }, 502);
  }
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
