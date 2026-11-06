// 模擬試験：設定 → 受験（制限時間・見直し・未回答確認）→ 自動採点 → 結果・復習セット
import { h, confirmBox, bar, toast } from './dom.js';
import { buildMock, finalizeMock, scoreMock } from '../core/exam.js';
import { recordAnswer } from '../core/engine.js';
import { targets } from '../core/completion.js';
import { TYPE_SHORT } from '../core/content.js';
import { pct, fmtClock, fmtDuration } from '../core/util.js';
import { sourceLine, typeBadge } from './quiz.js';

const NUM = ['①', '②', '③', '④', '⑤', '⑥'];

export function mockRoute(ctx, page, args, query) {
  const s = ctx.state();
  if (args[0] === 'result') return resultView(ctx, page, args[1]);
  if (args[0] === 'history') return historyView(ctx, page);
  if (s.activeMock) return runView(ctx, page);
  return setupView(ctx, page, query);
}

function setupView(ctx, page, query) {
  const { content, store } = ctx;
  const exam = content.config.exam;
  const st = ctx.state();
  const { pass, target } = targets(content.config);
  page.title = '模擬試験';
  let kind = query.kind || (st.settings.exempt ? 'exempt' : 'full');
  let subject = query.subject || 'law';
  const body = h('div');
  const draw = () => {
    const subs = exam.subjects;
    const n = kind === 'full' ? subs.reduce((a, x) => a + x.questions, 0) : kind === 'exempt' ? 10 : subs.find((x) => x.id === subject).questions;
    body.replaceChildren(
      h('div.card',
        h('h2', '形式を選ぶ'),
        h('div.chips',
          h('button.chip' + (kind === 'full' ? '.on' : ''), { onclick: () => { kind = 'full'; draw(); } }, '本番形式（3科目）'),
          h('button.chip' + (kind === 'subject' ? '.on' : ''), { onclick: () => { kind = 'subject'; draw(); } }, '科目別'),
          h('button.chip' + (kind === 'exempt' ? '.on' : ''), { onclick: () => { kind = 'exempt'; draw(); } }, '科目免除者用')),
        kind === 'subject' ? h('div.chips', { style: { marginTop: '10px' } }, subs.map((x) => h('button.chip' + (subject === x.id ? '.on' : ''), { onclick: () => { subject = x.id; draw(); } }, x.short))) : null,
        h('dl.kv', { style: { marginTop: '12px' } },
          h('dt', '問題数'), h('dd', `${n}問（五肢択一）`),
          h('dt', '制限時間'), h('dd', kind === 'full' ? `${exam.timeMinutes}分` : kind === 'exempt' ? `${exam.exemption.timeMinutes}分` : `${Math.round(exam.timeMinutes * n / 35)}分（本番の配分に比例）`),
          h('dt', '合格基準'), h('dd', `各科目 ${pct(pass)}%以上（公式）`),
          h('dt', '学習目標'), h('dd', `各科目 ${pct(target)}%以上`)),
        h('p.small.muted', kind === 'full' ? '学習終了判定に数えるのはこの形式です（科目免除の設定時は「科目免除者用」）。' : kind === 'exempt' ? '乙種の免状をお持ちの方の形式（性質・消火10問・35分）。設定で科目免除をオンにすると終了判定に数えます。' : '科目別模試は弱点確認用です。学習終了判定には本番形式の結果を使います。'),
        h('div.disclaimer', '出題はすべて本アプリの独自作成問題（模試専用問題と類題）です。実際の過去問はアプリに収録していません（公式サイトのPDFを各自で取り込むと、下の「公式の過去問」で解けます）。本番と同じ問題数・時間・科目構成・5択で、単元の重要度に応じて配分し、前回の模試で使った問題はできるだけ避けます。'),
        h('button.btn.primary.block', { style: { marginTop: '12px' }, onclick: start }, '開始する')),
      h('a.btn.block', { href: '#/mock/history' }, '模擬試験の履歴'),
      h('a.menu-item', { href: '#/past', style: { marginTop: '12px' } }, h('span.ico', '📄'), h('div', h('b', '公式の過去問（自分で取り込む）'), h('span.muted', '公式サイトのPDFをこの端末に読み込んで、本番形式で解く'))));
  };
  const start = () => {
    const mock = buildMock(ctx.state(), content, { kind, subject });
    if (mock.warnings.length) toast(mock.warnings.join(' '), 4000);
    store.update((s) => { s.activeMock = mock; s.resume = { route: '#/mock', label: '模擬試験の続き', t: Date.now() }; });
    store.saveNow();
    ctx.render();
  };
  draw();
  page.body = body;
}

