const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const IDENTITY_TOOLKIT_API = "https://identitytoolkit.googleapis.com/admin/v2";

function base64Url(bytes) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlText(value) {
  return base64Url(new TextEncoder().encode(value));
}

function pemToBytes(value) {
  const body = String(value || "")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  if (!body) throw new Error("FIREBASE_AUTH_SERVICE_ACCOUNT_INVALID");
  const decoded = atob(body);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function readServiceAccount(env) {
  const raw = String(env.FIREBASE_AUTH_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) throw new Error("FIREBASE_AUTH_SERVICE_ACCOUNT_NOT_CONFIGURED");
  let account;
  try {
    account = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_AUTH_SERVICE_ACCOUNT_INVALID");
  }
  const clientEmail = String(account.client_email || "").trim();
  const privateKey = String(account.private_key || "").replace(/\\n/g, "\n");
  const projectId = String(account.project_id || "").trim();
  if (!clientEmail || !privateKey || !projectId) {
    throw new Error("FIREBASE_AUTH_SERVICE_ACCOUNT_INVALID");
  }
  return { clientEmail, privateKey, projectId };
}

async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlText(JSON.stringify({
    iss: account.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${header}.${claims}`)
  );
  const assertion = `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error("FIREBASE_AUTH_TOKEN_FAILED");
  return String(body.access_token);
}

function pagesHostname(value) {
  const hostname = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pages\.dev$/.test(hostname)) {
    throw new Error("FIREBASE_AUTH_DOMAIN_INVALID");
  }
  return hostname;
}

async function firebaseConfig(token, projectId, options = {}) {
  const response = await fetch(
    `${IDENTITY_TOOLKIT_API}/projects/${encodeURIComponent(projectId)}/config${options.query || ""}`,
    {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(options.method === "PATCH"
    ? "FIREBASE_AUTH_DOMAIN_UPDATE_FAILED"
    : "FIREBASE_AUTH_CONFIG_READ_FAILED");
  return body;
}

export async function ensureFirebaseAuthorizedDomain(env, hostname) {
  const domain = pagesHostname(hostname);
  const account = readServiceAccount(env);
  const token = await accessToken(account);
  const config = await firebaseConfig(token, account.projectId);
  const existing = Array.isArray(config.authorizedDomains)
    ? config.authorizedDomains.map((value) => String(value).toLowerCase()).filter(Boolean)
    : [];
  if (existing.includes(domain)) return { domain, added: false };
  await firebaseConfig(token, account.projectId, {
    method: "PATCH",
    query: "?updateMask=authorizedDomains",
    body: { authorizedDomains: [...existing, domain] }
  });
  return { domain, added: true };
}
