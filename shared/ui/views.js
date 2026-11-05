// 2つのアプリで共通の画面
import { h, bar, stars, toast, confirmBox } from './dom.js';
import { quizView, typeBadge } from './quiz.js';
import { mockRoute } from './mock.js';
import { animPlayer } from '../anim/player.js';
import { ANIMS, ANIM_BY_ID } from '../anim/index.js';
import { pickPractice, reviewQueue, pendingImportantMistakes, weakUnits, buildRetest, unitMastery, streak } from '../core/engine.js';
import { evaluateCompletion, targets } from '../core/completion.js';
import { causeSummary, CAUSES } from '../core/analysis.js';
import { exportBackup, validateBackup } from '../core/store.js';
import { TYPE_LABEL, LEVEL_LABEL } from '../core/content.js';
import { apportion, shuffle, pct, dayKey, addDays, fmtDuration, rate } from '../core/util.js';

// ---------- 教材（単元） ----------

export function renderBlocks(blocks, ctx) {
  return blocks.map((b) => {
    switch (b.type) {
      case 'h': return h('h3', b.text);
      case 'p': return h('p', b.text);
      case 'list': return h('ul.keypoints', b.items.map((x) => h('li', x)));
      case 'table': return h('div.tbl-wrap', h('table', h('thead', h('tr', b.head.map((x) => h('th', x)))), h('tbody', b.rows.map((r) => h('tr', r.map((x) => h('td', x)))))));
      case 'formula': return h('div', h('div.formula', b.text), b.note ? h('p.small.muted.center', b.note) : null);
      case 'point': return h('div.note-point', h('b', '試験ポイント　'), b.text);
      case 'warn': return h('div.note-warn', h('b', '注意　'), b.text);
      case 'step': return h('div', b.title ? h('b', b.title) : null, h('ol.steps-list', b.items.map((x) => h('li', x))));
      case 'anim': {
        const d = ANIM_BY_ID.get(b.id);
        return d ? h('a.menu-item', { href: `#/anim/${d.id}` }, h('span.ico', '▶'), h('div', h('b', 'アニメ教材：' + d.title), h('span.muted', '仕組みを図で確認（静止画でも見られます）'))) : null;
      }
      default: return b.text ? h('p', b.text) : null;
    }
  });
}

function unitsView(ctx, page, args, query) {
  const { content } = ctx;
  const s = ctx.state();
  const mode = query.mode || (ctx.app.id === 'full' ? 'lecture' : 'key');
  page.title = mode === 'lecture' ? '基礎講義' : '重要事項';
  page.body = h('div',
    h('div.chips', { style: { marginBottom: '12px' } },
      h('a.chip' + (mode === 'key' ? '.on' : ''), { href: '#/units?mode=key' }, '重要事項'),
      h('a.chip' + (mode === 'lecture' ? '.on' : ''), { href: '#/units?mode=lecture' }, '基礎講義'),
      h('a.chip', { href: '#/substances' }, '物質の比較表')),
    content.subjects.map((sub) => h('div.card',
      h('h2', sub.name),
      sub.units.map((u) => {
        const m = unitMastery(s, content, u.id);
        const read = s.lessons[u.id]?.[mode];
        return h('a.menu-item', { href: `#/unit/${encodeURIComponent(u.id)}?mode=${mode}`, style: { marginBottom: '8px' } },
          h('span.ico', read ? '✅' : '📖'),
          h('div', { style: { flex: 1 } }, h('b', u.title), h('span.muted', `重要度 ${stars(u.importance)}　習得度 ${pct(m.mastery)}%`), bar(m.mastery, { target: 0.8, cls: m.mastery >= 0.8 ? 'ok' : '' })));
      }))));
}

