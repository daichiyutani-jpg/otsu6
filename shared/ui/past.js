// 公式の過去問（利用者が自分で取り込む）
// ・公式PDFは利用者が消防試験研究センターのサイトから自分でダウンロードし、この端末の中だけで読み込む
// ・問題は画像として切り出してこの端末（IndexedDB）にだけ保存する。アプリにも公開リポジトリにも過去問は入っていない
// ・どこにも送信しない。バックアップ（書き出し）にも問題の画像は含めない（回答の記録だけ）
// ・解説は公式に無いので付けない
import { h, bar, toast, confirmBox } from './dom.js';
import { questionBlocks, inkLines, redGlyphs, glyphFeature, classifyGlyph, answerTables, assemble, scorePast, subjectOfNo, EXPECT } from '../core/pastimport.js';
import { DIGIT_TEMPLATES } from '../core/past-templates.js';
import { targets } from '../core/completion.js';
import { pct, fmtClock, rate } from '../core/util.js';

const OFFICIAL_PAGE = 'https://www.shoubo-shiken.or.jp/kikenbutsu/exercise.html';
const NUM = ['①', '②', '③', '④', '⑤'];
const SCALE_SCAN = 1, SCALE_ANS = 3, SCALE_IMG = 2.5;
const LOW_CONF = 0.5;

// ---------- 端末内の保存（IndexedDB。両アプリで共用） ----------
const DB = 'otsu6-past', STORE = 'kv';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { d.close(); res(out && 'result' in out ? out.result : out); };
    tx.onerror = () => { d.close(); rej(tx.error); };
    tx.onabort = () => { d.close(); rej(tx.error || new Error('保存できませんでした')); };
  });
}
const idbGet = (k) => idb('readonly', (s) => s.get(k));
const idbClear = () => idb('readwrite', (s) => s.clear());
async function idbPutAll(entries) { await idb('readwrite', (s) => { for (const [k, v] of entries) s.put(v, k); }); }

let metaCache; // undefined=未読込, null=未取り込み
const urlCache = new Map();
export async function loadPastMeta(force = false) {
  if (metaCache !== undefined && !force) return metaCache;
  try { metaCache = (await idbGet('meta')) || null; } catch { metaCache = null; }
  return metaCache;
}
async function imgUrl(key) {
  if (urlCache.has(key)) return urlCache.get(key);
  const blob = await idbGet(key);
  const u = blob ? URL.createObjectURL(blob) : null;
  urlCache.set(key, u);
  return u;
}
function pastImg(key, alt) {
  const img = h('img.past-img', { alt, loading: 'lazy' });
  const box = h('div.past-zoom', { title: 'タップで拡大・縮小', onclick: () => box.classList.toggle('on') }, img);
  imgUrl(key).then((u) => { if (u) img.src = u; else box.replaceWith(h('p.muted', '画像が見つかりません。取り込み直してください。')); });
  return box;
}
function resetCaches() { for (const u of urlCache.values()) if (u) URL.revokeObjectURL(u); urlCache.clear(); metaCache = undefined; }

// ---------- 取り込み（すべて端末内で処理） ----------
let pdfjsP = null;
function loadPdfjs() {
  if (!pdfjsP) {
    pdfjsP = import(new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href).then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return m;
    });
  }
  return pdfjsP;
}

async function renderPage(doc, pageNo, scale) {
  const page = await doc.getPage(pageNo);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  const c2 = canvas.getContext('2d', { willReadFrequently: true });
  c2.fillStyle = '#fff'; c2.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: c2, viewport: vp }).promise;
  page.cleanup();
  return canvas;
}
const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
const toBlob = (canvas, type = 'image/jpeg', q = 0.88) => new Promise((res) => canvas.toBlob(res, type, q));

