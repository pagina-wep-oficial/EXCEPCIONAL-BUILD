/**
 * Empaqueta la plantilla neutral de Fonda dentro del Worker.
 *
 * Entrada:  scripts/fonda-neutral/   (generada por neutralize-fonda.mjs)
 * Salida:   functions/_lib/generated-store-template.js
 *
 * El Worker no puede leer disco: por eso cada archivo se guarda en base64 y
 * se sustituyen los marcadores __EB_*__ en tiempo de ejecución, por proyecto.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, 'fonda-neutral');
const target = path.resolve(here, '../functions/_lib/generated-store-template.js');

function walk(relative) {
  const location = path.join(source, relative);
  return fs.statSync(location).isDirectory()
    ? fs.readdirSync(location).flatMap(name => walk(path.join(relative, name)))
    : [relative];
}

const files = walk('').sort();
const entries = files.map(relative => {
  const bytes = fs.readFileSync(path.join(source, relative));
  return [`dist/${relative.replace(/\\/g, '/')}`, bytes.toString('base64')];
});

const template = Object.fromEntries(entries);

const module = String.raw`// ARCHIVO GENERADO por scripts/build-generated-store-template.mjs.
// No editar a mano: cambia scripts/fonda-neutral/ y vuelve a ejecutar el script.
const ITM_ORIGIN = "https://itm-void-excepcional.pages.dev";

const TEMPLATE = ${JSON.stringify(template, null, 2)};

const html = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[character]));

function js(value) {
  let out = "";
  for (const character of String(value ?? "")) {
    if (character === "\\") out += "\\\\";
    else if (character === '"') out += '\\"';
    else if (character === "\u0060") out += "\\\u0060";
    else if (character === "$") out += "\\$";
    else if (character === "\n") out += "\\n";
    else if (character === "\r") out += "\\r";
    else if (character === "\u2028") out += "\\u2028";
    else if (character === "\u2029") out += "\\u2029";
    else out += character;
  }
  return out;
}

function decode(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function render(text, file, projectName, itmProjectId) {
  const name = file.endsWith(".js") ? js(projectName) : html(projectName);
  const upper = file.endsWith(".js")
    ? js(projectName.toUpperCase())
    : html(projectName.toUpperCase());
  return text
    .split("__EB_PROJECT_NAME_UPPER__").join(upper)
    .split("__EB_PROJECT_NAME__").join(name)
    .split("__EB_ITM_PROJECT_ID__").join(itmProjectId);
}

export function buildGeneratedSiteFiles({ projectId, itmProjectId, projectName }) {
  const name = String(projectName || "Mi negocio").trim().slice(0, 160) || "Mi negocio";
  const config = JSON.stringify({
    project_id: String(itmProjectId),
    exceptional_project_id: String(projectId),
    api_origin: ITM_ORIGIN,
    site_name: name,
    whatsapp_number: "",
    version: 4
  }, null, 2) + "\n";

  const files = Object.entries(TEMPLATE).map(([file, data]) => ({
    path: file,
    data: encode(render(decode(data), file, name, String(itmProjectId)))
  }));

  files.push({ path: "dist/store-config.json", data: encode(config) });
  files.push({
    path: "README.md",
    data: encode("# " + name + "\n\nSitio creado desde Excepcional Build. No edites dist/store-config.json: conecta la tienda aislada de este proyecto.\n")
  });

  return files;
}
`;

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, module);

console.log(`Archivos empaquetados: ${entries.length}`);
console.log(`Tamano del modulo: ${(Buffer.byteLength(module) / 1024).toFixed(1)} KB`);
console.log('BUILD_GENERATED_STORE_TEMPLATE_OK');
