// 小さなDOM道具。h('div.cls', {onclick}, '子', 要素...)
export function h(sel, attrs, ...kids) {
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) { kids.unshift(attrs); attrs = {}; }
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && k !== 'type') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const stars = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));

export function bar(value, { label = '', target = null, cls = '' } = {}) {
  const v = Math.max(0, Math.min(1, value || 0));
  return h('div.bar' + (cls ? '.' + cls : ''), { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v * 100), 'aria-label': label },
    h('div.bar-fill', { style: { width: `${v * 100}%` } }),
    target != null ? h('div.bar-target', { style: { left: `${target * 100}%` }, title: '目標' }) : null);
}

export function toast(msg, ms = 2200) {
  const t = h('div.toast', { role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function confirmBox(message, { ok = 'OK', cancel = 'キャンセル', danger = false } = {}) {
  return new Promise((resolve) => {
    const close = (v) => { wrap.remove(); resolve(v); };
    const wrap = h('div.modal', { role: 'dialog', 'aria-modal': 'true' },
      h('div.modal-box',
        h('p.modal-msg', message),
        h('div.row.end',
          h('button.btn.ghost', { onclick: () => close(false) }, cancel),
          h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => close(true) }, ok))));
    document.body.append(wrap);
    wrap.querySelector('.btn' + (danger ? '.danger' : '.primary')).focus();
  });
}

/** 化学式の数字を下付きに（データ側で済んでいれば何もしない） */
export const chem = (s) => s;
