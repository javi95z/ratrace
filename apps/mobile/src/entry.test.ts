import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const app = join(__dirname, '..');
const read = (path: string) => readFileSync(join(app, path), 'utf8');
const imports = (source: string) => Array.from(source.matchAll(/^import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/gm), (m) => m[1]);

test('the app starts at its own entry, which gives the JavaScript what it lacks before the router loads any screen', () => {
  expect(JSON.parse(read('package.json')).main).toBe('index.ts');
  expect(imports(read('index.ts'))).toEqual(['./src/polyfills', 'expo-router/entry']);
});

test('no screen or layout loads the polyfills itself: the order is the entry\'s alone', () => {
  expect(imports(read('src/app/_layout.tsx'))).not.toContain('../polyfills');
});