function runView(ctx, page) {
  const { content, store } = ctx;
  const mock = ctx.state().activeMock;
  page.fullscreen = true;
  let cur = mock.cur || 0;
  const endAt = mock.startedAt + mock.minutes * 60000;
  const timerEl = h('span.timer');
  const wrap = h('div');
  const top = h('div.exam-top', h('button.btn.sm.ghost', { onclick: () => openPalette() }, '一覧'), timerEl, h('button.btn.sm.primary', { onclick: () => submit(false) }, '提出'));
  page.body = h('div', top, h('main', { style: { paddingBottom: '40px' } }, wrap));

  const tick = () => {
    const left = Math.round((endAt - Date.now()) / 1000);
    timerEl.textContent = '残り ' + fmtClock(left);
    timerEl.classList.toggle('low', left < 300);
    if (left <= 0) { clearInterval(iv); submit(true); }
  };
  const iv = setInterval(tick, 1000);
  page.onLeave = () => clearInterval(iv);
  tick();

  const save = () => store.update((s) => { if (s.activeMock) { s.activeMock.answers = mock.answers; s.activeMock.flags = mock.flags; s.activeMock.cur = cur; } });

  const show = () => {
    const id = mock.qids[cur];
    const q = content.byId.get(id);
    const order = mock.choiceOrder[id];
    const subj = content.subjects.find((s) => s.id === q.subject);
    wrap.replaceChildren(h('div.card',
      h('div.row', { style: { justifyContent: 'space-between' } }, h('span.muted.small', `問${cur + 1} / ${mock.qids.length}　${subj.short}`),
        h('button.btn.sm' + (mock.flags[id] ? '.primary' : '.ghost'), { onclick: () => { mock.flags[id] = !mock.flags[id]; save(); show(); } }, mock.flags[id] ? '⚑ 見直し印あり' : '⚐ 後で見直す')),
      h('p.qtext', q.questionText),
      h('div.choices', order.map((o, k) => h('button.choice' + (mock.answers[id] === o ? '.sel' : ''), { onclick: () => { mock.answers[id] = o; save(); show(); } }, h('span.num', NUM[k]), h('span', q.choices[o])))),
      h('div.grid2', { style: { marginTop: '14px' } },
        h('button.btn', { disabled: cur === 0, onclick: () => { cur--; save(); show(); } }, '‹ 前へ'),
        cur + 1 < mock.qids.length ? h('button.btn.primary', { onclick: () => { cur++; save(); show(); } }, '次へ ›') : h('button.btn.primary', { onclick: () => openPalette() }, '見直し一覧へ'))),
    h('p.small.muted.center', `回答済み ${Object.keys(mock.answers).length} / ${mock.qids.length}`));
    window.scrollTo(0, 0);
  };

  function openPalette() {
    const unanswered = mock.qids.filter((id) => mock.answers[id] == null).length;
    const flagged = mock.qids.filter((id) => mock.flags[id]).length;
    const grid = h('div.palette');
    let lastSubj = null;
    mock.qids.forEach((id, k) => {
      const q = content.byId.get(id);
      if (q.subject !== lastSubj) { lastSubj = q.subject; grid.append(h('div.subject-sep', content.subjects.find((s) => s.id === q.subject).short)); }
      grid.append(h('button' + (mock.answers[id] != null ? '.ans' : '') + (mock.flags[id] ? '.flag' : '') + (k === cur ? '.cur' : ''), { 'aria-label': `問${k + 1}${mock.answers[id] != null ? ' 回答済み' : ' 未回答'}${mock.flags[id] ? ' 見直し印' : ''}`, onclick: () => { cur = k; save(); m.remove(); show(); } }, k + 1));
    });
    const m = h('div.modal', h('div.modal-box',
      h('h2', '回答状況'),
      h('p.small', `未回答 ${unanswered}問　見直し印 ${flagged}問`),
      grid,
      h('div.row.end', { style: { marginTop: '14px' } },
        unanswered ? h('button.btn.sm', { onclick: () => { cur = mock.qids.findIndex((id) => mock.answers[id] == null); save(); m.remove(); show(); } }, '未回答へ') : null,
        h('button.btn.sm.ghost', { onclick: () => m.remove() }, '閉じる'),
        h('button.btn.sm.primary', { onclick: () => { m.remove(); submit(false); } }, '提出する'))));
    document.body.append(m);
  }

  async function submit(timeUp) {
    if (!timeUp) {
      const un = mock.qids.filter((id) => mock.answers[id] == null).length;
      const ok = await confirmBox(un ? `未回答が ${un}問あります（未回答は不正解になります）。提出しますか？` : '提出して採点します。よろしいですか？', { ok: '提出する' });
      if (!ok) return;
    }
    clearInterval(iv);
    const now = Date.now();
    const rec = finalizeMock(content, mock, now);
    store.update((s) => {
      for (const id of mock.qids) {
        const a = mock.answers[id];
        // 未回答は記録しない（間違い扱いで採点はするが、知識の記録にはしない）
        if (a != null) recordAnswer(s, content.byId.get(id), a, 'mock', now, 0);
      }
      s.mocks.push(rec);
      s.activeMock = null;
      s.resume = null;
      if (timeUp) s.lastMockTimeUp = rec.id;
    });
    store.saveNow();
    if (timeUp) toast('時間になったため自動で提出しました', 3500);
    ctx.go('#/mock/result/' + rec.id);
  }

  show();
}

