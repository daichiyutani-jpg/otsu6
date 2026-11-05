// 学習エンジンのテスト：node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildContent } from '../shared/core/content.js';
import { emptyState, createStore, exportBackup, validateBackup } from '../shared/core/store.js';
import { recordAnswer, unitMastery, reviewQueue, buildRetest, recordRetest, pickPractice, choiceOrder, streak, pendingImportantMistakes } from '../shared/core/engine.js';
import { buildMock, scoreMock, finalizeMock, mockOverlap } from '../shared/core/exam.js';
import { evaluateCompletion } from '../shared/core/completion.js';
import { speedCurriculum, fullCurriculum, dailyGoal } from '../shared/core/curriculum.js';
import { makeRng, apportion, DAY } from '../shared/core/util.js';

const DATA = fileURLToPath(new URL('../shared/data/', import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(DATA, p), 'utf8'));
const config = read('config.json');
const content = buildContent(config, config.contentFiles.map((f) => read('content/' + f)), read('substances.json'));
const T0 = new Date(2026, 10, 6, 10, 0, 0).getTime();

/** 模試を受けて、科目ごとに指定した正答数になるように答える */
function takeMock(state, perSubjectCorrect, { kind = 'full', subject = null, seed = 1, now = T0 } = {}) {
  const m = buildMock(state, content, { kind, subject, rng: makeRng(seed), now });
  const used = {};
  for (const id of m.qids) {
    const q = content.byId.get(id);
    used[q.subject] = used[q.subject] || 0;
    const ok = used[q.subject] < perSubjectCorrect[q.subject];
    used[q.subject]++;
    m.answers[id] = ok ? q.correctAnswer : (q.correctAnswer + 1) % q.choices.length;
  }
  const rec = finalizeMock(content, m, now + 3600000);
  for (const id of m.qids) recordAnswer(state, content.byId.get(id), m.answers[id], 'mock', now);
  state.mocks.push(rec);
  return rec;
}

/** すべての非模試問題（と、模試で解いた問題の解き直し）に正解した状態にする */
function masterAll(state, now = T0) {
  for (const q of content.questions) if (q.questionType !== 'mock' || state.q[q.questionId]) recordAnswer(state, q, q.correctAnswer, 'drill', now);
}

test('データ：3科目の単元と問題が読み込める', () => {
  assert.equal(content.subjects.length, 3);
  for (const s of content.subjects) assert.ok(s.units.length >= 4, s.id);
  assert.ok(content.questions.length >= 400);
  assert.equal(content.counts.past, 0, '実際の過去問は利用条件により0問');
  for (const q of content.questions) assert.ok(content.unitById.has(q.topic), q.questionId);
});

test('設定：合格基準60%・学習目標80%・本番35問120分', () => {
  assert.equal(config.exam.passRate, 0.6);
  assert.equal(config.exam.passRate + config.exam.targetBonus, 0.8);
  assert.deepEqual(config.exam.subjects.map((s) => s.questions), [15, 10, 10]);
  assert.equal(config.exam.timeMinutes, 120);
});

test('正誤判定と回答記録', () => {
  const s = emptyState('speed');
  const q = content.questions[0];
  assert.equal(recordAnswer(s, q, q.correctAnswer, 'drill', T0).ok, true);
  assert.equal(recordAnswer(s, q, (q.correctAnswer + 1) % q.choices.length, 'drill', T0 + 1000).ok, false);
  const r = s.q[q.questionId];
  assert.equal(r.n, 2); assert.equal(r.c, 1); assert.equal(r.w, 1); assert.equal(r.lastOk, false);
  recordAnswer(s, q, q.correctAnswer, 'review', T0 + 2000);
  assert.equal(s.q[q.questionId].retestOk, true, '間違えた後の再テスト結果を残す');
  assert.equal(s.days['2026-11-06'].n, 3);
});

test('習得度：同じ問題を繰り返し正解しても上がりすぎない', () => {
  const s = emptyState('speed');
  const u = content.units.find((x) => (content.byUnit.get(x.id) || []).length >= 8);
  const q = content.byUnit.get(u.id)[0];
  for (let i = 0; i < 20; i++) recordAnswer(s, q, q.correctAnswer, 'drill', T0 + i);
  const m = unitMastery(s, content, u.id, T0 + 100);
  assert.ok(m.mastery <= 1 / 8 + 1e-9, `1問だけでは習得度は1/8まで（実際 ${m.mastery}）`);
  for (const qq of content.byUnit.get(u.id)) recordAnswer(s, qq, qq.correctAnswer, 'drill', T0 + 200);
  assert.equal(unitMastery(s, content, u.id, T0 + 300).mastery, 1);
  // 30日以上前の正解は割り引く
  assert.ok(unitMastery(s, content, u.id, T0 + 40 * DAY).mastery < 1);
});

