import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { ARIAL_FILE, buildArialCoverage, buildCoverage, fontPath, readFont, type FontFamily } from '../../scripts/fontCoverage';
import { COVERAGE, METRICS, X_HEIGHT } from './fontCoverage';
import { ARIAL, baselineShift, CHAKRA_X_HEIGHT, DINGBATS, familyFor, SYSTEM, JERSEY_X_HEIGHT, OSWALD_X_HEIGHT, adjustedRead, CYRILLIC_ALONE, pixelSize, runsOf } from './fonts';

const JERSEY = 'Jersey15_400Regular';
const OSWALD = 'Oswald_500Medium';

const drawn = (family: FontFamily, ch: string) => {
  const r = COVERAGE[family];
  const c = ch.codePointAt(0)!;
  for (let i = 0; i < r.length; i += 2) if (c >= r[i] && c <= r[i + 1]) return true;
  return false;
};

test('the family a whole run uses, by role, weight and language', () => {
  expect(familyFor('pixel', 400, 'ru')).toBe(OSWALD);
  expect(familyFor('pixel', 400, 'es')).toBe(JERSEY);
  expect(familyFor('pixel', 400, 'en')).toBe(JERSEY);
  expect(familyFor('read', 600, 'ru')).toBe('Exo2_600SemiBold');
  expect(familyFor('read', 400, 'ru')).toBe('Exo2_400Regular');
  expect(familyFor('read', 400, 'en')).toBe('ChakraPetch_400Regular');
  expect(familyFor('read', 600, 'es')).toBe('ChakraPetch_600SemiBold');
});

test('each font\'s x-height constant is its TTF\'s sxHeight over unitsPerEm, to 3 decimals', () => {
  const of = (f: FontFamily) => {
    const { sxHeight, unitsPerEm } = readFont(fontPath(f));
    return sxHeight / unitsPerEm;
  };
  expect(JERSEY_X_HEIGHT).toBeCloseTo(of('Jersey15_400Regular'), 3);
  expect(OSWALD_X_HEIGHT).toBeCloseTo(of('Oswald_500Medium'), 3);
  expect(CHAKRA_X_HEIGHT).toBeCloseTo(of('ChakraPetch_400Regular'), 3);
});

test('a reading text inside a pixel text is drawn at the size that brings its small letters to the pixel stack\'s height (the `font-size-adjust` a `font-sans` span inherits)', () => {
  expect(adjustedRead(13)).toBeCloseTo((13 * 0.56) / CHAKRA_X_HEIGHT, 10);
  // Chakra Petch's small letters are shorter than Jersey's share of the em: it is drawn larger, about a fifth.
  expect(adjustedRead(13) / 13).toBeGreaterThan(1.1);
  expect(adjustedRead(13) / 13).toBeLessThan(1.3);
  expect(adjustedRead(26)).toBeCloseTo(2 * adjustedRead(13), 10);
});

test('pixelSize brings Jersey to the web\'s x-height share', () => {
  expect(PIXEL_X_HEIGHT).toBe(0.56);
  expect(pixelSize(17)).toBeCloseTo((17 * 0.56) / JERSEY_X_HEIGHT, 10);
});

test('the committed coverage is what the fonts say (run scripts/fontCoverage.ts when it fails)', () => {
  const committed = readFileSync(new URL('./fontCoverage.ts', import.meta.url), 'utf8');
  expect(committed).toBe(buildCoverage());
});

test('Latin text is one Jersey run, sized to the web\'s x-height', () => {
  const runs = runsOf('Rank 3 of 6, 12 345', 'pixel', 400);
  expect(runs).toEqual([{ text: 'Rank 3 of 6, 12 345', family: JERSEY, scale: PIXEL_X_HEIGHT / JERSEY_X_HEIGHT }]);
});

