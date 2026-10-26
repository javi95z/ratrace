import { mkdirSync } from 'node:fs';
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
 *   assets/splash-mascot.png            the splash's picture (expo-splash-screen in app.json): the rat in its wheel, the front door's own
 *                                       first picture (`brand.mascot`), four times over, on the splash's night
 *   assets/shortcuts/<name>.png         the fronts of the Android shortcuts' icons (expo-quick-actions in app.json, game/shortcuts.ts): each a
 *                                       sprite of the game six times over in the middle of the 108 dp canvas, inside its mask; the back is night
 *
 *   pnpm --filter @ratrace/mobile icons
 */
const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '../../../art/clean');
const ICON = join(ART, 'brand/brand.app_icon.png');
/** The Android shortcuts' pictures, by the name app.json gives each icon: what each opens, as the front door shows it. */
export const SHORTCUT_ART = {
  shortcut_continue: 'icons/anim.wheel.0.png',
  shortcut_challenge: 'icons/icon.challenge.png',
  shortcut_new: 'icons/icon.star.png',
  shortcut_rankings: 'icons/icon.status.png',
} as const;
const ASSETS = join(here, '../assets');
/** The colour of the game's night (the splash, the site's maskable icon). */
const NIGHT = '#141b33';

const png = { compressionLevel: 9 } as const;
const NONE = { r: 0, g: 0, b: 0, alpha: 0 };

/** The room a shortcut's sprite is drawn in, in the middle of its 432-pixel canvas (108 dp at four times): inside every launcher's mask, with room round it. */
const SHORTCUT_ROOM = 192;

/** A sprite as many whole times over as fits `SHORTCUT_ROOM` (a 32-point one six, a 48-point one four), in the middle of its canvas. */
async function shortcutFront(sprite: string, file: string): Promise<void> {
  const { width = 0 } = await sharp(join(ART, sprite)).metadata();
  const side = Math.floor(SHORTCUT_ROOM / width) * width;
  if (side === 0) throw new Error(`${sprite} is ${width} wide, more than the ${SHORTCUT_ROOM} a shortcut has`);
  const margin = (432 - side) / 2;
  await sharp(join(ART, sprite))
    .resize(side, side, { kernel: sharp.kernel.nearest })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: NONE })
    .png(png)
    .toFile(file);
}

async function main(): Promise<void> {
  const { width } = await sharp(ICON).metadata();
  if (width !== 256) throw new Error(`the game's icon is ${width} wide, not the 256 these multiples are made for`);
  mkdirSync(join(ASSETS, 'shortcuts'), { recursive: true });
  await Promise.all([
    sharp(join(ART, 'brand/brand.mascot.png')).resize(1024, 1024, { kernel: sharp.kernel.nearest }).png(png).toFile(join(ASSETS, 'splash-mascot.png')),
    ...Object.entries(SHORTCUT_ART).map(([name, sprite]) => shortcutFront(sprite, join(ASSETS, 'shortcuts', `${name}.png`))),
    sharp(ICON).resize(1024, 1024, { kernel: sharp.kernel.nearest }).flatten({ background: NIGHT }).png(png).toFile(join(ASSETS, 'icon.png')),
    sharp(ICON)
      .resize(512, 512, { kernel: sharp.kernel.nearest })
      .extend({ top: 256, bottom: 256, left: 256, right: 256, background: NONE })
      .png(png)
      .toFile(join(ASSETS, 'android-icon-foreground.png')),
  ]);
}

void main().then(() => console.log('app icons: assets/icon.png, assets/android-icon-foreground.png, assets/splash-mascot.png, assets/shortcuts/*.png'));
