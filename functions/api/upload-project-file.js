import { bearer, getOwnedProject, insertFileMetadata, supabaseConfig } from "../_lib/supabase.js";
import {
  deleteMediaRecord,
  deleteProjectMedia,
  mediaErrorMessage,
  updateMediaRecord,
  uploadProjectMedia
} from "../_lib/project-media.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const CATEGORY_RULES = {
  foto: /^image\//,
  logo: /^image\//,
  video: /^video\//,
  documento: /^(application\/pdf|text\/plain|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-powerpoint|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)/
};
const allowed = ["logo","foto","video","documento","otro"];

export async function onRequestPost(context) {
  let uploaded = null;
  let assetId = "";
  try {
    const form = await context.request.formData();
    const projectId = String(form.get("project_id") || "");
    const category = String(form.get("category") || "otro");
    const file = form.get("file");
    if (!projectId || !(file instanceof File)) return json({ ok:false, message:"Faltan datos del archivo." }, 400);
    if (file.size > 25 * 1024 * 1024) return json({ ok:false, message:"El archivo supera el límite de 25 MB." }, 413);
    if (!allowed.includes(category)) return json({ ok:false, message:"Tipo de archivo no válido." }, 400);
    if (category !== "otro" && !CATEGORY_RULES[category].test(String(file.type || "").split(";")[0].trim().toLowerCase()))
      return json({ ok:false, message:`El archivo "${file.name}" no es ${category === "video" ? "un video" : category === "logo" ? "un logotipo (imagen)" : category === "foto" ? "una foto (imagen)" : "un documento"}.` }, 400);

    const access = await getOwnedProject(context.request, context.env, projectId);
    if (!access) return json({ ok:false, message:"No tienes acceso a este proyecto." }, 403);

    assetId = crypto.randomUUID();
    uploaded = await uploadProjectMedia(context.env, {
      projectId,
      assetId,
      visibility: "private",
      file
    });
    const { url, key } = supabaseConfig(context.env);
    const assetResponse = await fetch(`${url}/rest/v1/client_project_media_assets`, {
      method: "POST",
      headers: { apikey: key, Authorization: bearer(context.request), "Content-Type": "application/json" },
      body: JSON.stringify({
        id: assetId, project_id: projectId, user_id: access.user.id, purpose: "project_file",
        visibility: "private", storage_provider: "r2", r2_key: uploaded.r2_key,
        public_url: null, original_name: file.name, mime_type: uploaded.mime_type || file.type || null,
        size_bytes: Number(uploaded.size_bytes || file.size), status: "ready"
      })
    });
    if (!assetResponse.ok) throw new Error(await assetResponse.text());
    const record = await insertFileMetadata(context.request, context.env, {
      project_id: projectId,
      user_id: access.user.id,
      drive_file_id: null,
      storage_provider: "r2",
      r2_key: uploaded.r2_key,
      media_asset_id: assetId,
      file_name: file.name,
      mime_type: uploaded.mime_type || file.type || null,
      size_bytes: Number(uploaded.size_bytes || file.size),
      category
    });
    return json({ ok:true, file:record });
  } catch (error) {
    console.error(error);
    if (uploaded?.r2_key) await deleteProjectMedia(context.env, uploaded.r2_key).catch(() => {});
    if (assetId) await deleteMediaRecord(context.request, context.env, assetId).catch(() => {});
    return json({ ok:false, message: mediaErrorMessage(error) }, 500);
  }
}
