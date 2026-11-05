// ホーム画面とカリキュラム画面（2つのアプリで見せ方を変えられる共通部品）
import { h, bar } from './dom.js';
import { dailyGoal } from '../core/curriculum.js';
import { pendingImportantMistakes, reviewQueue } from '../core/engine.js';
import { pct } from '../core/util.js';

export function homeView(ctx, page, { curriculum, intro, extraMenu = [] }) {
  const { content, app } = ctx;
  const s = ctx.state();
  const cur = curriculum(s, content);
  const goal = dailyGoal(s, content, app.id);
  const comp = cur.comp;
  const startRoute = !s.diag ? '#/diag' : cur.current.route;
  const reviewN = reviewQueue(s, content, { limit: 99 }).length;
  const favN = Object.keys(s.fav).length;
  page.title = app.name;
  page.back = false;
  page.body = h('div',
    !s.diag ? h('div.card', h('h2', 'はじめに'), h('p', intro), h('p.small.muted', 'まず3科目の実力診断（15問）から始めます。')) : null,
    comp.done ? h('div.done-banner.pop', '設定した学習目標を達成しました') : null,
    h('div.menu',
      h('a.menu-item.hero', { href: startRoute }, h('span.ico', '▶'), h('div', h('b', s.diag ? `学習を進める：${cur.current.title}` : '学習を開始する（実力診断）'), h('span.muted', s.diag ? cur.current.desc : '3科目×5問で今の実力を確認'))),
      s.resume && s.resume.route !== '#/' ? h('a.menu-item', { href: s.resume.route }, h('span.ico', '⏯'), h('div', h('b', '前回の続きから'), h('span.muted', s.resume.label))) : null),
    h('div.card', { style: { marginTop: '12px' } },
      h('h2', '今日の学習目標'),
      h('div.subj-head', h('span', `回答 ${goal.doneQ} / ${goal.qTarget}問`), h('span.small.muted', `学習 ${goal.doneMin} / ${goal.minutes}分`)),
      bar(goal.doneQ / goal.qTarget, { cls: goal.doneQ >= goal.qTarget ? 'ok' : '' }),
      goal.paceNote ? h('p.small', goal.paceNote) : h('p.small.muted', '設定で試験日を入れると、必要なペースを表示します。'),
      h('a.small', { href: '#/settings' }, '1日の学習時間・試験日を変える')),
    h('div.card',
      h('h2', '科目別の習得度'),
      comp.subjects.map((x) => h('div.subj',
        h('div.subj-head', h('b', x.short + (x.exempt ? '（免除）' : '')), h('span.small', `習得度 ${pct(x.mastery)}%　模試 ${x.current == null ? '—' : pct(x.current) + '%'}`)),
        bar(x.mastery, { target: 0.8, cls: x.mastery >= 0.8 ? 'ok' : '' }))),
      h('p.small.muted', `合格基準 各${pct(comp.pass)}% ／ 学習目標 各${pct(comp.target)}%（縦線）`),
      h('a.btn.sm', { href: '#/progress' }, `学習終了条件 ${comp.conds.filter((c) => c.ok).length}/${comp.conds.length}`)),
    h('div.menu',
      h('a.menu-item', { href: '#/mock' }, h('span.ico', '📝'), h('div', h('b', '模擬試験を受ける'), h('span.muted', `本番と同じ35問・2時間（受験 ${s.mocks.length}回）`))),
      h('a.menu-item', { href: '#/practice?types=past,similar' }, h('span.ico', '🎯'), h('div', h('b', '過去問・類題に挑戦'), h('span.muted', `実際の過去問 ${content.counts.past}問／独自作成の類題 ${content.counts.similar}問`))),
      h('a.menu-item', { href: '#/review' }, h('span.ico', '🔁'), h('div', h('b', '間違えた問題を復習'), h('span.muted', `復習候補 ${reviewN}問（重要問題の未解決 ${pendingImportantMistakes(s, content).length}問）`))),
      h('a.menu-item', { href: '#/practice?status=fav&go=1&limit=50' }, h('span.ico', '★'), h('div', h('b', 'お気に入り問題を解く'), h('span.muted', `${favN}問`))),
      ...extraMenu,
      h('a.menu-item', { href: '#/records' }, h('span.ico', '📊'), h('div', h('b', '学習履歴を見る'), h('span.muted', '学習時間・正答率の推移・模試の結果'))),
      h('a.menu-item', { href: '#/settings' }, h('span.ico', '⚙'), h('div', h('b', '設定・バックアップ'), h('span.muted', '学習時間・科目免除・見やすさ・データの保存')))),
    h('p.disclaimer', { style: { marginTop: '14px' } }, '学習目標（各科目の合格基準＋20ポイント）の達成は、本試験の合格を保証するものではありません。問題はすべて本アプリの独自作成です（実際の過去問は利用条件により未収録）。'));
}

export function planView(ctx, page, curriculum, title) {
  const s = ctx.state();
  const cur = curriculum(s, ctx.content);
  page.title = title;
  page.body = h('div',
    h('p.small.muted', '上から順に進めるのが基本です。理解度に応じて、前の段階の教材にいつでも戻れます。'),
    cur.steps.map((st, i) => h('a.menu-item' + (st === cur.current ? '.hero' : ''), { href: st.route, style: { marginBottom: '8px' } },
      h('span.ico', st.progress >= 1 ? '✅' : String(i + 1)),
      h('div', { style: { flex: 1 } }, h('b', st.title), h('span.muted', st.desc), bar(st.progress, { cls: st.progress >= 1 ? 'ok' : '' })))));
}
