// オフライン用 Service Worker（tools/build-sw.mjs で自動生成。直接編集しない）
// 学習記録は localStorage にあり、このキャッシュとは別。キャッシュを入れ替えても学習記録は消えない。
// 版ごとにすべてのファイルを1つのキャッシュにまとめるので、古い版と新しい版のファイルが混ざらない。
const PREFIX = 'otsu6-speed-';
const CACHE = PREFIX + '93d0fad2c9a1';
const FILES = [
  "./",
  "../shared/anim/defs-chem.js",
  "../shared/anim/defs-class6.js",
  "../shared/anim/index.js",
  "../shared/anim/player.js",
  "../shared/anim/svg.js",
  "../shared/core/analysis.js",
  "../shared/core/completion.js",
  "../shared/core/content.js",
  "../shared/core/curriculum.js",
  "../shared/core/engine.js",
  "../shared/core/exam.js",
  "../shared/core/store.js",
  "../shared/core/util.js",
  "../shared/data/config.json",
  "../shared/data/content/chem-1.json",
  "../shared/data/content/chem-2.json",
  "../shared/data/content/law-1.json",
  "../shared/data/content/law-2.json",
  "../shared/data/content/prop-1.json",
  "../shared/data/content/prop-2.json",
  "../shared/data/substances.json",
  "../shared/ui/dom.js",
  "../shared/ui/home.js",
  "../shared/ui/mock.js",
  "../shared/ui/quiz.js",
  "../shared/ui/shell.js",
  "../shared/ui/styles.css",
  "../shared/ui/views.js",
  "./app.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => {
    // 初回はすぐ有効に。更新時は画面の「更新する」を押したときに切り替える（学習中の画面を急に変えない）
    if (!self.registration.active) return self.skipWaiting();
  }));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 出典サイトなど外部はそのまま通信（オフライン機能と分離）
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      if (req.mode === 'navigate') return (await cache.match('./index.html', { ignoreVary: true })) || Response.error();
      return Response.error();
    }
  })());
});
