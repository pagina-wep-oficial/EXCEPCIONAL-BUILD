import { bearer, supabaseConfig } from "../_lib/supabase.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

async function supabaseFetch(env, path, options = {}) {
  const { url, key } = supabaseConfig(env);
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

/** Verifica que quien llama sea administrador del CRM. */
async function isCrmAdmin(request, env) {
  const auth = bearer(request);
  if (!auth) return false;
  const response = await supabaseFetch(env, "/rest/v1/rpc/mi_rol_crm", {
    method: "POST",
    headers: { Authorization: auth },
    body: "{}"
  });
  if (!response.ok) return false;
  const rol = await response.json();
  return rol === "administrador";
}

/** Lee el proyecto por id con el token del admin (mismas reglas que el CRM). */
async function getProject(request, env, projectId) {
  const auth = bearer(request);
  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&select=*`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: auth } });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function updateProject(request, env, projectId, payload) {
  const auth = bearer(request);
  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: auth, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

// ---------- GitHub ----------

const GITHUB_API = "https://api.github.com";

const DEFAULT_BASE_BRANCH = "editor-base";

function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "excepcional-build-publish",
    ...extra
  };
}

async function ghJson(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: ghHeaders(token, options.headers || {}) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function ghMaybeJson(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: ghHeaders(token, options.headers || {}) });
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function ensureBaseBranchExists(token, owner, repoName, sourceBranch = "main", baseBranch = DEFAULT_BASE_BRANCH) {
  if (!token || !owner || !repoName || !baseBranch || baseBranch === sourceBranch) {
    return { created: false, branch: baseBranch || sourceBranch };
  }

  const currentBase = await ghMaybeJson(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    token
  );

  if (currentBase?.object?.sha) {
    return { created: false, branch: baseBranch };
  }

  const sourceRef = await ghJson(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${encodeURIComponent(sourceBranch)}`,
    token
  );

  await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: `refs/heads/${baseBranch}`,
      sha: sourceRef.object.sha
    })
  });

  return { created: true, branch: baseBranch };
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Sube todos los archivos al repo (blobs + tree + commit + ref). Devuelve {owner, repo, branch, baseBranch, baseBranchCreated}. */
async function publishToGitHub(token, repoName, files, { makePublic }) {
  const user = await ghJson(`${GITHUB_API}/user`, token);
  const owner = user.login;
  const branch = "main";

  let repo;
  try {
    repo = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, token);
  } catch {
    repo = null;
  }

  if (!repo) {
    repo = await ghJson(`${GITHUB_API}/user/repos`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repoName,
        description: "Sitio publicado desde el CRM Excepcional Build",
        private: !makePublic,
        auto_init: true
      })
    });
  } else if (repo.private && makePublic) {
    repo = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ private: false })
    });
  }

  // SHA actual de la rama (si existe)
  let headSha = null;
  try {
    const ref = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/ref/heads/${branch}`, token);
    headSha = ref.object.sha;
  } catch { /* rama nueva */ }

  // Crear blobs
  const blobShas = [];
  for (const file of files) {
    const blob = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/blobs`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: file.data, encoding: "base64" })
    });
    blobShas.push({ path: file.path, sha: blob.sha });
  }

  // Tree
  const tree = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: headSha || undefined,
      tree: blobShas.map(f => ({ path: f.path, mode: "100644", type: "blob", sha: f.sha }))
    })
  });

  // Commit
  const commit = await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Publica sitio desde CRM Excepcional Build",
      tree: tree.sha,
      parents: headSha ? [headSha] : []
    })
  });

  // Ref
  if (headSha) {
    await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs/heads/${branch}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: true })
    });
  } else {
    await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha })
    });
  }

  const baseInfo = await ensureBaseBranchExists(token, owner, repoName, branch, DEFAULT_BASE_BRANCH);

  return {
    owner,
    repo: repoName,
    branch,
    baseBranch: baseInfo.branch,
    baseBranchCreated: baseInfo.created
  };
}

/** Activa GitHub Pages en el repo (requiere repo público). Devuelve la URL o null. */
async function enableGitHubPages(token, owner, repoName) {
  try {
    await ghJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/pages`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: { branch: "main", path: "/" } })
    });
    return `https://${owner}.github.io/${repoName}/`;
  } catch {
    return null;
  }
}

// ---------- Cloudflare Pages (direct upload) ----------

const CF_API = "https://api.cloudflare.com/client/v4";

