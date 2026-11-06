// 公式の過去問PDF（利用者が自分でダウンロードしたもの）から、乙種第6類の35問を切り出す処理のうち
// 「画素だけを見る部分」。DOMにもPDFライブラリにも依存しない（テストできる）。
//
// 公式PDFは問題文が文字として取り出せないため、文字は読まない。
//   ・問題：行の左端が「［問」の位置にそろう行を問題の始まりとみなし、次の問題の手前までを1問として切り出す
//   ・正答：解答表の赤い数字を図形として読み、位置（表・列・行）から問題番号に対応させる
// 想定する構成（令和8年6月更新版で確認）：共通25問（法令15・物化10）＋ 類ごとに10問 × 5類（1・2・3・5・6類の順）
// 構成が違うPDFは取り込まず、エラーにする（誤った正答で採点しないため）。

export const EXPECT = {
  common: 25,          // 問1〜25（全類共通）
  perClass: 10,        // 問26〜35
  classes: [1, 2, 3, 5, 6],
  target: 6,           // 乙6
};

export const subjectOfNo = (no) => (no <= 15 ? 'law' : no <= 25 ? 'chem' : 'prop');

/** 画像（RGBA）から、インクのある行のまとまり（文字の行）を出す。座標はページ幅・高さに対する割合 */
export function inkLines(img, { dark = 384 } = {}) {
  const { width: W, height: H, data } = img;
  const rowInk = new Uint8Array(H);
  const minX = new Int32Array(H).fill(W), maxX = new Int32Array(H).fill(-1);
  for (let y = 0; y < H; y++) {
    let o = y * W * 4;
    for (let x = 0; x < W; x++, o += 4) {
      const r = data[o], g = data[o + 1], b = data[o + 2];
      // 黒〜灰色の字だけ（赤い正答の字などの色付きは数えない）
      if (r + g + b < dark && data[o + 3] > 128 && Math.max(r, g, b) - Math.min(r, g, b) < 80) {
        rowInk[y] = 1;
        if (x < minX[y]) minX[y] = x;
        if (x > maxX[y]) maxX[y] = x;
      }
    }
  }
  const lines = [];
  for (let y = 0; y < H;) {
    if (!rowInk[y]) { y++; continue; }
    const y0 = y; let x0 = W, x1 = -1;
    while (y < H && rowInk[y]) { if (minX[y] < x0) x0 = minX[y]; if (maxX[y] > x1) x1 = maxX[y]; y++; }
    lines.push({ y0: y0 / H, y1: y / H, x0: x0 / W, x1: (x1 + 1) / W });
  }
  return lines;
}

/** 全ページの行から「［問」の左端位置を推定する：十分な回数現れる左端位置のうち、いちばん左 */
export function bracketX(pages, { tol = 0.006, minCount = 40 } = {}) {
  const xs = pages.flatMap((p) => p.lines.filter((l) => l.y0 > 0.04 && l.y0 < 0.9).map((l) => l.x0)).sort((a, b) => a - b);
  const clusters = [];
  for (const x of xs) {
    const c = clusters[clusters.length - 1];
    if (c && x - c.last <= tol) { c.n++; c.sum += x; c.last = x; } else clusters.push({ n: 1, sum: x, last: x });
  }
  const ok = clusters.filter((c) => c.n >= minCount).map((c) => c.sum / c.n);
  return ok.length ? Math.min(...ok) : null;
}

/**
 * 問題のまとまりを出す。pages: [{lines}]（ページ順）
 * 返り値：[{parts:[{page, y0, y1, x0, x1}]}]（1問が次のページに続く場合は parts が2つ以上）
 */
