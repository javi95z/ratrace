import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Puts the approved sprites where Metro can bundle them, and writes what the app reads, as the web's
 * scripts/sprites.ts does for the browser:
 *
 *   art/clean/<group>/<id>.png   →  assets/sprites/sheets/<group>.png (not committed; written on every install and before every start: a group that
 *                                                                        fits on one sheet, its sprites side by side, for the phone)
 *                                →  assets/sprites/<group>/<id>.png   (the same: a sprite of a group too large for one sheet, for the phone)
 *                                →  public/sprites/<group>/<id>.png   (the same: every sprite, the web export's, served at /sprites as the Next web serves them)
 *   art/clean/manifest.json      →  src/sprites/manifest.json         (committed; a test fails when it is stale)
 *                                →  src/sprites/sources.ts            (committed: one static require per id, as Metro asks)
 *
 *   pnpm --filter @ratrace/mobile sprites
 */
const here = dirname(fileURLToPath(import.meta.url));
const art = join(here, '../../../art/clean');

/** Where the sprites are copied, from the app's folder: Metro's assets for the phone, and the site's files for the web (`src/sprites/sources.web.ts`). */
export const SPRITE_COPIES = ['assets/sprites', 'public/sprites'] as const;

interface ArtManifest {
  sprites: Record<string, { file: string; width: number; height: number }>;
}

export interface SpriteEntry {
  /** Path under assets/sprites (and under the web's /sprites). */
  src: string;
  w: number;
  h: number;
}

/**
 * The side of a sheet, at most. The phone reads a group of small sprites as one file and cuts each out (ui/spriteSheets.ts), as EAS Update takes at
 * most 1000 files an update and the art alone is more: what fits on one sheet is a group a screen draws many of at once (icons, badges, a rat's
 * parts), one read for all. A group that does not (the cards, the homes) stays a file a sprite, read alone: a card is never cut from 40 MiB of others.
 */
export const SHEET_SIDE = 1024;

/** Where a sprite lies on its group's sheet. */
export interface SheetPiece {
  sheet: string;
  x: number;
  y: number;
}

export interface Sheets {
  /** Each sheet by its group's name, and its size. */
  sheets: Record<string, { w: number; h: number }>;
  /** Each packed sprite's place; a sprite not here is a file of its own. */
  pieces: Record<string, SheetPiece>;
}

const groupOf = (entry: SpriteEntry): string => entry.src.split('/')[0];

/**
 * Lays each group's sprites in rows on a sheet of its own, the tallest first (then the widest, then by id: the same sheets every time), and keeps the
 * groups that fit on one sheet of SHEET_SIDE. A sheet is as large as what is on it.
 */
export function packSheets(manifest: Record<string, SpriteEntry>): Sheets {
  const groups = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(manifest)) groups.set(groupOf(entry), [...(groups.get(groupOf(entry)) ?? []), id]);
  const out: Sheets = { sheets: {}, pieces: {} };
  for (const [group, ids] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!/^[a-z_]+$/.test(group)) continue;
    const order = [...ids].sort((a, b) => manifest[b].h - manifest[a].h || manifest[b].w - manifest[a].w || (a < b ? -1 : 1));
    const pieces: Record<string, SheetPiece> = {};
    let x = 0;
    let y = 0;
    let row = 0;
    let w = 0;
    for (const id of order) {
      const sprite = manifest[id];
      if (x + sprite.w > SHEET_SIDE) {
        y += row;
        x = 0;
        row = 0;
      }
      pieces[id] = { sheet: group, x, y };
      x += sprite.w;
      w = Math.max(w, x);
      row = Math.max(row, sprite.h);
    }
    const h = y + row;
    if (h > SHEET_SIDE || w > SHEET_SIDE) continue;
    out.sheets[group] = { w, h };
    Object.assign(out.pieces, pieces);
  }
  return out;
}

/** How many files of art the phone bundles: its sheets, and the sprites of the groups too large for one. */
export const phoneSpriteFiles = (sheets: Sheets, manifest: Record<string, SpriteEntry>): number =>
  Object.keys(sheets.sheets).length + Object.keys(manifest).filter((id) => !Object.hasOwn(sheets.pieces, id)).length;