test('模試：本番と同じ科目構成・時間、基礎4択は使わない、選択肢は5つ', () => {
  const s = emptyState('speed');
  const m = buildMock(s, content, { kind: 'full', rng: makeRng(7), now: T0 });
  assert.equal(m.qids.length, 35);
  assert.equal(m.minutes, 120);
  const per = {};
  for (const id of m.qids) { const q = content.byId.get(id); per[q.subject] = (per[q.subject] || 0) + 1; assert.notEqual(q.questionType, 'basic'); assert.equal(q.choices.length, 5); }
  assert.deepEqual(per, { law: 15, chem: 10, prop: 10 });
  assert.equal(new Set(m.qids).size, 35, '同じ問題を重複して出さない');
  // 科目順（法令→物化→性消）
  const order = m.qids.map((id) => content.byId.get(id).subject);
  assert.deepEqual([...new Set(order)], ['law', 'chem', 'prop']);
  // 単元の偏りがない（1単元に4問以上集中しない）
  for (const n of Object.values(m.composition.byUnit)) assert.ok(n <= 4);
  // 科目別・免除者用
  const sm = buildMock(s, content, { kind: 'subject', subject: 'chem', rng: makeRng(3), now: T0 });
  assert.equal(sm.qids.length, 10);
  assert.equal(sm.minutes, Math.round(120 * 10 / 35));
  const em = buildMock(s, content, { kind: 'exempt', rng: makeRng(3), now: T0 });
  assert.equal(em.qids.length, 10); assert.equal(em.minutes, 35);
});

test('模試：2回目以降は前回と違う問題を優先する', () => {
  const s = emptyState('speed');
  const a = takeMock(s, { law: 15, chem: 10, prop: 10 }, { seed: 1 });
  const b = buildMock(s, content, { kind: 'full', rng: makeRng(2), now: T0 + DAY });
  assert.ok(mockOverlap(a, b) <= 0.2, `重なり ${mockOverlap(a, b)}`);
});

test('模試の採点：科目別正答率と合格基準・目標の比較', () => {
  const s = emptyState('speed');
  const rec = takeMock(s, { law: 12, chem: 7, prop: 8 });
  const r = scoreMock(content, rec);
  const by = Object.fromEntries(r.subjects.map((x) => [x.id, x]));
  assert.equal(by.law.c, 12); assert.equal(by.law.rate, 0.8); assert.equal(by.law.target, true);
  assert.equal(by.chem.rate, 0.7); assert.equal(by.chem.pass, true); assert.equal(by.chem.target, false);
  assert.equal(r.c, 27); assert.equal(r.n, 35);
  // 未回答は不正解
  const m = buildMock(s, content, { rng: makeRng(5), now: T0 });
  assert.equal(scoreMock(content, m).c, 0);
  assert.equal(scoreMock(content, m).unanswered, 35);
});

test('学習終了判定：何もしていなければ未達成で、次の行動を示す', () => {
  const s = emptyState('speed');
  const c = evaluateCompletion(s, content, T0);
  assert.equal(c.done, false);
  assert.equal(c.conds.length, 7, '3科目＋複数回＋単元＋重要問題＋再テスト');
  assert.ok(c.next.length > 0);
  assert.equal(c.next[0].kind, 'diag');
});

test('学習終了判定：全条件を満たすと達成', () => {
  const s = emptyState('speed');
  masterAll(s);
  takeMock(s, { law: 13, chem: 9, prop: 8 }, { seed: 11, now: T0 + 1000 });
  takeMock(s, { law: 12, chem: 8, prop: 9 }, { seed: 12, now: T0 + 2000 });
  masterAll(s, T0 + 3000); // 模試で間違えた分も解き直す
  const qs = buildRetest(s, content, content.units.slice(0, 3).map((u) => u.id), 10);
  recordRetest(s, qs.map((q) => q.questionId), qs.map(() => true), T0 + 4000);
  const c = evaluateCompletion(s, content, T0 + 5000);
  assert.deepEqual(c.conds.filter((x) => !x.ok).map((x) => x.id), []);
  assert.equal(c.done, true);
});

