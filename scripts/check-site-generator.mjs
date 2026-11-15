/**
 * Verifica que el generador de sitios use el token correcto en cada API.
 *
 * Bug real: createGitPagesProject recibia el token de Cloudflare y lo usaba
 * tambien contra GitHub, asi que GitHub respondia 401 Bad credentials al
 * leer/pushear README.md. El repo se creaba bien y fallaba justo despues.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, "../functions/api/generate-project-site.js");
const source = fs.readFileSync(file, "utf8");

function block(start, end) {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`NO_ENCONTRADO: ${start}`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`NO_CERRADO: ${start}`);
  return source.slice(from, to);
}

const pages = block("async function createGitPagesProject(", "\nasync function provisionStore");

if (!pages.startsWith("async function createGitPagesProject(cfToken, githubToken,")) {
  throw new Error("PAGES_FUNCTION_SIGNATURE_INVALID");
}
if (/cf\((?!cfToken)/.test(pages)) {
  throw new Error("PAGES_CLOUDFLARE_TOKEN_WRONG");
}
if (/gh\((?!githubToken)/.test(pages)) {
  throw new Error("PAGES_GITHUB_TOKEN_WRONG");
}

const call = "await createGitPagesProject(cfToken, githubToken, cfAccount, pagesName, repository);";
if (!source.includes(call)) {
  throw new Error("PAGES_CALL_TOKENS_INVALID");
}
if (source.includes("createGitPagesProject(cfToken, cfAccount")) {
  throw new Error("PAGES_CALL_GITHUB_TOKEN_MISSING");
}

console.log("SITE_GENERATOR_TOKENS_OK");
