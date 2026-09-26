export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const owner = String(url.searchParams.get("owner") || "").trim();
    const repo = String(url.searchParams.get("repo") || "").trim();
    const branch = String(url.searchParams.get("branch") || "main").trim() || "main";
    const path = String(url.searchParams.get("path") || "").trim();
    const mode = String(url.searchParams.get("mode") || "token").trim().toLowerCase();

    if (!owner || !repo) {
      return json({ ok: false, message: "Faltan owner o repo." }, 400);
    }
    if (!["direct", "token"].includes(mode)) {
      return json({ ok: false, message: "Modo inválido." }, 400);
    }
    if ([owner, repo, branch, path].some(part => part.split("/").some(seg => seg === ".." || seg === "."))) {
      return json({ ok: false, message: "Ruta inválida." }, 400);
    }
    if (mode === "token" && !context.env.GITHUB_TOKEN) {
      return json({ ok: false, message: "Falta configurar GITHUB_TOKEN en Cloudflare Pages." }, 500);
    }

    const cache = caches.default;
    const cacheUrl = new URL(url.toString());
    cacheUrl.searchParams.sort();
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("x-editor-cache", "HIT");
      return new Response(cached.body, {
        status: cached.status,
        headers
      });
    }

    const encodedPath = path
      ? path.split("/").map(seg => encodeURIComponent(seg)).join("/")
      : "";

    const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "excepcional-build-editor"
    };

    if (mode === "token") {
      headers.Authorization = `Bearer ${context.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(api, { headers });
    const body = await response.text();

    const outHeaders = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": response.ok ? "public, max-age=60" : "no-store",
      "x-editor-repo-mode": mode,
      "x-editor-cache": "MISS"
    });

    copyHeader(response.headers, outHeaders, "x-ratelimit-limit");
    copyHeader(response.headers, outHeaders, "x-ratelimit-remaining");
    copyHeader(response.headers, outHeaders, "x-ratelimit-used");
    copyHeader(response.headers, outHeaders, "x-ratelimit-reset");

    const out = new Response(body, {
      status: response.status,
      headers: outHeaders
    });

    if (response.ok) {
      context.waitUntil(cache.put(cacheKey, out.clone()));
    }

    return out;
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: "No pudimos leer el repo." }, 500);
  }
}

function copyHeader(from, to, name) {
  const value = from.get(name);
  if (value) to.set(name, value);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
