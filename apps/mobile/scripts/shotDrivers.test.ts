import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blocked, guardedContext, refuseServerInUse } from './shotDrivers';
import type { Browser, Context } from './shotDrivers';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a browser shooting the game reaches only this machine: the project\'s servers and every other host are blocked', () => {
  for (const url of [
    'https://abcdefgh.supabase.co/auth/v1/signup',
    'https://abcdefgh.supabase.co/rest/v1/rpc/anything',
    'wss://abcdefgh.supabase.co/realtime/v1/websocket?apikey=x',
    'https://abcdefgh.supabase.in/auth/v1/token',
    'https://auth.the-rat-race.example/token',
    'https://fonts.googleapis.com/css2?family=Jersey+15',
    'http://localhost.evil.example/',
    'not a url',
  ]) expect(blocked(url), url).toBe(true);
  for (const url of ['http://localhost:3021/en/kit/scene?name=home-new', 'http://127.0.0.1:3021/_next/static/x.js', 'http://[::1]:3021/', 'ws://localhost:3021/_next/webpack-hmr', 'data:image/png;base64,AAAA', 'blob:http://localhost:3021/1234', 'about:blank']) {
    expect(blocked(url), url).toBe(false);
  }
});

/** A browser that keeps what was asked of it: the context's options, the routes laid over its requests and its sockets. */
function fakeBrowser() {
  const asked = { options: undefined as object | undefined, routes: [] as Array<{ match: (url: URL) => boolean; handler: Parameters<Context['route']>[1] }>, sockets: [] as Array<{ match: (url: URL) => boolean; handler: Parameters<Context['routeWebSocket']>[1] }> };
  const context: Context = {
    route: async (match, handler) => void asked.routes.push({ match, handler }),
    routeWebSocket: async (match, handler) => void asked.sockets.push({ match, handler }),
    newPage: async () => {
      // A page is asked for only after every request is already under a rule.
      expect(asked.routes.length).toBeGreaterThan(0);
      return {} as never;
    },
    newCDPSession: async () => ({ send: async () => undefined }),
  };
  const browser: Browser = { newContext: async (options) => ((asked.options = options), context), close: async () => undefined };
  return { asked, context, browser };
}

test('the context is made with a rule that aborts every request to the project, and its sockets, before any page is opened in it', async () => {
  const { asked, context, browser } = fakeBrowser();
  const told: string[] = [];
  const made = await guardedContext(browser, { viewport: { width: 402, height: 874 } }, (url) => told.push(url));
  expect(made).toBe(context);
  expect(asked.options).toMatchObject({ viewport: { width: 402, height: 874 }, serviceWorkers: 'block' });
  expect(asked.routes).toHaveLength(1);
  expect(asked.sockets).toHaveLength(1);
  const [{ match, handler }] = asked.routes;
  expect(match(new URL('https://abcdefgh.supabase.co/auth/v1/signup'))).toBe(true);
  expect(match(new URL('http://localhost:3021/en/kit'))).toBe(false);
  let aborted = 0;
  await handler({ abort: async () => void (aborted += 1), request: () => ({ url: () => 'https://abcdefgh.supabase.co/auth/v1/signup' }) });
  expect(aborted).toBe(1);
  expect(told).toEqual(['https://abcdefgh.supabase.co/auth/v1/signup']);
  const [socket] = asked.sockets;
  expect(socket.match(new URL('wss://abcdefgh.supabase.co/realtime/v1/websocket'))).toBe(true);
  expect(socket.match(new URL('ws://localhost:3021/_next/webpack-hmr'))).toBe(false);
  let closed = 0;
  await socket.handler({ close: async () => void (closed += 1) });
  expect(closed).toBe(1);
  await made.newPage();
});

test('a server already answering on the port is not used: it may be the player\'s own, with the project\'s address in its environment', () => {
  expect(() => refuseServerInUse(false, 3021)).not.toThrow();
  expect(() => refuseServerInUse(true, 3021)).toThrow(/port 3021 is already answering.*stop it/);
});

test('the shared driver makes its context only through the guard, and starts its own server with no project in its environment', () => {
  const source = read('./shotDrivers.ts');
  expect([...source.matchAll(/\.newContext\(/g)]).toHaveLength(1);
  expect(source).toMatch(/await guardedContext\(\s*browser,/);
  expect(source).toContain('refuseServerInUse(up, PORT)');
  expect(source).toContain('fetch(`http://localhost:${PORT}/`).then(() => true, () => false)');
  expect(source).toContain("NEXT_PUBLIC_SUPABASE_URL: ''");
  expect(source).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ''");
});

test('every shot of a scene is taken on the day every scene is drawn on: the browser\'s clock is set before the page loads, and read back after', () => {
  const source = read('./scene-shots.ts');
  const set = source.indexOf('page.clock.setFixedTime(SCENE_NOW)');
  const load = source.indexOf('await openPage(page,');
  expect(set).toBeGreaterThan(-1);
  expect(load).toBeGreaterThan(set);
  expect(source).toContain('await page.evaluate(() => Date.now())');
  expect(source).toContain('SCENE_NOW');
});
