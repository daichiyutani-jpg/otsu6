// 間違いの原因の分類と、原因ごとの「次に見る教材」
export const CAUSES = {
  term: { label: '用語の理解不足', hint: '言葉の意味があいまいなまま選んだ可能性があります。', action: '単元の重要事項・講義で用語を確認' },
  formula: { label: '化学式の暗記不足', hint: '化学式や反応式の取り違えの可能性があります。', action: '物質比較表で化学式を確認' },
  substance_mixup: { label: '物質ごとの性質の混同', hint: '別の物質の性質と取り違えた可能性があります。', action: '物質比較表で違いを確認' },
  extinguish_mixup: { label: '消火方法の混同', hint: '物質によって適切な消火方法が違う点を取り違えた可能性があります。', action: 'アニメ「第6類の消火方法」を見る', anim: 'class6-extinguish' },
  law_number: { label: '法令の数値の混同', hint: '期限・距離・倍数などの数値を取り違えた可能性があります。', action: '法令の重要事項で数値を確認' },
  law_procedure: { label: '手続き・届出先の混同', hint: '許可・届出・承認や、その相手先を取り違えた可能性があります。', action: '「許可・届出」の単元を確認' },
  calc: { label: '計算方法の理解不足', hint: '式の立て方や単位の扱いでつまずいた可能性があります。', action: '計算の手順（講義のステップ）をもう一度' },
  misread: { label: '問題文の読み違い', hint: '「誤っているもの」「いくつあるか」などの読み落としの可能性があります。', action: '問題文の最後の一文を先に読む練習' },
  unknown: { label: 'わからなかった', hint: '知識がまだ入っていない状態です。', action: '講義・重要事項から学び直す' },
  careless: { label: 'うっかり（分かっていた）', hint: '知識はあるがミスした場合です。', action: '見直しの習慣をつける' },
};

/** 選んだ選択肢から原因を推定する（あくまで推測。利用者に確認してもらう） */
export function inferCause(q, chosen) {
  const c = q.choiceCauses?.[chosen];
  return c && CAUSES[c] ? c : null;
}

/** 記録した原因の集計（確認済みを優先して数える） */
export function causeSummary(state, since = 0) {
  const m = {};
  for (const x of state.causes) {
    if (x.t < since) continue;
    const k = x.cause;
    m[k] = m[k] || { cause: k, n: 0, confirmed: 0 };
    m[k].n++; if (x.confirmed) m[k].confirmed++;
  }
  return Object.values(m).sort((a, b) => b.confirmed - a.confirmed || b.n - a.n);
}

export function addCause(state, qid, cause, confirmed, now = Date.now()) {
  // 同じ問題の同じ回答に対する記録は上書き
  const last = state.causes[state.causes.length - 1];
  if (last && last.qid === qid && now - last.t < 10 * 60000) { last.cause = cause; last.confirmed = confirmed; return; }
  state.causes.push({ qid, t: now, cause, confirmed });
  if (state.causes.length > 500) state.causes.splice(0, state.causes.length - 500);
}
