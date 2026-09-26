import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const GITHUB_API = "https://api.github.com";

const DRAFT_META_KEY = "__editor_meta__";
const DEFAULT_BASE_BRANCH = "editor-base";
const PROTECTED_REPO_FILES = new Set(["CNAME", ".nojekyll"]);

function liveBranch(project) {
  return String(project?.site_repo_branch || "main").trim() || "main";
}

function readDraftMeta(elements = {}) {
  const raw = elements?.[DRAFT_META_KEY]?.value || "";
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function withDraftAssetBranch(elements = {}, branch = "main") {
  const next = elements && typeof elements === "object" ? { ...elements } : {};
  const meta = {
    ...readDraftMeta(next),
    asset_branch: branch
  };
  next[DRAFT_META_KEY] = {
    type: "__system__",
    value: JSON.stringify(meta)
  };
  return next;
}

async function projectAccess(request, env, projectId) {
  const user = await getUser(request, env);
  if (!user) return null;

  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&select=*`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: bearer(request)
    }
  });
  if (!response.ok) return null;

  const rows = await response.json();
  return rows?.[0] ? { user, project: rows[0] } : null;
}

function textToBase64(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function githubPath(path = "") {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(part => encodeURIComponent(part))
    .join("/");
}

function githubHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "excepcional-build-editor",
    ...extra
  };
}

async function githubJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: githubHeaders(token, options.headers || {})
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function githubGetFile(url, token) {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function githubGetBranchTree({ token, owner, repo, branch }) {
  const ref = await githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`, token);
  const commit = await githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${ref.object.sha}`, token);
  const tree = await githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${commit.tree.sha}?recursive=1`, token);
  return Array.isArray(tree?.tree) ? tree.tree : [];
}

async function githubGetBlob(token, owner, repo, sha) {
  return githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`, token);
}

async function copyBranchSnapshot({ token, owner, repo, fromBranch, toBranch, rootPath = "" }) {
  const prefix = normalizePath(rootPath);
  const tree = await githubGetBranchTree({ token, owner, repo, branch: fromBranch });
  const files = tree.filter(entry =>
    entry?.type === "blob" &&
    (!prefix || entry.path === prefix || entry.path.startsWith(`${prefix}/`))
  );

  for (const file of files) {
    const blob = await githubGetBlob(token, owner, repo, file.sha);
    const data = String(blob?.content || "").replace(/\n/g, "");
    await upsertGitHubFile({
      token,
      owner,
      repo,
      branch: toBranch,
      path: file.path,
      data,
      message: `Sincroniza ${file.path} desde ${fromBranch} a ${toBranch}`
    });
  }

  return files.map(file => file.path);
}

function pathInsideRoot(path = "", rootPath = "") {
  const filePath = normalizePath(path);
  const prefix = normalizePath(rootPath);
  if (!filePath) return false;
  if (!prefix) return true;
  return filePath === prefix || filePath.startsWith(`${prefix}/`);
}

function isProtectedRepoPath(path = "") {
  const filePath = normalizePath(path);
  return PROTECTED_REPO_FILES.has(filePath);
}

async function listBranchFiles({ token, owner, repo, branch, rootPath = "" }) {
  const tree = await githubGetBranchTree({ token, owner, repo, branch });
  return tree
    .filter(entry => entry?.type === "blob" && pathInsideRoot(entry.path, rootPath))
    .map(entry => normalizePath(entry.path))
    .filter(Boolean);
}

async function deleteGitHubFile({ token, owner, repo, branch, path, message }) {
  const encodedPath = githubPath(path);
  const fileUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  const current = await githubGetFile(fileUrl, token);
  if (!current?.sha) return false;

  await githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`, token, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      sha: current.sha,
      branch
    })
  });

  return true;
}

async function syncBranchSnapshotExact({ token, owner, repo, fromBranch, toBranch, rootPath = "", extraKeepPaths = [] }) {
  const liveFiles = await listBranchFiles({ token, owner, repo, branch: toBranch, rootPath });
  const copiedFiles = await copyBranchSnapshot({ token, owner, repo, fromBranch, toBranch, rootPath });

  const keep = new Set(copiedFiles.map(path => normalizePath(path)).filter(Boolean));

  (Array.isArray(extraKeepPaths) ? extraKeepPaths : []).forEach(path => {
    const normalized = normalizePath(path);
    if (!normalized || !pathInsideRoot(normalized, rootPath)) return;
    keep.add(normalized);
  });

  const deletedFiles = [];
  for (const filePath of liveFiles) {
    const normalized = normalizePath(filePath);
    if (!normalized || keep.has(normalized) || isProtectedRepoPath(normalized)) continue;

    const deleted = await deleteGitHubFile({
      token,
      owner,
      repo,
      branch: toBranch,
      path: normalized,
      message: `Elimina ${normalized} al restaurar ${fromBranch} en ${toBranch}`
    });

    if (deleted) deletedFiles.push(normalized);
  }

  return { copiedFiles, deletedFiles };
}

