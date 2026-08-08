const FALLBACK_URL = "https://scaebulgcuvqpucondws.supabase.co";
const FALLBACK_KEY = "sb_publishable_eQ56jyqP3zI7KvuneI0FLw_Nl77cvt5";

export function supabaseConfig(env) {
  return {
    url: env.SUPABASE_URL || FALLBACK_URL,
    key: env.SUPABASE_ANON_KEY || FALLBACK_KEY
  };
}

export function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value : "";
}

export async function getUser(request, env) {
  const auth = bearer(request);
  if (!auth) return null;
  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: auth } });
  if (!response.ok) return null;
  return response.json();
}

export async function getOwnedProject(request, env, projectId) {
  const auth = bearer(request);
  const user = await getUser(request, env);
  if (!user) return null;
  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_projects?id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,name,user_id`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: auth } });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] ? { user, project: rows[0] } : null;
}

export async function insertFileMetadata(request, env, payload) {
  const auth = bearer(request);
  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/client_project_files`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: auth,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  return rows?.[0] || null;
}

export async function getVisibleFileMetadata(request, env, fileId) {
  const auth = bearer(request);
  if (!auth) return null;
  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_project_files?id=eq.${encodeURIComponent(fileId)}&select=*`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: auth } });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] || null;
}

export async function getOwnedProjectFile(request, env, fileId) {
  const user = await getUser(request, env);
  if (!user) return null;
  const { url, key } = supabaseConfig(env);
  const endpoint = `${url}/rest/v1/client_project_files?id=eq.${encodeURIComponent(fileId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,project_id,user_id,drive_file_id,file_name`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: bearer(request) } });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] ? { user, file: rows[0] } : null;
}

export async function deleteFileMetadata(request, env, fileId) {
  const { url, key } = supabaseConfig(env);
  const response = await fetch(`${url}/rest/v1/client_project_files?id=eq.${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: bearer(request), Prefer: "return=minimal" }
  });
  if (!response.ok) throw new Error("No se pudo quitar el archivo del proyecto.");
  return true;
}