function unitView(ctx, page, [id], query) {
  const { content, store, app } = ctx;
  const u = content.unitById.get(id);
  if (!u) { page.body = h('div.card', '単元が見つかりません'); return; }
  const mode = query.mode || (app.id === 'full' ? 'lecture' : 'key');
  page.title = u.title;
  ctx.setResume(u.title);
  const s = ctx.state();
  const m = unitMastery(s, content, u.id);
  const qs = (content.byUnit.get(u.id) || []).filter((q) => q.questionType !== 'mock');
  const markRead = () => { store.update((st) => { st.lessons[u.id] = { ...(st.lessons[u.id] || {}), [mode]: Date.now() }; }); toast('読み終えた記録をつけました'); ctx.render(); };
  const extra = app.unitExtra ? app.unitExtra(ctx, u) : null;
  page.body = h('div',
    h('div.card',
      h('div.badges', h('span.badge.fill', content.subjects.find((x) => x.id === u.subject).short), h('span.badge.fill', `重要度 ${stars(u.importance)}`)),
      h('p', u.summary),
      h('div.small', `習得度 ${pct(m.mastery)}%（異なる問題で確認 ${m.distinct}/${m.need}問）`), bar(m.mastery, { target: 0.8, cls: m.mastery >= 0.8 ? 'ok' : '' }),
      h('div.chips', { style: { marginTop: '10px' } },
        h('a.chip' + (mode === 'key' ? '.on' : ''), { href: `#/unit/${encodeURIComponent(u.id)}?mode=key` }, '重要事項'),
        h('a.chip' + (mode === 'lecture' ? '.on' : ''), { href: `#/unit/${encodeURIComponent(u.id)}?mode=lecture` }, '基礎講義'))),
    extra,
    h('div.card',
      mode === 'key'
        ? [h('h2', '重要事項'), h('ol.keypoints', u.keyPoints.map((k) => h('li', k)))]
        : [h('h2', '基礎講義'), ...renderBlocks(u.lecture, ctx)],
      (u.animationIds || []).length && mode === 'key' ? h('div', h('h3', 'アニメ教材'), u.animationIds.map((a) => renderBlocks([{ type: 'anim', id: a }], ctx))) : null,
      h('hr'),
      h('button.btn.block' + (s.lessons[u.id]?.[mode] ? '' : '.primary'), { onclick: markRead }, s.lessons[u.id]?.[mode] ? '✓ 読み終えた（もう一度記録）' : '読み終えた'),
      h('div.source', '出典：', u.sources?.map((x, i) => [i ? '／' : '', x.url ? h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.name) : x.name, `（確認 ${x.checkedDate || '—'}）`]))),
    h('div.card',
      h('h2', 'この単元の問題'),
      h('p.small.muted', `基礎 ${qs.filter((q) => q.questionType === 'basic').length}問・類題 ${qs.filter((q) => q.questionType === 'similar').length}問（模試専用問題は模試でのみ出題）`),
      h('div.stack',
        h('a.btn.primary.block', { href: `#/practice?unit=${encodeURIComponent(u.id)}&go=1&order=level` }, 'この単元の問題を解く'),
        h('a.btn.block', { href: `#/retest?unit=${encodeURIComponent(u.id)}` }, '再テスト（未使用の問題を優先）'))));
}

// ---------- 演習 ----------

function practiceView(ctx, page, args, query) {
  const { content, store } = ctx;
  const s = ctx.state();
  if (query.go) {
    const f = {
      types: query.types ? query.types.split(',') : null, subject: query.subject || null, unit: query.unit || null,
      difficulty: query.difficulty || null, level: query.level || null, status: query.status || 'all',
      shuffle: query.shuffle !== '0', limit: Number(query.limit) || 10, preferUnanswered: query.status !== 'all' ? false : true,
    };
    let qs = pickPractice(s, content, f);
    if (query.order === 'level') { const o = { basic: 0, standard: 1, applied: 2 }; qs = qs.sort((a, b) => o[a.level] - o[b.level]); }
    const label = [f.types ? f.types.map((t) => TYPE_LABEL[t]).join('・') : null, f.subject ? content.subjects.find((x) => x.id === f.subject).short : null, f.unit ? content.unitById.get(f.unit)?.title : null, f.level ? LEVEL_LABEL[f.level] : null].filter(Boolean).join(' / ');
    return quizView(ctx, page, { title: label || '問題演習', qids: qs.map((q) => q.questionId), ctxName: 'drill', emptyText: f.status === 'fav' ? 'お気に入りに登録した問題がありません。問題の右上の☆で登録できます。' : '条件に合う問題がありません。' });
  }
  page.title = '問題演習';
  const f = { types: query.types ? query.types.split(',') : [], subject: query.subject || '', unit: query.unit || '', difficulty: query.difficulty || '', level: query.level || '', status: query.status || 'all', shuffle: '1', limit: '10' };
  const body = h('div');
  const count = () => pickPractice(s, content, { ...f, types: f.types.length ? f.types : null, shuffle: false, limit: 0 }).length;
  const draw = () => {
    const chip = (key, val, label) => h('button.chip' + ((Array.isArray(f[key]) ? f[key].includes(val) : f[key] === val) ? '.on' : ''), { onclick: () => {
      if (Array.isArray(f[key])) f[key] = f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val];
      else f[key] = f[key] === val ? '' : val;
      if (key === 'subject') f.unit = '';
      draw();
    } }, label);
    const n = count();
    body.replaceChildren(
      h('div.card',
        h('h3', '問題の種類'),
        h('div.chips', chip('types', 'past', `実際の過去問（${content.counts.past}問）`), chip('types', 'similar', `独自作成の類題（${content.counts.similar}）`), chip('types', 'basic', `基礎の学習問題（${content.counts.basic}）`)),
        content.counts.past === 0 ? h('p.small.muted', '実際の過去問は、公式の利用条件により収録していません（0問）。詳しくは「このアプリについて」。') : null,
        h('h3', '科目'),
        h('div.chips', content.subjects.map((x) => chip('subject', x.id, x.short))),
        f.subject ? [h('h3', '単元'), h('select', { onchange: (e) => { f.unit = e.target.value; draw(); } }, h('option', { value: '' }, 'すべての単元'), content.units.filter((u) => u.subject === f.subject).map((u) => h('option', { value: u.id, selected: f.unit === u.id }, u.title)))] : null,
        h('h3', '難易度・段階'),
        h('div.chips', chip('difficulty', '1', '易'), chip('difficulty', '2', '中'), chip('difficulty', '3', '難'), chip('level', 'basic', '基礎'), chip('level', 'standard', '標準'), chip('level', 'applied', '応用')),
        h('h3', '出題する問題'),
        h('div.chips', chip('status', 'all', 'すべて'), chip('status', 'unanswered', '未回答'), chip('status', 'wrong', '最後に間違えた'), chip('status', 'missed', '一度でも間違えた'), chip('status', 'fav', 'お気に入り')),
        h('h3', '問題数・順番'),
        h('div.chips', ['5', '10', '20', '50'].map((v) => chip('limit', v, v + '問')), chip('shuffle', '1', 'シャッフル')),
        h('p.small.muted', `条件に合う問題：${n}問`),
        h('button.btn.primary.block', { disabled: n === 0, onclick: () => {
          const q = new URLSearchParams({ go: '1', status: f.status || 'all', limit: f.limit || '10', shuffle: f.shuffle === '1' ? '1' : '0' });
          if (f.types.length) q.set('types', f.types.join(','));
          for (const k of ['subject', 'unit', 'difficulty', 'level']) if (f[k]) q.set(k, f[k]);
          ctx.go('#/practice?' + q.toString());
        } }, '出題する')));
  };
  draw();
  page.body = body;
}

