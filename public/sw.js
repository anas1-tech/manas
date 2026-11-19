// يخلي الموقع يفتح بسرعة وحتى لو النت ضعيف
const CACHE = 'mans-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest']))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // بيانات Supabase دايم من النت
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put('/', r.clone())); return r; }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok && url.pathname.startsWith('/assets/')) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return r; })));
});
