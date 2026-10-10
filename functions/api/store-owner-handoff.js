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

function isPublished(project) {
  const stage = String(project?.project_stage || project?.status || "").toLowerCase();
  return stage === "publicado";
}

export async function onRequestPost(context) {
  try {
    const request = context.request;
    const env = context.env;
    const sharedSecret = String(env.STORE_OWNER_HANDOFF_SECRET || "").trim();

    if (sharedSecret.length < 32) {
      return json({ ok: false, code: "HANDOFF_NOT_CONFIGURED" }, 503);
    }

    const body = await request.json().catch(() => null);
    const exceptionalProjectId = String(body?.project_id || "").trim();

    if (!validUuid(exceptionalProjectId)) {
      return json({ ok: false, code: "PROJECT_ID_INVALID" }, 400);
    }

    const user = await getUser(request, env);

    if (!user?.id || !validUuid(user.id)) {
      return json({ ok: false, code: "SESSION_REQUIRED" }, 401);
    }

    const { url, key } = supabaseConfig(env);
    const endpoint =
      `${url}/rest/v1/client_projects` +
      `?id=eq.${encodeURIComponent(exceptionalProjectId)}` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=id,user_id,source_itm_project_id,store_enabled,project_stage,status`;

    const projectResponse = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: bearer(request)
      }
    });

    if (!projectResponse.ok) {
      return json({ ok: false, code: "PROJECT_LOOKUP_FAILED" }, 502);
    }

    const projects = await projectResponse.json();
    const project = projects?.[0];

    if (!project) {
      return json({ ok: false, code: "PROJECT_ACCESS_DENIED" }, 403);
    }

    const itmProjectId = String(project.source_itm_project_id || "").trim();

    if (project.store_enabled !== true || !validUuid(itmProjectId)) {
      return json({ ok: false, code: "STORE_NOT_CONNECTED" }, 409);
    }

    if (!isPublished(project)) {
      return json({ ok: false, code: "STORE_NOT_PUBLISHED" }, 409);
    }

    const itmOrigin = String(
      env.ITM_STORE_OWNER_ORIGIN || "https://itm-void-excepcional.pages.dev"
    ).replace(/\/+$/, "");

    const issueResponse = await fetch(`${itmOrigin}/api/store-owner-handoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sharedSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        project_id: itmProjectId,
        exceptional_project_id: exceptionalProjectId,
        exceptional_user_id: user.id
      })
    });

    const issued = await issueResponse.json().catch(() => null);

    if (!issueResponse.ok || !issued?.ok || !issued?.handoff_token) {
      const upstreamCode = String(issued?.code || "");
      const safeCodes = new Set([
        "HANDOFF_UNAUTHORIZED",
        "PROJECT_NOT_FOUND",
        "PROJECT_NOT_LINKED_TO_EXCEPTIONAL",
        "HANDOFF_DATA_INVALID",
        "STORE_OWNER_HANDOFF_SECRET_MISSING"
      ]);

      console.error("ITM handoff issue failed", issueResponse.status, upstreamCode);

      return json(
        {
          ok: false,
          code: safeCodes.has(upstreamCode)
            ? upstreamCode
            : "HANDOFF_ISSUE_FAILED"
        },
        502
      );
    }

    return json({
      ok: true,
      launch_url:
        `${itmOrigin}/store-owner-connect.html?handoff=` +
        encodeURIComponent(issued.handoff_token),
      expires_at: issued.expires_at
    });
  } catch (error) {
    console.error("exceptional store handoff failed", error?.message || "");

    return json({ ok: false, code: "HANDOFF_REQUEST_FAILED" }, 500);
  }
}

export async function onRequestGet() {
  return json({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405);
}
