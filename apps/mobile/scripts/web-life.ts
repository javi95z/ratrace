import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { MESSAGES } from '@ratrace/i18n';
import { APP_WEB, APP_WEB_PORT } from './sceneShots';
import { onThisMachine, projectNamed } from './webLife';
import type { Page } from './shotDrivers';
import { PORT, raw, root, withWebPage } from './shotDrivers';

/**
 * A whole life in the browser, begun on the Next web and finished on the app's web (phase 5a, Task 9): the swap, where the same site is served by
 * the app's web build in place of the Next web's, and a life in progress must go on. Offline: the Next web is the shots' own `next dev` on 3021
 * (started and stopped here, with no project in its environment), the app's web the Metro already serving it on 8091 (`npx expo start --web
 * --port 8091` in apps/mobile, with no EXPO_PUBLIC_SUPABASE_*), and the browser is kept from every host but this machine.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/web-life.ts
 *
 * 1. On the Next web, a life begun (the nurse) and played to round 3.
 * 2. What the Next web keeps of it read from its origin: the `ratrace` IndexedDB's three stores, and the localStorage keys of the inventory.
 * 3. Two ports are two origins, where the swap keeps one: the same records written into the app's web's origin before its first load.
 * 4. On the app's web, Continue reaches the same round; the life played to its end; the end, and the records, show it.
 *
 * Each step's picture goes to docs/superpowers/reports/phase-5a-web-parity/life-<n>-<what>.png, and each step is said as it is taken.
 */

