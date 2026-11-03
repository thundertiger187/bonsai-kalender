// Service Worker: App-Shell und Daten offline verfügbar.
// Seite und Manifest: Netz zuerst (damit neue Icons/Manifest-Änderungen sofort ankommen), sonst Cache.
// Übrige Dateien: Cache zuerst, im Hintergrund aktualisieren.
const VERSION = 'bonsaijahr-v1.2.0';
const ASSETS = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/logic.js', 'js/store.js', 'data/species.json', 'manifest.webmanifest',
  'fonts/fraunces.woff2', 'fonts/inter.woff2', 'icons/logo.svg', 'icons/logo-small.svg', 'icons/favicon-v2.svg', 'icons/favicon-32-v2.png',
  'icons/icon-192-v2.png', 'icons/icon-512-v2.png', 'icons/maskable-512-v2.png', 'icons/apple-touch-icon-v2.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;
  const netFirst = req.mode === 'navigate' || url.pathname.endsWith('.webmanifest');
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = req.mode === 'navigate' ? 'index.html' : req;
    if (netFirst) {
      try {
        const r = await fetch(req, { cache: 'no-cache' });
        if (r.ok) { cache.put(key, r.clone()); return r; }
      } catch {}
      return (await cache.match(key, { ignoreSearch: true })) || Response.error();
    }
    const hit = await cache.match(req);
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  })());
});
