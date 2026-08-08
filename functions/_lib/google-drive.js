async function driveAccessToken(env) {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Drive no está configurado.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) throw new Error("No se pudo conectar con Google Drive.");
  const data = await response.json();
  if (!data.access_token) throw new Error("Google Drive no devolvió acceso.");
  return data.access_token;
}

function escapeQuery(value) { return String(value).replace(/'/g, "\\'"); }

async function driveJson(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}.`);
  return response.json();
}

async function ensureRootFolder(env, token) {
  if (env.GOOGLE_DRIVE_FOLDER_ID) return env.GOOGLE_DRIVE_FOLDER_ID;
  const rootName = env.GOOGLE_DRIVE_FOLDER_NAME || "Excepcional Build - Clientes";
  const q = `'root' in parents and name='${escapeQuery(rootName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const search = await driveJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`, token);
  if (search.files?.[0]?.id) return search.files[0].id;
  const created = await driveJson("https://www.googleapis.com/drive/v3/files?fields=id,name", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: rootName, mimeType: "application/vnd.google-apps.folder", parents: ["root"] })
  });
  return created.id;
}

async function findOrCreateFolder(env, token, projectId, projectName) {
  const root = await ensureRootFolder(env, token);
  const folderName = `${String(projectName || "Proyecto").slice(0, 70)} · ${String(projectId).slice(0, 8)}`;
  const q = `'${root}' in parents and name='${escapeQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const search = await driveJson(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`, token);
  if (search.files?.[0]?.id) return search.files[0].id;
  const created = await driveJson("https://www.googleapis.com/drive/v3/files?fields=id,name", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: folderName, mimeType: "application/vnd.google-apps.folder", parents: [root] })
  });
  return created.id;
}

export async function uploadToDrive(env, { projectId, projectName, file }) {
  const token = await driveAccessToken(env);
  const folderId = await findOrCreateFolder(env, token, projectId, projectName);
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": file.type || "application/octet-stream",
      "X-Upload-Content-Length": String(file.size)
    },
    body: JSON.stringify({ name: file.name, parents: [folderId] })
  });
  if (!start.ok) throw new Error("No se pudo preparar la carga en Google Drive.");
  const uploadUrl = start.headers.get("Location");
  if (!uploadUrl) throw new Error("Google Drive no devolvió una URL de carga.");
  const upload = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
  if (!upload.ok) throw new Error("No se pudo subir el archivo a Google Drive.");
  return upload.json();
}

export async function downloadFromDrive(env, driveFileId) {
  const token = await driveAccessToken(env);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("No se pudo descargar el archivo desde Google Drive.");
  return response;
}

export async function deleteFromDrive(env, driveFileId) {
  const token = await driveAccessToken(env);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`No se pudo eliminar el archivo de Google Drive (${response.status}).`);
  return true;
}
