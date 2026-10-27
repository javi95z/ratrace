import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { APP_WEB_STILL_SHOTS, appWebAnswering, blocked, changedBox, changedWithin, guardedContext, QUIET_FOCUS, NUDGE, serveThroughNudge, openPage, readyServer, refuseServerInUse, routeTold, simctl, SPRITES_MS, STILL_ALIKE, STILL_MS, STILL_SHOTS, stillShot, stopAfter, stoppedWithin, TEXT_BOXES, whileServing, WORKER_REQUESTS_ROUTED } from './shotDrivers';
import type { Browser, Context, Page } from './shotDrivers';
import { DESK } from './kitCompare';

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

test('the offline check alone lets the site\'s worker run, under the same rules, and its own requests under them too', async () => {
  const { asked, browser } = fakeBrowser();
  await guardedContext(browser, {}, () => undefined, 'allow');
  expect(asked.options).toMatchObject({ serviceWorkers: 'allow' });
  expect(asked.routes).toHaveLength(1);
  expect(asked.sockets).toHaveLength(1);
  expect(WORKER_REQUESTS_ROUTED).toBe('PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS');
  expect(read('./shotDrivers.ts')).toContain('process.env[WORKER_REQUESTS_ROUTED] = \'1\';');
  // The one script that allows it builds the site with no project (the build writes the worker into it), or serves one built with none, on this
  // machine.
  const offline = read('./web-offline.ts');
  expect([...read('./shotDrivers.ts').matchAll(/'allow'\)/g), ...read('./sceneShots.ts').matchAll(/'allow'\)/g)]).toHaveLength(0);
  expect(offline).toContain("(url) => kept.add(new URL(url).host), 'allow');");
  expect(offline).toContain('exportEnv(process.env)');
  expect(offline).toContain('buildSite(dir, exportEnv(process.env))');
  expect(offline).toContain('projectsInSite(given)');
  expect(offline).toContain('refuseServerInUse(up, APP_WEB_PORT)');
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
  // A lock not drawn yet in the first shot, drawn in the second: kept once it has stayed for three shots alike.
  expect(STILL_ALIKE).toBe(3);
  const late = [Buffer.from('no lock'), Buffer.from('lock'), Buffer.from('lock'), Buffer.from('lock')];
  let taken = 0;
  expect(await stillShot(() => late[taken++], { wait })).toEqual({ png: Buffer.from('lock'), still: true });
  expect(taken).toBe(4);
  expect(waited).toEqual([STILL_MS, STILL_MS, STILL_MS]);
  // Two alike, then a change (a picture painted late), then alike again: the count starts over.
  const painted = ['a', 'a', 'b', 'b', 'b'].map((shot) => Buffer.from(shot));
  taken = 0;
  expect(await stillShot(() => painted[taken++], { wait })).toEqual({ png: Buffer.from('b'), still: true });
  expect(taken).toBe(5);
  // Still from the first: three shots, no more.
  taken = 0;
  expect(await stillShot(() => (taken++, Buffer.from('home')), { wait })).toEqual({ png: Buffer.from('home'), still: true });
  expect(taken).toBe(3);
  // Never still (a loop): the first and STILL_SHOTS more, and the last is kept.
  taken = 0;
  expect(await stillShot(() => Buffer.from(`frame ${taken++}`), { wait })).toEqual({ png: Buffer.from(`frame ${STILL_SHOTS}`), still: false });
  expect(taken).toBe(STILL_SHOTS + 1);
  // The app's shots are taken so, after the sprites' wait.
  const source = read('./shotDrivers.ts');
  expect(source.indexOf('await sleep(SPRITES_MS);')).toBeLessThan(source.indexOf('await stillShot('));
  // A screen that never stood still is not only told as it is shot: shootApp gives its route back, for the run's result, and names it again at the end.
  expect(source).toContain('if (!still) moving.push(route);');
  expect(source).toContain('return moving;');
  expect(source).toContain('never still:');
});

