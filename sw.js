const CACHE = 'worklog-v8';
const CORE = ['./', './index.html', './manifest.json',
  './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

// Страница приложения: сначала сеть, кэш — запасной вариант.
// Так новая версия подхватывается сразу, а без интернета работает старая.
function isPage(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (isPage(e.request)) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-store' });
        const c = await caches.open(CACHE);
        c.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Иконки, манифест, библиотеки: сначала кэш — они меняются редко.
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      const c = await caches.open(CACHE);
      c.put(e.request, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
