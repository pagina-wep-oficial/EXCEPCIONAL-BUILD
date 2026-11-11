const ALLOWED_KEY = /^projects\/[a-z0-9-]+\/versions\/[a-z0-9-]+\/(?:manifest\.json|files\/[^\u0000?]+)$/i;

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function objectKey(request) {
  const url = new URL(request.url);
  const prefix = "/objects/";
  if (!url.pathname.startsWith(prefix)) return "";
  return decodeURIComponent(url.pathname.slice(prefix.length)).replace(/\\/g, "/");
}

export default {
  async fetch(request, env) {
    const expected = String(env.EDITOR_VERSIONS_BRIDGE_SECRET || "");
    const provided = String(request.headers.get("Authorization") || "");
    if (!expected || provided !== `Bearer ${expected}`) return unauthorized();

    const key = objectKey(request);
  if (!ALLOWED_KEY.test(key) || key.split("/").some(part => part === ".." || part === ".")) {
      return new Response("Invalid object key", { status: 400 });
    }

    if (request.method === "PUT") {
      await env.EDITOR_VERSIONS.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream",
          cacheControl: "private, max-age=31536000"
        }
      });
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET") {
      const object = await env.EDITOR_VERSIONS.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "no-store");
      return new Response(object.body, { headers });
    }

    if (request.method === "DELETE") {
      await env.EDITOR_VERSIONS.delete(key);
      return new Response(null, { status: 204 });
    }

    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, PUT, DELETE" } });
  }
};
