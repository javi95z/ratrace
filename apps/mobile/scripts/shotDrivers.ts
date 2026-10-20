import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { SCREEN } from './kitCompare';

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
  evaluate<T>(fn: () => T): Promise<T>;
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

/** In the page: every line of visible text, as client rects in CSS pixels, with the colour its glyphs are drawn in. */
export const TEXT_BOXES = () => {
  const boxes: Array<{ x: number; y: number; w: number; h: number; text: string; color: [number, number, number]; opacity: number; back?: [number, number, number]; covered: boolean }> = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    const el = node.parentElement;
    if (!text || !el || el.closest('script, style, nextjs-portal')) continue;
    const color = (getComputedStyle(el).color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number) as [number, number, number];
    let opacity = 1;
    for (let up: Element | null = el; up; up = up.parentElement) opacity *= Number(getComputedStyle(up).opacity);
    let back: [number, number, number] | undefined;
    for (let up: Element | null = el; up && !back; up = up.parentElement) {
      const bg = getComputedStyle(up).backgroundColor.match(/[\d.]+/g)?.map(Number);
      if (bg && (bg.length === 3 || bg[3] > 0)) back = [bg[0], bg[1], bg[2]];
    }
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width <= 0 || r.height <= 0) continue;
      // Under a sheet's backdrop the topmost thing at the line's middle is not the line's own.
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const covered = top !== null && !el.contains(top) && !top.contains(el);
      boxes.push({ x: r.left, y: r.top, w: r.width, h: r.height, text: text.slice(0, 40), color, opacity, back, covered });
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
  const server: ChildProcess = spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], {
    cwd: web,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
  });
  try {
    await waitFor(probe, 180_000);
    const { chromium } = fromWeb('@playwright/test') as { chromium: Chromium };
    // The Chrome already on this machine, as the web's e2e tests use: nothing is downloaded.
    const browser = await chromium.launch({ channel: 'chrome' });
    const kept = new Set<string>();
    try {
      const context = await guardedContext(
        browser,
        { viewport: { width: SCREEN.width, height: SCREEN.height }, deviceScaleFactor: SCREEN.scale, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' },
        (url) => kept.add(new URL(url).host),
      );
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      // The phone's safe areas, so `env(safe-area-inset-*)` is what it is on the iPhone.
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: SCREEN.top, bottom: SCREEN.bottom, left: 0, right: 0 } });
      await shoot(page);
    } finally {
      await browser.close();
      // What the pages asked of hosts that are not this machine's, and was kept from them: nothing, with no project in the environment.
      console.log(kept.size === 0 ? 'the browser asked nothing of any other host' : `the browser was kept from: ${[...kept].join(', ')}`);
    }
  } finally {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
  }
}

/**
 * Opens a page and waits for it to be still: its fonts and pictures in, every rise over (0.28 s), and the dev overlay's
 * badge gone. A sheet opened with no tap before it takes the keyboard's focus ring (`:focus-visible`), which a player's tap
 * never shows and the phone has no use for. `ready` is what the page shows once it is drawn, where it is drawn later.
 */
export async function openPage(page: Page, url: string, ready?: () => boolean): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (ready) await page.waitForFunction(ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; } :focus-visible { outline: none !important; }' });
  await sleep(800);
}

/**
 * Shoots the app: each route opened in Expo Go on the booted simulator, then its screen taken. The status bar is the
 * same in every shot (it is masked in the comparison anyway). `fresh` first closes Expo Go and opens the first route
 * once to let it load the bundle: an Expo Go left running keeps the bundle of the Metro it saw last, stale when the code
 * changed since, and shows it until it is opened again.
 */
export async function shootApp(shots: ReadonlyArray<{ route: string; png: string }>, options: { fresh?: boolean } = {}): Promise<void> {
  execFileSync('xcrun', ['simctl', 'status_bar', 'booted', 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100']);
  const open = (route: string) => execFileSync('xcrun', ['simctl', 'openurl', 'booted', `${METRO}/--/${route}`]);
  if (options.fresh && shots.length > 0) {
    try {
      execFileSync('xcrun', ['simctl', 'terminate', 'booted', 'host.exp.Exponent'], { stdio: 'ignore' });
    } catch {
      // It was not running.
    }
    open(shots[0].route);
    await sleep(10_000);
  }
  for (const { route, png } of shots) {
    open(route);
    // Long enough for the screen's sprites to load (Skia reads them as they are asked).
    await sleep(4000);
    execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', png], { stdio: 'ignore' });
    console.log(`app ${route}`);
  }
}
