import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { compareShots, SCREEN, SECTIONS, type Section, type TextBox } from './kitCompare';

/**
 * The kit beside the web's, shot for shot: every section of the kit page, on the web (Playwright, at the iPhone 16 Pro's
 * 402 × 874 pt at 3×, with its safe areas: 62 on top, 34 below) and in the app (Expo Go on the booted simulator), then
 * compared pixel by pixel into docs/superpowers/reports/phase-1-parity/.
 *
 *   pnpm --filter @ratrace/web exec tsx ../mobile/scripts/kit-shots.ts [web] [app] [compare] [--only=section,section]
 *
 * The web is served by its own `next dev` on port 3021, started and stopped here. The app is opened in Expo Go from the
 * Metro already running on 8090 (`npx expo start --port 8090` in apps/mobile). Playwright and sharp come from apps/web.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const web = join(root, 'apps/web');
const out = join(root, 'docs/superpowers/reports/phase-1-parity');
const raw = join(root, 'apps/mobile/.kit-shots');
const fromWeb = createRequire(join(web, 'package.json'));

export const PORT = 3021;
export const METRO = 'exp://127.0.0.1:8090';

/** The web page that shows a section: the Russian and Spanish texts in their own language, as a player would see them. */
const webUrl = (section: Section) => `http://localhost:${PORT}/${section === 'text-ru' ? 'ru' : section === 'text-es' ? 'es' : 'en'}/kit?section=${section}`;

/** What is used of Playwright, which this app does not depend on: it is the web's. */
interface Chromium {
  launch(options: { channel: string }): Promise<{
    newContext(options: object): Promise<{
      newPage(): Promise<Page>;
      newCDPSession(page: Page): Promise<{ send(method: string, params: object): Promise<unknown> }>;
    }>;
    close(): Promise<void>;
  }>;
}
interface Page {
  goto(url: string, options: object): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  waitForFunction(fn: () => boolean): Promise<unknown>;
  addStyleTag(options: { content: string }): Promise<unknown>;
  screenshot(options: { path: string }): Promise<unknown>;
}

/** In the page: every line of visible text, as client rects in CSS pixels, with the colour its glyphs are drawn in. */
const TEXT_BOXES = () => {
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

async function waitFor(url: string, ms: number): Promise<void> {
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

async function shootWeb(sections: readonly Section[]): Promise<void> {
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/sprites.ts'], { cwd: web, stdio: 'inherit' });
  // A server already answering on the port (one left running while the kit is being matched) is used as it is.
  const up = await fetch(webUrl('buttons')).then((res) => res.ok, () => false);
  // No cloud: the kit has nothing to save, and a dev page must never write to the live project.
  const server: ChildProcess | null = up
    ? null
    : spawn('pnpm', ['exec', 'next', 'dev', '-p', String(PORT)], {
        cwd: web,
        stdio: 'ignore',
        detached: true,
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
      });
  try {
    await waitFor(webUrl('buttons'), 180_000);
    const { chromium } = fromWeb('@playwright/test') as { chromium: Chromium };
    // The Chrome already on this machine, as the web's e2e tests use: nothing is downloaded.
    const browser = await chromium.launch({ channel: 'chrome' });
    const context = await browser.newContext({
      viewport: { width: SCREEN.width, height: SCREEN.height },
      deviceScaleFactor: SCREEN.scale,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    // The phone's safe areas, so `env(safe-area-inset-*)` is what it is on the iPhone.
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: SCREEN.top, bottom: SCREEN.bottom, left: 0, right: 0 } });
    for (const section of sections) {
      await page.goto(webUrl(section), { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every((img) => img.complete));
      // Every rise is over (0.28 s), and the dev overlay's badge is gone. A sheet opened with no tap before it takes the
      // keyboard's focus ring (`:focus-visible`), which a player's tap never shows and the phone has no use for.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; } :focus-visible { outline: none !important; }' });
      await sleep(800);
      await page.screenshot({ path: join(raw, `${section}-web.png`) });
      // Where each line of text stands, so the comparison can tell a glyph's edge from a box's.
      const boxes = await page.evaluate(TEXT_BOXES);
      writeFileSync(join(raw, `${section}-text.json`), JSON.stringify(boxes));
      console.log(`web ${section}`);
    }
    await browser.close();
  } finally {
    if (server?.pid) process.kill(-server.pid, 'SIGTERM');
  }
}

function shootApp(sections: readonly Section[]): Promise<void> {
  // The status bar the same in every shot (it is masked in the comparison anyway).
  execFileSync('xcrun', ['simctl', 'status_bar', 'booted', 'override', '--time', '9:41', '--batteryState', 'charged', '--batteryLevel', '100']);
  return sections.reduce(async (before, section) => {
    await before;
    execFileSync('xcrun', ['simctl', 'openurl', 'booted', `${METRO}/--/kit?section=${section}`]);
    // Long enough for the section's sprites to load (Skia reads them as they are asked).
    await sleep(4000);
    execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', join(raw, `${section}-app.png`)], { stdio: 'ignore' });
    console.log(`app ${section}`);
  }, Promise.resolve());
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',') as Section[] | undefined;
  const sections = only ?? SECTIONS;
  const steps = args.filter((a) => !a.startsWith('--'));
  const all = steps.length === 0;
  mkdirSync(raw, { recursive: true });
  mkdirSync(out, { recursive: true });
  if (all || steps.includes('web')) await shootWeb(sections);
  if (all || steps.includes('app')) await shootApp(sections);
  if (all || steps.includes('compare')) {
    const sharp: unknown = fromWeb('sharp');
    const results: Array<Awaited<ReturnType<typeof compareShots>>> = [];
    for (const section of sections) {
      const a = join(raw, `${section}-web.png`);
      const b = join(raw, `${section}-app.png`);
      if (!existsSync(a) || !existsSync(b)) throw new Error(`missing shots for ${section}`);
      const boxes = JSON.parse(readFileSync(join(raw, `${section}-text.json`), 'utf8')) as TextBox[];
      const result = await compareShots(sharp, section, readFileSync(a), readFileSync(b), boxes, out);
      // Half the screen unlike is not a difference to list: the app showed something else (a red box, a reload).
      if (result.rawPercent > 50) throw new Error(`${section}: the app's shot is not the kit (${result.rawPercent.toFixed(0)} % unlike); look at ${b}`);
      results.push(result);
    }
    // A run of some sections keeps the numbers of the others: the file always has every section that has been shot.
    const file = join(out, 'numbers.json');
    const kept = (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as typeof results) : []).filter((r) => !results.some((now) => now.section === r.section));
    const all = [...kept, ...results].sort((a, b) => SECTIONS.indexOf(a.section as Section) - SECTIONS.indexOf(b.section as Section));
    writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`);
    for (const r of results) {
      const worst = r.texts.reduce((m, t) => (t.unmeasured ? m : Math.max(m, t.apart)), 0);
      const unmeasured = r.texts.filter((t) => t.unmeasured).length;
      console.log(`${r.section.padEnd(11)} raw ${r.rawPercent.toFixed(2)} %  beyond ${r.beyondPercent.toFixed(3)} % (no dots rule ${r.beyondPlain} px)  a point away ${r.loose} px (no dots rule ${r.loosePlain}), not text ${r.shape} px  text lines ${r.texts.length} (unmeasured ${unmeasured}), worst ${worst.toFixed(2)} pt`);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