test('学習終了判定：1科目でも79%以下なら未達成（80%ちょうどは達成）', () => {
  const s = emptyState('speed');
  masterAll(s);
  takeMock(s, { law: 15, chem: 10, prop: 10 }, { seed: 21, now: T0 + 1000 });
  takeMock(s, { law: 15, chem: 7, prop: 10 }, { seed: 22, now: T0 + 2000 });
  masterAll(s, T0 + 3000);
  recordRetest(s, ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10'], Array(10).fill(true), T0 + 4000);
  const c = evaluateCompletion(s, content, T0 + 5000);
  assert.equal(c.done, false);
  assert.equal(c.conds.find((x) => x.id === 'mock-chem').ok, false);
  assert.equal(c.subjects.find((x) => x.id === 'chem').gap, 10, '目標まであと10ポイント');
  assert.equal(c.conds.find((x) => x.id === 'mock-law').ok, true);
  assert.equal(c.conds.find((x) => x.id === 'multi').ok, false, '1回しか達成していない');
});

test('学習終了判定：同じ問題セットの模試2回では「複数回」を満たさない', () => {
  const s = emptyState('speed');
  const a = takeMock(s, { law: 15, chem: 10, prop: 10 }, { seed: 31 });
  s.mocks.push({ ...a, id: 'copy', t: a.t + 1 });
  const c = evaluateCompletion(s, content, T0 + 9000);
  assert.equal(c.conds.find((x) => x.id === 'multi').ok, false);
});

test('学習終了判定：科目免除の設定では性消だけで判定', () => {
  const s = emptyState('full');
  s.settings.exempt = true;
  masterAll(s);
  takeMock(s, { prop: 9 }, { kind: 'exempt', seed: 41, now: T0 + 1000 });
  takeMock(s, { prop: 8 }, { kind: 'exempt', seed: 42, now: T0 + 2000 });
  masterAll(s, T0 + 3000);
  recordRetest(s, Array.from({ length: 10 }, (_, i) => 'r' + i), Array(10).fill(true), T0 + 4000);
  const c = evaluateCompletion(s, content, T0 + 5000);
  assert.ok(!c.conds.some((x) => x.id === 'mock-law'));
  assert.equal(c.done, true);
});

test('重要な間違い：解き直して正解するまで残る', () => {
  const s = emptyState('speed');
  const q = content.questions.find((x) => x.importance === 3 && x.questionType !== 'mock');
  recordAnswer(s, q, (q.correctAnswer + 1) % q.choices.length, 'drill', T0);
  assert.ok(pendingImportantMistakes(s, content).includes(q));
  recordAnswer(s, q, q.correctAnswer, 'review', T0 + 1000);
  assert.ok(!pendingImportantMistakes(s, content).includes(q));
});

test('復習：間違えた問題・長く解いていない問題を優先し、模試専用は出さない', () => {
  const s = emptyState('speed');
  const qs = content.questions.filter((q) => q.questionType === 'similar').slice(0, 3);
  recordAnswer(s, qs[0], qs[0].correctAnswer, 'drill', T0 - 20 * DAY); // 20日前に正解
  recordAnswer(s, qs[1], (qs[1].correctAnswer + 1) % 5, 'drill', T0 - DAY); // 昨日間違えた
  recordAnswer(s, qs[2], qs[2].correctAnswer, 'drill', T0); // 今日正解
  const mq = content.questions.find((q) => q.questionType === 'mock');
  recordAnswer(s, mq, (mq.correctAnswer + 1) % 5, 'mock', T0);
  const rq = reviewQueue(s, content, { now: T0 });
  assert.equal(rq[0], qs[1]);
  assert.ok(rq.includes(qs[0]));
  assert.ok(!rq.includes(qs[2]));
  assert.ok(!rq.includes(mq));
});

test('再テスト：まだ解いていない問題を優先する', () => {
  const s = emptyState('speed');
  const u = content.units[0];
  const pool = content.byUnit.get(u.id).filter((q) => q.questionType === 'similar');
  recordAnswer(s, pool[0], pool[0].correctAnswer, 'drill', T0);
  const rt = buildRetest(s, content, [u.id], 3, makeRng(1));
  assert.ok(!rt.includes(pool[0]) || pool.length <= 3);
  assert.ok(rt.every((q) => q.questionType !== 'mock' && q.questionType !== 'basic'));
});

test('演習の絞り込み：種類・科目・未回答・お気に入り', () => {
  const s = emptyState('speed');
  assert.ok(pickPractice(s, content, { types: ['basic'], subject: 'prop', shuffle: false }).every((q) => q.questionType === 'basic' && q.subject === 'prop'));
  assert.equal(pickPractice(s, content, { types: ['past'] }).length, 0);
  const q = content.questions.find((x) => x.questionType === 'basic');
  s.fav[q.questionId] = T0;
  assert.deepEqual(pickPractice(s, content, { status: 'fav' }), [q]);
  recordAnswer(s, q, q.correctAnswer, 'drill', T0);
  assert.ok(!pickPractice(s, content, { status: 'unanswered' }).includes(q));
  assert.ok(pickPractice(s, content, {}).every((x) => x.questionType !== 'mock'), '模試専用は演習に出さない');
});

test('選択肢：数値・組合せは並べ替えない、文章は並べ替える', () => {
  assert.deepEqual(choiceOrder({ choices: ['1つ', '2つ', '3つ', '4つ', '5つ'] }, makeRng(1)), [0, 1, 2, 3, 4]);
  assert.deepEqual(choiceOrder({ choices: ['A・B', 'A・C', 'B・D', 'C・E', 'D・E'] }, makeRng(1)), [0, 1, 2, 3, 4]);
  const o = choiceOrder({ choices: ['水で消火する', '泡で消火する', '乾燥砂で覆う', '粉末を使う', '放置する'] }, makeRng(5));
  assert.deepEqual([...o].sort(), [0, 1, 2, 3, 4]);
});

test('保存：再読み込み後も残る・バックアップの検証', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const st = createStore('speed', storage);
  const q = content.questions[3];
  st.update((s) => { recordAnswer(s, q, q.correctAnswer, 'drill', T0); s.fav[q.questionId] = T0; });
  st.saveNow();
  const st2 = createStore('speed', storage);
  assert.equal(st2.get().q[q.questionId].c, 1);
  assert.ok(st2.get().fav[q.questionId]);
  // 別アプリとは混ざらない
  assert.deepEqual(createStore('full', storage).get().q, {});
  const text = exportBackup(st2.get());
  const v = validateBackup(text, 'speed', new Set(content.byId.keys()));
  assert.equal(v.ok, true);
  assert.equal(validateBackup('{bad', 'speed').ok, false);
  assert.equal(validateBackup(JSON.stringify({ format: 'other' }), 'speed').ok, false);
  const broken = JSON.parse(text); broken.state.q[q.questionId].c = 9;
  assert.equal(validateBackup(broken, 'speed').ok, false, '正解数が回答数より多いものは拒否');
  assert.ok(validateBackup(text, 'full').warnings.length > 0, '別アプリのバックアップは警告');
  // 壊れた保存データでも起動できる
  mem.set('otsu6:speed:state', '{broken');
  assert.deepEqual(createStore('speed', storage).get().q, {});
});