function reviewView(ctx, page, args, query) {
  const { content, store } = ctx;
  const s = ctx.state();
  let qids, title, intro;
  if (query.set && s.reviewSet) { qids = s.reviewSet.qids; title = s.reviewSet.label; intro = '模試や演習で間違えた問題の復習セットです。模試専用の問題も、ここでは解き直せます。'; }
  else if (query.only === 'important') { qids = pendingImportantMistakes(s, content).map((q) => q.questionId).slice(0, 20); title = '重要問題の解き直し'; }
  else { qids = reviewQueue(s, content, { limit: 15 }).map((q) => q.questionId); title = '間違えた問題の復習'; intro = '間違いが多い問題・最後に間違えた問題・しばらく解いていない問題を優先して出題します。'; }
  if (!qids.length) {
    page.title = '復習';
    page.body = h('div.card', h('h2', '復習する問題はありません'), h('p.muted', '間違えた問題や、しばらく解いていない問題がここに出ます。'), h('a.btn.primary', { href: '#/practice' }, '問題演習へ'));
    return;
  }
  quizView(ctx, page, { title, qids, ctxName: 'review', intro });
}

function retestView(ctx, page, args, query) {
  const { content } = ctx;
  const s = ctx.state();
  const units = query.unit ? [query.unit] : weakUnits(s, content, { limit: 4 }).map((x) => x.unit.id);
  if (!units.length) { page.title = '再テスト'; page.body = h('div.card', h('h2', '再テストの対象がありません'), h('p.muted', 'すべての単元の習得度が80%以上です。模擬試験で確認しましょう。'), h('a.btn.primary', { href: '#/mock' }, '模擬試験へ')); return; }
  const qs = buildRetest(s, content, units, Math.max(content.config.completion.retestMinQuestions, 10));
  quizView(ctx, page, {
    title: '再テスト', qids: qs.map((q) => q.questionId), ctxName: 'retest',
    intro: `対象：${units.map((id) => content.unitById.get(id)?.title).join('、')}。まだ解いていない問題を優先して出題します（同じ問題の暗記で済ませないため）。`,
    onDone: (res) => h('p.small', rate(res.filter((r) => r.ok).length, res.length) >= 0.8 ? '再テストの基準（80%）に届きました。' : '基準（80%）に届きませんでした。教材を見直してからもう一度挑戦しましょう。'),
  });
}

function diagView(ctx, page) {
  const { content, store } = ctx;
  const s = ctx.state();
  // 各科目5問、単元の重要度に応じて配分（基礎と類題から）
  const picks = [];
  for (const sub of content.subjects) {
    const units = sub.units.filter((u) => (content.byUnit.get(u.id) || []).some((q) => q.questionType !== 'mock'));
    const order = shuffle(units).sort((a, b) => b.importance - a.importance);
    const alloc = apportion(5, order.map((u) => u.importance));
    order.forEach((u, i) => {
      const pool = shuffle((content.byUnit.get(u.id) || []).filter((q) => q.questionType === 'similar' || q.questionType === 'basic'));
      picks.push(...pool.slice(0, alloc[i]));
    });
  }
  quizView(ctx, page, {
    title: '実力診断', qids: picks.map((q) => q.questionId), ctxName: 'diag',
    intro: '3科目×5問＝15問の診断です。分からない問題は勘で選ばず、近いと思うものを選んでください。結果は学習の順番と時間配分の目安に使います（診断の結果で学習範囲を省略することはありません）。',
    onDone: (res) => {
      const per = {};
      for (const r of res) { const q = content.byId.get(r.qid); per[q.subject] = per[q.subject] || { n: 0, c: 0 }; per[q.subject].n++; if (r.ok) per[q.subject].c++; }
      store.update((st) => { st.diag = { t: Date.now(), perSubject: per, qids: res.map((r) => r.qid) }; });
      return diagSummary(content, per);
    },
  });
}

