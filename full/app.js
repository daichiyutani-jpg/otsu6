// 完全学習型：基礎講義 → 図解・アニメ → 重要事項 → 基礎 → 標準 → 過去問(類題) → 応用 → 原因分析 → 再学習 → 模試
import { startApp } from '../shared/ui/shell.js';
import { homeView, planView } from '../shared/ui/home.js';
import { fullCurriculum, unitStages } from '../shared/core/curriculum.js';
import { unitMastery } from '../shared/core/engine.js';
import { h, bar, stars } from '../shared/ui/dom.js';
import { pct } from '../shared/core/util.js';

function stageCard(ctx, u) {
  const st = unitStages(ctx.state(), ctx.content, u.id);
  const nextStage = st.find((x) => !x.done && !x.skip);
  const link = (x) => x.id === 'lecture' ? `#/unit/${encodeURIComponent(u.id)}?mode=lecture`
    : x.id === 'key' ? `#/unit/${encodeURIComponent(u.id)}?mode=key`
    : x.id === 'anim' ? `#/anim/${u.animationIds[0]}`
    : `#/practice?unit=${encodeURIComponent(u.id)}&level=${x.id}&go=1&limit=10`;
  return h('div.card',
    h('h2', 'この単元の学習段階'),
    st.filter((x) => !x.skip).map((x) => h('a.check' + (x.done ? '.ok' : ''), { href: link(x), style: { textDecoration: 'none', color: 'inherit' } },
      h('span.ck', x.done ? '✓' : ''),
      h('div', h('div', x.title + (x === nextStage ? '　← 次はここ' : '')),
        x.total != null ? h('div.small.muted', x.total ? `解いた ${pct(x.share)}%・正答 ${pct(x.acc)}%（80%以上で完了）` : 'この段階の問題はありません') : null))),
    h('p.small.muted', '理解があいまいなときは、講義とアニメに何度でも戻れます。'));
}

function courseView(ctx, page) {
  const { content } = ctx;
  const s = ctx.state();
  page.title = '体系カリキュラム';
  page.body = h('div',
    h('p.small.muted', '3科目を単元ごとに、講義 → 図解・アニメ → 重要事項 → 基礎 → 標準 → 応用 の順で学びます。'),
    h('a.btn.block', { href: '#/plan', style: { marginBottom: '12px' } }, '全体の学習順序（13段階）を見る'),
    content.subjects.map((sub) => h('div.card',
      h('h2', sub.name),
      sub.units.map((u) => {
        const st = unitStages(s, content, u.id).filter((x) => !x.skip);
        const done = st.filter((x) => x.done).length;
        const m = unitMastery(s, content, u.id).mastery;
        return h('a.menu-item', { href: `#/unit/${encodeURIComponent(u.id)}?mode=lecture`, style: { marginBottom: '8px' } },
          h('span.ico', done === st.length ? '✅' : `${u.order}`),
          h('div', { style: { flex: 1 } }, h('b', u.title), h('span.muted', `段階 ${done}/${st.length}　習得度 ${pct(m)}%　重要度 ${stars(u.importance)}`), bar(done / st.length, { cls: done === st.length ? 'ok' : '' })));
      }))));
}

startApp({
  id: 'full',
  name: '乙六 完全学習型',
  short: '完全学習',
  about: '初めて学ぶ人が基礎から理解して合格を目指すための学習パターンです。単元ごとに基礎講義・図解とアニメーション・重要事項の整理を行い、基礎→標準→応用と段階的に演習します。間違えた原因を分析し、苦手分野を再学習してから模擬試験に進みます。',
  nav: [
    { href: '#/', ico: '🏠', label: 'ホーム', match: ['home'] },
    { href: '#/course', ico: '📚', label: '講義', match: ['course', 'units', 'unit', 'substances', 'plan'] },
    { href: '#/anims', ico: '🎞', label: 'アニメ', match: ['anims', 'anim'] },
    { href: '#/practice', ico: '✏', label: '演習', match: ['practice', 'review', 'retest', 'weak', 'causes', 'diag'] },
    { href: '#/mock', ico: '📝', label: '模試', match: ['mock', 'progress'] },
  ],
  unitExtra: stageCard,
  routes: {
    home: (ctx, page) => homeView(ctx, page, {
      curriculum: fullCurriculum,
      intro: '完全学習型は、単元ごとに基礎講義→図解・アニメ→重要事項→基礎問題→標準問題→類題（過去問テーマ）→応用問題と進み、間違いの原因を分析してから模擬試験に挑みます。',
      extraMenu: [
        h('a.menu-item', { href: '#/course' }, h('span.ico', '📚'), h('div', h('b', '体系カリキュラム'), h('span.muted', '単元ごとの講義と段階別の演習'))),
        h('a.menu-item', { href: '#/plan' }, h('span.ico', '🧭'), h('div', h('b', '学習の順序（13段階）'), h('span.muted', '今どこにいるかを確認'))),
        h('a.menu-item', { href: '#/causes' }, h('span.ico', '🔍'), h('div', h('b', '間違いの原因分析'), h('span.muted', 'なぜ間違えたかと対策'))),
        h('a.menu-item', { href: '#/substances' }, h('span.ico', '🧪'), h('div', h('b', '第6類 物質の比較'), h('span.muted', '性質・貯蔵・消火の違い'))),
      ],
    }),
    plan: (ctx, page) => planView(ctx, page, fullCurriculum, '完全学習型の学習順序'),
    course: courseView,
  },
});
