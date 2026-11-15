import { bearer, getUser, supabaseConfig } from "../_lib/supabase.js";
import { buildGeneratedSiteFiles } from "../_lib/generated-store-template.js";

const GITHUB_API = "https://api.github.com";
const CF_API = "https://api.cloudflare.com/client/v4";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function validUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function slugify(value) {
  return String(value || "sitio")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 54) || "sitio";
}

async function supabaseRequest(env, path, options = {}) {
  const { url, key } = supabaseConfig(env);
  return fetch(`${url}${path}`, {
    ...options,
    headers: { apikey: key, "Content-Type": "application/json", ...(options.headers || {}) }
  });
}

async function isCrmAdmin(request, env) {
  const auth = bearer(request);
  if (!auth) return false;
  const response = await supabaseRequest(env, "/rest/v1/rpc/mi_rol_crm", {
    method: "POST", headers: { Authorization: auth }, body: "{}"
  });
  return response.ok && (await response.json()) === "administrador";
}

async function readProject(request, env, projectId) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&select=*`,
    { headers: { Authorization: bearer(request) } }
  );
  if (!response.ok) throw new Error("CRM_PROJECT_READ_FAILED");
  return (await response.json())[0] || null;
}

async function updateProject(request, env, projectId, body) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      headers: { Authorization: bearer(request), Prefer: "return=representation" },
      body: JSON.stringify(body)
    }
  );
  if (!response.ok) throw new Error("CRM_PROJECT_UPDATE_FAILED");
  return (await response.json())[0] || null;
}

async function readGeneration(request, env, projectId) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/client_site_generations?project_id=eq.${encodeURIComponent(projectId)}&select=*`,
    { headers: { Authorization: bearer(request) } }
  );
  if (!response.ok) throw new Error("SITE_GENERATOR_SCHEMA_REQUIRED");
  return (await response.json())[0] || null;
}

async function saveGeneration(request, env, projectId, payload) {
  const response = await supabaseRequest(
    env,
    `/rest/v1/client_site_generations?project_id=eq.${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      headers: { Authorization: bearer(request), Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() })
    }
  );
  if (!response.ok) throw new Error("SITE_GENERATION_SAVE_FAILED");
  return (await response.json())[0] || null;
}

async function createGeneration(request, env, payload) {
  const response = await supabaseRequest(env, "/rest/v1/client_site_generations", {
    method: "POST",
    headers: { Authorization: bearer(request), Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("SITE_GENERATOR_SCHEMA_REQUIRED");
  return (await response.json())[0] || null;
}

function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "excepcional-build-generator",
    ...extra
  };
}

async function gh(token, path, options = {}, allow404 = false) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: ghHeaders(token, options.headers || {})
  });
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`GITHUB_${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function githubIdentity(token, configuredOwner) {
  const user = await gh(token, "/user");
  return String(configuredOwner || user.login).trim();
}

async function createRepository(token, owner, repoName, files) {
  const existing = await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, {}, true);
  if (existing) throw new Error("SITE_REPOSITORY_NAME_CONFLICT");

  const endpoint = owner.includes("-") || owner !== (await gh(token, "/user")).login
    ? `/orgs/${encodeURIComponent(owner)}/repos`
    : "/user/repos";
  const repo = await gh(token, endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: repoName,
      private: true,
      auto_init: false,
      description: "Sitio generado por Excepcional Build"
    })
  });

  const blobs = [];
  for (const file of files) {
    const blob = await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: file.data, encoding: "base64" })
    });
    blobs.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tree: blobs })
  });
  const commit = await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Crear sitio desde plantilla Excepcional Build", tree: tree.sha, parents: [] })
  });
  await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha })
  });
  await gh(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "refs/heads/editor-base", sha: commit.sha })
  });
  return { id: String(repo.id), owner, name: repoName, url: repo.html_url };
}

async function cf(token, path, options = {}, allow404 = false) {
  const response = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (allow404 && response.status === 404) return null;
  if (!response.ok || body.success === false) {
    const code = body?.errors?.[0]?.code || response.status;
    throw new Error(`CLOUDFLARE_${code}`);
  }
  return body.result;
}

