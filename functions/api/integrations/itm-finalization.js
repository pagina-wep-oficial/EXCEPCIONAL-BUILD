import { supabaseConfig } from "../../_lib/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost(context) {
  const request = context.request;
  const env = context.env;

  if (!env.ITM_FINALIZATION_SECRET) {
    return json({ ok: false, code: "INTEGRATION_NOT_CONFIGURED" }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  if (authorization !== "Bearer " + env.ITM_FINALIZATION_SECRET) {
    return json({ ok: false, code: "INTEGRATION_UNAUTHORIZED" }, 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || !UUID_RE.test(String(body.itm_project_id || ""))) {
    return json({ ok: false, code: "ITM_PROJECT_ID_INVALID" }, 400);
  }

  const name = String(body.name || "").trim().slice(0, 160);
  const siteUrl = safeHttpsUrl(body.site_url);
  const previewUrl = safeHttpsUrl(body.preview_url);
  const repoOwner = String(body.repository?.owner || "").trim().slice(0, 160);
  const repoName = String(body.repository?.name || "").trim().slice(0, 160);
  const repoBranch = String(body.repository?.branch || "main").trim().slice(0, 160);
  const repoPath = String(body.repository?.path || "/").trim().slice(0, 300);
  const provider = String(body.publication_provider || "github_pages").trim();
  const storeAdminUrl = safeHttpsUrl(body.store_admin_url);

  if (!name || !siteUrl || !previewUrl || !repoOwner || !repoName) {
    return json({ ok: false, code: "ITM_PROJECT_DATA_INCOMPLETE" }, 400);
  }

  const { url: supabaseUrl, key: publicKey } = supabaseConfig(env);

  const rpc = await fetch(supabaseUrl + "/rest/v1/rpc/import_itm_finalized_project", {
    method: "POST",
    headers: {
      apikey: publicKey,
      Authorization: "Bearer " + publicKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_itm_project_id: body.itm_project_id,
      p_name: name,
      p_site_url: siteUrl,
      p_preview_url: previewUrl,
      p_repo_owner: repoOwner,
      p_repo_name: repoName,
      p_repo_branch: repoBranch,
      p_repo_path: repoPath,
      p_publish_provider: provider,
      p_store_admin_url: storeAdminUrl
    })
  });

  const rows = await rpc.json().catch(() => []);
  if (!rpc.ok || !rows?.[0]?.project_id || !rows?.[0]?.claim_token) {
    console.error("ITM finalization import failed", rpc.status, rows);
    return json({ ok: false, code: "EXCEPCIONAL_IMPORT_FAILED" }, 502);
  }

  const portalOrigin = String(env.PUBLIC_PORTAL_ORIGIN || "https://excepcional-build.pages.dev").replace(/\/+$/, "");
  const row = rows[0];
  const invitationUrl = portalOrigin + "/acceso.html?claim=" + encodeURIComponent(row.project_id) + "&token=" + encodeURIComponent(row.claim_token);

  return json({ ok: true, exceptional_project_id: row.project_id, invitation_url: invitationUrl });
}

function safeHttpsUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
