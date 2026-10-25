import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * The app's icons, drawn from the game's own icon (`art/clean/brand/brand.app_icon.png`, the one the site's icons are drawn from) at whole multiples,
 * so not one pixel blurs, and committed under `assets/` where app.json names them:
 *
 *   assets/icon.png                     the icon iOS and Android before 8 show: the badge on the game's night, filling it
 *   assets/android-icon-foreground.png  the adaptive icon's front: the badge at half the canvas, inside the circle every launcher's mask keeps
 *                                       (66 of its 108 dp); the back is app.json's `backgroundColor`, the same night
 *
 *   pnpm --filter @ratrace/mobile icons
 */
const here = dirname(fileURLToPath(import.meta.url));
const ICON = join(here, '../../../art/clean/brand/brand.app_icon.png');
const ASSETS = join(here, '../assets');
/** The colour of the game's night (the splash, the site's maskable icon). */
const NIGHT = '#141b33';

const png = { compressionLevel: 9 } as const;
const NONE = { r: 0, g: 0, b: 0, alpha: 0 };

async function main(): Promise<void> {
  const { width } = await sharp(ICON).metadata();
  if (width !== 256) throw new Error(`the game's icon is ${width} wide, not the 256 these multiples are made for`);
  await Promise.all([
    sharp(ICON).resize(1024, 1024, { kernel: sharp.kernel.nearest }).flatten({ background: NIGHT }).png(png).toFile(join(ASSETS, 'icon.png')),
    sharp(ICON)
      .resize(512, 512, { kernel: sharp.kernel.nearest })
      .extend({ top: 256, bottom: 256, left: 256, right: 256, background: NONE })
      .png(png)
      .toFile(join(ASSETS, 'android-icon-foreground.png')),
  ]);
}

void main().then(() => console.log('app icons: assets/icon.png, assets/android-icon-foreground.png'));
