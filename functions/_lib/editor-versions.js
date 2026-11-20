import { bearer, getUser, supabaseConfig } from "./supabase.js";
import { versionStorage } from "./editor-version-storage.js";

export const EDITOR_VERSION_LIMIT = 40;
export const EDITOR_VERSION_RETENTION_DAYS = 7;
export const EDITOR_VERSION_RETENTION_MS = EDITOR_VERSION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function jsonHeaders(request, env, service = false) {
  const { key } = supabaseConfig(env);
  return {
    apikey: service ? String(env.SUPABASE_SERVICE_ROLE_KEY || key) : key,
    Authorization: service ? `Bearer ${String(env.SUPABASE_SERVICE_ROLE_KEY || key)}` : bearer(request),
    "Content-Type": "application/json"
  };
}

export function normalizeVersionPath(value = "") {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

export function versionBucket(env) {
  return versionStorage(env);
}

export function versionPrefix(projectId, versionId) {
  return `projects/${normalizeVersionPath(projectId)}/versions/${normalizeVersionPath(versionId)}`;
}

function versionManifestKey(projectId, versionId) {
  return `${versionPrefix(projectId, versionId)}/manifest.json`;
}

function versionAssetKey(projectId, versionId, filePath) {
  return `${versionPrefix(projectId, versionId)}/files/${normalizeVersionPath(filePath)}`;
}

function bytesFromBase64(value = "") {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }

  return btoa(binary);
}

function contentTypeFor(path = "") {
  const ext = String(path).split(".").pop()?.toLowerCase();
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
    ico: "image/x-icon"
  })[ext] || "application/octet-stream";
}

const MAX_VERSION_ASSET_BYTES = 25 * 1024 * 1024;

function isSafeSnapshotPath(value = "", pageOnly = false) {
  const raw = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const path = normalizeVersionPath(raw);
  return Boolean(
    raw &&
    path === raw &&
    !raw.split("/").some(part => part === "." || part === "..") &&
    (!pageOnly || /\.html?$/i.test(path))
  );
}

function normalizeSnapshotPages(pages = []) {
  const seen = new Set();

  return (Array.isArray(pages) ? pages : []).map(page => {
    const path = normalizeVersionPath(page?.path);

    if (!isSafeSnapshotPath(path, true)) {
      throw new Error("VERSION_SNAPSHOT_PAGE_INVALID");
    }

    if (seen.has(path)) {
      throw new Error("VERSION_SNAPSHOT_PAGE_DUPLICATE");
    }

    seen.add(path);

    return {
      path,
      html: String(
        page?.published_html ??
        page?.html ??
        page?.edited_html ??
        ""
      )
    };
  });
}

function normalizeSnapshotAssets(assets = []) {
  const seen = new Set();

  return (Array.isArray(assets) ? assets : []).map(asset => {
    const path = normalizeVersionPath(asset?.path);
    const data = String(asset?.data || "").replace(/\s/g, "");

    if (!isSafeSnapshotPath(path) || !data || seen.has(path)) {
      throw new Error("VERSION_SNAPSHOT_ASSET_INVALID");
    }

    let bytes;
    try {
      bytes = bytesFromBase64(data);
    } catch {
      throw new Error("VERSION_SNAPSHOT_ASSET_INVALID");
    }

    if (!bytes.byteLength || bytes.byteLength > MAX_VERSION_ASSET_BYTES) {
      throw new Error("VERSION_SNAPSHOT_ASSET_INVALID");
    }

    seen.add(path);

    return {
      path,
      data,
      bytes,
      contentType: String(
        asset?.content_type ||
        asset?.contentType ||
        contentTypeFor(path)
      )
    };
  });
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function supabaseFetch(env, request, path, options = {}, service = false) {
  const { url } = supabaseConfig(env);
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...jsonHeaders(request, env, service),
      ...(options.headers || {})
    }
  });
}

async function supabaseJson(env, request, path, options = {}, service = false) {
  const response = await supabaseFetch(env, request, path, options, service);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || JSON.stringify(body) || `Supabase ${response.status}`);
  return body;
}

export async function editorProjectAccess(request, env, projectId) {
  const user = await getUser(request, env);
  if (!user) return null;

  const rows = await supabaseJson(
    env,
    request,
    `/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&select=*`
  );
  return rows?.[0] ? { user, project: rows[0] } : null;
}