export function questionBlocks(pages, { tol = 0.006, right = 0.016, footer = 0.9, header = 0.04, minCount = 40 } = {}) {
  const bx = bracketX(pages, { tol, minCount });
  if (bx == null) return { bx: null, blocks: [] };
  const blocks = [];
  let cur = null;
  pages.forEach((p, page) => {
    const lines = p.lines.filter((l) => l.y0 > header && l.y0 < footer);
    let part = null;
    let seenBracket = false;
    for (const l of lines) {
      // 「［問 10］」など番号によって括弧の位置が少し右にずれるので、右側は広めに許す（選択肢の行よりは左）
      const isBracket = l.x0 >= bx - tol && l.x0 <= bx + right;
      if (isBracket) {
        seenBracket = true;
        cur = { parts: [] };
        blocks.push(cur);
        part = { page, lines: [l] };
        cur.parts.push(part);
        continue;
      }
      if (!seenBracket) {
        // ページの先頭で「［問」より前にある行：見出し・注記・類の表紙は飛ばし、本文の続きなら前の問題へつなぐ
        if (!cur || l.x0 < bx - tol || l.x0 > bx + 0.05) continue;
        if (!part) { part = { page, lines: [] }; cur.parts.push(part); }
        part.lines.push(l);
        continue;
      }
      part.lines.push(l);
    }
  });
  // 問題の後ろに付いた次の科目の見出し（中央寄せで、上に大きな空き）を外す
  for (const b of blocks) {
    const last = b.parts[b.parts.length - 1];
    while (last.lines.length > 1) {
      const n = last.lines.length;
      const l = last.lines[n - 1], prev = last.lines[n - 2];
      if (l.x0 > bx + 0.12 && l.y0 - prev.y1 > 0.03) last.lines.pop(); else break;
    }
  }
  return {
    bx,
    blocks: blocks.map((b) => ({
      parts: b.parts.filter((pt) => pt.lines.length).map((pt) => ({
        page: pt.page,
        y0: Math.min(...pt.lines.map((l) => l.y0)),
        y1: Math.max(...pt.lines.map((l) => l.y1)),
        x0: Math.min(...pt.lines.map((l) => l.x0)),
        x1: Math.max(...pt.lines.map((l) => l.x1)),
      })),
    })),
  };
}

export const isRed = (r, g, b) => r > 150 && g < 120 && b < 120 && r - g > 70;

/** 赤い字（正答の数字）を1字ずつの枠で出す。座標は画素 */
export function redGlyphs(img) {
  const { width: W, height: H, data } = img;
  const red = new Uint8Array(W * H);
  const rowHas = new Uint8Array(H);
  for (let i = 0, o = 0; i < W * H; i++, o += 4) if (isRed(data[o], data[o + 1], data[o + 2])) { red[i] = 1; rowHas[i / W | 0] = 1; }
  const gapX = Math.max(3, Math.round(W * 0.012));
  const out = [];
  for (let y = 0; y < H;) {
    if (!rowHas[y]) { y++; continue; }
    const y0 = y; while (y < H && rowHas[y]) y++;
    const y1 = y;
    const colHas = new Uint8Array(W);
    for (let yy = y0; yy < y1; yy++) for (let x = 0; x < W; x++) if (red[yy * W + x]) colHas[x] = 1;
    for (let x = 0; x < W;) {
      if (!colHas[x]) { x++; continue; }
      const x0 = x; let gap = 0, xe = x;
      while (x < W && gap <= gapX) { if (colHas[x]) { gap = 0; xe = x; } else gap++; x++; }
      const x1 = xe + 1;
      // 枠を詰める
      let ty0 = y1, ty1 = y0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (red[yy * W + xx]) { if (yy < ty0) ty0 = yy; if (yy + 1 > ty1) ty1 = yy + 1; }
      if ((x1 - x0) * (ty1 - ty0) >= 4) out.push({ x0, y0: ty0, x1, y1: ty1 });
    }
  }
  return { glyphs: out, mask: red, W, H };
}

/** 1字の形の特徴（5×7のます目ごとの塗りの割合＋縦横比） */
export function glyphFeature(mask, W, g) {
  const gw = g.x1 - g.x0, gh = g.y1 - g.y0;
  const C = 5, R = 7;
  const f = new Array(C * R + 1).fill(0);
  const cnt = new Array(C * R).fill(0);
  for (let y = g.y0; y < g.y1; y++) {
    const r = Math.min(R - 1, ((y - g.y0) * R / gh) | 0);
    for (let x = g.x0; x < g.x1; x++) {
      const c = Math.min(C - 1, ((x - g.x0) * C / gw) | 0);
      cnt[r * C + c]++;
      if (mask[y * W + x]) f[r * C + c]++;
    }
  }
  for (let i = 0; i < C * R; i++) f[i] = cnt[i] ? f[i] / cnt[i] : 0;
  f[C * R] = Math.min(2, gw / gh);
  return f;
}

/** 形の見本との近さで 1〜5 を判定。{digit, dist, margin} */
export function classifyGlyph(feat, templates) {
  const ds = Object.entries(templates).map(([d, t]) => {
    let s = 0;
    for (let i = 0; i < t.length; i++) { const w = i === t.length - 1 ? 3 : 1; s += w * (feat[i] - t[i]) ** 2; }
    return { digit: Number(d), dist: Math.sqrt(s) };
  }).sort((a, b) => a.dist - b.dist);
  return { digit: ds[0].digit, dist: ds[0].dist, margin: ds[1].dist - ds[0].dist };
}

