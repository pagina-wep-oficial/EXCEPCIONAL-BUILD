import { buildGeneratedSiteFiles } from "../functions/_lib/generated-store-template.js";

const projectId = "f85ce58d-5ef4-4ac0-9f9b-5c2d1ae10c00";
const itmProjectId = "11111111-1111-4111-8111-111111111111";
const projectName = "Proyecto de prueba";
const files = buildGeneratedSiteFiles({
  projectId,
  itmProjectId,
  projectName
});

const expected = new Set([
  "README.md",
  "dist/app.js",
  "dist/assets/hero-neutral.svg",
  "dist/assets/logo-neutral.svg",
  "dist/assets/producto-generico.svg",
  "dist/carrito.html",
  "dist/detalle.html",
  "dist/home.css",
  "dist/index.html",
  "dist/mis-pedidos.html",
  "dist/perfil-de-usuario.html",
  "dist/store-config.json",
  "dist/store-design.css",
  "dist/store-design.js",
  "dist/styles.css",
  "dist/tienda.html"
]);

if (files.length !== expected.size || files.some(file => !expected.has(file.path))) {
  throw new Error("GENERATED_TEMPLATE_FILES_INVALID");
}

const decoded = Object.fromEntries(files.map(file => [
  file.path,
  new TextDecoder().decode(Uint8Array.from(atob(file.data), character => character.charCodeAt(0)))
]));

const config = JSON.parse(decoded["dist/store-config.json"]);
if (
  config.project_id !== itmProjectId ||
  config.exceptional_project_id !== projectId ||
  config.api_origin !== "https://itm-void-excepcional.pages.dev" ||
  config.whatsapp_number !== ""
) {
  throw new Error("GENERATED_TEMPLATE_IDENTITY_INVALID");
}

const index = decoded["dist/index.html"];
const app = decoded["dist/app.js"];

if (!index.includes(`data-eb-key="brand.name">${projectName}<`)) {
  throw new Error("GENERATED_TEMPLATE_NAME_NOT_APPLIED");
}
if (!app.includes(`const ITM_PROJECT_ID = "${itmProjectId}"`)) {
  throw new Error("GENERATED_TEMPLATE_ITM_ID_NOT_APPLIED");
}
if (!index.includes("data-profile-corner") || !index.includes("data-opinions-list") || !index.includes('id="homeFeaturedProducts"')) {
  throw new Error("GENERATED_TEMPLATE_HOME_WIRING_MISSING");
}
if ((index.match(/data-eb-editable/g) || []).length !== 23) {
  throw new Error("GENERATED_TEMPLATE_EDITOR_HOOKS_INVALID");
}

const placeholders = ["__EB_PROJECT_NAME__", "__EB_PROJECT_NAME_UPPER__", "__EB_ITM_PROJECT_ID__"];
for (const text of Object.values(decoded)) {
  if (placeholders.some(value => text.includes(value))) {
    throw new Error("GENERATED_TEMPLATE_PLACEHOLDER_LEFT");
  }
}

const forbidden = [
  "096b6e30-cc77-4fa2-bd2f-1e2696d742f2",
  "Fonda Mexicana",
  "FONDA MEXICANA",
  "529996448579",
  "9996448579",
  "20.99977",
  "-89.624164",
  "15318250857817601893",
  "assets/home-",
  "assets/fonda-mexicana-"
];
for (const text of Object.values(decoded)) {
  const found = forbidden.find(value => text.includes(value));
  if (found) {
    throw new Error(`GENERATED_TEMPLATE_FONDA_DATA_LEAK: ${found}`);
  }
}

const assets = new Set(files.map(file => file.path).filter(path => path.startsWith("dist/assets/")));
for (const [path, text] of Object.entries(decoded)) {
  if (!path.endsWith(".html") && !path.endsWith(".css") && !path.endsWith(".js")) continue;
  for (const match of text.matchAll(/assets\/[A-Za-z0-9._-]+/g)) {
    const asset = `dist/${match[0]}`;
    if (!assets.has(asset)) {
      throw new Error(`GENERATED_TEMPLATE_ASSET_MISSING: ${match[0]} en ${path}`);
    }
  }
}

console.log("GENERATED_STORE_TEMPLATE_OK");