test('the app\'s scene says when it is ready to be shot, and when it is not again, to a server of the driver\'s on this machine: the shot waits for that scene\'s word', async () => {
  const told = await readyServer(0);
  try {
    const say = (name: string, ready: boolean, n: number) => fetch(`http://127.0.0.1:${told.port}/ready?name=${encodeURIComponent(name)}&ready=${ready ? 1 : 0}&n=${n}`);
    // Word of another scene is not this one's.
    await say('home-new', true, 1);
    expect(await told.wait('hud-jailed', 300)).toBe(false);
    expect(told.ready('hud-jailed')).toBe(false);
    setTimeout(() => void say('hud-jailed', true, 2), 50);
    expect(await told.wait('hud-jailed', 5_000)).toBe(true);
    expect(told.ready('hud-jailed')).toBe(true);
    // A picture asked for later (a part drawn once the page is laid out): not ready again, until it is in.
    await say('hud-jailed', false, 3);
    expect(told.ready('hud-jailed')).toBe(false);
    // Word that arrives late, after newer word, is not taken.
    await say('hud-jailed', true, 2);
    expect(told.ready('hud-jailed')).toBe(false);
    await say('hud-jailed', true, 4);
    expect(told.ready('hud-jailed')).toBe(true);
    // Anything else asked of it is refused.
    expect((await fetch(`http://127.0.0.1:${told.port}/other`)).status).toBe(404);
  } finally {
    await told.close();
  }
  // The route a scene is opened on tells it where to say so; a route opened for nothing else (the kit's) is opened as it is.
  expect(routeTold('scene?name=hud-jailed', 8093)).toBe('scene?name=hud-jailed&ready=8093');
  const source = read('./shotDrivers.ts');
  expect(source).toContain('!(await told.wait(name, READY_MS))');
  expect(source.indexOf('!(await told.wait(name, READY_MS))')).toBeLessThan(source.indexOf('await stillShot('));
  // Each shot of the still ones is taken with the scene ready; the scenes' shots name their scene, the kit's do not.
  expect(source).toContain('ready: () => told === null || name === undefined || told.ready(name)');
  expect(read('./scene-shots.ts')).toContain('name: scene.name');
});

