import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOCALES } from '@ratrace/i18n/locales';
import sharp from 'sharp';
import { PAGES } from '../src/game/pageList';
import { SITE_URL } from '../src/game/site';

/**
 * What the site says to search engines and to the devices that install it, written into the web export after `expo export` (the build runs this
 * next: `pnpm --filter @ratrace/mobile site:pieces <export folder>`): `sitemap.xml` and `robots.txt` (as the Next web's `src/app/sitemap.ts` and
 * `robots.ts`, written as Next writes them), `manifest.webmanifest` (`src/app/manifest.ts`), the share image `og.png`, the icons and `favicon.ico`
 * (the Next web's `scripts/pwa.ts`, drawn from the same sprites). Each page's own head (title, addresses, Open Graph, card) is in its HTML
 * (`src/game/pageHead.web.tsx`). `sharp` is the repo's (a root devDependency, as the Next web's `scripts/pwa.ts` takes it).
 */
const here = dirname(fileURLToPath(import.meta.url));
/** The sprites the export carries (`pnpm sprites` copies them from art/clean), the same files the Next web draws its icons and share image from. */
const SPRITES = join(here, '../public/sprites');
const ICON = join(SPRITES, 'brand/brand.app_icon.png');
/** The colour of the game's night, behind the icons that need a ground and the share image. */
const NIGHT = '#141b33';

/** The icons, as the Next web's manifest and head name them: the ordinary two, the maskable one (with room round it) and the one iOS puts on a home screen. */
export const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
] as const;

/** The page's address after the language, as the Next web's `PAGES` write it: the front door is the empty one. */
const pathOf = (page: string) => (page === '' ? '' : `/${page}`);

/** Every page worth finding, in each language, each naming its twins in the others. A life on screen is a player's own, and is left out. Written as Next writes a sitemap. */
export function sitemapXml(site: URL): string {
  const at = (path: string) => new URL(path, site).href;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  for (const page of PAGES.filter((one) => one !== 'play')) {
    for (const locale of LOCALES) {
      xml += `<url>\n<loc>${at(`/${locale}${pathOf(page)}`)}</loc>\n`;
      for (const other of LOCALES) xml += `<xhtml:link rel="alternate" hreflang="${other}" href="${at(`/${other}${pathOf(page)}`)}" />\n`;
      xml += `<changefreq>${page === 'challenge' || page === 'rankings' ? 'weekly' : 'monthly'}</changefreq>\n<priority>${page === '' ? 1 : 0.6}</priority>\n</url>\n`;
    }
  }
  return `${xml}</urlset>\n`;
}

/** Everything may be read but what is not a page; the sitemap says where the pages are. */
export function robotsTxt(site: URL): string {
  return `User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
}

/** The install metadata shared by all languages (`/` chooses the player's language on first launch), as the Next web's `manifest.ts`. */
export function manifestJson(): string {
  return JSON.stringify({
    id: '/',
    name: 'The Rat Race',
    short_name: 'Rat Race',
    description: 'Forty years, twenty rounds. Get rich, gain status and escape the rat race.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: NIGHT,
    theme_color: NIGHT,
    categories: ['games', 'strategy'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
}

/** The icons and the favicon, drawn from the game's own pixels at whole multiples so not one of them blurs (as the Next web's `scripts/pwa.ts`). */
async function writeIcons(out: string): Promise<string[]> {
  mkdirSync(join(out, 'icons'), { recursive: true });
  const png = { compressionLevel: 9, palette: true } as const;
  const ordinary = (size: number) => sharp(ICON).resize(size, size, { kernel: sharp.kernel.nearest }).png(png);
  await Promise.all([
    ordinary(192).toFile(join(out, 'icons/icon-192.png')),
    ordinary(512).toFile(join(out, 'icons/icon-512.png')),
    sharp(ICON)
      .resize(384, 384, { kernel: sharp.kernel.nearest })
      .extend({ top: 64, bottom: 64, left: 64, right: 64, background: NIGHT })
      .png(png)
      .toFile(join(out, 'icons/icon-maskable-512.png')),
    sharp(ICON).resize(180, 180, { kernel: sharp.kernel.nearest }).flatten({ background: NIGHT }).png(png).toFile(join(out, 'icons/apple-touch-icon.png')),
    // Browsers still probe this conventional address after client-side navigations. PNG data is valid for a modern favicon whatever its name ends in.
    ordinary(32).toFile(join(out, 'favicon.ico')),
  ]);
  return ['favicon.ico', ...ICONS.map((icon) => `icons/${icon.file}`)];
}

/** The size every network asks of the picture a shared link shows. */
export const SHARE_IMAGE = { width: 1200, height: 630 } as const;

/**
 * The picture of a shared link, drawn from the game's own pixels at whole multiples: a night sky with a few stars, two skylines along the bottom,
 * the rat in its wheel on the left and the name on the right. It holds no words of any language, so one picture serves them all.
 */
async function writeShareImage(out: string): Promise<string[]> {
  const { width, height } = SHARE_IMAGE;
  const sprite = async (path: string, scale: number) => {
    const file = join(SPRITES, path);
    const { width: w = 0, height: h = 0 } = await sharp(file).metadata();
    return sharp(file).resize(w * scale, h * scale, { kernel: sharp.kernel.nearest }).png().toBuffer();
  };
  // Stars at fixed places, four pixels square, in the two creams of the game.
  const stars = [
    [120, 60], [260, 140], [420, 40], [560, 110], [700, 60], [820, 150], [960, 50], [1100, 120], [1160, 30], [60, 200], [340, 230], [1040, 220],
  ].map(([x, y], i) => ({ input: { create: { width: 4, height: 4, channels: 4 as const, background: i % 2 ? '#f4f1e4' : '#ffe9a8' } }, left: x, top: y }));
  const [left, right, wheel, name] = await Promise.all([
    sprite('skylines/skyline.new_york.png', 2),
    sprite('skylines/skyline.madrid.png', 2),
    sprite('brand/brand.mascot.png', 2),
    sprite('brand/brand.wordmark.png', 2),
  ]);
  await sharp({ create: { width, height, channels: 4, background: NIGHT } })
    .composite([
      ...stars,
      { input: left, left: 0, top: height - 132 },
      { input: right, left: 600, top: height - 132 },
      { input: wheel, left: 40, top: 20 },
      { input: name, left: 640, top: 40 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(out, 'og.png'));
  return ['og.png'];
}

/** Writes the site's pieces into the export in `out` for the site at `site`, and gives back the files it wrote, by their path from `out`. */
export async function writeSitePieces(out: string, site: URL = SITE_URL): Promise<string[]> {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'sitemap.xml'), sitemapXml(site));
  writeFileSync(join(out, 'robots.txt'), robotsTxt(site));
  writeFileSync(join(out, 'manifest.webmanifest'), manifestJson());
  return [...(await writeIcons(out)), ...(await writeShareImage(out)), 'sitemap.xml', 'robots.txt', 'manifest.webmanifest'];
}

async function main() {
  const out = resolve(process.argv[2] ?? join(here, '../dist'));
  const files = await writeSitePieces(out);
  console.log(`site pieces: ${files.length} files in ${out} for ${SITE_URL.href}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) void main();
