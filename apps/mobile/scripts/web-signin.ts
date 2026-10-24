import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MESSAGES } from '@ratrace/i18n';
import { PAGES } from '../src/game/pageList';
import { FAKE_CLOUD_PORT, fakeCloud } from './fakeCloud';
import { APP_WEB, APP_WEB_PORT } from './sceneShots';
import type { Browser, Page } from './shotDrivers';
import { guardedContext, launchChrome, raw, refuseServerInUse, root } from './shotDrivers';
import { buildSite } from './webBuild';
import { fakeEnv, serveExport } from './webLife';

/*
 * The site online, on the fake project of this machine (phase 5b, Task 9): never the live one. The site built as Vercel builds it (`buildSite`) with
 * the fake project's address and key given to the build explicitly (`fakeEnv`), served on 8091 as Vercel serves it (`serveExport`), the fake project
 * (`scripts/fakeCloud.ts`) on 127.0.0.1:54399, and Chrome kept from every other host.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/web-signin.ts
 *
 * 1. Every page in English, a few in the other languages, at a phone's width and a desk's: each drawn from its HTML and taken over by the app with
 *    nothing said (no hydration error, React's #418, #423 or #425, nor any other), and the guest made on the fake project.
 * 2. Google, as a player keeps the guest with it: the front door's "Sign in with Google", the fake project's Google page, a new Google account; the
 *    browser comes back to /en?code=… through the site (its middleware, its rewrite) and the router; the code exchanged, the account kept ("Linked to
 *    Google" on the front door, a member on the fake project) and the address cleaned (no `code` left in it).
 *
 * Each step is said as it is taken, its picture in docs/superpowers/reports/phase-5a-web-parity/signin-<n>-<what>.png, the steps in
 * apps/mobile/.kit-shots/web-signin-steps.txt.
 */

