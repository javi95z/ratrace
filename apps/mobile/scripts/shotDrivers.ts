import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { SCREEN } from './kitCompare';
import { APP_WEB_PORT } from './sceneShots';

/**
 * The two drivers every parity shot is taken with (`kit-shots.ts` for the kit, `scene-shots.ts` for the scenes): the web
 * in Chrome (Playwright, at the iPhone 16 Pro's 402 × 874 pt at 3×, with its safe areas: 62 on top, 34 below), and the app
 * in Expo Go on the booted simulator. The web is served by its own `next dev` on port 3021, started and stopped here. The
 * app is opened from the Metro already running on 8090 (`npx expo start --port 8090` in apps/mobile). Playwright and sharp
 * come from apps/web.
 */
const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '../../..');
export const web = join(root, 'apps/web');
/** The raw shots and the text boxes beside them: not kept (apps/mobile/.gitignore). */
export const raw = join(root, 'apps/mobile/.kit-shots');
export const fromWeb = createRequire(join(web, 'package.json'));

export const PORT = 3021;
export const METRO = 'exp://127.0.0.1:8090';

/** What is used of Playwright, which this app does not depend on: it is the web's. */
export interface Route {
  abort(): Promise<void>;
  request(): { url(): string };
}
export interface Context {
  newPage(): Promise<Page>;
  newCDPSession(page: Page): Promise<{ send(method: string, params: object): Promise<unknown> }>;
  route(match: (url: URL) => boolean, handler: (route: Route) => unknown): Promise<void>;
  routeWebSocket(match: (url: URL) => boolean, handler: (socket: { close(): Promise<void> }) => unknown): Promise<void>;
}
export interface Browser {
  newContext(options: object): Promise<Context>;
  close(): Promise<void>;
}
interface Chromium {
  launch(options: { channel: string }): Promise<Browser>;
}
export interface Page {
  goto(url: string, options: object): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<Awaited<T>>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  addStyleTag(options: { content: string }): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
  /** The page's clock: `setFixedTime` makes `Date.now()` and `new Date()` answer one instant, for as long as the page is open, and leaves every timer running. */
  clock: { setFixedTime(time: number): Promise<unknown> };
}

/**
 * Whether a request may not be made by a browser that is shooting the game: everything but this machine. The game is
 * shot to be compared, never to talk to anyone: the project's servers (a guest signing in is a write to the live
 * project) are among the hosts it keeps off, and so is every other. A page of data, a blob or an empty page is the browser's own.
 */
export function blocked(href: string): boolean {
  try {
    const url = new URL(href);
    if (['data:', 'blob:', 'about:'].includes(url.protocol)) return false;
    return !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return true;
  }
}

/**
 * A browser context with every request, and every socket, to anything but this machine aborted: laid before any page of it
 * is opened, and service workers blocked, which could answer round a rule. `told` hears each address that was kept off.
 */
export async function guardedContext(browser: Browser, options: object, told: (url: string) => void = () => undefined): Promise<Context> {
  const context = await browser.newContext({ ...options, serviceWorkers: 'block' });
  await context.route(
    (url) => blocked(url.href),
    async (route) => {
      told(route.request().url());
      await route.abort();
    },
  );
  await context.routeWebSocket(
    (url) => blocked(url.href),
    async (socket) => {
      await socket.close();
    },
  );
  return context;
}

/** A server already answering on the port is not ours to shoot: it may be the player's own, started with the project's address in its environment. */
export function refuseServerInUse(up: boolean, port: number): void {
  if (up) throw new Error(`port ${port} is already answering: stop it, the shots start a server of their own (with no project in its environment)`);
}

/**
 * In the page: every line of visible text, as client rects in CSS pixels, with the colour its glyphs are drawn in. Text a screen reader
 * alone reads (the `sr-only` of a heading: clipped to nothing, `clip-path: inset(50%)`, or `clip: rect(0 0 0 0)` before it) draws nothing,
 * and is left out: its box would still be reported where its words would stand, over the lines that are drawn there, and keep their ink
 * from being measured.
 */