export async function listProjectVersions(request, env, projectId, service = false) {
  const since = new Date(Date.now() - EDITOR_VERSION_RETENTION_MS).toISOString();
  const query = [
    `project_id=eq.${encodeURIComponent(projectId)}`,
    "status=eq.published",
    `created_at=gte.${encodeURIComponent(since)}`,
    "order=created_at.desc"
  ].join("&");
  return supabaseJson(env, request, `/rest/v1/client_editor_versions?${query}`, {}, service);
}

export async function getVersion(request, env, projectId, versionId, service = false) {
  const query = [
    `id=eq.${encodeURIComponent(versionId)}`,
    `project_id=eq.${encodeURIComponent(projectId)}`,
    "select=*",
    "limit=1"
  ].join("&");
  const rows = await supabaseJson(env, request, `/rest/v1/client_editor_versions?${query}`, {}, service);
  return rows?.[0] || null;
}

export async function createPendingVersion({ request, env, project, user, pages, bundled }) {
  const bucket = versionBucket(env);
  const projectId = String(project.id);
  const current = await listProjectVersions(request, env, projectId);

  if (current.length >= EDITOR_VERSION_LIMIT) {
    const oldest = current[current.length - 1];
    const error = new Error("VERSION_LIMIT_REACHED");
    error.availableAt = oldest?.expires_at || null;
    throw error;
  }

  const snapshotPages = normalizeSnapshotPages(bundled?.pages || pages);
  const snapshotAssets = normalizeSnapshotAssets(
    bundled?.snapshotAssets || bundled?.assetFiles || []
  );

  const newestQuery = `project_id=eq.${encodeURIComponent(projectId)}&select=version_number&order=version_number.desc&limit=1`;
  const newest = await supabaseJson(
    env,
    request,
    `/rest/v1/client_editor_versions?${newestQuery}`
  );

  const versionNumber = Number(newest?.[0]?.version_number || 0) + 1;
  const id = crypto.randomUUID();
  const snapshotKey = versionManifestKey(projectId, id);
  const expiresAt = new Date(Date.now() + EDITOR_VERSION_RETENTION_MS).toISOString();

  const created = await supabaseJson(env, request, "/rest/v1/client_editor_versions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      project_id: projectId,
      user_id: user.id,
      version_number: versionNumber,
      status: "pending",
      summary: buildVersionSummary(snapshotPages, {
        pages: snapshotPages,
        snapshotAssets
      }),
      snapshot_key: snapshotKey,
      expires_at: expiresAt
    })
  });

  const version = created?.[0];
  if (!version) throw new Error("VERSION_INDEX_CREATE_FAILED");

  const files = [];
  const createdKeys = new Set([snapshotKey]);
  let sizeBytes = 0;

  try {
    for (const asset of snapshotAssets) {
      const key = versionAssetKey(projectId, id, asset.path);
      const sha256 = await sha256Hex(asset.bytes);

      await bucket.put(key, asset.bytes, {
        httpMetadata: {
          contentType: asset.contentType,
          cacheControl: "private, max-age=31536000"
        }
      });

      createdKeys.add(key);
      sizeBytes += asset.bytes.byteLength;

      files.push({
        version_id: id,
        project_id: projectId,
        file_path: asset.path,
        r2_key: key,
        file_kind: "asset",
        content_type: asset.contentType,
        size_bytes: asset.bytes.byteLength,
        sha256
      });
    }

    const manifest = {
      format: 2,
      id,
      project_id: projectId,
      created_at: version.created_at,
      pages: snapshotPages,
      assets: files
        .filter(file => file.file_kind === "asset")
        .map(file => ({
          path: file.file_path,
          key: file.r2_key,
          content_type: file.content_type,
          size_bytes: file.size_bytes,
          sha256: file.sha256
        }))
    };

    const manifestBody = JSON.stringify(manifest);
    const manifestBytes = new TextEncoder().encode(manifestBody);

    await bucket.put(snapshotKey, manifestBody, {
      httpMetadata: {
        contentType: "application/json",
        cacheControl: "private, max-age=31536000"
      }
    });

    sizeBytes += manifestBytes.byteLength;

    files.push({
      version_id: id,
      project_id: projectId,
      file_path: "manifest.json",
      r2_key: snapshotKey,
      file_kind: "manifest",
      content_type: "application/json",
      size_bytes: manifestBytes.byteLength,
      sha256: await sha256Hex(manifestBytes)
    });

    if (files.length) {
      await supabaseJson(env, request, "/rest/v1/client_editor_version_files", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(files)
      });
    }

    const updated = await supabaseJson(
      env,
      request,
      `/rest/v1/client_editor_versions?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          size_bytes: sizeBytes,
          file_count: files.length,
          updated_at: new Date().toISOString()
        })
      }
    );

    return {
      ...(updated?.[0] || version),
      manifest,
      files
    };
  } catch (error) {
    await Promise.all(
      [...createdKeys].map(key =>
        bucket.delete(key).catch(cleanupError => {
          console.error("version object cleanup failed", cleanupError);
        })
      )
    );

    await failVersion({ request, env, version, service: false });

    throw error;
  }
}

export async function markVersionPublished(request, env, versionId, commitSha = null) {
  const rows = await supabaseJson(env, request, `/rest/v1/client_editor_versions?id=eq.${encodeURIComponent(versionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      status: "published",
      commit_sha: commitSha || null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });
  return rows?.[0] || null;
}