export function diagSummary(content, per) {
  const rows = content.subjects.map((sub) => ({ sub, r: per[sub.id] ? rate(per[sub.id].c, per[sub.id].n) : 0 }));
  const weakest = rows.slice().sort((a, b) => a.r - b.r)[0];
  // 時間配分：正答率が低いほど多く（最低20%は確保して範囲を省かない）
  const w = rows.map((x) => 1.4 - x.r);
  const share = apportion(100, w).map((v) => Math.max(20, v));
  const sum = share.reduce((a, b) => a + b, 0);
  return h('div', { style: { textAlign: 'left' } },
    rows.map((x, i) => h('div.subj', h('div.subj-head', h('b', x.sub.short), h('span', `${pct(x.r)}%`)), bar(x.r, { target: 0.8 }), h('div.small.muted', `おすすめの時間配分 約${Math.round((share[i] / sum) * 100)}%`))),
    h('p.small', `いちばん伸びしろがあるのは「${weakest.sub.short}」です。全科目を学びつつ、ここに少し多めに時間を使いましょう。`));
}

// ---------- アニメ教材 ----------

function animsView(ctx, page) {
  const s = ctx.state();
  page.title = 'アニメ教材';
  const used = new Set(ctx.content.units.flatMap((u) => u.animationIds || []));
  const subjName = (id) => ctx.content.subjects.find((x) => x.id === id)?.short;
  page.body = h('div',
    h('p.small.muted', '仕組みを図で学ぶ教材です。見ただけでは習得扱いにせず、最後の確認問題に全問正解すると「確認済み」になります。動きが苦手な方は「静止画モード」で同じ内容を読めます。'),
    ['law', 'chem', 'prop'].map((sub) => h('div.card', h('h2', subjName(sub)),
      ANIMS.filter((a) => a.subject === sub).map((a) => h('a.menu-item', { href: `#/anim/${a.id}`, style: { marginBottom: '8px' } },
        h('span.ico', s.anims[a.id]?.checkOk ? '✅' : s.anims[a.id]?.viewed ? '👀' : '▶'),
        h('div', h('b', a.title), h('span.muted', `${a.steps.length}段階　${s.anims[a.id]?.checkOk ? '確認問題 正解済み' : s.anims[a.id]?.viewed ? '視聴済み・確認問題がまだ' : '未視聴'}${used.has(a.id) ? '' : ''}`)))))));
}

function animView(ctx, page, [id], query) {
  const { content, store } = ctx;
  const def = ANIM_BY_ID.get(id);
  if (!def) { page.body = h('div.card', '教材が見つかりません'); return; }
  page.title = def.title;
  const s = ctx.state();
  const checks = (content.byAnim.get(id) || []).filter((q) => q.questionType !== 'mock');
  if (query.check) {
    const pick = shuffle(checks).slice(0, 3);
    return quizView(ctx, page, {
      title: '確認問題：' + def.title, qids: pick.map((q) => q.questionId), ctxName: 'check',
      onDone: (res) => {
        const all = res.every((r) => r.ok);
        if (all) store.update((st) => { st.anims[id] = { ...(st.anims[id] || {}), checkOk: Date.now() }; });
        return h('div', h('p', all ? '確認問題に全問正解しました。この教材は「確認済み」です。' : '間違えた問題がありました。アニメをもう一度見てから再挑戦しましょう。'),
          h('a.btn.block', { href: `#/anim/${id}` }, '▶ アニメをもう一度見る'));
      },
    });
  }
  ctx.setResume('アニメ：' + def.title);
  const unit = content.unitById.get(def.unitId);
  const player = animPlayer(def, {
    reduceMotion: s.settings.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    captions: s.settings.captions,
    onEnd: () => { if (!ctx.state().anims[id]?.viewed) store.update((st) => { st.anims[id] = { ...(st.anims[id] || {}), viewed: Date.now() }; }); },
  });
  page.onLeave = () => player.destroy();
  page.body = h('div',
    player,
    h('div.card',
      h('h2', '確認問題'),
      h('p.small.muted', checks.length ? `この教材に関連する問題から最大3問を出題します（関連問題 ${checks.length}問）。全問正解で「確認済み」になります。` : 'この教材に関連する確認問題はまだありません。'),
      checks.length ? h('a.btn.primary.block', { href: `#/anim/${id}?check=1` }, '確認問題に進む') : null,
      unit ? h('a.btn.block', { href: `#/unit/${encodeURIComponent(unit.id)}`, style: { marginTop: '8px' } }, '📖 単元「' + unit.title + '」へ') : null));
}

// ---------- 物質の比較 ----------

function substancesView(ctx, page) {
  const sub = ctx.content.substances;
  page.title = '第6類 物質の比較';
  if (!sub) { page.body = h('div.card', '比較データがありません'); return; }
  page.body = h('div',
    h('p.small.muted', `確認日 ${sub.checkedDate}。${sub.note || ''}`),
    h('div.card', h('h2', '早見表'), h('div.tbl-wrap', h('table',
      h('thead', h('tr', h('th', '物質'), h('th', '化学式'), h('th', '適する消火'), h('th', '不適な消火'))),
      h('tbody', sub.substances.map((x) => h('tr', h('td', h('b', x.name)), h('td', x.formula), h('td', (x.extinguish?.ok || []).join('、')), h('td', (x.extinguish?.ng || []).map((n) => n.method).join('、')))))))),
    sub.substances.map((x) => h('details.card',
      h('summary', `${x.name}　${x.formula}`),
      h('dl.kv', h('dt', '性状'), h('dd', x.appearance), h('dt', '比重'), h('dd', x.specificGravity || '—'), h('dt', '酸化性'), h('dd', x.oxidizing || '—')),
      h('h3', '危険性'), h('ul.keypoints', (x.hazards || []).map((t) => h('li', t))),
      h('h3', '火災予防・貯蔵'), h('ul.keypoints', [...(x.prevention || []), ...(x.storage || [])].map((t) => h('li', t))),
      h('h3', '消火'), h('ul.keypoints', (x.extinguish?.ok || []).map((t) => h('li', '○ ' + t)), (x.extinguish?.ng || []).map((n) => h('li', `× ${n.method}：${n.reason}`))),
      h('h3', '他の物質との違い'), h('p', x.difference),
      h('h3', '試験のポイント'), h('ul.keypoints', (x.examPoints || []).map((t) => h('li', t))),
      h('div.row', x.animationId ? h('a.btn.sm', { href: `#/anim/${x.animationId}` }, '▶ アニメ') : null, x.unitId ? h('a.btn.sm', { href: `#/unit/${encodeURIComponent(x.unitId)}` }, '📖 単元') : null))),
    h('p.small.muted', '実際の取扱い・消火は、法令・事業所の規程・SDS（安全データシート）に従い、火災時は消防へ通報してください。'));
}