export const TEXT_BOXES = () => {
  const boxes: Array<{ x: number; y: number; w: number; h: number; text: string; color: [number, number, number]; opacity: number; back?: [number, number, number]; covered: boolean }> = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    const el = node.parentElement;
    if (!text || !el || el.closest('script, style, nextjs-portal')) continue;
    // (No helper function: this one is sent to the page as its source, where the bundler's helpers for named functions do not exist.)
    let unseen = false;
    for (let up: Element | null = el; up && !unseen; up = up.parentElement) {
      const style = getComputedStyle(up);
      unseen = style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)';
    }
    if (unseen) continue;
    let color = (getComputedStyle(el).color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number) as [number, number, number];
    let opacity = 1;
    for (let up: Element | null = el; up; up = up.parentElement) opacity *= Number(getComputedStyle(up).opacity);
    let back: [number, number, number] | undefined;
    for (let up: Element | null = el; up && !back; up = up.parentElement) {
      const bg = getComputedStyle(up).backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (bg && (bg.length === 3 || bg[3] > 0)) back = [bg[0], bg[1], bg[2]];
    }
    // A box greyed by a filter round it (`grayscale`: a badge not earned yet) draws its words in the grey of their colour, not in the colour
    // computed: the filter's matrix (Filter Effects, at its amount) on the colour, and on the fill behind it.
    let grey = 0;
    for (let up: Element | null = el; up; up = up.parentElement) {
      const found = /grayscale\(([\d.]+)(%?)\)/.exec(getComputedStyle(up).filter ?? '');
      if (found) grey = Math.max(grey, Math.min(1, Number(found[1]) / (found[2] === '%' ? 100 : 1)));
    }
    if (grey > 0) {
      const g = 1 - grey;
      const rows = [
        [0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g],
        [0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g],
        [0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g],
      ];
      const was = color;
      color = [0, 1, 2].map((r) => Math.round(rows[r][0] * was[0] + rows[r][1] * was[1] + rows[r][2] * was[2])) as [number, number, number];
      if (back) {
        const under = back;
        back = [0, 1, 2].map((r) => Math.round(rows[r][0] * under[0] + rows[r][1] * under[1] + rows[r][2] * under[2])) as [number, number, number];
      }
    }
    // What of the line a box round it clips (a name cut short with an ellipsis, `truncate`; a row of tabs that scrolls sideways): the text's own
    // rects run on past it, over whatever stands beyond, where nothing of the line is drawn.
    let clipLeft = -Infinity;
    let clipRight = Infinity;
    let clipTop = -Infinity;
    let clipBottom = Infinity;
    for (let up: Element | null = el; up && up !== document.body; up = up.parentElement) {
      const style = getComputedStyle(up);
      const box = up.getBoundingClientRect();
      // (Read through the shorthand too, where a page that lays nothing out gives only what was written.)
      // (No helper function here either: see above.)
      const both = (style.overflow || 'visible').split(' ');
      const overX = (style.overflowX !== '' && style.overflowX !== 'visible') || both[0] !== 'visible';
      const overY = (style.overflowY !== '' && style.overflowY !== 'visible') || both[both.length - 1] !== 'visible';
      if (overX) {
        clipLeft = Math.max(clipLeft, box.left);
        clipRight = Math.min(clipRight, box.right);
      }
      if (overY) {
        clipTop = Math.max(clipTop, box.top);
        clipBottom = Math.min(clipBottom, box.bottom);
      }
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const whole of range.getClientRects()) {
      const shownLeft = Math.max(whole.left, clipLeft);
      const shownTop = Math.max(whole.top, clipTop);
      const r = { left: shownLeft, top: shownTop, width: Math.min(whole.left + whole.width, clipRight) - shownLeft, height: Math.min(whole.top + whole.height, clipBottom) - shownTop };
      if (r.width <= 0 || r.height <= 0) continue;
      const middle = r.top + r.height / 2;
      // Under a sheet's backdrop the topmost thing at the line's middle is not the line's own.
      const top = document.elementFromPoint(r.left + r.width / 2, middle);
      const covered = top !== null && !el.contains(top) && !top.contains(el);
      // Decoration over the page that a shot lets take the pointer (the calendar of a turning round: `CALENDAR_COVERS` in sceneShots.ts) may cover
      // part of a line: walked a point at a time along it (at its top, its middle and its foot, as the decoration may be turned), each part that shows
      // either side of it is measured as a line of its own, and the part under it is not (it would be measured with the decoration's ink). A part
      // stops two points short of the decoration: the window a line's ink is looked for in reaches a point past its box, and the decoration's edge
      // is drawn soft by one client and hard by the other. All of it under the decoration, the line is covered. The decoration's own lines, and
      // anything else over a line, are judged at the line's middle, as above.
      const own = el.closest('[data-motion-only]') !== null;
      const end = r.left + r.width;
      const clear = 2;
      let from: number | null = r.left;
      let parted = false;
      let shown = false;
      for (let x = r.left + 0.5; x < end && !own; x += 1) {
        let under = false;
        for (const y of [r.top + 0.5, middle, r.top + r.height - 0.5]) {
          const at = document.elementFromPoint(x, y);
          if (at !== null && at.closest('[data-motion-only]') !== null && !el.contains(at) && !at.contains(el)) under = true;
        }
        if (under && from !== null) {
          const to = x - 0.5 - clear;
          if (to > from) {
            boxes.push({ x: from, y: r.top, w: to - from, h: r.height, text: text.slice(0, 40), color, opacity, back, covered: false });
            shown = true;
          }
          from = null;
          parted = true;
        } else if (!under && from === null) from = x - 0.5 + clear;
      }
      if (!parted) boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: text.slice(0, 40), color, opacity, back, covered });
      else if (from !== null && end > from) boxes.push({ x: from, y: r.top, w: end - from, h: r.height, text: text.slice(0, 40), color, opacity, back, covered: false });
      else if (!shown) boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: text.slice(0, 40), color, opacity, back, covered: true });
    }
  }
  return boxes;
};

