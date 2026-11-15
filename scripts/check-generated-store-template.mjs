import { buildGeneratedSiteFiles } from "../functions/_lib/generated-store-template.js";

const projectId = "f85ce58d-5ef4-4ac0-9f9b-5c2d1ae10c00";
const itmProjectId = "11111111-1111-4111-8111-111111111111";
const files = buildGeneratedSiteFiles({
  projectId,
  itmProjectId,
  projectName: "Proyecto de prueba"
});

const expected = new Set([
  "README.md",
  "dist/app.js",
  "dist/carrito.html",
  "dist/detalle.html",
  "dist/index.html",
  "dist/mis-pedidos.html",
  "dist/perfil-de-usuario.html",
  "dist/store-config.json",
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
if (config.project_id !== itmProjectId || config.exceptional_project_id !== projectId) {
  throw new Error("GENERATED_TEMPLATE_IDENTITY_INVALID");
}

const forbidden = ["096b6e30-cc77-4fa2-bd2f-1e2696d742f2", "Fonda Mexicana", "529996448579"];
for (const text of Object.values(decoded)) {
  if (forbidden.some(value => text.includes(value))) {
    throw new Error("GENERATED_TEMPLATE_FONDA_DATA_LEAK");
  }
}

console.log("GENERATED_STORE_TEMPLATE_OK");
