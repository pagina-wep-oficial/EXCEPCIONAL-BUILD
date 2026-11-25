import { bearer, supabaseConfig } from "./supabase.js";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function workerConfig(env) {
  const origin = String(env.EDITOR_MEDIA_WORKER_URL || "").trim().replace(/\/+$/, "");
  const secret = String(env.EDITOR_MEDIA_WORKER_SECRET || "").trim();
  if (!origin || !secret) throw new Error("EDITOR_MEDIA_NOT_CONFIGURED");
  return { origin, secret };
}

async function workerFetch(env, path, init = {}) {
  const { origin, secret } = workerConfig(env);
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${secret}`);
  const response = await fetch(`${origin}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`EDITOR_MEDIA_${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response;
}

export async function uploadProjectMedia(env, { projectId, assetId, visibility, file }) {
  if (!(file instanceof File) || !file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("EDITOR_MEDIA_FILE_INVALID");
  }
  const form = new FormData();
  form.set("project_id", projectId);
  form.set("asset_id", assetId);
  form.set("visibility", visibility);
  form.set("file", file, file.name || "archivo");
  const response = await workerFetch(env, "/internal/upload", { method: "POST", body: form });
  const body = await response.json().catch(() => null);
  if (!body?.ok || !body.r2_key) throw new Error("EDITOR_MEDIA_UPLOAD_FAILED");
  return body;
}

export async function deleteProjectMedia(env, r2Key) {
  if (!r2Key) return;
  await workerFetch(env, `/internal/object?key=${encodeURIComponent(r2Key)}`, { method: "DELETE" });
}

export async function readPrivateProjectMedia(env, r2Key) {
  return workerFetch(env, `/internal/private?key=${encodeURIComponent(r2Key)}`);
}

export async function getOwnedMediaRecord(request, env, assetId) {
  const auth = bearer(request);
  if (!auth || !assetId) return null;
  const { url, key } = supabaseConfig(env);
  const response = await fetch(
    `${url}/rest/v1/client_project_media_assets?id=eq.${encodeURIComponent(assetId)}&select=*`,
    { headers: { apikey: key, Authorization: auth } }
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] || null;
}

export async function updateMediaRecord(request, env, assetId, patch) {
  const auth = bearer(request);
  const { url, key } = supabaseConfig(env);
  const response = await fetch(
    `${url}/rest/v1/client_project_media_assets?id=eq.${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: auth,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(patch)
    }
  );
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  return rows?.[0] || null;
}

export async function deleteMediaRecord(request, env, assetId) {
  const auth = bearer(request);
  const { url, key } = supabaseConfig(env);
  const response = await fetch(
    `${url}/rest/v1/client_project_media_assets?id=eq.${encodeURIComponent(assetId)}`,
    {
      method: "DELETE",
      headers: { apikey: key, Authorization: auth, Prefer: "return=minimal" }
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return true;
}

export function mediaErrorMessage(error) {
  const code = mediaErrorCode(error);
  if (code === "R2_NOT_CONFIGURED") {
    return "El almacenamiento de archivos todavía no está configurado.";
  }
  if (code === "R2_AUTH") {
    return "El almacenamiento rechazó la conexión segura.";
  }
  if (code === "R2_WORKER") {
    return "El almacenamiento no respondió correctamente.";
  }
  if (code === "PROJECT_ACCESS") {
    return "No tienes acceso a este proyecto.";
  }
  if (code === "MEDIA_DATABASE") {
    return "La imagen no pudo registrarse en el proyecto.";
  }
  if (code === "EDITOR_MEDIA_FILE_INVALID") {
    return "El archivo debe pesar máximo 25 MB.";
  }
  return "No pudimos guardar el archivo. Inténtalo nuevamente.";
}

export function mediaErrorCode(error) {
  const raw = String(error?.message || "");
  if (raw.includes("EDITOR_MEDIA_NOT_CONFIGURED")) return "R2_NOT_CONFIGURED";
  if (/EDITOR_MEDIA_(401|403)\b/.test(raw)) return "R2_AUTH";
  if (/EDITOR_MEDIA_(4\d\d|5\d\d)\b/.test(raw)) return "R2_WORKER";
  if (raw.includes("No tienes acceso a este proyecto")) return "PROJECT_ACCESS";
  if (raw.includes("client_project_media_assets") || raw.includes("PostgREST")) return "MEDIA_DATABASE";
  if (raw.includes("EDITOR_MEDIA_FILE_INVALID")) return "EDITOR_MEDIA_FILE_INVALID";
  return "MEDIA_UPLOAD";
}
