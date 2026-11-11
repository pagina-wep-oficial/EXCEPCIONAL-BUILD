import { normalizeVersionPath } from "./editor-versions.js";

const PREVIEW_TTL_SECONDS = 10 * 60;

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

export function isSafeVersionAssetPath(value = "") {
  const raw = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const normalized = normalizeVersionPath(raw);

  return Boolean(
    raw &&
    raw === normalized &&
    !raw.split("/").some(part => part === "." || part === "..")
  );
}

function secretKey(env) {
  const secret = String(env?.EDITOR_VERSION_PREVIEW_SECRET || "").trim();
  if (!secret) throw new Error("VERSION_PREVIEW_NOT_CONFIGURED");

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function payload(projectId, versionId, assetPath, expiresAt) {
  return [
    "editor-version-preview-v1",
    projectId,
    versionId,
    assetPath,
    String(expiresAt)
  ].join("\n");
}

function bytesToBase64Url(bytes) {
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value = "") {
  const normalized = String(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signature(env, projectId, versionId, assetPath, expiresAt) {
  const key = await secretKey(env);
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload(projectId, versionId, assetPath, expiresAt))
  );

  return bytesToBase64Url(new Uint8Array(bytes));
}

export async function createVersionPreviewUrls({
  request,
  env,
  projectId,
  versionId,
  assets = []
}) {
  if (!isUuid(projectId) || !isUuid(versionId)) {
    throw new Error("VERSION_PREVIEW_ASSET_INVALID");
  }

  const assetPaths = [...new Set(
    (Array.isArray(assets) ? assets : [])
      .map(asset => typeof asset === "string" ? asset : asset?.path)
      .filter(isSafeVersionAssetPath)
  )];

  const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_TTL_SECONDS;
  const assetUrls = {};

  for (const assetPath of assetPaths) {
    const signed = await signature(env, projectId, versionId, assetPath, expiresAt);
    const path = [
      "api",
      "editor-version-asset",
      encodeURIComponent(projectId),
      encodeURIComponent(versionId),
      ...assetPath.split("/").map(encodeURIComponent)
    ].join("/");

    const url = new URL(`/${path}`, request.url);
    url.searchParams.set("expires", String(expiresAt));
    url.searchParams.set("signature", signed);
    assetUrls[assetPath] = `${url.pathname}${url.search}`;
  }

  return {
    expires_at: new Date(expiresAt * 1000).toISOString(),
    asset_urls: assetUrls
  };
}

export async function verifyVersionPreviewSignature({
  env,
  projectId,
  versionId,
  assetPath,
  expiresAt,
  providedSignature
}) {
  if (
    !isUuid(projectId) ||
    !isUuid(versionId) ||
    !isSafeVersionAssetPath(assetPath)
  ) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(expiresAt);

  if (
    !Number.isInteger(expiry) ||
    expiry < now ||
    expiry > now + PREVIEW_TTL_SECONDS + 60
  ) {
    return false;
  }

  try {
    const key = await secretKey(env);
    const signatureBytes = base64UrlToBytes(providedSignature);

    return crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload(projectId, versionId, assetPath, expiry))
    );
  } catch {
    return false;
  }
}
