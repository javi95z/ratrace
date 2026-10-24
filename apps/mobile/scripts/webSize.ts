import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LOCALES, MESSAGES } from '@ratrace/i18n';
import { DEFAULT_LOCALE } from '@ratrace/i18n/locales';
import { SITE_URL } from '../src/game/site';
import { bundlesIn } from './rules';

/**
 * The size check of the app's web export (`pnpm --filter @ratrace/mobile web:size`): it exports the web into a temporary folder, with source maps,
 * and finds what the light web must not carry: a `.wasm` file, JavaScript over 1350 KiB gzipped, a first page (`/en`) whose HTML and the chunks it
 * loads weigh over 1 MiB gzipped (`FIRST_PAGE_GZIP_BUDGET`; what its first draw fetches after it is weighed by `web-life.ts --export`,
 * `judgeFirstVisit`) or that does not fetch its typefaces ahead, a page missing in a language, and any of the modules that only the
 * phone needs (read from the maps' sources, since a bundle's size says nothing of what is in it). It prints the totals and exits 1 on a problem,
 * and on an export that fails.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** The JavaScript of the export, all its files together and gzipped, may not weigh more than this. */
export const JS_GZIP_BUDGET = 1_350 * 1024;

/**
 * The first page a visitor is given (`/en`, the static export's `en/index.html`): its HTML and the JavaScript it loads, gzipped, may not weigh more
 * than this, 800 KiB (the plan's 0.8 MB, the Next web's 0.7 MB and a little). The first page carries what the front door draws: not the game's other
 * pages (expo-router's async routes and the granular chunks of app.json's `experiments.chunking`), not the words of a language (each its own chunk,
 * fetched for the page's language: `game/languageWords.web.ts`), not the sprites' registry (the site's `/sprites` files) nor the sound (loaded once
 * the page is idle).
 */
export const FIRST_PAGE_GZIP_BUDGET = 800 * 1024;
export const FIRST_PAGE = 'en/index.html';

/**
 * The typefaces a page draws in first, which its HTML fetches ahead (expo-font's `preload` for each the server drew with), as next/font does: Jersey 15
 * and Chakra Petch on every page, and on a Russian one the Cyrillic faces its words are drawn in, Oswald and Exo 2. No other (the Cyrillic faces of a
 * Latin page, the slanted ones): those wait for the text that needs them, as next/font's `preload: false`.
 */
const AHEAD: Readonly<Record<string, readonly string[]>> = {
  latin: ['Jersey15_400Regular', 'ChakraPetch_400Regular', 'ChakraPetch_600SemiBold'],
  ru: ['Jersey15_400Regular', 'ChakraPetch_400Regular', 'ChakraPetch_600SemiBold', 'Oswald_500Medium', 'Exo2_400Regular', 'Exo2_600SemiBold'],
};
/** The front door of each language whose typefaces are held to `AHEAD`. */
const FRONT_DOORS: readonly { page: string; faces: readonly string[] }[] = [
  { page: FIRST_PAGE, faces: AHEAD.latin },
  { page: 'ru/index.html', faces: AHEAD.ru },
];

/** The sources of the words of a language: the interface's (`@ratrace/i18n`'s messages) and the content's (`@ratrace/content`'s text of each language). */
const WORDS = /\/packages\/i18n\/messages\/|\/packages\/content\/src\/text\/(en|es|ru)(\.[a-z]+)?\.ts$/;

