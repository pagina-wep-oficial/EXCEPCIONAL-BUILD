// Sirve assets del repo (CSS, JS, imágenes) con el MIME correcto para que el
// iframe del editor se pinte completo, sin depender de CDNs de terceros.
// Uso: /api/repo-asset/{owner}/{repo}@{branch}/{ruta/al/archivo}
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function mimeFor(path) {
  const dot = String(path).toLowerCase().lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return MIME[String(path).toLowerCase().slice(dot)] || "application/octet-stream";
}

function encodedPath(path) {
  return String(path || "").split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function decodeGitHubContent(value) {
  const binary = atob(String(value || "").replace(/\s/g, ""));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function readRepoAsset(env, owner, repo, branch, assetPath) {
  const token = String(env.GITHUB_TOKEN || "").trim();
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath(assetPath)}`;
  const rawResponse = await fetch(rawUrl);

  if (rawResponse.ok) return { ok: true, body: rawResponse.body };

  if (![401, 403, 404].includes(rawResponse.status) || !token) {
    return { ok: false, status: rawResponse.status };
  }

  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath(assetPath)}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(api, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "excepcional-build-editor"
    }
  });

  if (response.ok) {
    const data = await response.json();
    if (data?.type === "file" && typeof data.content === "string") {
      return { ok: true, body: decodeGitHubContent(data.content) };
    }
    return { ok: false, status: 404 };
  }

  return { ok: false, status: response.status };
}

export async function onRequestGet(context) {
  try {
    const segs = (context.params.path || []).map(s => String(s));
    const owner = segs[0];
    const repoBranch = segs[1] || "";
    const [repo, branch] = repoBranch.split("@");
    const assetPath = segs.slice(2).join("/");

    if (!owner || !repo || !branch || !assetPath) {
      return new Response("Faltan datos del asset.", { status: 400 });
    }

    // Evitar path traversal
    if (assetPath.split("/").some(seg => seg === ".." || seg === ".")) {
      return new Response("Ruta inválida.", { status: 400 });
    }

    const asset = await readRepoAsset(context.env, owner, repo, branch, assetPath);

    if (!asset.ok) {
      return new Response("No encontrado en el repo.", { status: asset.status === 404 ? 404 : 502 });
    }

    const isHtml = /\.html?$/i.test(assetPath);
    const isImage = /\.(png|jpe?g|gif|webp|svg|ico|avif|woff2?|ttf|otf)$/i.test(assetPath);
    return new Response(asset.body, {
      status: 200,
      headers: {
        "Content-Type": mimeFor(assetPath),
        "Cache-Control": isHtml ? "public, max-age=120" : (isImage ? "public, max-age=3600" : "public, max-age=300")
      }
    });
  } catch (error) {
    console.error(error);
    return new Response("No pudimos servir el asset.", { status: 500 });
  }
}
