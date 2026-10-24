import { readdirSync, readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import { afterAll, beforeAll, expect, test } from 'vitest';

/*
 * The app's own links (`theratrace://<page>?…`): the router reads them by itself, with no table of the app's. Its own code is run here, as the phone
 * runs it: the link made into a path (`extractExpoPathFromURL`), and the path into the route and its query, by the config it builds from the files
 * of `app/` (`getRoutes`, `getLinkingConfig`, `getStateFromPath`). Of what that code asks for, only the native modules are stood in for: expo-linking's
 * unwrapping of a development launch (nothing to unwrap in a link of the app's) and the platform.
 */

const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')) as { expo: { scheme: string } };
const routes = readdirSync(new URL('./app', import.meta.url), { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
const routerFile = createRequire(import.meta.url).resolve('expo-router/package.json');
const router = createRequire(routerFile);

/** What the router's own code needs of the phone, while it is loaded. */
const NATIVE: Record<string, unknown> = { 'expo-linking': { unwrapDevLaunchURL: (url: string) => url }, expo: { Platform: { OS: 'ios' } } };
type Load = (request: string, parent: unknown, isMain: boolean) => unknown;
const loader = Module as unknown as { _load: Load };
const load = loader._load;
beforeAll(() => {
  loader._load = function (this: unknown, request, parent, isMain) {
    return Object.hasOwn(NATIVE, request) ? NATIVE[request] : load.call(this, request, parent, isMain);
  };
});
afterAll(() => {
  loader._load = load;
});

/** Where the router takes a link: the route, and what its query gives the route. */
function opened(url: string): { route: string; params: unknown } {
  const { extractExpoPathFromURL } = router('./build/fork/extractPathFromURL') as { extractExpoPathFromURL(prefixes: string[], url: string): string };
  const { getRoutes } = router('./build/getRoutes') as { getRoutes(context: unknown, options: Record<string, unknown>): unknown };
  const { getLinkingConfig } = router('./build/getLinkingConfig') as { getLinkingConfig(routes: unknown, context: unknown, options: Record<string, unknown>): { config: unknown } };
  const { getStateFromPath } = router('./build/fork/getStateFromPath') as {
    getStateFromPath(path: string, config: unknown): { routes: Array<{ state: { routes: Array<{ name: string; params?: unknown }> } }> };
  };
  // The app's routes, as Metro hands them to the router: its files, each a screen.
  const files = routes.map((file) => `./${file}`);
  const context = Object.assign(() => ({ default: () => null }), { keys: () => files, resolve: (key: string) => key, id: 'app' });
  const linking = getLinkingConfig(getRoutes(context, { platform: 'ios', skipGenerated: true, ignoreEntryPoints: true }), context, { skipGenerated: true });
  const [inside] = getStateFromPath(extractExpoPathFromURL([], url), linking.config).routes[0].state.routes;
  return { route: inside.name, params: inside.params };
}

test('the app answers to its own scheme, which its links are written in', () => {
  expect(config.expo.scheme).toBe('theratrace');
});

test('an invitation to a game opens the games with others on its code, with nothing but the router: `/{l}/room?code=`, where the app\'s own link leads', () => {
  expect(routes).toContain('[locale]/room.tsx');
  // The app's own link (`theratrace://room?code=`) is made a page in the phone's language first (`app/+native-intent.tsx`, game/pages.test.tsx).
  expect(opened('/en/room?code=K7Q2XM')).toEqual({ route: '[locale]/room', params: { locale: 'en', code: 'K7Q2XM' } });
  // A code as it was typed or pasted reaches the screen as it is: the screen cleans it.
  expect(opened('/es/room?code=k7q2xm')).toEqual({ route: '[locale]/room', params: { locale: 'es', code: 'k7q2xm' } });
  // And the other pages a notice names, the same way: the friends by the query the server writes, or by the web's hash, which a path keeps.
  expect(opened('/ru/rankings?tab=friends')).toEqual({ route: '[locale]/rankings', params: { locale: 'ru', tab: 'friends' } });
  expect(opened('/en/rankings#friends')).toEqual({ route: '[locale]/rankings', params: { locale: 'en', '#': 'friends' } });
  // The front door of a language, and the bare address, which leads to one.
  expect(opened('/es')).toEqual({ route: '[locale]/index', params: { locale: 'es' } });
  expect(opened('/').route).toBe('index');
  // What stays outside the languages: Google's way back, the development routes.
  expect(opened('theratrace://auth?code=c0de').route).toBe('auth');
  expect(opened('theratrace:///perf?life=moment-escape')).toEqual({ route: 'perf', params: { life: 'moment-escape' } });
});
