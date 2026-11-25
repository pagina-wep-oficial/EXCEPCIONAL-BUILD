import { bearer, getOwnedProject, supabaseConfig } from "../_lib/supabase.js";
import {
  deleteMediaRecord,
  deleteProjectMedia,
  getOwnedMediaRecord,
  mediaErrorCode,
  mediaErrorMessage,
  uploadProjectMedia
} from "../_lib/project-media.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const ALLOWED = {
  image: /^image\/(jpeg|png|webp|gif|avif)$/i,
  video: /^video\/(mp4|webm|quicktime)$/i
};

export async function onRequestPost(context) {
  let uploaded = null;
  try {
    if (!bearer(context.request)) {
      return json({ ok: false, message: "Necesitas iniciar sesión." }, 401);
    }
    const form = await context.request.formData();
    const projectId = String(form.get("project_id") || "");
    const kind = String(form.get("kind") || "");
    const file = form.get("file");
    if (!projectId || !ALLOWED[kind] || !(file instanceof File) || !ALLOWED[kind].test(String(file.type || ""))) {
      return json({ ok: false, message: "El archivo no corresponde al tipo seleccionado." }, 400);
    }
    const access = await getOwnedProject(context.request, context.env, projectId);
    if (!access) return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);

    const assetId = crypto.randomUUID();
    uploaded = await uploadProjectMedia(context.env, {
      projectId,
      assetId,
      visibility: "public",
      file
    });

    const { url, key } = supabaseConfig(context.env);
    const response = await fetch(`${url}/rest/v1/client_project_media_assets`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: bearer(context.request),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        id: assetId,
        project_id: projectId,
        user_id: access.user.id,
        purpose: kind === "image" ? "editor_image" : "editor_video",
        visibility: "public",
        storage_provider: "r2",
        r2_key: uploaded.r2_key,
        public_url: uploaded.public_url,
        original_name: file.name || "archivo",
        mime_type: uploaded.mime_type,
        size_bytes: uploaded.size_bytes,
        page_path: String(form.get("page_path") || "") || null,
        asset_key: String(form.get("asset_key") || "") || null,
        status: "ready"
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return json({ ok: true, asset: rows?.[0] || null }, 201);
  } catch (error) {
    console.error("editor-media", error);
    if (uploaded?.r2_key) await deleteProjectMedia(context.env, uploaded.r2_key).catch(() => {});
    return json({ ok: false, message: mediaErrorMessage(error), error_code: mediaErrorCode(error) }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    const assetId = new URL(context.request.url).searchParams.get("asset_id") || "";
    const asset = await getOwnedMediaRecord(context.request, context.env, assetId);
    if (!asset) return json({ ok: false, message: "No tienes acceso a este archivo." }, 403);
    const project = await getOwnedProject(context.request, context.env, asset.project_id);
    if (!project) return json({ ok: false, message: "No tienes acceso a este proyecto." }, 403);
    await deleteProjectMedia(context.env, asset.r2_key);
    await deleteMediaRecord(context.request, context.env, asset.id);
    return json({ ok: true });
  } catch (error) {
    console.error("editor-media-delete", error);
    return json({ ok: false, message: mediaErrorMessage(error), error_code: mediaErrorCode(error) }, 500);
  }
}