export async function waitFor(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error(`${url} did not answer in ${ms} ms`);
}

/** What Next.js says when it stops a dev server to recommend an upgrade (`next/dist/lib/upgrade/nudge.js`). */
export const NUDGE = 'This command stopped to show the upgrade recommendation';
/** How long a server that answers is watched for that stop: it comes once Next has asked the registry about its version. */
const NUDGE_MS = 8_000;

/** Whether a child process has stopped, or stops within `ms`. */
export function stoppedWithin(child: ChildProcess, ms: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((done) => {
    const timer = setTimeout(() => {
      child.off('exit', stopped);
      done(false);
    }, ms);
    const stopped = () => {
      clearTimeout(timer);
      done(true);
    };
    child.once('exit', stopped);
  });
}

/** What `serveThroughNudge` is given of a server: how to start, wait for, watch, read and stop one. */
export interface ServerParts<Child> {
  start(): Child;
  ready(): Promise<void>;
  stoppedWithin(child: Child, ms: number): Promise<boolean>;
  /** The server's log so far: every start's, one after the other. */
  log(): string;
  /** Stops a server's whole process group, gone already or not. */
  stop(child: Child): void;
  logFile: string;
  tell(line: string): void;
}

/**
 * Starts the web's server and waits until it answers and serves on. Next 16.4 stops a dev server it sees started by an agent, once, a moment after it
 * answers, to recommend an upgrade (its "upgrade nudge"), and lets the same command run if it is started again within five minutes: a server that
 * stopped so is stopped for good (its process group, none of its workers left) and started once more. Any other stop, or a second one, fails the run
 * at once, naming the log, rather than shooting a dead server. The recommendation is in the log, for whoever runs the shots to pass on.
 */
export async function serveThroughNudge<Child>(parts: ServerParts<Child>): Promise<Child> {
  const first = parts.start();
  await parts.ready();
  if (!(await parts.stoppedWithin(first, NUDGE_MS))) return first;
  if (!parts.log().includes(NUDGE)) throw new Error(`the web's server stopped: see ${parts.logFile}`);
  parts.stop(first);
  parts.tell(`the web's server stopped to recommend an upgrade of Next.js (${parts.logFile}); started again`);
  const second = parts.start();
  await parts.ready();
  if (await parts.stoppedWithin(second, NUDGE_MS)) throw new Error(`the web's server stopped again: see ${parts.logFile}`);
  return second;
}

