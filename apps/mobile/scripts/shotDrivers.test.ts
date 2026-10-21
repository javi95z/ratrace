import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { blocked, guardedContext, openPage, refuseServerInUse, SPRITES_MS, STILL_MS, STILL_SHOTS, stillShot, TEXT_BOXES } from './shotDrivers';
import type { Browser, Context, Page } from './shotDrivers';

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

test('a page is opened with the rules of the page added to what is always added, and with nothing more when none is asked', async () => {
  const styles: string[] = [];
  const page = {
    goto: async () => undefined,
    evaluate: async () => undefined,
    waitForFunction: async () => undefined,
    addStyleTag: async (options: { content: string }) => void styles.push(options.content),
  } as unknown as Page;
  await openPage(page, 'http://localhost:3021/', undefined);
  await openPage(page, 'http://localhost:3021/', undefined, 'main { color: red; }');
  expect(styles[0]).toContain('nextjs-portal { display: none !important; }');
  expect(styles[0]).not.toContain('color: red');
  expect(styles[1]).toContain('nextjs-portal { display: none !important; }');
  expect(styles[1]).toContain('main { color: red; }');
}, 10_000);

test('the scenes are shot on web pages as tall as the screen shows, by the one rule that says so', () => {
  const source = read('./scene-shots.ts');
  expect(source).toMatch(/await openPage\(page, sceneWebUrl\(scene, PORT\), \(\) => document\.querySelector\('\[data-scene\]'\) !== null, webRules\(scene\)\)/);
});

test('a screen is given nine seconds for its sprites to load before it is shot, and the shot waits for no less (4 s once left the front door\'s gear out of a full run, 6 s four icons on a busy machine)', () => {
  expect(SPRITES_MS).toBe(9000);
  expect(read('./shotDrivers.ts')).toContain('await sleep(SPRITES_MS);');
});

test('the app is shot once its screen is still: a sprite that came late is in the shot, and a screen that keeps moving is shot at the last try', async () => {
  const waited: number[] = [];
  const wait = async (ms: number) => void waited.push(ms);
  // A lock not drawn yet in the first shot, drawn in the second: the third, the same as the second, is the one kept.
  const late = [Buffer.from('no lock'), Buffer.from('lock'), Buffer.from('lock')];
  let taken = 0;
  expect(await stillShot(() => late[taken++], wait)).toEqual({ png: Buffer.from('lock'), still: true });
  expect(taken).toBe(3);
  expect(waited).toEqual([STILL_MS, STILL_MS]);
  // Still from the first: two shots, no more.
  taken = 0;
  expect(await stillShot(() => (taken++, Buffer.from('home')), wait)).toEqual({ png: Buffer.from('home'), still: true });
  expect(taken).toBe(2);
  // Never still (a loop): the first and STILL_SHOTS more, and the last is kept.
  taken = 0;
  expect(await stillShot(() => Buffer.from(`frame ${taken++}`), wait)).toEqual({ png: Buffer.from(`frame ${STILL_SHOTS}`), still: false });
  expect(taken).toBe(STILL_SHOTS + 1);
  // The app's shots are taken so, after the sprites' wait.
  const source = read('./shotDrivers.ts');
  expect(source.indexOf('await sleep(SPRITES_MS);')).toBeLessThan(source.indexOf('await stillShot('));
});

// A page of jsdom's, with the two calls only a browser that lays out can answer stood in for.
test('the lines of text a shot measures are those drawn: words only a screen reader reads (a page\'s `sr-only` heading) are left out', async () => {
  // jsdom is the tests' own page (it has no types in this app): named by a string, it is taken as it comes.
  const library: string = 'jsdom';
  const { JSDOM } = (await import(library)) as { JSDOM: new (html: string) => { window: Window & typeof globalThis } };
  const dom = new JSDOM('<body><h1 style="position:absolute;clip-path:inset(50%)">Software engineer, age 32</h1><h2 style="clip:rect(0px, 0px, 0px, 0px)">Old way</h2><p style="color:rgb(1, 2, 3)">Haruto</p></body>');
  const { window } = dom;
  window.Range.prototype.getClientRects = () => [{ left: 10, top: 20, width: 30, height: 12 }] as unknown as DOMRectList;
  window.document.elementFromPoint = () => null;
  const globals = { document: window.document, NodeFilter: window.NodeFilter, getComputedStyle: window.getComputedStyle.bind(window) };
  const saved = Object.fromEntries(Object.keys(globals).map((key) => [key, (globalThis as Record<string, unknown>)[key]]));
  Object.assign(globalThis, globals);
  try {
    const boxes = TEXT_BOXES();
    expect(boxes.map((box) => box.text)).toEqual(['Haruto']);
    expect(boxes[0]).toMatchObject({ x: 10, y: 20, w: 30, h: 12, color: [1, 2, 3] });
  } finally {
    Object.assign(globalThis, saved);
  }
});
