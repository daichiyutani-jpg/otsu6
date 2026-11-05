// 2つのアプリの Service Worker（sw.js）を作り直す。ファイル一覧と版（内容のハッシュ）を自動で入れる。
// アプリや問題データを変えたら公開前に必ず実行：node tools/build-sw.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const walk = (p, out = []) => { if (statSync(p).isDirectory()) readdirSync(p).forEach((f) => walk(join(p, f), out)); else out.push(p); return out; };
const shared = walk(join(ROOT, 'shared'));

for (const app of ['speed', 'full']) {
  const appDir = join(ROOT, app);
  const own = walk(appDir).filter((f) => !f.endsWith('sw.js'));
  const all = [...own, ...shared].sort();
  const hash = createHash('sha256');
  for (const f of all) { hash.update(relative(ROOT, f)); hash.update(readFileSync(f)); }
  const version = hash.digest('hex').slice(0, 12);
  const list = ['./', ...all.map((f) => { const r = relative(appDir, f).split(sep).join('/'); return r.startsWith('..') ? r : './' + r; })];
  const sw = `// オフライン用 Service Worker（tools/build-sw.mjs で自動生成。直接編集しない）
// 学習記録は localStorage にあり、このキャッシュとは別。キャッシュを入れ替えても学習記録は消えない。
// 版ごとにすべてのファイルを1つのキャッシュにまとめるので、古い版と新しい版のファイルが混ざらない。
const PREFIX = 'otsu6-${app}-';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(list, null, 2)};

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
`;
  writeFileSync(join(appDir, 'sw.js'), sw);
  console.log(`${app}/sw.js：${list.length}ファイル、版 ${version}`);
}
