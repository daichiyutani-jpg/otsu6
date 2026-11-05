// 2つの学習パターンのカリキュラム（学習順序）と、今日の目標の計算
import { unitMastery, weakUnits, pendingImportantMistakes } from './engine.js';
import { evaluateCompletion, targets } from './completion.js';
import { dayKey, rate, DAY } from './util.js';

const answeredShare = (state, qs) => (qs.length ? qs.filter((q) => state.q[q.questionId]?.n).length / qs.length : 1);
const latestAcc = (state, qs) => {
  const a = qs.filter((q) => state.q[q.questionId]?.n);
  return a.length ? a.filter((q) => state.q[q.questionId].lastOk).length / a.length : 0;
};
const allAnimIds = (content) => [...new Set(content.units.flatMap((u) => u.animationIds || []))];

function subjectMocksOk(state, content) {
  const { target } = targets(content.config);
  const subs = content.config.exam.subjects.filter((s) => !state.settings.exempt || content.config.exam.exemption.subjects.includes(s.id));
  const ok = subs.filter((s) => state.mocks.some((m) => m.kind === 'subject' && m.subject === s.id && m.perSubject[s.id] && rate(m.perSubject[s.id].c, m.perSubject[s.id].n) >= target - 1e-9));
  return { done: ok.length, total: subs.length };
}

/** 段階の共通部品 */
function commonSteps(state, content, now) {
  const comp = evaluateCompletion(state, content, now);
  const units = content.units;
  const anims = allAnimIds(content);
  const nonMock = content.questions.filter((q) => q.questionType !== 'mock');
  const wrongNow = nonMock.filter((q) => state.q[q.questionId]?.lastOk === false);
  const weak = weakUnits(state, content, { now }).filter((x) => x.unit.importance >= 2);
  const sm = subjectMocksOk(state, content);
  const fullOk = comp.conds.filter((c) => c.id.startsWith('mock-')).every((c) => c.ok);
  return {
    comp,
    diag: { id: 'diag', title: '実力診断', desc: '3科目の今の実力を確かめる', route: '#/diag', progress: state.diag ? 1 : 0 },
    key: { id: 'key', title: '重要事項の学習', desc: '全単元の重要ポイント', route: '#/units?mode=key', progress: units.filter((u) => state.lessons[u.id]?.key).length / (units.length || 1) },
    lecture: { id: 'lecture', title: '基礎講義', desc: '初めてでも分かる講義で全単元を学ぶ', route: '#/units?mode=lecture', progress: units.filter((u) => state.lessons[u.id]?.lecture).length / (units.length || 1) },
    anim: { id: 'anim', title: 'アニメーション教材', desc: '仕組みを見て、確認問題に正解する', route: '#/anims', progress: anims.filter((a) => state.anims[a]?.checkOk).length / (anims.length || 1) },
    drill: { id: 'drill', title: '一問一答', desc: '基礎の4択問題で知識を固める', route: '#/practice?types=basic', progress: answeredShare(state, content.questions.filter((q) => q.questionType === 'basic')) },
    basicQ: { id: 'basicQ', title: '基礎問題', desc: '基礎レベルの問題（4択）', route: '#/practice?level=basic', progress: answeredShare(state, nonMock.filter((q) => q.level === 'basic')) },
    standardQ: { id: 'standardQ', title: '標準問題', desc: '本番レベル（5択）の標準問題', route: '#/practice?level=standard', progress: answeredShare(state, nonMock.filter((q) => q.level === 'standard')) },
    appliedQ: { id: 'appliedQ', title: '応用問題', desc: '組合せ・計算・ひっかけ', route: '#/practice?level=applied', progress: answeredShare(state, nonMock.filter((q) => q.level === 'applied')) },
    past: { id: 'past', title: '過去問演習', desc: content.counts.past ? '実際の過去問と類題' : '実際の過去問は収録0問のため、過去の出題テーマを参考にした類題で演習', route: '#/practice?types=past,similar', progress: answeredShare(state, content.questions.filter((q) => q.questionType === 'similar' || q.questionType === 'past')) },
    review: { id: 'review', title: '間違い問題の復習', desc: '間違えた問題を正解するまで', route: '#/review', progress: state.q && Object.keys(state.q).length ? (wrongNow.length ? Math.max(0, 1 - wrongNow.length / 30) * 0.99 : 1) : 0 },
    cause: { id: 'cause', title: '間違いの原因分析', desc: 'なぜ間違えたかを確かめて対策', route: '#/causes', progress: state.causes.length ? (state.causes.some((c) => !c.confirmed) ? 0.5 : 1) : 0 },
    weak: { id: 'weak', title: '苦手分野の追加学習', desc: '習得度80%未満の重要単元を補強', route: '#/weak', progress: Object.keys(state.q).length ? 1 - weak.length / (content.units.filter((u) => u.importance >= 2).length || 1) : 0 },
    subjectMock: { id: 'subjectMock', title: '科目別模擬試験', desc: '科目ごとに本番と同じ問題数', route: '#/mock?kind=subject', progress: sm.done / (sm.total || 1) },
    fullMock: { id: 'fullMock', title: '総合模擬試験', desc: '本番と同じ35問・2時間', route: '#/mock', progress: fullOk ? 1 : Math.min(0.9, comp.mocks * 0.3) },
    finish: { id: 'finish', title: '学習終了判定', desc: '7つの条件をすべて満たす', route: '#/progress', progress: comp.conds.filter((c) => c.ok).length / comp.conds.length },
  };
}

