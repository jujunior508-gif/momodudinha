// Guarda a carta no celular para abrir mesmo sem internet.
const VERSION = "v22";
const CORE = [
  "./", "index.html", "style.css?v=22", "script.js?v=22", "hero3d.js", "coracao.glb",
  "assets/coracao-poster.webp", "assets/foto-1.webp", "assets/foto-2.webp", "assets/foto-3.webp",
  "assets/icon-192.png", "manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return; // áudio usa range: deixa a rede cuidar
  const url = new URL(req.url);

  // página: rede primeiro (sempre a versão mais nova), cache se estiver offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // arquivos do site, three.js e fontes: cache primeiro, atualiza em segundo plano
  const cacheable = url.origin === location.origin ||
    /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|api\.qrserver\.com/.test(url.host);
  if (!cacheable || url.pathname.endsWith(".mp3")) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
