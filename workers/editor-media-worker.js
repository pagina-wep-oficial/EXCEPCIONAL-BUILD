const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function unauthorized() {
  return json({ ok: false, message: "No autorizado." }, 401);
}

function internal(request, env) {
  const secret = String(env.EDITOR_MEDIA_INTERNAL_SECRET || "");
  return Boolean(secret) && request.headers.get("Authorization") === `Bearer ${secret}`;
}

function safeName(value) {
  const name = String(value || "archivo")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return name || "archivo";
}

function validKey(key, visibility = "") {
  const value = String(key || "").replace(/^\/+/, "");
  const pieces = value.split("/");
  return pieces.length >= 6
    && pieces[0] === "projects"
    && PROJECT_ID.test(pieces[1])
    && ["public", "private"].includes(pieces[2])
    && /^[0-9a-f-]{36}$/i.test(pieces[4])
    && (!visibility || pieces[2] === visibility)
    && !pieces.some(part => !part || part === "." || part === "..");
}

function rangeFrom(request, size) {
  const header = request.headers.get("Range");
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return "invalid";
  return { offset: start, length: Math.min(end, size - 1) - start + 1 };
}

function objectHeaders(object, { privateResponse = false, range = null } = {}) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", privateResponse ? "private, no-store" : "public, max-age=31536000, immutable");
  if (!privateResponse) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Range");
    headers.set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range, ETag");
  }
  if (range) {
    headers.set("Content-Range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`);
    headers.set("Content-Length", String(range.length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return headers;
}

async function upload(request, env) {
  if (!internal(request, env)) return unauthorized();
  const form = await request.formData();
  const projectId = String(form.get("project_id") || "");
  const assetId = String(form.get("asset_id") || "");
  const visibility = String(form.get("visibility") || "");
  const file = form.get("file");
  if (!PROJECT_ID.test(projectId) || !PROJECT_ID.test(assetId) || !["public", "private"].includes(visibility) || !(file instanceof File)) {
    return json({ ok: false, message: "Datos de medio no válidos." }, 400);
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) return json({ ok: false, message: "El archivo debe pesar máximo 25 MB." }, 413);

  const key = `projects/${projectId}/${visibility}/media/${assetId}/${safeName(file.name)}`;
  await env.EDITOR_MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      cacheControl: visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store"
    },
    customMetadata: { project_id: projectId, asset_id: assetId, visibility }
  });
  const origin = new URL(request.url).origin;
  return json({
    ok: true,
    asset_id: assetId,
    r2_key: key,
    public_url: visibility === "public" ? `${origin}/media/${key}` : null,
    size_bytes: file.size,
    mime_type: file.type || "application/octet-stream"
  }, 201);
}

async function privateObject(request, env) {
  if (!internal(request, env)) return unauthorized();
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!validKey(key, "private")) return json({ ok: false, message: "Archivo no válido." }, 400);
  const object = await env.EDITOR_MEDIA.get(key);
  if (!object) return json({ ok: false, message: "Archivo no encontrado." }, 404);
  const headers = objectHeaders(object, { privateResponse: true });
  return new Response(object.body, { headers });
}

async function remove(request, env) {
  if (!internal(request, env)) return unauthorized();
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!validKey(key)) return json({ ok: false, message: "Archivo no válido." }, 400);
  await env.EDITOR_MEDIA.delete(key);
  return json({ ok: true });
}

async function publicObject(request, env, key) {
  if (!validKey(key, "public")) return new Response("No encontrado", { status: 404 });
  const head = await env.EDITOR_MEDIA.head(key);
  if (!head) return new Response("No encontrado", { status: 404 });
  const range = rangeFrom(request, head.size);
  if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${head.size}` } });
  const object = await env.EDITOR_MEDIA.get(key, range ? { range } : undefined);
  if (!object) return new Response("No encontrado", { status: 404 });
  return new Response(object.body, { status: range ? 206 : 200, headers: objectHeaders(object, { range }) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (request.method === "POST" && url.pathname === "/internal/upload") return upload(request, env);
    if (request.method === "GET" && url.pathname === "/internal/private") return privateObject(request, env);
    if (request.method === "DELETE" && url.pathname === "/internal/object") return remove(request, env);
    if (request.method === "GET" && url.pathname.startsWith("/media/")) return publicObject(request, env, decodeURIComponent(url.pathname.slice(7)));
    return new Response("No encontrado", { status: 404 });
  }
};