/** What is used of a Playwright locator: the web's, which this app does not depend on. */
interface Locator {
  click(): Promise<void>;
  isVisible(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  count(): Promise<number>;
  nth(index: number): Locator;
  first(): Locator;
  textContent(): Promise<string | null>;
  waitFor(options: { state?: 'visible' | 'attached'; timeout?: number }): Promise<void>;
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
}

/** What is used of a Playwright page, beyond the drivers' own. */
interface LifePage extends Page {
  getByRole(role: string, options?: { name?: string | RegExp; exact?: boolean }): Locator;
  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
  route(url: string, handler: (route: { fulfill(options: { status?: number; contentType: string; body: string }): Promise<void> }) => unknown): Promise<void>;
  url(): string;
  on(event: 'pageerror', listener: (error: Error) => void): void;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  on(event: 'request', listener: (request: { url(): string }) => void): void;
  evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<Awaited<T>>;
  evaluate<T>(fn: () => T): Promise<Awaited<T>>;
}

/** What the Next web keeps of a player in its origin: each IndexedDB store's records with their keys, and the localStorage keys of the inventory. */
interface Kept {
  stores: Record<string, Array<{ key: IDBValidKey; value: unknown }>>;
  local: Record<string, string>;
}

/** The localStorage keys the Next web keeps (docs/superpowers/reports/2026-10-23-phase-5-web-inventory.md). */
export const LOCAL_KEYS = ['ratrace.basket', 'ratrace:given-up', 'ratrace:refused', 'ratrace.lastAccount'] as const;

const en = MESSAGES.en;
/** The words pressed and looked for, the same on both sides (the same messages). */
const WORDS = {
  newLife: en.home.newLife,
  start: 'Start this life',
  continue: en.home.continue,
  toCards: en.news.toCards,
  nextCard: 'Next card',
  toFinance: en.cards.toFinance,
  play: 'Play the round',
  nextRound: 'Next round',
  finish: en.resolve.finish,
  theEnd: 'The end',
  happened: en.play.stages.outcome,
  choices: /^Your choices/,
  moments: [en.moments.escape.go, en.moments.million.go, en.moments.bankrupt.go, en.moments.crisis.go],
  close: en.common.close,
  round: (n: number) => new RegExp(`^(Round )?${n} of 20( ·|$)`),
};

/** The game ignores a tap for 400 ms after the screen changes (its tap guard): a script waits it out as a thumb would without noticing. */
const settle = () => sleep(430);

const out = join(root, 'docs/superpowers/reports', APP_WEB.folder);
let shotNumber = 0;
const steps: string[] = [];

/** Says a step, and keeps its picture. */
async function step(page: LifePage, what: string, file: string): Promise<void> {
  shotNumber += 1;
  const png = join(out, `life-${shotNumber}-${file}.png`);
  await settle();
  await page.screenshot({ path: png });
  const line = `${shotNumber}. ${what} (${png.slice(root.length + 1)})`;
  steps.push(line);
  console.log(line);
}

/** The first of these that is on the screen, or null. */
async function firstShown(candidates: readonly Locator[]): Promise<Locator | null> {
  for (const candidate of candidates) if (await candidate.first().isVisible()) return candidate.first();
  return null;
}

/** Which round the screen says it is, from its Hud (`n of 20`), or null. */
async function roundShown(page: LifePage): Promise<number | null> {
  for (let n = 20; n >= 1; n--) if (await page.getByText(WORDS.round(n)).first().isVisible()) return n;
  return null;
}

/**
 * Plays on from wherever the game stands, a press at a time (a moment's button, a sheet closed, the cards, each card's first open choice, the finances with no
 * orders, the round), until `done` says so. Gives up after `limit` presses with nothing to press.
 */
async function playUntil(page: LifePage, done: () => Promise<boolean>, limit = 2000): Promise<void> {
  try {
    await pressUntil(page, done, limit);
  } catch (error) {
    // Where it stood when nothing could be pressed: beside the raw shots, for whoever runs it to see.
    await page.screenshot({ path: join(raw, 'web-life-stuck.png') });
    throw error;
  }
}

async function pressUntil(page: LifePage, done: () => Promise<boolean>, limit: number): Promise<void> {
  let idle = 0;
  for (let presses = 0; presses < limit; presses++) {
    if (await done()) return;
    const choices = page.getByRole('group', { name: WORDS.choices }).getByRole('button');
    // A moment has the screen to itself until its own button is pressed; any other sheet over the game (a badge earned, a word of the guide's) is
    // closed as a player closes it.
    const moment = await firstShown(WORDS.moments.map((name) => page.getByRole('button', { name, exact: true })));
    const sheet = moment === null ? await firstShown([page.getByRole('dialog').getByRole('button', { name: WORDS.close, exact: true })]) : null;
    if (moment !== null || sheet !== null) {
      await (moment ?? (sheet as Locator)).click();
      idle = 0;
      await settle();
      continue;
    }
    const press = await firstShown([
      page.getByRole('button', { name: WORDS.toCards, exact: true }),
      page.getByRole('button', { name: WORDS.nextCard, exact: true }),
      page.getByRole('button', { name: WORDS.toFinance, exact: true }),
      page.getByRole('button', { name: WORDS.play, exact: true }),
      page.getByRole('button', { name: WORDS.nextRound, exact: true }),
      page.getByRole('button', { name: WORDS.finish, exact: true }),
    ]);
    if (press !== null) {
      await press.click();
      idle = 0;
      await settle();
      continue;
    }
    if ((await choices.count()) > 0 && (await choices.first().isVisible())) {
      let chosen = 0;
      const count = await choices.count();
      while (chosen < count - 1 && !(await choices.nth(chosen).isEnabled())) chosen += 1;
      await choices.nth(chosen).click();
      idle = 0;
      await settle();
      continue;
    }
    idle += 1;
    if (idle > 40) throw new Error(`nothing to press at ${page.url()}`);
    await sleep(250);
  }
  throw new Error(`still playing after ${limit} presses`);
}

/** In the page: everything the origin keeps of the player, read. */
const READ_KEPT = async (keys: readonly string[]): Promise<Kept> => {
  const db = await new Promise<IDBDatabase>((done, fail) => {
    const open = indexedDB.open('ratrace');
    open.onsuccess = () => done(open.result);
    open.onerror = () => fail(open.error);
  });
  const stores: Kept['stores'] = {};
  for (const name of [...db.objectStoreNames]) {
    stores[name] = await new Promise((done, fail) => {
      const records: Array<{ key: IDBValidKey; value: unknown }> = [];
      const cursor = db.transaction(name).objectStore(name).openCursor();
      cursor.onsuccess = () => {
        const at = cursor.result;
        if (at === null) done(records);
        else {
          records.push({ key: at.key, value: at.value });
          at.continue();
        }
      };
      cursor.onerror = () => fail(cursor.error);
    });
  }
  db.close();
  const local: Kept['local'] = {};
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) local[key] = value;
  }
  return { stores, local };
};

/**
 * In the page: the same records written into this origin, in the Next web's own shape (`apps/web/src/session/indexeddb.ts`: version 1, `currentGame`
 * and `profile` keyed out of line, `runs` by `runId`), and the same localStorage keys.
 */