function cropTo(srcs, pad) {
  // srcs: [{canvas, x0,y0,x1,y1}]（割合）を縦に並べて1枚に
  const rects = srcs.map(({ canvas, x0, y0, x1, y1 }) => {
    const W = canvas.width, H = canvas.height;
    const sx = Math.max(0, Math.floor((x0 - pad) * W)), sy = Math.max(0, Math.floor((y0 - pad) * H));
    const ex = Math.min(W, Math.ceil((x1 + pad) * W)), ey = Math.min(H, Math.ceil((y1 + pad) * H));
    return { canvas, sx, sy, w: ex - sx, h: ey - sy };
  });
  const out = document.createElement('canvas');
  out.width = Math.max(...rects.map((r) => r.w)); out.height = rects.reduce((a, r) => a + r.h, 0);
  const c = out.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const r of rects) { c.drawImage(r.canvas, r.sx, r.sy, r.w, r.h, 0, y, r.w, r.h); y += r.h; }
  return out;
}

export async function importPdf(file, onStep = () => {}) {
  const pdfjs = await loadPdfjs();
  onStep('PDFを開いています…', 0);
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    throw new Error('PDFを開けませんでした。公式サイトからダウンロードしたPDFか確かめてください。' + (e?.name === 'PasswordException' ? '（パスワード付きのPDFには対応していません）' : ''));
  }
  try {
    const N = doc.numPages;
    const pages = [];
    const answerPages = [];
    for (let p = 1; p <= N; p++) {
      onStep(`ページを調べています（${p}/${N}）`, p / N * 0.6);
      const cv = await renderPage(doc, p, SCALE_SCAN);
      const img = pixels(cv);
      let redN = 0;
      for (let o = 0; o < img.data.length; o += 16) if (img.data[o] > 150 && img.data[o + 1] < 120 && img.data[o + 2] < 120) redN++;
      if (redN > 20) answerPages.push(p); // 赤い正答があるページ（解答表）は問題として扱わない
      pages.push({ lines: redN > 20 ? [] : inkLines(img) });
    }
    const { blocks } = questionBlocks(pages);
    onStep('正答を読み取っています…', 0.65);
    const pg = [];
    for (const p of answerPages) {
      const cv = await renderPage(doc, p, SCALE_ANS);
      const { glyphs, mask, W, H } = redGlyphs(pixels(cv));
      for (const g of glyphs) { g.f = glyphFeature(mask, W, g); Object.assign(g, classifyGlyph(g.f, DIGIT_TEMPLATES)); }
      pg.push({ page: p, glyphs, W, H, canvas: cv });
    }
    const tables = answerTables(pg);
    const res = assemble(blocks, tables);
    if (!res.ok) throw new Error('このPDFの形式には対応していません。' + res.errors.join(' ') + ' 公式サイトの「乙種第１，２，３，５，６類試験」のPDFか確かめてください。');

    // 問題を画像に切り出す（必要なページだけ高い解像度で）
    const need = [...new Set(res.questions.flatMap((q) => q.parts.map((pt) => pt.page)))];
    const hi = new Map();
    const entries = [];
    let k = 0;
    for (const q of res.questions) {
      for (const pt of q.parts) if (!hi.has(pt.page)) { hi.set(pt.page, await renderPage(doc, pt.page + 1, SCALE_IMG)); k++; onStep(`問題を切り出しています（${k}/${need.length}）`, 0.7 + 0.25 * k / need.length); }
      const cv = cropTo(q.parts.map((pt) => ({ canvas: hi.get(pt.page), x0: pt.x0, y0: pt.y0, x1: pt.x1, y1: pt.y1 })), 0.012);
      entries.push(['img:' + q.no, await toBlob(cv)]);
      // もう使わないページは解放
      const later = res.questions.filter((x) => x.no > q.no).flatMap((x) => x.parts.map((p2) => p2.page));
      for (const p of [...hi.keys()]) if (!later.includes(p)) { hi.get(p).width = 0; hi.delete(p); }
    }
    // 解答表の画像（読み取った正答の確認用）
    const tblImg = async (t, key, headPad) => {
      const src = pg.find((x) => x.page === t.page);
      const cv = cropTo([{ canvas: src.canvas, x0: 0.08, y0: t.box.y0 / src.H - headPad, x1: 0.92, y1: t.box.y1 / src.H }], 0.015);
      entries.push([key, await toBlob(cv, 'image/png')]);
    };
    await tblImg(res.tables.common, 'img:ans-common', 0.08);
    await tblImg(res.tables.target, 'img:ans-target', 0.08);
    pg.forEach((x) => { x.canvas.width = 0; });

    let info = {};
    try { info = (await doc.getMetadata()).info || {}; } catch {}
    const mod = /D:(\d{4})(\d{2})(\d{2})/.exec(info.ModDate || '');
    const meta = {
      version: 1,
      importedAt: Date.now(),
      pdfDate: mod ? `${mod[1]}-${mod[2]}-${mod[3]}` : null,
      pdfPages: N,
      fingerprint: doc.fingerprints?.[0] || null,
      questions: res.questions.map((q) => ({ no: q.no, subject: q.subject, answer: q.answer, readAnswer: q.answer, confidence: Math.round(q.confidence * 100) / 100 })),
      answersChecked: false,
    };
    onStep('この端末に保存しています…', 0.97);
    await idbClear();
    await idbPutAll([...entries, ['meta', meta]]);
    resetCaches();
    onStep('完了', 1);
    return meta;
  } finally {
    try { await task.destroy(); } catch {}
  }
}

