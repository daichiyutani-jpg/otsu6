// 学習データの保存（端末内 localStorage のみ。外部へは送らない）。
// 将来クラウド同期を足すときは、この load/save の差し替えだけで済むように状態を1つの JSON にまとめている。

export const SCHEMA = 1;

export function emptyState(appId, now = Date.now()) {
  return {
    schema: SCHEMA,
    appId,
    createdAt: now,
    updatedAt: now,
    q: {},          // 問題ごとの記録 {n, c, w, last, lastOk, hist:[{t, ok, ch, ctx}]}
    fav: {},        // お気に入り {qid: t}
    mocks: [],      // 模擬試験の結果
    retests: [],    // 再テストの結果
    days: {},       // 日別 {'YYYY-MM-DD': {sec, n, c}}
    anims: {},      // アニメ教材 {id: {viewed: t, checkOk: t|null}}
    lessons: {},    // 単元の教材 {unitId: {key: t, lecture: t}}
    causes: [],     // 間違いの原因 {qid, t, cause, confirmed}
    diag: null,     // 実力診断 {t, perSubject:{law:{n,c}}, qids}
    settings: { reduceMotion: false, captions: true, fontScale: 1, exempt: false, dailyMinutes: 30, examDate: '' },
    resume: null,   // 前回の続き {route, label, t}
    past: { sessions: [], q: {}, active: null }, // 公式の過去問（各自が取り込んだもの）の回答記録。問題の内容は持たない
  };
}

export function createStore(appId, storage = globalThis.localStorage) {
  const KEY = `otsu6:${appId}:state`;
  let state = load();
  let timer = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = storage?.getItem(KEY);
      if (!raw) return emptyState(appId);
      const s = JSON.parse(raw);
      return migrate(s, appId);
    } catch {
      return emptyState(appId);
    }
  }

  function saveNow() {
    clearTimeout(timer); timer = null;
    state.updatedAt = Date.now();
    try { storage?.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
  }

  return {
    get: () => state,
    /** 変更してから保存（少し待ってまとめて書く） */
    update(fn) {
      fn(state);
      clearTimeout(timer);
      timer = setTimeout(saveNow, 300);
      listeners.forEach((l) => l(state));
    },
    saveNow,
    replace(next) { state = migrate(next, appId); saveNow(); listeners.forEach((l) => l(state)); },
    reset() { state = emptyState(appId); saveNow(); listeners.forEach((l) => l(state)); },
    onChange(l) { listeners.add(l); return () => listeners.delete(l); },
    key: KEY,
  };
}

/** 古い形式や欠けた項目を補う */
export function migrate(s, appId) {
  const base = emptyState(appId);
  const out = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  for (const k of ['q', 'fav', 'days', 'anims', 'lessons']) if (typeof out[k] !== 'object' || out[k] === null || Array.isArray(out[k])) out[k] = {};
  for (const k of ['mocks', 'retests', 'causes']) if (!Array.isArray(out[k])) out[k] = [];
  const p = out.past && typeof out.past === 'object' && !Array.isArray(out.past) ? out.past : {};
  out.past = { sessions: Array.isArray(p.sessions) ? p.sessions : [], q: p.q && typeof p.q === 'object' && !Array.isArray(p.q) ? p.q : {}, active: p.active || null };
  out.schema = SCHEMA;
  out.appId = appId;
  return out;
}

// ---- バックアップ ----

export function exportBackup(state, meta = {}) {
  return JSON.stringify({ format: 'otsu6-backup', version: 1, exportedAt: new Date().toISOString(), ...meta, state }, null, 1);
}

/**
 * 取り込み前の検証。{ok, errors, state, warnings}
 * 別アプリ（合格特化型⇔完全学習型）のバックアップも取り込めるが、警告を出す。
 */
export function validateBackup(text, appId, knownQuestionIds = null) {
  const errors = [], warnings = [];
  let obj;
  try { obj = typeof text === 'string' ? JSON.parse(text) : text; } catch { return { ok: false, errors: ['JSONとして読めません。ファイルが壊れているか、別のファイルです。'], warnings }; }
  if (!obj || obj.format !== 'otsu6-backup') errors.push('このアプリのバックアップファイルではありません。');
  const s = obj?.state;
  if (!s || typeof s !== 'object') errors.push('学習データが入っていません。');
  else {
    if (typeof s.schema !== 'number' || s.schema > SCHEMA) errors.push('新しい版のアプリで作られたファイルです。アプリを更新してから取り込んでください。');
    if (s.q && (typeof s.q !== 'object' || Array.isArray(s.q))) errors.push('回答記録の形式が正しくありません。');
    if (s.mocks && !Array.isArray(s.mocks)) errors.push('模擬試験の記録の形式が正しくありません。');
    if (s.q && typeof s.q === 'object') {
      for (const [id, r] of Object.entries(s.q)) {
        if (typeof r !== 'object' || typeof r.n !== 'number' || typeof r.c !== 'number' || r.c > r.n || r.c < 0) { errors.push(`回答記録 ${id} の数値が正しくありません。`); break; }
      }
      if (knownQuestionIds) {
        const unknown = Object.keys(s.q).filter((id) => !knownQuestionIds.has(id));
        if (unknown.length) warnings.push(`現在の問題データに無い問題の記録が ${unknown.length} 件あります（問題の改訂による。取り込みますが集計には使いません）。`);
      }
    }
    if (s.appId && s.appId !== appId) warnings.push('もう一方の学習パターンのバックアップです。取り込むと、このアプリの記録は置き換わります。');
  }
  return { ok: errors.length === 0, errors, warnings, state: errors.length ? null : s };
}
