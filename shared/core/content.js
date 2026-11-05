// 問題・教材データの読み込みと索引づくり。
// readJson(path) は「shared/data/ からの相対パス」を受け取り JSON を返す関数（ブラウザは fetch、テストは fs）。

export const TYPE_LABEL = {
  past: '実際の過去問',
  similar: '独自作成の類題',
  basic: '基礎の学習問題',
  mock: '模擬試験用（独自作成）',
};
export const TYPE_SHORT = { past: '過去問', similar: '類題', basic: '基礎', mock: '模試' };
export const LEVEL_LABEL = { basic: '基礎', standard: '標準', applied: '応用' };

export async function loadContent(readJson) {
  const config = await readJson('config.json');
  const parts = await Promise.all(config.contentFiles.map((f) => readJson('content/' + f)));
  let substances = null;
  try { substances = await readJson('substances.json'); } catch { substances = null; }
  return buildContent(config, parts, substances);
}

export function buildContent(config, parts, substances = null) {
  const units = [];
  const questions = [];
  for (const p of parts) {
    units.push(...(p.units || []));
    questions.push(...(p.questions || []));
  }
  const subjectOrder = config.exam.subjects.map((s) => s.id);
  units.sort((a, b) => subjectOrder.indexOf(a.subject) - subjectOrder.indexOf(b.subject) || a.order - b.order);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const byId = new Map(questions.map((q) => [q.questionId, q]));
  const byUnit = new Map(units.map((u) => [u.id, []]));
  for (const q of questions) {
    if (!byUnit.has(q.topic)) byUnit.set(q.topic, []);
    byUnit.get(q.topic).push(q);
  }
  const byAnim = new Map();
  for (const q of questions) {
    if (!q.animationId) continue;
    if (!byAnim.has(q.animationId)) byAnim.set(q.animationId, []);
    byAnim.get(q.animationId).push(q);
  }
  const subjects = config.exam.subjects.map((s) => ({
    ...s,
    units: units.filter((u) => u.subject === s.id),
  }));
  const counts = { total: questions.length };
  for (const t of Object.keys(TYPE_LABEL)) counts[t] = questions.filter((q) => q.questionType === t).length;
  return { config, units, unitById, questions, byId, byUnit, byAnim, subjects, substances, counts };
}

export function subjectOf(content, id) {
  return content.subjects.find((s) => s.id === id);
}

/** 本番形式（5択の類題・模試問題）かどうか */
export const isExamStyle = (q) => q.questionType === 'similar' || q.questionType === 'mock' || q.questionType === 'past';