// ---------- 記録（学習記録 state.past。問題の内容は持たない） ----------
function ensure(s) {
  if (!s.past || typeof s.past !== 'object') s.past = { sessions: [], q: {}, active: null };
  s.past.sessions ||= []; s.past.q ||= {}; if (!('active' in s.past)) s.past.active = null;
  return s.past;
}
const keyOf = (meta) => Object.fromEntries(meta.questions.map((q) => [q.no, q.answer]));

// ---------- 画面 ----------
export function pastRoute(ctx, page, args, query) {
  page.title = '公式の過去問';
  const body = h('div', h('div.loading', '読み込み中…'));
  page.body = body;
  let leave = null;
  page.onLeave = () => { if (leave) leave(); };
  page.setLeave = (fn) => { leave = fn; };
  loadPastMeta().then((meta) => {
    if (!body.isConnected && !document.body.contains(body)) return;
    let view;
    if (!meta) view = importView(ctx);
    else if (args[0] === 'run') view = runView(ctx, meta, page);
    else if (args[0] === 'result') view = resultView(ctx, meta, args[1]);
    else if (args[0] === 'answers') view = answersView(ctx, meta);
    else if (args[0] === 'history') view = historyView(ctx, meta);
    else view = menuView(ctx, meta);
    body.replaceChildren(view);
  });
}

function termsBox() {
  return h('div.disclaimer',
    h('b', '利用条件について'), h('br'),
    '過去問の著作権は一般財団法人 消防試験研究センターにあります。公式サイトでは、ご自身の学習のためのプリントアウトなど教育目的（非営利）の場合を除き、許可なく複製・転用・販売などの二次利用が禁止されています。',
    h('br'), 'このアプリには過去問は入っていません。あなたが公式サイトから自分でダウンロードしたPDFを、この端末の中だけで読み込み、あなた自身の学習のために使います。読み込んだ問題はどこにも送信せず、バックアップ（書き出し）にも含めません。',
    h('br'), h('b', '読み込んだ問題や画像を、ほかの人に渡したり公開したりしないでください。'));
}

function copyUrlRow() {
  return h('div.row', { style: { margin: '8px 0' } },
    h('code.small', { style: { wordBreak: 'break-all', flex: '1' } }, OFFICIAL_PAGE),
    h('button.btn.sm', { onclick: async () => { try { await navigator.clipboard.writeText(OFFICIAL_PAGE); toast('URLをコピーしました'); } catch { toast('コピーできませんでした。長押しで選んでコピーしてください'); } } }, 'コピー'));
}