function resultView(ctx, page, id) {
  const { content, store } = ctx;
  const rec = ctx.state().mocks.find((m) => m.id === id);
  page.title = '模擬試験の結果';
  if (!rec) { page.body = h('div.card', '結果が見つかりません'); return; }
  const r = scoreMock(content, rec);
  const { pass, target } = targets(content.config);
  const kindLabel = { full: '本番形式', subject: '科目別', exempt: '科目免除者用' }[rec.kind];
  const review = () => { store.update((s) => { s.reviewSet = { qids: r.wrong, label: `模試（${new Date(rec.t).toLocaleDateString()}）の間違い`, t: Date.now() }; }); ctx.go('#/review?set=1'); };
  page.body = h('div',
    h('div.card',
      h('h2', `${kindLabel}　${r.c} / ${r.n}（${pct(r.rate)}%）`),
      h('p.muted.small', `${new Date(rec.t).toLocaleString()}　所要 ${fmtDuration(rec.durationSec)} / 制限 ${rec.minutes}分`),
      r.subjects.map((s) => h('div.subj',
        h('div.subj-head', h('b', s.short), h('span', `${s.c}/${s.n}　${pct(s.rate)}%`)),
        bar(s.rate, { target, cls: s.target ? 'ok' : s.pass ? '' : 'ng', label: s.short }),
        h('div.small', s.target ? h('span', { style: { color: 'var(--ok)' } }, `学習目標（${pct(target)}%）に到達`) : s.pass ? h('span', `合格基準（${pct(pass)}%）は超えています。目標まであと${Math.ceil((target - s.rate) * 100 - 1e-9)}ポイント`) : h('span', { style: { color: 'var(--ng)' } }, `合格基準（${pct(pass)}%）に届いていません`)))),
      h('p.small.muted', '※ 学習目標の達成は本試験の合格を保証するものではありません。'),
      r.wrong.length ? h('button.btn.primary.block', { onclick: review }, `間違えた ${r.wrong.length}問の復習セットを作る`) : h('div.done-banner.pop', '全問正解です')),
    h('div.card', h('h2', '問題ごとの解説'),
      rec.qids.map((qid, k) => {
        const q = content.byId.get(qid);
        const a = rec.answers[qid];
        const ok = a === q.correctAnswer;
        return h('details', { class: 'subj' },
          h('summary', h('span', { style: { color: ok ? 'var(--ok)' : 'var(--ng)', marginRight: '8px' } }, ok ? '◯' : '×'), `問${k + 1}　${q.questionText.slice(0, 34)}…`),
          h('div.badges', typeBadge(q)),
          h('p.qtext', q.questionText),
          h('ul.cexp', q.choices.map((c, o) => h('li' + (o === q.correctAnswer ? '.right' : o === a ? '.picked' : ''), h('b', (o === q.correctAnswer ? '正解 ' : o === a ? 'あなた ' : '') ), c, h('div.muted.small', q.choiceExplanations?.[o] || '')))),
          a == null ? h('p.small', { style: { color: 'var(--ng)' } }, '未回答') : null,
          h('div.explain', q.explanation),
          q.animationId ? h('a.btn.sm', { href: `#/anim/${q.animationId}`, style: { marginTop: '8px' } }, '▶ アニメで確認') : null,
          sourceLine(q));
      })),
    h('a.btn.block', { href: '#/progress' }, '学習終了条件を確認'));
}

function historyView(ctx, page) {
  const { content } = ctx;
  const { target } = targets(content.config);
  page.title = '模擬試験の履歴';
  const ms = ctx.state().mocks.slice().reverse();
  page.body = h('div',
    ms.length ? null : h('div.card.muted', 'まだ受けていません。'),
    ms.map((m) => {
      const subs = Object.entries(m.perSubject);
      return h('a.menu-item', { href: '#/mock/result/' + m.id },
        h('span.ico', '📝'),
        h('div', h('b', `${{ full: '本番形式', subject: '科目別', exempt: '免除者用' }[m.kind]}　${m.c}/${m.n}`),
          h('span.muted', `${new Date(m.t).toLocaleString()}　` + subs.map(([k, v]) => `${content.subjects.find((s) => s.id === k).short} ${pct(v.c / v.n)}%${v.c / v.n >= target - 1e-9 ? '✓' : ''}`).join(' / '))));
    }),
    h('a.btn.block.primary', { href: '#/mock' }, '模擬試験を受ける'));
}

export { TYPE_SHORT };