export async function failVersion({ request, env, version, service = false }) {
  if (!version?.id) return;
  try {
    const bucket = versionBucket(env);
    const files = await supabaseJson(
      env,
      request,
      `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}&select=r2_key`,
      {},
      service
    );
    await Promise.all((files || []).map(file => bucket.delete(file.r2_key)));
  } catch (error) {
    console.error("version cleanup failed", error);
  }

  try {
    await supabaseJson(
      env,
      request,
      `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
      service
    );
  } catch (error) {
    console.error("version file index cleanup failed", error);
  }

  await supabaseFetch(
    env,
    request,
    `/rest/v1/client_editor_versions?id=eq.${encodeURIComponent(version.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() })
    },
    service
  );
}

function validateVersionManifest(version, manifest) {
  const format = Number(manifest?.format || 0);

  if (
    ![1, 2].includes(format) ||
    String(manifest?.id || "") !== String(version?.id || "") ||
    String(manifest?.project_id || "") !== String(version?.project_id || "")
  ) {
    throw new Error("VERSION_SNAPSHOT_INVALID");
  }

  const pages = normalizeSnapshotPages(manifest.pages);
  const seenAssets = new Set();

  const assets = (Array.isArray(manifest.assets) ? manifest.assets : []).map(asset => {
    const originalPath = String(asset?.path || "");
    const path = normalizeVersionPath(originalPath);
    const expectedKey = versionAssetKey(version.project_id, version.id, path);
    const sizeBytes = Number(asset?.size_bytes || 0);
    const sha256 = String(asset?.sha256 || "").toLowerCase();

    if (
      !isSafeSnapshotPath(originalPath) ||
      seenAssets.has(path) ||
      String(asset?.key || "") !== expectedKey ||
      !Number.isInteger(sizeBytes) ||
      sizeBytes <= 0 ||
      sizeBytes > MAX_VERSION_ASSET_BYTES ||
      (format >= 2 && !/^[a-f0-9]{64}$/.test(sha256))
    ) {
      throw new Error("VERSION_SNAPSHOT_INVALID");
    }

    seenAssets.add(path);

    return {
      path,
      key: expectedKey,
      content_type: String(asset?.content_type || contentTypeFor(path)),
      size_bytes: sizeBytes,
      sha256: asset.sha256 || null
    };
  });

  return {
    ...manifest,
    format,
    pages,
    assets
  };
}

export async function readVersionManifest(request, env, version) {
  const bucket = versionBucket(env);
  const object = await bucket.get(version.snapshot_key);

  if (!object) {
    throw new Error("VERSION_SNAPSHOT_NOT_FOUND");
  }

  const manifest = await object.json();
  return validateVersionManifest(version, manifest);
}

