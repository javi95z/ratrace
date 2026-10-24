import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MESSAGES } from '@ratrace/i18n';
import { APP_WEB, APP_WEB_PORT } from './sceneShots';
import { writeServiceWorker } from './serviceWorker';
import type { Browser, Page } from './shotDrivers';
import { guardedContext, launchChrome, raw, refuseServerInUse, root } from './shotDrivers';
import { writeSitePieces } from './sitePieces';
import { serveExport } from './webLife';
import { exportEnv } from './webSize';

/**
 * The app's web offline after one visit (phase 5b, Task 4): the export the site will serve, made here with no project in its environment, its
 * site's pieces and its worker written into it as the build writes them, served on 8091 as the host serves it (`serveExport`: the worker with
 * its headers), and opened in Chrome with the site's worker let run (`guardedContext(..., 'allow')`; every host but this machine still kept off).
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/web-offline.ts
 *
 * 1. Online, one visit to /es: the worker installs (every page in every language and every file precached) and takes the page.
 * 2. Online, /es/records opened: a navigation through the worker, which keeps Spanish as the language last played.
 * 3. Offline: `/` is the cached /es, drawn and taken over by the app; /es/rankings (never opened) and /es/records (opened) come from the cache;
 *    an address the site has no page for is /offline.html; an invitation's address (`?code=`) is never answered from the cache.
 *
 * Each step is said as it is taken, its picture in docs/superpowers/reports/phase-5a-web-parity/offline-<n>-<what>.png, the steps in
 * apps/mobile/.kit-shots/web-offline-steps.txt.
 */

/** What is used of a Playwright response. */
interface Answer {
  status(): number;
  fromServiceWorker(): boolean;
}

/** What is used of a Playwright page, beyond the drivers' own. */
interface OfflinePage extends Page {
  goto(url: string, options: object): Promise<Answer | null>;
  evaluate<T>(fn: () => T): Promise<Awaited<T>>;
  evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<Awaited<T>>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  waitForFunction<A>(fn: (arg: A) => boolean, arg: A, options?: { timeout?: number }): Promise<unknown>;
  title(): Promise<string>;
  url(): string;
  on(event: 'pageerror', listener: (error: Error) => void): void;
  on(event: 'requestfailed', listener: (request: { url(): string; isNavigationRequest(): boolean }) => void): void;
  context(): { setOffline(offline: boolean): Promise<void>; close(): Promise<void> };
}

const out = join(root, 'docs/superpowers/reports', APP_WEB.folder);
const at = (path: string) => `http://localhost:${APP_WEB_PORT}${path}`;
const steps: string[] = [];
let shotNumber = 0;

/** Says a step, and keeps its picture where there is one to keep. */
async function step(page: OfflinePage, what: string, file?: string): Promise<void> {
  let line = what;
  if (file !== undefined) {
    shotNumber += 1;
    const png = join(out, `offline-${shotNumber}-${file}.png`);
    await page.screenshot({ path: png });
    line = `${what} (${png.slice(root.length + 1)})`;
  }
  steps.push(line);
  console.log(line);
}

/** The words a drawn front door shows in Spanish, whichever of its states it is in: the name of a new life. */
const SPANISH = MESSAGES.es.home.newLife;

/** Waits for the page to be the game's, in `language`, drawn and with `words` on it. */
async function drawn(page: OfflinePage, language: string, words: string): Promise<void> {
  await page.waitForFunction(([lang, text]) => document.documentElement.lang === lang && (document.body.textContent ?? '').includes(text), [language, words] as const, { timeout: 60_000 });
}

/** A navigation answered by the worker (not the network, which is off), with its status. */
function fromWorker(answer: Answer | null, address: string): string {
  if (answer === null) throw new Error(`${address}: no answer`);
  if (!answer.fromServiceWorker()) throw new Error(`${address}: answered by the network, not the worker`);
  return `${answer.status()}, from the worker`;
}

/** The export, made into a folder of its own with no project in its environment, with the site's pieces and the worker written into it. */
async function madeExport(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-web-offline-'));
  console.log(`exporting the app's web into ${dir} (no EXPO_PUBLIC_SUPABASE_*)`);
  const made = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dir], {
    cwd: join(root, 'apps/mobile'),
    env: exportEnv(process.env) as NodeJS.ProcessEnv,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (made.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`the web export failed (exit ${made.status ?? made.signal}):\n${`${made.stdout}\n${made.stderr}`.trim().split('\n').slice(-20).join('\n')}`);
  }
  await writeSitePieces(dir);
  const { assets, version } = writeServiceWorker(dir);
  steps.push(`the export, its site's pieces and its worker: ${assets.length} files precached, cache ratrace-${version}`);
  console.log(steps.at(-1));
  return dir;
}

