// Service Worker: macht die App offline nutzbar und lädt Updates.
// WICHTIG bei jedem Update: VERSION erhöhen (z. B. 1.0.1). Nur dann erkennt das iPhone die neue Version.
const VERSION = '1.0.0';
const CACHE = 'gymapp-' + VERSION;

const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/backup.js',
  'js/charts.js',
  'js/db.js',
  'js/einstellungen.js',
  'js/fortschritt.js',
  'js/heute.js',
  'js/plan.js',
  'js/progression.js',
  'js/store.js',
  'js/timer.js',
  'js/training.js',
  'js/ui.js',
  'js/util.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gymapp-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const treffer = await cache.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        const antwort = await fetch(req);
        if (antwort.ok && antwort.type === 'basic') cache.put(req, antwort.clone());
        return antwort;
      } catch (err) {
        if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
        throw err;
      }
    }),
  );
});