/** A size in bytes as the checks count it, in MiB (1024 × 1024 bytes), with two decimals. */
export const mib = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MiB`;

/** A file of the export, by its path inside it, with the sources its map names where it has one (a script of the export made with source maps). */
export interface ExportFile {
  path: string;
  bytes: Buffer;
  sources?: readonly string[];
}

/**
 * The first page's weight (`FIRST_PAGE`'s HTML and every script it loads, gzipped, each counted once), or null in an export without it. Its scripts
 * are those its HTML names (`<script src>`), then any other the browser was seen to fetch on a first visit (`requested`, addresses as the browser
 * asked for them: a chunk the first draw imports, which the HTML does not name).
 */
export function firstPageOf(files: readonly ExportFile[], requested: readonly string[] = []): { scripts: ExportFile[]; weight: number } | null {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const first = byPath.get(FIRST_PAGE);
  if (!first) return null;
  const named = [...first.bytes.toString('utf8').matchAll(/<script\b[^>]*\bsrc="\/?([^"]+)"/g)].map((found) => found[1]);
  const asked = requested.map((address) => new URL(address, 'http://localhost').pathname.replace(/^\//, ''));
  const scripts = [...new Set([...named, ...asked])].map((path) => byPath.get(path)).filter((file) => file !== undefined);
  return { scripts, weight: [first, ...scripts].reduce((total, file) => total + gzipSync(file.bytes).length, 0) };
}

/** The source of the first page's own words: the chunk of its language (`game/languageWords.web.ts` loads it when the page first speaks). */
const FIRST_WORDS = '/apps/mobile/src/game/languages/en.ts';

/**
 * The scripts the first page's words come in, as its first draw fetches them (addresses, as `requested` takes them): the chunk whose map names
 * `FIRST_WORDS`, and the chunks Metro loads with it (the `paths` list of the `import()` that asks for it, in the script that asks). Nothing in an
 * export made without source maps.
 */
export function firstWordsOf(files: readonly ExportFile[]): string[] {
  const words = files.find((file) => file.sources?.includes(FIRST_WORDS));
  if (words === undefined) return [];
  const address = `/${words.path}`;
  for (const file of files) {
    if (!file.path.endsWith('.js') || file === words) continue;
    const text = file.bytes.toString('utf8');
    if (!text.includes(address)) continue;
    for (const [list] of text.matchAll(/\[("[^"\]]*"\s*,?\s*)+\]/g)) {
      if (!list.includes(address)) continue;
      try {
        return JSON.parse(list) as string[];
      } catch {
        // Not a list of addresses after all (a string of the code's own): look on.
      }
    }
  }
  return [address];
}

/**
 * The text an HTML page shows, as one string: its tags dropped (the kit cuts a line into a span for each font that draws a run of it) and the
 * entities React writes decoded.
 */
export function textOfHtml(html: string): string {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'", nbsp: '\u00a0' };
  return html.replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (_, name: string) => entities[name]);
}

/**
 * What is wrong with the words of each language's front door as the build drew it (nothing when it is fine): each `<l>/index.html` speaks its own
 * language (the front door's tagline, `meta.description`) and carries no other's. The build's machine has every language at once
 * (`game/languageWords.web.ts`); a language not in when it drew a page would leave that page in another, or speaking none.
 */
function judgeDoorWords(byPath: ReadonlyMap<string, ExportFile>): string[] {
  const problems: string[] = [];
  for (const locale of LOCALES) {
    const html = byPath.get(`${locale}/index.html`)?.bytes.toString('utf8');
    if (html === undefined) continue;
    const text = textOfHtml(html);
    const speaks = (other: (typeof LOCALES)[number]) => text.includes(MESSAGES[other].meta.description);
    if (!speaks(locale)) problems.push(`${locale}/index.html does not speak its language: the build drew it without its words`);
    for (const other of LOCALES) if (other !== locale && speaks(other)) problems.push(`${locale}/index.html carries the words of ${other}`);
  }
  return problems;
}

/**
 * What is wrong with a first visit to the first page (nothing when it is fine): its weight with every script the browser fetched for it, those its
 * first draw imports after the HTML among them (`requested`, as a browser run on the served export saw them: `web-life.ts --export`).
 */
export function judgeFirstVisit(files: readonly ExportFile[], requested: readonly string[]): string[] {
  const first = firstPageOf(files, requested);
  if (first === null) return [`the export has no first page (${FIRST_PAGE})`];
  if (first.weight <= FIRST_PAGE_GZIP_BUDGET) return [];
  return [`a first visit to ${FIRST_PAGE} (its HTML and the ${first.scripts.length} scripts the browser fetched for it) is ${mib(first.weight)} gzip, over the ${mib(FIRST_PAGE_GZIP_BUDGET)} it is given`];
}

/**
 * The HTML files of every page in every language, as the static export names them: a language's front door (`''`) its folder's `index.html`
 * (`/en`), every other page a file of its own (`/en/play` is `en/play.html`).
 */
export function pageFiles(pages: readonly string[], locales: readonly string[]): string[] {
  return locales.flatMap((locale) => pages.map((page) => (page === '' ? `${locale}/index.html` : `${locale}/${page}.html`)));
}

/**
 * What is wrong with the head of each page's HTML (nothing when it is fine): the Next web's metadata for the page in the language of its address
 * (apps/web/src/i18n/metadata.ts, held to by `src/game/pageMeta.test.ts`) as the search engines and the networks a link is shared on read it. A page the
 * export lacks is not judged here (`pageFiles` finds it missing).
 */
export function judgeHeads(files: readonly ExportFile[], locales: readonly (typeof LOCALES)[number][], pages: readonly string[], site: URL): string[] {
  const problems: string[] = [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const at = (locale: string, page: string) => new URL(`/${locale}${page === '' ? '' : `/${page}`}`, site).href;
  for (const locale of locales) {
    const words = MESSAGES[locale].meta as { title: string; description: string; titles: Record<string, string> };
    for (const page of pages) {
      const path = pageFiles([page], [locale])[0];
      const html = byPath.get(path)?.bytes.toString('utf8');
      if (html === undefined) continue;
      const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
      // The tags as the browser reads them: a name, its attributes by lower-case name, and (for a title) its text.
      const tags = [...head.matchAll(/<(title|meta|link)\b([^>]*)>(?:([^<]*)<\/title>)?/g)].map(([, name, rest, text]) => ({
        name,
        text: text === undefined ? undefined : textOfHtml(text),
        attributes: new Map([...rest.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key.toLowerCase(), textOfHtml(value)])),
      }));
      const wrong = (what: string) => problems.push(`${path}: ${what}`);
      const meta = (key: 'name' | 'property', value: string) => tags.filter((tag) => tag.name === 'meta' && tag.attributes.get(key) === value).map((tag) => tag.attributes.get('content'));
      const links = (rel: string) => tags.filter((tag) => tag.name === 'link' && tag.attributes.get('rel') === rel);
      const titles = tags.filter((tag) => tag.name === 'title').map((tag) => tag.text);
      const title = page === '' ? words.title : `${words.titles[page]} · ${words.title}`;
      if (titles.length !== 1 || titles[0] !== title) wrong(`the title is ${titles.length === 0 ? 'missing' : titles.map((one) => `"${one}"`).join(' and ')}, not one "${title}"`);
      if (meta('name', 'description').join() !== words.description) wrong(`the description is not the language's own`);
      const canonical = links('canonical').map((tag) => tag.attributes.get('href'));
      if (canonical.join() !== at(locale, page)) wrong(`the canonical address is ${canonical.join(' and ') || 'missing'}, not ${at(locale, page)}`);
      const twins = new Map(links('alternate').map((tag) => [tag.attributes.get('hreflang'), tag.attributes.get('href')]));
      for (const language of [...locales, 'x-default']) {
        const expected = at(language === 'x-default' ? DEFAULT_LOCALE : language, page);
        if (twins.get(language) !== expected) wrong(`its twin for ${language} is ${twins.get(language) ?? 'missing'}, not ${expected}`);
      }
      for (const [key, value, expected] of [
        ['property', 'og:title', title],
        ['property', 'og:url', at(locale, page)],
        ['property', 'og:image', new URL('/og.png', site).href],
        ['name', 'twitter:card', 'summary_large_image'],
      ] as const) {
        if (meta(key, value).join() !== expected) wrong(`${value} is ${meta(key, value).join(' and ') || 'missing'}, not ${expected}`);
      }
      // A life on screen is one player's own: it is not to be found in a search, and no other page is kept from one.
      const robots = meta('name', 'robots').join();
      if (robots !== (page === 'play' ? 'noindex, follow' : '')) wrong(page === 'play' ? 'it may be found in a search (no noindex, follow)' : `it is kept from a search (${robots})`);
    }
  }
  return problems;
}

