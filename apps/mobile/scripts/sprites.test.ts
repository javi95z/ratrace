import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import sharp from 'sharp';
import { buildManifest, packSheets, phoneSpriteFiles, SHEET_SIDE, sourcesFile, SPRITE_COPIES } from './sprites';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const art = JSON.parse(read('../../../art/clean/manifest.json'));
const committed = JSON.parse(read('../src/sprites/manifest.json'));

test("the app's manifest is the web's: the same ids, files and sizes", () => {
  expect(committed).toEqual(JSON.parse(read('../../web/src/sprites/manifest.json')));
});

test('the committed manifest is what art/clean gives today (run `pnpm --filter @ratrace/mobile sprites` when it is stale)', () => {
  expect(committed).toEqual(buildManifest(art));
  expect(Object.keys(committed).length).toBeGreaterThan(1000);
});

const sheets = packSheets(committed);

test('the small groups are packed on sheets of their own, each piece inside its sheet and none over another; the large groups stay a file a sprite', () => {
  const groupOf = (id: string) => committed[id].src.split('/')[0];
  const packed = new Set(Object.keys(sheets.pieces).map(groupOf));
  // What a screen draws a handful of at once, of all sizes, is one sheet a group (one read for every icon); a card or a home is read alone.
  for (const group of ['icons', 'items', 'badges', 'portraits', 'brand', 'cars', 'skylines', 'rat_body', 'rat_hat']) expect(packed).toContain(group);
  for (const group of ['cards', 'homes']) expect(packed).not.toContain(group);
  for (const [name, sheet] of Object.entries(sheets.sheets)) {
    expect(name).toMatch(/^[a-z_]+$/);
    expect(sheet.w).toBeLessThanOrEqual(SHEET_SIDE);
    expect(sheet.h).toBeLessThanOrEqual(SHEET_SIDE);
    const inside = Object.entries(sheets.pieces).filter(([, piece]) => piece.sheet === name);
    for (const [id, piece] of inside) {
      expect(groupOf(id)).toBe(name);
      expect(piece.x + committed[id].w).toBeLessThanOrEqual(sheet.w);
      expect(piece.y + committed[id].h).toBeLessThanOrEqual(sheet.h);
    }
    for (const [i, [a, pa]] of inside.entries()) {
      for (const [b, pb] of inside.slice(i + 1)) {
        const apart = pa.x + committed[a].w <= pb.x || pb.x + committed[b].w <= pa.x || pa.y + committed[a].h <= pb.y || pb.y + committed[b].h <= pa.y;
        expect(apart, `${a} and ${b}`).toBe(true);
      }
    }
  }
});

test('the phone bundles few enough files that an update over the air goes (EAS Update takes at most 1000 assets, the fonts and sounds among them)', () => {
  const loose = Object.keys(committed).filter((id) => !Object.hasOwn(sheets.pieces, id)).length;
  expect(phoneSpriteFiles(sheets, committed)).toBe(loose + Object.keys(sheets.sheets).length);
  expect(phoneSpriteFiles(sheets, committed)).toBeLessThanOrEqual(600);
});

test('sources.ts names every sprite by one static require: its own file, or its piece of its sheet', () => {
  const text = read('../src/sprites/sources.ts');
  expect(text).toBe(sourcesFile(committed, sheets));
  const files = [...text.matchAll(/^ {2}'([^']+)': require\('\.\.\/\.\.\/assets\/sprites\/([^']+)'\),$/gm)];
  const pieces = [...text.matchAll(/^ {2}'([^']+)': \{ sheet: SHEETS\.([a-z_]+), x: (\d+), y: (\d+), w: (\d+), h: (\d+) \},$/gm)];
  expect([...files, ...pieces].map((m) => m[1]).sort()).toEqual(Object.keys(committed).sort());
  for (const [, id, file] of files) {
    expect(file).toBe(committed[id].src);
    expect(existsSync(join(here, '../../../art/clean', file))).toBe(true);
  }
  for (const [, id, sheet, x, y, w, h] of pieces) {
    expect({ sheet, x: Number(x), y: Number(y) }).toEqual(sheets.pieces[id]);
    expect({ w: Number(w), h: Number(h) }).toEqual({ w: committed[id].w, h: committed[id].h });
  }
  for (const name of Object.keys(sheets.sheets)) expect(text).toContain(`  ${name}: require('../../assets/sprites/sheets/${name}.png'),`);
});

test("each sheet holds its sprites pixel for pixel, the transparent ones' colours too (written by `pnpm sprites`, on every install)", async () => {
  const raw = (path: string) => sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const name of Object.keys(sheets.sheets)) {
    const sheet = await raw(join(here, '../assets/sprites/sheets', `${name}.png`));
    expect({ w: sheet.info.width, h: sheet.info.height }).toEqual(sheets.sheets[name]);
    for (const [id, piece] of Object.entries(sheets.pieces).filter(([, p]) => p.sheet === name)) {
      const own = await raw(join(here, '../../../art/clean', committed[id].src));
      const { w } = committed[id];
      for (let row = 0; row < committed[id].h; row++) {
        const at = ((piece.y + row) * sheet.info.width + piece.x) * 4;
        expect(sheet.data.subarray(at, at + w * 4).equals(own.data.subarray(row * w * 4, (row + 1) * w * 4)), `${id}, row ${row}`).toBe(true);
      }
    }
  }
});

test('the sprites are copied on every install (and on EAS after its install): a fresh checkout or a build bundles with no step of its own', () => {
  const pkg = JSON.parse(read('../package.json')) as { scripts: Record<string, string> };
  expect(pkg.scripts.sprites).toBe('tsx scripts/sprites.ts');
  // (The rules of the older versions are copied at the same moments: see rules.test.ts.)
  expect(pkg.scripts.postinstall).toMatch(/^pnpm sprites\b/);
  expect(pkg.scripts['eas-build-post-install']).toMatch(/^pnpm sprites\b/);
});

test('the sprites are copied for the web export too, where the site serves them (public/sprites, as the Next web\'s), and neither copy is committed', () => {
  expect(SPRITE_COPIES).toEqual(['assets/sprites', 'public/sprites']);
  const ignored = read('../.gitignore').split('\n');
  expect(ignored).toContain('/assets/sprites/');
  expect(ignored).toContain('/public/sprites/');
});
