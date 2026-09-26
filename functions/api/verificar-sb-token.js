// Verifica un token de acceso personal de Supabase (sbp_...) contra la
// Management API. El navegador no puede llamar a api.supabase.com por CORS,
// así que esta función hace la comprobación por el servidor.
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestPost(context) {
  try {
    let token = "";
    try {
      token = String((await context.request.json())?.token || "").trim();
    } catch (_) {}
    if (!token) return json({ ok: false, error: "falta_token" }, 400);
    const r = await fetch("https://api.supabase.com/v1/projects", {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    });
    if (r.status === 200) {
      const list = await r.json();
      return json({ ok: true, count: Array.isArray(list) ? list.length : 0 });
    }
    return json({ ok: false, error: r.status === 401 ? "expirado" : "invalido" });
  } catch (error) {
    console.error("verificar-sb-token", error);
    return json({ ok: false, error: "error_interno" }, 500);
  }
}

export async function onRequestGet(context) {
  return json({ ok: false, error: "metodo_no_permitido" }, 405);
}