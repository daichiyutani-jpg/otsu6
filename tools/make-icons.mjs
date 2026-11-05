// アプリのPNGアイコンを生成（外部素材・ライブラリなし）。三角フラスコの図柄。合格特化型＝青緑、完全学習型＝藍。
// 使い方：node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const APPS = { speed: { bg: [15, 118, 110], bg2: [20, 160, 140], mark: [255, 214, 102] }, full: { bg: [63, 81, 181], bg2: [92, 107, 192], mark: [255, 214, 102] } };
const WHITE = [255, 255, 255], LIQ = [180, 230, 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function pixel(u, v, c) {
  // フラスコ：首 0.43〜0.57（v 0.18〜0.40）、胴は v0.40〜0.80 で広がる三角
  const neck = Math.abs(u - 0.5) < 0.07 && v > 0.2 && v < 0.42;
  const t = (v - 0.42) / 0.38;
  const half = 0.07 + t * 0.25;
  const body = v >= 0.42 && v <= 0.8 && Math.abs(u - 0.5) < half;
  const rim = Math.abs(u - 0.5) < 0.11 && v > 0.17 && v < 0.21;
  if (rim) return WHITE;
  if (neck || body) {
    const edge = body ? half - Math.abs(u - 0.5) < 0.03 || v > 0.77 : 0.07 - Math.abs(u - 0.5) < 0.03;
    if (edge) return WHITE;
    if (v > 0.58) return LIQ;
    return mix(c.bg, WHITE, 0.15);
  }
  // 右上の丸印（6類の目印）
  if (Math.hypot(u - 0.78, v - 0.24) < 0.09) return c.mark;
  return mix(c.bg, c.bg2, (u + v) / 2);
}

function crc32(buf) { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(size, c) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const p = pixel((x + 0.5) / size, (y + 0.5) / size, c);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [app, c] of Object.entries(APPS)) {
  const dir = new URL(`../${app}/icons/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const s of [180, 192, 512]) writeFileSync(new URL(`icon-${s}.png`, dir), png(s, c));
  console.log(`${app}/icons に PNG を生成`);
}