test('on a Russian page Russian goes to Oswald, the figures stay Jersey, and every space is Jersey\'s, as in the browser', () => {
  const runs = runsOf('Ранг 3 из 6', 'pixel', 400, 'ru');
  expect(runs.map((r) => r.text).join('')).toBe('Ранг 3 из 6');
  expect(runs.filter((r) => r.family === OSWALD).map((r) => r.text)).toEqual(['Ранг', 'из']);
  expect(runs.filter((r) => r.family === JERSEY).map((r) => r.text.trim())).toEqual(['3', '6']);
  const oswald = runs.find((r) => r.family === OSWALD)!;
  expect(oswald.scale).toBeCloseTo(PIXEL_X_HEIGHT / OSWALD_X_HEIGHT, 10);
  // The browser takes a space from the first font that draws one, Jersey, whatever the letters round it.
  expect(runsOf('Большой куш', 'pixel', 400, 'ru').map((r) => [r.text, r.family])).toEqual([
    ['Большой', OSWALD],
    [' ', JERSEY],
    ['куш', OSWALD],
  ]);
});

test('a sign outside the web\'s subsets is drawn by the stand-in, Arial, as the browser does: never by Chakra', () => {
  // Chakra's file has → and ▼, but none of its Google subsets asks for them: the web never draws them in Chakra.
  expect(drawn('ChakraPetch_400Regular', '→')).toBe(true);
  const runs = runsOf('Next → 4', 'pixel', 400);
  expect(runs.map((r) => [r.text, r.family])).toEqual([
    ['Next ', JERSEY],
    ['→', ARIAL],
    [' 4', JERSEY],
  ]);
  // The pixel text's font-size-adjust brings Arial too to the common small-letter height.
  expect(runs[1].scale).toBeCloseTo(PIXEL_X_HEIGHT / (1062 / 2048), 10);
  // In reading text the stand-in is at Chakra's size-adjust, 102.51 %.
  expect(runsOf('City ▼', 'read', 400).map((r) => [r.text, r.family, r.scale])).toEqual([
    ['City ', 'ChakraPetch_400Regular', 1],
    ['▼', ARIAL, 1.0251],
  ]);
  // A Russian page names its fonts alone: what none of them draws is the device's.
  expect(runsOf('Далее →', 'pixel', 400, 'ru').map((r) => r.family)).toEqual([OSWALD, JERSEY, SYSTEM]);
  // Elsewhere Russian letters, too, reach the stand-in before Oswald.
  expect(runsOf('Ранг', 'pixel', 400, 'en').map((r) => r.family)).toEqual([ARIAL]);
  // Past Arial: a dingbat from Zapf Dingbats, scaled as Jersey is; any other sign from the system font.
  expect(runsOf('✕', 'pixel', 400).map((r) => [r.family, r.scale])).toEqual([[DINGBATS, PIXEL_X_HEIGHT / JERSEY_X_HEIGHT]]);
  expect(runsOf('✓', 'read', 400).map((r) => r.family)).toEqual([DINGBATS]);
  expect(runsOf('▸', 'pixel', 400).map((r) => r.family)).toEqual([SYSTEM]);
});

test.skipIf(!existsSync(ARIAL_FILE))('the committed Arial coverage is what macOS\'s Arial says (run scripts/fontCoverage.ts when it fails)', () => {
  expect(readFileSync(new URL('./arialCoverage.ts', import.meta.url), 'utf8')).toBe(buildArialCoverage());
});

test('the reading role on a Russian page: Chakra, Exo 2 for Cyrillic, no size adjust', () => {
  expect(runsOf('Ранг 3', 'read', 600, 'ru')).toEqual([
    { text: 'Ранг', family: 'Exo2_600SemiBold', scale: 1 },
    { text: ' 3', family: 'ChakraPetch_600SemiBold', scale: 1 },
  ]);
  expect(runsOf('Rank', 'read', 400)).toEqual([{ text: 'Rank', family: 'ChakraPetch_400Regular', scale: 1 }]);
  expect(runsOf('', 'read', 400)).toEqual([]);
});

test('every Russian letter is drawn by Oswald and Exo 2', () => {
  for (const ch of 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя') {
    expect(drawn('Oswald_500Medium', ch), ch).toBe(true);
    expect(drawn('Exo2_400Regular', ch), ch).toBe(true);
    expect(drawn('Exo2_600SemiBold', ch), ch).toBe(true);
    expect(drawn('Jersey15_400Regular', ch), ch).toBe(false);
  }
});