async function cfJson(url, token, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const msg = Array.isArray(body.errors) && body.errors[0] ? body.errors[0].message : `HTTP ${response.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return body.result;
}

/** Crea el proyecto Pages si no existe (direct upload). Devuelve el nombre final. */
async function ensurePagesProject(accountId, token, projectName) {
  try {
    return await cfJson(`${CF_API}/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}`, token);
  } catch { /* no existe */ }
  return cfJson(`${CF_API}/accounts/${accountId}/pages/projects`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName, production_branch: "main", direct_upload: true })
  });
}

/** Sube los archivos por direct upload y crea el deployment. Devuelve la URL pública. */
async function deployToCloudflare(accountId, token, projectName, files) {
  const project = await ensurePagesProject(accountId, token, projectName);

  // 1. upload token (JWT + endpoint R2)
  const { jwt, r2Endpoint } = await cfJson(
    `${CF_API}/accounts/${accountId}/pages/projects/${encodeURIComponent(project.name)}/upload-token`,
    token
  );

  // 2. subir cada archivo: PUT https://{r2Endpoint}/{jwt}/{sha256hex}
  const manifest = {};
  for (const file of files) {
    const bytes = base64ToBytes(file.data);
    if (bytes.byteLength > 25 * 1024 * 1024) {
      throw new Error(`El archivo ${file.path} pesa más de 25 MB; súbelo por separado o comprímelo.`);
    }
    const hash = await sha256Hex(bytes);
    const uploadUrl = `https://${r2Endpoint}/${jwt}/${hash}`;
    const put = await fetch(uploadUrl, { method: "PUT", body: bytes });
    if (!put.ok) throw new Error(`No se pudo subir ${file.path} (${put.status})`);
    manifest[file.path] = hash;
  }

  // 3. crear deployment con el manifest
  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest));
  form.append("branch", "main");
  const deploy = await cfJson(
    `${CF_API}/accounts/${accountId}/pages/projects/${encodeURIComponent(project.name)}/deployments`,
    token,
    { method: "POST", body: form }
  );

  return { url: deploy.url || `https://${project.name}.pages.dev`, deploymentId: deploy.id || "" };
}

// ---------- Endpoint ----------

const ALLOWED_EXT = /\.(html?|css|js|mjs|json|svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|md|woff2?|ttf|otf|eot|pdf|map|mp4|webm|ogg|mp3|wav|zip)$/i;

function sanitizeRepoName(raw) {
  const name = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return name.slice(0, 90);
}

function cleanFileList(rawFiles) {
  const out = [];
  const seen = new Set();
  for (const f of Array.isArray(rawFiles) ? rawFiles : []) {
    const path = String(f.path || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.includes("..") || path.startsWith(".git/") || path.startsWith("node_modules/")) continue;
    if (seen.has(path)) continue;
    const data = String(f.data || "");
    if (!data) continue;
    if (!ALLOWED_EXT.test(path)) continue;
    seen.add(path);
    out.push({ path, data });
  }
  return out;
}

// ---------- Fotos del editor: se copian al sitio para no gastar el egress de Supabase ----------

function base64ToStr(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

async function bundleSiteImages(files, env) {
  const { url } = supabaseConfig(env);
  const prefix = `${url.replace(/\/+$/, "")}/storage/v1/object/public/site-images/`;
  const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const urls = new Set();
  for (const f of files) {
    if (!/\.html?$/i.test(f.path)) continue;
    const html = base64ToStr(f.data);
    const re = new RegExp(escPrefix + "[^\"'\\s<>)\\\\]*", "g");
    let m;
    while ((m = re.exec(html)) !== null) urls.add(m[0]);
  }
  if (!urls.size) return { files, copied: 0, failed: 0 };

  const local = new Map();
  for (const u of urls) {
    const name = String(u.split("/").pop() || "").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || `foto-${local.size}.jpg`;
    local.set(u, `fotos/${name}`);
  }

  const copied = [];
  let failed = 0;
  for (const [u, path] of local) {
    try {
      const response = await fetch(u);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > 25 * 1024 * 1024) throw new Error("tamaño no permitido");
      files.push({ path, data: bytesToBase64(bytes) });
      copied.push([u, path]);
    } catch (error) {
      failed++;
      console.error(`No pudimos copiar la foto ${u}: ${error.message}`);
    }
  }

  if (copied.length) {
    for (const f of files) {
      if (!/\.html?$/i.test(f.path)) continue;
      let html = base64ToStr(f.data);
      for (const [u, path] of copied) html = html.split(u).join(path);
      f.data = bytesToBase64(new TextEncoder().encode(html));
    }
  }

  return { files, copied: copied.length, failed };
}