/** Stops a server's process group: one gone already is no error. */
function stopGroup(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

/**
 * Runs `shoot` while `server` serves: a server that stops before the shots are done fails them at once, naming its log, rather than leaving them to
 * fail later on a page that never comes. Whatever `shoot` ends with, nothing is left listening to the server.
 */
export async function whileServing<T>(server: Pick<ChildProcess, 'once' | 'off'>, logFile: string, shoot: () => Promise<T>): Promise<T> {
  let stopped: (error: Error) => void = () => undefined;
  const died = new Promise<never>((_, reject) => (stopped = reject));
  // Raced below; a stop after the shots (the server stopped by whoever started it) is nobody's error.
  died.catch(() => undefined);
  const onExit = () => stopped(new Error(`the web's server stopped during the shots: see ${logFile}`));
  server.once('exit', onExit);
  try {
    return await Promise.race([shoot(), died]);
  } finally {
    server.off('exit', onExit);
  }
}

/** Stops a server after the shots, saying so where it could not, without hiding the error the shots ended with. */
export function stopAfter(child: ChildProcess, stop: (child: ChildProcess) => void = stopGroup, say: (line: string) => void = console.error): void {
  try {
    stop(child);
  } catch (error) {
    say(`the web's server (${child.pid}) could not be stopped: ${String(error)}`);
  }
}

/** The Chrome already on this machine, as the web's e2e tests use: nothing is downloaded. */
async function launchChrome(): Promise<Browser> {
  const { chromium } = fromWeb('@playwright/test') as { chromium: Chromium };
  return chromium.launch({ channel: 'chrome' });
}

/**
 * A page of Chrome shaped like the iPhone (its size, its scale, its touch, its safe areas, so `env(safe-area-inset-*)` is what it is on the
 * iPhone), in a context kept from every host but this machine (`guardedContext`): each host it was kept from is added to `kept`.
 */
async function phonePage(browser: Browser, kept: Set<string>): Promise<Page> {
  const context = await guardedContext(
    browser,
    { viewport: { width: SCREEN.width, height: SCREEN.height }, deviceScaleFactor: SCREEN.scale, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' },
    (url) => kept.add(new URL(url).host),
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: SCREEN.top, bottom: SCREEN.bottom, left: 0, right: 0 } });
  return page;
}

/** What the pages asked of hosts that are not this machine's, and was kept from them: nothing, with no project in the environment. */
const tellKept = (kept: ReadonlySet<string>): void => console.log(kept.size === 0 ? 'the browser asked nothing of any other host' : `the browser was kept from: ${[...kept].join(', ')}`);

/**
 * The app's web is not started by the shots: Metro serves it, in development (its `/scene` route is `__DEV__` only), from a terminal of its own,
 * and with no project in its environment. Nothing answering is a run that cannot be shot, and says how to start it.
 */
export function appWebAnswering(up: boolean, port: number): void {
  if (!up) throw new Error(`nothing answers on ${port}: start the app's web in apps/mobile (EXPO_NO_METRO_LAZY=1 npx expo start --web --port ${port}, with no EXPO_PUBLIC_SUPABASE_*)`);
}

/**
 * Runs `shoot` with a page of Chrome shaped like the iPhone's (`phonePage`, the web's own), in front of the app's web served on `APP_WEB_PORT`.
 * The browser is kept from every host but this machine, whatever the page asks for.
 */
export async function withAppWebPage(shoot: (page: Page) => Promise<void>): Promise<void> {
  const up = await fetch(`http://localhost:${APP_WEB_PORT}/`).then(() => true, () => false);
  appWebAnswering(up, APP_WEB_PORT);
  const browser = await launchChrome();
  const kept = new Set<string>();
  try {
    await shoot(await phonePage(browser, kept));
  } finally {
    await browser.close();
    tellKept(kept);
  }
}

/** A box on the screen, in points. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Whether every pixel that differs between two shots of a screen (RGBA, `width` pixels wide, at `scale`) lies inside one of `boxes`: a screen whose
 * only motion is its loops turning (a few frames played over and over, as the Next web's Loop plays them too) stands still but for them, and its
 * shot is one moment of them, as the web's shot is. Nothing changed is still too.
 */
export function changedWithin(a: Uint8Array, b: Uint8Array, width: number, boxes: readonly Box[], scale: number): boolean {
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
    const x = ((i / 4) % width) / scale;
    const y = Math.floor(i / 4 / width) / scale;
    if (!boxes.some((box) => x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h)) return false;
  }
  return true;
}

