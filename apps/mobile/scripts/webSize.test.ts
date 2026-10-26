import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { MESSAGES } from '@ratrace/i18n';
import { describe, expect, it } from 'vitest';
import { FIRST_PAGE, FIRST_PAGE_GZIP_BUDGET, firstWordsOf, FORBIDDEN, JS_GZIP_BUDGET, exportEnv, firstPageOf, judgeFirstVisit, judgeHeads, judgeSiteFiles, judgeWebExport, GAME_FACES, mib, pageFiles, SITE_FILES, sourcesOf } from './webSize';

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
  it('holds the export\'s typefaces to those the game draws: every face it loads, and no weight of their families it never draws', () => {
    // The faces the game loads, as `ui/fontSources.ts` names them (a test cannot require its .ttf files, so they are read from its text).
    const sources = readFileSync(new URL('../src/ui/fontSources.ts', import.meta.url), 'utf8');
    const loaded = /export const FONT_SOURCES = \{([^}]*)\}/.exec(sources)?.[1].split(',').map((name) => name.trim()).filter(Boolean);
    expect([...GAME_FACES].sort()).toEqual([...(loaded ?? [])].sort());
    // Each family's package names every weight in its index: imported from there, the export carries them all, and the worker precaches them.
    expect(sources).not.toMatch(/from '@expo-google-fonts\/[a-z0-9-]+';/);
    const ttf = (face: string, at = 'assets/__node_modules/.pnpm/x/node_modules/@expo-google-fonts/x/400Regular') => ({ path: `${at}/${face}.0123456789abcdef0123456789abcdef.ttf`, bytes: Buffer.from('ttf') });
    const all = GAME_FACES.map((face) => ttf(face));
    expect(judgeWebExport([small, ...all], [])).toEqual([]);
    const extra = judgeWebExport([small, ...all, ttf('Exo2_900Black_Italic'), ttf('Oswald_200ExtraLight')], []);
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatch(/Exo2_900Black_Italic, Oswald_200ExtraLight/);
    const short = judgeWebExport([small, ...all.filter((file) => !file.path.includes('Exo2_600SemiBold_Slant'))], []);
    expect(short).toHaveLength(1);
    expect(short[0]).toMatch(/Exo2_600SemiBold_Slant/);
  });

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
    // The phone's touch: a page feels nothing.
    'expo-haptics',
    // The shortcuts on the phone's icon: a page has none.
    'expo-quick-actions',
    // Google's own sign-in on the phone: the web goes to Google by redirect.
    '@react-native-google-signin/google-signin',
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
  /** The front door's tagline in a language, as the built page carries it (its HTML escapes the apostrophes and ampersands of a text). */
  const tagline = (locale: 'en' | 'es' | 'ru') => MESSAGES[locale].meta.description;
  const page = (path: string, scripts: string[], head: string, words = tagline(path.slice(0, 2) as 'en' | 'es' | 'ru')) => ({
    path,
    bytes: Buffer.from(`<!DOCTYPE html><html lang="en"><head>${head}</head><body><div>${words}</div>${scripts.map((src) => `<script defer="" src="/${src}"></script>`).join('')}</body></html>`),
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

  it('carries not the page of nothing in the scripts its HTML loads: it is the 404\'s own chunk, never the front door\'s', () => {
    const nothing = { path: `${APP}nothing.js`, bytes: Buffer.from('x'), sources: ['/apps/mobile/src/game/screens/NotFound.web.tsx'] };
    const clean = { path: `${APP}clean.js`, bytes: Buffer.from('x'), sources: ['/apps/mobile/src/game/screens/Home.tsx'] };
    expect(judgeWebExport([clean, nothing, firstPage([clean.path])], [])).toEqual([]);
    expect(judgeWebExport([clean, nothing, firstPage([clean.path, nothing.path])], [])).toEqual([
      expect.stringMatching(/first page .* carries the page of nothing: \/apps\/mobile\/src\/game\/screens\/NotFound\.web\.tsx/),
    ]);
  });

  it('carries none of the gesture handler: a sheet is dragged with the page\'s own pointer events, the handler loaded with what drags by it', () => {
    const handler = { path: `${APP}gestures.js`, bytes: Buffer.from('x'), sources: ['/node_modules/react-native-gesture-handler/src/v3/hooks/gestures/pan/usePanGesture.ts'] };
    const clean = { path: `${APP}clean.js`, bytes: Buffer.from('x'), sources: ['/apps/mobile/src/ui/sheetDrag.web.tsx'] };
    expect(judgeWebExport([clean, handler, firstPage([clean.path])], [])).toEqual([]);
    expect(judgeWebExport([clean, handler, firstPage([clean.path, handler.path])], [])).toEqual([
      expect.stringMatching(/first page .* carries the gesture handler: \/node_modules\/react-native-gesture-handler\/src\/v3\/hooks\/gestures\/pan\/usePanGesture\.ts/),
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

describe('the words of each language\'s front door', () => {
  const door = (locale: string, words: string) => ({ path: `${locale}/index.html`, bytes: Buffer.from(`<!DOCTYPE html><html lang="${locale}"><body><p>${words}</p></body></html>`) });
  const own = (locale: 'en' | 'es' | 'ru') => MESSAGES[locale].meta.description;
  const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

  it('are its language\'s, as the build drew them (the page\'s HTML speaks before any script runs), in runs of a font each', () => {
    const runs = (text: string) => text.split(' ').map((word) => `<span style="font-family:Exo2_400Regular">${word}</span><span> </span>`).join('').replace(/<span> <\/span>$/, '');
    const doors = [door('en', own('en')), door('es', escaped(own('es'))), door('ru', runs(own('ru')))];
    expect(judgeWebExport([small, ...doors], []).filter((problem) => /words/.test(problem))).toEqual([]);
  });

  it('are reported missing where the build drew a page without them (a language not in when the server drew it)', () => {
    const doors = [door('en', own('en')), door('es', 'Loading…'), door('ru', own('ru'))];
    expect(judgeWebExport([small, ...doors], []).filter((problem) => /words/.test(problem))).toEqual([expect.stringMatching(/es\/index\.html does not speak its language/)]);
  });

  it('are reported where a page speaks another language\'s (the build drew it in the wrong one)', () => {
    const doors = [door('en', own('en')), door('es', `${own('es')} ${own('en')}`), door('ru', own('en'))];
    expect(judgeWebExport([small, ...doors], []).filter((problem) => /words/.test(problem))).toEqual([
      expect.stringMatching(/es\/index\.html carries the words of en/),
      expect.stringMatching(/ru\/index\.html does not speak its language/),
      expect.stringMatching(/ru\/index\.html carries the words of en/),
    ]);
  });
});

describe('the first page\'s words', () => {
  it('are weighed with it: the chunk of its language (its map names game/languages/en.ts) and what that chunk loads with it, as the first draw fetches them', () => {
    const named = { path: `${APP}entry.js`, bytes: Buffer.from(`x;{"paths":{"12":["/${APP}en-abc.js","/${APP}__shared-homes.js"],"13":["/${APP}es-abc.js","/${APP}__shared-homes.js"]}}`), sources: ['/apps/mobile/src/game/languageWords.web.ts'] };
    const en = { path: `${APP}en-abc.js`, bytes: noise(3000), sources: ['/apps/mobile/src/game/languages/en.ts', '/packages/i18n/messages/en.json'] };
    const es = { path: `${APP}es-abc.js`, bytes: noise(3000), sources: ['/apps/mobile/src/game/languages/es.ts'] };
    const homes = { path: `${APP}__shared-homes.js`, bytes: noise(1000), sources: ['/packages/content/src/text/homes.ts'] };
    const html = { path: FIRST_PAGE, bytes: Buffer.from(`<html><body>${MESSAGES.en.meta.description}<script src="/${named.path}"></script></body></html>`) };
    const files = [named, en, es, homes, html];
    expect(firstWordsOf(files)).toEqual([`/${en.path}`, `/${homes.path}`]);
    expect(firstPageOf(files, firstWordsOf(files))?.scripts.map((file) => file.path)).toEqual([named.path, en.path, homes.path]);
    // The words are its first draw's, not its HTML's: the check that its HTML's scripts carry none still holds.
    expect(judgeWebExport(files, []).filter((problem) => /carries words/.test(problem))).toEqual([]);
    expect(firstWordsOf([named, html])).toEqual([]);
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

describe('the head of each page', () => {
  const SITE = new URL('https://rats.example');
  const LOCALES = ['en', 'es', 'ru'] as const;
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/</g, '&lt;');
  /** The head the export writes for a page, as React writes the tags (an apostrophe an entity). */
  function head(locale: (typeof LOCALES)[number], page: string, change: (tags: string[]) => string[] = (tags) => tags): string {
    const words = MESSAGES[locale].meta as { title: string; description: string; titles: Record<string, string> };
    const title = page === '' ? words.title : `${words.titles[page]} · ${words.title}`;
    const at = (language: string) => new URL(`/${language}${page === '' ? '' : `/${page}`}`, SITE).href;
    const tags = [
      `<title>${escape(title)}</title>`,
      `<meta name="description" content="${escape(words.description)}"/>`,
      ...(page === 'play' ? ['<meta name="robots" content="noindex, follow"/>'] : []),
      `<link rel="canonical" href="${at(locale)}"/>`,
      ...[...LOCALES, 'x-default'].map((language) => `<link rel="alternate" href="${at(language === 'x-default' ? 'en' : language)}" hrefLang="${language}"/>`),
      `<meta property="og:title" content="${escape(title)}"/>`,
      `<meta property="og:url" content="${at(locale)}"/>`,
      `<meta property="og:image" content="${new URL('/og.png', SITE).href}"/>`,
      '<meta name="twitter:card" content="summary_large_image"/>',
    ];
    return `<!DOCTYPE html><html lang="${locale}"><head><meta charSet="utf-8"/>${change(tags).join('')}</head><body></body></html>`;
  }
  const pages = ['', 'new', 'rankings', 'play'];
  const files = (change?: (locale: string, page: string, tags: string[]) => string[]) =>
    LOCALES.flatMap((locale) => pages.map((page) => ({ path: pageFiles([page], [locale])[0], bytes: Buffer.from(head(locale, page, (tags) => (change ? change(locale, page, tags) : tags))) })));

  it('finds nothing wrong with a page that says in its language what the Next web says of it', () => {
    expect(judgeHeads(files(), LOCALES, pages, SITE)).toEqual([]);
  });

  it('reports a page without its title, with another language\'s, or twice', () => {
    const none = judgeHeads(files((locale, page, tags) => (locale === 'es' && page === 'rankings' ? tags.filter((tag) => !tag.startsWith('<title>')) : tags)), LOCALES, pages, SITE);
    expect(none).toEqual([expect.stringContaining('es/rankings.html')]);
    expect(none[0]).toContain('title');
    const other = judgeHeads(files((locale, page, tags) => (locale === 'ru' && page === 'new' ? tags.map((tag) => (tag.startsWith('<title>') ? '<title>Choose a life · The Rat Race</title>' : tag)) : tags)), LOCALES, pages, SITE);
    expect(other).toEqual([expect.stringContaining('ru/new.html')]);
    const twice = judgeHeads(files((locale, page, tags) => (locale === 'en' && page === '' ? [...tags, '<title>Again</title>'] : tags)), LOCALES, pages, SITE);
    expect(twice).toEqual([expect.stringContaining('en/index.html')]);
  });

  it('reports a canonical address that is another page\'s, or the default site\'s when the site is another', () => {
    const wrong = judgeHeads(files((locale, page, tags) => (locale === 'es' && page === 'rankings' ? tags.map((tag) => tag.replace('/es/rankings"/>', '/en/rankings"/>')) : tags)), LOCALES, pages, SITE);
    expect(wrong.length).toBeGreaterThan(0);
    expect(wrong.every((problem) => problem.includes('es/rankings.html'))).toBe(true);
    expect(judgeHeads(files(), LOCALES, pages, new URL('https://elsewhere.example')).length).toBeGreaterThan(0);
  });

  it('reports a page that does not name its twins in the three languages and x-default', () => {
    const lacking = judgeHeads(files((locale, page, tags) => (locale === 'en' && page === 'new' ? tags.filter((tag) => !tag.includes('hrefLang="ru"')) : tags)), LOCALES, pages, SITE);
    expect(lacking).toEqual([expect.stringContaining('en/new.html')]);
    expect(lacking[0]).toContain('ru');
  });

  it('reports /play when a search may find it, and any other page when it may not', () => {
    const open = judgeHeads(files((locale, page, tags) => (page === 'play' ? tags.filter((tag) => !tag.includes('robots')) : tags)), LOCALES, pages, SITE);
    expect(open).toHaveLength(3);
    expect(open[0]).toContain('noindex');
    const closed = judgeHeads(files((locale, page, tags) => (page === 'new' && locale === 'en' ? [...tags, '<meta name="robots" content="noindex, follow"/>'] : tags)), LOCALES, pages, SITE);
    expect(closed).toEqual([expect.stringContaining('en/new.html')]);
  });

  it('reports a page without its card: Open Graph\'s title, address and picture, and Twitter\'s', () => {
    for (const lost of ['og:title', 'og:url', 'og:image', 'twitter:card', 'name="description"']) {
      const missing = judgeHeads(files((locale, page, tags) => (locale === 'en' && page === '' ? tags.filter((tag) => !tag.includes(lost)) : tags)), LOCALES, pages, SITE);
      expect(missing, lost).toEqual([expect.stringContaining('en/index.html')]);
    }
  });

  it('leaves a page the export lacks to the check of the pages', () => {
    expect(judgeHeads([], LOCALES, pages, SITE)).toEqual([]);
  });
});

describe('the site as it is deployed', () => {
  const file = (path: string) => ({ path, bytes: Buffer.from(path) });
  const pages = pageFiles(['', 'play'], ['en', 'es']);
  /** The game's page of nothing, as the export draws it: its line the page's one heading, in English, and its ways back. */
  const nothing = { path: '404.html', bytes: Buffer.from(`<html lang="en"><body><div id="root"><main><h1 role="heading"><span>${MESSAGES.en.notFound.title}</span></h1><div>${MESSAGES.en.notFound.body}</div><a>${MESSAGES.en.play.newLife}</a><a>${MESSAGES.en.play.home}</a></main></div></body></html>`) };
  const site = [...[...SITE_FILES, ...pages, 'index.html', '_expo/static/js/web/entry-abc.js'].filter((path) => path !== '404.html').map(file), nothing];

  it('has every piece of the site\'s beside its pages: the icons, the share image, the sitemap, robots, the manifest, the worker, the offline page and the page of nothing', () => {
    expect([...SITE_FILES].sort()).toEqual(
      ['.well-known/assetlinks.json', '404.html', 'favicon.ico', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'manifest.webmanifest', 'offline.html', 'og.png', 'robots.txt', 'sitemap.xml', 'sw.js'].sort(),
    );
    expect(judgeSiteFiles(site, pages)).toEqual([]);
    const without = judgeSiteFiles(site.filter((one) => one.path !== 'og.png' && one.path !== 'icons/icon-192.png'), pages);
    expect(without).toEqual(['the site lacks icons/icon-192.png, og.png']);
  });

  it('serves no HTML but its pages, the bare address, the offline page and the page of nothing: a template left in is reported', () => {
    const problems = judgeSiteFiles([...site, file('[locale].html'), file('[locale]/play.html'), file('_sitemap.html')], pages);
    expect(problems).toEqual(['the site serves 3 HTML files that are no page of it: [locale].html, [locale]/play.html, _sitemap.html']);
  });

  it('answers an address it has no page at with the game\'s page of nothing, never the router\'s own (its sitemap link) nor an empty one', () => {
    const others = site.filter((one) => one.path !== '404.html');
    const routers = { path: '404.html', bytes: Buffer.from('<html lang="en"><body><div id="root"><h1>Unmatched Route</h1><a href="/_sitemap">Sitemap</a></div></body></html>') };
    const empty = { path: '404.html', bytes: Buffer.from('<html lang="en"><body><div id="root"><!--$--><!--/$--></div></body></html>') };
    // The error page's words are not a page of nothing's.
    const fault = { path: '404.html', bytes: Buffer.from(`<html lang="en"><body><div id="root"><h1 role="heading"><span>${MESSAGES.en.play.faultTitle}</span></h1></div></body></html>`) };
    for (const answer of [routers, empty, fault]) {
      expect(judgeSiteFiles([...others, answer], pages)).toEqual(['the site\'s 404.html is not the game\'s page of nothing (its title as the page\'s heading, in English, and no sitemap)']);
    }
  });

  it('carries no source map, nor a script that names one: they are the check\'s, not the players\'', () => {
    const named = { path: '_expo/static/js/web/entry-abc.js', bytes: Buffer.from('console.log(1)\n//# sourceMappingURL=/_expo/static/js/web/entry-abc.js.map\n') };
    const problems = judgeSiteFiles([...site.filter((one) => one.path !== named.path), named, file('_expo/static/js/web/entry-abc.js.map')], pages);
    expect(problems).toEqual(['the site serves 1 source map, e.g. _expo/static/js/web/entry-abc.js.map', 'the site has 1 script that names its source map, e.g. _expo/static/js/web/entry-abc.js']);
  });
});
