import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { bundlesIn, indexFile } from './rules';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const web = join(here, '../../web/public/rules');
/** Every bundle the web serves, by its file name: the folder's own list, not the script's. */
const served = readdirSync(web).filter((name) => /^v.*\.js$/.test(name));

test('a bundle is v<engine>-<content>.js and nothing else in the folder is taken, in the order of the versions', () => {
  const names = ['shipped.json', 'v0.37.0-1.38.0.js', 'v0.9.0-1.2.0.js', 'v0.10.0-1.2.0.js', 'v0.10.0-1.10.0.js', 'notes.md', 'v1.0.js', 'v0.37.0-1.38.0.js.map', 'index.ts'];
  expect(bundlesIn(names)).toEqual([
    { file: 'v0.9.0-1.2.0.js', key: '0.9.0-1.2.0' },
    { file: 'v0.10.0-1.2.0.js', key: '0.10.0-1.2.0' },
    { file: 'v0.10.0-1.10.0.js', key: '0.10.0-1.10.0' },
    { file: 'v0.37.0-1.38.0.js', key: '0.37.0-1.38.0' },
  ]);
});

test("the web's folder holds the bundles of the older versions, and the script takes every one", () => {
  expect(served.length).toBeGreaterThan(10);
  expect(bundlesIn(readdirSync(web)).map((bundle) => bundle.file).sort()).toEqual([...served].sort());
});

test('index.ts lists exactly those bundles, each a lazy require that Metro packs and runs only when a life needs it', () => {
  const text = read('../src/rules/index.ts');
  const lines = [...text.matchAll(/^ {2}'([^']+)': \(\) => require\('\.\/(v[^']+\.js)'\),$/gm)];
  expect(lines.map((line) => line[2]).sort()).toEqual([...served].sort());
  for (const [, key, file] of lines) expect(file).toBe(`v${key}.js`);
  // Nothing else is required, and nothing is run when the module is read.
  expect(text.match(/require\(/g)).toHaveLength(served.length);
  expect(text).toBe(indexFile(bundlesIn(readdirSync(web))));
});

test('the bundles are copied next to the index, byte for byte (run `pnpm --filter @ratrace/mobile rules` when they are not)', () => {
  for (const file of served) {
    const copy = join(here, '../src/rules', file);
    expect(existsSync(copy), file).toBe(true);
    expect(readFileSync(copy, 'utf8') === readFileSync(join(web, file), 'utf8'), file).toBe(true);
  }
  // Only the bundles and the index live there.
  expect(readdirSync(join(here, '../src/rules')).sort()).toEqual([...served, 'index.ts'].sort());
});

test("the web export serves the same bundles from public/rules, byte for byte: it fetches a life's older rules from there, as the Next web does", () => {
  const pub = join(here, '../public/rules');
  for (const file of served) {
    expect(existsSync(join(pub, file)), file).toBe(true);
    expect(readFileSync(join(pub, file), 'utf8') === readFileSync(join(web, file), 'utf8'), file).toBe(true);
  }
  expect(readdirSync(pub).sort()).toEqual([...served].sort());
});

test('the bundles are copied on every install, on EAS after its install, and before every start: a fresh checkout or a build bundles with no step of its own', () => {
  const pkg = JSON.parse(read('../package.json')) as { scripts: Record<string, string> };
  expect(pkg.scripts.rules).toBe('tsx scripts/rules.ts');
  for (const name of ['postinstall', 'eas-build-post-install', 'start', 'android', 'ios', 'web']) expect(pkg.scripts[name], name).toMatch(/\bpnpm rules\b/);
});

test('the copies are not committed, as the sprites are not; the index is', () => {
  expect(read('../.gitignore')).toMatch(/^\/src\/rules\/v\*\.js$/m);
  expect(read('../.gitignore')).toMatch(/^\/public\/rules\/$/m);
});