/** The box round every pixel that differs between two shots of a screen (RGBA, `width` pixels wide, at `scale`), in points: where it moved. */
export function changedBox(a: Uint8Array, b: Uint8Array, width: number, scale: number): Box | null {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
    const x = (i / 4) % width;
    const y = Math.floor(i / 4 / width);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return x1 < 0 ? null : { x: x0 / scale, y: y0 / scale, w: (x1 - x0 + 1) / scale, h: (y1 - y0 + 1) / scale };
}

/** In the page: the boxes the app's loops turn in (`Loop`'s strip, `data-loop-strip`, moves under a box of one frame), in points. */
export const LOOP_BOXES = (): Box[] =>
  [...document.querySelectorAll('[data-loop-strip]')].map((strip) => {
    const box = (strip.parentElement ?? strip).getBoundingClientRect();
    return { x: box.left, y: box.top, w: box.width, h: box.height };
  });

/** In the page: waits for the frame after the next to be painted (a picture's `<img>` may paint a frame after the scene said it was ready). */
export const NEXT_FRAME = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/**
 * Runs `shoot` with a page of Chrome shaped like the iPhone's, in front of the web's own dev server, started here (on a
 * port that is not answering) and stopped after. `probe` is a page of the web that answers once the server is up. The
 * browser is kept from every host but this machine (`guardedContext`), whatever the page asks for.
 */
export async function withWebPage(probe: string, shoot: (page: Page) => Promise<void>): Promise<void> {
  // Anything that answers on the port, whatever the page and whatever the status, is in the way.
  const up = await fetch(`http://localhost:${PORT}/`).then(() => true, () => false);
  refuseServerInUse(up, PORT);
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/sprites.ts'], { cwd: web, stdio: 'inherit' });
  // No cloud: the pages have nothing to save, and a dev page must never write to the live project. (The browser is kept from it as well.)
  // What the server says goes to a file beside the raw shots (`web-server.log`): a server that stops on its own says why there.
  mkdirSync(raw, { recursive: true });
  const logFile = join(raw, 'web-server.log');
  // Each run's log starts empty; a server started again within the run adds to it, so the first one's words (the recommendation) are kept.
  closeSync(openSync(logFile, 'w'));
  const start = (): ChildProcess => {
    const log = openSync(logFile, 'a');
    try {
      return spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], {
        cwd: web,
        stdio: ['ignore', log, log],
        detached: true,
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
      });
    } finally {
      // The child has its own copy of the file: the parent's is not needed once it is started.
      closeSync(log);
    }
  };
  let server: ChildProcess | null = null;
  try {
    server = await serveThroughNudge({
      start: () => (server = start()),
      ready: () => waitFor(probe, 180_000),
      stoppedWithin,
      log: () => readFileSync(logFile, 'utf8'),
      stop: stopGroup,
      logFile,
      tell: (line) => console.error(line),
    });
    const browser = await launchChrome();
    const kept = new Set<string>();
    try {
      const page = await phonePage(browser, kept);
      await whileServing(server, logFile, () => shoot(page));
    } finally {
      await browser.close();
      tellKept(kept);
    }
  } finally {
    // A server that is gone already (it stopped on its own) is not an error to hide the one the shots met behind.
    const last = server as ChildProcess | null;
    if (last !== null) {
      if (last.exitCode !== null || last.signalCode !== null) console.error(`the web's server (${last.pid}) had stopped before the shots were done`);
      stopAfter(last);
    }
  }
}

/**
 * The keyboard's focus ring, which a sheet opened with no tap before it takes (`:focus-visible`: the Next web's sheet, and the app's web's, whose
 * modal is focused as it opens) and a player's tap never shows: left out of every shot of either web.
 */
export const QUIET_FOCUS = ':focus-visible { outline: none !important; }';

/**
 * Opens a page and waits for it to be still: its fonts and pictures in, every rise over (0.28 s), and the dev overlay's
 * badge gone. A sheet opened with no tap before it takes the keyboard's focus ring (`:focus-visible`), which a player's tap
 * never shows and the phone has no use for. `ready` is what the page shows once it is drawn, where it is drawn later; `css`
 * is any rule the page is given besides.
 */
export async function openPage(page: Page, url: string, ready?: () => boolean, css = ''): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (ready) await page.waitForFunction(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.addStyleTag({ content: `nextjs-portal { display: none !important; } ${QUIET_FOCUS} ${css}` });
  await sleep(800);
}