async function upsertGitHubFile({ token, owner, repo, branch, path, data, message }) {
  const encodedPath = githubPath(path);
  const fileUrl = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;
  const current = await githubGetFile(fileUrl, token);

  await githubJson(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: data,
      ...(current?.sha ? { sha: current.sha } : {}),
      branch
    })
  });
}

function escapeRegExp(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePath(path = "") {
  return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function splitExt(name = "") {
  const raw = String(name || "");
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return { base: raw, ext: "" };
  return { base: raw.slice(0, idx), ext: raw.slice(idx) };
}

function safeSegment(text = "", fallback = "archivo") {
  const out = String(text || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || fallback;
}

function editorAssetPrefix(project) {
  const owner = encodeURIComponent(project.site_repo_owner || "");
  const repo = encodeURIComponent(project.site_repo_name || "");
  const branch = encodeURIComponent(project.site_repo_branch || "main");
  return `/api/repo-asset/${owner}/${repo}@${branch}/`;
}

function editorAssetUrl(project, assetPath) {
  return `${editorAssetPrefix(project)}${normalizePath(assetPath)}`;
}

function storagePublicPrefix(env) {
  const { url } = supabaseConfig(env);
  return `${url.replace(/\/+$/, "")}/storage/v1/object/public/site-images/`;
}

function collectMatches(value, regex, out) {
  if (typeof value === "string") {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(value)) !== null) out.add(match[0]);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectMatches(item, regex, out));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(item => collectMatches(item, regex, out));
  }
}

function buildRelativePath(fromFile, toFile) {
  const from = normalizePath(fromFile).split("/").filter(Boolean);
  const to = normalizePath(toFile).split("/").filter(Boolean);
  from.pop();
  while (from.length && to.length && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const up = from.map(() => "..");
  return [...up, ...to].join("/") || "./";
}

function rewriteStringWithMap(text, replacements) {
  let out = String(text || "");
  replacements.forEach((target, source) => {
    out = out.split(source).join(target);
  });
  return out;
}

function rewriteValueDeep(value, replacements) {
  if (typeof value === "string") return rewriteStringWithMap(value, replacements);
  if (Array.isArray(value)) return value.map(item => rewriteValueDeep(item, replacements));
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([key, entry]) => {
      out[key] = rewriteValueDeep(entry, replacements);
    });
    return out;
  }
  return value;
}

function extractRepoAssetPath(url, project) {
  const prefix = editorAssetPrefix(project);
  const raw = String(url || "").trim();
  if (!raw) return "";

  let pathname = raw;
  try {
    const parsed = new URL(raw, "https://editor.local");
    pathname = `${parsed.pathname}${parsed.search || ""}`;
  } catch {
    pathname = raw;
  }

  if (!pathname.startsWith(prefix)) return "";
  return normalizePath(pathname.slice(prefix.length));
}

function pickRepoAssetPath(url, usedPaths) {
  let folder = "editor";
  let file = `foto-${usedPaths.size + 1}.jpg`;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    folder = safeSegment(parts[parts.length - 2] || folder, folder);
    file = safeSegment(parts[parts.length - 1] || file, file);
  } catch {
    file = safeSegment(url.split("/").pop() || file, file);
  }

  const { base, ext } = splitExt(file);
  let candidate = normalizePath(`fotos/${folder}/${base}${ext}`);
  let index = 2;
  while (usedPaths.has(candidate)) {
    candidate = normalizePath(`fotos/${folder}/${base}-${index}${ext}`);
    index++;
  }
  usedPaths.add(candidate);
  return candidate;
}

async function bundleRepoImages(pages, env, project) {
  const supabasePrefix = storagePublicPrefix(env);
  const repoPrefix = editorAssetPrefix(project);
  const supabaseRe = new RegExp(escapeRegExp(supabasePrefix) + "[^\"'\\s<>)\\\\]*", "g");
  const repoRe = new RegExp(escapeRegExp(repoPrefix) + "[^\"'\\s<>)\\\\]*", "g");

  const supabaseUrls = new Set();
  const repoUrls = new Set();
  for (const page of pages) {
    collectMatches(page.edited_html || "", supabaseRe, supabaseUrls);
    collectMatches(page.elements || {}, supabaseRe, supabaseUrls);
    collectMatches(page.edited_html || "", repoRe, repoUrls);
    collectMatches(page.elements || {}, repoRe, repoUrls);
  }

  const assetsByUrl = new Map();
  const usedPaths = new Set();

  repoUrls.forEach(url => {
    const repoPath = extractRepoAssetPath(url, project);
    if (!repoPath) return;
    usedPaths.add(repoPath);
    assetsByUrl.set(url, { repoPath, editorUrl: editorAssetUrl(project, repoPath), copied: false });
  });

  const assetFiles = [];
  let copied = 0;
  let failed = 0;

  for (const url of supabaseUrls) {
    const repoPath = pickRepoAssetPath(url, usedPaths);
    const editorUrl = editorAssetUrl(project, repoPath);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.byteLength || bytes.byteLength > 25 * 1024 * 1024) throw new Error("tamaño no permitido");
      assetFiles.push({
        path: repoPath,
        data: bytesToBase64(bytes),
        message: `Agrega ${repoPath} desde editor Excepcional Build`
      });
      assetsByUrl.set(url, { repoPath, editorUrl, copied: true });
      copied++;
    } catch (error) {
      failed++;
      console.error(`No pudimos copiar la foto ${url}: ${error.message}`);
    }
  }

  const nextPages = pages.map(page => {
    const htmlReplacements = new Map();
    const draftReplacements = new Map();

    assetsByUrl.forEach((asset, sourceUrl) => {
      htmlReplacements.set(sourceUrl, buildRelativePath(page.path, asset.repoPath));
      draftReplacements.set(sourceUrl, asset.editorUrl);
    });

    return {
      path: page.path,
      published_html: rewriteStringWithMap(page.edited_html || "", htmlReplacements),
      draft_html: rewriteStringWithMap(page.edited_html || "", htmlReplacements),
      draft_elements: rewriteValueDeep(page.elements || {}, draftReplacements)
    };
  });

  return { pages: nextPages, assetFiles, copied, failed };
}

