import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'.deploy-demo');
const project='excepcional-build';
const account='d197c3a221e755e9479ed6065ee16b3f';
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const demoNames=fs.readdirSync(root).filter(name=>name.startsWith('demo-')||['demo.html','demo.css'].includes(name));
function walk(relative){
  const location=path.join(root,relative);
  return fs.statSync(location).isDirectory()?fs.readdirSync(location).flatMap(name=>walk(path.join(relative,name))):[relative];
}
const files=[...new Set([...tracked,...demoNames.flatMap(walk)])].filter(file=>{
  if(file.startsWith('.')||/^(scripts|workers|manual-sql|node_modules|respaldos)\//.test(file))return false;
  if(file.startsWith('functions/'))return /\.(js|json)$/.test(file);
  return /\.(html|css|js|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|pdf)$/.test(file)||['robots.txt','_headers','_redirects','_routes.json'].includes(file);
});
fs.rmSync(destination,{recursive:true,force:true});
fs.mkdirSync(destination,{recursive:true});
for(const file of files){
  if(/(^|\/)(\.env|\.dev\.vars)|\.(sql|md|py|dump|tar|gz)$/.test(file))throw Error('Archivo privado/no público en stage: '+file);
  const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);
}
console.log(`DEMO_STAGE_OK: ${files.length} archivos públicos y funciones versionadas; sin SQL, secretos ni cambios locales ajenos.`);
if(process.argv.includes('--stage-only'))process.exit(0);
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account};
const precheck=spawnSync('npx',['--no-install','wrangler','pages','project','list','--json','--profile','excepcional-demo'],{cwd:root,env,encoding:'utf8'});
if(precheck.status!==0){console.error(precheck.stderr||precheck.stdout);console.error('Falta autorizar la cuenta propietaria. Ejecuta npx wrangler auth create excepcional-demo y entra con paginawepoficial@gmail.com; luego repite node scripts/publish-demo.mjs.');process.exit(1);}
let projects;
try{projects=JSON.parse(precheck.stdout);}catch{throw Error('No se pudo validar la lista de proyectos; no se publicará.');}
if(!projects.some(item=>item.name===project||item.Name===project||item['Project Name']===project))throw Error('El proyecto existente no está en esta cuenta. No se creará otro sitio.');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const deployment=spawnSync('npx',['--no-install','wrangler','pages','deploy',destination,'--project-name',project,'--branch','main','--commit-hash',commit,'--commit-dirty=true','--commit-message','Actualizar demo Casa Nopal: Tienda base y Catálogo','--profile','excepcional-demo'],{cwd:root,env,stdio:'inherit'});
process.exitCode=deployment.status??1;
