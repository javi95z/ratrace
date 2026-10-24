import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { FIRST_PAGE, FIRST_PAGE_GZIP_BUDGET, FORBIDDEN, JS_GZIP_BUDGET, exportEnv, firstPageOf, judgeFirstVisit, judgeWebExport, mib, pageFiles, sourcesOf } from './webSize';

/** A JS file of this many bytes that gzip cannot shrink (random-looking), so its gzip size is about its own. */
function noise(bytes: number): Buffer {
  const out = Buffer.alloc(bytes);
  let seed = 1;
  for (let i = 0; i < bytes; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out[i] = seed >>> 24;
  }
  return out;
}

const APP = '_expo/static/js/web/';
const small = { path: '_expo/static/js/web/entry-abc.js', bytes: Buffer.from('console.log(1)') };

describe('judgeWebExport', () => {
  it('finds nothing wrong with a small clean export', () => {
    expect(judgeWebExport([small, { path: 'index.html', bytes: Buffer.from('<html></html>') }], ['node_modules/react/index.js', 'apps/mobile/src/ui/Sprite.tsx'])).toEqual([]);
  });

  it('reports a .wasm file', () => {
    const problems = judgeWebExport([small, { path: '_expo/static/js/web/canvaskit-1.wasm', bytes: Buffer.from([0, 97, 115, 109]) }], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('canvaskit-1.wasm');
  });

  it('reports a JS total over the budget in gzip, and not one under it', () => {
    expect(JS_GZIP_BUDGET).toBe(1_350 * 1024);
    const over = noise(JS_GZIP_BUDGET + 64 * 1024);
    expect(gzipSync(over).length).toBeGreaterThan(JS_GZIP_BUDGET);
    const problems = judgeWebExport([{ path: `${APP}a.js`, bytes: over }], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/gzip/);
    // Two files count together, and only .js counts.
    const half = noise(Math.floor(JS_GZIP_BUDGET * 0.6));
    expect(judgeWebExport([{ path: `${APP}a.js`, bytes: half }, { path: `${APP}b.js`, bytes: half }], [])).toHaveLength(1);
    expect(judgeWebExport([{ path: `${APP}a.js`, bytes: half }, { path: `${APP}b.map`, bytes: half }, { path: 'c.png', bytes: half }], [])).toEqual([]);
  });

  it("does not count the older rules the site serves, but the app's own JavaScript", () => {
    const big = noise(JS_GZIP_BUDGET + 64 * 1024);
    expect(judgeWebExport([small, { path: 'rules/v0.40.0-1.41.0.js', bytes: big }], [], ['v0.40.0-1.41.0.js'])).toEqual([]);
    const problems = judgeWebExport([{ path: `${APP}x.js`, bytes: big }], []);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/gzip/);
  });

  it('reports older rules the export does not serve, and not when it serves them all', () => {
    const expected = ['v0.39.0-1.40.0.js', 'v0.40.0-1.41.0.js'];
    const served = (...names: string[]) => names.map((name) => ({ path: `rules/${name}`, bytes: Buffer.from('export {}') }));
    expect(judgeWebExport([small, ...served(...expected)], [], expected)).toEqual([]);
    const partial = judgeWebExport([small, ...served('v0.39.0-1.40.0.js')], [], expected);
    expect(partial).toHaveLength(1);
    expect(partial[0]).toContain('v0.40.0-1.41.0.js');
    // No folder at all, or a file of the same name elsewhere, is the same problem.
    expect(judgeWebExport([small], [], expected)).toHaveLength(1);
    expect(judgeWebExport([small, { path: `${APP}v0.39.0-1.40.0.js`, bytes: Buffer.from('') }, ...served('v0.40.0-1.41.0.js')], [], expected)).toHaveLength(1);
  });

  it.each([
    '@shopify/react-native-skia',
    'canvaskit-wasm',
    'expo-sqlite',
    '@formatjs/intl-getcanonicallocales',
    '@formatjs/intl-locale',
    '@formatjs/intl-pluralrules',
    '@formatjs/intl-numberformat',
    '@formatjs/intl-datetimeformat',
    '@formatjs/intl-relativetimeformat',
    '@formatjs/intl-listformat',
    '@formatjs/intl-displaynames',
    'react-native-webview',
    'expo-media-library',
    // The phone's notices and Google's auth session: the web has its own (5a's final review).
    'expo-notifications',
    'expo-web-browser',
    'apps/mobile/src/rules/v0.40.0-1.41.0.js',
  ])('reports a source naming %s', (name) => {
    const source = name.startsWith('apps/') ? `../../${name}` : `../../node_modules/${name}/lib/index.js`;
    const problems = judgeWebExport([small], ['node_modules/react/index.js', source]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(source);
  });

  it('reports each forbidden module once, however many of its files are in', () => {
    const problems = judgeWebExport([small], ['a/node_modules/expo-sqlite/a.js', 'a/node_modules/expo-sqlite/b.js']);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/2 sources/);
  });

  it('lists the older rules by their folder, not by one version', () => {
    expect(FORBIDDEN.map((entry) => entry.label)).toContain('the older rules (src/rules/v*.js)');
    expect(judgeWebExport([small], ['apps/mobile/src/rules/index.ts'])).toEqual([]);
  });
});