/** What is used of a Playwright page, beyond the drivers' own. */
interface SigninPage extends Page {
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): { click(): Promise<void>; first(): { waitFor(options: { timeout?: number }): Promise<void> } };
  getByText(text: string | RegExp, options?: { exact?: boolean }): { first(): { waitFor(options: { timeout?: number }): Promise<void> } };
  url(): string;
  waitForURL(url: (url: URL) => boolean, options?: { timeout?: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  waitForFunction<A>(fn: (arg: A) => boolean, arg: A, options?: { timeout?: number }): Promise<unknown>;
  on(event: 'pageerror', listener: (error: Error) => void): void;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  on(event: 'framenavigated', listener: (frame: { url(): string; parentFrame(): unknown }) => void): void;
  on(event: 'response', listener: (response: { url(): string; status(): number }) => void): void;
  context(): { close(): Promise<void> };
}

const en = MESSAGES.en;
const at = (path: string) => `http://localhost:${APP_WEB_PORT}${path}`;
const out = join(root, 'docs/superpowers/reports', APP_WEB.folder);
const steps: string[] = [];
let shotNumber = 0;

/** Says a step, and keeps its picture where there is one to keep. */
async function step(page: SigninPage, what: string, file?: string): Promise<void> {
  let line = what;
  if (file !== undefined) {
    shotNumber += 1;
    const png = join(out, `signin-${shotNumber}-${file}.png`);
    await page.screenshot({ path: png });
    line = `${what} (${png.slice(root.length + 1)})`;
  }
  steps.push(line);
  console.log(line);
}

/** The pages opened to see each taken over: every page in English (the room with an invitation's code), and a few in the other languages. */
const PAGES_SEEN: readonly { path: string; lang: 'en' | 'es' | 'ru'; page: string }[] = [
  ...PAGES.map((page) => ({ path: `/en${page === '' ? '' : `/${page}`}${page === 'room' ? '?code=ABC123' : ''}`, lang: 'en' as const, page })),
  { path: '/es', lang: 'es', page: '' },
  { path: '/es/play', lang: 'es', page: 'play' },
  { path: '/ru/rankings', lang: 'ru', page: 'rankings' },
];

/** A page's title in its language, as its head says it (the Next web's metadata). */
const titleOf = (lang: 'en' | 'es' | 'ru', page: string): string => {
  const meta = MESSAGES[lang].meta as { title: string; titles: Record<string, string> };
  return page === '' ? meta.title : `${meta.titles[page]} · ${meta.title}`;
};

/** What a page that hydrates badly says: React's minified errors of a server's HTML that is not what the browser draws. */
const HYDRATION = /#418|#423|#425|[Hh]ydrat/;

async function main() {
  for (const port of [APP_WEB_PORT, FAKE_CLOUD_PORT]) refuseServerInUse(await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false), port);
  mkdirSync(out, { recursive: true });
  const cloud = fakeCloud();
  await cloud.listen(FAKE_CLOUD_PORT);
  const dir = mkdtempSync(join(tmpdir(), 'ratrace-web-signin-'));
  let server: Server | null = null;
  let browser: Browser | null = null;
  const kept = new Set<string>();
  const problems: string[] = [];
  try {
    console.log(`building the site into ${dir} on the fake project (http://127.0.0.1:${FAKE_CLOUD_PORT})`);
    const built = await buildSite(dir, fakeEnv(process.env));
    if (built.problems.length > 0) throw new Error(`the site's build failed:\n${built.problems.join('\n')}`);
    steps.push(`the site built on the fake project (EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:${FAKE_CLOUD_PORT}, its key), served on ${APP_WEB_PORT} as Vercel serves it`);
    console.log(steps.at(-1));
    server = await serveExport(dir, APP_WEB_PORT);
    browser = await launchChrome();

    // 1. Every page drawn from its HTML and taken over with nothing said, at a phone's width and a desk's.
    for (const viewport of [{ width: 393, height: 852 }, { width: 1280, height: 800 }]) {
      const context = await guardedContext(browser, { viewport }, (url) => kept.add(new URL(url).host));
      const page = (await context.newPage()) as unknown as SigninPage;
      const said: string[] = [];
      page.on('pageerror', (error) => said.push(`${new URL(page.url()).pathname}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') said.push(`${new URL(page.url()).pathname}: console: ${message.text()}`);
      });
      for (const { path, lang, page: name } of PAGES_SEEN) {
        await page.goto(at(path), { waitUntil: 'load' });
        await page.waitForFunction(([language, title]) => document.documentElement.lang === language && document.title === title, [lang, titleOf(lang, name)] as const, { timeout: 60_000 });
        // A moment more: what the app draws again once it has the browser (the desk's columns, the account) comes after the first draw.
        await page.waitForTimeout(1200);
      }
      const hydration = said.filter((line) => HYDRATION.test(line));
      problems.push(...said);
      await step(page, `1. ${viewport.width} by ${viewport.height}: ${PAGES_SEEN.length} pages drawn from their HTML and taken over, ${hydration.length === 0 ? 'no hydration error' : `${hydration.length} hydration errors`}, ${said.length} errors said in all`, `pages-${viewport.width}`);
      await page.context().close();
    }
    if (cloud.counts.guests === 0) problems.push('no guest was made on the fake project: the site did not reach it');
    steps.push(`   the fake project made ${cloud.counts.guests} guests, one for each fresh browser's first visit`);
    console.log(steps.at(-1));

    // 2. Google: the guest kept with it, through the site and the router.
    const context = await guardedContext(browser, { viewport: { width: 393, height: 852 } }, (url) => kept.add(new URL(url).host));
    const page = (await context.newPage()) as unknown as SigninPage;
    const said: string[] = [];
    page.on('pageerror', (error) => said.push(`${new URL(page.url()).pathname}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') said.push(`${new URL(page.url()).pathname}: console: ${message.text()}`);
    });
    const landed: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame.parentFrame() === null) landed.push(frame.url());
    });
    const answered: string[] = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.port === String(APP_WEB_PORT) && url.searchParams.has('code')) answered.push(`${response.status()} ${url.pathname}`);
    });
    await page.goto(at('/'), { waitUntil: 'load' });
    await page.getByRole('button', { name: en.account.keep }).first().waitFor({ timeout: 60_000 });
    await step(page, `2. /, led to ${new URL(page.url()).pathname} by the site: the guest's front door offers "${en.account.keep}"`, 'guest');
    await page.getByRole('button', { name: en.account.keep }).click();
    await page.waitForURL((url) => url.port === String(FAKE_CLOUD_PORT) && url.pathname === '/fake-google', { timeout: 60_000 });
    await step(page, '3. the fake project\'s Google page (127.0.0.1, not Google)', 'google');
    await page.getByRole('link', { name: 'Continue as a new Google account' }).click();
    await page.waitForURL((url) => url.port === String(APP_WEB_PORT) && url.pathname === '/en' && !url.searchParams.has('code'), { timeout: 60_000 });
    await page.getByText(en.account.member).first().waitFor({ timeout: 60_000 });
    const back = landed.find((url) => new URL(url).port === String(APP_WEB_PORT) && new URL(url).searchParams.has('code'));
    if (back === undefined) problems.push(`the browser never came back to the site with a code: ${landed.join(' → ')}`);
    else if (new URL(back).pathname !== '/en') problems.push(`the browser came back to ${new URL(back).pathname}, not /en`);
    if (answered.join() !== '200 /en') problems.push(`the site answered the way back from Google with ${answered.join(', ') || 'nothing'}, not 200 /en`);
    const address = new URL(page.url());
    if (address.search !== '') problems.push(`the address keeps a query after the sign-in: ${address.search}`);
    const members = [...cloud.users.values()].filter((user) => !user.is_anonymous && user.email === 'new.member@example.com');
    if (members.length !== 1) problems.push(`the fake project has ${members.length} new members, not 1`);
    await step(page, `4. back at ${back === undefined ? '?' : `${new URL(back).pathname}?code=…`} (${answered.join(', ')}), through the site and the router: "${en.account.member}", the guest kept (${members.length} member on the fake project), the address cleaned to ${address.pathname}${address.search}`, 'kept');
    problems.push(...said);
    if (said.some((line) => HYDRATION.test(line))) problems.push('the way back from Google hydrated badly');
    await page.context().close();
  } finally {
    await browser?.close();
    if (server !== null) await new Promise((done) => server?.close(done));
    await cloud.close();
    rmSync(dir, { recursive: true, force: true });
  }
  steps.push(kept.size === 0 ? 'the browser asked nothing of any other host' : `the browser was kept from: ${[...kept].join(', ')}`);
  console.log(steps.at(-1));
  mkdirSync(raw, { recursive: true });
  writeFileSync(join(raw, 'web-signin-steps.txt'), `${steps.join('\n')}\n`);
  if (problems.length > 0) {
    console.error(`the pages said:\n${problems.join('\n')}`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
