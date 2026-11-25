import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";
import { deleteProjectMedia } from "../_lib/project-media.js";

const PROJECT_MEDIA_KEY = /^projects\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:public|private)\/media\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const legacyKeys = Array.isArray(body?.r2_keys)
      ? [...new Set(body.r2_keys.map(value => String(value || "").trim()).filter(Boolean))]
      : [];
    const assets = Array.isArray(body?.assets) ? body.assets.map(item => ({
      id: String(item?.id || "").trim(),
      r2_key: String(item?.r2_key || "").trim()
    })) : [];
    if (legacyKeys.length + assets.length > 1000 || legacyKeys.some(key => !PROJECT_MEDIA_KEY.test(key)) || assets.some(item => !UUID.test(item.id) || !PROJECT_MEDIA_KEY.test(item.r2_key))) {
      return json({ ok: false, code: "R2_KEYS_INVALID" }, 400);
    }

    const keys = [...new Set([...legacyKeys, ...assets.map(item => item.r2_key)])];
    const assetByKey = new Map(assets.map(item => [item.r2_key, item.id]));

    const failed = [];
    for (const key of keys) {
      try {
        await deleteProjectMedia(context.env, key);
      } catch (error) {
        console.error("admin-delete-media", key, error?.message || "");
        failed.push(key);
      }
    }
    const deletedKeys = keys.filter(key => !failed.includes(key));
    const metadataFailed = [];
    const deletedAssetIds = deletedKeys.map(key => assetByKey.get(key)).filter(Boolean);
    if (deletedAssetIds.length) {
      const { url, key } = supabaseConfig(context.env);
      const response = await fetch(`${url}/rest/v1/client_project_media_assets?id=in.(${deletedAssetIds.join(",")})`, {
        method: "DELETE",
        headers: { apikey: key, Authorization: bearer(context.request), Prefer: "return=minimal" }
      });
      if (!response.ok) {
        console.error("admin-delete-media metadata", await response.text().catch(() => ""));
        metadataFailed.push(...deletedAssetIds);
      }
    }
    return json({ ok: failed.length === 0 && metadataFailed.length === 0, deleted: deletedKeys.length, failed, metadata_failed: metadataFailed });
  } catch (error) {
    console.error("admin-delete-media failed", error?.message || "");
    return json({ ok: false, code: "R2_CLEANUP_FAILED" }, 502);
  }
}
