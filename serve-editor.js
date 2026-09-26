const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 4175;

const DEMO_IMAGE = "https://scaebulgcuvqpucondws.supabase.co/storage/v1/object/public/site-images/b4cf8e56-f33a-4b5e-b62c-cf92d723e561/1787095278917-nky4y.jpg";

const stub = `
<script>
window.__stubReady = true;
window.EB_SUPABASE_CONFIG = {
  url: "https://scaebulgcuvqpucondws.supabase.co",
  anonKey: "anon-stub-key"
};
const STORE = {
  photos: new Map(),
  removed: [],
  client_projects: [
    { id: "prj-1", name: "Cafetería del Parque", user_id: "user-1", project_stage: "Activo", hosting_type: "cloudflare", site_live_url: "https://cafeteria.pages.dev" }
  ],
  client_site_pages: [
    { id: "page-1", project_id: "prj-1", name: "inicio", slug: "inicio", page_order: 0, is_visible: true }
  ],
  client_site_page_versions: [
    { id: "v-pub-1", page_id: "page-1", version_kind: "published", content_json: { elements: { "hero.title": { type: "text", value: "Cafetería del Parque" }, "hero.image": { type: "image", value: "/demo-photo.jpg" }, "text.heading": { type: "text", value: "Nosotros" }, "text.body": { type: "text", value: "Somos una cafetería de barrio." }, "gallery.images": { type: "json", value: '[{"url":"/demo-photo.jpg","alt":"Demo"}]' } }, sections: [ { id: "hero-1", type: "hero", label: "Portada", visible: true, data: { title: "Cafetería del Parque", image_url: "/demo-photo.jpg", image_alt: "Cafetería" } }, { id: "text-1", type: "text", label: "Nosotros", visible: true, data: { heading: "Nosotros", body: "Somos una cafetería de barrio." } }, { id: "gal-1", type: "gallery", label: "Galería", visible: true, data: { heading: "Galería", images: [ { url: "/demo-photo.jpg", alt: "Demo" } ] } }, { id: "vid-1", type: "video", label: "Video", visible: true, data: { heading: "Nuestro video", description: "Todo lo que hacemos se ve así.", video_url: "https://www.youtube.com/watch?v=TsDNMnly-Cc" } } ] }, updated_by: "user-1" },
    { id: "v-dft-1", page_id: "page-1", version_kind: "draft", content_json: { elements: { "hero.title": { type: "text", value: "Cafetería del Parque" }, "hero.image": { type: "image", value: "/demo-photo.jpg" }, "text.heading": { type: "text", value: "Nosotros" }, "text.body": { type: "text", value: "Somos una cafetería de barrio." }, "gallery.images": { type: "json", value: '[{"url":"/demo-photo.jpg","alt":"Demo"}]' } }, sections: [ { id: "hero-1", type: "hero", label: "Portada", visible: true, data: { title: "Cafetería del Parque", image_url: "/demo-photo.jpg", image_alt: "Cafetería" } }, { id: "text-1", type: "text", label: "Nosotros", visible: true, data: { heading: "Nosotros", body: "Somos una cafetería de barrio." } }, { id: "gal-1", type: "gallery", label: "Galería", visible: true, data: { heading: "Galería", images: [ { url: "/demo-photo.jpg", alt: "Demo" } ] } }, { id: "vid-1", type: "video", label: "Video", visible: true, data: { heading: "Nuestro video", description: "Todo lo que hacemos se ve así.", video_url: "https://www.youtube.com/watch?v=TsDNMnly-Cc" } } ] }, updated_by: "user-1" },
    { id: "v-bas-1", page_id: "page-1", version_kind: "base", content_json: { elements: { "hero.title": { type: "text", value: "Cafetería del Parque" }, "hero.image": { type: "image", value: "/demo-photo.jpg" }, "text.heading": { type: "text", value: "Nosotros" }, "text.body": { type: "text", value: "Somos una cafetería de barrio." }, "gallery.images": { type: "json", value: '[{"url":"/demo-photo.jpg","alt":"Demo"}]' } }, sections: [ { id: "hero-1", type: "hero", label: "Portada", visible: true, data: { title: "Cafetería del Parque", image_url: "/demo-photo.jpg", image_alt: "Cafetería" } }, { id: "text-1", type: "text", label: "Nosotros", visible: true, data: { heading: "Nosotros", body: "Somos una cafetería de barrio." } }, { id: "gal-1", type: "gallery", label: "Galería", visible: true, data: { heading: "Galería", images: [ { url: "/demo-photo.jpg", alt: "Demo" } ] } }, { id: "vid-1", type: "video", label: "Video", visible: true, data: { heading: "Nuestro video", description: "Todo lo que hacemos se ve así.", video_url: "https://www.youtube.com/watch?v=TsDNMnly-Cc" } } ] }, updated_by: "user-1" }
  ]
};
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function findVersion(kind) {
  const row = STORE.client_site_page_versions.find(v => v.version_kind === kind && v.page_id === "page-1");
  const copy = clone(row);
  copy.content_json = clone(row.content_json || {});
  return copy;
}
const makeQuery = (table, state) => {
    const q = {
      _t: table,
      _w: null,
      _in: null,
      _single: false,
      _u: null
    };
    const chain = (name) => (...args) => {
      if (name === "eq") q._w = { k: args[0], v: args[1] };
      if (name === "in") q._in = { k: args[0], v: args[1] };
      if (name === "single" || name === "maybeSingle") q._single = true;
      if (name === "update") q._u = args[0];
      return new Proxy(q, handler);
    };
    const handler = {
      get(t, prop) {
        if (prop === "then") {
          return (resolve) => {
            const one = (data) => q._single ? (Array.isArray(data) ? (data[0] || null) : data) : data;
            const t2 = q._t;
            if (t2 === "client_projects" && q._w) {
              const row = STORE.client_projects.find(p => String(p.id) === String(q._w.v));
              return Promise.resolve({ data: one(clone(row) || null), error: null }).then(resolve);
            }
            if (t2 === "client_site_pages" && q._w) {
              const rows = STORE.client_site_pages.filter(p => p.project_id === String(q._w.v));
              return Promise.resolve({ data: one(clone(rows)), error: null }).then(resolve);
            }
            if (t2 === "client_site_page_versions" && q._in) {
              const ids = q._in.v || [];
              const rows = STORE.client_site_page_versions.filter(v => ids.includes(v.page_id));
              return Promise.resolve({ data: one(clone(rows)), error: null }).then(resolve);
            }
            if (t2 === "client_site_page_versions" && q._w) {
              const kind = q._w.k === "version_kind" ? q._w.v : null;
              if (kind) return Promise.resolve({ data: one(clone([findVersion(kind)])), error: null }).then(resolve);
              const rows = STORE.client_site_page_versions.filter(v => v.page_id === String(q._w.v));
              return Promise.resolve({ data: one(clone(rows)), error: null }).then(resolve);
            }
            if (t2 === "client_profiles") {
              const row = (STORE.profiles || []).find(p => String(p.id) === String(q._w?.v)) || { id: "user-1", full_name: "Prueba Stub", is_crm_admin: false };
              return Promise.resolve({ data: one(clone(row)), error: null }).then(resolve);
            }
            return Promise.resolve({ data: one([]), error: null }).then(resolve);
          };
        }
        if (prop in t) return t[prop];
        return chain(String(prop));
      }
    };
    return new Proxy(q, handler);
  };

const fakeDb = {
  from: (table) => makeQuery(table, { pageId: "page-1" }),
  rpc: (name, args) => {
    if (name === "client_prepare_site_draft") return Promise.resolve({ data: clone(STORE.client_site_pages), error: null });
    if (name === "client_publish_site_changes") {
      const draft = findVersion("draft");
      const pub = STORE.client_site_page_versions.find(v => v.version_kind === "published" && v.page_id === "page-1");
      pub.content_json = draft.content_json;
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  },
  storage: {
    from: (bucket) => ({
      upload: async (p, blob) => {
        STORE.photos.set(p, blob);
        return { error: null };
      },
      getPublicUrl: (p) => ({ data: { publicUrl: "https://scaebulgcuvqpucondws.supabase.co/storage/v1/object/public/site-images/" + p } }),
      remove: async (paths) => { STORE.removed.push(...paths); return { error: null }; }
    })
  }
};
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: "stub-token", user: { id: "user-1", email: "prueba@stub.mx" } } }, error: null })
    },
    ...fakeDb
  })
};
document.addEventListener("DOMContentLoaded", async () => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "/demo-photo.jpg";
});
</script>
`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/demo-photo.jpg") {
    const demo = path.join(process.env.TEMP || "C:\\Windows\\Temp", "opencode", "demo-photo.jpg");
    fs.readFile(demo, (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(d);
    });
    return;
  }
  let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("NOT FOUND"); return; }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".html") {
      let html = data.toString("utf8");
      html = html.replace('<script src="supabase-config.js"></script>', stub + '');
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    }
  });
}).listen(PORT, () => console.log("stub editor en http://localhost:" + PORT));