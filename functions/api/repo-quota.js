// Devuelve el estado del tanque de peticiones de GitHub (rate limit) del
// GITHUB_TOKEN configurado en Cloudflare Pages, para monitoreo desde el CRM.
export async function onRequestGet(context) {
  const token = context.env.GITHUB_TOKEN;
  if (!token) {
    return json({ ok: false, token_configured: false, message: "Falta configurar GITHUB_TOKEN en Cloudflare Pages." }, 200);
  }

  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "excepcional-build-crm"
      }
    });

    if (response.status === 401) {
      return json({ ok: false, token_configured: true, token_valid: false, message: "El token de GitHub expiró o fue revocado." }, 200);
    }
    if (!response.ok) {
      return json({ ok: false, token_configured: true, token_valid: false, message: `GitHub respondió ${response.status}.` }, 200);
    }

    const data = await response.json();
    const core = data?.resources?.core || {};
    const resetSeconds = Number(core.reset || 0);
    const resetInMinutes = resetSeconds ? Math.max(0, Math.ceil((resetSeconds * 1000 - Date.now()) / 60000)) : null;

    return json({
      ok: true,
      token_configured: true,
      token_valid: true,
      limit: core.limit ?? null,
      remaining: core.remaining ?? null,
      used: core.used ?? null,
      reset_in_minutes: resetInMinutes,
      reset_at: resetSeconds ? new Date(resetSeconds * 1000).toISOString() : null
    }, 200);
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: "No pudimos consultar el límite de GitHub." }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