/**
 * How long a screen is given, once opened, for its sprites to load (Skia reads each as it is asked) before it is shot: 4 s was not always enough (once in a full run of the
 * scenes the front door's gear, a 5000-pixel sprite, was not there yet, and the scene failed for it); 6 s was, until the machine was shared with other work (in two full
 * runs at a load average of 40 to 170, a gear, a lock, a city's icon and the practice's icon were missing, each there when its scene was shot again alone). 9 s, and then
 * the shot waits for the screen to be still (`stillShot`): at a load average of 150 to 250, 9 s alone once left out a lock and a coin. Still was not
 * enough either (at 15 to 35: a portrait, a lock, a coin's icon, a list's disc, two shots alike while the pictures were still being read), so a scene
 * now also says when it is ready (`readyServer`), and its shot waits for that first.
 */
export const SPRITES_MS = 9000;

/** How far apart two shots of the app's screen are taken to tell whether it is still. */
export const STILL_MS = 1500;
/**
 * How many shots in a row must be alike for a screen to be still: three, 1.5 s apart, so it stood still for 3 s (two, 1.5 s, once kept a screen whose
 * picture was read but not yet painted, at a load average of 70).
 */
export const STILL_ALIKE = 3;
/** How many shots after the first are taken at most, waiting for them to be alike: a screen that keeps moving (a loop) is shot as it is at the last, and the run says so. */
export const STILL_SHOTS = 6;

/**
 * How many shots after the first the app's web is given to stand still: twice the phone's. Chrome now and then rasters a picture drawn pixel for
 * pixel at a scale that is not whole (the week's challenge's banner, 288 art pixels in 378 points) on other device pixels for one shot, with nothing
 * of the page changed (no mutation, no animation): one shot in three of a page standing still, which six tries did not always outlast.
 */
export const APP_WEB_STILL_SHOTS = 2 * STILL_SHOTS;

/**
 * Shoots a screen until `STILL_ALIKE` shots in a row are the same, and keeps the last: a picture that came late is in the shot, as it would be had the
 * screen been given longer. Nothing is judged more loosely for it: the shot kept is the screen as it stands still.
 */
export async function stillShot(
  shoot: () => Buffer | Promise<Buffer>,
  { wait = sleep, ready = () => true, shots = STILL_SHOTS }: { wait?: (ms: number) => Promise<unknown>; ready?: () => boolean; shots?: number } = {},
): Promise<{ png: Buffer; still: boolean }> {
  // A shot taken while the scene says it is not ready counts for nothing: the count of shots alike starts again after it.
  // (A browser's shot is answered later, the simulator's at once: both are waited for.)
  let last = await shoot();
  let alike = ready() ? 1 : 0;
  for (let i = 0; i < shots; i++) {
    await wait(STILL_MS);
    const next = await shoot();
    alike = !ready() ? 0 : next.equals(last) && alike > 0 ? alike + 1 : 1;
    last = next;
    if (alike >= STILL_ALIKE) return { png: last, still: true };
  }
  return { png: last, still: false };
}

/** Where the driver hears a scene of the app say it is ready to be shot (`readyServer`): a port of this machine, which the simulator shares. */
export const READY_PORT = 8093;
/** How long a scene is given to say it is ready: its store built, its steps taken, its screen drawn and every picture of it read. */
export const READY_MS = 60_000;

/** A route as it is opened for a shot that waits on its scene's word: told where to say it. */
export const routeTold = (route: string, port: number): string => `${route}&ready=${port}`;

/**
 * A server of the driver's, on this machine only, that the app's scene route tells whether its scene is ready to be shot
 * (`GET /ready?name=<scene>&ready=<1|0>&n=<count>`: drawn, and no picture of it still being read; numbered, so word that arrives late is not
 * taken for the latest). Until it is, shots alike are a screen waiting (on a busy machine a picture read from Metro could take longer than
 * the 9 s, and shots 1.5 s apart were alike without it), not one standing still. A run shoots each scene once, so what a scene said is its own
 * (the first route, opened twice after a fresh start, says it again only if it is drawn again). `wait` gives whether it said it was ready
 * within `ms`; `ready` whether that is its latest word.
 */