test('on iOS a line\'s glyphs are moved to the browser\'s baseline: whole-pixel ascent and descent, the half above rounded down', () => {
  // A pixel title of 17: Jersey at 23.37 has ascent 18.17 → 18 and descent 5.19 → 5; the line of 18.7 leaves −4.3,
  // whose upper half −2.15 rounds down to −3: the browser's baseline is at 15. iOS puts it at 18.7 − 5.19 = 13.51.
  const pixel = runsOf('Go', 'pixel', 400);
  const f = 17 * (PIXEL_X_HEIGHT / JERSEY_X_HEIGHT);
  expect(baselineShift(pixel, 'pixel', 400, 17, 17 * 1.1, 17 * 1.1, 'ios')).toBeCloseTo(15 - (17 * 1.1 - (2 / 9) * f), 6);
  // A sentence of 15: Chakra's 14.88 and 4.62 are 15 and 5; the line of 21.75 leaves 1.75, half 0.875 → 0: baseline 15.
  // iOS: 21.75 − 4.62, raised by (21.75 − 19.5) / 2: 16.005.
  expect(baselineShift(runsOf('Go', 'read', 400), 'read', 400, 15, 15 * 1.45, 15 * 1.45, 'ios')).toBeCloseTo(15 - 16.005, 6);
  expect(baselineShift(pixel, 'pixel', 400, 17, 17 * 1.1, 17 * 1.1, 'android')).toBe(0);
});

test('a name that asks for the Cyrillic pixel typeface by itself (the web\'s `--font-pixel-cyrillic-alone`) is drawn in Oswald whatever the page speaks, with Oswald first in its line', () => {
  const runs = runsOf('Русский', 'pixel', 400, CYRILLIC_ALONE);
  expect(runs).toEqual([{ text: 'Русский', family: OSWALD, scale: PIXEL_X_HEIGHT / OSWALD_X_HEIGHT }]);
  // The same runs as a Russian page draws them: only the line's first font, which the baseline is set by, is not Jersey.
  expect(runs).toEqual(runsOf('Русский', 'pixel', 400, 'ru'));
  // On iOS: Oswald's whole-pixel ascent and descent at its adjusted size, not Jersey's.
  const f = 15 * (PIXEL_X_HEIGHT / X_HEIGHT[OSWALD]);
  const ascent = Math.round(METRICS[OSWALD].ascent * f);
  const descent = Math.round(METRICS[OSWALD].descent * f);
  const web = Math.floor((15 * 1.1 - (ascent + descent)) / 2) + ascent;
  const native = 15 * 1.1 - METRICS[OSWALD].descent * 15 * runs[0].scale - Math.max(0, (15 * 1.1 - (METRICS[OSWALD].ascent + METRICS[OSWALD].descent) * 15 * runs[0].scale) / 2);
  expect(baselineShift(runs, 'pixel', 400, 15, 15 * 1.1, 15 * 1.1, 'ios', CYRILLIC_ALONE)).toBeCloseTo(web - native, 6);
  // On a Russian page, or by default, the line is Jersey's, as before.
  expect(baselineShift(runs, 'pixel', 400, 15, 15 * 1.1, 15 * 1.1, 'ios', 'ru')).not.toBeCloseTo(web - native, 3);
  expect(baselineShift(runs, 'pixel', 400, 15, 15 * 1.1, 15 * 1.1, 'ios')).toBeCloseTo(baselineShift(runs, 'pixel', 400, 15, 15 * 1.1, 15 * 1.1, 'ios', 'ru'), 6);
});

test('the line metrics are the TTFs\' hhea ascender and descender', () => {
  const jersey = readFont(fontPath('Jersey15_400Regular'));
  expect(METRICS.Jersey15_400Regular).toEqual({ ascent: jersey.ascender / jersey.unitsPerEm, descent: -jersey.descender / jersey.unitsPerEm });
  expect(METRICS.ChakraPetch_400Regular).toEqual({ ascent: 0.992, descent: 0.308 });
});