export async function readVersionAssetFiles(request, env, version, manifest = null) {
  const snapshot = manifest
    ? validateVersionManifest(version, manifest)
    : await readVersionManifest(request, env, version);

  const bucket = versionBucket(env);
  const files = [];

  for (const asset of snapshot.assets) {
    const object = await bucket.get(asset.key);

    if (!object) {
      throw new Error("VERSION_SNAPSHOT_ASSET_MISSING");
    }

    const bytes = new Uint8Array(await object.arrayBuffer());

    if (
      bytes.byteLength !== asset.size_bytes ||
      bytes.byteLength <= 0 ||
      bytes.byteLength > MAX_VERSION_ASSET_BYTES
    ) {
      throw new Error("VERSION_SNAPSHOT_ASSET_INVALID");
    }

    if (asset.sha256 && await sha256Hex(bytes) !== asset.sha256) {
      throw new Error("VERSION_SNAPSHOT_ASSET_TAMPERED");
    }

    files.push({
      path: asset.path,
      data: bytesToBase64(bytes),
      content_type: asset.content_type,
      size_bytes: bytes.byteLength,
      sha256: asset.sha256
    });
  }

  return files;
}

export async function protectedVersionIds(request, env, projectId) {
  const versions = await listProjectVersions(request, env, projectId);
  return new Set(versions.slice(0, 2).map(version => version.id));
}

export async function deletePublishedVersion(request, env, projectId, versionId) {
  const version = await getVersion(request, env, projectId, versionId);
  if (!version || version.status !== "published") throw new Error("VERSION_NOT_FOUND");
  const protectedIds = await protectedVersionIds(request, env, projectId);
  if (protectedIds.has(version.id)) throw new Error("VERSION_PROTECTED");

  const bucket = versionBucket(env);
  const files = await supabaseJson(
    env,
    request,
    `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}&select=r2_key`
  );
  await Promise.all((files || []).map(file => bucket.delete(file.r2_key)));
  await supabaseJson(env, request, `/rest/v1/client_editor_version_files?version_id=eq.${encodeURIComponent(version.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  await supabaseJson(env, request, `/rest/v1/client_editor_versions?id=eq.${encodeURIComponent(version.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "deleted", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  });
}

export function buildVersionSummary(pages = [], bundled = {}) {
  const pageCount = Array.isArray(bundled.pages)
    ? bundled.pages.length
    : pages.length;

  const assetCount = Array.isArray(bundled.snapshotAssets)
    ? bundled.snapshotAssets.length
    : Array.isArray(bundled.assetFiles)
      ? bundled.assetFiles.length
      : 0;

  return `${pageCount} página${pageCount === 1 ? "" : "s"}${assetCount ? ` · ${assetCount} recurso${assetCount === 1 ? "" : "s"}` : ""}`;
}

export function versionErrorMessage(error) {
  const code = String(error?.message || "");
  if (code === "VERSION_STORAGE_NOT_CONFIGURED") return "El historial todavía no está configurado en Cloudflare R2.";
  if (code === "VERSION_LIMIT_REACHED") return "Llegaste a 40 publicaciones dentro de los últimos 7 días. Elimina una versión antigua para continuar.";
  if (code === "VERSION_PROTECTED") return "Esta versión está protegida porque es la actual o la recuperación más reciente.";
  if (code === "VERSION_NOT_FOUND") return "La versión ya no está disponible.";
  if (code === "VERSION_SNAPSHOT_NOT_FOUND") return "No encontramos los archivos de esta versión.";
  if (code === "VERSION_PREVIEW_NOT_CONFIGURED") return "La vista previa privada del historial todavía no está configurada.";
  if (code === "VERSION_PREVIEW_ASSET_INVALID") return "Un archivo de la vista previa no es válido.";
  if (code === "RESTORE_PLAN_ACTIVE") return "Ya estás revisando una versión recuperada. Publícala o cancélala antes de elegir otra.";
  if (code === "RESTORE_PLAN_NOT_FOUND") return "No hay una recuperación activa para cancelar.";
  if (code === "RESTORE_PLAN_CREATE_FAILED") return "No pudimos preparar la recuperación.";
  if (code === "RESTORE_PLAN_NOT_READY") return "La recuperación ya no está disponible para revisión.";
  if (code === "VERSION_SNAPSHOT_INVALID") return "La copia archivada no es válida.";
  if (code === "VERSION_SNAPSHOT_ASSET_MISSING") return "Falta un archivo necesario de esta versión.";
  if (code === "VERSION_SNAPSHOT_ASSET_INVALID") return "Un archivo archivado no pasó la validación.";
  if (code === "VERSION_SNAPSHOT_ASSET_TAMPERED") return "La verificación de seguridad del archivo archivado falló.";
  return "No pudimos completar el historial de versiones.";
}
