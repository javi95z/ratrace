import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What each of the game's fonts draws, how tall its small letters stand and where its lines stand, read from the TTF files
 * themselves and written to src/ui/fontCoverage.ts (committed; a test fails when it is stale).
 *
 *   pnpm --filter @ratrace/mobile exec tsx scripts/fontCoverage.ts
 *
 * React Native has no letter-by-letter fallback as the browser has, so text is cut into runs by which
 * font draws each character (runsOf in src/ui/fonts.ts); this is the table it cuts by.
 */
const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, '../node_modules/@expo-google-fonts');
const out = join(here, '../src/ui/fontCoverage.ts');

/** The family names the app registers (the packages' own export names), and the file each is read from. */
export const FONT_FILES = {
  Jersey15_400Regular: 'jersey-15/400Regular/Jersey15_400Regular.ttf',
  ChakraPetch_400Regular: 'chakra-petch/400Regular/ChakraPetch_400Regular.ttf',
  ChakraPetch_600SemiBold: 'chakra-petch/600SemiBold/ChakraPetch_600SemiBold.ttf',
  Oswald_500Medium: 'oswald/500Medium/Oswald_500Medium.ttf',
  Exo2_400Regular: 'exo-2/400Regular/Exo2_400Regular.ttf',
  Exo2_600SemiBold: 'exo-2/600SemiBold/Exo2_600SemiBold.ttf',
} as const;

export type FontFamily = keyof typeof FONT_FILES;

export function fontPath(family: FontFamily): string {
  return join(fontsDir, FONT_FILES[family]);
}

export interface FontFacts {
  unitsPerEm: number;
  sxHeight: number;
  /** hhea ascender and descender (the descender negative), in font units: what a line of the font stands on. */
  ascender: number;
  descender: number;
  /** Code points the font draws, as sorted [first, last] pairs, flattened. */
  ranges: number[];
}

function tableOf(view: DataView, tag: string): { offset: number; length: number } {
  const count = view.getUint16(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    const name = String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    if (name === tag) return { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
  }
  throw new Error(`no ${tag} table`);
}

/** The glyph each code point the font draws is drawn with, from its Unicode cmap (format 12 where it has one, else 4). */
function glyphsOf(view: DataView, cmap: number): Map<number, number> {
  const n = view.getUint16(cmap + 2);
  let best: { offset: number; format: number } | null = null;
  for (let i = 0; i < n; i++) {
    const platform = view.getUint16(cmap + 4 + i * 8);
    const encoding = view.getUint16(cmap + 6 + i * 8);
    const offset = cmap + view.getUint32(cmap + 8 + i * 8);
    const format = view.getUint16(offset);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode || (format !== 4 && format !== 12)) continue;
    if (!best || format === 12) best = { offset, format };
  }
  if (!best) throw new Error('no Unicode cmap');
  const glyphs = new Map<number, number>();
  const o = best.offset;
  if (best.format === 12) {
    const groups = view.getUint32(o + 12);
    for (let g = 0; g < groups; g++) {
      const at = o + 16 + g * 12;
      const first = view.getUint32(at);
      const last = view.getUint32(at + 4);
      const glyph = view.getUint32(at + 8);
      for (let c = first; c <= last; c++) if (glyph + (c - first) !== 0) glyphs.set(c, glyph + (c - first));
    }
  } else {
    const segs = view.getUint16(o + 6) / 2;
    const endCodes = o + 14;
    const startCodes = endCodes + segs * 2 + 2;
    const deltas = startCodes + segs * 2;
    const rangeOffsets = deltas + segs * 2;
    for (let s = 0; s < segs; s++) {
      const end = view.getUint16(endCodes + s * 2);
      const start = view.getUint16(startCodes + s * 2);
      const delta = view.getInt16(deltas + s * 2);
      const rangeOffset = view.getUint16(rangeOffsets + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let glyph: number;
        if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
        else {
          const g = view.getUint16(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2);
          glyph = g === 0 ? 0 : (g + delta) & 0xffff;
        }
        if (glyph !== 0 && !glyphs.has(c)) glyphs.set(c, glyph);
      }
    }
  }
  return glyphs;
}

