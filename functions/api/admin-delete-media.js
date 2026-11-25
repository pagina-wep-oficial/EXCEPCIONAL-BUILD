import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";
import { deleteProjectMedia } from "../_lib/project-media.js";

const PROJECT_MEDIA_KEY = /^projects\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:public|private)\/media\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
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

export async function onRequestPost(context) {
  try {
    const user = await getUser(context.request, context.env);
    if (!user?.id || !(await isAppAdmin(context.request, context.env))) {
      return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    }

    const body = await context.request.json().catch(() => null);
    const keys = Array.isArray(body?.r2_keys)
      ? [...new Set(body.r2_keys.map(value => String(value || "").trim()).filter(Boolean))]
      : [];
    if (keys.length > 1000 || keys.some(key => !PROJECT_MEDIA_KEY.test(key))) {
      return json({ ok: false, code: "R2_KEYS_INVALID" }, 400);
    }

    const failed = [];
    for (const key of keys) {
      try {
        await deleteProjectMedia(context.env, key);
      } catch (error) {
        console.error("admin-delete-media", key, error?.message || "");
        failed.push(key);
      }
    }
    return json({ ok: failed.length === 0, deleted: keys.length - failed.length, failed });
  } catch (error) {
    console.error("admin-delete-media failed", error?.message || "");
    return json({ ok: false, code: "R2_CLEANUP_FAILED" }, 502);
  }
}
