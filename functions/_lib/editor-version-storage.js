function bridgeUrl(env, key) {
  const base = String(env?.VERSION_STORAGE_BRIDGE_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("VERSION_STORAGE_NOT_CONFIGURED");
  const normalized = String(key || "").replace(/^\/+/, "");
  if (!/^projects\/[a-z0-9-]+\/versions\/[a-z0-9-]+\//i.test(normalized)) {
    throw new Error("VERSION_STORAGE_KEY_INVALID");
  }
  return `${base}/objects/${normalized.split("/").map(part => encodeURIComponent(part)).join("/")}`;
}

function bridgeHeaders(env, extra = {}) {
  const secret = String(env?.EDITOR_VERSIONS_BRIDGE_SECRET || "").trim();
  if (!secret) throw new Error("VERSION_STORAGE_NOT_CONFIGURED");
  return {
    Authorization: `Bearer ${secret}`,
    ...extra
  };
}

export function versionStorage(env) {
  const configuredBridge = String(env?.VERSION_STORAGE_BRIDGE_URL || "").trim();
  if (!configuredBridge && env?.EDITOR_VERSIONS && typeof env.EDITOR_VERSIONS.put === "function") {
    return env.EDITOR_VERSIONS;
  }

  const request = async (method, key, body = null, contentType = "application/octet-stream") => {
    const response = await fetch(bridgeUrl(env, key), {
      method,
      headers: bridgeHeaders(env, method === "PUT" ? { "Content-Type": contentType } : {}),
      body
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`VERSION_STORAGE_BRIDGE_${response.status}${message ? `: ${message.slice(0, 160)}` : ""}`);
    }
    if (method === "DELETE") return true;
    const bytes = await response.arrayBuffer();
    return {
      size: bytes.byteLength,
      httpMetadata: { contentType: response.headers.get("Content-Type") || contentType },
      async arrayBuffer() { return bytes; },
      async json() { return JSON.parse(new TextDecoder().decode(bytes)); }
    };
  };

  return {
    put(key, value, options = {}) {
      return request("PUT", key, value, options?.httpMetadata?.contentType || "application/octet-stream");
    },
    get(key) {
      return request("GET", key);
    },
    delete(key) {
      return request("DELETE", key);
    }
  };
}
