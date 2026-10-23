import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Puts the rules of the older versions where Metro can bundle them, so that a life begun under one finishes under it
 * on a phone with no connection (the web serves the same files next to the page, from public/rules):
 *
 *   apps/web/public/rules/v<engine>-<content>.js  →  src/rules/v<engine>-<content>.js   (not committed; copied on every install and before every start)
 *                                                  →  src/rules/index.ts                 (committed: one lazy require per bundle, as Metro asks)
 *                                                  →  public/rules/v<engine>-<content>.js (not committed: the web export serves them at /rules, where the web twin of game/olderRules.ts fetches them)
 *
 *   pnpm --filter @ratrace/mobile rules
 */
const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '../../web/public/rules');
const out = join(here, '../src/rules');
/** Expo's web export copies this folder to the root of the export: the files are served at `/rules/...`, as the Next web serves its own. */
const served = join(here, '../public/rules');

export interface Bundle {
  /** The file, in the web's folder and beside the index. */
  file: string;
  /** `<engine>-<content>`: what `BUNDLED` is keyed by. */
  key: string;
}

const BUNDLE = /^v(\d+\.\d+\.\d+)-(\d+\.\d+\.\d+)\.js$/;

/** The numbers of a version, to put 0.9.0 before 0.10.0. */
const numbers = (version: string): number[] => version.split('.').map(Number);

function compare(a: Bundle, b: Bundle): number {
  const [x, y] = [a, b].map((bundle) => (BUNDLE.exec(bundle.file) as RegExpExecArray).slice(1).flatMap(numbers));
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** The bundles among the names of a folder, oldest first: whatever else it holds (a lock, a note) is not rules. */
export function bundlesIn(names: string[]): Bundle[] {
  return names
    .flatMap((file) => {
      const found = BUNDLE.exec(file);
      return found ? [{ file, key: `${found[1]}-${found[2]}` }] : [];
    })
    .sort(compare);
}

/** The module that names every bundle for Metro, which packs a file only through a static require, and runs one only when it is called. */
export function indexFile(bundles: Bundle[]): string {
  const lines = bundles.map(({ file, key }) => `  '${key}': () => require('./${file}'),`);
  return [
    '// Written by scripts/rules.ts: do not edit. Metro bundles a module only through a static require.',
    '',
    '/** The rules of every older version the app carries, by `<engine>-<content>`. A bundle is run when it is first called, not before. */',
    'export const BUNDLED: Record<string, () => unknown> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

function main(): void {
  if (!existsSync(web)) {
    console.warn('rules: apps/web/public/rules not found; a life begun under older rules will wait for an update');
    return;
  }
  const bundles = bundlesIn(readdirSync(web));
  mkdirSync(out, { recursive: true });
  // What a version the web no longer serves left here goes with it.
  for (const stale of bundlesIn(readdirSync(out))) rmSync(join(out, stale.file));
  for (const { file } of bundles) copyFileSync(join(web, file), join(out, file));
  writeFileSync(join(out, 'index.ts'), indexFile(bundles));
  mkdirSync(served, { recursive: true });
  for (const stale of bundlesIn(readdirSync(served))) rmSync(join(served, stale.file));
  for (const { file } of bundles) copyFileSync(join(web, file), join(served, file));
  console.log(`rules: ${bundles.length} copied`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
