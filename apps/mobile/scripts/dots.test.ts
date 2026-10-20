import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { COLORS } from '../src/ui/theme';
import { dotsTile, encodePng, FILES } from './dots';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../assets/ui');

function hex(h: string) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function px(t: { size: number; data: Uint8Array }, x: number, y: number) {
  const o = (y * t.size + x) * 4;
  return [t.data[o], t.data[o + 1], t.data[o + 2]];
}
/** 0 = night-800, 1 = night-700, by the red channel. */
function cover(p: number[]) {
  const a = hex(COLORS['night-800'])[0];
  const b = hex(COLORS['night-700'])[0];
  return (p[0] - a) / (b - a);
}
function decode(file: string) {
  const buf = readFileSync(join(dir, file));
  const size = buf.readUInt32BE(16);
  let idat = Buffer.alloc(0);
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o);
    if (buf.toString('ascii', o + 4, o + 8) === 'IDAT') idat = Buffer.concat([idat, buf.subarray(o + 8, o + 8 + len)]);
    o += 12 + len;
  }
  const raw = inflateSync(idat);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) data.set(raw.subarray(y * (size * 4 + 1) + 1, (y + 1) * (size * 4 + 1)), y * size * 4);
  return { size, data };
}

test('1x tile: corner is night-800, the pixels touching the centre are mostly night-700', () => {
  const t = dotsTile(1);
  expect(t.size).toBe(6);
  expect(px(t, 0, 0)).toEqual(hex(COLORS['night-800']));
  for (const [x, y] of [[2, 2], [3, 2], [2, 3], [3, 3]]) expect(cover(px(t, x, y))).toBeGreaterThan(0.5);
});

test('3x tile: the block round the centre is night-700-dominant, the corner night-800', () => {
  const t = dotsTile(3);
  expect(t.size).toBe(18);
  expect(px(t, 0, 0)).toEqual(hex(COLORS['night-800']));
  for (let y = 8; y <= 10; y++) for (let x = 8; x <= 10; x++) expect(cover(px(t, x, y))).toBeGreaterThan(0.5);
});

test('the committed PNGs are what the script draws', () => {
  for (const [name, scale] of Object.entries(FILES)) {
    const want = dotsTile(scale);
    const got = decode(name);
    expect(got.size).toBe(want.size);
    expect(Array.from(got.data)).toEqual(Array.from(want.data));
    expect(readFileSync(join(dir, name)).equals(encodePng(want.size, want.data))).toBe(true);
  }
});