describe('the pages', () => {
  it('are named as the static export names them: the front door of a language its folder\'s index, every other page a file of its own', () => {
    expect(pageFiles(['', 'play', 'room'], ['en', 'es'])).toEqual(['en/index.html', 'en/play.html', 'en/room.html', 'es/index.html', 'es/play.html', 'es/room.html']);
    expect(FIRST_PAGE).toBe('en/index.html');
  });

  it('reports a page missing in a language, and not when every one is there', () => {
    const pages = pageFiles(['', 'play'], ['en', 'es']);
    const html = (path: string) => ({ path, bytes: Buffer.from('<html></html>') });
    expect(judgeWebExport([small, ...pages.map(html)], [], [], pages).filter((problem) => /missing/.test(problem))).toEqual([]);
    const without = judgeWebExport([small, html('en/index.html'), html('es/index.html'), html('es/play.html')], [], [], pages);
    expect(without.filter((problem) => /missing/.test(problem))).toEqual([expect.stringContaining('en/play.html')]);
  });
});

describe('the first page', () => {
  const ahead = (faces: readonly string[]) => faces.map((face) => `<link rel="preload" href="/assets/${face}.abc.ttf" as="font" crossorigin=""/>`).join('');
  const LATIN = ['Jersey15_400Regular', 'ChakraPetch_400Regular', 'ChakraPetch_600SemiBold'];
  const CYRILLIC = ['Oswald_500Medium', 'Exo2_400Regular', 'Exo2_600SemiBold'];
  const FONTS = ahead(LATIN);
  const page = (path: string, scripts: string[], head: string) => ({
    path,
    bytes: Buffer.from(`<!DOCTYPE html><html lang="en"><head>${head}</head><body>${scripts.map((src) => `<script defer="" src="/${src}"></script>`).join('')}</body></html>`),
  });
  const firstPage = (scripts: string[], head = FONTS) => page(FIRST_PAGE, scripts, head);

  it('may load 800 KiB gzipped, the HTML with it (the plan\'s 0.8 MB, the Next web\'s 0.7 MB and a little): the chunks its HTML loads count, the others do not', () => {
    expect(FIRST_PAGE_GZIP_BUDGET).toBe(800 * 1024);
    const big = noise(Math.floor(FIRST_PAGE_GZIP_BUDGET * 0.6));
    const a = { path: `${APP}a.js`, bytes: big };
    const b = { path: `${APP}b.js`, bytes: big };
    // Both loaded by the first page: over.
    const over = judgeWebExport([a, b, firstPage([a.path, b.path])], []);
    expect(over).toEqual([expect.stringMatching(/first page .* MiB gzip, over the 0\.78 MiB/)]);
    // Only one loaded by it (the other a later page's): under. The whole of the app's JavaScript is the other budget's.
    expect(judgeWebExport([a, b, firstPage([a.path])], [])).toEqual([]);
  });

  it('is weighed once, the same for the gate and the printout: its HTML and its scripts, each counted once', () => {
    const a = { path: `${APP}a.js`, bytes: noise(1000) };
    const page = firstPage([a.path, a.path, `${APP}gone.js`]);
    const first = firstPageOf([a, page]);
    expect(first?.scripts.map((file) => file.path)).toEqual([a.path]);
    expect(first?.weight).toBe(gzipSync(page.bytes).length + gzipSync(a.bytes).length);
    expect(firstPageOf([a])).toBeNull();
  });

  it('counts what the first draw fetches after its HTML too (a lazy chunk), as a browser asked for it on a first visit', () => {
    const a = { path: `${APP}a.js`, bytes: noise(Math.floor(FIRST_PAGE_GZIP_BUDGET * 0.6)) };
    const lazy = { path: `${APP}lazy.js`, bytes: noise(Math.floor(FIRST_PAGE_GZIP_BUDGET * 0.6)) };
    const files = [a, lazy, firstPage([a.path])];
    // The HTML alone is under the gate; with the chunk its first draw asked for (by its address, as the browser asks), over.
    expect(judgeFirstVisit(files, [`/${a.path}`])).toEqual([]);
    expect(judgeFirstVisit(files, [`/${a.path}`, `/${lazy.path}`])).toEqual([expect.stringMatching(/first visit .* 2 scripts .* MiB gzip, over the 0\.78 MiB/)]);
    expect(firstPageOf(files, [`/${lazy.path}`])?.scripts.map((file) => file.path)).toEqual([a.path, lazy.path]);
  });

  it('says its sizes in MiB, as they are counted', () => {
    expect(mib(1024 * 1024)).toBe('1.00 MiB');
    expect(mib(800 * 1024)).toBe('0.78 MiB');
  });

  it('fetches its typefaces ahead, the pixel one and the reading ones, as the Next web\'s next/font does', () => {
    expect(judgeWebExport([small, firstPage([small.path])], [])).toEqual([]);
    expect(judgeWebExport([small, firstPage([small.path], '')], [])).toEqual([expect.stringMatching(/does not fetch its typefaces ahead: Jersey15_400Regular, ChakraPetch_400Regular, ChakraPetch_600SemiBold/)]);
  });

  it('fetches no other typeface ahead: the Cyrillic and the slanted ones wait for a page that draws them (next/font\'s `preload: false`)', () => {
    const more = firstPage([small.path], ahead([...LATIN, 'Oswald_500Medium', 'ChakraPetch_400Regular_Slant']));
    expect(judgeWebExport([small, more], [])).toEqual([expect.stringMatching(/en\/index\.html\) fetches ahead typefaces it does not draw first: Oswald_500Medium, ChakraPetch_400Regular_Slant/)]);
  });

  it('is the Russian page\'s too, with the Cyrillic faces its words are drawn in fetched ahead as well', () => {
    const russian = (faces: readonly string[]) => page('ru/index.html', [small.path], ahead(faces));
    expect(judgeWebExport([small, firstPage([small.path]), russian([...LATIN, ...CYRILLIC])], [])).toEqual([]);
    expect(judgeWebExport([small, firstPage([small.path]), russian(LATIN)], [])).toEqual([
      expect.stringMatching(/ru\/index\.html\) does not fetch its typefaces ahead: Oswald_500Medium, Exo2_400Regular, Exo2_600SemiBold/),
    ]);
  });

  it('carries no language\'s words in the scripts its HTML loads: each language\'s are a chunk of their own, fetched for the page\'s language', () => {
    const words = { path: `${APP}words.js`, bytes: Buffer.from('x'), sources: ['/apps/mobile/src/game/Home.tsx', '/packages/i18n/messages/es.json'] };
    const text = { path: `${APP}text.js`, bytes: Buffer.from('x'), sources: ['/packages/content/src/text/ru.cards.ts'] };
    const clean = { path: `${APP}clean.js`, bytes: Buffer.from('x'), sources: ['/packages/content/src/text/index.web.ts', '/packages/content/src/text/languages.ts'] };
    expect(judgeWebExport([clean, words, text, firstPage([clean.path])], [])).toEqual([]);
    expect(judgeWebExport([clean, words, text, firstPage([clean.path, words.path, text.path])], [])).toEqual([
      expect.stringMatching(/first page .* carries words of a language: \/packages\/i18n\/messages\/es\.json, \/packages\/content\/src\/text\/ru\.cards\.ts/),
    ]);
  });
});

