// 模擬試験エンジン：本番と同じ科目構成・問題数・時間で組み、採点する。
import { apportion, shuffle, rate } from './util.js';
import { isExamStyle } from './content.js';
import { choiceOrder } from './engine.js';

/**
 * kind: 'full'（本番形式・35問・120分）| 'subject'（科目別）| 'exempt'（科目免除者：性消10問35分）
 * 出題元は 5択の本番レベル問題（模試専用・類題、許諾済みの過去問）。基礎の4択は使わない（正答率の過大評価を防ぐ）。
 * 単元の重要度に比例して配分し、過去の模試で使った問題・解いた問題を後回しにする。
 */
export function buildMock(state, content, { kind = 'full', subject = null, rng = Math.random, now = Date.now() } = {}) {
  const exam = content.config.exam;
  let subjects;
  if (kind === 'subject') subjects = exam.subjects.filter((s) => s.id === subject);
  else if (kind === 'exempt') subjects = exam.subjects.filter((s) => exam.exemption.subjects.includes(s.id));
  else subjects = exam.subjects;

  const usedInMock = new Map(); // qid -> 何回使ったか
  for (const m of state.mocks) for (const id of m.qids) usedInMock.set(id, (usedInMock.get(id) || 0) + 1);

  const qids = [];
  const warnings = [];
  for (const s of subjects) {
    const units = content.units.filter((u) => u.subject === s.id);
    const pools = units.map((u) => (content.byUnit.get(u.id) || []).filter(isExamStyle));
    const weights = units.map((u, i) => (pools[i].length ? u.importance : 0));
    let alloc = apportion(s.questions, weights);
    // 単元の在庫不足は他の単元に回す
    for (let i = 0; i < alloc.length; i++) {
      const over = alloc[i] - pools[i].length;
      if (over > 0) {
        alloc[i] = pools[i].length;
        for (let k = 0, left = over; left > 0 && k < 50; k++) {
          const j = (i + 1 + k) % alloc.length;
          if (alloc[j] < pools[j].length) { alloc[j]++; left--; }
        }
      }
    }
    const chosen = [];
    const excluded = new Set();
    units.forEach((u, i) => {
      const scored = shuffle(pools[i], rng).map((q) => {
        const r = state.q[q.questionId];
        let score = (usedInMock.get(q.questionId) || 0) * 100;
        if (r?.n) score += 10 + (now - r.last < 3 * 86400000 ? 20 : 0);
        if (q.questionType !== 'mock') score += 5; // 模試専用を優先
        return { q, score };
      }).sort((a, b) => a.score - b.score);
      let need = alloc[i];
      for (const { q } of scored) {
        if (need <= 0) break;
        if (excluded.has(q.questionId)) continue; // 同じ知識の関連問題は同じ回に入れない
        chosen.push(q);
        (q.relatedQuestionIds || []).forEach((id) => excluded.add(id));
        need--;
      }
    });
    if (chosen.length < s.questions) warnings.push(`${s.short}は本番レベルの問題が不足しており ${chosen.length}/${s.questions} 問で実施します。`);
    qids.push(...chosen.map((q) => q.questionId));
  }
  const totalQ = qids.length;
  const fullCount = subjects.reduce((a, s) => a + s.questions, 0);
  const minutes = kind === 'exempt' ? exam.exemption.timeMinutes
    : kind === 'subject' ? Math.round((exam.timeMinutes * fullCount) / exam.subjects.reduce((a, s) => a + s.questions, 0))
    : exam.timeMinutes;
  // 本番と同じく科目順に並べ、科目内の問題順はシャッフル
  const ordered = [];
  for (const s of subjects) ordered.push(...shuffle(qids.filter((id) => content.byId.get(id).subject === s.id), rng));
  // 選択肢の並べ替え（問題ごとに元の添字の並び）
  const orders = {};
  for (const id of ordered) orders[id] = choiceOrder(content.byId.get(id), rng);
  const composition = summarizeComposition(content, ordered);
  return {
    id: 'm' + now.toString(36) + Math.floor(rng() * 1e6).toString(36),
    kind, subject, startedAt: now, minutes, qids: ordered, choiceOrder: orders,
    answers: {}, flags: {}, warnings, totalQ, composition,
    allOriginal: ordered.every((id) => content.byId.get(id).questionType !== 'past'),
  };
}

export function summarizeComposition(content, qids) {
  const out = { byType: {}, byLevel: {}, byUnit: {} };
  for (const id of qids) {
    const q = content.byId.get(id);
    out.byType[q.questionType] = (out.byType[q.questionType] || 0) + 1;
    out.byLevel[q.level] = (out.byLevel[q.level] || 0) + 1;
    out.byUnit[q.topic] = (out.byUnit[q.topic] || 0) + 1;
  }
  return out;
}

/** 採点。answers は {qid: 元の添字}。未回答は不正解。 */
export function scoreMock(content, mock) {
  const exam = content.config.exam;
  const per = {};
  const wrong = [];
  for (const id of mock.qids) {
    const q = content.byId.get(id);
    const p = per[q.subject] || (per[q.subject] = { n: 0, c: 0 });
    p.n++;
    const a = mock.answers[id];
    if (a === q.correctAnswer) p.c++;
    else wrong.push(id);
  }
  const target = exam.passRate + exam.targetBonus;
  const subjects = exam.subjects.filter((s) => per[s.id]).map((s) => {
    const p = per[s.id];
    const r = rate(p.c, p.n);
    return {
      id: s.id, short: s.short, n: p.n, c: p.c, rate: r,
      pass: r >= exam.passRate - 1e-9, target: r >= target - 1e-9,
      fullSize: p.n === s.questions,
    };
  });
  const n = subjects.reduce((a, s) => a + s.n, 0), c = subjects.reduce((a, s) => a + s.c, 0);
  return {
    subjects, n, c, rate: rate(c, n), wrong,
    passAll: subjects.every((s) => s.pass), targetAll: subjects.every((s) => s.target),
    unanswered: mock.qids.filter((id) => mock.answers[id] == null).length,
  };
}

/** 終了した模試を記録用の形にする */
export function finalizeMock(content, mock, now = Date.now()) {
  const result = scoreMock(content, mock);
  return {
    id: mock.id, kind: mock.kind, subject: mock.subject, t: now, startedAt: mock.startedAt,
    durationSec: Math.round((now - mock.startedAt) / 1000), minutes: mock.minutes,
    qids: mock.qids, answers: mock.answers,
    perSubject: Object.fromEntries(result.subjects.map((s) => [s.id, { n: s.n, c: s.c }])),
    n: result.n, c: result.c, wrong: result.wrong,
  };
}

/** 2つの模試の問題の重なり（小さいほうの問題数に対する割合） */
export function mockOverlap(a, b) {
  const sa = new Set(a.qids);
  const common = b.qids.filter((id) => sa.has(id)).length;
  return common / Math.min(a.qids.length, b.qids.length || 1);
}