export function speedCurriculum(state, content, now = Date.now()) {
  const s = commonSteps(state, content, now);
  const steps = [s.diag, s.key, s.anim, s.drill, { ...s.past, title: '過去問・類題演習' }, s.review, s.weak, s.subjectMock, s.fullMock, s.finish];
  return { steps, comp: s.comp, current: steps.find((x) => x.progress < 1) || steps[steps.length - 1] };
}

export function fullCurriculum(state, content, now = Date.now()) {
  const s = commonSteps(state, content, now);
  const steps = [s.diag, s.lecture, s.anim, { ...s.key, title: '重要事項の整理' }, s.basicQ, s.standardQ, s.past, s.appliedQ, s.cause, { ...s.weak, title: '苦手分野の再学習' }, s.subjectMock, s.fullMock, s.finish];
  return { steps, comp: s.comp, current: steps.find((x) => x.progress < 1) || steps[steps.length - 1] };
}

/** 完全学習型：単元ごとの段階（講義→アニメ→重要事項→基礎→標準→応用） */
export function unitStages(state, content, unitId) {
  const u = content.unitById.get(unitId);
  const qs = (content.byUnit.get(unitId) || []).filter((q) => q.questionType !== 'mock');
  const lv = (l) => qs.filter((q) => q.level === l);
  const stage = (qsl) => ({ total: qsl.length, share: answeredShare(state, qsl), acc: latestAcc(state, qsl), done: qsl.length === 0 || (answeredShare(state, qsl) >= 0.8 && latestAcc(state, qsl) >= 0.8) });
  return [
    { id: 'lecture', title: '基礎講義を読む', done: !!state.lessons[unitId]?.lecture },
    { id: 'anim', title: '図解・アニメ（確認問題に正解）', done: (u.animationIds || []).every((a) => state.anims[a]?.checkOk), skip: !(u.animationIds || []).length },
    { id: 'key', title: '重要事項の整理', done: !!state.lessons[unitId]?.key },
    { id: 'basic', title: '基礎問題', ...stage(lv('basic')) },
    { id: 'standard', title: '標準問題', ...stage(lv('standard')) },
    { id: 'applied', title: '応用問題', ...stage(lv('applied')) },
  ];
}

/**
 * 今日の目標。1日の学習時間（分）と試験日から、回答数と教材の目安を出す。
 * paceNote: 試験日までに未回答問題を1周するのに必要なペース。
 */
export function dailyGoal(state, content, appKind, now = Date.now()) {
  const min = Number(state.settings.dailyMinutes) || 30;
  const perQ = appKind === 'full' ? 1.6 : 1.1; // 1問あたりの分（解説を読む時間を含む）
  const readShare = appKind === 'full' ? 0.35 : 0.15;
  const qTarget = Math.max(5, Math.round((min * (1 - readShare)) / perQ));
  const today = state.days[dayKey(now)] || { sec: 0, n: 0, c: 0 };
  let paceNote = '';
  if (state.settings.examDate) {
    const [y, m, d] = state.settings.examDate.split('-').map(Number);
    const days = Math.ceil((new Date(y, m - 1, d).getTime() - now) / DAY);
    const left = content.questions.filter((q) => q.questionType !== 'mock' && !state.q[q.questionId]?.n).length;
    if (days > 0) {
      const pace = Math.ceil(left / Math.max(1, days - 3)); // 最後の3日は模試と復習にあてる
      paceNote = `試験日まであと${days}日。未回答 ${left}問を1周するには1日 ${pace}問のペースです。`;
      if (pace > qTarget) paceNote += `今の設定（1日${min}分）だと少し足りません。学習時間を増やすか、重要度の高い単元から進めましょう。`;
    } else if (days === 0) paceNote = '今日が試験日です。重要事項の見直しを。';
  }
  return { minutes: min, qTarget, today, doneQ: today.n, doneMin: Math.round(today.sec / 60), paceNote };
}

/** 単元の習得度一覧（表示用） */
export function unitTable(state, content, now = Date.now()) {
  return content.units.map((u) => ({ unit: u, ...unitMastery(state, content, u.id, now) }));
}

export { pendingImportantMistakes };
