// アプリの土台：データ読み込み・保存・画面切り替え（#/〜）・下部メニュー・更新通知・学習時間の記録
import { h, toast } from './dom.js';
import { loadContent } from '../core/content.js';
import { createStore } from '../core/store.js';
import { addStudyTime } from '../core/engine.js';
import { sharedRoutes } from './views.js';

const DATA_BASE = new URL('../data/', import.meta.url);

export async function startApp(app) {
  document.documentElement.classList.add('app-' + app.id);
  const root = document.getElementById('app');
  root.replaceChildren(h('div.loading', '読み込み中…'));
  let content;
  try {
    content = await loadContent(async (p) => {
      const res = await fetch(new URL(p, DATA_BASE));
      if (!res.ok) throw new Error(p + ' ' + res.status);
      return res.json();
    });
  } catch (e) {
    root.replaceChildren(h('div.card', h('h2', 'データを読み込めませんでした'), h('p', '通信状態を確かめて、再読み込みしてください。一度読み込めば次からはオフラインでも使えます。'), h('p.small.muted', String(e))));
    return;
  }
  const store = createStore(app.id);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  const ctx = { app, content, store, root, state: () => store.get() };
  const routes = { ...sharedRoutes, ...app.routes };
  applySettings(store.get().settings);
  store.onChange((s) => applySettings(s.settings));

  ctx.go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
  ctx.render = render;
  ctx.setResume = (label) => store.update((s) => { s.resume = { route: location.hash, label, t: Date.now() }; });

  let cleanup = null;
  function render() {
    const hash = location.hash || '#/';
    const [path, qs] = hash.slice(1).split('?');
    const parts = path.split('/').filter(Boolean);
    const name = parts[0] || 'home';
    const args = parts.slice(1).map(decodeURIComponent);
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const view = routes[name] || routes.home;
    if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
    const page = { title: app.name, back: name !== 'home', nav: name, body: null, fullscreen: false, onLeave: null };
    try {
      view(ctx, page, args, query);
    } catch (e) {
      console.error(e);
      page.body = h('div.card', h('h2', '表示できませんでした'), h('p.small', String(e?.message || e)), h('a.btn', { href: '#/' }, 'ホームへ'));
    }
    cleanup = page.onLeave;
    paint(page, name);
  }

  function paint(page, name) {
    const top = page.fullscreen ? null : h('header.top',
      page.back ? h('button.back', { 'aria-label': '戻る', onclick: () => (history.length > 1 ? history.back() : ctx.go('#/')) }, '‹') : null,
      h('h1', page.title),
      navigator.onLine ? null : h('span.offline-pill', 'オフライン'),
      h('span.app-tag', app.short));
    const nav = page.fullscreen ? null : h('nav.nav', { 'aria-label': 'メインメニュー' },
      app.nav.map((n) => h('a' + (n.match.includes(name) ? '.on' : ''), { href: n.href }, h('span.ico', { 'aria-hidden': 'true' }, n.ico), n.label)));
    root.replaceChildren(...[top, h('main', page.body), nav].filter(Boolean));
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  trackTime(store);
  registerSW();
  render();
  return ctx;
}

function applySettings(st) {
  const el = document.documentElement;
  el.classList.toggle('reduce-motion', !!st.reduceMotion);
  el.style.setProperty('--scale', String(st.fontScale || 1));
}

/** 画面を見ていて、直近2分以内に操作があった時間だけを学習時間として数える */
function trackTime(store) {
  let lastAct = Date.now();
  let lastTick = Date.now();
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000; lastTick = now;
    if (document.visibilityState === 'visible' && now - lastAct < 120000 && dt < 120) store.update((s) => addStudyTime(s, dt, now));
  }, 15000);
  document.addEventListener('visibilitychange', () => { lastTick = Date.now(); if (document.visibilityState === 'hidden') store.saveNow(); });
  window.addEventListener('pagehide', () => store.saveNow());
}

/** Service Worker：新しい版が入ったら知らせて、押したら切り替える（古いファイルが混ざらないよう版ごとに丸ごと入れ替え） */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (w) => {
      if (document.querySelector('.update-bar')) return;
      const bar = h('div.update-bar', { role: 'status' }, h('span', '新しい版があります。'),
        h('button.btn.sm.primary', { onclick: () => { w.postMessage('skipWaiting'); bar.remove(); } }, '更新する'));
      document.body.append(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return; reloaded = true;
    toast('更新しました');
    location.reload();
  });
}
