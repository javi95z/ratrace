import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import robots from '../../web/src/app/robots';
import sitemap from '../../web/src/app/sitemap';
import manifest from '../../web/src/app/manifest';
import { PAGES as WEB_PAGES, SITE_URL as WEB_SITE } from '../../web/src/i18n/metadata';
import { LOCALES } from '@ratrace/i18n/locales';
import { PAGES } from '../src/game/pageList';
import { SITE_URL } from '../src/game/site';
import { ANDROID_APP, assetLinksJson, ICONS, manifestJson, robotsTxt, settlePages, sitemapXml, writeSitePieces } from './sitePieces';
import { SITE_FILES } from './webSize';

/*
 * What the site says to search engines and to the devices that install it, held to the Next web's: the sitemap, the robots file and the manifest are
 * serialized by Next's own writers from the web's own routes, and the app's must be the same bytes. The pictures (the share image, the icons) are the
 * ones the Next web's `scripts/pwa.ts` committed under apps/web/public, drawn again from the same sprites.
 */

const nextWrites = createRequire(new URL('../../web/package.json', import.meta.url))('next/dist/build/webpack/loaders/metadata/resolve-route-data') as {
  resolveSitemap: (data: unknown) => string;
  resolveRobots: (data: unknown) => string;
  resolveManifest: (data: unknown) => string;
};

const made = mkdtempSync(join(tmpdir(), 'site-pieces-'));
afterAll(() => rmSync(made, { recursive: true, force: true }));

describe('the sitemap, the robots file and the manifest', () => {
  it('serve the same site the Next web does: the address the game is published at', () => {
    expect(SITE_URL.href).toBe(WEB_SITE.href);
    expect([...PAGES].map((page) => (page === '' ? '' : `/${page}`))).toEqual([...WEB_PAGES]);
  });

  it('write the sitemap as Next writes the web\'s: every page but /play in every language, each naming its twins, byte for byte', () => {
    expect(sitemapXml(WEB_SITE)).toBe(nextWrites.resolveSitemap(sitemap()));
    const xml = sitemapXml(WEB_SITE);
    expect(xml).not.toMatch(/\/play</);
    expect(xml).toContain('/en/player</loc>');
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength((WEB_PAGES.length - 1) * 3);
    expect(xml).toContain('<loc>https://ratrace-plum.vercel.app/es/rankings</loc>');
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="ru" href="https://ratrace-plum.vercel.app/ru/rankings" />');
  });

  it('names the site it is made for, not the web\'s, when it is made for another', () => {
    const elsewhere = new URL('https://rats.example');
    expect(sitemapXml(elsewhere)).toContain('<loc>https://rats.example/en/new</loc>');
    expect(sitemapXml(elsewhere)).not.toContain('ratrace-plum');
    expect(robotsTxt(elsewhere)).toContain('Sitemap: https://rats.example/sitemap.xml');
  });

  it('write robots.txt as Next writes the web\'s', () => {
    expect(robotsTxt(WEB_SITE)).toBe(nextWrites.resolveRobots(robots()));
    expect(robotsTxt(WEB_SITE)).toContain('Disallow: /api/');
  });

  it('write the manifest as Next writes the web\'s: the id, the start page, the scope, standalone, the colour and the three icons', () => {
    expect(manifestJson()).toBe(nextWrites.resolveManifest(manifest()));
    const parsed = JSON.parse(manifestJson()) as Record<string, unknown>;
    expect(parsed).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', background_color: '#141b33', theme_color: '#141b33' });
    expect((parsed.icons as Array<{ src: string }>).map((icon) => icon.src)).toEqual(['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']);
  });
});

describe('the Android app\'s links (`.well-known/assetlinks.json`)', () => {
  it('name the app app.json builds, by the SHA-256 of a signing key, for the site\'s every page: Android opens them in the app', () => {
    expect(JSON.parse(assetLinksJson())).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_APP.package, sha256_cert_fingerprints: [...ANDROID_APP.keys] },
      },
    ]);
    for (const key of ANDROID_APP.keys) expect(key).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as {
      expo: { android: { package: string; intentFilters: Array<{ autoVerify?: boolean; data: Array<Record<string, string>> }> } };
    };
    expect(app.expo.android.package).toBe(ANDROID_APP.package);
    const [filter] = app.expo.android.intentFilters.filter((one) => one.autoVerify);
    expect(filter.data[0]).toEqual({ scheme: 'https', host: SITE_URL.host });
    // Each language's front door and its pages, and nothing of the site's beside them (its worker, its files).
    expect(filter.data.slice(1)).toEqual(LOCALES.flatMap((locale) => [{ path: `/${locale}` }, { pathPrefix: `/${locale}/` }]));
  });
});