function importView(ctx) {
  const status = h('div');
  const prog = h('div', { hidden: true });
  const input = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: { display: 'none' } });
  const btn = h('button.btn.primary.block', { onclick: () => input.click() }, 'PDFを選んで取り込む');
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    if (!f) return;
    btn.disabled = true; prog.hidden = false; status.replaceChildren();
    const label = h('p.small'); const b = bar(0);
    prog.replaceChildren(label, b);
    try {
      const meta = await importPdf(f, (msg, v) => { label.textContent = msg; b.querySelector('.bar-fill').style.width = `${Math.round(v * 100)}%`; });
      metaCache = meta;
      toast(`${meta.questions.length}問を取り込みました`);
      ctx.go('#/past/answers');
    } catch (e) {
      console.error(e);
      prog.hidden = true;
      status.replaceChildren(h('div.note-warn', h('b', '取り込めませんでした　'), String(e?.message || e)));
    } finally { btn.disabled = false; input.value = ''; }
  });
  return h('div',
    h('div.card',
      h('h2', '公式の過去問を取り込む'),
      h('p', '消防試験研究センターが公開している「過去に出題された問題」のPDFを読み込み、乙種第6類で使う35問（法令15・物理化学10・性質消火10）を、本番と同じ5択で解けるようにします。'),
      h('ol.steps-list',
        h('li', '下のURLを開き、「乙種第１，２，３，５，６類試験」のPDFをダウンロードします（iPhoneでは「ファイル」に保存）。', copyUrlRow()),
        h('li', '「PDFを選んで取り込む」を押して、保存したPDFを選びます。'),
        h('li', '読み取った正答を、公式の解答表と見比べて確認します。')),
      input, btn, prog, status,
      h('p.small.muted', { style: { marginTop: '8px' } }, '問題は画像として切り出すので、文字の読み間違いは起きません。正答は解答表の数字を読み取ります。PDFの形式が変わると取り込めないことがあります。')),
    termsBox());
}

function menuView(ctx, meta) {
  const s = ctx.state();
  const past = s.past || { sessions: [], q: {} };
  const exempt = s.settings.exempt;
  const exam = ctx.content.config.exam;
  const wrong = meta.questions.filter((q) => past.q[q.no] && !past.q[q.no].lastOk).map((q) => q.no);
  const unanswered = meta.questions.filter((q) => !past.q[q.no]).map((q) => q.no);
  const start = (kind, nos, opts = {}) => () => {
    ctx.store.update((st) => {
      const p = ensure(st);
      p.active = { id: 'p' + Date.now().toString(36), kind, nos, answers: {}, cur: 0, started: Date.now(), limitSec: opts.limitSec || null, instant: !!opts.instant, label: opts.label };
      st.resume = { route: '#/past/run', label: '公式の過去問の続き', t: Date.now() };
    });
    ctx.store.saveNow();
    ctx.go('#/past/run');
  };
  const bySub = (id) => meta.questions.filter((q) => q.subject === id).map((q) => q.no);
  const last = past.sessions.filter((x) => x.kind === 'full' || x.kind === 'exempt').slice(-1)[0];
  return h('div',
    past.active ? h('a.menu-item.hero', { href: '#/past/run', style: { marginBottom: '12px' } }, h('span.ico', '▶'), h('div', h('b', '続きから解く'), h('span.muted', past.active.label || ''))) : null,
    !meta.answersChecked ? h('div.note-warn', h('b', '正答の確認がまだです　'), '読み取った正答を公式の解答表と見比べてください。', h('a.btn.sm', { href: '#/past/answers', style: { marginLeft: '6px' } }, '確認する')) : null,
    h('div.card',
      h('h2', '本番形式で解く'),
      h('p.small.muted', '本番と同じ問題数・制限時間。最後にまとめて採点します。'),
      exempt
        ? h('button.btn.primary.block', { onclick: start('exempt', bySub('prop'), { limitSec: exam.exemption.timeMinutes * 60, label: '本番形式（科目免除）' }) }, `科目免除の形式（性質・消火10問・${exam.exemption.timeMinutes}分）`)
        : h('button.btn.primary.block', { onclick: start('full', meta.questions.map((q) => q.no), { limitSec: exam.timeMinutes * 60, label: '本番形式（35問）' }) }, `35問・${exam.timeMinutes}分`),
      last ? h('p.small', { style: { marginTop: '8px' } }, `前回：${new Date(last.t).toLocaleDateString()}　${last.c}/${last.n}（${pct(rate(last.c, last.n))}%）`) : null),
    h('div.card',
      h('h2', '1問ずつ解く（すぐ答え合わせ）'),
      h('div.grid2',
        exam.subjects.map((sub) => h('button.btn', { onclick: start('drill', bySub(sub.id), { instant: true, label: sub.short + '（' + bySub(sub.id).length + '問）' }) }, `${sub.short}（${bySub(sub.id).length}問）`)),
        h('button.btn', { disabled: !wrong.length, onclick: start('drill', wrong, { instant: true, label: '間違えた問題' }) }, `間違えた問題（${wrong.length}）`),
        h('button.btn', { disabled: !unanswered.length, onclick: start('drill', unanswered, { instant: true, label: 'まだ解いていない問題' }) }, `未回答（${unanswered.length}）`))),
    h('div.card',
      h('h2', '取り込んだ過去問'),
      h('dl.kv',
        h('dt', '問題数'), h('dd', `${meta.questions.length}問（法令${bySub('law').length}・物理化学${bySub('chem').length}・性質消火${bySub('prop').length}）`),
        h('dt', 'PDF'), h('dd', `消防試験研究センター「過去に出題された問題」${meta.pdfDate ? `（${meta.pdfDate} 作成のPDF）` : ''}`),
        h('dt', '取り込み日'), h('dd', new Date(meta.importedAt).toLocaleString())),
      h('p.small.muted', '解説は公式に無いため付いていません。関連する内容は、教材（重要事項・基礎講義）で確かめてください。'),
      h('div.row', { style: { marginTop: '8px' } },
        h('a.btn.sm', { href: '#/past/history' }, '結果の履歴'),
        h('a.btn.sm', { href: '#/past/answers' }, '正答の確認・修正'),
        h('button.btn.sm.ghost', { onclick: async () => {
          if (!(await confirmBox('この端末に取り込んだ過去問（問題の画像と正答）を削除します。回答の記録は残ります。', { ok: '削除する', danger: true }))) return;
          await idbClear(); resetCaches(); metaCache = null; toast('削除しました'); ctx.render();
        } }, '取り込んだデータを削除'))),
    termsBox());
}

