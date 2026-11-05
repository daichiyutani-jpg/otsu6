// 一問一答・演習・復習・再テスト・確認問題の共通画面
import { h, stars, toast } from './dom.js';
import { recordAnswer, recordRetest, choiceOrder } from '../core/engine.js';
import { TYPE_LABEL, TYPE_SHORT, LEVEL_LABEL } from '../core/content.js';
import { inferCause, addCause, CAUSES } from '../core/analysis.js';
import { shuffle, pct } from '../core/util.js';

const NUM = ['①', '②', '③', '④', '⑤', '⑥'];

export function typeBadge(q) {
  return h('span.badge.' + q.questionType, { title: TYPE_LABEL[q.questionType] }, TYPE_LABEL[q.questionType]);
}

export function sourceLine(q) {
  if (q.questionType === 'past') {
    return h('div.source', `出典：${q.sourceName}${q.examYear ? '（' + q.examYear + '）' : ''}　確認日 ${q.lastVerifiedDate || '—'}　`, q.sourceUrl ? h('a', { href: q.sourceUrl, target: '_blank', rel: 'noopener' }, '出典サイト（要通信）') : null);
  }
  return h('div.source', `${TYPE_LABEL[q.questionType]}：${q.sourceName}。実際の試験問題ではありません。最終確認 ${q.lastVerifiedDate || '—'}（${q.sourceVerificationStatus === 'original' ? '作成者による確認のみ・専門家の監修前' : q.sourceVerificationStatus}）`);
}

/**
 * opts: {title, qids, ctxName:'drill'|'review'|'retest'|'check'|'diag', onDone(results, ui), intro, retestUnits}
 */
