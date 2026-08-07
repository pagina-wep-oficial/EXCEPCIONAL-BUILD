import { getVisibleFileMetadata } from "../_lib/supabase.js";
import { downloadFromDrive } from "../_lib/google-drive.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  try {
    const id = new URL(context.request.url).searchParams.get("id");
    if (!id) return json({ ok:false, message:"Falta el archivo." }, 400);
    const meta = await getVisibleFileMetadata(context.request, context.env, id);
    if (!meta) return json({ ok:false, message:"No tienes acceso a este archivo." }, 403);
    const driveResponse = await downloadFromDrive(context.env, meta.drive_file_id);
    const headers = new Headers();
    headers.set("Content-Type", meta.mime_type || driveResponse.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(meta.file_name || "archivo")}`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(driveResponse.body, { status:200, headers });
  } catch (error) {
    console.error(error);
    return json({ ok:false, message:"No pudimos abrir el archivo." }, 500);
  }
}