function answersView(ctx, meta) {
  const qs = meta.questions;
  const sel = (q) => h('select', { 'aria-label': `問${q.no}の正答`, onchange: async (e) => {
    q.answer = Number(e.target.value);
    await idbPutAll([['meta', meta]]); toast(`問${q.no}の正答を ${q.answer} にしました`);
  } }, [1, 2, 3, 4, 5].map((v) => h('option', { value: v, selected: q.answer === v }, String(v))));
  const grid = (list) => h('div.past-ans', list.map((q) => h('label.past-ans-cell' + (q.confidence < LOW_CONF ? '.warn' : ''),
    h('span', `問${q.no}`), sel(q),
    q.confidence < LOW_CONF ? h('span.small', '要確認') : q.answer !== q.readAnswer ? h('span.small', '修正済み') : null)));
  return h('div',
    h('div.card',
      h('h2', '読み取った正答の確認'),
      h('p', '公式の解答表（画像）と、アプリが読み取った正答を見比べてください。違っていたら選び直してください。'),
      h('h3', '共通問題（問1〜25）'), pastImg('img:ans-common', '公式の解答表（共通問題）'), grid(qs.filter((q) => q.no <= 25)),
      h('h3', '第6類（問26〜35）'), pastImg('img:ans-target', '公式の解答表（第6類）'), grid(qs.filter((q) => q.no > 25)),
      h('button.btn.primary.block', { style: { marginTop: '12px' }, onclick: async () => {
        meta.answersChecked = true; await idbPutAll([['meta', meta]]); toast('確認しました'); ctx.go('#/past');
      } }, '確認しました')));
}