export async function readyServer(port: number): Promise<{ port: number; wait(name: string, ms: number): Promise<boolean>; ready(name: string): boolean; close(): Promise<void> }> {
  const said = new Map<string, { ready: boolean; n: number }>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const name = url.searchParams.get('name');
    const n = Number(url.searchParams.get('n'));
    if (url.pathname !== '/ready' || name === null || !Number.isInteger(n)) {
      response.writeHead(404).end();
      return;
    }
    const known = said.get(name);
    if (known === undefined || n > known.n) said.set(name, { ready: url.searchParams.get('ready') === '1', n });
    // The app's web is another origin than this server's: leave to read the answer keeps an error for each word out of its console.
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }).end('ok');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const ready = (name: string) => said.get(name)?.ready === true;
  return {
    port: typeof address === 'object' && address !== null ? address.port : port,
    wait: async (name, ms) => {
      const end = Date.now() + ms;
      while (!ready(name)) {
        if (Date.now() >= end) return false;
        await sleep(100);
      }
      return true;
    },
    ready,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Runs `xcrun simctl …`, and again, a second later, where it fails, up to `tries` times in all: a busy simulator now and then refuses one
 * screenshot or one URL (exit status 148, no word why: twice in batch pass 1's runs, each time throwing away a run of half an hour). A simulator
 * that is not there fails every try, and the last failure is thrown.
 */
export function simctl(
  args: readonly string[],
  {
    exec = (said: readonly string[]): void => void execFileSync('xcrun', ['simctl', ...said], { stdio: 'ignore' }),
    pause = (): void => void spawnSync('sleep', ['1']),
    tries = 3,
  }: { exec?: (said: readonly string[]) => void; pause?: () => void; tries?: number } = {},
): void {
  for (let attempt = 1; ; attempt++) {
    try {
      exec(args);
      return;
    } catch (error) {
      if (attempt >= tries) throw error;
      pause();
    }
  }
}

/**
 * Shoots the app: each route opened in Expo Go on the booted simulator, then its screen taken once it is still (`stillShot`). A shot that names
 * its scene (`name`) first waits for the scene to say it is ready (`readyServer`); one that does not (the kit's sections) is shot as before.
 * The status bar is the same in every shot (it is masked in the comparison anyway). `fresh` first closes Expo Go and opens the first route
 * once to let it load the bundle: an Expo Go left running keeps the bundle of the Metro it saw last, stale when the code
 * changed since, and shows it until it is opened again. Gives back the routes whose screen never stood still, or whose scene never said it was ready.
 */
export async function shootApp(shots: ReadonlyArray<{ route: string; png: string; name?: string }>, options: { fresh?: boolean } = {}): Promise<string[]> {
  simctl(['status_bar', 'booted', 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100']);
  const told = shots.some((shot) => shot.name !== undefined) ? await readyServer(READY_PORT) : null;
  const open = (route: string) => simctl(['openurl', 'booted', `${METRO}/--/${told ? routeTold(route, told.port) : route}`]);
  // The routes whose screen never stood still: given back for the run's result, and named again at the end.
  const moving: string[] = [];
  try {
    if (options.fresh && shots.length > 0) {
      try {
        execFileSync('xcrun', ['simctl', 'terminate', 'booted', 'host.exp.Exponent'], { stdio: 'ignore' });
      } catch {
        // It was not running.
      }
      open(shots[0].route);
      await sleep(10_000);
    }
    for (const { route, png, name } of shots) {
      open(route);
      // Long enough for the screen's sprites to load (Skia reads them as they are asked), and for its scene to say it is ready.
      await sleep(SPRITES_MS);
      if (told && name !== undefined && !(await told.wait(name, READY_MS))) {
        console.log(`app ${route} (never said it was ready in ${READY_MS / 1000} s)`);
        moving.push(route);
        simctl(['io', 'booted', 'screenshot', png]);
        continue;
      }
      // Each shot is written where the last is kept: the one left there is the screen as it stood still, its scene ready all the while.
      const { still } = await stillShot(
        () => {
          simctl(['io', 'booted', 'screenshot', png]);
          return readFileSync(png);
        },
        { ready: () => told === null || name === undefined || told.ready(name) },
      );
      console.log(`app ${route}${still ? '' : ` (still moving after ${STILL_SHOTS + 1} shots: the last is kept)`}`);
      if (!still) moving.push(route);
    }
  } finally {
    await told?.close();
  }
  if (moving.length > 0) console.error(`never still: ${moving.join(', ')}`);
  return moving;
}