/** The same list the web writes: id → file and size, sorted by id. */
export function buildManifest(source: ArtManifest): Record<string, SpriteEntry> {
  const entries = Object.entries(source.sprites)
    .map(([id, sprite]): [string, SpriteEntry] => [id, { src: sprite.file, w: sprite.width, h: sprite.height }])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

/** The module that names every sprite for Metro: its own file, or its piece of its group's sheet. */
export function sourcesFile(manifest: Record<string, SpriteEntry>, sheets: Sheets): string {
  const lines = Object.entries(manifest).map(([id, entry]) => {
    const piece = Object.hasOwn(sheets.pieces, id) ? sheets.pieces[id] : null;
    return piece
      ? `  '${id}': { sheet: SHEETS.${piece.sheet}, x: ${piece.x}, y: ${piece.y}, w: ${entry.w}, h: ${entry.h} },`
      : `  '${id}': require('../../assets/sprites/${entry.src}'),`;
  });
  return [
    '// Written by scripts/sprites.ts: do not edit. Metro bundles an image only through a static require.',
    "import type { SpriteSource } from '../ui/spriteSheets';",
    '',
    '/** The sheets of the groups of small sprites, each a file (a sprite of one is cut out of it as it is read: ui/spriteSheets.ts). */',
    'const SHEETS = {',
    ...Object.keys(sheets.sheets).map((name) => `  ${name}: require('../../assets/sprites/sheets/${name}.png'),`),
    '};',
    '',
    'export const SOURCES: Record<string, SpriteSource> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

/** Each sheet's pixels, every sprite's copied in as they are (no blending: a transparent pixel keeps its colour), written as a PNG. */
async function writeSheets(manifest: Record<string, SpriteEntry>, sheets: Sheets, out: string): Promise<void> {
  mkdirSync(out, { recursive: true });
  for (const [name, size] of Object.entries(sheets.sheets)) {
    const pixels = Buffer.alloc(size.w * size.h * 4);
    for (const [id, piece] of Object.entries(sheets.pieces)) {
      if (piece.sheet !== name) continue;
      const { w, h } = manifest[id];
      const { data, info } = await sharp(join(art, manifest[id].src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.width !== w || info.height !== h || info.channels !== 4) throw new Error(`sprites: ${id} is ${info.width}x${info.height}x${info.channels}, not ${w}x${h}x4`);
      for (let row = 0; row < h; row++) data.copy(pixels, ((piece.y + row) * size.w + piece.x) * 4, row * w * 4, (row + 1) * w * 4);
    }
    await sharp(pixels, { raw: { width: size.w, height: size.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(out, `${name}.png`));
  }
}

async function main(): Promise<void> {
  if (!existsSync(join(art, 'manifest.json'))) {
    console.warn('sprites: art/clean/manifest.json not found; the app will run on placeholders');
    return;
  }
  const source = JSON.parse(readFileSync(join(art, 'manifest.json'), 'utf8')) as ArtManifest;
  const manifest = buildManifest(source);
  const sheets = packSheets(manifest);

  for (const copy of SPRITE_COPIES) {
    const out = join(here, '..', copy);
    rmSync(out, { recursive: true, force: true });
    // The phone's copy holds only what it bundles: the sheets, and the sprites on none.
    const phone = copy === 'assets/sprites';
    for (const [id, entry] of Object.entries(manifest)) {
      if (phone && Object.hasOwn(sheets.pieces, id)) continue;
      mkdirSync(dirname(join(out, entry.src)), { recursive: true });
      cpSync(join(art, entry.src), join(out, entry.src));
    }
    if (phone) await writeSheets(manifest, sheets, join(out, 'sheets'));
  }
  mkdirSync(join(here, '../src/sprites'), { recursive: true });
  writeFileSync(join(here, '../src/sprites/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(here, '../src/sprites/sources.ts'), sourcesFile(manifest, sheets));
  console.log(`sprites: ${Object.keys(manifest).length} copied, the phone's in ${phoneSpriteFiles(sheets, manifest)} files (${Object.keys(sheets.sheets).length} sheets)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