test('shots alike are still only while the scene says it is ready: a screen that waits on a picture being read is not still, however long it stays the same', async () => {
  const wait = async () => {};
  const states = [false, false, true, true, true];
  let taken = 0;
  let readyNow = false;
  const shoot = () => {
    readyNow = states[taken];
    taken++;
    return Buffer.from('same');
  };
  expect(await stillShot(shoot, { wait, ready: () => readyNow })).toEqual({ png: Buffer.from('same'), still: true });
  expect(taken).toBe(5);
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

test('a line in a box greyed by a filter (a badge not earned yet) is looked for in the grey its colour is drawn in, not in the colour computed', async () => {
  const library: string = 'jsdom';
  const { JSDOM } = (await import(library)) as { JSDOM: new (html: string) => { window: Window & typeof globalThis } };
  const dom = new JSDOM('<body><div style="filter:grayscale(1)"><p style="color:rgb(242, 193, 78);background-color:rgb(31, 42, 77)">Millionaire by 35</p></div></body>');
  const { window } = dom;
  const doc = window.document;
  window.Range.prototype.getClientRects = () => [{ left: 10, top: 20, width: 100, height: 12 }] as unknown as DOMRectList;
  doc.elementFromPoint = () => doc.querySelector('p');
  const globals = { document: doc, NodeFilter: window.NodeFilter, getComputedStyle: window.getComputedStyle.bind(window) };
  const saved = Object.fromEntries(Object.keys(globals).map((key) => [key, (globalThis as Record<string, unknown>)[key]]));
  Object.assign(globalThis, globals);
  try {
    // Gold through the full matrix: 0.2126 × 242 + 0.7152 × 193 + 0.0722 × 78 = 195.1; the navy behind it 42.2.
    expect(TEXT_BOXES().map(({ color, back }) => ({ color, back }))).toEqual([{ color: [195, 195, 195], back: [42, 42, 42] }]);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a line cut short by a box that clips it (`truncate`: an ellipsis) is measured where it is drawn, not where its words would run on to', async () => {
  const library: string = 'jsdom';
  const { JSDOM } = (await import(library)) as { JSDOM: new (html: string) => { window: Window & typeof globalThis } };
  const dom = new JSDOM('<body><div style="overflow:hidden"><p style="color:rgb(1, 2, 3)">Your $127,830 in cash buys 6.3% less than</p></div></body>');
  const { window } = dom;
  const doc = window.document;
  window.Range.prototype.getClientRects = () => [{ left: 10, top: 20, width: 300, height: 12 }] as unknown as DOMRectList;
  doc.querySelector('div')!.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
  doc.elementFromPoint = () => doc.querySelector('p');
  const globals = { document: doc, NodeFilter: window.NodeFilter, getComputedStyle: window.getComputedStyle.bind(window) };
  const saved = Object.fromEntries(Object.keys(globals).map((key) => [key, (globalThis as Record<string, unknown>)[key]]));
  Object.assign(globalThis, globals);
  try {
    expect(TEXT_BOXES().map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([{ x: 10, y: 20, w: 190, h: 12 }]);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a line partly under decoration that takes the pointer in a shot (the calendar of a turning round) is measured where it shows, either side; under a backdrop it is covered whole', async () => {
  const library: string = 'jsdom';
  const { JSDOM } = (await import(library)) as { JSDOM: new (html: string) => { window: Window & typeof globalThis } };
  const dom = new JSDOM('<body><p style="color:rgb(26, 28, 44)">Survey: everyone is middle class</p><div data-motion-only><div id="calendar"></div></div><div id="backdrop"></div></body>');
  const { window } = dom;
  const doc = window.document;
  const line = doc.querySelector('p')!;
  window.Range.prototype.getClientRects = () => [{ left: 0, top: 20, width: 100, height: 10 }] as unknown as DOMRectList;
  const globals = { document: doc, NodeFilter: window.NodeFilter, getComputedStyle: window.getComputedStyle.bind(window) };
  const saved = Object.fromEntries(Object.keys(globals).map((key) => [key, (globalThis as Record<string, unknown>)[key]]));
  Object.assign(globalThis, globals);
  try {
    // The calendar over the middle of the line, from 40 to 60: each part that shows, stopping two points short of it.
    doc.elementFromPoint = (x: number) => (x >= 40 && x < 60 ? doc.getElementById('calendar') : line);
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([
      { x: 0, w: 38, covered: false },
      { x: 62, w: 38, covered: false },
    ]);
    // Over its end only: what shows is measured, from its start.
    doc.elementFromPoint = (x: number) => (x >= 90 ? doc.getElementById('calendar') : line);
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([{ x: 0, w: 88, covered: false }]);
    // Turned: at the line's top it reaches further (from 35) than at its middle (40); the part stops short of where it reaches first.
    doc.elementFromPoint = (x: number, y: number) => (x >= (y < 22 ? 35 : 40) ? doc.getElementById('calendar') : line);
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([{ x: 0, w: 33, covered: false }]);
    // All of it under the calendar: covered, and not measured.
    doc.elementFromPoint = () => doc.getElementById('calendar');
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([{ x: 0, w: 100, covered: true }]);
    // A sheet's backdrop over the whole of it: covered, and not measured, as before.
    doc.elementFromPoint = () => doc.getElementById('backdrop');
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([{ x: 0, w: 100, covered: true }]);
    // Nothing over it: the line whole.
    doc.elementFromPoint = () => line;
    expect(TEXT_BOXES().map(({ x, w, covered }) => ({ x, w, covered }))).toEqual([{ x: 0, w: 100, covered: false }]);
    // The calendar's own lines are judged at their middle, whatever of the calendar is round them (its other page, behind the torn one).
    doc.getElementById('calendar')!.innerHTML = '<span style="color:rgb(26, 28, 44)">22</span>';
    line.remove();
    const age = doc.querySelector('span')!;
    doc.elementFromPoint = (x: number) => (x < 20 ? doc.getElementById('calendar') : age);
    expect(TEXT_BOXES().map(({ text, x, w, covered }) => ({ text, x, w, covered }))).toEqual([{ text: '22', x: 0, w: 100, covered: false }]);
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a command to the simulator that fails is tried again a second later, up to three times; one that never works throws its last failure', () => {
  const tried: string[] = [];
  let pauses = 0;
  let failures = 2;
  const flaky = (args: readonly string[]) => {
    tried.push(args.join(' '));
    if (failures-- > 0) throw new Error(`refused ${tried.length}`);
  };
  simctl(['io', 'booted', 'screenshot', 'a.png'], { exec: flaky, pause: () => void (pauses += 1) });
  expect(tried).toEqual(['io booted screenshot a.png', 'io booted screenshot a.png', 'io booted screenshot a.png']);
  expect(pauses).toBe(2);
  let count = 0;
  expect(() =>
    simctl(['openurl', 'booted', 'x'], {
      exec: () => {
        count += 1;
        throw new Error(`gone ${count}`);
      },
      pause: () => undefined,
    }),
  ).toThrow('gone 3');
});

test('tells a server that stopped on its own from one still serving: the web\'s server, stopped by Next to recommend an upgrade, is started again', async () => {
  const done = spawn(process.execPath, ['-e', 'process.exit(0)']);
  expect(await stoppedWithin(done, 5_000)).toBe(true);
  // Asked again once it has stopped: said at once.
  expect(await stoppedWithin(done, 10)).toBe(true);
  const serving = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)']);
  try {
    expect(await stoppedWithin(serving, 200)).toBe(false);
  } finally {
    serving.kill();
  }
  // The words Next.js stops a dev server with (next/dist/lib/upgrade/nudge.js), which the driver looks for in the server's log.
  expect(NUDGE).toBe('This command stopped to show the upgrade recommendation');
});

/** A server as `serveThroughNudge` sees it: whether it stops in the watch after it answers, and what its log says by then. */
function servers(stops: boolean[], says: string[]) {
  const started: number[] = [];
  const stopped: number[] = [];
  let log = '';
  return {
    started,
    stopped,
    parts: {
      start: () => {
        const n = started.length;
        started.push(n);
        log += says[n] ?? '';
        return n;
      },
      ready: async () => undefined,
      stoppedWithin: async (n: number) => stops[n] ?? false,
      log: () => log,
      stop: (n: number) => void stopped.push(n),
      logFile: 'web-server.log',
      tell: () => undefined,
    },
  };
}

test('the web\'s server: kept as it is when it serves on; started once more when Next stopped it to recommend an upgrade, the first one stopped for good; any other stop, or a second one, fails the run at once with the log', async () => {
  const serving = servers([false], ['ready']);
  expect(await serveThroughNudge(serving.parts)).toBe(0);
  expect(serving.started).toEqual([0]);

  const nudged = servers([true, false], [`ready\n${NUDGE}`, 'ready again']);
  expect(await serveThroughNudge(nudged.parts)).toBe(1);
  expect(nudged.started).toEqual([0, 1]);
  // The first server's process group is stopped before the second starts: none of its workers is left behind.
  expect(nudged.stopped).toEqual([0]);

  const crashed = servers([true], ['ready\nError: listen EADDRINUSE']);
  await expect(serveThroughNudge(crashed.parts)).rejects.toThrow("the web's server stopped: see web-server.log");
  expect(crashed.started).toEqual([0]);

  // Stopped by the nudge before its first page answered: seen at once, not after the wait for the page has run out.
  const early = servers([true, false], [NUDGE, 'ready again']);
  early.parts.ready = () => (early.started.length === 1 ? new Promise<undefined>(() => undefined) : Promise.resolve(undefined));
  expect(await serveThroughNudge(early.parts)).toBe(1);
  expect(early.stopped).toEqual([0]);

  const twice = servers([true, true], [`ready\n${NUDGE}`, `ready\n${NUDGE}`]);
  await expect(serveThroughNudge(twice.parts)).rejects.toThrow("the web's server stopped again: see web-server.log");
});

test('a server that stops while the shots are taken fails them at once, naming its log; one stopped after them is no error', async () => {
  const server = new EventEmitter();
  let finish: () => void = () => undefined;
  const shooting = whileServing(server as never, 'web-server.log', () => new Promise<void>((resolve) => (finish = resolve)));
  server.emit('exit', 1);
  await expect(shooting).rejects.toThrow("the web's server stopped during the shots: see web-server.log");
  finish();
  const fine = whileServing(server as never, 'web-server.log', async () => 'shot');
  expect(await fine).toBe('shot');
  // Stopped after: nobody listens, nothing rejects.
  expect(server.listenerCount('exit')).toBe(0);
  server.emit('exit', 0);
});

test('a server that cannot be stopped after the shots is said, not thrown over the error the shots ended with', () => {
  const said: string[] = [];
  stopAfter({ pid: 42 } as never, () => {
    throw Object.assign(new Error('not permitted'), { code: 'EPERM' });
  }, (line) => said.push(line));
  expect(said).toEqual(["the web's server (42) could not be stopped: Error: not permitted"]);
});

test('the app\'s web page, another origin than the driver\'s, is answered with leave to read the answer: its word is heard and its console stays quiet', async () => {
  const told = await readyServer(0);
  try {
    const answer = await fetch(`http://127.0.0.1:${told.port}/ready?name=home-new&ready=1&n=1`);
    expect(answer.headers.get('access-control-allow-origin')).toBe('*');
    expect(told.ready('home-new')).toBe(true);
  } finally {
    await told.close();
  }
});

test('a shot taken by a browser, which answers later, is waited for as the simulator\'s is', async () => {
  let taken = 0;
  const shoot = async () => (taken++, Buffer.from('home'));
  expect(await stillShot(shoot, { wait: async () => undefined })).toEqual({ png: Buffer.from('home'), still: true });
  expect(taken).toBe(STILL_ALIKE);
});

test('the app\'s web is shot from the server already serving it on 8091, which the shots do not start: one that is not answering stops the run, saying how to start it', () => {
  expect(() => appWebAnswering(false, 8091)).toThrow('nothing answers on 8091: start the app\'s web in apps/mobile (EXPO_NO_METRO_LAZY=1 npx expo start --web --port 8091, with no EXPO_PUBLIC_SUPABASE_*)');
  expect(() => appWebAnswering(true, 8091)).not.toThrow();
  const source = read('./shotDrivers.ts');
  // The same browser as the web's, shaped like the same phone, kept from every host but this machine.
  expect(source).toContain('export async function withAppWebPage(');
  expect([...source.matchAll(/await phonePage\(browser, kept, screen\)/g)]).toHaveLength(2);
});

test('a scene of the app\'s web is shot on the day every scene is drawn on, once it says it is ready and a frame after, and once it is still', () => {
  const source = read('./scene-shots.ts');
  const step = source.slice(source.indexOf("steps.includes('appweb')"));
  const set = step.indexOf('page.clock.setFixedTime(SCENE_NOW)');
  const load = step.indexOf('await page.goto(routeTold(sceneAppWebUrl(scene), told.port)');
  const word = step.indexOf('await told.wait(scene.name, READY_MS)');
  const frame = step.indexOf('await page.evaluate(NEXT_FRAME)');
  const still = step.indexOf('await stillShot(');
  expect(set).toBeGreaterThan(-1);
  expect(load).toBeGreaterThan(set);
  expect(word).toBeGreaterThan(load);
  expect(frame).toBeGreaterThan(word);
  expect(still).toBeGreaterThan(frame);
  expect(step).toContain('ready: () => told.ready(scene.name)');
  expect(step).toContain('join(appWebOut, filesOf(scene.name, viewport).appweb)');
  // The focus ring a sheet opened with no tap takes is left out of both webs' shots, by the one rule.
  const quiet = step.indexOf('await page.addStyleTag({ content: QUIET_FOCUS });');
  expect(quiet).toBeGreaterThan(word);
  expect(quiet).toBeLessThan(still);
  expect(QUIET_FOCUS).toBe(':focus-visible { outline: none !important; }');
  expect(read('./shotDrivers.ts')).toContain('nextjs-portal { display: none !important; } ${QUIET_FOCUS} ${css}');
});

test('a screen whose only motion is its loops turning (a workplace\'s screens, a coin) is still, as the web\'s shot of the same moment is: any other change is not', () => {
  // Two shots of a 4 × 3 screen at scale 1, RGBA: a pixel changed at (1, 1).
  const shot = () => new Uint8Array(4 * 3 * 4).fill(10);
  const a = shot();
  const b = shot();
  b[(1 * 4 + 1) * 4] = 200;
  expect(changedWithin(a, b, 4, [{ x: 1, y: 1, w: 1, h: 1 }], 1)).toBe(true);
  expect(changedWithin(a, b, 4, [{ x: 2, y: 0, w: 2, h: 3 }], 1)).toBe(false);
  expect(changedWithin(a, b, 4, [], 1)).toBe(false);
  // At 3× a box of a point holds three pixels each way.
  const c = new Uint8Array(12 * 9 * 4).fill(10);
  const d = new Uint8Array(12 * 9 * 4).fill(10);
  d[(5 * 12 + 5) * 4 + 2] = 99;
  expect(changedWithin(c, d, 12, [{ x: 1, y: 1, w: 1, h: 1 }], 3)).toBe(true);
  expect(changedWithin(c, d, 12, [{ x: 2, y: 2, w: 1, h: 1 }], 3)).toBe(false);
  // Nothing changed: still, loops or not.
  expect(changedWithin(a, shot(), 4, [], 1)).toBe(true);
  // The app's web step asks it of a scene that never stood still, with the boxes its loops turn in.
  const step = read('./scene-shots.ts');
  expect(step).toContain('changedWithin(');
  expect(step).toContain('LOOP_BOXES');
});

test('where a screen that never stood still moved, in points, for the run to say', () => {
  const a = new Uint8Array(4 * 3 * 4).fill(10);
  const b = new Uint8Array(4 * 3 * 4).fill(10);
  expect(changedBox(a, b, 4, 1)).toBeNull();
  b[(1 * 4 + 1) * 4] = 200;
  b[(2 * 4 + 3) * 4 + 1] = 200;
  expect(changedBox(a, b, 4, 1)).toEqual({ x: 1, y: 1, w: 3, h: 2 });
  expect(read('./scene-shots.ts')).toContain('changedBox(');
});

test('the app\'s web is given twice the tries to stand still, past a picture Chrome rasters on other pixels for one shot now and then', async () => {
  expect(APP_WEB_STILL_SHOTS).toBe(2 * STILL_SHOTS);
  // A shot in three unlike the others: still within twice the tries, not within the phone's.
  const jitter = (i: number) => Buffer.from(i % 3 === 2 ? 'other pixels' : 'page');
  let taken = 0;
  expect((await stillShot(() => jitter(taken++), { wait: async () => undefined })).still).toBe(false);
  taken = 0;
  const flaky = [0, 1, 2, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0].map((n) => Buffer.from(n === 2 ? 'other pixels' : 'page'));
  expect((await stillShot(() => flaky[taken++], { wait: async () => undefined, shots: APP_WEB_STILL_SHOTS })).still).toBe(true);
  expect(read('./scene-shots.ts')).toContain('shots: APP_WEB_STILL_SHOTS');
});

test('a desk is Chrome on a laptop, 1280 by 800 at density 1: no phone\'s touch or safe areas, and the comparison crops nothing off it', () => {
  expect(DESK).toEqual({ width: 1280, height: 800, scale: 1, top: 0, bottom: 0 });
  const source = read('./shotDrivers.ts');
  expect(source).toContain('isMobile: phone, hasTouch: phone');
  expect(source).toContain('export async function withAppWebPage(shoot: (page: Page) => Promise<void>, screen: ShotScreen = SCREEN)');
  const step = read('./scene-shots.ts');
  expect(step).toContain('withAppWebPage(async (page) => {');
  expect(step).toContain('}, screen);');
  expect(step).toContain('appWeb ? files.appwebDiff : files.diff, screen)');
});