const WRITE_KEPT = async (kept: Kept): Promise<number> => {
  const db = await new Promise<IDBDatabase>((done, fail) => {
    const open = indexedDB.open('ratrace', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('currentGame');
      open.result.createObjectStore('runs', { keyPath: 'runId' });
      open.result.createObjectStore('profile');
    };
    open.onsuccess = () => done(open.result);
    open.onerror = () => fail(open.error);
  });
  let written = 0;
  for (const [name, records] of Object.entries(kept.stores)) {
    await new Promise<void>((done, fail) => {
      const tx = db.transaction(name, 'readwrite');
      const store = tx.objectStore(name);
      for (const { key, value } of records) {
        if (store.keyPath === null) store.put(value, key);
        else store.put(value);
        written += 1;
      }
      tx.oncomplete = () => done();
      tx.onerror = () => fail(tx.error);
    });
  }
  db.close();
  for (const [key, value] of Object.entries(kept.local)) localStorage.setItem(key, value);
  return written;
};

async function main() {
  mkdirSync(out, { recursive: true });
  const problems: string[] = [];
  await withWebPage(`http://localhost:${PORT}/en`, async (shaped) => {
    const page = shaped as LifePage;
    // Everything either page complains of: a clean game says nothing (the Next web's e2e `watch`).
    page.on('pageerror', (error) => problems.push(`${new URL(page.url()).port}: ${error.message}`));
    // Every address either page asks for beyond this machine (the browser is kept from them all): the app's web must ask none, and neither page a
    // Supabase project.
    const asked: string[] = [];
    page.on('request', (request) => {
      if (!onThisMachine(request.url())) asked.push(`${new URL(page.url()).port}: ${new URL(request.url()).host}`);
    });
    page.on('console', (message) => {
      // (A request the shots' browser keeps off this machine fails, and says so: the Next web's analytics, va.vercel-scripts.com. Named at the end.)
      if (message.type() === 'error' && message.text() !== 'Failed to load resource: net::ERR_FAILED') problems.push(`${new URL(page.url()).port}: console: ${message.text()}`);
    });

    // 1. The Next web: a life begun and played to round 3.
    await page.goto(`http://localhost:${PORT}/en`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: WORDS.newLife }).click();
    await page.getByRole('radio', { name: /^Nurse/ }).click();
    await page.getByRole('button', { name: WORDS.start }).click();
    await page.getByRole('button', { name: WORDS.toCards }).waitFor({ state: 'visible', timeout: 60_000 });
    await step(page, 'Next web (3021): the nurse begun, round 1', 'next-round1');
    await playUntil(page, async () => (await roundShown(page)) === 3 && (await page.getByRole('button', { name: WORDS.toCards }).isVisible()));
    await step(page, 'Next web (3021): played to round 3, its news', 'next-round3');

    // 2. What it keeps of the player, read from its origin.
    const kept = await page.evaluate(READ_KEPT, [...LOCAL_KEYS]);
    const counts = Object.entries(kept.stores).map(([name, records]) => `${name} ${records.length}`).join(', ');
    writeFileSync(join(raw, 'web-life-kept.json'), JSON.stringify(kept, null, 2));
    steps.push(`   read from the 3021 origin: IndexedDB ${counts}; localStorage ${Object.keys(kept.local).join(', ') || 'none'}`);
    console.log(steps.at(-1));
    // The saved life: its id, and its round as the engine counts it (from 0: the player's third round is 2).
    const saved = kept.stores.currentGame?.[0]?.value as { gameId: string; seed: string; state: { round: number } } | undefined;
    if (saved === undefined) throw new Error('the Next web kept no life in progress');
    steps.push(`   the life in progress: ${saved.gameId}, round ${saved.state.round + 1}`);
    console.log(steps.at(-1));

    // 3. Written into the app's web's origin before its first load: a page of that origin that is not the app (answered here, never served).
    await page.route(`http://localhost:${APP_WEB_PORT}/seed`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
    await page.goto(`http://localhost:${APP_WEB_PORT}/seed`, { waitUntil: 'load' });
    const written = await page.evaluate(WRITE_KEPT, kept);
    steps.push(`   written into the 8091 origin before its first load: ${written} records, ${Object.keys(kept.local).length} localStorage keys`);
    console.log(steps.at(-1));

    // 4. The app's web: Continue reaches the same round, and the life is played to its end.
    await page.goto(`http://localhost:${APP_WEB_PORT}/`, { waitUntil: 'load' });
    // Offline: the page's environment, as Expo's development server gives it, names no project (it was started with no EXPO_PUBLIC_SUPABASE_*).
    const env = await page.evaluate(() => {
      const known = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
      return { EXPO_PUBLIC_SUPABASE_URL: known.EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: known.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, root: known.EXPO_PUBLIC_PROJECT_ROOT };
    });
    if (env.root === undefined) throw new Error("the app's web page has no environment of Expo's development server: it cannot be told offline");
    const named = projectNamed(env);
    if (named !== null) throw new Error(`the app's web was started with a project (${named}): start it with no EXPO_PUBLIC_SUPABASE_*`);
    steps.push("   the app's web is offline: its page's environment names no EXPO_PUBLIC_SUPABASE_*");
    console.log(steps.at(-1));
    const goOn = page.getByRole('link', { name: new RegExp(`^${WORDS.continue}`) });
    await goOn.waitFor({ state: 'visible', timeout: 120_000 });
    await step(page, 'app web (8091): the front door offers to continue the life', 'app-home');
    await goOn.click();
    await page.getByRole('button', { name: WORDS.toCards }).waitFor({ state: 'visible', timeout: 60_000 });
    const shown = await roundShown(page);
    if (shown !== 3) throw new Error(`the app's web continued at round ${shown}, not 3`);
    await step(page, 'app web (8091): Continue reaches round 3, its news', 'app-round3');
    await playUntil(page, async () => page.getByRole('heading', { name: WORDS.theEnd }).isVisible());
    await step(page, 'app web (8091): the life played to its end, the end screen', 'app-end');

    // The records show it.
    await page.goto(`http://localhost:${APP_WEB_PORT}/records`, { waitUntil: 'load' });
    // The past lives: the Next web's section of them, the app's list (a FlatList, named as the section is).
    const past = page.getByRole('list', { name: en.records.history }).getByRole('listitem');
    await past.first().waitFor({ state: 'visible', timeout: 60_000 });
    // (The list's items hold items of their own, a life's badges: the life is the first, and it is the nurse's.)
    const first = (await past.first().textContent()) ?? '';
    if (!first.includes('Nurse')) throw new Error(`the records' first life is not the nurse's: ${first.slice(0, 80)}`);
    await step(page, 'app web (8091): the records list the life', 'app-records');
    // And the life the records keep is the one the Next web began.
    const after = await page.evaluate(READ_KEPT, [...LOCAL_KEYS]);
    const runs = (after.stores.runs ?? []).map((record) => record.value as { runId: string; seed: string });
    if (runs.length !== 1) throw new Error(`the app's web keeps ${runs.length} finished lives, not 1`);
    if (!runs.some((run) => run.runId === saved.gameId && run.seed === saved.seed)) throw new Error(`the app's web keeps no finished life ${saved.gameId}: ${JSON.stringify(runs.map((run) => run.runId))}`);
    // The life ended is still the one the front door shows the end of, as the Next web keeps it (its end screen survives a reload).
    const ended = (after.stores.currentGame ?? []).map((record) => record.value as { gameId: string; state: { finished: boolean } });
    if (ended.length !== 1 || ended[0].gameId !== saved.gameId || !ended[0].state.finished) throw new Error(`the app's web keeps another life in progress: ${JSON.stringify(ended.map((game) => game.gameId))}`);
    steps.push(`   the 8091 origin keeps the finished life ${saved.gameId} among its records (1 of 1), and the same life, ended, as the one whose end the front door shows`);
    console.log(steps.at(-1));
    // Nothing left this machine from the app's web, and no page asked a Supabase project for anything.
    const fromAppWeb = asked.filter((line) => line.startsWith(`${APP_WEB_PORT}:`));
    if (fromAppWeb.length > 0) throw new Error(`the app's web asked beyond this machine: ${[...new Set(fromAppWeb)].join(', ')}`);
    const projects = asked.filter((line) => /supabase/.test(line));
    if (projects.length > 0) throw new Error(`a page asked a Supabase project: ${[...new Set(projects)].join(', ')}`);
    steps.push(`   asked beyond this machine: from the app's web nothing; from the Next web ${[...new Set(asked)].map((line) => line.slice(line.indexOf(' ') + 1)).join(', ') || 'nothing'} (kept from it)`);
    console.log(steps.at(-1));
  });
  writeFileSync(join(raw, 'web-life-steps.txt'), `${steps.join('\n')}\n`);
  if (problems.length > 0) {
    console.error(`the pages said:\n${problems.join('\n')}`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
