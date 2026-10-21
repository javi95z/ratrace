import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLANT } from '../src/ui/fonts';
import { fontPath, readFont, type FontFamily } from './fontCoverage';

/*
 * The slanted faces of the reading fonts (assets/fonts, made by slant_fonts.py): what a browser draws for `italic` where a font has no italic, which
 * is every glyph sheared by a quarter of its height above the baseline, the advances as they were. Read here from the files themselves, with no tool of the
 * font's: a table directory, the glyphs, the names. (Where Python and fontTools are at hand the files are also made again and compared byte for byte.)
 */
const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, '../assets/fonts');
const script = join(here, 'slant_fonts.py');

const FACES = Object.entries(SLANT) as Array<[FontFamily, string]>;
const LICENSES = { ChakraPetch: 'OFL-Chakra-Petch.txt', Exo2: 'OFL-Exo-2.txt' } as const;

class Font {
  readonly view: DataView;
  readonly bytes: Buffer;
  private readonly tables = new Map<string, { offset: number; length: number }>();
  constructor(path: string) {
    this.bytes = readFileSync(path);
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
    const count = this.view.getUint16(4);
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      this.tables.set(String.fromCharCode(...[0, 1, 2, 3].map((k) => this.view.getUint8(at + k))), { offset: this.view.getUint32(at + 8), length: this.view.getUint32(at + 12) });
    }
  }
  has(tag: string): boolean {
    return this.tables.has(tag);
  }
  at(tag: string): number {
    const table = this.tables.get(tag);
    if (!table) throw new Error(`no ${tag} table`);
    return table.offset;
  }
  get glyphCount(): number {
    return this.view.getUint16(this.at('maxp') + 4);
  }
  /** The advance and the left side bearing of a glyph. */
  metrics(gid: number): { advance: number; lsb: number } {
    const long = this.view.getUint16(this.at('hhea') + 34);
    const hmtx = this.at('hmtx');
    if (gid < long) return { advance: this.view.getUint16(hmtx + gid * 4), lsb: this.view.getInt16(hmtx + gid * 4 + 2) };
    return { advance: this.view.getUint16(hmtx + (long - 1) * 4), lsb: this.view.getInt16(hmtx + long * 4 + (gid - long) * 2) };
  }
  /** The glyph a code point is drawn with (the Unicode cmap, formats 4 and 12). */
  gidOf(point: number): number {
    const cmap = this.at('cmap');
    const n = this.view.getUint16(cmap + 2);
    for (let i = 0; i < n; i++) {
      const o = cmap + this.view.getUint32(cmap + 8 + i * 8);
      const format = this.view.getUint16(o);
      if (format === 12) {
        for (let g = 0, groups = this.view.getUint32(o + 12); g < groups; g++) {
          const first = this.view.getUint32(o + 16 + g * 12);
          if (point >= first && point <= this.view.getUint32(o + 20 + g * 12)) return this.view.getUint32(o + 24 + g * 12) + point - first;
        }
      } else if (format === 4) {
        const segs = this.view.getUint16(o + 6) / 2;
        const ends = o + 14;
        const starts = ends + segs * 2 + 2;
        const deltas = starts + segs * 2;
        const offsets = deltas + segs * 2;
        for (let s = 0; s < segs; s++) {
          if (point > this.view.getUint16(ends + s * 2) || point < this.view.getUint16(starts + s * 2)) continue;
          const rangeOffset = this.view.getUint16(offsets + s * 2);
          if (rangeOffset === 0) return (point + this.view.getInt16(deltas + s * 2)) & 0xffff;
          const g = this.view.getUint16(offsets + s * 2 + rangeOffset + (point - this.view.getUint16(starts + s * 2)) * 2);
          return g === 0 ? 0 : (g + this.view.getInt16(deltas + s * 2)) & 0xffff;
        }
      }
    }
    return 0;
  }
  /** The points of a simple glyph, or null for a composite or an empty one. */
  outline(gid: number): Array<[number, number]> | null {
    const long = this.view.getInt16(this.at('head') + 50) === 1;
    const loca = this.at('loca');
    const [from, to] = long ? [this.view.getUint32(loca + gid * 4), this.view.getUint32(loca + gid * 4 + 4)] : [this.view.getUint16(loca + gid * 2) * 2, this.view.getUint16(loca + gid * 2 + 2) * 2];
    if (to === from) return null;
    const g = this.at('glyf') + from;
    const contours = this.view.getInt16(g);
    if (contours <= 0) return null;
    let p = g + 10;
    const last = this.view.getUint16(p + (contours - 1) * 2);
    p += contours * 2;
    p += 2 + this.view.getUint16(p);
    const flags: number[] = [];
    while (flags.length <= last) {
      const flag = this.view.getUint8(p++);
      flags.push(flag);
      if (flag & 8) for (let repeat = this.view.getUint8(p++); repeat > 0; repeat--) flags.push(flag);
    }
    const axis = (short: number, same: number) => {
      let value = 0;
      return flags.map((flag) => {
        if (flag & short) {
          const delta = this.view.getUint8(p++);
          value += flag & same ? delta : -delta;
        } else if (!(flag & same)) {
          value += this.view.getInt16(p);
          p += 2;
        }
        return value;
      });
    };
    const xs = axis(2, 16);
    const ys = axis(4, 32);
    return xs.map((x, i) => [x, ys[i]]);
  }
  /** A string of the name table, in Windows' English. */
  name(id: number): string {
    const table = this.at('name');
    const count = this.view.getUint16(table + 2);
    const strings = table + this.view.getUint16(table + 4);
    for (let i = 0; i < count; i++) {
      const record = table + 6 + i * 12;
      if (this.view.getUint16(record) !== 3 || this.view.getUint16(record + 6) !== id) continue;
      const bytes = this.bytes.subarray(strings + this.view.getUint16(record + 10), strings + this.view.getUint16(record + 10) + this.view.getUint16(record + 8));
      return Buffer.from(bytes).swap16().toString('utf16le');
    }
    return '';
  }
}

