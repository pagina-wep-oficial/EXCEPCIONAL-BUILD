(function () {
  "use strict";
  const databaseName = "eb-casa-nopal-demo-media-v1";
  const prefix = `${window.DemoStore.stateKey}:`;
  const urls = new Map();
  const owned = new Set();
  let connection;
  function database() {
    if (!connection) connection = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("Tu navegador no permite guardar archivos locales en esta demo.")); return; }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files"); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { connection = null; reject(new Error("No se pudo abrir el almacenamiento de archivos.")); };
    });
    return connection;
  }
  async function transaction(mode, action) {
    const databaseConnection = await database();
    return new Promise((resolve, reject) => {
      const current = databaseConnection.transaction("files", mode);
      const request = action(current.objectStore("files"));
      let result;
      request.onsuccess = () => { result = request.result; };
      current.oncomplete = () => resolve(result);
      current.onabort = current.onerror = () => reject(new Error("No se pudo guardar el archivo. Revisa el espacio disponible."));
    });
  }
  async function save(file) {
    const type = ["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "image" : ["video/mp4", "video/webm"].includes(file.type) ? "video" : "";
    if (!type) throw new Error("Usa imágenes JPG, PNG o WebP, o videos MP4/WebM.");
    if (!file.size || file.size > (type === "video" ? 25 : 5) * 1024 * 1024) throw new Error(type === "video" ? "El video debe pesar hasta 25 MB." : "La imagen debe pesar hasta 5 MB.");
    const key = prefix + crypto.randomUUID();
    await transaction("readwrite", store => {
      const record = { key, blob: file };
      // Algunas instalaciones crearon el almacén con keyPath "key" y otras
      // con clave externa. Soportamos ambas para no perder la carga.
      return store.keyPath ? store.put(record) : store.put(record, key);
    });
    owned.add(key);
    return { source_url: `demo-media:${key}`, type, is_primary: false, fit_mode: "cover", focal_x: 50, focal_y: 50, zoom: 1, rotation: 0 };
  }
  async function resolve(source) {
    if (!String(source).startsWith("demo-media:")) return String(source).startsWith("assets/") ? `demo-casa-nopal/${source}` : source;
    const key = source.slice(11);
    if (urls.has(key)) return urls.get(key);
    const record = await transaction("readonly", store => store.get(key));
    const file = record?.blob || record;
    if (!file) throw new Error("No se encontró ese archivo en este navegador.");
    const url = URL.createObjectURL(file); urls.set(key, url); return url;
  }
  async function prune(clear = false) {
    if (!window.indexedDB) return;
    const used = new Set(Object.values(window.DemoStore.model.catalogs).flatMap(catalog => catalog.products.flatMap(product => (product.media || []).map(media => media.source_url))));
    const keys = await transaction("readonly", store => store.getAllKeys());
    for (const key of keys.filter(key => String(key).startsWith(prefix) && (clear || owned.has(key) && !used.has(`demo-media:${key}`)))) {
      await transaction("readwrite", store => store.delete(key));
      if (urls.has(key)) URL.revokeObjectURL(urls.get(key));
      urls.delete(key);
    }
  }
  window.addEventListener("pagehide", () => { urls.forEach(url => URL.revokeObjectURL(url)); urls.clear(); });
  window.DemoMedia = { save, resolve, prune, clear: () => prune(true) };
})();