/** The formatjs packages that polyfill Intl: the web does without every one. */
const FORMATJS_POLYFILLS = [
  'getcanonicallocales',
  'locale',
  'pluralrules',
  'numberformat',
  'datetimeformat',
  'relativetimeformat',
  'listformat',
  'displaynames',
].map((name) => `@formatjs/intl-${name}`);

/** What the web does without, by what to call it and how to tell it from a map's source path. */
export const FORBIDDEN: readonly { label: string; matches: (source: string) => boolean }[] = [
  // The phone's notices (expo-notifications) and Google's auth session (expo-web-browser) too: the web has its own twins (5a's final review).
  ...['@shopify/react-native-skia', 'canvaskit-wasm', 'expo-sqlite', 'react-native-webview', 'expo-media-library', 'expo-notifications', 'expo-web-browser'].map((name) => ({
    label: name,
    matches: (source: string) => source.includes(name),
  })),
  // formatjs's polyfills only (src/intl.ts on the phone): the web has the browser's Intl. Its other packages (fast-memoize, the ICU message
  // parser) are use-intl's own dependencies, which the web keeps.
  ...FORMATJS_POLYFILLS.map((name) => ({ label: name, matches: (source: string) => source.includes(`${name}/`) })),
  // The older rules a life in progress finishes under: the phone carries them; the web fetches them from the site.
  { label: 'the older rules (src/rules/v*.js)', matches: (source) => /src\/rules\/v[^/]*\.js$/.test(source) },
];

