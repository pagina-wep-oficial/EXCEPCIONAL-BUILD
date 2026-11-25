import { getOwnedProjectFile, deleteFileMetadata } from "../_lib/supabase.js";
import { deleteFromDrive } from "../_lib/google-drive.js";
import { deleteMediaRecord, deleteProjectMedia } from "../_lib/project-media.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestDelete(context) {
  try {
    const id = new URL(context.request.url).searchParams.get("id");
    if (!id) return json({ ok:false, message:"Falta el archivo." }, 400);
    const access = await getOwnedProjectFile(context.request, context.env, id);
    if (!access) return json({ ok:false, message:"No tienes acceso a este archivo." }, 403);
    if (access.file.storage_provider === "r2") {
      await deleteProjectMedia(context.env, access.file.r2_key);
      if (access.file.media_asset_id) {
        await deleteMediaRecord(context.request, context.env, access.file.media_asset_id);
      }
    }
    else await deleteFromDrive(context.env, access.file.drive_file_id);
    await deleteFileMetadata(context.request, context.env, id);
    return json({ ok:true });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:"No pudimos eliminar el archivo." }, 500);
  }
}
