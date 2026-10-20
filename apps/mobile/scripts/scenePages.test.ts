import { readFileSync } from 'node:fs';
import { SCENES } from '@ratrace/core/testing/scenes';
import { expect, test } from 'vitest';

// The scenes of the app and the web's are compared shot for shot: the same scenes, each drawn on the screen its name starts with.
// (Here, not beside the route: every file under src/app is a route to expo-router, a test too.)
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/testing/scene.tsx');
const web = read('../../web/src/app/[locale]/kit/scene/page.tsx');
const route = read('../src/app/scene.tsx');
const core = read('../../../packages/core/src/session/fixed.ts');

/** The screens a registry lists, in its order: each `name: () =>` of the object the registry is, up to its closing `};`. */
const screensOf = (source: string, registry: string): string[] => {
  const open = source.indexOf('= {', source.indexOf(`const ${registry}`));
  const block = source.slice(open, source.indexOf('\n};', open));
  return [...block.matchAll(/^\s+(\w+): \(\) =>/gm)].map((m) => m[1]);
};

test('the app and the web draw a scene on the same screens, in the same order: the web\'s pages the phone has not ported yet are stand-ins', () => {
  const inApp = screensOf(app, 'SCENE_SCREENS');
  expect(inApp).toEqual(['home', 'new', 'play', 'records', 'collection']);
  expect(screensOf(web, 'SCREENS')).toEqual(inApp);
});

test('every scene is drawn on a screen both sides have', () => {
  const screens = screensOf(web, 'SCREENS');
  for (const { name } of SCENES) expect(screens, name).toContain(name.split('-')[0]);
});

test('the life of a scene is begun with the same ids, seeds and clock wherever it is made: the core\'s, the web\'s tests\' and the phone\'s', () => {
  const deps = "{ newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) }";
  for (const [where, source] of Object.entries({
    core,
    'the web\'s memoryServices': read('../../web/src/testing/render.tsx'),
    'the phone\'s memoryServices': read('../src/testing/memoryServices.ts'),
  })) {
    expect(source, where).toContain(deps);
    expect(source, where).toContain('let clock = 1_000;');
  }
});

test('the web\'s scene page is given its game in memory: it makes no client of the project, and keeps nothing on the device', () => {
  expect(web).not.toMatch(/supabase|@\/online|indexedDB|localStorage|@ratrace\/online/i);
  expect(web).toMatch(/<GameProvider services=\{built\.services\}>/);
});

test('the app\'s route is for development only, and everything it wires is behind testing/scene.tsx', () => {
  expect(route).toMatch(/if \(!__DEV__\) return <Redirect href="\/" \/>;/);
  expect([...route.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['expo-router', '../testing/scene']);
});
