import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function projectAccess(request, env, projectId) {
  const user = await getUser(request, env);
  if (!user) return null;

  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: bearer(request) } });
  if (!response.ok) return null;

  const rows = await response.json();
  return rows?.[0] ? { user, project: rows[0] } : null;
}

export async function onRequestGet(context) {
  try {
    const projectId = new URL(context.request.url).searchParams.get("project_id");
    if (!projectId) return json({ ok:false, message:"Falta el proyecto." }, 400);

    const access = await projectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok:false, message:"No tienes acceso a este proyecto." }, 403);

    const { url, key } = supabaseConfig(context.env);
    const endpoint = `${url}/rest/v1/client_site_repo_drafts?project_id=eq.${encodeURIComponent(projectId)}&select=*`;
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: bearer(context.request) } });
    if (!response.ok) throw new Error(await response.text());

    return json({ ok:true, drafts: await response.json() });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:"No pudimos cargar el borrador." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const projectId = String(body.project_id || "");
    const pagePath = String(body.page_path || "");
    if (!projectId || !pagePath) return json({ ok:false, message:"Faltan datos del borrador." }, 400);

    const access = await projectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok:false, message:"No tienes acceso a este proyecto." }, 403);

    const payload = {
      project_id: projectId,
      user_id: access.user.id,
      page_path: pagePath,
      original_html: String(body.original_html || ""),
      edited_html: String(body.edited_html || ""),
      elements: body.elements || {},
      updated_at: new Date().toISOString()
    };

    const { url, key } = supabaseConfig(context.env);
    const response = await fetch(`${url}/rest/v1/client_site_repo_drafts?on_conflict=project_id,page_path`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: bearer(context.request),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return json({ ok:true, draft: rows?.[0] || null });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:"No pudimos guardar el borrador." }, 500);
  }
}
