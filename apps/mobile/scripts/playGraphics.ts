import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * The pictures Google Play asks of the store listing (docs/play/listing.md), drawn from the game's own pixels at whole multiples, as the site's
 * share image is (`scripts/sitePieces.ts`), into docs/play/graphics (committed):
 *
 *   icon-512.png           the store's icon: the badge on the game's night (Play rounds its corners itself)
 *   feature-1024x500.png   the feature graphic: the share image's night, skylines, rat in its wheel and name, at Play's size; no words of a language
 *
 *   pnpm --filter @ratrace/mobile play:graphics   (after `pnpm sprites`)
 */
const here = dirname(fileURLToPath(import.meta.url));
const SPRITES = join(here, '../public/sprites');
const OUT = join(here, '../../../docs/play/graphics');
const NIGHT = '#141b33';

const sprite = async (path: string, scale: number): Promise<Buffer> => {
  const file = join(SPRITES, path);
  const { width = 0, height = 0 } = await sharp(file).metadata();
  return sharp(file).resize(width * scale, height * scale, { kernel: sharp.kernel.nearest }).png().toBuffer();
};

async function icon(): Promise<void> {
  // The badge at 1.75 (448 of 512): whole pixels wide or narrow by one, and room for Play's rounded corners round the frame's own.
  const badge = await sharp(join(SPRITES, 'brand/brand.app_icon.png')).resize(448, 448, { kernel: sharp.kernel.nearest }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: NIGHT } })
    .composite([{ input: badge, left: 32, top: 32 }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, 'icon-512.png'));
}

async function feature(): Promise<void> {
  const width = 1024;
  const height = 500;
  const stars = [
    [110, 40], [300, 120], [470, 30], [560, 200], [690, 50], [780, 140], [900, 40], [990, 110], [60, 180], [380, 250], [960, 230],
  ].map(([x, y], i) => ({ input: { create: { width: 4, height: 4, channels: 4 as const, background: i % 2 ? '#f4f1e4' : '#ffe9a8' } }, left: x, top: y }));
  const [left, right, wheel, name] = await Promise.all([
    sprite('skylines/skyline.new_york.png', 2),
    sprite('skylines/skyline.madrid.png', 2),
    sprite('brand/brand.mascot.png', 2),
    sprite('brand/brand.wordmark.png', 2),
  ]);
  const half = (picture: Buffer) => sharp(picture).extract({ left: 56, top: 0, width: 512, height: 132 }).png().toBuffer();
  const ground = await sharp({ create: { width, height, channels: 4, background: NIGHT } })
    .composite([...stars, { input: await half(left), left: 0, top: height - 132 }, { input: await half(right), left: 512, top: height - 132 }])
    .png()
    .toBuffer();
  const cut = async (picture: Buffer, top: number) => sharp(picture).extract({ left: 0, top, width: 512, height: Math.min(512 - top, height) }).png().toBuffer();
  await sharp(ground)
    .composite([
      { input: await cut(wheel, 8), left: 20, top: 0 },
      { input: await cut(name, 40), left: 500, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, 'feature-1024x500.png'));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await Promise.all([icon(), feature()]);
  console.log(`play graphics: icon-512.png, feature-1024x500.png in ${OUT}`);
}

void main();
