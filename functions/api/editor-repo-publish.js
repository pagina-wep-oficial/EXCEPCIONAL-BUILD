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

function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function githubPath(path = "") {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join("/");
}

async function githubJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "excepcional-build-editor",
      ...(options.headers || {})
    }
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function onRequestPost(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    if (!token) return json({ ok:false, message:"Falta configurar GITHUB_TOKEN en Cloudflare Pages." }, 500);

    const body = await context.request.json();
    const projectId = String(body.project_id || "");
    const pages = Array.isArray(body.pages) ? body.pages : [];
    if (!projectId || !pages.length) return json({ ok:false, message:"Faltan páginas para publicar." }, 400);

    const access = await projectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok:false, message:"No tienes acceso a este proyecto." }, 403);

    const project = access.project;
    const owner = project.site_repo_owner;
    const repo = project.site_repo_name;
    const branch = project.site_repo_branch || "main";

    if (!owner || !repo) return json({ ok:false, message:"Este proyecto no tiene repo configurado." }, 400);

    const published = [];

    for (const page of pages) {
      const path = String(page.path || "");
      const html = String(page.edited_html || "");
      if (!path || !html) continue;

      const encodedPath = githubPath(path);
      const fileUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
      const current = await githubJson(fileUrl, token);

      await githubJson(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`, token, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Actualiza ${path} desde editor Excepcional Build`,
          content: b64(html),
          sha: current.sha,
          branch
        })
      });

      published.push(path);
    }

    return json({ ok:true, published });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:"No pudimos publicar en GitHub." }, 500);
  }
}