// ---------- 進捗・終了判定 ----------

export function subjectPanel(ctx, comp) {
  return comp.subjects.map((x) => h('div.subj',
    h('div.subj-head', h('b', x.short + (x.exempt ? '（免除）' : '')), h('span.small', x.current == null ? '模試未受験' : `${pct(x.current)}%`)),
    x.exempt ? h('p.small.muted', '科目免除の設定により判定の対象外') : [
      h('dl.kv',
        h('dt', '合格基準'), h('dd', `${pct(x.pass)}%`),
        h('dt', '学習目標'), h('dd', `${pct(x.target)}%`),
        h('dt', '現在の正答率'), h('dd', x.current == null ? '—（本番形式の模試で測定）' : `${pct(x.current)}%`),
        h('dt', '目標まで'), h('dd', x.current == null ? '—' : x.gap > 0 ? `あと${x.gap}ポイント` : '達成'),
        h('dt', '習得度'), h('dd', `${pct(x.mastery)}%`)),
      bar(x.current ?? 0, { target: x.target, cls: x.current != null && x.current >= x.target ? 'ok' : '', label: '模試の正答率' }),
      h('div.small.muted', '習得度（単元を異なる問題で確認した度合い）'),
      bar(x.mastery, { target: 0.8, label: '習得度' })]));
}

function progressView(ctx, page) {
  const { content } = ctx;
  const s = ctx.state();
  const comp = evaluateCompletion(s, content);
  page.title = '学習進捗・終了判定';
  page.body = h('div',
    comp.done ? h('div.done-banner.pop', '設定した学習目標を達成しました') : null,
    comp.done ? h('p.small.muted.center', 'これは本アプリで設定した学習目標（各科目の合格基準＋20ポイント）の達成です。本試験の合格や合格率を保証するものではありません。本番まで復習を続けましょう。') : null,
    h('div.card', h('h2', '科目別の状況'), subjectPanel(ctx, comp)),
    h('div.card', h('h2', '学習終了条件'),
      comp.conds.map((c) => h('div.check' + (c.ok ? '.ok' : ''), h('span.ck', c.ok ? '✓' : ''), h('div', h('div', c.label), h('div.small.muted', c.detail))))),
    !comp.done ? h('div.card', h('h2', '次に学習すること'), comp.next.map((a) => h('a.menu-item', { href: a.route, style: { marginBottom: '8px' } }, h('span.ico', '➜'), h('div', h('b', a.label))))) : null,
    comp.unmastered.length ? h('div.card', h('h2', '復習が必要な単元'), comp.unmastered.map((x) => h('a.menu-item', { href: `#/unit/${encodeURIComponent(x.unit.id)}`, style: { marginBottom: '8px' } }, h('span.ico', '📖'), h('div', { style: { flex: 1 } }, h('b', x.unit.title), h('span.muted', `習得度 ${pct(x.mastery)}%　確認 ${x.distinct}/${x.need}問`), bar(x.mastery, { target: 0.8 }))))) : null,
    comp.pending.length ? h('div.card', h('h2', `未習得の重要問題（${comp.pending.length}問）`), h('p.small.muted', '重要度★★★で、最後の回答が不正解の問題です。'), h('a.btn.primary.block', { href: '#/review?only=important' }, '解き直す')) : null,
    h('div.disclaimer', `学習目標は、公式の合格基準（各科目${pct(comp.pass)}%以上）に20ポイントを加えた${pct(comp.target)}%です（確認日 ${content.config.checkedDate}）。${content.config.exam.passRateNote}アプリの目標達成と実際の試験の合否は別のものです。`));
}

