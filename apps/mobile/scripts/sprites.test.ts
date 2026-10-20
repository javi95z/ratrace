import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { buildManifest, sourcesFile } from './sprites';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const art = JSON.parse(read('../../../art/clean/manifest.json'));
const committed = JSON.parse(read('../src/sprites/manifest.json'));

test("the app's manifest is the web's: the same ids, files and sizes", () => {
  expect(committed).toEqual(JSON.parse(read('../../web/src/sprites/manifest.json')));
});

test('the committed manifest is what art/clean gives today (run `pnpm --filter @ratrace/mobile sprites` when it is stale)', () => {
  expect(committed).toEqual(buildManifest(art));
  expect(Object.keys(committed).length).toBeGreaterThan(1000);
});

test('sources.ts names every sprite with one static require, to a file art/clean has', () => {
  const text = read('../src/sprites/sources.ts');
  expect(text).toBe(sourcesFile(committed));
  const requires = [...text.matchAll(/^ {2}'([^']+)': require\('\.\.\/\.\.\/assets\/sprites\/([^']+)'\),$/gm)];
  expect(requires.map((m) => m[1])).toEqual(Object.keys(committed));
  for (const [, id, file] of requires) {
    expect(file).toBe(committed[id].src);
    expect(existsSync(join(here, '../../../art/clean', file))).toBe(true);
  }
});

test('the sprites are copied on every install (and on EAS after its install): a fresh checkout or a build bundles with no step of its own', () => {
  const pkg = JSON.parse(read('../package.json')) as { scripts: Record<string, string> };
  expect(pkg.scripts.sprites).toBe('tsx scripts/sprites.ts');
  // (The rules of the older versions are copied at the same moments: see rules.test.ts.)
  expect(pkg.scripts.postinstall).toMatch(/^pnpm sprites\b/);
  expect(pkg.scripts['eas-build-post-install']).toMatch(/^pnpm sprites\b/);
});