/** Where the export puts the app's own JavaScript: the only files the budget counts. */
const APP_JS = '_expo/static/js/';

/** Where the export serves the older rules from (`/rules/v<engine>-<content>.js`): fetched by a life begun under them, never part of the app's load. */
const RULES_FOLDER = 'rules/';

/**
 * What is wrong with a web export, in words (nothing when it is fine): `files` are its files, `sources` those its source maps name,
 * `rules` the names of the older rules' files the export must serve (those of apps/web/public/rules), `pages` the HTML files of the pages it must
 * have (`pageFiles`). The budget counts the app's own JavaScript, not the rules the site serves for older lives. A missing or partial `rules/`
 * folder is a problem: a life begun under a version whose file is not there would wait forever. The first page, where the export has it, is held
 * to its own budget: its HTML, the scripts it loads and its words' chunks (`firstWordsOf`); and each language's front door to its own words.
 */
export function judgeWebExport(files: ExportFile[], sources: string[], rules: readonly string[] = [], pages: readonly string[] = []): string[] {
  const problems: string[] = [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const absent = pages.filter((page) => !byPath.has(page));
  if (absent.length > 0) problems.push(`${absent.length} of the ${pages.length} pages are missing from the export, e.g. ${absent[0]}: that address would be the page of nothing`);
  const first = firstPageOf(files, firstWordsOf(files));
  if (first !== null) {
    if (first.weight > FIRST_PAGE_GZIP_BUDGET) {
      problems.push(`the first page (${FIRST_PAGE}, the ${first.scripts.length} scripts it loads and its words) is ${mib(first.weight)} gzip, over the ${mib(FIRST_PAGE_GZIP_BUDGET)} it is given`);
    }
    // The scripts its HTML names, which every page loads: the words of a language are the first draw's, fetched for the page's language.
    const named = firstPageOf(files)?.scripts ?? [];
    const words = [...new Set(named.flatMap((script) => script.sources ?? []).filter((source) => WORDS.test(source)))];
    if (words.length > 0) problems.push(`the first page (${FIRST_PAGE}) carries words of a language: ${words.join(', ')}`);
  }
  problems.push(...judgeDoorWords(byPath));
  for (const { page, faces } of FRONT_DOORS) {
    const html = byPath.get(page)?.bytes.toString('utf8');
    if (html === undefined) continue;
    const fetched = [...html.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)]
      .map((found) => found[0])
      .filter((link) => /\bas="font"/.test(link))
      .map((link) => /\/([A-Za-z0-9_]+)\.[0-9a-f]+\.[a-z0-9]+"/.exec(link)?.[1] ?? link);
    const unfetched = faces.filter((face) => !fetched.includes(face));
    if (unfetched.length > 0) problems.push(`the front door (${page}) does not fetch its typefaces ahead: ${unfetched.join(', ')}`);
    const others = fetched.filter((face) => !faces.includes(face));
    if (others.length > 0) problems.push(`the front door (${page}) fetches ahead typefaces it does not draw first: ${others.join(', ')}`);
  }
  for (const file of files) {
    if (file.path.endsWith('.wasm')) problems.push(`a WebAssembly file is in the export: ${file.path}`);
  }
  const served = new Set(files.filter((file) => file.path.startsWith(RULES_FOLDER)).map((file) => file.path.slice(RULES_FOLDER.length)));
  const missing = rules.filter((name) => !served.has(name));
  if (missing.length > 0) {
    problems.push(`the export lacks ${missing.length} of the ${rules.length} older rules the site must serve (${RULES_FOLDER}), e.g. ${missing[0]}: a life under them would wait forever`);
  }
  const js = files.filter((file) => file.path.startsWith(APP_JS) && file.path.endsWith('.js'));
  const gzipped = js.reduce((total, file) => total + gzipSync(file.bytes).length, 0);
  if (gzipped > JS_GZIP_BUDGET) {
    problems.push(`the JavaScript is ${mib(gzipped)} gzip, over the ${mib(JS_GZIP_BUDGET)} the web is given`);
  }
  for (const { label, matches } of FORBIDDEN) {
    const found = sources.filter(matches);
    if (found.length > 0) problems.push(`${label} is in the bundle (${found.length} ${found.length === 1 ? 'source' : 'sources'}, e.g. ${found[0]})`);
  }
  return problems;
}

/**
 * The files of the site beside its pages, which the build writes after the export (`scripts/webBuild.ts`): the icons, the favicon, the share image,
 * the sitemap, robots and the manifest (`sitePieces.ts`), the worker and its offline page (`serviceWorker.ts`), and the page of nothing the host
 * answers an address it has nothing at with (`404.html`, the router's, `settlePages`).
 */
export const SITE_FILES: readonly string[] = [
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'og.png',
  'sitemap.xml',
  'robots.txt',
  'manifest.webmanifest',
  'sw.js',
  'offline.html',
  '404.html',
];

/** The HTML the site serves beside its pages: the bare address (answered by the middleware before it), the offline page and the page of nothing. */
const OTHER_HTML = ['index.html', 'offline.html', '404.html'];

/**
 * What is wrong with the site as it is deployed (nothing when it is fine), beyond its export (`judgeWebExport`, `judgeHeads`): each of `SITE_FILES`
 * is in it; it serves no HTML but its pages (`pages`, `pageFiles`) and `OTHER_HTML` (a template of the router's carries the English head and is in
 * no sitemap); and no source map, nor a script that names one (the maps are the size check's, made with the export and taken out of it).
 */
export function judgeSiteFiles(files: readonly ExportFile[], pages: readonly string[]): string[] {
  const problems: string[] = [];
  const paths = new Set(files.map((file) => file.path));
  const absent = SITE_FILES.filter((path) => !paths.has(path));
  if (absent.length > 0) problems.push(`the site lacks ${absent.join(', ')}`);
  const html = new Set([...pages, ...OTHER_HTML]);
  const strays = files.filter((file) => file.path.endsWith('.html') && !html.has(file.path)).map((file) => file.path);
  if (strays.length > 0) problems.push(`the site serves ${strays.length} HTML files that are no page of it: ${strays.join(', ')}`);
  const maps = files.filter((file) => file.path.endsWith('.map'));
  if (maps.length > 0) problems.push(`the site serves ${maps.length} source map${maps.length === 1 ? '' : 's'}, e.g. ${maps[0].path}`);
  const naming = files.filter((file) => file.path.endsWith('.js') && file.bytes.includes('//# sourceMappingURL='));
  if (naming.length > 0) problems.push(`the site has ${naming.length} script${naming.length === 1 ? '' : 's'} that name${naming.length === 1 ? 's' : ''} its source map, e.g. ${naming[0].path}`);
  return problems;
}

/** The settings of the live project the app is built with when they are set; the export is made without them, so it never inlines the live project. */
const LIVE_SETTINGS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_TURNSTILE_SITE_KEY'];

/** The environment the export runs in: `env`, with the live project's settings empty (an app with no project is offline). */
export function exportEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...env, ...Object.fromEntries(LIVE_SETTINGS.map((name) => [name, ''])) };
}