function weakView(ctx, page) {
  const { content } = ctx;
  const s = ctx.state();
  const list = weakUnits(s, content, {});
  page.title = '苦手分野';
  page.body = h('div',
    h('p.small.muted', '習得度80%未満の単元を、習得度の低い順に表示します。習得度は「異なる問題で正解できたか」で計算するため、同じ問題の繰り返しでは上がりません。'),
    list.length ? null : h('div.done-banner', 'すべての単元が習得度80%以上です'),
    list.map((x) => h('div.card',
      h('div.subj-head', h('b', x.unit.title), h('span.small', `${pct(x.mastery)}%`)),
      bar(x.mastery, { target: 0.8 }),
      h('p.small.muted', `重要度 ${stars(x.unit.importance)}　解いた問題 ${x.distinct}/${x.total}問　必要な確認数 ${x.need}問`),
      h('div.row',
        h('a.btn.sm', { href: `#/unit/${encodeURIComponent(x.unit.id)}` }, '📖 教材'),
        (x.unit.animationIds || [])[0] ? h('a.btn.sm', { href: `#/anim/${x.unit.animationIds[0]}` }, '▶ アニメ') : null,
        h('a.btn.sm', { href: `#/practice?unit=${encodeURIComponent(x.unit.id)}&go=1&order=level` }, '問題を解く'),
        h('a.btn.sm.primary', { href: `#/retest?unit=${encodeURIComponent(x.unit.id)}` }, '再テスト')))));
}

function causesView(ctx, page) {
  const { content } = ctx;
  const s = ctx.state();
  const sum = causeSummary(s);
  page.title = '間違いの原因分析';
  const recent = s.causes.slice(-15).reverse();
  page.body = h('div',
    h('p.small.muted', '間違えたときに選んだ選択肢から原因を推測し、あなたに確認してもらった結果を集計しています。推測は断定ではありません。'),
    h('div.card', h('h2', '原因の内訳'),
      sum.length ? sum.map((x) => h('div.subj', h('div.subj-head', h('b', CAUSES[x.cause]?.label || x.cause), h('span.small', `${x.n}回（確認済み ${x.confirmed}）`)), h('p.small', '対策：' + (CAUSES[x.cause]?.action || '')), CAUSES[x.cause]?.anim ? h('a.btn.sm', { href: `#/anim/${CAUSES[x.cause].anim}` }, '▶ 教材') : null))
        : h('p.muted', 'まだ記録がありません。問題を間違えたときに原因を記録できます。')),
    recent.length ? h('div.card', h('h2', '最近の記録'), recent.map((c) => {
      const q = content.byId.get(c.qid);
      if (!q) return null;
      const u = content.unitById.get(q.topic);
      return h('div.check', h('span.ck', c.confirmed ? '✓' : '?'), h('div.small', h('div', q.questionText.slice(0, 60) + '…'), h('span.muted', `${CAUSES[c.cause]?.label}${c.confirmed ? '' : '（推測・未確認）'}　`), u ? h('a', { href: `#/unit/${encodeURIComponent(u.id)}` }, u.title) : null));
    })) : null);
}

// ---------- 学習記録 ----------

function chartBars(values, labels, { max = null, target = null, unit = '' } = {}) {
  const W = 340, H = 140, pad = 24;
  const m = max ?? Math.max(1, ...values);
  const bw = (W - pad) / values.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H + 20}" role="img">`;
  s += `<line class="g" x1="${pad}" y1="${H}" x2="${W}" y2="${H}"/>`;
  values.forEach((v, i) => {
    const hh = (v / m) * (H - 10);
    s += `<rect class="b" x="${pad + i * bw + 2}" y="${H - hh}" width="${bw - 4}" height="${hh}" rx="2"><title>${labels[i]} ${v}${unit}</title></rect>`;
    if (i % Math.ceil(values.length / 7) === 0) s += `<text x="${pad + i * bw + bw / 2}" y="${H + 14}" text-anchor="middle">${labels[i]}</text>`;
  });
  if (target != null) s += `<line class="t" x1="${pad}" x2="${W}" y1="${H - (target / m) * (H - 10)}" y2="${H - (target / m) * (H - 10)}"/>`;
  s += `<text x="0" y="12">${m}${unit}</text></svg>`;
  return h('div', { html: s });
}

function chartLine(points, labels, { target = null } = {}) {
  const W = 340, H = 140, pad = 24;
  const xs = (i) => pad + (i * (W - pad - 6)) / Math.max(1, points.length - 1);
  const ys = (v) => H - v * (H - 10);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H + 20}" role="img"><line class="g" x1="${pad}" y1="${H}" x2="${W}" y2="${H}"/>`;
  if (target != null) s += `<line class="t" x1="${pad}" x2="${W}" y1="${ys(target)}" y2="${ys(target)}"/><text x="0" y="${ys(target) + 4}">${pct(target)}%</text>`;
  const pts = points.map((v, i) => (v == null ? null : `${xs(i)},${ys(v)}`)).filter(Boolean);
  if (pts.length > 1) s += `<polyline class="l" points="${pts.join(' ')}"/>`;
  points.forEach((v, i) => { if (v != null) s += `<circle cx="${xs(i)}" cy="${ys(v)}" r="3" fill="var(--accent)"><title>${labels[i]} ${pct(v)}%</title></circle>`; });
  labels.forEach((l, i) => { if (i % Math.ceil(labels.length / 6) === 0) s += `<text x="${xs(i)}" y="${H + 14}" text-anchor="middle">${l}</text>`; });
  return h('div', { html: s + '</svg>' });
}

