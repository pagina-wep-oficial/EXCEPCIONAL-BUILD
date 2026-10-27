import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const GITHUB_API = "https://api.github.com";
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function projectAccess(request, env, projectId) {
  const user = await getUser(request, env);
  if (!user) return null;

  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&select=*`, {
    headers: { apikey: key, Authorization: bearer(request) }
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] ? { user, project: rows[0] } : null;
}

function normalizePath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

function repositoryPath(project, pagePath) {
  return [normalizePath(project?.site_repo_path), normalizePath(pagePath)].filter(Boolean).join("/");
}

function publicHttpsUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    const privateIpv4 = /^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
    if (url.protocol !== "https:" || !host || host === "localhost" || host.endsWith(".local") || privateIpv4 || host === "::1") return null;
    return url;
  } catch {
    return null;
  }
}

function pageUrl(siteUrl, pagePath) {
  const url = publicHttpsUrl(siteUrl);
  if (!url) return null;
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/${normalizePath(pagePath)}`.replace(/\/+/g, "/");
  url.search = "";
  url.searchParams.set("editor-check", String(Date.now()));
  return url;
}

function decodeGitHubContent(content = "") {
  const binary = atob(String(content).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function comparableHtml(value = "") {
  return String(value).replace(/\r\n?/g, "\n").trim();
}

async function githubPage(token, owner, repo, branch, path) {
  const encodedPath = normalizePath(path).split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "excepcional-build-editor" } }
  );
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  const body = await response.json();
  return decodeGitHubContent(body?.content || "");
}

async function repositoryPage(token, project, pagePath) {
  const owner = String(project.site_repo_owner || "").trim();
  const repo = String(project.site_repo_name || "").trim();
  const branch = String(project.site_repo_branch || "main").trim() || "main";

  try {
    return await githubPage(token, owner, repo, branch, repositoryPath(project, pagePath));
  } catch (error) {
    if (normalizePath(project.site_repo_path) || normalizePath(pagePath) !== "index.html") {
      throw error;
    }

    return githubPage(token, owner, repo, branch, "dist/index.html");
  }
}

export async function onRequestGet(context) {
  try {
    const projectId = new URL(context.request.url).searchParams.get("project_id") || "";
    if (!projectId) return json({ ok: false, message: "Falta el proyecto." }, 400);

    const access = await projectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);

    const project = access.project;
    const token = String(context.env.GITHUB_TOKEN || "").trim();
    const owner = String(project.site_repo_owner || "").trim();
    const repo = String(project.site_repo_name || "").trim();
    const branch = String(project.site_repo_branch || "main").trim() || "main";
    const pagePath = "index.html";
    const siteUrl = project.site_live_url || project.site_url || project.preview_url;
    const livePageUrl = pageUrl(siteUrl, pagePath);

    if (!token || !owner || !repo || !livePageUrl) {
      return json({ ok: false, message: "Este proyecto todavía no tiene lista la conexión de publicación." }, 409);
    }

    const [repoHtml, publicResponse] = await Promise.all([
      repositoryPage(token, project, pagePath),
      fetch(livePageUrl, { headers: { "Cache-Control": "no-cache" }, redirect: "follow" })
    ]);
    if (!publicResponse.ok) throw new Error(`Sitio ${publicResponse.status}`);

    const publicHtml = await publicResponse.text();
    return json({
      ok: true,
      ready: comparableHtml(repoHtml) === comparableHtml(publicHtml),
      live_url: livePageUrl.origin + livePageUrl.pathname.replace(/index\.html$/, ""),
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("editor-site-ready", error);
    return json({ ok: false, message: "No pudimos comprobar la actualización de tu página." }, 502);
  }
}
