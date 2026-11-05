// アニメーション教材プレーヤー（SVGを段階ごとに描き替える。外部動画なし）
// 操作：再生／一時停止／最初から／前へ／次へ／説明の表示切替／静止画モード
import { h } from '../ui/dom.js';

const STEP_MS = 5200;

/**
 * def: {id, title, schematic, steps:[{title, caption, svg()}]}
 * opts: {reduceMotion, captions, onEnd()}
 */
export function animPlayer(def, opts = {}) {
  let i = 0;
  let playing = false;
  let timer = null;
  let captions = opts.captions !== false;
  let still = !!opts.reduceMotion;
  const root = h('div.anim', { role: 'region', 'aria-label': `アニメーション教材：${def.title}` });

  const stop = () => { playing = false; clearTimeout(timer); timer = null; };
  const schedule = () => {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => {
      if (i < def.steps.length - 1) { i++; draw(); schedule(); }
      else { stop(); draw(); }
    }, STEP_MS);
  };
  const go = (k) => { i = Math.max(0, Math.min(def.steps.length - 1, k)); draw(); if (playing) schedule(); };

  function frame(step, k) {
    return h('div.anim-frame',
      h('div.anim-stage', { html: step.svg(), 'aria-hidden': 'true' }),
      def.schematic !== false ? h('span.anim-schematic', '模式図') : null,
      (captions || still) ? h('div.anim-cap', { 'aria-live': still ? 'off' : 'polite' }, h('b', `${k + 1}. ${step.title}`), step.caption) : h('div.anim-cap.sr', step.title + '。' + step.caption));
  }

  function draw() {
    if (i === def.steps.length - 1) opts.onEnd?.();
    root.classList.toggle('anim-static', still);
    root.classList.toggle('anim-paused', !playing && !still);
    const ctrl = h('div.anim-ctrl',
      still ? null : h('button.btn.sm', { 'aria-label': playing ? '一時停止' : '再生', onclick: () => { if (playing) stop(); else { playing = true; if (i === def.steps.length - 1) i = 0; schedule(); } draw(); } }, playing ? '⏸ 一時停止' : '▶ 再生'),
      still ? null : h('button.btn.sm', { 'aria-label': '最初から再生', onclick: () => { playing = true; go(0); schedule(); draw(); } }, '⏮ 最初から'),
      still ? null : h('button.btn.sm', { 'aria-label': '前の段階', disabled: i === 0, onclick: () => go(i - 1) }, '◀ 前へ'),
      still ? null : h('button.btn.sm', { 'aria-label': '次の段階', disabled: i === def.steps.length - 1, onclick: () => go(i + 1) }, '次へ ▶'),
      still ? null : h('button.btn.sm.ghost', { 'aria-pressed': String(captions), onclick: () => { captions = !captions; draw(); } }, captions ? '説明を隠す' : '説明を表示'),
      h('button.btn.sm.ghost', { 'aria-pressed': String(still), onclick: () => { still = !still; stop(); draw(); } }, still ? '動きのある表示へ' : '静止画モード'));
    if (still) {
      root.replaceChildren(...def.steps.map((s, k) => frame(s, k)), ctrl);
      opts.onEnd?.();
    } else {
      root.replaceChildren(frame(def.steps[i], i), h('div.anim-dots', def.steps.map((_, k) => h('i' + (k === i ? '.on' : '')))), ctrl);
    }
  }
  draw();
  root.destroy = stop;
  return root;
}