function recordsView(ctx, page) {
  const { content } = ctx;
  const s = ctx.state();
  page.title = '学習記録';
  const today = dayKey();
  const keys = [...Array(14)].map((_, i) => addDays(today, i - 13));
  const lab = keys.map((k) => k.slice(5).replace('-', '/'));
  const mins = keys.map((k) => Math.round((s.days[k]?.sec || 0) / 60));
  const ans = keys.map((k) => s.days[k]?.n || 0);
  const accs = keys.map((k) => (s.days[k]?.n ? s.days[k].c / s.days[k].n : null));
  const totalSec = Object.values(s.days).reduce((a, d) => a + (d.sec || 0), 0);
  const totalN = Object.values(s.days).reduce((a, d) => a + (d.n || 0), 0);
  const totalC = Object.values(s.days).reduce((a, d) => a + (d.c || 0), 0);
  const { target } = targets(content.config);
  const comp = evaluateCompletion(s, content);
  const subjAcc = content.subjects.map((sub) => {
    let n = 0, c = 0;
    for (const q of content.questions) if (q.subject === sub.id && s.q[q.questionId]) { n += s.q[q.questionId].n; c += s.q[q.questionId].c; }
    return { sub, n, c };
  });
  const hist = Object.entries(s.days).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 30);
  page.body = h('div',
    h('div.grid2',
      h('div.card.center', h('div.muted.small', '累計学習時間'), h('b', fmtDuration(totalSec))),
      h('div.card.center', h('div.muted.small', '連続学習日数'), h('b', `${streak(s)}日`)),
      h('div.card.center', h('div.muted.small', '累計回答数'), h('b', `${totalN}問`)),
      h('div.card.center', h('div.muted.small', '全体の正答率'), h('b', `${pct(rate(totalC, totalN))}%`))),
    h('div.card', h('h2', '日別の学習時間（分・14日）'), chartBars(mins, lab, { unit: '分' })),
    h('div.card', h('h2', '日別の回答数（14日）'), chartBars(ans, lab, { unit: '問' })),
    h('div.card', h('h2', '正答率の推移（日別）'), chartLine(accs, lab, { target }), h('p.small.muted', '赤い点線は学習目標。演習には基礎問題も含むため、模試の正答率とは別の指標です。')),
    h('div.card', h('h2', '科目別の正答率（全回答）'), subjAcc.map((x) => h('div.subj', h('div.subj-head', h('b', x.sub.short), h('span.small', `${x.c}/${x.n}　${pct(rate(x.c, x.n))}%`)), bar(rate(x.c, x.n), { target })))),
    h('div.card', h('h2', '模擬試験'), s.mocks.length ? s.mocks.slice(-5).reverse().map((m) => h('a.menu-item', { href: '#/mock/result/' + m.id, style: { marginBottom: '6px' } }, h('span.ico', '📝'), h('div', h('b', `${m.c}/${m.n}（${pct(m.c / m.n)}%）`), h('span.muted', new Date(m.t).toLocaleString())))) : h('p.muted', 'まだ受けていません'), h('a.btn.sm', { href: '#/mock/history' }, 'すべての履歴')),
    h('div.card', h('h2', '学習終了条件'), h('p', `${comp.conds.filter((c) => c.ok).length} / ${comp.conds.length} 条件を達成`), h('a.btn.sm', { href: '#/progress' }, '詳しく見る')),
    h('div.card', h('h2', '学習履歴（日別）'), hist.length ? h('div.tbl-wrap', h('table', h('thead', h('tr', h('th', '日付'), h('th', '時間'), h('th', '回答'), h('th', '正答率'))), h('tbody', hist.map(([k, d]) => h('tr', h('td', k), h('td', fmtDuration(d.sec || 0)), h('td', d.n), h('td', d.n ? pct(d.c / d.n) + '%' : '—')))))) : h('p.muted', 'まだ記録がありません')));
}

// ---------- 設定・データ ----------

