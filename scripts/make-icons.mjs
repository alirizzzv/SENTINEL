/**
 * Generates SENTINEL's shield icons (16/48/128 px) as PNGs with a tiny built-in
 * encoder — no image dependencies. Navy rounded tile + electric-blue shield.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'extension', 'icons');
mkdirSync(outDir, { recursive: true });

// ── minimal PNG encoder ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // rows prefixed with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── shield drawing ─────────────────────────────────────────────────────────
function shieldInside(nx, ny) {
  // nx in [-1,1], ny in [0,1] (0 = top, 1 = bottom)
  if (ny < 0.06 || ny > 0.96) return false;
  let half;
  if (ny < 0.5) half = 0.74; // straight-ish top
  else half = 0.74 * (1 - (ny - 0.5) / 0.5); // taper to point
  // round the top corners slightly
  if (ny < 0.16) half *= 0.6 + (ny / 0.16) * 0.4;
  return Math.abs(nx) <= half;
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22; // tile corner radius
  const set = (x, y, [R, G, B, A]) => {
    const i = (y * size + x) * 4;
    buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = A;
  };
  const inRoundRect = (x, y) => {
    const cx = Math.min(x, size - 1 - x);
    const cy = Math.min(y, size - 1 - y);
    if (cx >= r || cy >= r) return true;
    const dx = r - cx, dy = r - cy;
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRoundRect(x, y)) { set(x, y, [0, 0, 0, 0]); continue; }
      // shield local coords: padded box
      const pad = size * 0.18;
      const sw = size - pad * 2;
      const nx = ((x - pad) / sw) * 2 - 1;
      const ny = (y - pad) / sw;
      if (shieldInside(nx, ny)) {
        // white shield with a soft violet inner band
        const inner = shieldInside(nx * 1.0, ny) && Math.abs(nx) < 0.18 && ny > 0.2 && ny < 0.78;
        set(x, y, inner ? [176, 124, 255, 255] : [255, 255, 255, 255]);
      } else {
        set(x, y, [124, 108, 255, 255]); // violet tile
      }
    }
  }
  return buf;
}

for (const size of [16, 48, 128]) {
  const png = encodePNG(size, size, render(size));
  writeFileSync(resolve(outDir, `icon-${size}.png`), png);
  console.log('wrote', `extension/icons/icon-${size}.png`, `(${png.length} bytes)`);
}