describe('sourcesOf', () => {
  it('reads the sources of a plain map and of every section of an indexed one', () => {
    expect(sourcesOf({ sources: ['a.js', 'b.js'] })).toEqual(['a.js', 'b.js']);
    expect(sourcesOf({ sections: [{ map: { sources: ['a.js'] } }, { map: { sources: ['b.js', 'c.js'] } }] })).toEqual(['a.js', 'b.js', 'c.js']);
    expect(sourcesOf({})).toEqual([]);
  });
});

describe('formatjs', () => {
  it('is forbidden as the polyfills only: use-intl\'s own dependencies stay', () => {
    const kept = [
      '../../node_modules/.pnpm/@formatjs+fast-memoize@2.2.0/node_modules/@formatjs/fast-memoize/lib/index.js',
      '../../node_modules/.pnpm/@formatjs+icu-messageformat-parser@2.9.0/node_modules/@formatjs/icu-messageformat-parser/lib/parser.js',
      '../../node_modules/.pnpm/intl-messageformat@10.7.0/node_modules/intl-messageformat/lib/src/core.js',
    ];
    expect(judgeWebExport([small], kept)).toEqual([]);
  });

  it('finds a polyfill in a pnpm path', () => {
    const polyfill = '../../node_modules/.pnpm/@formatjs+intl-numberformat@9.4.3/node_modules/@formatjs/intl-numberformat/polyfill-force.js';
    expect(judgeWebExport([small], [polyfill])).toHaveLength(1);
  });
});

describe('exportEnv', () => {
  it('blanks the live project\'s settings for the export, and leaves the rest of the environment', () => {
    const env = exportEnv({
      PATH: '/bin',
      EXPO_PUBLIC_SUPABASE_URL: 'https://live.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAA',
      EXPO_PUBLIC_OTHER: 'kept',
    });
    expect(env).toEqual({
      PATH: '/bin',
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      EXPO_PUBLIC_TURNSTILE_SITE_KEY: '',
      EXPO_PUBLIC_OTHER: 'kept',
    });
  });

  it('sets them empty when they were not set at all', () => {
    expect(exportEnv({ PATH: '/bin' })).toMatchObject({ EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_TURNSTILE_SITE_KEY: '' });
  });
});