async function createGitPagesProject(token, accountId, name, repository) {
  const existing = await cf(token, `/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(name)}`, {}, true);
  if (existing) {
    const source = existing?.source?.config || {};
    if (String(source.owner || "") === repository.owner && String(source.repo_name || "") === repository.name) {
      return existing;
    }
    throw new Error("PAGES_PROJECT_NAME_CONFLICT");
  }
  return cf(token, `/accounts/${encodeURIComponent(accountId)}/pages/projects`, {
    method: "POST",
    body: JSON.stringify({
      name,
      production_branch: "main",
      source: {
        type: "github",
        config: {
          owner: repository.owner,
          repo_name: repository.name,
          repo_id: repository.id,
          production_branch: "main",
          preview_deployment_setting: "all",
          pr_comments_enabled: false
        }
      },
      build_config: { build_command: "", destination_dir: "dist", root_dir: "" }
    })
  });
}

async function provisionStore(env, exceptionalProjectId, name) {
  const origin = String(env.ITM_STORE_OWNER_ORIGIN || "https://itm-void-excepcional.pages.dev").replace(/\/+$/, "");
  const secret = String(env.EXCEPTIONAL_STORE_PROVISION_SECRET || "").trim();
  if (secret.length < 32) throw new Error("STORE_PROVISION_NOT_CONFIGURED");
  const response = await fetch(`${origin}/api/exceptional-store-provision`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ exceptional_project_id: exceptionalProjectId, name })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok || !validUuid(data?.project?.id)) {
    throw new Error(String(data?.code || "STORE_PROVISION_FAILED"));
  }
  return data.project.id;
}

