// Кеш калькулятора на пристрої: сторінка й картинки відкриваються миттєво й без інтернету,
// а свіжа версія тихо підтягується у фоні (stale-while-revalidate) і діє з наступного відкриття.
// Запити до Apps Script (script.google.com, POST) сюди не потрапляють — вхід і довідники завжди живі.
// VERSION переписує tools/stamp-sw.mjs перед кожним викладанням: нова версія — старий кеш видаляється.
const VERSION = 'v-4be72492b3';
const CACHE = 'nesvich-calc-' + VERSION;
const SCOPE = new URL(self.registration.scope);
const PAGE = new URL('index.html', SCOPE).href;
const IMAGE = /\.(?:webp|png|jpe?g|svg|ico)$/i;

self.addEventListener('install', function (event) {
  // cache: 'reload' — повз HTTP-кеш GitHub Pages (10 хв), інакше нова версія воркера взяла б стару сторінку.
  event.waitUntil(caches.open(CACHE)
    .then(function (cache) { return cache.add(new Request(PAGE, { cache: 'reload' })); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys()
    .then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('nesvich-calc-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    })
    .then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || url.search) return;
  const page = req.mode === 'navigate' && (url.href === SCOPE.href || url.href === PAGE);
  if (!page && !IMAGE.test(url.pathname)) return;
  const key = page ? PAGE : url.href;
  event.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (hit) {
      const fresh = fetch(new Request(key, { cache: 'no-cache' })).then(function (res) {
        if (res.ok && !res.redirected) return cache.put(key, res.clone()).then(function () { return res; });
        return res;
      });
      if (hit) { event.waitUntil(fresh.catch(function () {})); return hit; }
      return fresh;
    });
  }));
});
