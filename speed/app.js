// 合格特化型：重要事項 → 一問一答 → 類題 → 間違い復習 → 模試、を短期間で回す
import { startApp } from '../shared/ui/shell.js';
import { homeView, planView } from '../shared/ui/home.js';
import { speedCurriculum } from '../shared/core/curriculum.js';
import { h } from '../shared/ui/dom.js';

startApp({
  id: 'speed',
  name: '乙六 合格特化型',
  short: '合格特化',
  about: '短期間で効率よく合格を目指す人向けです。重要事項を優先して学び、一問一答と本番レベルの類題を重点的に演習し、間違えた問題と苦手分野を集中的に復習します。効率を優先しても、試験範囲の全単元を必ず通ります。',
  nav: [
    { href: '#/', ico: '🏠', label: 'ホーム', match: ['home'] },
    { href: '#/plan', ico: '🧭', label: '進め方', match: ['plan', 'progress'] },
    { href: '#/units?mode=key', ico: '📖', label: '重要事項', match: ['units', 'unit', 'substances', 'anims', 'anim'] },
    { href: '#/practice', ico: '✏', label: '演習', match: ['practice', 'review', 'retest', 'weak', 'diag'] },
    { href: '#/mock', ico: '📝', label: '模試', match: ['mock'] },
  ],
  routes: {
    home: (ctx, page) => homeView(ctx, page, {
      curriculum: speedCurriculum,
      intro: '合格特化型は、重要事項→アニメで仕組みを確認→一問一答→類題演習→間違い復習→苦手補強→模試、の順で効率よく進めます。',
      extraMenu: [
        h('a.menu-item', { href: '#/units?mode=key' }, h('span.ico', '📖'), h('div', h('b', '重要事項を学ぶ'), h('span.muted', '全単元の試験ポイント'))),
        h('a.menu-item', { href: '#/practice?types=basic&go=1&limit=20&status=unanswered' }, h('span.ico', '⚡'), h('div', h('b', '一問一答（未回答から20問）'), h('span.muted', '基礎の4択で知識を固める'))),
        h('a.menu-item', { href: '#/weak' }, h('span.ico', '💪'), h('div', h('b', '苦手分野を克服'), h('span.muted', '習得度80%未満の単元'))),
      ],
    }),
    plan: (ctx, page) => planView(ctx, page, speedCurriculum, '合格特化型の進め方'),
  },
});
