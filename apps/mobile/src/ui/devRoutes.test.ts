import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { released } from './testing/released';

/*
 * The development pages (/scene, /dev, /kit) are route files, and expo-router puts every route file in the bundle, release or not. What they
 * draw with (the scenes' stores and fixed sessions, the driver's address, a life under older rules, the kit's second motion page) is test and
 * development code: each is loaded behind `__DEV__`, which a release build writes in as `false` and Metro folds away before the bundle's files
 * are gathered, so none of it ships. Found by the phase's final review: the plain release bundle held SceneView, sceneStore, memoryServices…
 */
const here = fileURLToPath(new URL('.', import.meta.url));
const app = join(here, '../app');

const ROUTES = [
  { route: 'scene.tsx', module: '../testing/scene' },
  { route: 'dev.tsx', module: '../testing/olderLife' },
  { route: 'kit.tsx', module: '../ui/kitMotion' },
] as const;

describe('the development pages in a release build', () => {
  for (const { route, module } of ROUTES) {
    it(`/${route.replace('.tsx', '')} gathers nothing of ${module}`, () => {
      const code = released(join(app, route));
      expect(code).not.toContain(module);
      // What the page draws with is `null` there, and the page goes home.
      expect(code).toMatch(/= null;/);
      expect(code).toMatch(/Redirect, \{\s*href: "\/"/);
    }, 60_000);
  }

  it('no other file of the app names test or development code: only through these three, behind __DEV__', () => {
    const src = join(here, '..');
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
      });
    // The core's own test code (the scenes, their cloud) is test code too, named by the package's name.
    const names = (source: string) => /(from|require\()\s*'(?:[./]*|@ratrace\/core\/)(testing\/|ui\/kitMotion|\.\/kitMotion)/.test(source);
    expect(names("import { sceneCloud } from '@ratrace/core/testing/sceneCloud';")).toBe(true);
    expect(names("import { ratLookOf } from '@ratrace/core/game/avatar';")).toBe(false);
    const naming = files(src)
      .map((path) => relative(src, path))
      .filter((path) => !path.startsWith('testing/') && !path.startsWith('ui/testing/'))
      .filter((path) => names(readFileSync(join(src, path), 'utf8')));
    expect(naming.sort()).toEqual(['app/dev.tsx', 'app/kit.tsx', 'app/perf.tsx', 'app/scene.tsx']);
    for (const path of naming) expect(readFileSync(join(src, path), 'utf8'), path).not.toMatch(/^import [^;]*'(?:[./]*|@ratrace\/core\/)(testing\/|ui\/kitMotion)/m);
  });
});
