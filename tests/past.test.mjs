// 公式の過去問（各自が取り込む）の読み取りロジックのテスト。実物のPDFは使わず、作った画像・行データで確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import { inkLines, questionBlocks, redGlyphs, glyphFeature, classifyGlyph, answerTables, assemble, scorePast, subjectOfNo, EXPECT } from '../shared/core/pastimport.js';
import { DIGIT_TEMPLATES } from '../shared/core/past-templates.js';
import { emptyState, migrate, exportBackup } from '../shared/core/store.js';

const L = (y0, x0, h = 0.015, x1 = 0.8) => ({ y0, y1: y0 + h, x0, x1 });
const BX = 0.177;
/** 1ページに2問（上・下）。それぞれ「［問」行＋本文の続き＋選択肢5行 */
const qLines = (top, bx = BX) => [L(top, bx), L(top + 0.025, 0.226), ...[0, 1, 2, 3, 4].map((i) => L(top + 0.05 + i * 0.025, 0.206))];

test('問題のまとまり：括弧の位置で区切り、見出し・類の表紙・注記・ページ番号を除く', () => {
  const pages = [];
  // 1ページ目：注記（左寄り）と科目の見出し（中央）のあとに問1
  pages.push({ lines: [L(0.09, 0.164), L(0.12, 0.164), L(0.5, 0.354), ...qLines(0.55), L(0.92, 0.46)] });
  for (let p = 0; p < 30; p++) pages.push({ lines: [...qLines(0.09, p % 5 === 0 ? BX + 0.009 : BX), ...qLines(0.49), L(0.92, 0.46)] });
  // 類の表紙：見出しと「第6類」の枠のあとに問題1つ
  pages.push({ lines: [L(0.14, 0.23), L(0.23, 0.37), ...qLines(0.49)] });
  const { blocks, bx } = questionBlocks(pages);
  assert.ok(Math.abs(bx - BX) < 0.003);
  assert.equal(blocks.length, 1 + 60 + 1);
  for (const b of blocks) {
    assert.equal(b.parts.length, 1);
    assert.ok(b.parts[0].y1 < 0.9, 'ページ番号を含まない');
  }
  assert.ok(blocks[0].parts[0].y0 >= 0.55, '問1の前の注記・見出しを含まない');
  assert.ok(blocks[61].parts[0].y0 >= 0.49, '表紙の見出しを含まない');
});

test('問題のまとまり：次のページに続く問題は1問につなぐ', () => {
  const pages = [
    { lines: [...qLines(0.09), L(0.49, BX), L(0.52, 0.226), L(0.80, 0.206), L(0.86, 0.206)] },
    { lines: [L(0.08, 0.206), L(0.11, 0.206), ...qLines(0.3)] },
  ];
  const { blocks } = questionBlocks(pages, { minCount: 1 });
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[1].parts.map((p) => p.page), [0, 1]);
});

/** 小さな画像を作る（白地に塗り） */
function canvas(W, H) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const fill = (x0, y0, x1, y1, [r, g, b]) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * W + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; } };
  return { width: W, height: H, data, fill };
}

test('インクの行：黒い文字の行を割合の座標で返す（透明・赤は数えない）', () => {
  const c = canvas(100, 100);
  c.fill(10, 10, 60, 14, [0, 0, 0]);
  c.fill(20, 40, 50, 45, [200, 0, 0]); // 赤い字は行にしない（解答表）
  c.fill(30, 70, 80, 74, [20, 20, 20]);
  const lines = inkLines(c);
  assert.equal(lines.length, 2);
  assert.deepEqual([lines[0].y0, lines[0].x0, lines[1].y0, lines[1].x0], [0.1, 0.1, 0.7, 0.3]);
});

test('赤い字：表の行と列を見分け、列ごとに上から番号順に並べる', () => {
  const c = canvas(400, 600);
  // 共通の表：3列 × 9・8・8行（＝25）
  const cols = [60, 180, 300];
  [9, 8, 8].forEach((n, ci) => { for (let r = 0; r < n; r++) c.fill(cols[ci], 20 + r * 20, cols[ci] + 6, 30 + r * 20, [220, 30, 30]); });
  // 類の表：2列 × 5行
  for (let ci = 0; ci < 2; ci++) for (let r = 0; r < 5; r++) c.fill([100, 250][ci], 330 + r * 20, [100, 250][ci] + 6, 340 + r * 20, [220, 30, 30]);
  const { glyphs } = redGlyphs(c);
  assert.equal(glyphs.length, 35);
  const tables = answerTables([{ page: 44, glyphs }]);
  assert.deepEqual(tables.map((t) => t.glyphs.length), [25, 10]);
  // 列優先：1列目の9個 → 2列目
  assert.equal(tables[0].glyphs[8].x0, 60);
  assert.equal(tables[0].glyphs[9].x0, 180);
  assert.ok(tables[0].glyphs[9].y0 < tables[0].glyphs[8].y0);
  assert.equal(tables[1].glyphs[5].x0, 250);
});