async function main() {
  const up = await fetch(at('/')).then(() => true, () => false);
  refuseServerInUse(up, APP_WEB_PORT);
  mkdirSync(out, { recursive: true });
  const dir = await madeExport();
  let server: Server | null = null;
  let browser: Browser | null = null;
  const kept = new Set<string>();
  const problems: string[] = [];
  try {
    server = await serveExport(dir, APP_WEB_PORT);
    browser = await launchChrome();
    const context = await guardedContext(browser, { viewport: { width: 393, height: 852 } }, (url) => kept.add(new URL(url).host), 'allow');
    const page = (await context.newPage()) as unknown as OfflinePage;
    page.on('pageerror', (error) => problems.push(`${new URL(page.url()).pathname}: ${error.message}`));
    // Offline, every file a page asks for must come from the cache (a chunk missing, its language's words among them, and the page is not the
    // game's): only the invitation's address, left to the network on purpose, may fail.
    page.on('requestfailed', (request) => {
      if (!request.isNavigationRequest()) problems.push(`failed: ${new URL(request.url()).pathname}`);
    });

    // 1. One visit, online: the worker installs (its install waits for the precache) and takes the page.
    await page.goto(at('/es'), { waitUntil: 'load' });
    await drawn(page, 'es', SPANISH);
    const caches = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((done) => navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
      const names = await window.caches.keys();
      return Promise.all(names.map(async (name) => `${name} (${(await (await window.caches.open(name)).keys()).length})`));
    });
    await step(page, `1. online, /es: the worker installed and took the page; caches ${caches.join(', ')}`, 'online-es');

    // 2. A page opened online, through the worker: kept, and Spanish kept as the language last played.
    const records = await page.goto(at('/es/records'), { waitUntil: 'load' });
    await drawn(page, 'es', MESSAGES.es.records.empty);
    const language = await page.evaluate(async () => (await (await window.caches.match('/__language', { cacheName: 'rat-race-language' }))?.text()) ?? null);
    if (language !== 'es') throw new Error(`the worker kept ${language} as the language last played, not es`);
    await step(page, `2. online, /es/records: ${records?.fromServiceWorker() ? 'through the worker' : 'from the network'}; the language last played kept: ${language}`);

    // 3. Offline.
    await page.context().setOffline(true);
    const bare = await page.goto(at('/'), { waitUntil: 'load' });
    await drawn(page, 'es', SPANISH);
    await step(page, `3. offline, /: ${fromWorker(bare, '/')}, the cached /es drawn and taken over (lang es, "${SPANISH}" on it)`, 'offline-bare');

    const rankings = await page.goto(at('/es/rankings'), { waitUntil: 'load' });
    await drawn(page, 'es', MESSAGES.es.rankings.title);
    await step(page, `4. offline, /es/rankings (never opened): ${fromWorker(rankings, '/es/rankings')}, precached and drawn`, 'offline-rankings');

    const again = await page.goto(at('/es/records'), { waitUntil: 'load' });
    await drawn(page, 'es', MESSAGES.es.records.empty);
    await step(page, `5. offline, /es/records (opened before): ${fromWorker(again, '/es/records')}, drawn`);

    const nowhere = await page.goto(at('/en/nowhere'), { waitUntil: 'load' });
    const title = await page.title();
    if (title !== 'The Rat Race · Offline') throw new Error(`offline, /en/nowhere is "${title}", not the offline page`);
    await step(page, `6. offline, /en/nowhere (no page of the site's): ${fromWorker(nowhere, '/en/nowhere')}, /offline.html ("${title}")`, 'offline-page');

    const invited = await page.goto(at('/es/room?code=ABC123'), { waitUntil: 'load' }).then(
      () => 'answered',
      (error: Error) => error.message.split('\n')[0],
    );
    if (invited === 'answered') throw new Error('offline, an invitation (/es/room?code=ABC123) was answered: an address with a query must never come from the cache');
    await step(page, `7. offline, /es/room?code=ABC123: left to the network, which is off (${invited})`);
    await page.context().close();
  } finally {
    await browser?.close();
    if (server !== null) await new Promise((done) => server?.close(done));
    rmSync(dir, { recursive: true, force: true });
  }
  steps.push(kept.size === 0 ? 'the browser asked nothing of any other host' : `the browser was kept from: ${[...kept].join(', ')}`);
  console.log(steps.at(-1));
  mkdirSync(raw, { recursive: true });
  writeFileSync(join(raw, 'web-offline-steps.txt'), `${steps.join('\n')}\n`);
  if (problems.length > 0) {
    console.error(`the pages said:\n${problems.join('\n')}`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
