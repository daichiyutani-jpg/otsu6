// 採点・回答記録・習得度・復習の優先順位（状態 state を受け取る純粋な関数群）
import { dayKey, DAY, rate, shuffle } from './util.js';

export const HIST_MAX = 12;

/**
 * 選択肢の表示順。組合せ（A・B…）・個数（1つ…）・数値の選択肢は、元の並び（昇順など）のほうが読みやすいので並べ替えない。
 */
export function choiceOrder(q, rng = Math.random) {
  const idx = [...q.choices.keys()];
  const fixed = q.fixedOrder || q.choices.every((c) => /^[\s　]*([0-9０-９]|[A-EＡ-Ｅア-オ](\s*[・,，、と]|\s*$|\s*\(|\s*（)|なし|すべて)/.test(String(c)) && String(c).length <= 24);
  return fixed ? idx : shuffle(idx, rng);
}

/** 選択肢の並べ替え後の位置で回答を受け取り、元の添字で正誤判定する */
export function isCorrect(q, chosenOriginalIndex) {
  return chosenOriginalIndex === q.correctAnswer;
}

/**
 * 回答を記録する。ctx は 'drill' | 'mock' | 'diag' | 'retest' | 'check' | 'review' など。
 * 戻り値: {ok}
 */
export function recordAnswer(state, q, chosen, ctx = 'drill', now = Date.now(), sec = 0) {
  const ok = isCorrect(q, chosen);
  const r = state.q[q.questionId] || (state.q[q.questionId] = { n: 0, c: 0, w: 0, last: 0, lastOk: null, hist: [] });
  const prevWrong = r.n > 0 && r.lastOk === false;
  r.n++; if (ok) r.c++; else r.w++;
  r.last = now; r.lastOk = ok;
  if (prevWrong) r.retestOk = ok; // 間違えた後の再テスト結果
  r.hist.push({ t: now, ok, ch: chosen, ctx });
  if (r.hist.length > HIST_MAX) r.hist.splice(0, r.hist.length - HIST_MAX);
  const d = state.days[dayKey(now)] || (state.days[dayKey(now)] = { sec: 0, n: 0, c: 0 });
  d.n++; if (ok) d.c++;
  d.sec += Math.min(Math.max(sec, 0), 600); // 放置分を数えすぎない（1問最大10分）
  return { ok };
}

export function addStudyTime(state, sec, now = Date.now()) {
  const d = state.days[dayKey(now)] || (state.days[dayKey(now)] = { sec: 0, n: 0, c: 0 });
  d.sec += Math.min(Math.max(sec, 0), 3600);
}

export function qStat(state, qid) {
  const r = state.q[qid];
  if (!r) return { n: 0, c: 0, w: 0, rate: 0, last: 0, lastOk: null, answered: false };
  return { ...r, rate: rate(r.c, r.n), answered: r.n > 0 };
}

/**
 * 単元の習得度（0〜1）。
 * 同じ問題を何度も正解しても1問分としか数えない（異なる問題での確認が必要）。
 * - 正答の判定は「その問題の最新の回答」
 * - 必要な異なる問題数（最大8問）に届かない分は習得度を割り引く
 * - 最終回答から30日を超えた問題は0.8倍（忘れている可能性）
 * - 間違えた後に一度も正解していない問題は0
 */
export function unitMastery(state, content, unitId, now = Date.now()) {
  const qs = content.byUnit.get(unitId) || [];
  if (!qs.length) return { mastery: 0, distinct: 0, need: 0, total: 0, correct: 0, coverage: 0 };
  // 必要な確認数は「模試以外で解ける問題数」を上限にする（模試専用問題は模試でしか出ないため）。模試で解いた分も確認に数える
  const need = Math.max(1, Math.min(qs.filter((q) => q.questionType !== 'mock').length, 8));
  let score = 0, distinct = 0, correct = 0;
  for (const q of qs) {
    const r = state.q[q.questionId];
    if (!r || !r.n) continue;
    distinct++;
    if (r.lastOk) {
      correct++;
      score += now - r.last > 30 * DAY ? 0.8 : 1;
    }
  }
  const acc = distinct ? score / distinct : 0;
  const mastery = acc * Math.min(1, distinct / need);
  return { mastery, distinct, need, total: qs.length, correct, coverage: distinct / qs.length };
}

export function subjectMastery(state, content, subjectId, now = Date.now()) {
  const units = content.units.filter((u) => u.subject === subjectId);
  let w = 0, s = 0;
  for (const u of units) { const m = unitMastery(state, content, u.id, now).mastery; s += m * u.importance; w += u.importance; }
  return w ? s / w : 0;
}

/** 回答記録からの単純な正答率（習得度とは別の指標） */
export function subjectAccuracy(state, content, subjectId) {
  let n = 0, c = 0;
  for (const q of content.questions) {
    if (q.subject !== subjectId) continue;
    const r = state.q[q.questionId]; if (!r) continue;
    n += r.n; c += r.c;
  }
  return { n, c, rate: rate(c, n) };
}

/** 弱い単元（習得度の低い順。未着手も含む） */
export function weakUnits(state, content, { subject = null, limit = 99, threshold = 0.8, now = Date.now() } = {}) {
  return content.units
    .filter((u) => !subject || u.subject === subject)
    .map((u) => ({ unit: u, ...unitMastery(state, content, u.id, now) }))
    .filter((x) => x.mastery < threshold)
    .sort((a, b) => a.mastery - b.mastery || b.unit.importance - a.unit.importance)
    .slice(0, limit);
}

/**
 * 復習の優先度。大きいほど先に出す。
 * 間違いが多い・最後に間違えた・長く解いていない・重要度が高い ほど上がる。
 */
export function reviewPriority(state, q, now = Date.now()) {
  const r = state.q[q.questionId];
  if (!r || !r.n) return 0;
  const days = (now - r.last) / DAY;
  let p = 0;
  if (r.lastOk === false) p += 100;
  p += r.w * 15;
  p += Math.min(days, 60) * (r.lastOk ? 1.2 : 3);
  p += q.importance * 6;
  if (r.lastOk && r.w === 0) p -= 40; // 一度も間違えていない問題は後回し
  return p;
}

/** 復習対象（間違えた・忘れかけ）を優先度順に */
export function reviewQueue(state, content, { subject = null, limit = 20, onlyWrong = false, now = Date.now() } = {}) {
  return content.questions
    .filter((q) => q.questionType !== 'mock') // 模試専用問題は模試以外で出さない（模試の初見性を保つ）
    .filter((q) => !subject || q.subject === subject)
    .filter((q) => { const r = state.q[q.questionId]; if (!r || !r.n) return false; return onlyWrong ? r.lastOk === false : (r.w > 0 || (now - r.last) > 7 * DAY); })
    .map((q) => ({ q, p: reviewPriority(state, q, now) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, limit)
    .map((x) => x.q);
}

/** 未解決の重要な間違い（重要度3で、最新の回答が誤り） */
export function pendingImportantMistakes(state, content) {
  return content.questions.filter((q) => {
    if (q.importance < 3) return false;
    const r = state.q[q.questionId];
    return r && r.w > 0 && r.lastOk === false;
  });
}

/**
 * 演習用の出題リストを作る。
 * filters: {types:[], subject, unit, difficulty, level, status:'all'|'unanswered'|'wrong'|'fav', shuffle, limit}
 */
export function pickPractice(state, content, f = {}, rng = Math.random) {
  let qs = content.questions.filter((q) => q.questionType !== 'mock' || f.includeMock);
  if (f.types?.length) qs = qs.filter((q) => f.types.includes(q.questionType));
  if (f.subject) qs = qs.filter((q) => q.subject === f.subject);
  if (f.unit) qs = qs.filter((q) => q.topic === f.unit);
  if (f.difficulty) qs = qs.filter((q) => q.difficulty === Number(f.difficulty));
  if (f.level) qs = qs.filter((q) => q.level === f.level);
  if (f.status === 'unanswered') qs = qs.filter((q) => !state.q[q.questionId]?.n);
  if (f.status === 'wrong') qs = qs.filter((q) => state.q[q.questionId]?.lastOk === false);
  if (f.status === 'missed') qs = qs.filter((q) => (state.q[q.questionId]?.w || 0) > 0);
  if (f.status === 'fav') qs = qs.filter((q) => state.fav[q.questionId]);
  if (f.shuffle !== false) qs = shuffle(qs, rng);
  else qs = qs.slice();
  if (f.preferUnanswered) qs.sort((a, b) => (state.q[a.questionId]?.n ? 1 : 0) - (state.q[b.questionId]?.n ? 1 : 0));
  return f.limit ? qs.slice(0, f.limit) : qs;
}

/**
 * 再テスト：復習した単元から、まだ解いていない問題を優先して出す（同じ問題の暗記で済ませない）。
 */
export function buildRetest(state, content, unitIds, size = 10, rng = Math.random) {
  const pool = content.questions.filter((q) => unitIds.includes(q.topic) && q.questionType !== 'mock' && q.questionType !== 'basic');
  const fresh = shuffle(pool.filter((q) => !state.q[q.questionId]?.n), rng);
  const old = pool.filter((q) => state.q[q.questionId]?.n).sort((a, b) => state.q[a.questionId].last - state.q[b.questionId].last);
  const picked = [...fresh, ...old].slice(0, size);
  // 単元が偏らないよう並べ替え
  return shuffle(picked, rng);
}

export function recordRetest(state, qids, results, now = Date.now()) {
  const c = results.filter(Boolean).length;
  state.retests.push({ t: now, qids, n: qids.length, c });
  if (state.retests.length > 100) state.retests.splice(0, state.retests.length - 100);
}

/** 連続学習日数（今日 or 昨日まで続いている日数） */
export function streak(state, now = Date.now()) {
  let n = 0;
  let t = now;
  if (!state.days[dayKey(t)]?.n) t -= DAY; // 今日まだなら昨日から数える
  while (state.days[dayKey(t)]?.n) { n++; t -= DAY; }
  return n;
}
