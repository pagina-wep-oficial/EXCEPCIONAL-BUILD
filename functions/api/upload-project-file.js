import { getOwnedProject, insertFileMetadata } from "../_lib/supabase.js";
import { uploadToDrive } from "../_lib/google-drive.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestPost(context) {
  try {
    const form = await context.request.formData();
    const projectId = String(form.get("project_id") || "");
    const category = String(form.get("category") || "otro");
    const file = form.get("file");
    if (!projectId || !(file instanceof File)) return json({ ok:false, message:"Faltan datos del archivo." }, 400);
    if (file.size > 25 * 1024 * 1024) return json({ ok:false, message:"El archivo supera el límite de 25 MB." }, 413);
    const allowed = ["logo","foto","video","documento","otro"];
    if (!allowed.includes(category)) return json({ ok:false, message:"Tipo de archivo no válido." }, 400);

    const access = await getOwnedProject(context.request, context.env, projectId);
    if (!access) return json({ ok:false, message:"No tienes acceso a este proyecto." }, 403);

    const drive = await uploadToDrive(context.env, { projectId, projectName: access.project.name, file });
    const record = await insertFileMetadata(context.request, context.env, {
      project_id: projectId,
      user_id: access.user.id,
      drive_file_id: drive.id,
      file_name: drive.name || file.name,
      mime_type: drive.mimeType || file.type || null,
      size_bytes: Number(drive.size || file.size),
      category
    });
    return json({ ok:true, file:record });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:`No pudimos guardar el archivo. Revisa la configuración de Google Drive. (detalle: ${error.message})` }, 500);
  }
}
