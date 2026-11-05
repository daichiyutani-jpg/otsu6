// 学習終了判定（2つの学習パターンで共通）。
// 学習目標＝各科目の合格基準（公式60%）＋20ポイント。達成しても本試験の合格を保証するものではない。
import { unitMastery, subjectMastery, subjectAccuracy, pendingImportantMistakes, weakUnits } from './engine.js';
import { mockOverlap } from './exam.js';
import { rate, pct } from './util.js';

export function targets(config) {
  const pass = config.exam.passRate;
  return { pass, target: Math.min(1, pass + config.exam.targetBonus) };
}

/** 判定に数える模試（本番形式＝科目免除の設定に応じた全科目そろいのもの） */
export function qualifyingMocks(state, config) {
  const kind = state.settings.exempt ? 'exempt' : 'full';
  return state.mocks.filter((m) => m.kind === kind && config.exam.subjects
    .filter((s) => (kind === 'exempt' ? config.exam.exemption.subjects.includes(s.id) : true))
    .every((s) => m.perSubject[s.id]?.n === s.questions));
}

export function evaluateCompletion(state, content, now = Date.now()) {
  const config = content.config;
  const { pass, target } = targets(config);
  const cc = config.completion;
  const activeSubjects = config.exam.subjects.filter((s) => !state.settings.exempt || config.exam.exemption.subjects.includes(s.id));
  const mocks = qualifyingMocks(state, config);
  const latest = mocks[mocks.length - 1] || null;

  // 科目ごとの現状
  const subjects = config.exam.subjects.map((s) => {
    const exempt = !activeSubjects.includes(s);
    const lm = latest?.perSubject[s.id];
    const current = lm ? rate(lm.c, lm.n) : null;
    return {
      id: s.id, short: s.short, name: s.name, exempt,
      pass, target, current,
      gap: current == null ? null : Math.max(0, Math.ceil((target - current) * 100 - 1e-9)),
      mastery: subjectMastery(state, content, s.id, now),
      accuracy: subjectAccuracy(state, content, s.id).rate,
      mockCount: mocks.length,
    };
  });

  const conds = [];
  for (const s of subjects) {
    if (s.exempt) continue;
    conds.push({
      id: 'mock-' + s.id,
      label: `${s.short}の模擬試験（本番形式）の正答率が${pct(target)}%以上`,
      ok: s.current != null && s.current >= target - 1e-9,
      detail: s.current == null ? 'まだ本番形式の模擬試験を受けていません' : `直近 ${pct(s.current)}%`,
    });
  }

  // 異なる問題セットで複数回達成
  const good = mocks.filter((m) => activeSubjects.every((s) => rate(m.perSubject[s.id].c, m.perSubject[s.id].n) >= target - 1e-9));
  let distinctOk = false;
  let bestPair = 0;
  outer: for (let i = 0; i < good.length; i++) for (let j = i + 1; j < good.length; j++) {
    if (mockOverlap(good[i], good[j]) <= cc.maxMockOverlap + 1e-9) { distinctOk = true; bestPair = 2; break outer; }
  }
  if (!distinctOk && good.length) bestPair = 1;
  conds.push({
    id: 'multi',
    label: `異なる問題セットの模擬試験${cc.minFullMocks}回で、各科目が${pct(target)}%以上`,
    ok: distinctOk,
    detail: `達成した回 ${good.length}回（問題の重なり${pct(cc.maxMockOverlap)}%以下の組み合わせ ${distinctOk ? 'あり' : 'なし'}）`,
  });

  // 重要な未習得単元
  const required = content.units.filter((u) => u.importance >= cc.unitImportanceRequired && activeSubjects.some((s) => s.id === u.subject));
  const unmastered = required.map((u) => ({ unit: u, ...unitMastery(state, content, u.id, now) })).filter((x) => x.mastery < cc.unitMasteryTarget - 1e-9);
  conds.push({
    id: 'units',
    label: `重要な単元（${required.length}単元）の習得度がすべて${pct(cc.unitMasteryTarget)}%以上`,
    ok: unmastered.length === 0 && required.length > 0,
    detail: unmastered.length ? `未習得 ${unmastered.length}単元` : 'すべて習得',
    items: unmastered,
  });

  // 間違えた重要問題の復習
  const pend = pendingImportantMistakes(state, content).filter((q) => activeSubjects.some((s) => s.id === q.subject));
  conds.push({
    id: 'mistakes',
    label: '間違えた重要問題（重要度★★★）を、すべて解き直して正解',
    ok: pend.length === 0,
    detail: pend.length ? `残り ${pend.length}問` : '未解決なし',
    items: pend,
  });

  // 再テスト
  const rts = state.retests.filter((r) => r.n >= cc.retestMinQuestions);
  const lastRt = rts[rts.length - 1];
  conds.push({
    id: 'retest',
    label: `直近の再テスト（${cc.retestMinQuestions}問以上・未使用問題優先）で${pct(target)}%以上`,
    ok: !!lastRt && rate(lastRt.c, lastRt.n) >= target - 1e-9,
    detail: lastRt ? `直近 ${lastRt.c}/${lastRt.n}（${pct(rate(lastRt.c, lastRt.n))}%）` : 'まだ再テストをしていません',
  });

  const done = conds.every((c) => c.ok);
  return { done, conds, subjects, pass, target, mocks: mocks.length, unmastered, pending: pend, next: nextActions(state, content, { subjects, conds, unmastered, pend, now }) };
}

/** 学習終了に届かないときの、具体的な次の一手 */
export function nextActions(state, content, { subjects, conds, unmastered, pend, now }) {
  const acts = [];
  if (!state.diag) acts.push({ kind: 'diag', label: '実力診断を受けて、得意・苦手を確かめる', route: '#/diag' });
  if (pend.length) acts.push({ kind: 'review', label: `間違えた重要問題 ${pend.length}問を解き直す`, route: '#/review?only=important' });
  for (const x of unmastered.slice(0, 3)) {
    const u = x.unit;
    const anim = u.animationIds?.[0];
    acts.push({ kind: 'unit', label: `「${u.title}」を復習する（習得度 ${pct(x.mastery)}%、異なる問題で確認 ${x.distinct}/${x.need}問）`, route: `#/unit/${encodeURIComponent(u.id)}` });
    if (anim && !state.anims[anim]?.checkOk) acts.push({ kind: 'anim', label: `アニメ教材で「${u.title}」の仕組みを見直す`, route: `#/anim/${anim}` });
  }
  if (unmastered.length) acts.push({ kind: 'retest', label: '復習した単元を、まだ解いていない問題で再テストする', route: '#/retest' });
  const s = subjects.filter((x) => !x.exempt && x.current != null && x.current < x.pass + 0.2 - 1e-9);
  for (const x of s) acts.push({ kind: 'mock-subject', label: `${x.short}の科目別模試で弱点を確かめる（あと${x.gap}ポイント）`, route: `#/mock?kind=subject&subject=${x.id}` });
  if (!conds.find((c) => c.id === 'multi')?.ok) acts.push({ kind: 'mock', label: '本番形式の模擬試験を受ける（前回と違う問題セット）', route: '#/mock' });
  const seen = new Set();
  return acts.filter((a) => (seen.has(a.label) ? false : seen.add(a.label))).slice(0, 6);
}

export { weakUnits };