test('カリキュラム：合格特化型10段階・完全学習型13段階、最初は実力診断', () => {
  const s = emptyState('speed');
  const a = speedCurriculum(s, content, T0); const b = fullCurriculum(s, content, T0);
  assert.equal(a.steps.length, 10); assert.equal(b.steps.length, 13);
  assert.equal(a.current.id, 'diag'); assert.equal(b.current.id, 'diag');
  s.diag = { t: T0, perSubject: {} };
  assert.equal(speedCurriculum(s, content, T0).current.id, 'key');
  assert.equal(fullCurriculum(s, content, T0).current.id, 'lecture');
});

test('今日の目標：学習時間と試験日からペースを出す', () => {
  const s = emptyState('speed');
  s.settings.dailyMinutes = 30; s.settings.examDate = '2026-11-20';
  const g = dailyGoal(s, content, 'speed', T0);
  assert.ok(g.qTarget >= 15 && g.qTarget <= 30);
  assert.match(g.paceNote, /あと\d+日/);
});

test('連続学習日数', () => {
  const s = emptyState('speed');
  const q = content.questions[0];
  for (const d of [0, 1, 2]) recordAnswer(s, q, q.correctAnswer, 'drill', T0 - d * DAY);
  assert.equal(streak(s, T0), 3);
  assert.equal(streak(s, T0 + DAY), 3, '今日まだでも昨日まで続いていれば数える');
  assert.equal(streak(s, T0 + 3 * DAY), 0);
});

test('配分（最大剰余法）', () => {
  assert.deepEqual(apportion(15, [3, 3, 2, 1]), [5, 5, 3, 2]);
  assert.equal(apportion(10, [3, 2, 2, 1, 1, 1]).reduce((a, b) => a + b, 0), 10);
});
