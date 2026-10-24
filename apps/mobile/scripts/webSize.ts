import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { LOCALES } from '@ratrace/i18n';
import { bundlesIn } from './rules';

/**
 * The size check of the app's web export (`pnpm --filter @ratrace/mobile web:size`): it exports the web into a temporary folder, with source maps,
 * and finds what the light web must not carry: a `.wasm` file, JavaScript over 1.35 MB gzipped, a first page (`/en`) whose HTML and the chunks it
 * loads weigh over 0.8 MB gzipped or that does not fetch its typefaces ahead, a page missing in a language, and any of the modules that only the
 * phone needs (read from the maps' sources, since a bundle's size says nothing of what is in it). It prints the totals and exits 1 on a problem,
 * and on an export that fails.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** The JavaScript of the export, all its files together and gzipped, may not weigh more than this. */
export const JS_GZIP_BUDGET = 1_350 * 1024;

/**
 * The first page a visitor is given (`/en`, the static export's `en/index.html`): its HTML and the JavaScript it loads, gzipped, may not weigh more
 * than this. Each page loads its own code (expo-router's async routes, the granular chunks of app.json's `experiments.chunking`): the first page
 * carries what the front door draws, not the game's other pages.
 */
export const FIRST_PAGE_GZIP_BUDGET = 800 * 1024;
export const FIRST_PAGE = 'en/index.html';

/** The typefaces the first page draws in, which its HTML fetches ahead (expo-font's `preload` for each the server drew with), as next/font does. */
const FIRST_TYPEFACES = ['Jersey15_400Regular', 'ChakraPetch_400Regular'];

/**
 * The HTML files of every page in every language, as the static export names them: a language's front door (`''`) its folder's `index.html`
 * (`/en`), every other page a file of its own (`/en/play` is `en/play.html`).
 */
