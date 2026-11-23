/**
 * Service worker del ERP: permite ABRIR la app sin internet.
 * - Páginas: red primero; si no hay red, la última versión guardada.
 * - Archivos /assets (con hash en el nombre): de la caché primero.
 * - Las peticiones a la API NO pasan por aquí: su modo sin internet lo maneja src/offline/.
 */
const CACHE = 'erp-app-v1';
const BASE = ['/', '/index.html', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const guardar = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => guardar('/index.html', res))
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  const propio = url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg');
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (propio || fuentes) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => guardar(req, res))));
  }
});
