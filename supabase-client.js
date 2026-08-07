(() => {
  const config = window.EB_SUPABASE_CONFIG || {};
  const placeholder = !config.anonKey || /PEGA_AQUI|SUPABASE_/i.test(config.anonKey);
  const sdkReady = Boolean(window.supabase?.createClient);
  const configured = sdkReady && Boolean(config.url) && !placeholder;

  const normalizeNext = (value, fallback = "panel.html") => {
    if (!value) return fallback;
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return fallback;
      return `${url.pathname.split("/").pop() || fallback}${url.search}${url.hash}`;
    } catch (_) {
      return fallback;
    }
  };

  if (!configured) {
    window.EBPortal = {
      configured: false,
      configError: sdkReady
        ? "Falta colocar la clave pública de Supabase en supabase-config.js."
        : "No se pudo cargar la biblioteca de Supabase.",
      normalizeNext
    };
    return;
  }

  const client = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce"
    }
  });

  window.ebSupabase = client;
  window.EBPortal = {
    configured: true,
    client,
    normalizeNext,
    callbackUrl: () => new URL("auth-callback.html", window.location.href).href,
    pendingQuoteKey: "eb_pending_quote",
    authNextKey: "eb_auth_next"
  };
})();
