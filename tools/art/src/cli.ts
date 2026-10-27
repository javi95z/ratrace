import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { composeContact } from './contact';
import { EXTRA_COLOURS, FIXED_PALETTE, GIVEN_COLOURS } from './fixed-palette';
import type { Image, Rgb } from './image';
import { buildPalette, Histogram, snap, withGiven } from './palette';
import { cutSheet } from './pipeline';
import type { Sprite } from './pipeline';
import { SHEETS } from './sheets';
import { countKeyRemnants, opaqueCount, removeStrays } from './strays';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = path.join(ROOT, 'art/raw');
const CLEAN = path.join(ROOT, 'art/clean');
const CONTACT = path.join(ROOT, 'art/contact');
const PALETTE_FILE = path.join(CLEAN, 'palette.json');

const NAVY: Rgb = [31, 42, 77];
const CREAM: Rgb = [244, 241, 228];

/** How each group is laid out on its contact sheet. Scenes are opaque, so one background is enough. */
const CONTACT_LAYOUT: Record<string, { columns: number; scale: number; backgrounds: Rgb[] }> = {
  items: { columns: 8, scale: 3, backgrounds: [NAVY, CREAM] },
  cars: { columns: 4, scale: 3, backgrounds: [NAVY, CREAM] },
  homes: { columns: 5, scale: 2, backgrounds: [NAVY, CREAM] },
  icons: { columns: 8, scale: 4, backgrounds: [NAVY, CREAM] },
  badges: { columns: 8, scale: 3, backgrounds: [NAVY, CREAM] },
  portraits: { columns: 8, scale: 3, backgrounds: [NAVY, CREAM] },
  cards: { columns: 3, scale: 2, backgrounds: [NAVY] },
  skylines: { columns: 2, scale: 2, backgrounds: [NAVY] },
  brand: { columns: 4, scale: 1, backgrounds: [NAVY, CREAM] },
  rat_body: { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] },
  rat_face: { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] },
  rat_outfit: { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] },
  rat_hat: { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] },
  rat_eyes: { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] },
  rat_backdrop: { columns: 8, scale: 2, backgrounds: [NAVY] },
};

const exists = (file: string) => access(file).then(() => true, () => false);

async function readImage(file: string): Promise<Image> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}

async function writePng(file: string, image: Image): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

interface Cleaned extends Sprite {
  notes: string[];
}

async function main(): Promise<void> {
  const rebuildPalette = process.argv.includes('--rebuild-palette');
  const missing: string[] = [];
  const sprites: Sprite[] = [];

  const found = async (name: string) => {
    const base = path.join(RAW, name);
    return (await exists(`${base}.png`)) ? `${base}.png` : (await exists(`${base}.webp`)) ? `${base}.webp` : null;
  };
  for (const spec of SHEETS) {
    const file = await found(spec.file);
    const overFile = spec.over === undefined ? null : await found(spec.over);
    if (file === null || (spec.over !== undefined && overFile === null)) {
      missing.push(spec.file);
      continue;
    }
    sprites.push(...cutSheet(await readImage(file), spec, overFile === null ? undefined : await readImage(overFile)));
  }

  const ids = new Set<string>();
  for (const sprite of sprites) {
    if (ids.has(sprite.id)) throw new Error(`two sprites are named ${sprite.id}`);
    ids.add(sprite.id);
  }

  // Each group has its own palette: the 31 interface colours plus up to 33 taken from that group's art.
  // One palette for everything could not hold skin tones, car paint and night skies at once.
  const groups = [...new Set(sprites.map((s) => s.group))];
  let palettes: Record<string, Rgb[]>;
  if (!rebuildPalette && (await exists(PALETTE_FILE))) {
    palettes = JSON.parse(await readFile(PALETTE_FILE, 'utf8')) as Record<string, Rgb[]>;
  } else {
    palettes = {};
    for (const group of groups) {
      const histogram = new Histogram();
      for (const sprite of sprites) if (sprite.group === group) histogram.addImage(sprite.image);
      palettes[group] = buildPalette(FIXED_PALETTE, histogram, EXTRA_COLOURS);
    }
  }
  // A group new since the palettes were made gets its own, leaving those of the others as they were.
  for (const group of groups) {
    if (palettes[group]) continue;
    const histogram = new Histogram();
    for (const sprite of sprites) if (sprite.group === group) histogram.addImage(sprite.image);
    palettes[group] = buildPalette(FIXED_PALETTE, histogram, EXTRA_COLOURS);
  }
  palettes = withGiven(palettes, GIVEN_COLOURS);

  await rm(CLEAN, { recursive: true, force: true });
  await rm(CONTACT, { recursive: true, force: true });
  await mkdir(CLEAN, { recursive: true });
  await writeFile(PALETTE_FILE, `${JSON.stringify(palettes)}\n`);

  const cleaned: Cleaned[] = [];
  const manifest: Record<string, { file: string; width: number; height: number }> = {};
  for (const sprite of sprites) {
    const notes: string[] = [...sprite.flags];
    const image = snap(sprite.image, palettes[sprite.group]);
    const before = opaqueCount(image);
    const isScene = before === image.width * image.height;
    const remnants = isScene ? 0 : countKeyRemnants(sprite.image);
    const strays = isScene ? 0 : removeStrays(image);
    if (remnants > 0) notes.push(`${remnants} key-coloured pixels`);
    if (strays > before * 0.015) notes.push(`${strays} stray pixels removed`);
    const file = `${sprite.group}/${sprite.id}.png`;
    await writePng(path.join(CLEAN, file), image);
    manifest[sprite.id] = { file, width: image.width, height: image.height };
    cleaned.push({ ...sprite, image, notes });
  }
  await writeFile(path.join(CLEAN, 'manifest.json'), `${JSON.stringify({ version: 1, sprites: manifest }, null, 2)}\n`);

  for (const group of groups) {
    const members = cleaned.filter((s) => s.group === group);
    const layout = CONTACT_LAYOUT[group] ?? { columns: 8, scale: 2, backgrounds: [NAVY, CREAM] };
    await writePng(path.join(CONTACT, `${group}.png`), composeContact(members.map((s) => s.image), layout));
  }

  const flagged = cleaned.filter((s) => s.notes.length > 0);
  const lines = [
    '# Art report',
    '',
    `Sprites: ${cleaned.length}. Every group uses the ${FIXED_PALETTE.length} interface colours plus its own.`,
    '',
    '| Group | Sprites | Size | Colours |',
    '|---|---|---|---|',
    ...groups.map((group) => {
      const members = cleaned.filter((s) => s.group === group);
      return `| ${group} | ${members.length} | ${members[0].image.width}×${members[0].image.height} | ${palettes[group].length} |`;
    }),
    '',
    missing.length > 0 ? `Missing sheets: ${missing.join(', ')}` : 'No sheets missing.',
    '',
    flagged.length > 0 ? '| Sprite | Notes |\n|---|---|' : 'No sprites flagged.',
    ...flagged.map((s) => `| ${s.id} | ${s.notes.join('; ')} |`),
    '',
  ];
  await writeFile(path.join(CLEAN, 'report.md'), lines.join('\n'));
  console.log(lines.join('\n'));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