/** Where a point goes: right by a quarter of its height above the baseline, to a whole unit, half up (the script's own words). */
const sheared = (x: number, y: number) => Math.floor(x + 0.25 * y + 0.5);

describe.each(FACES)('the slanted face of %s', (family, slanted) => {
  const upright = new Font(fontPath(family));
  const slant = new Font(join(assets, `${slanted}.ttf`));
  const folder = family.startsWith('Chakra') ? 'ChakraPetch' : 'Exo2';

  it('is made from the font and says whose it is, under a name of its own, with its license beside it', () => {
    expect(slant.name(1)).toBe(`RatRace Slant ${upright.name(1)}`);
    expect(slant.name(4)).toBe(`RatRace Slant ${upright.name(1)} Italic`);
    expect(slant.name(6)).toMatch(/^RatRaceSlant[A-Za-z0-9]+-Italic$/);
    // The copyright and the license of the font it comes from stay in its own tables, and the text of the license is beside it.
    for (const id of [0, 13, 14]) expect(slant.name(id), String(id)).toBe(upright.name(id));
    expect(slant.name(0)).toContain('Project Authors');
    expect(slant.name(10)).toContain('SIL Open Font License');
    expect(readFileSync(join(assets, LICENSES[folder]), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(existsSync(join(assets, LICENSES[folder]))).toBe(true);
  });

  it('keeps what a line is set from, so that it breaks where the upright one does: every advance, the characters it draws, the size of its letters', () => {
    expect(slant.glyphCount).toBe(upright.glyphCount);
    for (let gid = 0; gid < upright.glyphCount; gid++) expect(slant.metrics(gid).advance, `glyph ${gid}`).toBe(upright.metrics(gid).advance);
    const [a, b] = [readFont(fontPath(family)), readFont(join(assets, `${slanted}.ttf`))];
    expect(b).toEqual(a);
    // So that every table of the kit that is read from the upright font (coverage, small-letter height, metrics) holds for the slanted one.
    for (const point of [0x20, 0x41, 0x7a, 0xed, 0x2013, 0x410, 0x44f, 0x451]) expect(slant.gidOf(point) === 0, String(point)).toBe(upright.gidOf(point) === 0);
  });

  it('shears every point of an outline by a quarter of its height above the baseline and moves none up or down: the web\'s synthetic oblique', () => {
    for (const letter of ['H', 'l', 'e', 'o', 'g', '1', '$', 'Д', 'я']) {
      const point = letter.codePointAt(0)!;
      const [was, now] = [upright.gidOf(point), slant.gidOf(point)];
      if (was === 0) continue;
      const from = upright.outline(was);
      const to = slant.outline(now);
      if (from === null) continue;
      expect(to, letter).not.toBeNull();
      expect(to!.length, letter).toBe(from.length);
      expect(to, letter).toEqual(from.map(([x, y]) => [sheared(x, y), y]));
      // The left side bearing is where the sheared outline begins.
      expect(slant.metrics(now).lsb, letter).toBe(Math.min(...to!.map(([x]) => x)));
    }
  });

  it('keeps an accent on its letter: a glyph made of two is one outline, sheared whole', () => {
    // í is a letter and an accent in the font; in the slanted face it is a single outline (the points of each, each sheared), and as tall as before.
    const gid = slant.gidOf(0xed);
    // The stem of the i and the acute above it: two contours, 8 points, each sheared by its own height (the accent more than the stem's foot).
    const points = slant.outline(gid);
    expect(points?.length).toBe(8);
    const top = Math.max(...points!.map(([, y]) => y));
    expect(Math.min(...points!.filter(([, y]) => y === top).map(([x]) => x))).toBeGreaterThan(Math.min(...points!.filter(([, y]) => y === Math.min(...points!.map(([, v]) => v))).map(([x]) => x)));
    const heightOf = (font: Font, g: number) => {
      const long = font.view.getInt16(font.at('head') + 50) === 1;
      const loca = font.at('loca');
      const offset = long ? font.view.getUint32(loca + g * 4) : font.view.getUint16(loca + g * 2) * 2;
      return font.view.getInt16(font.at('glyf') + offset + 8);
    };
    expect(heightOf(slant, gid)).toBe(heightOf(upright, upright.gidOf(0xed)));
  });

  it('says it is an italic of 14 degrees, with its hinting gone: written for the upright outlines, it would not fit these', () => {
    const angle = slant.view.getInt32(slant.at('post') + 4) / 65536;
    expect(angle).toBeCloseTo(-Math.atan(0.25) * (180 / Math.PI), 2);
    expect(slant.view.getUint16(slant.at('head') + 44) & 2).toBe(2);
    expect(slant.view.getUint16(slant.at('OS/2') + 62) & 1).toBe(1);
    for (const tag of ['fpgm', 'prep', 'cvt ']) expect(slant.has(tag), tag).toBe(false);
  });
});

describe('what the app loads', () => {
  it('loads every slanted face by the family name the kit sets type in, from the files here', () => {
    const sources = readFileSync(join(here, '../src/ui/fontSources.ts'), 'utf8');
    for (const [, slanted] of FACES) {
      expect(sources, slanted).toContain(`import ${slanted} from '../../assets/fonts/${slanted}.ttf';`);
      expect(sources.slice(sources.indexOf('export const FONT_SOURCES')), slanted).toContain(`  ${slanted},`);
    }
  });
});

describe('making them again', () => {
  const tool = spawnSync('python3', ['-c', 'import fontTools; print(fontTools.version)'], { encoding: 'utf8' });
  const installed = tool.status === 0 ? tool.stdout.trim() : null;
  const madeWith = /^MADE_WITH = '([^']+)'/m.exec(readFileSync(script, 'utf8'))?.[1];

  it('says which fontTools the committed files were written by', () => {
    expect(madeWith).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // Byte for byte only where it is the same fontTools: another may write the same font in another order of its tables.
  it.skipIf(installed === null || installed !== madeWith)('writes the committed files, byte for byte', () => {
    const out = mkdtempSync(join(tmpdir(), 'slant-'));
    try {
      execFileSync('python3', [script, '--out', out], { stdio: 'ignore' });
      for (const [, slanted] of FACES) expect(readFileSync(join(out, `${slanted}.ttf`)).equals(readFileSync(join(assets, `${slanted}.ttf`))), slanted).toBe(true);
      for (const license of Object.values(LICENSES)) expect(readFileSync(join(out, license)).equals(readFileSync(join(assets, license)))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