/** Every file under `dir`, by its path from `dir`, `/`-separated. */
export function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, base) : [relative(base, path).split(sep).join('/')];
  });
}

export interface SourceMap {
  sources?: string[];
  sections?: { map: SourceMap }[];
}

/** The sources a source map names; an indexed map (`sections`) names them inside each section. */
export function sourcesOf(map: SourceMap): string[] {
  return [...(map.sources ?? []), ...(map.sections ?? []).flatMap((section) => sourcesOf(section.map))];
}

/** The pages of the game, as its routes are (`src/app/[locale]/*.tsx`, the front door its `index`): the pages the export must have in every language. */
export function routedPages(): string[] {
  return readdirSync(join(here, '../src/app/[locale]'))
    .filter((name) => /^[a-z]+\.tsx$/.test(name))
    .map((name) => name.replace(/\.tsx$/, ''))
    .map((name) => (name === 'index' ? '' : name))
    .sort();
}

/**
 * Exports the app's web into `out` (`expo export --platform web`) in the environment `env`, with source maps (the checks read what is in each
 * script from them). Null when it is made, else what went wrong, in words: the line that says what Metro could not do (near the top, the import
 * chain that led there after it) and the end of what it said.
 */
export function exportWeb(out: string, env: Record<string, string | undefined>): string | null {
  const run = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--source-maps', '--output-dir', out], {
    cwd: join(here, '..'),
    env: env as NodeJS.ProcessEnv,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (run.status === 0) return null;
  const lines = `${run.stdout}\n${run.stderr}`.trim().split('\n');
  const cause = lines.filter((line) => /Unable to resolve|Error:/.test(line)).slice(0, 3);
  return `the web export failed (exit ${run.status ?? run.signal}):\n${cause.join('\n')}\n...\n${lines.slice(-12).join('\n')}`;
}

