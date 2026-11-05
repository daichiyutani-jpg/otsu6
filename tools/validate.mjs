// 問題・教材データの検証。問題を追加・修正したら必ず実行：node tools/validate.mjs
// エラー（公開不可）と警告（要確認）を出す。エラーがあれば終了コード1。
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'shared', 'data');
const config = JSON.parse(readFileSync(join(DATA, 'config.json'), 'utf8'));
const errors = [], warns = [];
const E = (id, m) => errors.push(`${id}: ${m}`);
const W = (id, m) => warns.push(`${id}: ${m}`);

// アニメIDは実装（shared/anim）から取る
const animSrc = ['defs-chem.js', 'defs-class6.js'].map((f) => readFileSync(join(ROOT, 'shared', 'anim', f), 'utf8')).join('\n');
const ANIM_IDS = new Set([...animSrc.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1]));

const TYPES = ['past', 'similar', 'basic', 'mock'];
const LEVELS = ['basic', 'standard', 'applied'];
const CAUSES = ['term', 'formula', 'substance_mixup', 'extinguish_mixup', 'law_number', 'law_procedure', 'calc', 'misread'];
const SUBJECTS = config.exam.subjects.map((s) => s.id);
const REQUIRED = ['questionId', 'questionType', 'subject', 'topic', 'questionText', 'choices', 'correctAnswer', 'explanation', 'choiceExplanations', 'difficulty', 'importance', 'sourceName', 'sourceUrl', 'examYear', 'sourceVerificationStatus', 'reproductionPermissionStatus', 'animationId', 'relatedQuestionIds', 'lastVerifiedDate'];

const units = new Map(), questions = new Map();
for (const f of config.contentFiles) {
  const p = join(DATA, 'content', f);
  if (!existsSync(p)) { E(f, 'ファイルがありません'); continue; }
  let d;
  try { d = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { E(f, 'JSONとして読めません ' + e.message); continue; }
  for (const u of d.units || []) {
    if (units.has(u.id)) E(u.id, '単元IDが重複');
    units.set(u.id, u);
    if (!SUBJECTS.includes(u.subject)) E(u.id, '科目が不正');
    if (!u.title || !u.summary) E(u.id, 'title/summary がない');
    if (!Array.isArray(u.keyPoints) || u.keyPoints.length < 5) E(u.id, '重要事項が少ない');
    if (!Array.isArray(u.lecture) || u.lecture.length < 8) E(u.id, '講義が短い');
    for (const b of u.lecture || []) {
      if (!['h', 'p', 'list', 'table', 'formula', 'point', 'warn', 'step', 'anim'].includes(b.type)) E(u.id, '講義ブロックの種類が不正 ' + b.type);
      if (b.type === 'anim' && !ANIM_IDS.has(b.id)) E(u.id, '講義のアニメIDが未実装 ' + b.id);
      if (b.type === 'table' && b.rows?.some((r) => r.length !== b.head.length)) E(u.id, '表の列数が見出しと合わない');
    }
    for (const a of u.animationIds || []) if (!ANIM_IDS.has(a)) E(u.id, 'animationIds に未実装のID ' + a);
    if (![1, 2, 3].includes(u.importance)) E(u.id, 'importance が不正');
  }
  for (const q of d.questions || []) {
    const id = q.questionId || '(IDなし)';
    if (questions.has(id)) E(id, '問題IDが重複');
    questions.set(id, q);
    for (const k of REQUIRED) if (!(k in q)) E(id, `項目 ${k} がない`);
    if (!TYPES.includes(q.questionType)) E(id, '種別が不正');
    if (!LEVELS.includes(q.level)) W(id, 'level がない/不正');
    if (!SUBJECTS.includes(q.subject)) E(id, '科目が不正');
    const n = q.choices?.length;
    const want = q.questionType === 'basic' ? 4 : 5;
    if (n !== want) E(id, `選択肢の数が ${n}（${q.questionType} は ${want}）`);
    if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= n) E(id, '正解の添字が範囲外');
    if (q.choiceExplanations?.length !== n) E(id, '選択肢ごとの解説の数が選択肢と違う');
    if (q.choiceCauses && q.choiceCauses.length !== n) E(id, '原因タグの数が選択肢と違う');
    if (q.choiceCauses && q.choiceCauses[q.correctAnswer] !== null) E(id, '正解の選択肢に原因タグがある');
    q.choiceCauses?.forEach((c, i) => { if (i !== q.correctAnswer && c !== null && !CAUSES.includes(c)) E(id, '原因タグが不正 ' + c); });
    if (new Set(q.choices || []).size !== n) E(id, '同じ選択肢が重複');
    if ((q.choices || []).some((c) => !String(c).trim())) E(id, '空の選択肢');
    if (!q.explanation || q.explanation.length < 15) E(id, '解説が短い');
    (q.choiceExplanations || []).forEach((c, i) => { if (!c || c.length < 4) E(id, `選択肢${i + 1}の解説が空`); });
    if (![1, 2, 3].includes(q.difficulty) || ![1, 2, 3].includes(q.importance)) E(id, '難易度/重要度が不正');
    if (q.animationId && !ANIM_IDS.has(q.animationId)) E(id, '未実装のアニメID ' + q.animationId);
    // 出典の整合：過去問は出典・年度・許諾の確認が必須。独自問題は過去問を名乗らない
    if (q.questionType === 'past') {
      if (!q.sourceUrl || !q.examYear) E(id, '過去問なのに出典URL/年度がない');
      if (q.reproductionPermissionStatus !== 'permitted') E(id, '過去問の転載許諾が「permitted」でない（公開版に収録不可）');
      if (q.sourceVerificationStatus !== 'verified') E(id, '過去問の出典が未検証');
    } else {
      if (q.examYear) E(id, '独自問題に出題年度が入っている');
      if (/過去問|本試験で出題|実際に出題/.test(q.sourceName || '')) E(id, '独自問題の出典名が過去問のように見える');
      if (q.reproductionPermissionStatus !== 'not_applicable') W(id, '独自問題の reproductionPermissionStatus');
    }
    // 問題文が選択肢の位置に依存していないか（アプリは選択肢を並べ替える）
    if (/[①②③④⑤]|選択肢\s*[1-5１-５]|上記|下記の(番号)/.test(q.questionText)) W(id, '問題文が選択肢の番号に依存している可能性');
    // 正解の解説に「誤」、誤答の解説に「正しい」で始まるものがないか
    const ce = q.choiceExplanations || [];
    ce.forEach((c, i) => {
      const s = String(c).slice(0, 6);
      if (i === q.correctAnswer && /^(誤り|誤。|×)/.test(s) && !/誤っている|正しくない|不適切|適切でない|適さない|いくつ/.test(q.questionText)) W(id, `正解の選択肢${i + 1}の解説が「誤」で始まる`);
      if (i !== q.correctAnswer && /^(正しい|正。|○)/.test(s) && !/誤っている|正しくない|いくつ|組合せ|組み合わせ/.test(q.questionText)) W(id, `誤答の選択肢${i + 1}の解説が「正しい」で始まる（問題の形式を確認）`);
    });
    // 化学式の書式（ASCII数字の下付き漏れ）
    const blob = [q.questionText, ...(q.choices || []), q.explanation].join(' ');
    if (/\b(H2O2|HNO3|HClO4|BrF3|BrF5|IF5|H2O|CO2|O2|NO2)\b/.test(blob)) W(id, '化学式の数字が下付きになっていない');
  }
}