export function quizView(ctx, page, opts) {
  const { content, store } = ctx;
  const qs = opts.qids.map((id) => content.byId.get(id)).filter(Boolean);
  page.title = opts.title || '問題演習';
  const wrap = h('div');
  page.body = wrap;
  if (!qs.length) {
    wrap.append(h('div.card', h('h2', '出題できる問題がありません'), h('p.muted', opts.emptyText || '条件を変えてみてください。'), h('a.btn', { href: '#/practice' }, '条件を選び直す')));
    return;
  }
  const results = [];
  let i = 0;
  let shownAt = Date.now();
  ctx.setResume?.(page.title);

  const show = () => {
    const q = qs[i];
    const order = choiceOrder(q);
    shownAt = Date.now();
    let answered = false;
    const fav = () => !!store.get().fav[q.questionId];
    const unit = content.unitById.get(q.topic);
    const favBtn = h('button.btn.sm.ghost', { 'aria-pressed': String(fav()), onclick: () => {
      store.update((s) => { if (s.fav[q.questionId]) delete s.fav[q.questionId]; else s.fav[q.questionId] = Date.now(); });
      favBtn.textContent = fav() ? '★ お気に入り' : '☆ お気に入り';
      favBtn.setAttribute('aria-pressed', String(fav()));
    } }, fav() ? '★ お気に入り' : '☆ お気に入り');

    const choiceBtns = order.map((orig, k) => h('button.choice', { type: 'button', onclick: () => answer(orig, k) }, h('span.num', NUM[k]), h('span', q.choices[orig])));
    const after = h('div');
    const card = h('div.card',
      h('div.row', { style: { justifyContent: 'space-between' } }, h('span.muted.small', `${i + 1} / ${qs.length}`), favBtn),
      h('div.badges', typeBadge(q), h('span.badge.fill', content.subjects.find((s) => s.id === q.subject)?.short),
        unit ? h('span.badge.fill', unit.title) : null,
        h('span.badge.fill', `難易度 ${stars(q.difficulty)}`), h('span.badge.fill', `重要度 ${stars(q.importance)}`),
        q.level ? h('span.badge.fill', LEVEL_LABEL[q.level]) : null),
      h('p.qtext', q.questionText),
      h('div.choices', { role: 'group', 'aria-label': '選択肢' }, choiceBtns),
      after);
    wrap.replaceChildren(opts.intro && i === 0 ? h('div.card.muted.small', opts.intro) : '', card);

    function answer(orig, k) {
      if (answered) return;
      answered = true;
      const sec = (Date.now() - shownAt) / 1000;
      let ok;
      store.update((s) => { ok = recordAnswer(s, q, orig, opts.ctxName || 'drill', Date.now(), sec).ok; });
      results.push({ qid: q.questionId, ok, chosen: orig });
      choiceBtns.forEach((b, kk) => {
        b.disabled = true;
        if (order[kk] === q.correctAnswer) b.classList.add('right');
        else if (kk === k) b.classList.add('wrong');
      });
      const cause = ok ? null : inferCause(q, orig);
      after.append(
        h('div.result.' + (ok ? 'ok' : 'ng'), { role: 'status' }, h('span.mark.pop', ok ? '◯' : '×'), ok ? '正解' : `不正解　正解は ${NUM[order.indexOf(q.correctAnswer)]}`),
        h('div.explain', h('p', h('b', '解説　'), q.explanation),
          h('ul.cexp', order.map((o, kk) => h('li' + (o === q.correctAnswer ? '.right' : kk === k ? '.picked' : ''), h('b', `${NUM[kk]} ${o === q.correctAnswer ? '正' : '誤'}　`), q.choiceExplanations?.[o] || '')))),
        !ok ? causeBox(q, orig, cause) : null,
        h('div.row', { style: { marginTop: '10px' } },
          q.animationId ? h('a.btn.sm', { href: `#/anim/${q.animationId}` }, '▶ アニメで確認') : null,
          unit ? h('a.btn.sm', { href: `#/unit/${encodeURIComponent(unit.id)}` }, '📖 単元の教材') : null),
        sourceLine(q),
        h('div.sticky-next', h('button.btn.primary.block', { onclick: next }, i + 1 < qs.length ? '次の問題へ' : '結果を見る')));
      after.querySelector('.sticky-next button').focus({ preventScroll: true });
    }
  };

  function causeBox(q, orig, cause) {
    const box = h('div.cause');
    const confirm = (c, confirmed) => {
      store.update((s) => addCause(s, q.questionId, c, confirmed));
      box.replaceChildren(h('p.small', `記録しました：${CAUSES[c].label}。対策：${CAUSES[c].action}`),
        CAUSES[c].anim ? h('a.btn.sm', { href: `#/anim/${CAUSES[c].anim}` }, '▶ 教材を見る') : null);
    };
    const other = () => {
      box.replaceChildren(h('p.small', h('b', '原因に近いものを選んでください')),
        h('div.chips', Object.entries(CAUSES).map(([k, v]) => h('button.chip', { onclick: () => confirm(k, true) }, v.label))));
    };
    if (cause) {
      box.append(h('p.small', h('b', `考えられる原因（推測）：${CAUSES[cause].label}`)), h('p.small', CAUSES[cause].hint + ' 当てはまりますか？'),
        h('div.row', h('button.btn.sm', { onclick: () => confirm(cause, true) }, '当てはまる'), h('button.btn.sm.ghost', { onclick: other }, '別の原因')));
    } else other();
    return box;
  }

  function next() {
    if (i + 1 < qs.length) { i++; show(); return; }
    finish();
  }

  function finish() {
    const c = results.filter((r) => r.ok).length;
    if (opts.ctxName === 'retest') store.update((s) => recordRetest(s, results.map((r) => r.qid), results.map((r) => r.ok)));
    const wrongIds = results.filter((r) => !r.ok).map((r) => r.qid);
    const box = h('div.card.center',
      h('h2', '結果'),
      h('p', { style: { fontSize: '2rem', margin: '4px 0' }, class: 'pop' }, `${c} / ${results.length}`),
      h('p.muted', `正答率 ${pct(c / results.length)}%`),
      opts.onDone ? opts.onDone(results, { wrongIds }) : null,
      h('div.stack', { style: { marginTop: '14px' } },
        wrongIds.length ? h('button.btn.primary.block', { onclick: () => { store.update((s) => { s.reviewSet = { qids: wrongIds, label: '今回間違えた問題', t: Date.now() }; }); ctx.go('#/review?set=1'); } }, `間違えた ${wrongIds.length}問をもう一度`) : null,
        h('a.btn.block', { href: '#/' }, 'ホームへ')));
    const list = h('div.card', h('h2', '振り返り'), results.map((r) => {
      const q = content.byId.get(r.qid);
      return h('div.check' + (r.ok ? '.ok' : ''), h('span.ck', r.ok ? '✓' : '×'), h('div.small', h('div', q.questionText.slice(0, 70) + (q.questionText.length > 70 ? '…' : '')), h('span.muted', TYPE_SHORT[q.questionType])));
    }));
    wrap.replaceChildren(box, list);
    if (c === results.length && results.length >= 3) toast('全問正解です');
  }

  show();
}