/**
 * The files of the export at `out` (its maps apart) with the sources each one's map names, and every source named: from the maps beside them, or
 * from `known` (by the script's path) for an export whose maps were taken out of it (`scripts/webBuild.ts`).
 */
export function readExport(out: string, known?: ReadonlyMap<string, readonly string[]>): { files: ExportFile[]; sources: string[] } {
  const paths = walk(out);
  const mapped = new Map<string, readonly string[]>(known ?? paths.filter((path) => path.endsWith('.map')).map((path) => [path.slice(0, -'.map'.length), sourcesOf(JSON.parse(readFileSync(join(out, path), 'utf8')) as SourceMap)]));
  const files = paths.filter((path) => known !== undefined || !path.endsWith('.map')).map((path) => ({ path, bytes: readFileSync(join(out, path)), sources: mapped.get(path) }));
  return { files, sources: [...mapped.values()].flat() };
}

/**
 * Judges a web export (`judgeWebExport` and `judgeHeads` for the site at `site`), saying its weights as it goes: what is wrong, in words (nothing when
 * it is fine).
 */
export function judgeExport(files: readonly ExportFile[], sources: string[], site: URL = SITE_URL): string[] {
  const js = files.filter((file) => file.path.startsWith(APP_JS) && file.path.endsWith('.js'));
  const rules = bundlesIn(readdirSync(join(here, '../../web/public/rules'))).map((bundle) => bundle.file);
  const raw = js.reduce((total, file) => total + file.bytes.length, 0);
  const gzipped = js.reduce((total, file) => total + gzipSync(file.bytes).length, 0);
  const wasm = files.filter((file) => file.path.endsWith('.wasm')).length;
  console.log(
    `web export: ${files.length} files, ${js.length} app JS files ${mib(raw)} (${mib(gzipped)} gzip, budget ${mib(JS_GZIP_BUDGET)}), ${wasm} wasm, ${files.filter((file) => file.path.startsWith(RULES_FOLDER)).length}/${rules.length} older rules, ${sources.length} sources`,
  );
  const pages = pageFiles(routedPages(), LOCALES);
  const words = firstWordsOf(files);
  const first = firstPageOf(files, words);
  const named = firstPageOf(files)?.scripts.length ?? 0;
  console.log(
    `first page (${FIRST_PAGE}): ${first ? `${first.scripts.length} scripts (${named} named by its HTML, ${first.scripts.length - named} of its words), ${mib(first.weight)} gzip with its HTML` : 'missing'} (gate ${mib(FIRST_PAGE_GZIP_BUDGET)}); ${pages.filter((page) => files.some((file) => file.path === page)).length}/${pages.length} pages`,
  );
  return [...judgeWebExport([...files], sources, rules, pages), ...judgeHeads(files, LOCALES, routedPages(), site)];
}

function main(): void {
  const out = mkdtempSync(join(tmpdir(), 'ratrace-web-'));
  try {
    const failed = exportWeb(out, exportEnv(process.env));
    if (failed !== null) {
      console.error(failed);
      process.exitCode = 1;
      return;
    }
    const { files, sources } = readExport(out);
    const problems = judgeExport(files, sources);
    for (const problem of problems) console.error(`problem: ${problem}`);
    if (problems.length > 0) process.exitCode = 1;
    else console.log('the web export is as light as it must be');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
