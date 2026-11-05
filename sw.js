// Solo guarda la carcasa de la app. Los datos (Apps Script) nunca pasan por el caché del service worker.
const V = 'mp-v10';
const SHELL = ['./', 'index.html', 'assets/portal.css', 'assets/app.js', 'assets/logo-me.png', 'assets/logo-michael-espinosa.png', 'assets/icons/favicon-32.png', 'assets/icons/icon-192.png', 'assets/foto-perfil.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok) { const copia = r.clone(); caches.open(V).then(function (c) { c.put(e.request, copia); }); }
    return r;
  }).catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match('index.html'); }); }));
});
