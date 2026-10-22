import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SECTIONS } from './kitCompare';

// The kit page of the app and the web's are compared shot for shot: the same sections, in the same order, with the same words.
// (Here, not beside the route: every file under src/app is a route to expo-router, a test too.)
const app = readFileSync(new URL('../src/app/kit.tsx', import.meta.url), 'utf8');
const web = readFileSync(new URL('../../web/src/app/[locale]/kit/page.tsx', import.meta.url), 'utf8');

const sectionsOf = (source: string) => JSON.parse(/const KIT_SECTIONS = (\[[^\]]*\])/.exec(source)![1].replaceAll("'", '"')) as string[];
/** Every quoted string and every bit of JSX text the page writes, in order. */
const wordsOf = (source: string) => [...source.matchAll(/'([^'\n]*)'|"([^"\n]*)"|>([^<>{}\n]+)</g)].map((m) => (m[1] ?? m[2] ?? m[3]).trim()).filter((w) => /[A-Za-zА-яЁё]/.test(w) && !/^(\.|@|react|expo|use client|ru|es|en)/.test(w));

test('the app\'s kit and the web\'s show the same sections, in the same order, as the comparison shoots them', () => {
  expect(sectionsOf(app)).toEqual(sectionsOf(web));
  expect(sectionsOf(app)).toEqual([...SECTIONS]);
});

test('the two kits write the same words', () => {
  const words = (source: string) => new Set(wordsOf(source).filter((w) => !/^(flex|grid|pixel|text-|mb-|h-|contents|@container|mx-auto)/.test(w)));
  const inApp = words(app);
  const inWeb = words(web);
  for (const w of ['Start a new life', 'Money put aside for a rainy day.', 'A panel without a title.', 'Not enough cash', 'Your salary rises by 400 $ a month.', 'Новый год: 12 346 $', 'Año nuevo: 12.346 $', 'Clicks and coins', 'Your name', 'Friend code', 'Ratty_99', 'AB12CD34', 'K7Q2XM']) {
    expect(inApp.has(w), `app: ${w}`).toBe(true);
    expect(inWeb.has(w), `web: ${w}`).toBe(true);
  }
});

// The motion section is a file of its own on each side: the times each effect is held at, and the data of the charts, are the same numbers.
const motionApp = readFileSync(new URL('../src/ui/kitMotion.tsx', import.meta.url), 'utf8');
const motionWeb = readFileSync(new URL('../../web/src/app/[locale]/kit/motion.tsx', import.meta.url), 'utf8');
const constant = (source: string, name: string) => (new RegExp(`const ${name} = (\\{[^}]*\\}|\\[[^\\]]*\\])`).exec(source)?.[1] ?? '').replace(/\s+/g, ' ');

test('the motion section holds every effect at the same time, and draws the same prices and the same net worth, on both sides', () => {
  for (const name of ['HELD', 'PRICE', 'HISTORY']) {
    expect(constant(motionApp, name), name).not.toBe('');
    expect(constant(motionApp, name), name).toBe(constant(motionWeb, name));
  }
});

test('no test lives among the routes: expo-router bundles every file under src/app, and node: modules break the app', () => {
  expect(readdirSync(new URL('../src/app', import.meta.url)).filter((name) => /\.test\./.test(name))).toEqual([]);
});