test('数字の判定：見本そのものは正しく判定し、差が十分ある', () => {
  for (const [d, t] of Object.entries(DIGIT_TEMPLATES)) {
    const r = classifyGlyph(t, DIGIT_TEMPLATES);
    assert.equal(r.digit, Number(d));
    assert.ok(r.margin > 1);
  }
  assert.equal(Object.keys(DIGIT_TEMPLATES).join(''), '12345');
  assert.ok(Object.values(DIGIT_TEMPLATES).every((t) => t.length === 36));
});

test('特徴量：5×7のます目＋縦横比（36個）', () => {
  const c = canvas(40, 40);
  c.fill(18, 5, 23, 35, [220, 30, 30]);
  const { glyphs, mask, W } = redGlyphs(c);
  assert.equal(glyphs.length, 1);
  const f = glyphFeature(mask, W, glyphs[0]);
  assert.equal(f.length, 36);
  assert.ok(f[35] < 0.3, '縦長');
  assert.ok(f.slice(0, 35).every((v) => v === 1), '枠いっぱいの棒はすべてのます目が塗られている');
});

const fakeBlocks = (n) => Array.from({ length: n }, (_, i) => ({ parts: [{ page: i, y0: 0.1, y1: 0.4, x0: 0.17, x1: 0.85 }] }));
const fakeTable = (digits) => ({ page: 44, box: { x0: 0, y0: 0, x1: 1, y1: 1 }, glyphs: digits.map((d) => ({ digit: d, margin: 1.2 })) });

test('照合：共通25問＋第6類（5番目の類）10問を、正しい正答と組み合わせる', () => {
  const blocks = fakeBlocks(75);
  const common = Array.from({ length: 25 }, (_, i) => (i % 5) + 1);
  const tables = [fakeTable(common), ...[1, 2, 3, 5, 6].map((c) => fakeTable(Array(10).fill(c === 6 ? 4 : 2)))];
  const r = assemble(blocks, tables);
  assert.equal(r.ok, true);
  assert.equal(r.questions.length, 35);
  assert.deepEqual(r.questions.map((q) => q.no), Array.from({ length: 35 }, (_, i) => i + 1));
  assert.equal(r.questions[0].answer, 1);
  assert.equal(r.questions[26].answer, 4, '第6類の表の正答');
  assert.equal(r.questions[25].parts[0].page, 25 + 4 * 10, '第6類の問題（共通25＋1・2・3・5類の40問の後）');
  assert.deepEqual([subjectOfNo(1), subjectOfNo(15), subjectOfNo(16), subjectOfNo(25), subjectOfNo(26), subjectOfNo(35)], ['law', 'law', 'chem', 'chem', 'prop', 'prop']);
});

test('照合：問題の数や解答表の形が違うPDFは取り込まない（誤った正答で採点しない）', () => {
  const tables = [fakeTable(Array(25).fill(1)), ...EXPECT.classes.map(() => fakeTable(Array(10).fill(1)))];
  assert.equal(assemble(fakeBlocks(74), tables).ok, false);
  assert.equal(assemble(fakeBlocks(75), tables.slice(0, 5)).ok, false);
  const bad = [fakeTable(Array(25).fill(1)), ...EXPECT.classes.map(() => fakeTable(Array(10).fill(9)))];
  const r = assemble(fakeBlocks(75), bad);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /正答を読み取れない/);
});

test('採点：科目ごとに数え、未回答は不正解', () => {
  const key = { 1: 3, 2: 1, 16: 5, 26: 2, 27: 4 };
  const per = scorePast([1, 2, 16, 26, 27], { 1: 3, 2: 2, 16: 5, 26: 2 }, key);
  assert.deepEqual(per, { law: { n: 2, c: 1 }, chem: { n: 1, c: 1 }, prop: { n: 2, c: 1 } });
});

test('学習記録：過去問の回答記録を補い、問題の内容（画像）はバックアップに入らない', () => {
  const s = migrate({ q: {}, past: 'こわれた値' }, 'speed');
  assert.deepEqual(s.past, { sessions: [], q: {}, active: null });
  assert.deepEqual(emptyState('full').past, { sessions: [], q: {}, active: null });
  s.past.q[1] = { n: 1, c: 1, last: 1, lastOk: true };
  const text = exportBackup(s);
  assert.ok(!/img:|data:image|blob:/.test(text));
  assert.ok(text.includes('"past"'));
});