export async function onRequestPost(context) {
  try {
    const isAdmin = await isCrmAdmin(context.request, context.env);
    if (!isAdmin) return json({ ok: false, message: "Solo administradores pueden publicar sitios." }, 403);

    const body = await context.request.json().catch(() => ({}));
    const projectId = String(body.project_id || "");
    let files = cleanFileList(body.files);
    const wantCloudflare = Boolean(body.cloudflare);
    const wantGitHubPages = Boolean(body.github_pages);

    if (!projectId) return json({ ok: false, message: "Falta el proyecto." }, 400);
    if (!files.length) return json({ ok: false, message: "Selecciona los archivos del sitio antes de publicar." }, 400);
    if (!wantCloudflare && !wantGitHubPages) return json({ ok: false, message: "Elige al menos una plataforma de publicación." }, 400);

    // Copia las fotos del editor (Supabase) dentro del sitio publicado,
    // para que las visitas no gasten las descargas del plan Free.
    const { files: bundles, copied, failed } = await bundleSiteImages(files, context.env);
    files = bundles;

    const project = await getProject(context.request, context.env, projectId);
    if (!project) return json({ ok: false, message: "No encontramos el proyecto." }, 404);

    // Repo: editable desde el CRM; si no viene, derivar del nombre del proyecto
    const repoName = sanitizeRepoName(body.repo_name || project.site_repo_name || project.name || projectId);
    if (!repoName) return json({ ok: false, message: "Escribe un nombre válido para el repositorio." }, 400);

    const ghToken = context.env.GITHUB_TOKEN;
    const cfToken = context.env.CLOUDFLARE_API_TOKEN;
    const cfAccount = context.env.CLOUDFLARE_ACCOUNT_ID;

    const results = {};
    const warnings = [];

    // 1. GitHub (siempre: es el puente/backup)
    if (ghToken) {
      const gh = await publishToGitHub(ghToken, repoName, files, { makePublic: wantGitHubPages });
      results.owner = gh.owner;
      results.repo = gh.repo;
      results.branch = gh.branch;
      results.base_branch = gh.baseBranch;
      results.repo_url = `https://github.com/${gh.owner}/${gh.repo}`;

      if (gh.baseBranchCreated) {
        warnings.push(`Se creó la rama ${gh.baseBranch} como versión base inicial del proyecto.`);
      }

      if (wantGitHubPages) {
        const ghUrl = await enableGitHubPages(ghToken, gh.owner, gh.repo);
        if (ghUrl) results.github_pages_url = ghUrl;
        else warnings.push("No pudimos activar GitHub Pages (suele requerir repo público).");
      }
    } else {
      warnings.push("Falta GITHUB_TOKEN en Cloudflare Pages; solo se publicó en Cloudflare.");
    }

    // 2. Cloudflare (principal)
    if (wantCloudflare) {
      if (!cfToken || !cfAccount) {
        warnings.push("Falta configurar CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID en Cloudflare Pages.");
      } else {
        const cfProject = sanitizeRepoName(repoName) || "sitio";
        const cf = await deployToCloudflare(cfAccount, cfToken, cfProject, files);
        results.cloudflare_url = cf.url;
        results.deployment_id = cf.deploymentId;
      }
    }

    // 3. Guardar en el proyecto (apartado de administración)
    if (copied) warnings.push(`${copied} foto(s) del editor se copiaron al sitio publicado.`);
    if (failed) warnings.push(`${failed} foto(s) no se pudieron copiar y siguen cargándose desde Supabase.`);

    const payload = {
      site_repo_owner: results.owner || project.site_repo_owner || null,
      site_repo_name: results.repo || repoName,
      site_repo_branch: results.branch || "main",
      site_repo_path: "/",
      site_publish_provider: wantCloudflare && wantGitHubPages ? "both" : wantCloudflare ? "cloudflare" : "github_pages",
      site_live_url: results.cloudflare_url || results.github_pages_url || project.site_live_url || null,
      site_url: results.cloudflare_url || results.github_pages_url || project.site_url || null,
      site_visibility: "public"
    };
    await updateProject(context.request, context.env, projectId, payload);

    const ok = Boolean(results.cloudflare_url || results.github_pages_url);
    return json({ ok, results, warnings });
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: String(error.message || "No pudimos publicar el sitio.") }, 500);
  }
}
