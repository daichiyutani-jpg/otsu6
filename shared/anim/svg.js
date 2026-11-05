// アニメ教材で使う小さなSVG部品（viewBox 0 0 400 300）
export const C = {
  O: '#e53935', H: '#ffffff', N: '#3f51b5', Cl: '#43a047', Br: '#8d4e2a', F: '#9ccc65', I: '#7b1fa2', Mn: '#424242', Cu: '#c77d3a', Fe: '#7d8b93', Na: '#b39ddb', C: '#37474f',
  ink: '#263238', sub: '#607d8b', ok: '#1b7f3b', ng: '#c62828', water: '#90caf9', liquid: '#e3f2fd', brown: '#a1471e', flame: '#ff9800', flame2: '#ffd54f',
};

export const svg = (inner, extra = '') => `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" font-family="system-ui, sans-serif" ${extra}>${inner}</svg>`;
export const text = (x, y, s, { size = 14, fill = C.ink, anchor = 'middle', weight = 'normal' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${s}</text>`;
export const atom = (x, y, r, el, label = el) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C[el] || '#ccc'}" stroke="#455a64" stroke-width="1.2"/>${label ? `<text x="${x}" y="${y + r * 0.38}" font-size="${r * 1.0}" text-anchor="middle" fill="${['H', 'F'].includes(el) ? '#263238' : '#fff'}" font-weight="bold">${label}</text>` : ''}`;
export const bond = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#455a64" stroke-width="4"/>`;

/** 過酸化水素分子 H-O-O-H */
export const h2o2 = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${bond(-26, 6, -10, 0)}${bond(-10, 0, 10, 0)}${bond(10, 0, 26, -6)}${atom(-26, 6, 8, 'H')}${atom(26, -6, 8, 'H')}${atom(-10, 0, 11, 'O')}${atom(10, 0, 11, 'O')}</g>`;
export const h2o = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${bond(0, 0, -16, 10)}${bond(0, 0, 16, 10)}${atom(-16, 10, 8, 'H')}${atom(16, 10, 8, 'H')}${atom(0, 0, 11, 'O')}</g>`;
export const o2 = (x, y, s = 1, cls = '') => `<g class="${cls}"><g transform="translate(${x} ${y}) scale(${s})">${bond(-9, 0, 9, 0)}${atom(-9, 0, 10, 'O')}${atom(9, 0, 10, 'O')}</g></g>`;
export const no2 = (x, y, s = 1, cls = '') => `<g class="${cls}"><g transform="translate(${x} ${y}) scale(${s})">${bond(0, 0, -15, 9)}${bond(0, 0, 15, 9)}${atom(-15, 9, 8, 'O', '')}${atom(15, 9, 8, 'O', '')}${atom(0, 0, 10, 'N')}</g></g>`;

export const flame = (x, y, s = 1, cls = 'a-flick') => `<g transform="translate(${x} ${y}) scale(${s})"><g class="${cls}"><path d="M0 0 C-22 -10 -18 -40 0 -62 C4 -44 22 -36 16 -14 C14 -4 8 0 0 0Z" fill="${C.flame}"/><path d="M0 0 C-10 -6 -9 -24 1 -36 C4 -24 12 -18 8 -8 C6 -2 4 0 0 0Z" fill="${C.flame2}"/></g></g>`;
export const cross = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})" stroke="${C.ng}" stroke-width="7" stroke-linecap="round"><line x1="-18" y1="-18" x2="18" y2="18"/><line x1="18" y1="-18" x2="-18" y2="18"/></g>`;
export const circleOk = (x, y, s = 1) => `<circle cx="${x}" cy="${y}" r="${18 * s}" fill="none" stroke="${C.ok}" stroke-width="${6 * s}"/>`;

/** ビーカー（中身の色・量） */
export const beaker = (x, y, w = 90, hh = 110, fill = C.liquid, level = 0.6, label = '') => {
  const lv = y + hh - hh * level;
  return `<g><rect x="${x}" y="${lv}" width="${w}" height="${y + hh - lv}" fill="${fill}" opacity=".9"/><path d="M${x - 6} ${y} L${x} ${y} L${x} ${y + hh} L${x + w} ${y + hh} L${x + w} ${y}" fill="none" stroke="#546e7a" stroke-width="3"/>${label ? text(x + w / 2, y + hh + 20, label, { size: 13 }) : ''}</g>`;
};

/** 瓶（色付き・栓の種類） */
export const bottle = (x, y, { glass = '#e0f2f1', liquid = C.liquid, cap = 'plain', label = '' } = {}) => {
  const capSvg = cap === 'vent'
    ? `<rect x="${x + 22}" y="${y - 6}" width="36" height="16" rx="3" fill="#78909c"/><rect x="${x + 37}" y="${y - 14}" width="6" height="10" fill="#fff" stroke="#78909c"/>`
    : `<rect x="${x + 22}" y="${y - 6}" width="36" height="16" rx="3" fill="#78909c"/>`;
  return `<g>${capSvg}<path d="M${x + 26} ${y + 10} L${x + 26} ${y + 28} Q${x} ${y + 40} ${x} ${y + 64} L${x} ${y + 150} Q${x} ${y + 160} ${x + 10} ${y + 160} L${x + 70} ${y + 160} Q${x + 80} ${y + 160} ${x + 80} ${y + 150} L${x + 80} ${y + 64} Q${x + 80} ${y + 40} ${x + 54} ${y + 28} L${x + 54} ${y + 10}Z" fill="${glass}" stroke="#546e7a" stroke-width="2.5"/><rect x="${x + 4}" y="${y + 80}" width="72" height="76" rx="6" fill="${liquid}" opacity=".85"/>${label ? text(x + 40, y + 182, label, { size: 13 }) : ''}</g>`;
};

export const arrow = (x1, y1, x2, y2, color = C.sub, label = '', lx = null, ly = null) => {
  const id = 'ah' + Math.abs(Math.round(x1 * 7 + y1 * 13 + x2 * 17 + y2 * 3));
  return `<defs><marker id="${id}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${color}"/></marker></defs><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" marker-end="url(#${id})"/>${label ? text(lx ?? (x1 + x2) / 2, ly ?? (y1 + y2) / 2 - 8, label, { size: 13, fill: color, weight: 'bold' }) : ''}`;
};

export const box = (x, y, w, hh, label, { fill = '#eceff1', stroke = '#90a4ae', size = 13, color = C.ink, sub = '' } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${text(x + w / 2, y + hh / 2 + (sub ? -2 : 5), label, { size, fill: color, weight: 'bold' })}${sub ? text(x + w / 2, y + hh / 2 + 16, sub, { size: size - 2, fill: C.sub }) : ''}`;

export const bubbles = (x, y, n = 6, w = 60, cls = 'a-rise') => {
  let s = '';
  for (let k = 0; k < n; k++) s += `<circle cx="${x + (k * 37) % w}" cy="${y - (k * 11) % 30}" r="${3 + (k % 3)}" fill="#fff" stroke="#90a4ae" class="${cls}" style="animation-delay:${(k * 0.35).toFixed(2)}s"/>`;
  return s;
};

export const title = (s) => text(200, 26, s, { size: 16, weight: 'bold' });