async function updateDraftRecord(context, access, page) {
  const { url, key } = supabaseConfig(context.env);
  const response = await fetch(
    `${url}/rest/v1/client_site_repo_drafts?project_id=eq.${encodeURIComponent(access.project.id)}&page_path=eq.${encodeURIComponent(page.path)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: bearer(context.request),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        edited_html: page.draft_html,
        elements: page.draft_elements || {},
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json().catch(() => []);
  return rows?.[0] || null;
}

export async function onRequestPost(context) {
  try {
    const token = context.env.GITHUB_TOKEN;
    if (!token) return json({ ok: false, message: "Falta configurar GITHUB_TOKEN en Cloudflare Pages." }, 500);

    const body = await context.request.json().catch(() => ({}));
    const projectId = String(body.project_id || "");
    const baseBranch = String(body.base_branch || DEFAULT_BASE_BRANCH).trim() || DEFAULT_BASE_BRANCH;
    const useBaseSnapshot = body.use_base_snapshot === true;
    const pages = (Array.isArray(body.pages) ? body.pages : [])
      .map(page => ({
        path: normalizePath(page?.path || ""),
        edited_html: String(page?.edited_html || ""),
        elements: page?.elements && typeof page.elements === "object" ? page.elements : {}
      }))
      .filter(page => page.path && page.edited_html);

    if (!projectId || !pages.length) return json({ ok: false, message: "Faltan páginas para publicar." }, 400);

    const access = await projectAccess(context.request, context.env, projectId);
    if (!access) return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);

    const project = access.project;
    const owner = project.site_repo_owner;
    const repo = project.site_repo_name;
    const branch = liveBranch(project);
    if (!owner || !repo) return json({ ok: false, message: "Este proyecto no tiene repo configurado." }, 400);

    const bundled = await bundleRepoImages(pages, context.env, project);

    let syncedBaseFiles = 0;
    let deletedBaseFiles = 0;
    if (useBaseSnapshot && baseBranch !== branch) {
      const baseSync = await syncBranchSnapshotExact({
        token,
        owner,
        repo,
        fromBranch: baseBranch,
        toBranch: branch,
        rootPath: project.site_repo_path || "",
        extraKeepPaths: [
          ...bundled.pages.map(page => page.path),
          ...bundled.assetFiles.map(asset => asset.path)
        ]
      });

      syncedBaseFiles = baseSync.copiedFiles.length;
      deletedBaseFiles = baseSync.deletedFiles.length;
    }

    const published = [];
    const savedDrafts = [];

    for (const asset of bundled.assetFiles) {
      await upsertGitHubFile({
        token,
        owner,
        repo,
        branch,
        path: asset.path,
        data: asset.data,
        message: asset.message
      });
    }

    for (const page of bundled.pages) {
      await upsertGitHubFile({
        token,
        owner,
        repo,
        branch,
        path: page.path,
        data: textToBase64(page.published_html),
        message: `Actualiza ${page.path} desde editor Excepcional Build`
      });

      const nextDraftElements = withDraftAssetBranch(page.draft_elements || {}, branch);
      const saved = await updateDraftRecord(context, access, {
        ...page,
        draft_elements: nextDraftElements
      });

      published.push(page.path);
      savedDrafts.push({
        page_path: page.path,
        edited_html: saved?.edited_html || page.draft_html,
        elements: saved?.elements || nextDraftElements
      });
    }

    const warnings = [];
    if (syncedBaseFiles) warnings.push(`${syncedBaseFiles} archivo(s) de la versión base se copiaron a la rama publicada.`);
    if (deletedBaseFiles) warnings.push(`${deletedBaseFiles} archivo(s) sobrante(s) se borraron de la rama publicada para dejarla alineada con la versión base.`);
    if (bundled.copied) warnings.push(`${bundled.copied} foto(s) del editor se copiaron al repo publicado.`);
    if (bundled.failed) warnings.push(`${bundled.failed} foto(s) no se pudieron copiar y siguen apuntando a Supabase.`);

    return json({
      ok: true,
      published,
      drafts: savedDrafts,
      copied: bundled.copied,
      failed: bundled.failed,
      warnings
    });
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: "No pudimos publicar en GitHub." }, 500);
  }
}