describe('the files written into the export', () => {
  it('are the site\'s: the sitemap, robots, manifest, share image, icons, favicon and the Android app\'s links', async () => {
    const written = await writeSitePieces(made, WEB_SITE);
    expect(written.sort()).toEqual(
      ['.well-known/assetlinks.json', 'favicon.ico', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'manifest.webmanifest', 'og.png', 'robots.txt', 'sitemap.xml'].sort(),
    );
    // And the build's check finds each of them in the site (webSize.ts, `judgeSiteFiles`).
    for (const file of written) expect(SITE_FILES, file).toContain(file);
    expect(readFileSync(join(made, 'sitemap.xml'), 'utf8')).toBe(sitemapXml(WEB_SITE));
    expect(readFileSync(join(made, 'robots.txt'), 'utf8')).toBe(robotsTxt(WEB_SITE));
    expect(readFileSync(join(made, 'manifest.webmanifest'), 'utf8')).toBe(manifestJson());
    expect(readFileSync(join(made, '.well-known/assetlinks.json'), 'utf8')).toBe(assetLinksJson());
  });

  it('draw the share image and the icons as the Next web\'s are drawn: the same pixels, at the sizes every network and device asks for', async () => {
    const web = new URL('../../web/public/', import.meta.url);
    const pixels = async (file: string) => {
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height, channels: info.channels };
    };
    const differing: string[] = [];
    for (const file of ['og.png', 'favicon.ico', ...ICONS.map((icon) => `icons/${icon.file}`)]) {
      const mine = await pixels(join(made, file));
      const theirs = await pixels(new URL(file, web).pathname);
      expect(mine.width, file).toBe(theirs.width);
      expect(mine.height, file).toBe(theirs.height);
      let off = 0;
      for (let at = 0; at < mine.data.length; at += mine.channels) if (!mine.data.subarray(at, at + mine.channels).equals(theirs.data.subarray(at, at + theirs.channels))) off++;
      if (off > 0) differing.push(`${file}: ${off} of ${mine.width * mine.height} pixels`);
    }
    expect(differing).toEqual([]);
    expect(await sharp(join(made, 'og.png')).metadata()).toMatchObject({ width: 1200, height: 630, format: 'png' });
    expect(ICONS.map((icon) => [icon.file, icon.size])).toEqual([
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
      ['apple-touch-icon.png', 180],
    ]);
  });
});

describe('the pages the site serves', () => {
  it('are the game\'s, in every language, the bare address and the offline page: the router\'s templates and development\'s routes are dropped, its page of nothing the site\'s 404', () => {
    const out = mkdtempSync(join(tmpdir(), 'site-pages-'));
    try {
      const pages = ['en/index.html', 'en/play.html', 'es/index.html', 'ru/room.html', 'index.html', 'offline.html'];
      const templates = ['[locale].html', '[locale]/play.html', '[locale]/room.html', '_sitemap.html', 'kit.html', 'scene.html', 'dev.html', 'perf.html', 'auth.html', 'en/nowhere.html'];
      for (const file of [...pages, ...templates, '+not-found.html', '_expo/static/js/web/entry-abc.js']) {
        mkdirSync(join(out, file, '..'), { recursive: true });
        writeFileSync(join(out, file), file === '+not-found.html' ? 'the page of nothing' : file);
      }
      const settled = settlePages(out);
      expect(settled.dropped.sort()).toEqual([...templates].sort());
      for (const file of [...pages, '_expo/static/js/web/entry-abc.js']) expect(readFileSync(join(out, file), 'utf8'), file).toBe(file);
      for (const file of [...templates, '+not-found.html']) expect(existsSync(join(out, file)), file).toBe(false);
      // An address of no page is answered with the router's page of nothing (drawn by the app in the browser), with a 404 (the host's `404.html`).
      expect(readFileSync(join(out, '404.html'), 'utf8')).toBe('the page of nothing');
      // And no folder of templates is left behind.
      expect(readdirSync(out).sort()).toEqual(['404.html', '_expo', 'en', 'es', 'index.html', 'offline.html', 'ru']);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