/**
 * 解答表の字を、表ごと・問題番号順に並べる。pagesGlyphs: [{page, glyphs, H, W}]（解答のあるページ順）
 * 表の区切り＝行の間隔が大きく空いた所。表の中は列ごとに上から下（列優先）。
 */
export function answerTables(pagesGlyphs) {
  const tables = [];
  for (const pg of pagesGlyphs) {
    const gs = pg.glyphs.map((g) => ({ ...g, cy: (g.y0 + g.y1) / 2, cx: (g.x0 + g.x1) / 2, page: pg.page }));
    if (!gs.length) continue;
    // 行に分ける
    gs.sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const g of gs) {
      const r = rows[rows.length - 1];
      if (r && g.cy - r.cy < (g.y1 - g.y0) * 0.6) r.items.push(g); else rows.push({ cy: g.cy, items: [g] });
    }
    const pitches = rows.slice(1).map((r, i) => r.cy - rows[i].cy).sort((a, b) => a - b);
    const pitch = pitches.length ? pitches[Math.floor(pitches.length / 2)] : 0;
    let cur = null;
    rows.forEach((r, i) => {
      if (!cur || r.cy - rows[i - 1].cy > pitch * 1.8) { cur = { page: pg.page, items: [] }; tables.push(cur); }
      cur.items.push(...r.items);
    });
  }
  // 列優先に並べる
  return tables.map((t) => {
    const cols = [];
    const tolX = Math.max(...t.items.map((g) => g.x1 - g.x0)) * 1.5;
    for (const g of [...t.items].sort((a, b) => a.cx - b.cx)) {
      const c = cols[cols.length - 1];
      if (c && g.cx - c.cx < tolX) c.items.push(g); else cols.push({ cx: g.cx, items: [g] });
    }
    const ordered = cols.flatMap((c) => c.items.sort((a, b) => a.cy - b.cy));
    const box = {
      x0: Math.min(...t.items.map((g) => g.x0)), x1: Math.max(...t.items.map((g) => g.x1)),
      y0: Math.min(...t.items.map((g) => g.y0)), y1: Math.max(...t.items.map((g) => g.y1)),
    };
    return { page: t.page, glyphs: ordered, box };
  });
}

/**
 * 切り出した問題と解答表を照合し、乙6の35問にまとめる。
 * blocks: questionBlocks().blocks, tables: answerTables()（各 glyph に digit を付けたもの）
 * 返り値 {ok, errors, questions:[{no, subject, parts, answer, confidence}], tables:{common, target}}
 */
export function assemble(blocks, tables, expect = EXPECT) {
  const errors = [];
  const nClass = expect.classes.length;
  const needBlocks = expect.common + expect.perClass * nClass;
  if (blocks.length !== needBlocks) errors.push(`問題の数が想定と違います（${blocks.length}問を検出、想定は${needBlocks}問）。`);
  const sizes = tables.map((t) => t.glyphs.length);
  const wantSizes = [expect.common, ...expect.classes.map(() => expect.perClass)];
  if (sizes.join(',') !== wantSizes.join(',')) errors.push(`解答表の形が想定と違います（${sizes.join('・') || 'なし'}、想定は${wantSizes.join('・')}）。`);
  if (errors.length) return { ok: false, errors, questions: [] };
  const ci = expect.classes.indexOf(expect.target);
  const targetTable = tables[1 + ci];
  const qs = [];
  for (let i = 0; i < expect.common; i++) qs.push({ no: i + 1, block: blocks[i], g: tables[0].glyphs[i] });
  for (let i = 0; i < expect.perClass; i++) qs.push({ no: expect.common + i + 1, block: blocks[expect.common + ci * expect.perClass + i], g: targetTable.glyphs[i] });
  const questions = qs.map(({ no, block, g }) => ({ no, subject: subjectOfNo(no), parts: block.parts, answer: g.digit, confidence: g.margin }));
  const bad = questions.filter((q) => !(q.answer >= 1 && q.answer <= 5));
  if (bad.length) errors.push(`正答を読み取れない問題があります（問${bad.map((q) => q.no).join('・')}）。`);
  return { ok: errors.length === 0, errors, questions, tables: { common: tables[0], target: targetTable } };
}

/** 結果の採点（科目ごと） */
export function scorePast(nos, answers, key) {
  const per = {};
  for (const no of nos) {
    const s = subjectOfNo(no);
    per[s] = per[s] || { n: 0, c: 0 };
    per[s].n++;
    if (answers[no] != null && answers[no] === key[no]) per[s].c++;
  }
  return per;
}
