import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * The size check of the app's web export (`pnpm --filter @ratrace/mobile web:size`): it exports the web into a temporary folder, with source maps,
 * and finds what the light web must not carry: a `.wasm` file, JavaScript over 1.35 MB gzipped, and any of the modules that only the phone
 * needs (read from the maps' sources, since a bundle's size says nothing of what is in it). It prints the totals and exits 1 on a problem,
 * and on an export that fails.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** The JavaScript of the export, all its files together and gzipped, may not weigh more than this. */
export const JS_GZIP_BUDGET = 1_350 * 1024;

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
  ...['@shopify/react-native-skia', 'canvaskit-wasm', 'expo-sqlite', 'react-native-webview', 'expo-media-library'].map((name) => ({
    label: name,
    matches: (source: string) => source.includes(name),
  })),
  // formatjs's polyfills only (src/intl.ts on the phone): the web has the browser's Intl. Its other packages (fast-memoize, the ICU message
  // parser) are use-intl's own dependencies, which the web keeps.
  ...FORMATJS_POLYFILLS.map((name) => ({ label: name, matches: (source: string) => source.includes(`${name}/`) })),
  // The older rules a life in progress finishes under: the phone carries them; the web fetches them from the site.
  { label: 'the older rules (src/rules/v*.js)', matches: (source) => /src\/rules\/v[^/]*\.js$/.test(source) },
];

/** What is wrong with a web export, in words (nothing when it is fine): `files` are its files, `sources` those its source maps name. */
export function judgeWebExport(files: { path: string; bytes: Buffer }[], sources: string[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    if (file.path.endsWith('.wasm')) problems.push(`a WebAssembly file is in the export: ${file.path}`);
  }
  const js = files.filter((file) => file.path.endsWith('.js'));
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
    const js = files.filter((file) => file.path.endsWith('.js'));
    const raw = js.reduce((total, file) => total + file.bytes.length, 0);
    const gzipped = js.reduce((total, file) => total + gzipSync(file.bytes).length, 0);
    const wasm = files.filter((file) => file.path.endsWith('.wasm')).length;
    console.log(
      `web export: ${files.length} files, ${js.length} JS files ${(raw / 1024 / 1024).toFixed(2)} MB (${(gzipped / 1024 / 1024).toFixed(2)} MB gzip, budget ${(JS_GZIP_BUDGET / 1024 / 1024).toFixed(2)}), ${wasm} wasm, ${sources.length} sources`,
    );
    const problems = judgeWebExport(files, sources);
    for (const problem of problems) console.error(`problem: ${problem}`);
    if (problems.length > 0) process.exitCode = 1;
    else console.log('the web export is as light as it must be');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