function runView(ctx, meta, page) {
  const s = ctx.state();
  const act = s.past?.active;
  if (!act) { setTimeout(() => ctx.go('#/past'), 0); return h('div'); }
  const key = keyOf(meta);
  let cur = Math.min(act.cur || 0, act.nos.length - 1);
  const timerEl = h('span.timer');
  let iv = null;
  if (act.limitSec) {
    const tick = () => {
      const left = Math.max(0, act.limitSec - Math.floor((Date.now() - act.started) / 1000));
      timerEl.textContent = '残り ' + fmtClock(left);
      timerEl.classList.toggle('low', left < 300);
      if (left <= 0) { clearInterval(iv); toast('時間になりました。採点します'); finish(); }
    };
    tick(); iv = setInterval(tick, 1000);
  }
  page.setLeave(() => clearInterval(iv));
  const save = () => ctx.store.update((st) => { const p = ensure(st); if (p.active) { p.active.answers = act.answers; p.active.cur = cur; } });
  const wrap = h('div');
  const draw = () => {
    const no = act.nos[cur];
    const chosen = act.answers[no];
    const showRes = act.instant && chosen != null;
    const correct = key[no];
    const sub = ctx.content.config.exam.subjects.find((x) => x.id === subjectOfNo(no));
    wrap.replaceChildren(...[
      h('div.row', { style: { justifyContent: 'space-between', marginBottom: '8px' } },
        h('span.small', `${cur + 1} / ${act.nos.length}　問${no}（${sub.short}）`), act.limitSec ? timerEl : null),
      h('div.badges', h('span.badge.past', '公式の過去問'), h('span.badge.fill', sub.short)),
      h('div.card.past-card', pastImg('img:' + no, `問${no}の問題（公式PDFの画像）`)),
      h('div.past-choices', { role: 'group', 'aria-label': '答えを選ぶ' }, [1, 2, 3, 4, 5].map((v) => h('button.choice.past-choice'
        + (chosen === v ? '.sel' : '') + (showRes && v === correct ? '.right' : '') + (showRes && v === chosen && v !== correct ? '.wrong' : ''),
      { disabled: showRes, 'aria-pressed': chosen === v ? 'true' : 'false', onclick: () => {
        act.answers[no] = v;
        if (act.instant) record(ctx, no, v === correct);
        save(); draw();
      } }, h('span.num', String(v)))) ),
      showRes ? h('div.result.' + (chosen === correct ? 'ok' : 'ng'), h('span.mark', chosen === correct ? '○' : '×'), chosen === correct ? '正解' : `不正解（正答は ${correct}）`) : null,
      showRes ? h('p.small.muted', '解説は公式に無いため付いていません。教材で関連する内容を確かめてください。', h('a', { href: `#/units?mode=key` }, '教材へ')) : null,
      h('div.row', { style: { justifyContent: 'space-between', marginTop: '12px' } },
        h('button.btn', { disabled: cur === 0, onclick: () => { cur--; save(); draw(); } }, '‹ 前へ'),
        cur < act.nos.length - 1
          ? h('button.btn.primary', { onclick: () => { cur++; save(); draw(); } }, '次へ ›')
          : h('button.btn.primary', { onclick: () => finishAsk() }, act.instant ? '終わる' : '採点する')),
      !act.instant ? h('div.card', { style: { marginTop: '12px' } }, h('h3', '解答の一覧'),
        h('div.past-sheet', act.nos.map((n2, i) => h('button.btn.sm' + (i === cur ? '.primary' : ''), { onclick: () => { cur = i; save(); draw(); } }, `${n2}${act.answers[n2] ? ':' + act.answers[n2] : ''}`)))) : null,
      h('button.btn.ghost.block', { style: { marginTop: '8px' }, onclick: async () => {
        if (!(await confirmBox('途中でやめますか？（採点せずに終わります）', { ok: 'やめる', danger: true }))) return;
        clearInterval(iv);
        ctx.store.update((st) => { ensure(st).active = null; st.resume = null; }); ctx.store.saveNow(); ctx.go('#/past');
      } }, 'やめる')].filter(Boolean));
  };
  const finishAsk = async () => {
    const un = act.nos.filter((n2) => act.answers[n2] == null).length;
    if (!act.instant && un && !(await confirmBox(`未回答が ${un} 問あります。採点しますか？`, { ok: '採点する' }))) return;
    finish();
  };
  const finish = () => {
    clearInterval(iv);
    const per = scorePast(act.nos, act.answers, key);
    const n = act.nos.length, c = Object.values(per).reduce((a, x) => a + x.c, 0);
    const result = { id: act.id, t: Date.now(), kind: act.kind, label: act.label, nos: act.nos, answers: act.answers, key: act.nos.map((no) => key[no]), per, n, c, sec: Math.round((Date.now() - act.started) / 1000) };
    ctx.store.update((st) => {
      const p = ensure(st);
      if (!act.instant) for (const no of act.nos) recordInto(p, no, act.answers[no] === key[no]);
      p.sessions.push(result); p.active = null; st.resume = null;
    });
    ctx.store.saveNow();
    ctx.go('#/past/result/' + result.id);
  };
  draw();
  return wrap;
}

