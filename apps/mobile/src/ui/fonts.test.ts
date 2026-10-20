import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { buildCoverage, fontPath, readFont, type FontFamily } from '../../scripts/fontCoverage';
import { COVERAGE } from './fontCoverage';
import { CHAKRA_X_HEIGHT, familyFor, JERSEY_X_HEIGHT, OSWALD_X_HEIGHT, pixelSize, runsOf } from './fonts';

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

test('Russian goes to Oswald, the figures stay Jersey, spaces between Cyrillic words join the Cyrillic run', () => {
  const runs = runsOf('Ранг 3 из 6', 'pixel', 400);
  expect(runs.map((r) => r.text).join('')).toBe('Ранг 3 из 6');
  expect(runs.filter((r) => r.family === OSWALD).map((r) => r.text)).toEqual(['Ранг', 'из']);
  expect(runs.filter((r) => r.family === JERSEY).map((r) => r.text.trim())).toEqual(['3', '6']);
  const oswald = runs.find((r) => r.family === OSWALD)!;
  expect(oswald.scale).toBeCloseTo(PIXEL_X_HEIGHT / OSWALD_X_HEIGHT, 10);
  expect(runsOf('Большой куш', 'pixel', 400)).toEqual([{ text: 'Большой куш', family: OSWALD, scale: PIXEL_X_HEIGHT / OSWALD_X_HEIGHT }]);
});

test('a sign Jersey does not draw but Chakra does goes to Chakra', () => {
  expect(drawn('Jersey15_400Regular', '→')).toBe(false);
  expect(drawn('ChakraPetch_400Regular', '→')).toBe(true);
  const runs = runsOf('Next → 4', 'pixel', 400);
  expect(runs.map((r) => [r.text, r.family])).toEqual([
    ['Next ', JERSEY],
    ['→', 'ChakraPetch_400Regular'],
    [' 4', JERSEY],
  ]);
  expect(runs[1].scale).toBeCloseTo(PIXEL_X_HEIGHT / CHAKRA_X_HEIGHT, 10);
});

test('the reading role: Chakra, Exo 2 for Cyrillic, no size adjust', () => {
  expect(runsOf('Ранг 3', 'read', 600)).toEqual([
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