function safeError(error) {
  const code = String(error?.message || "SITE_GENERATION_FAILED").replace(/[^A-Z0-9_]/g, "_").slice(0, 120);
  return code || "SITE_GENERATION_FAILED";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let generation = null;
  let projectId = "";
  try {
    if (!(await isCrmAdmin(request, env))) return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    const user = await getUser(request, env);
    const body = await request.json().catch(() => ({}));
    projectId = String(body.project_id || "").trim();
    if (!validUuid(projectId)) return json({ ok: false, code: "PROJECT_ID_INVALID" }, 400);

    const project = await readProject(request, env, projectId);
    if (!project) return json({ ok: false, code: "PROJECT_NOT_FOUND" }, 404);

    generation = await readGeneration(request, env, projectId);
    if (generation?.status === "published") {
      return json({
        ok: true,
        reused: true,
        generation,
        message: "La página ya está creada.",
        resources: {
          repository: generation.github_owner && generation.github_repo
            ? `https://github.com/${generation.github_owner}/${generation.github_repo}`
            : null,
          public_url: generation.public_url || null,
          itm_project_id: generation.itm_project_id || null
        }
      });
    }

    const slug = String(generation?.slug || `${slugify(project.name)}-${projectId.slice(0, 8)}`).slice(0, 63);
    if (!generation) {
      generation = await createGeneration(request, env, {
        project_id: projectId,
        created_by: user?.id || null,
        slug,
        status: "provisioning_store"
      });
    }

    let itmProjectId = String(generation.itm_project_id || project.source_itm_project_id || "");
    if (!validUuid(itmProjectId)) {
      generation = await saveGeneration(request, env, projectId, { status: "provisioning_store", last_error_code: null, last_error_message: null });
      itmProjectId = await provisionStore(env, projectId, project.name);
      generation = await saveGeneration(request, env, projectId, { itm_project_id: itmProjectId, status: "creating_repository" });
      await updateProject(request, env, projectId, { source_itm_project_id: itmProjectId, store_enabled: true, updated_at: new Date().toISOString() });
    }

    const githubToken = String(env.GITHUB_TOKEN || "").trim();
    if (!githubToken) throw new Error("GITHUB_NOT_CONFIGURED");
    const repoName = slug;
    let repository;
    if (generation.github_owner && generation.github_repo) {
      const remoteRepository = await gh(githubToken, `/repos/${encodeURIComponent(generation.github_owner)}/${encodeURIComponent(generation.github_repo)}`);
      repository = {
        owner: generation.github_owner,
        name: generation.github_repo,
        id: String(remoteRepository.id),
        url: String(remoteRepository.html_url)
      };
    } else {
      generation = await saveGeneration(request, env, projectId, { status: "creating_repository" });
      const owner = await githubIdentity(githubToken, env.GITHUB_SITE_OWNER);
      repository = await createRepository(githubToken, owner, repoName, buildGeneratedSiteFiles({ projectId, itmProjectId, projectName: project.name }));
      generation = await saveGeneration(request, env, projectId, { github_owner: repository.owner, github_repo: repository.name, status: "creating_pages" });
    }

    const cfToken = String(env.CLOUDFLARE_API_TOKEN || "").trim();
    const cfAccount = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
    if (!cfToken || !cfAccount) throw new Error("CLOUDFLARE_NOT_CONFIGURED");
    const pagesName = String(generation.cloudflare_project || slug);
    if (!generation.cloudflare_project) {
      generation = await saveGeneration(request, env, projectId, { status: "creating_pages" });
      await createGitPagesProject(cfToken, cfAccount, pagesName, repository);
      generation = await saveGeneration(request, env, projectId, { cloudflare_project: pagesName });
    }

    const publicUrl = `https://${pagesName}.pages.dev`;
    const verification = await fetch(publicUrl, { redirect: "follow" }).catch(() => null);
    const published = Boolean(verification?.ok);
    generation = await saveGeneration(request, env, projectId, {
      status: published ? "published" : "creating_pages",
      public_url: publicUrl,
      completed_at: published ? new Date().toISOString() : null,
      last_error_code: published ? null : "PAGES_BUILD_PENDING",
      last_error_message: published ? null : "Cloudflare Pages todavía está compilando el primer despliegue."
    });

    await updateProject(request, env, projectId, {
      source_itm_project_id: itmProjectId,
      store_enabled: true,
      store_admin_url: `${String(env.ITM_STORE_OWNER_ORIGIN || "https://itm-void-excepcional.pages.dev").replace(/\/+$/, "")}/tienda-admin.html?project=${encodeURIComponent(itmProjectId)}`,
      site_repo_owner: repository.owner,
      site_repo_name: repository.name,
      site_repo_branch: "main",
      site_repo_path: "dist",
      site_editor_pages: ["index.html"],
      site_editor_mode: "html_repo",
      site_publish_provider: "cloudflare_pages_git",
      site_live_url: publicUrl,
      site_url: publicUrl,
      preview_url: publicUrl,
      updated_at: new Date().toISOString()
    });

    return json({
      ok: true,
      pending: !published,
      message: published ? "Listo: página creada." : "Repositorio y Pages creados. Cloudflare está compilando el primer despliegue.",
      generation,
      resources: { repository: repository.url, public_url: publicUrl, itm_project_id: itmProjectId }
    }, published ? 201 : 202);
  } catch (error) {
    const code = safeError(error);
    console.error("project site generation failed", code);
    if (generation && projectId) {
      await saveGeneration(request, env, projectId, { status: code.includes("CLOUDFLARE") ? "needs_authorization" : "failed", last_error_code: code, last_error_message: "La creación se detuvo. Puedes reintentar sin duplicar los recursos ya registrados." }).catch(() => {});
    }
    return json({ ok: false, code, message: "No se completó la creación. Revisa el estado y vuelve a intentarlo." }, 500);
  }
}

export async function onRequestGet(context) {
  try {
    if (!(await isCrmAdmin(context.request, context.env))) return json({ ok: false, code: "ADMIN_REQUIRED" }, 403);
    const id = new URL(context.request.url).searchParams.get("project_id") || "";
    if (!validUuid(id)) return json({ ok: false, code: "PROJECT_ID_INVALID" }, 400);
    const generation = await readGeneration(context.request, context.env, id);
    return json({ ok: true, generation });
  } catch (error) {
    return json({ ok: false, code: safeError(error) }, 500);
  }
}
