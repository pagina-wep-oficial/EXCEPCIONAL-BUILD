import assert from "node:assert/strict";
import { ensureFirebaseAuthorizedDomain } from "../functions/_lib/firebase-authorized-domains.js";

const originalFetch = globalThis.fetch;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
const originalBtoa = globalThis.btoa;
const originalAtob = globalThis.atob;

globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
Object.defineProperty(globalThis, "crypto", { configurable: true, value: {
  subtle: {
    async importKey() { return {}; },
    async sign() { return new Uint8Array([1, 2, 3]).buffer; }
  }
} });

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url) === "https://oauth2.googleapis.com/token") {
    return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
  }
  if (options.method === "PATCH") return new Response("{}", { status: 200 });
  return new Response(JSON.stringify({ authorizedDomains: ["itm-execional-build.firebaseapp.com"] }), { status: 200 });
};

const env = {
  FIREBASE_AUTH_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: "automation@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nAQID\\n-----END PRIVATE KEY-----",
    project_id: "itm-execional-build"
  })
};

try {
  const created = await ensureFirebaseAuthorizedDomain(env, "caldo-peres-89f19b56.pages.dev");
  assert.equal(created.added, true);
  const patch = calls.find((call) => call.options.method === "PATCH");
  assert.ok(patch);
  assert.deepEqual(JSON.parse(patch.options.body).authorizedDomains, [
    "itm-execional-build.firebaseapp.com",
    "caldo-peres-89f19b56.pages.dev"
  ]);
  console.log("FIREBASE_AUTHORIZED_DOMAIN_TEST_OK");
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor);
  globalThis.btoa = originalBtoa;
  globalThis.atob = originalAtob;
}