function settingsView(ctx, page) {
  const { store, content, app } = ctx;
  const s = ctx.state();
  page.title = '設定・データ管理';
  const set = (k, v) => store.update((st) => { st.settings[k] = v; });
  const doExport = () => {
    store.saveNow();
    const blob = new Blob([exportBackup(ctx.state(), { app: app.id, dataVersion: content.config.dataVersion })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `otsu6-${app.id}-backup-${dayKey()}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('バックアップを保存しました');
  };
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const text = await f.text();
    const v = validateBackup(text, app.id, new Set(content.byId.keys()));
    if (!v.ok) { await confirmBox('取り込めませんでした。\n' + v.errors.join('\n'), { ok: '閉じる', cancel: '戻る' }); return; }
    const ok = await confirmBox(`このバックアップで今の学習記録を置き換えます。\n回答記録 ${Object.keys(v.state.q || {}).length}問・模試 ${(v.state.mocks || []).length}回${v.warnings.length ? '\n\n注意：' + v.warnings.join('\n') : ''}`, { ok: '置き換える', danger: true });
    if (!ok) return;
    store.replace(v.state);
    toast('取り込みました'); ctx.render();
  } });
  const reset = async () => {
    if (!(await confirmBox('すべての学習記録（回答・模試・お気に入り・設定）を消去します。元に戻せません。先にバックアップを保存することをおすすめします。', { ok: '消去に進む', danger: true }))) return;
    if (!(await confirmBox('本当に消去しますか？', { ok: '消去する', danger: true }))) return;
    store.reset(); toast('初期化しました'); ctx.go('#/');
  };
  page.body = h('div',
    h('div.card', h('h2', '学習の設定'),
      h('label.field', h('span', '1日に使える学習時間'), h('select', { onchange: (e) => set('dailyMinutes', Number(e.target.value)) }, [10, 15, 30, 45, 60, 90, 120].map((m) => h('option', { value: m, selected: s.settings.dailyMinutes === m }, m + '分')))),
      h('label.field', h('span', '試験日（任意。ペース配分に使います）'), h('input', { type: 'date', value: s.settings.examDate || '', onchange: (e) => set('examDate', e.target.value) })),
      h('label.toggle', h('span', content.config.exam.exemption.label), h('input', { type: 'checkbox', checked: s.settings.exempt, onchange: (e) => set('exempt', e.target.checked) })),
      h('p.small.muted', 'オンにすると、模擬試験と学習終了判定が「性質・消火 10問・35分」の形式になります。')),
    h('div.card', h('h2', '見やすさ'),
      h('label.toggle', h('span', '動きを減らす（アニメは静止画で表示）'), h('input', { type: 'checkbox', checked: s.settings.reduceMotion, onchange: (e) => set('reduceMotion', e.target.checked) })),
      h('label.toggle', h('span', 'アニメの説明文を表示'), h('input', { type: 'checkbox', checked: s.settings.captions, onchange: (e) => set('captions', e.target.checked) })),
      h('label.field', h('span', '文字の大きさ'), h('div.chips', [[0.9, '小'], [1, '標準'], [1.12, '大'], [1.25, '特大']].map(([v, l]) => h('button.chip' + (s.settings.fontScale === v ? '.on' : ''), { onclick: () => { set('fontScale', v); ctx.render(); } }, l))))),
    h('div.card', h('h2', '学習データのバックアップ'),
      h('p.small', '学習記録はこの端末のブラウザの中だけに保存され、外部には送信していません。ブラウザの履歴・Webサイトデータを消去したり、iPhoneで長期間開かなかったりすると、記録が消えることがあります。定期的にバックアップを保存してください。ホーム画面に追加して使うと消えにくくなります。'),
      h('div.stack',
        h('button.btn.primary.block', { onclick: doExport }, 'バックアップを保存（JSON）'),
        h('button.btn.block', { onclick: () => fileIn.click() }, 'バックアップから復元'), fileIn,
        h('button.btn.block.danger', { onclick: reset }, '学習データを初期化'))),
    h('a.btn.block', { href: '#/about' }, 'このアプリについて・出典'));
}

function aboutView(ctx, page) {
  const { content } = ctx;
  const c = content.counts;
  const ex = content.config.exam;
  page.title = 'このアプリについて';
  page.body = h('div',
    h('div.card', h('h2', ctx.app.name), h('p', ctx.app.about),
      h('p.small', h('a', { href: '../' }, '学習パターンを選び直す（合格特化型／完全学習型）'))),
    h('div.card', h('h2', '試験の情報（確認日 ' + content.config.checkedDate + '）'),
      h('dl.kv', h('dt', '試験'), h('dd', ex.name), h('dt', '形式'), h('dd', ex.format), h('dt', '時間'), h('dd', ex.timeMinutes + '分'),
        ex.subjects.map((s) => [h('dt', s.short), h('dd', s.questions + '問')]),
        h('dt', '合格基準'), h('dd', `科目ごとに${pct(ex.passRate)}%以上`), h('dt', '学習目標'), h('dd', `科目ごとに${pct(ex.passRate + ex.targetBonus)}%以上（本アプリの設定）`)),
      h('p.small.muted', '出典：', ex.sources.map((s, i) => [i ? '／' : '', h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name)])),
      h('p.small.muted', ex.passRateNote)),
    h('div.card', h('h2', '問題データの収録状況'),
      h('dl.kv',
        h('dt', '実際の過去問'), h('dd', `${c.past}問`),
        h('dt', '独自作成の類題'), h('dd', `${c.similar}問`),
        h('dt', '基礎の学習問題'), h('dd', `${c.basic}問`),
        h('dt', '模擬試験用'), h('dd', `${c.mock}問`),
        h('dt', '合計'), h('dd', `${c.total}問`)),
      h('p.small', `実際の過去問について：${ex.pastExam.reason}`),
      h('p.small.muted', `${ex.pastExam.name}：${ex.pastExam.url}（${ex.pastExam.terms} 確認日 ${ex.pastExam.checkedDate}）`),
      h('p.small.muted', '独自作成の問題は、作成時に正解・解説・選択肢の整合を自動検査し、内容を確認していますが、危険物の専門家による監修は受けていません。誤りに気づいた場合はお知らせください。')),
    h('div.card', h('h2', 'ご注意'),
      h('ul.keypoints',
        h('li', '本アプリの「学習目標の達成」は、本試験の合格や合格率を保証するものではありません。'),
        h('li', '法令は改正されることがあります。受験前に最新の公式情報をご確認ください。'),
        h('li', 'アニメ教材は理解のための模式図です。実物での実験や消火の再現はしないでください。'),
        h('li', '学習記録はこの端末内にのみ保存されます。'))));
}

export const sharedRoutes = {
  units: unitsView, unit: unitView, practice: practiceView, review: reviewView, retest: retestView, diag: diagView,
  anims: animsView, anim: animView, substances: substancesView, mock: mockRoute,
  progress: progressView, weak: weakView, causes: causesView, records: recordsView, settings: settingsView, about: aboutView,
};