// 参照の整合
for (const q of questions.values()) {
  if (!units.has(q.topic)) E(q.questionId, '単元が存在しない ' + q.topic);
  else if (units.get(q.topic).subject !== q.subject) E(q.questionId, '単元の科目と問題の科目が違う');
  for (const r of q.relatedQuestionIds || []) if (!questions.has(r)) W(q.questionId, '関連問題IDが存在しない ' + r);
}

// 重複に近い問題（問題文が同一）
const seenText = new Map();
for (const q of questions.values()) {
  const k = (q.questionText + '|' + q.choices.slice().sort().join('|')).replace(/\s/g, '');
  if (seenText.has(k)) E(q.questionId, `問題文と選択肢が ${seenText.get(k)} と同一`);
  else seenText.set(k, q.questionId);
}

// 模試を組める在庫があるか（各科目、本番レベル問題が出題数の3倍以上＝異なる問題セットで3回以上）
for (const s of config.exam.subjects) {
  const pool = [...questions.values()].filter((q) => q.subject === s.id && q.questionType !== 'basic');
  const mock = pool.filter((q) => q.questionType === 'mock').length;
  if (pool.length < s.questions * 3) E(s.id, `本番レベル問題が ${pool.length}問（出題数${s.questions}の3倍未満）`);
  if (mock < s.questions * 2) W(s.id, `模試専用問題が ${mock}問（2回分未満）`);
}

// アニメ教材ごとの確認問題（模試専用以外で2問以上）
for (const a of ANIM_IDS) {
  const n = [...questions.values()].filter((q) => q.animationId === a && q.questionType !== 'mock').length;
  if (n < 2) W(a, `アニメの確認問題（模試専用以外）が ${n}問`);
}

// 正解位置の偏り
for (const t of ['basic', 'similar', 'mock']) {
  const qs = [...questions.values()].filter((q) => q.questionType === t);
  const cnt = {};
  qs.forEach((q) => { cnt[q.correctAnswer] = (cnt[q.correctAnswer] || 0) + 1; });
  const vals = Object.values(cnt);
  if (vals.length && Math.max(...vals) > Math.min(...vals) * 2) W(t, '正解位置の偏り ' + JSON.stringify(cnt));
}

const byType = {};
for (const q of questions.values()) byType[q.questionType] = (byType[q.questionType] || 0) + 1;
const bySubj = {};
for (const q of questions.values()) bySubj[q.subject] = (bySubj[q.subject] || 0) + 1;
console.log(`単元 ${units.size} / 問題 ${questions.size}`, JSON.stringify(byType), JSON.stringify(bySubj), `アニメ ${ANIM_IDS.size}本`);
if (warns.length) { console.log(`\n警告 ${warns.length}件`); warns.forEach((w) => console.log('  ⚠ ' + w)); }
if (errors.length) { console.log(`\nエラー ${errors.length}件`); errors.forEach((e) => console.log('  ✖ ' + e)); process.exit(1); }
console.log('\nエラーなし');