function recordInto(p, no, ok) {
  const r = p.q[no] || (p.q[no] = { n: 0, c: 0 });
  r.n++; if (ok) r.c++; r.last = Date.now(); r.lastOk = ok;
}
function record(ctx, no, ok) { ctx.store.update((st) => recordInto(ensure(st), no, ok)); }

function resultView(ctx, meta, id) {
  const s = ctx.state();
  const r = (s.past?.sessions || []).find((x) => x.id === id);
  if (!r) return h('div.card', '結果が見つかりません', h('a.btn', { href: '#/past' }, '戻る'));
  const { pass, target } = targets(ctx.content.config);
  const subs = ctx.content.config.exam.subjects.filter((x) => r.per[x.id]);
  const passAll = subs.every((x) => rate(r.per[x.id].c, r.per[x.id].n) >= pass);
  const wrong = r.nos.filter((no, i) => r.answers[no] !== r.key[i]);
  const detail = h('div');
  return h('div',
    h('div.card',
      h('h2', `${r.label || '結果'}：${r.c}/${r.n}（${pct(rate(r.c, r.n))}%）`),
      h('p.small.muted', `${new Date(r.t).toLocaleString()}　所要 ${fmtClock(r.sec)}`),
      subs.map((x) => { const v = rate(r.per[x.id].c, r.per[x.id].n); return h('div.subj', h('div.subj-head', h('b', x.short), h('span.small', `${r.per[x.id].c}/${r.per[x.id].n}　${pct(v)}%　${v >= target ? '目標達成' : v >= pass ? '合格基準以上' : '合格基準未満'}`)), bar(v, { target, cls: v >= target ? 'ok' : '' })); }),
      r.kind !== 'drill' ? h('p', passAll ? '全科目で合格基準（60%）以上でした。' : '合格基準（60%）に届かない科目があります。') : null,
      h('p.small.muted', '公式に公開されている過去問1回分の結果です。合格を保証するものではありません。'),
      wrong.length ? h('button.btn.primary.block', { onclick: () => {
        ctx.store.update((st) => { ensure(st).active = { id: 'p' + Date.now().toString(36), kind: 'drill', nos: wrong, answers: {}, cur: 0, started: Date.now(), instant: true, label: '間違えた問題の解き直し' }; });
        ctx.store.saveNow(); ctx.go('#/past/run');
      } }, `間違えた ${wrong.length} 問を解き直す`) : null),
    h('div.card', h('h2', '1問ずつ確認'),
      h('div.past-sheet', r.nos.map((no, i) => {
        const ok = r.answers[no] === r.key[i];
        return h('button.btn.sm', { style: { borderColor: ok ? 'var(--ok)' : 'var(--ng)' }, onclick: () => {
          detail.replaceChildren(h('h3', `問${no}　${ok ? '○ 正解' : '× 不正解'}`), h('p.small', `あなたの答え：${r.answers[no] ?? '未回答'}　正答：${r.key[i]}`), pastImg('img:' + no, `問${no}の問題`));
          detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, `${no} ${ok ? '○' : '×'}`);
      })),
      detail),
    h('a.btn.block', { href: '#/past' }, '過去問のメニューへ'));
}

function historyView(ctx, meta) {
  const ss = [...(ctx.state().past?.sessions || [])].reverse();
  return h('div.card', h('h2', '結果の履歴'),
    ss.length ? ss.map((r) => h('a.menu-item', { href: '#/past/result/' + r.id, style: { marginBottom: '6px' } }, h('span.ico', r.kind === 'drill' ? '✏' : '📝'),
      h('div', h('b', `${r.label || ''}　${r.c}/${r.n}（${pct(rate(r.c, r.n))}%）`), h('span.muted', new Date(r.t).toLocaleString())))) : h('p.muted', 'まだありません'),
    h('a.btn.block', { href: '#/past' }, '戻る'));
}