export function pageFiles(pages: readonly string[], locales: readonly string[]): string[] {
  return locales.flatMap((locale) => pages.map((page) => (page === '' ? `${locale}/index.html` : `${locale}/${page}.html`)));
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
 * to its own budget: its HTML and the scripts it loads.
 */
export function judgeWebExport(files: { path: string; bytes: Buffer }[], sources: string[], rules: readonly string[] = [], pages: readonly string[] = []): string[] {
  const problems: string[] = [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const absent = pages.filter((page) => !byPath.has(page));
  if (absent.length > 0) problems.push(`${absent.length} of the ${pages.length} pages are missing from the export, e.g. ${absent[0]}: that address would be the page of nothing`);
  const first = byPath.get(FIRST_PAGE);
  if (first) {
    const html = first.bytes.toString('utf8');
    const loaded = [...html.matchAll(/<script\b[^>]*\bsrc="\/?([^"]+)"/g)].map((found) => byPath.get(found[1])).filter((file) => file !== undefined);
    const weight = [first, ...loaded].reduce((total, file) => total + gzipSync(file.bytes).length, 0);
    if (weight > FIRST_PAGE_GZIP_BUDGET) {
      problems.push(`the first page (${FIRST_PAGE} and the ${loaded.length} scripts it loads) is ${(weight / 1024 / 1024).toFixed(2)} MB gzip, over the ${(FIRST_PAGE_GZIP_BUDGET / 1024 / 1024).toFixed(2)} MB it is given`);
    }
    const ahead = [...html.matchAll(/<link\b[^>]*\brel="preload"[^>]*>/g)].map((found) => found[0]).filter((link) => /\bas="font"/.test(link));
    const unfetched = FIRST_TYPEFACES.filter((face) => !ahead.some((link) => link.includes(face)));
    if (unfetched.length > 0) problems.push(`the first page (${FIRST_PAGE}) does not fetch its typefaces ahead: ${unfetched.join(', ')}`);
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
    problems.push(`the JavaScript is ${(gzipped / 1024 / 1024).toFixed(2)} MB gzip, over the ${(JS_GZIP_BUDGET / 1024 / 1024).toFixed(2)} MB the web is given`);
  }
  for (const { label, matches } of FORBIDDEN) {
    const found = sources.filter(matches);
    if (found.length > 0) problems.push(`${label} is in the bundle (${found.length} ${found.length === 1 ? 'source' : 'sources'}, e.g. ${found[0]})`);
  }
  return problems;
}

/** The settings of the live project the app is built with when they are set; the export is made without them, so it never inlines the live project. */
const LIVE_SETTINGS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_TURNSTILE_SITE_KEY'];

/** The environment the export runs in: `env`, with the live project's settings empty (an app with no project is offline). */
export function exportEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return { ...env, ...Object.fromEntries(LIVE_SETTINGS.map((name) => [name, ''])) };
}

/** Every file under `dir`, by its path from `dir`. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, base) : [relative(base, path)];
  });
}

interface SourceMap {
  sources?: string[];
  sections?: { map: SourceMap }[];
}

/** The sources a source map names; an indexed map (`sections`) names them inside each section. */
export function sourcesOf(map: SourceMap): string[] {
  return [...(map.sources ?? []), ...(map.sections ?? []).flatMap((section) => sourcesOf(section.map))];
}

/** The pages of the game, as its routes are (`src/app/[locale]/*.tsx`, the front door its `index`): the pages the export must have in every language. */
function routedPages(): string[] {
  return readdirSync(join(here, '../src/app/[locale]'))
    .filter((name) => /^[a-z]+\.tsx$/.test(name))
    .map((name) => name.replace(/\.tsx$/, ''))
    .map((name) => (name === 'index' ? '' : name))
    .sort();
}

function main(): void {
  const out = mkdtempSync(join(tmpdir(), 'ratrace-web-'));
  try {
    const run = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--source-maps', '--output-dir', out], {
      cwd: join(here, '..'),
      env: exportEnv(process.env) as NodeJS.ProcessEnv,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    if (run.status !== 0) {
      const lines = `${run.stdout}\n${run.stderr}`.trim().split('\n');
      // The line that says what Metro could not do is near the top, and the import chain that led there follows it: show both.
      const cause = lines.filter((line) => /Unable to resolve|Error:/.test(line)).slice(0, 3);
      console.error(`the web export failed (exit ${run.status ?? run.signal}):\n${cause.join('\n')}\n...\n${lines.slice(-12).join('\n')}`);
      process.exitCode = 1;
      return;
    }
    const paths = walk(out);
    const files = paths.filter((path) => !path.endsWith('.map')).map((path) => ({ path, bytes: readFileSync(join(out, path)) }));
    const sources = paths.filter((path) => path.endsWith('.map')).flatMap((path) => sourcesOf(JSON.parse(readFileSync(join(out, path), 'utf8')) as SourceMap));
    const js = files.filter((file) => file.path.startsWith(APP_JS) && file.path.endsWith('.js'));
    const rules = bundlesIn(readdirSync(join(here, '../../web/public/rules'))).map((bundle) => bundle.file);
    const raw = js.reduce((total, file) => total + file.bytes.length, 0);
    const gzipped = js.reduce((total, file) => total + gzipSync(file.bytes).length, 0);
    const wasm = files.filter((file) => file.path.endsWith('.wasm')).length;
    console.log(
      `web export: ${files.length} files, ${js.length} app JS files ${(raw / 1024 / 1024).toFixed(2)} MB (${(gzipped / 1024 / 1024).toFixed(2)} MB gzip, budget ${(JS_GZIP_BUDGET / 1024 / 1024).toFixed(2)}), ${wasm} wasm, ${files.filter((file) => file.path.startsWith(RULES_FOLDER)).length}/${rules.length} older rules, ${sources.length} sources`,
    );
    const pages = pageFiles(routedPages(), LOCALES);
    const first = files.find((file) => file.path === FIRST_PAGE);
    const firstScripts = first ? [...first.bytes.toString('utf8').matchAll(/<script\b[^>]*\bsrc="\/?([^"]+)"/g)].map((found) => files.find((file) => file.path === found[1])).filter((file) => file !== undefined) : [];
    const firstWeight = first ? [first, ...firstScripts].reduce((total, file) => total + gzipSync(file.bytes).length, 0) : 0;
    console.log(
      `first page (${FIRST_PAGE}): ${firstScripts.length} scripts, ${(firstWeight / 1024 / 1024).toFixed(2)} MB gzip with its HTML (budget ${(FIRST_PAGE_GZIP_BUDGET / 1024 / 1024).toFixed(2)}); ${pages.filter((page) => files.some((file) => file.path === page)).length}/${pages.length} pages`,
    );
    const problems = judgeWebExport(files, sources, rules, pages);
    for (const problem of problems) console.error(`problem: ${problem}`);
    if (problems.length > 0) process.exitCode = 1;
    else console.log('the web export is as light as it must be');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
