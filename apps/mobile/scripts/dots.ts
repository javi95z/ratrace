import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { COLORS } from '../src/ui/theme';

/**
 * The page's ground, as the browser paints it: `radial-gradient(night-700 1px, transparent 1px) 0 0 / 6px 6px`
 * over night-800 is, in each 6x6 CSS px tile, a disc of radius 1 centred at (3,3), antialiased. Drawn here at
 * three densities (6, 12 and 18 px) so each phone repeats a tile of its own device pixels.
 *
 *   pnpm --filter @ratrace/mobile exec tsx scripts/dots.ts
 */
export const TILE = 6;
const SAMPLES = 16;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** RGBA bytes of the tile at `scale` device pixels per CSS px. */
export function dotsTile(scale: number): { size: number; data: Uint8Array } {
  const size = TILE * scale;
  const bg = rgb(COLORS['night-800']);
  const fg = rgb(COLORS['night-700']);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = (x + (sx + 0.5) / SAMPLES) / scale - TILE / 2;
          const py = (y + (sy + 0.5) / SAMPLES) / scale - TILE / 2;
          if (px * px + py * py <= 1) hit++;
        }
      }
      const cover = hit / (SAMPLES * SAMPLES);
      const o = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(bg[c] + (fg[c] - bg[c]) * cover);
      data[o + 3] = 255;
    }
  }
  return { size, data };
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(typed));
  return Buffer.concat([head, typed, tail]);
}

/** A square 8-bit RGBA PNG. */
export function encodePng(size: number, data: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    Buffer.from(data.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const FILES = { 'dots.png': 1, 'dots@2x.png': 2, 'dots@3x.png': 3 } as const;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/ui');
  mkdirSync(dir, { recursive: true });
  for (const [name, scale] of Object.entries(FILES)) {
    const { size, data } = dotsTile(scale);
    writeFileSync(join(dir, name), encodePng(size, data));
  }
}
