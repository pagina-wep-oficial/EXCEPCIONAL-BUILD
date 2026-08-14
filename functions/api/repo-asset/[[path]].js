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

    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${assetPath}`;
    const response = await fetch(url);

    if (!response.ok) {
      return new Response("No encontrado en el repo.", { status: response.status === 404 ? 404 : 502 });
    }

    const isHtml = /\.html?$/i.test(assetPath);
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": mimeFor(assetPath),
        "Cache-Control": isHtml ? "public, max-age=120" : "public, max-age=3600"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response("No pudimos servir el asset.", { status: 500 });
  }
}