function cmapRanges(view: DataView, cmap: number): number[] {
  const points = [...glyphsOf(view, cmap).keys()].sort((a, b) => a - b);
  const ranges: number[] = [];
  for (const c of points) {
    const last = ranges.length - 1;
    if (last >= 0 && ranges[last] === c - 1) ranges[last] = c;
    else if (last >= 0 && ranges[last] === c) continue;
    else ranges.push(c, c);
  }
  return ranges;
}

/**
 * How far each code point the font draws moves the pen, over the em (its glyph's advance in `hmtx`): what a line set in it is as wide as, with no kerning.
 * Null for one it does not draw.
 */
export function advancesOf(path: string): (point: number) => number | null {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const unitsPerEm = view.getUint16(tableOf(view, 'head').offset + 18);
  const metrics = view.getUint16(tableOf(view, 'hhea').offset + 34);
  const hmtx = tableOf(view, 'hmtx').offset;
  const glyphs = glyphsOf(view, tableOf(view, 'cmap').offset);
  return (point) => {
    const glyph = glyphs.get(point);
    if (glyph === undefined) return null;
    // Past the last full metric, every glyph has the last advance.
    return view.getUint16(hmtx + Math.min(glyph, metrics - 1) * 4) / unitsPerEm;
  };
}

export function readFont(path: string): FontFacts {
  const bytes = readFileSync(path);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const head = tableOf(view, 'head');
  const os2 = tableOf(view, 'OS/2');
  const cmap = tableOf(view, 'cmap');
  const hhea = tableOf(view, 'hhea');
  return {
    unitsPerEm: view.getUint16(head.offset + 18),
    // OS/2 version 2+ carries sxHeight at byte 86.
    sxHeight: view.getInt16(os2.offset + 86),
    ascender: view.getInt16(hhea.offset + 4),
    descender: view.getInt16(hhea.offset + 6),
    ranges: cmapRanges(view, cmap.offset),
  };
}

/** The text of src/ui/fontCoverage.ts. */
export function buildCoverage(): string {
  const families = Object.keys(FONT_FILES) as FontFamily[];
  const lines = [
    '// Written by apps/mobile/scripts/fontCoverage.ts from the fonts\' own tables. Do not edit by hand.',
    '',
    '/** Small-letter height over the em, by family (OS/2 sxHeight / head unitsPerEm). */',
    'export const X_HEIGHT: Record<string, number> = {',
  ];
  const facts = families.map((f) => [f, readFont(fontPath(f))] as const);
  for (const [f, d] of facts) lines.push(`  ${f}: ${d.sxHeight / d.unitsPerEm},`);
  lines.push('};', '', '/** Ascent and descent over the em, by family (hhea ascender and -descender / head unitsPerEm): where a line puts its baseline. */');
  lines.push('export const METRICS: Record<string, { ascent: number; descent: number }> = {');
  for (const [f, d] of facts) lines.push(`  ${f}: { ascent: ${d.ascender / d.unitsPerEm}, descent: ${-d.descender / d.unitsPerEm} },`);
  lines.push('};', '', '/** What each family draws: sorted [first, last] code point pairs, flattened. */', 'export const COVERAGE: Record<string, number[]> = {');
  // The weights of one family draw the same signs; the table keeps one list per family name the app uses.
  for (const [f, d] of facts) lines.push(`  ${f}: [${d.ranges.join(',')}],`);
  lines.push('};', '');
  return lines.join('\n');
}

/**
 * Arial, the stand-in next/font names after Jersey and Chakra (and that iOS and macOS ship): which signs it draws decides
 * whether the web shows a sign in it or in the system's fallback. Read from macOS's copy, so only written on a Mac.
 */
export const ARIAL_FILE = '/System/Library/Fonts/Supplemental/Arial.ttf';
const arialOut = join(here, '../src/ui/arialCoverage.ts');

/** The text of src/ui/arialCoverage.ts. */
export function buildArialCoverage(): string {
  const { ranges } = readFont(ARIAL_FILE);
  return [
    "// Written by apps/mobile/scripts/fontCoverage.ts from macOS's Arial. Do not edit by hand.",
    '',
    '/** What Arial draws: sorted [first, last] code point pairs, flattened. */',
    `export const ARIAL_COVERAGE: number[] = [${ranges.join(',')}];`,
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(out, buildCoverage());
  console.log(`wrote ${out}`);
  if (existsSync(ARIAL_FILE)) {
    writeFileSync(arialOut, buildArialCoverage());
    console.log(`wrote ${arialOut}`);
  }
}
