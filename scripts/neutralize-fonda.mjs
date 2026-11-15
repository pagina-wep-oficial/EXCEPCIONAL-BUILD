/**
 * Genera la plantilla neutral a partir del sitio público de Fonda.
 *
 * Entrada:  ../paginas-web/fonda-diseno-publico/dist
 * Salida:   scripts/fonda-neutral/
 *
 * Reglas:
 * - Copia solo los archivos públicos necesarios (sin panel.js ni fotos de Fonda).
 * - Sustituye identidad, datos, teléfono, dirección, mapa, fotos y textos.
 * - Deja marcadores __EB_*__ que el generador reemplaza por proyecto.
 * - Falla si queda algún rastro de Fonda en lo que se publica.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '../../paginas-web/fonda-diseno-publico/dist');
const destination = path.resolve(here, 'fonda-neutral');

const COPY = [
  'index.html',
  'tienda.html',
  'detalle.html',
  'carrito.html',
  'mis-pedidos.html',
  'perfil-de-usuario.html',
  'app.js',
  'styles.css',
  'home.css',
  'store-design.css',
  'store-design.js',
  'assets/producto-generico.svg'
];

const PLACEHOLDER = '__EB_PROJECT_NAME__';
const GENERIC = 'assets/producto-generico.svg';
const LOGO = 'assets/logo-neutral.svg';
const HERO = 'assets/hero-neutral.svg';

const EXTRA_ASSETS = {
  'assets/logo-neutral.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Logo">
  <defs>
    <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c2433"/>
      <stop offset="1" stop-color="#b5532f"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="22" fill="url(#logo-bg)"/>
  <path d="M48 20 58 40 80 43 64 58 68 80 48 69 28 80 32 58 16 43 38 40Z" fill="#f7e7c8"/>
</svg>
`,
  'assets/hero-neutral.svg': `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067" viewBox="0 0 1600 1067" preserveAspectRatio="xMidYMid slice" role="img" aria-label="">
  <defs>
    <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4a131a"/>
      <stop offset="0.55" stop-color="#7c2433"/>
      <stop offset="1" stop-color="#b5532f"/>
    </linearGradient>
    <radialGradient id="hero-glow" cx="0.78" cy="0.22" r="0.6">
      <stop offset="0" stop-color="#e0a24a" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#e0a24a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1067" fill="url(#hero-bg)"/>
  <rect width="1600" height="1067" fill="url(#hero-glow)"/>
  <g fill="none" stroke="#f3d9b1" stroke-opacity="0.10" stroke-width="2">
    <circle cx="1180" cy="330" r="150"/>
    <circle cx="1180" cy="330" r="230"/>
    <circle cx="1180" cy="330" r="310"/>
    <path d="M1180 180 1330 330 1180 480 1030 330Z"/>
    <path d="M1180 240 1270 330 1180 420 1090 330Z"/>
  </g>
  <g fill="#f3d9b1" fill-opacity="0.07">
    <circle cx="220" cy="820" r="6"/>
    <circle cx="300" cy="760" r="4"/>
    <circle cx="380" cy="860" r="5"/>
    <circle cx="150" cy="700" r="4"/>
  </g>
</svg>
`
};

function read(name) {
  // Normaliza CRLF a LF: el snapshot se versiona con saltos de línea estables.
  return fs.readFileSync(path.join(source, name), 'utf8').replace(/\r\n/g, '\n');
}

function replaceAll(text, from, to, { required = 1 } = {}) {
  const parts = text.split(from);
  const count = parts.length - 1;
  if (count < required) {
    throw new Error(`No se encontró el texto esperado (${count}/${required}): ${from.slice(0, 90)}`);
  }
  return parts.join(to);
}

function replaceOnce(text, from, to) {
  const index = text.indexOf(from);
  if (index < 0) throw new Error(`No se encontró el bloque: ${from.slice(0, 90)}`);
  return text.slice(0, index) + to + text.slice(index + from.length);
}

function neutralizeHtml(name, text) {
  if (name === 'index.html') {
    text = replaceOnce(
      text,
      '<title>Fonda Mexicana | Comida mexicana en Mérida</title>',
      `<title>${PLACEHOLDER}</title>`
    );
    text = replaceOnce(
      text,
      'content="Fonda Mexicana en Mérida. Comida mexicana hecha al momento, pedidos para recoger o a domicilio."',
      'content="__EB_PROJECT_NAME__. Conoce nuestros productos y haz tu pedido."'
    );
    text = text.replace(
      /\n\s*<picture class="fonda-hero-media"[\s\S]*?<\/picture>/,
      `
      <picture class="fonda-hero-media" aria-hidden="true">
        <img
          src="${HERO}"
          alt=""
          width="1600"
          height="1067"
          fetchpriority="high"
        >
      </picture>`
    );
    text = replaceOnce(text, '>Comida mexicana en Mérida, Yucatán<', '>Bienvenido a tu nuevo sitio<');
    text = replaceOnce(text, '>Comida hecha al momento · Para recoger o a domicilio<', '>Productos y pedidos en un solo lugar<');
    text = replaceOnce(
      text,
      'Cocina de todos los días, preparada con sabor casero y servida como debe ser.',
      'Presenta tu negocio, muestra tus productos y recibe pedidos de forma sencilla.'
    );
    text = replaceOnce(text, '<span>Conoce la fonda</span>', '<span>Conoce más</span>');
    text = replaceOnce(
      text,
      '>Comida mexicana, trato cercano y pedidos sin complicaciones.<',
      '>Una página hecha para tu negocio.<'
    );
    text = replaceOnce(
      text,
      `En Fonda Mexicana preparamos comida al momento para que puedas
              disfrutarla aquí, pedirla para recoger o recibirla donde la necesites.`,
      `Presenta lo que haces, comparte tu historia y conecta con
              las personas que buscan lo que ofreces.`
    );
    text = replaceOnce(
      text,
      `Consulta los productos disponibles, revisa los detalles y arma tu
              pedido desde la tienda sin depender de listas largas o mensajes confusos.`,
      `Consulta tus productos, revisa los detalles y arma el pedido
              desde la tienda sin depender de listas largas o mensajes confusos.`
    );
    text = replaceOnce(text, 'src="assets/home-tacos-900.jpg"', `src="${GENERIC}"`);
    text = replaceOnce(text, 'alt="Tacos preparados al momento en Fonda Mexicana"', 'alt="Imagen de presentación"');
    text = replaceOnce(text, '>Hecho al momento<', '>Galería<');
    text = replaceOnce(text, '>Sabor que se ve y se disfruta<', '>Conoce nuestro trabajo<');
    text = replaceOnce(text, 'src="assets/home-enchiladas-640.jpg" alt="Enchiladas mexicanas"', `src="${GENERIC}" alt="Imagen de galería"`);
    text = replaceOnce(text, 'src="assets/home-tacos-900.jpg" alt="Tacos mexicanos"', `src="${GENERIC}" alt="Imagen de galería"`);
    text = replaceOnce(text, 'src="assets/home-talavera-640.jpg" alt="Detalles de Fonda Mexicana"', `src="${GENERIC}" alt="Imagen de galería"`);
    text = replaceOnce(text, '>Opiniones de quienes nos visitan<', '>Opiniones de nuestros clientes<');
    text = replaceOnce(text, '>C. 37D 12, Las Águilas, 97050 Mérida, Yuc.<', '>Dirección por configurar<');
    text = replaceOnce(text, '>Lunes a viernes · 8:00 am – 4:00 pm<', '>Horario por configurar<');
    text = replaceOnce(text, 'href="tel:+9996448579">999 644 8579<', 'href="tel:">Teléfono por configurar<');
    text = replaceOnce(
      text,
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=20.999769979845297,-89.62416438649322&amp;travelmode=driving"',
      'href="#"'
    );
    text = text.replace(
      /\n\s*<div class="fonda-map">[\s\S]*?<\/div>/,
      '\n            <div class="fonda-map"><div class="fonda-map-empty">Mapa por configurar</div></div>'
    );
    text = replaceOnce(text, '>Cuando tengas antojo<', '>Cuando quieras<');
    text = replaceOnce(text, '>Para pedir hoy<', '>Productos<');
  }

  if (name === 'carrito.html') {
    text = text.replace(/\n\s*<iframe id="pickupMap"[\s\S]*?<\/iframe>/, '');
  }

  text = replaceAll(text, 'Fonda Mexicana', PLACEHOLDER, { required: 0 });
  text = replaceAll(text, 'Mérida, Yucatán', 'Tu ciudad', { required: 0 });
  text = replaceAll(text, 'Mérida, Yuc.', 'Tu ciudad', { required: 0 });
  text = replaceAll(text, 'Mérida', 'Tu ciudad', { required: 0 });
  text = replaceAll(text, 'assets/fonda-mexicana-logo.png', LOGO, { required: 0 });
  text = replaceAll(text, 'assets/fonda-mexicana-hero.png', GENERIC, { required: 0 });
  text = replaceAll(text, 'assets/home-', `${GENERIC}#`, { required: 0 });

  return text;
}

function neutralizeApp(text) {
  text = replaceOnce(
    text,
    'const ITM_PROJECT_ID = "096b6e30-cc77-4fa2-bd2f-1e2696d742f2";',
    'const ITM_PROJECT_ID = "__EB_ITM_PROJECT_ID__";'
  );
  // La tienda arranca vacía: cada proyecto crea sus productos desde Administrar tienda.
  const productsBlock = /let products = \[[\s\S]*?\n\];\n\nconst FALLBACK_COORDS/.exec(text);
  if (!productsBlock) throw new Error("No se encontró el catálogo de respaldo de Fonda");
  text = text.replace(productsBlock[0], "let products = [];\n\nconst FALLBACK_COORDS");
  // Centro neutro de México (solo se usa si el navegador no da geolocalización).
  text = replaceOnce(
    text,
    'const FALLBACK_COORDS = { latitude: 25.6866, longitude: -100.3161 };',
    'const FALLBACK_COORDS = { latitude: 23.6345, longitude: -102.5528 };'
  );
  // Fonda no traía renderStorePickupUi: el punto de recogida quedaba vacío.
  text = replaceOnce(
    text,
    'function applyStorePickupSettings(pickup = {}) {',
    `function renderStorePickupUi() {
  const name = document.getElementById("pickupName");
  const address = document.getElementById("pickupAddress");
  const phone = document.getElementById("pickupPhone");
  const notes = document.getElementById("pickupNotes");
  const directions = document.getElementById("storeDirectionsLink");
  if (name) name.textContent = STORE_LOCATION.name || "Punto de salida";
  if (address) address.textContent = STORE_LOCATION.address || "Ubicación pendiente.";
  if (phone) {
    const value = String(STORE_LOCATION.phone || "").trim();
    phone.textContent = value;
    phone.hidden = !value;
  }
  if (notes) {
    const value = String(STORE_LOCATION.notes || "").trim();
    notes.textContent = value;
    notes.hidden = !value;
  }
  if (directions) {
    const value = String(STORE_LOCATION.directionsUrl || "").trim();
    directions.href = value || "#";
    directions.hidden = !value || value === "#";
  }
}

function applyStorePickupSettings(pickup = {}) {`
  );
  text = replaceOnce(
    text,
    `  const lat = Number(pickup.latitude);
  const lon = Number(pickup.longitude);`,
    `  const hasCoords =
    pickup.latitude != null &&
    pickup.longitude != null &&
    String(pickup.latitude).trim() !== "" &&
    String(pickup.longitude).trim() !== "";
  const lat = hasCoords ? Number(pickup.latitude) : NaN;
  const lon = hasCoords ? Number(pickup.longitude) : NaN;`
  );
  // La tienda ITM manda el WhatsApp y el punto de recogida de este proyecto.
  text = replaceOnce(
    text,
    'function applyStorePaymentSettings(settings = {}) {',
    `function applyStorePaymentSettings(settings = {}) {
  const configuredPhone = String(settings.whatsapp_number || "")
    .replace(/\\D/g, "");
  if (configuredPhone) {
    activeWhatsappNumber = configuredPhone.startsWith("52")
      ? configuredPhone
      : \`52\${configuredPhone}\`;
  }
  applyStorePickupSettings({
    name: settings.pickup_name,
    phone: settings.pickup_phone,
    address: settings.pickup_address,
    notes: settings.pickup_notes,
    latitude: settings.pickup_latitude,
    longitude: settings.pickup_longitude
  });`
  );
  text = replaceOnce(
    text,
    `const STORE_LOCATION = {
  address: "Fonda Mexicana",
  latitude: 20.99977,
  longitude: -89.624164,
  hours: "Lunes a viernes de 8:00 am a 4:00 pm",
  mapsUrl: "https://www.google.com/maps?cid=15318250857817601893",
  directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=20.999769979845297,-89.62416438649322&travelmode=driving"
};`,
    `const STORE_LOCATION = {
  address: "Ubicación por configurar",
  latitude: null,
  longitude: null,
  hours: "Horario por configurar",
  mapsUrl: "https://www.google.com/maps",
  directionsUrl: "https://www.google.com/maps"
};`
  );
  // El WhatsApp y el punto de recogida vienen de la tienda ITM; el config
  // estático solo los rellena si trae un valor propio.
  text = replaceOnce(
    text,
    `    activeWhatsappNumber = configuredPhone.startsWith("52")
      ? configuredPhone
      : configuredPhone
        ? \`52\${configuredPhone}\`
        : "";`,
    `    if (configuredPhone) {
      activeWhatsappNumber = configuredPhone.startsWith("52")
        ? configuredPhone
        : \`52\${configuredPhone}\`;
    }`
  );
  text = replaceOnce(
    text,
    `  } catch (error) {
    activeWhatsappNumber = "";
    activeStoreLiveUrl = "";
    console.error(`,
    `  } catch (error) {
    console.error(`
  );
  // Encabezado del mensaje de WhatsApp del pedido.
  text = replaceAll(text, '"*FONDA MEXICANA*"', '"*__EB_PROJECT_NAME_UPPER__*"', { required: 1 });
  // 4 apariciones originales; una ya se sustituyó dentro de STORE_LOCATION.
  text = replaceAll(text, 'Fonda Mexicana', PLACEHOLDER, { required: 3 });
  return text;
}

function neutralizeCss(name, text) {
  if (name === 'styles.css') {
    text = replaceAll(
      text,
      ',\n    url("assets/fonda-mexicana-hero.png") center right / cover no-repeat;',
      ';',
      { required: 1 }
    );
    text = replaceAll(
      text,
      ',\n      url("assets/fonda-mexicana-hero.png") center / cover no-repeat;',
      ';',
      { required: 2 }
    );
  }
  if (name === 'home.css') {
    text = replaceAll(
      text,
      '    url("assets/home-talavera-1200.jpg") center / cover no-repeat,\n',
      '',
      { required: 2 }
    );
    text += `
/* Bloque neutral para proyectos sin ubicación configurada */
.fonda-map-empty {
  display: grid;
  place-items: center;
  min-height: 460px;
  border-radius: 24px;
  background: linear-gradient(135deg, #e9ded2, #f6efe6);
  color: #7a6a5c;
  font-weight: 700;
  letter-spacing: 0.02em;
}
`;
  }
  return text;
}

const FORBIDDEN = [
  '096b6e30-cc77-4fa2-bd2f-1e2696d742f2',
  'Fonda Mexicana',
  'FONDA MEXICANA',
  '529996448579',
  '9996448579',
  '20.99977',
  '-89.624164',
  '15318250857817601893',
  'assets/fonda-mexicana-logo.png',
  'assets/fonda-mexicana-hero.png',
  'assets/home-',
  'Mérida',
  'Tacos dorados',
  'Pozole rojo',
  'Chiles en nogada',
  'Enchiladas D. Frida',
  'Huaraches'
];

fs.rmSync(destination, { recursive: true, force: true });
for (const name of COPY) {
  const raw = read(name);
  const output = name.endsWith('.html')
    ? neutralizeHtml(name, raw)
    : name === 'app.js'
      ? neutralizeApp(raw)
      : name.endsWith('.css')
        ? neutralizeCss(name, raw)
        : raw;

  for (const value of FORBIDDEN) {
    if (output.includes(value)) {
      throw new Error(`Rastro de Fonda en ${name}: ${value}`);
    }
  }

  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  console.log(String(Buffer.byteLength(output)).padStart(8), name);
}

for (const [name, output] of Object.entries(EXTRA_ASSETS)) {
  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  console.log(String(Buffer.byteLength(output)).padStart(8), name);
}

console.log('FONDA_NEUTRAL_OK');
