import { readFileSync } from 'node:fs';
import { SCENES } from '@ratrace/core/testing/scenes';
import { expect, test } from 'vitest';
import { STAND_INS } from './sceneShots';

// The scenes of the app and the web's are compared shot for shot: the same scenes, each drawn on the screen its name starts with.
// (Here, not beside the route: every file under src/app is a route to expo-router, a test too.)
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/testing/scene.tsx');
const web = read('../../web/src/app/[locale]/kit/scene/page.tsx');
const route = read('../src/app/scene.tsx');
const core = read('../../../packages/core/src/session/fixed.ts');

/** The screens a registry lists, in its order: each `name: (…) =>` of the object the registry is, up to its closing `};`. */
const entriesOf = (source: string, registry: string): Array<{ screen: string; body: string }> => {
  const open = source.indexOf('= {', source.indexOf(`const ${registry}`));
  const block = source.slice(open, source.indexOf('\n};', open));
  return [...block.matchAll(/^\s+(\w+): \(\w*\) => (.*),$/gm)].map((m) => ({ screen: m[1], body: m[2] }));
};
const screensOf = (source: string, registry: string): string[] => entriesOf(source, registry).map((entry) => entry.screen);

test('the app and the web draw a scene on the same screens, in the same order: the web\'s pages the phone has not ported yet are stand-ins', () => {
  const inApp = screensOf(app, 'SCENE_SCREENS');
  expect(inApp).toEqual(['home', 'new', 'play', 'records', 'collection', 'challenge', 'legal']);
  expect(screensOf(web, 'SCREENS')).toEqual(inApp);
});

test('every scene is drawn on a screen both sides have: the first word of its name', () => {
  const screens = screensOf(web, 'SCREENS');
  for (const { name } of SCENES) expect(screens, name).toContain(name.split('-')[0]);
  expect(app).toContain('screenOf(');
  expect(web).toContain('screenOf(');
});

test('a registry\'s screen is given the scene, on both sides, so that a scene\'s sheet can be the screen\'s to open', () => {
  const type = 'Readonly<Record<string, (scene: Scene) => ReactNode>>';
  expect(app).toContain(`type SceneScreens = ${type}`);
  expect(web).toContain(`SCREENS: ${type} = {`);
  expect(app).toContain('screens[screenOf(scene)]?.(scene)');
  expect(web).toContain('SCREENS[screenOf(scene)](scene)');
});

test('a scene that goes on once the game is open is drawn after its steps, on both sides: the core\'s one function, a screen first drawn at the stage the scene ends on', () => {
  for (const [where, source] of Object.entries({ app, web })) {
    expect(source, where).toContain('runScene(scene.name, { getState:');
    expect(source, where).toMatch(/\{over \? /);
  }
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

// What is around the page (the layout's own GameProvider, which opens the browser's database and, with the project's address in the
// environment, asks the cloud who is playing) is not the page's. The shots keep the browser from the project themselves: shotDrivers.test.ts.
test('the web\'s scene page names no client of the project and no store of the device, and gives its game its services in memory', () => {
  expect(web).not.toMatch(/supabase|@\/online|indexedDB|localStorage|@ratrace\/online/i);
  expect(web).toContain('sceneServices(store)');
  expect(web).toMatch(/<GameProvider services=\{services\}>/);
});

test('the app\'s route is for development only, and everything it wires is behind testing/scene.tsx', () => {
  expect(route).toMatch(/if \(!__DEV__\) return <Redirect href="\/" \/>;/);
  expect([...route.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['expo-router', '../testing/scene']);
});

test('the screens the shots do not compare are the ones the app still draws as phase 1\'s stand-ins: a screen\'s task takes its word out of both', () => {
  const standIns = (/import \{([^}]*)\} from '\.\.\/game\/screens\/Placeholder'/.exec(app)?.[1] ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  expect(standIns.length).toBeGreaterThan(0);
  const drawnAsOne = entriesOf(app, 'SCENE_SCREENS').filter((entry) => standIns.some((name) => new RegExp(`<${name}\\b`).test(entry.body)));
  expect(drawnAsOne.map((entry) => entry.screen)).toEqual([...STAND_INS]);
});

// The legal page is a server component, which the scene page (a client one) cannot draw: the scene has a copy of its body, held to it here.
test('the web\'s legal scene draws the legal page\'s own sections and layout, line for line', () => {
  const page = read('../../web/src/app/[locale]/legal/page.tsx');
  const scene = read('../../web/src/app/[locale]/kit/scene/Legal.tsx');
  const body = (source: string) => source.slice(source.indexOf('const sections = ['));
  expect(body(page).length).toBeGreaterThan(900);
  expect(body(scene)).toBe(body(page));
  // The same two constants, from the same file.
  for (const source of [page, scene]) expect(source).toContain("import { LEGAL_EMAIL, LEGAL_NAME } from '@/lib/site';");
});

test('the front door\'s settings are open in the web\'s scene by the page, not by the shot: a scene names the sheet, and the app draws the same sheet beside the door', () => {
  expect(web).toContain("document.querySelector<HTMLElement>('button[aria-label=\"Settings\"]')?.click()");
  expect(app).toContain("scene.sheet === 'settings' ? <><Home /><HomeSettingsSheet open onClose={nothing} /></> : <Home />");
});
