import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { useEffect } from 'react';
import { ARIAL_COVERAGE } from './arialCoverage';
import { COVERAGE, METRICS, X_HEIGHT } from './fontCoverage';

/*
 * The web sets type in two stacks (apps/web/src/app/globals.css):
 *   pixel  Jersey 15, then Oswald 500 for Cyrillic, then Chakra Petch for signs Jersey lacks;
 *   read   Chakra Petch (400, 600), then Exo 2 (400, 600) for Cyrillic.
 * The browser falls back letter by letter; React Native does not, so a text is cut into runs by the
 * font that draws each character (runsOf) and the runs are laid in nested Text. `font-size-adjust: 0.56`
 * brings every font of the pixel stack to one small-letter height; each run carries the scale that does it.
 */

export type Role = 'pixel' | 'read';
export type Weight = 400 | 600;

const JERSEY = 'Jersey15_400Regular';
const OSWALD = 'Oswald_500Medium';

const chakra = (weight: Weight) => (weight === 600 ? 'ChakraPetch_600SemiBold' : 'ChakraPetch_400Regular');
const exo = (weight: Weight) => (weight === 600 ? 'Exo2_600SemiBold' : 'Exo2_400Regular');

/** Small-letter height over the em of each font of the stacks (read from the TTFs by scripts/fontCoverage.ts). */
export const JERSEY_X_HEIGHT = X_HEIGHT[JERSEY];
export const OSWALD_X_HEIGHT = X_HEIGHT[OSWALD];
export const CHAKRA_X_HEIGHT = X_HEIGHT.ChakraPetch_400Regular;

/** The size to give Jersey so its small letters stand `PIXEL_X_HEIGHT` of `px`, as `font-size-adjust` does on the web. */
export function pixelSize(px: number): number {
  return (px * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT;
}

/**
 * The size Chakra Petch is drawn at where a pixel text's `font-size-adjust` reaches it: a `font-sans` span inside a `.pixel` box
 * (the line under "Continue your life" on the front door) inherits the adjust, so its small letters stand at the pixel stack's
 * height too and it is drawn that much larger than its size says. Its line height stays the size's own.
 */
export function adjustedRead(px: number): number {
  return (px * PIXEL_X_HEIGHT) / CHAKRA_X_HEIGHT;
}

/**
 * A reading text drawn where a pixel text's `font-size-adjust` reaches it (see `adjustedRead`), cut into runs: each run takes the pixel
 * stack's small-letter height, as the font it falls to has it (Chakra Petch's, Exo 2's for Cyrillic, Arial's or the system's past them).
 */
export function adjustedRuns(text: string, weight: Weight, language = 'en', italic = false): Run[] {
  return runsOf(text, 'read', weight, language, italic).map((run) => ({ ...run, scale: scaleOf(run.family, 'pixel') }));
}

/** The family a whole run in this language uses (Cyrillic ones for Russian). */
export function familyFor(role: Role, weight: Weight, locale: string): string {
  if (role === 'pixel') return locale === 'ru' ? OSWALD : JERSEY;
  return locale === 'ru' ? exo(weight) : chakra(weight);
}

/**
 * True once the fonts are settled: all in, or failed. A font that cannot load never holds the splash for good: the
 * game goes on in the system font, and the failure is told (once; the error reporter is phase 3's).
 */
export function useFontsSettled([loaded, error]: readonly [boolean, Error | null]): boolean {
  useEffect(() => {
    if (error) console.warn('the game\'s fonts did not load:', error);
  }, [error]);
  return loaded || error !== null;
}

/** Loads the game's fonts. True once they all are, or once they failed to. */
export function useGameFonts(): boolean {
  // Required here, not imported at the top: the .ttf files and expo-font are for the app, and a test of the
  // runs below must not need either.
  const { useFonts } = require('expo-font') as typeof import('expo-font');
  const { FONT_SOURCES } = require('./fontSources') as typeof import('./fontSources');
  return useFontsSettled(useFonts(FONT_SOURCES));
}

export interface Run {
  text: string;
  /** The font that draws it, as the tables here know it (coverage, metrics, small-letter height). */
  family: string;
  /** Multiply the size by this to bring the run to the pixel stack's common small-letter height. */
  scale: number;
  /** The family to set it in where that is not `family`: the slanted face of an italic run (`SLANT`). */
  face?: string;
  /** True where the run is italic and has no slanted face of its own (Arial, the system's font): the platform's own italic is asked for. */
  italic?: boolean;
}

/** The family a run is set in: its slanted face where it has one, else its font. */
export const faceOf = (run: Run): string => run.face ?? run.family;

/**
 * The slanted face of each reading font (assets/fonts, made from the fonts by scripts/slant_fonts.py), by the font it is made from. The web has no italic
 * face of these (next/font loads the upright ones) and Chrome slants the upright face as it draws it, every glyph sheared by a quarter of its height above the
 * baseline and the advances unchanged; iOS does not, and a real italic has other widths. An italic run is set in its slanted face, with no `fontStyle` (which
 * Android would slant a second time); one with no such face (Arial, the system's font) is asked for the platform's italic.
 */
export const SLANT: Readonly<Record<string, string>> = {
  ChakraPetch_400Regular: 'ChakraPetch_400Regular_Slant',
  ChakraPetch_600SemiBold: 'ChakraPetch_600SemiBold_Slant',
  Exo2_400Regular: 'Exo2_400Regular_Slant',
  Exo2_600SemiBold: 'Exo2_600SemiBold_Slant',
};


/**
 * What the web's fonts are asked for: Google's subsets, each an @font-face with its own unicode-range (next/font
 * declares every subset a family has, and loads the ones a page uses). A character outside them is never drawn by
 * that font on the web, even where the font file has it: `→` and `▼` are in Chakra's file but in none of its subsets.
 */
const RANGES = {
  latin: [0x0, 0xff, 0x131, 0x131, 0x152, 0x153, 0x2bb, 0x2bc, 0x2c6, 0x2c6, 0x2da, 0x2da, 0x2dc, 0x2dc, 0x304, 0x304, 0x308, 0x308, 0x329, 0x329, 0x2000, 0x206f, 0x20ac, 0x20ac, 0x2122, 0x2122, 0x2191, 0x2191, 0x2193, 0x2193, 0x2212, 0x2212, 0x2215, 0x2215, 0xfeff, 0xfeff, 0xfffd, 0xfffd],
  latinExt: [0x100, 0x2ba, 0x2bd, 0x2c5, 0x2c7, 0x2cc, 0x2ce, 0x2d7, 0x2dd, 0x2ff, 0x304, 0x304, 0x308, 0x308, 0x329, 0x329, 0x1d00, 0x1dbf, 0x1e00, 0x1e9f, 0x1ef2, 0x1eff, 0x2020, 0x2020, 0x20a0, 0x20ab, 0x20ad, 0x20c4, 0x2113, 0x2113, 0x2c60, 0x2c7f, 0xa720, 0xa7ff],
  vietnamese: [0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169, 0x1a0, 0x1a1, 0x1af, 0x1b0, 0x300, 0x301, 0x303, 0x304, 0x308, 0x309, 0x323, 0x323, 0x329, 0x329, 0x1ea0, 0x1ef9, 0x20ab, 0x20ab],
  thai: [0x2d7, 0x2d7, 0x303, 0x303, 0x331, 0x331, 0xe01, 0xe5b, 0x200c, 0x200d, 0x25cc, 0x25cc],
  cyrillic: [0x301, 0x301, 0x400, 0x45f, 0x490, 0x491, 0x4b0, 0x4b1, 0x2116, 0x2116],
  cyrillicExt: [0x460, 0x52f, 0x1c80, 0x1c8a, 0x20b4, 0x20b4, 0x2de0, 0x2dff, 0xa640, 0xa69f, 0xfe2e, 0xfe2f],
};
const SUBSETS: Record<string, number[][]> = {
  [JERSEY]: [RANGES.latin, RANGES.latinExt],
  ChakraPetch_400Regular: [RANGES.latin, RANGES.latinExt, RANGES.vietnamese, RANGES.thai],
  ChakraPetch_600SemiBold: [RANGES.latin, RANGES.latinExt, RANGES.vietnamese, RANGES.thai],
  [OSWALD]: [RANGES.latin, RANGES.latinExt, RANGES.vietnamese, RANGES.cyrillic, RANGES.cyrillicExt],
  Exo2_400Regular: [RANGES.latin, RANGES.latinExt, RANGES.vietnamese, RANGES.cyrillic, RANGES.cyrillicExt],
  Exo2_600SemiBold: [RANGES.latin, RANGES.latinExt, RANGES.vietnamese, RANGES.cyrillic, RANGES.cyrillicExt],
};

/**
 * The stand-in next/font names after each font on every page but a Russian one: Arial, sized to the font's measure.
 * On those pages it takes whatever Arial draws and the font itself does not.
 */
export const ARIAL = 'Arial';
/**
 * Where none of them draws a sign, the browser goes on to the system's fonts (Chrome said which: `CSS.getPlatformFontsForNode`):
 * a dingbat (✕ ✓) from Zapf Dingbats, anything else (▸) from the system font, which iOS calls System. Both ship with iOS.
 */
export const SYSTEM = 'System';
export const DINGBATS = 'Zapf Dingbats';
const isDingbat = (point: number) => point >= 0x2700 && point <= 0x27bf;
/** The stand-in's `size-adjust` after Chakra (the web's generated `Chakra Petch Fallback`). */
const ARIAL_FOR_CHAKRA = 1.0251;
/** Arial's small-letter height over the em (1062/2048), for the pixel text's `font-size-adjust`. */
const ARIAL_X_HEIGHT = 1062 / 2048;
/** The system font's small-letter height (SF, 1040/2048). */
const SYSTEM_X_HEIGHT = 1040 / 2048;
/** Line metrics of those that are not the game's: Arial (hhea 1854/−434 of 2048), SF (1980/−432), Zapf Dingbats (1667/−362). */
const OTHER_METRICS: Record<string, { ascent: number; descent: number }> = {
  [ARIAL]: { ascent: 1854 / 2048, descent: 434 / 2048 },
  [SYSTEM]: { ascent: 1980 / 2048, descent: 432 / 2048 },
  [DINGBATS]: { ascent: 1667 / 2048, descent: 362 / 2048 },
};
const metricsOf = (family: string) => METRICS[family] ?? OTHER_METRICS[family];

function within(ranges: readonly number[], point: number): boolean {
  let lo = 0;
  let hi = ranges.length / 2 - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (point < ranges[mid * 2]) hi = mid - 1;
    else if (point > ranges[mid * 2 + 1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Whether the web draws this character in this font: the font file has it, and one of its subsets asks for it. */
function drawn(family: string, point: number): boolean {
  return within(COVERAGE[family], point) && SUBSETS[family].some((r) => within(r, point));
}

/**
 * The pseudo-language of a text that asks for the Cyrillic pixel typeface by itself, first, on a page of any language (the web's
 * `font-family: var(--font-pixel-cyrillic-alone), var(--font-pixel)`, which the name of the Russian language in the language picker is
 * set in): Oswald, with Jersey after it.
 */
export const CYRILLIC_ALONE = 'ru-alone';

/**
 * The fonts the web tries, in its order, for a role on a page in a language (globals.css's stacks, with the stand-ins
 * next/font puts after Jersey and Chakra; a Russian page names the fonts alone, so its Cyrillic reaches Oswald and Exo 2).
 */
function stackOf(role: Role, weight: Weight, language: string): string[] {
  if (language === CYRILLIC_ALONE) return [OSWALD, JERSEY];
  if (language === 'ru') return role === 'pixel' ? [JERSEY, OSWALD, chakra(weight), exo(weight)] : [chakra(weight), exo(weight)];
  return role === 'pixel' ? [JERSEY, ARIAL] : [chakra(weight), ARIAL];
}

/**
 * How much a run's font is scaled: pixel text to the common small-letter height, a stand-in to its `size-adjust`.
 * Zapf Dingbats has no small letters to measure, and the browser scales it as it scales Jersey.
 */
function scaleOf(family: string, role: Role): number {
  if (role === 'pixel') {
    const x = family === ARIAL ? ARIAL_X_HEIGHT : family === SYSTEM ? SYSTEM_X_HEIGHT : family === DINGBATS ? X_HEIGHT[JERSEY] : X_HEIGHT[family];
    return PIXEL_X_HEIGHT / x;
  }
  return family === ARIAL ? ARIAL_FOR_CHAKRA : 1;
}

/** Whether the web draws this character in this font: for Arial, its file has it; for the game's fonts, one of their subsets asks for it too. */
const draws = (family: string, point: number) => (family === ARIAL ? within(ARIAL_COVERAGE, point) : drawn(family, point));

/**
 * Cuts a text into runs by the font that draws each character, as the browser's letter-by-letter fallback does on a
 * page in `language`: the first font of the stack that draws it, and past them the system's. An `italic` text is set in the slanted faces (`SLANT`).
 */
export function runsOf(text: string, role: Role, weight: Weight, language = 'en', italic = false): Run[] {
  const stack = stackOf(role, weight, language);
  const runs: Run[] = [];
  for (const ch of Array.from(text)) {
    const point = ch.codePointAt(0)!;
    const family = stack.find((f) => draws(f, point)) ?? (isDingbat(point) ? DINGBATS : SYSTEM);
    const last = runs[runs.length - 1];
    if (last && last.family === family) last.text += ch;
    else runs.push({ text: ch, family, scale: scaleOf(family, role), ...(italic ? (SLANT[family] ? { face: SLANT[family] } : { italic: true }) : null) });
  }
  return runs;
}

/**
 * Where the browser puts the baseline of a line, in points below the line's top: the room left over by the line height is split above and below the first
 * font's ascent and descent (each rounded to a whole pixel), the half above rounded down. The line is set from the first font of the stack, whichever font
 * draws what is in it (the pixel stack's, with Jersey at its adjusted size). It is what two texts of different sizes that share a baseline (the web's
 * `items-baseline`) stand apart by, which a row of the phone cannot be asked for: the kit moves a text's glyphs inside its box, and the baseline a native row
 * reads is the box's.
 */
export function webBaseline(role: Role, weight: Weight, size: number, lineHeight: number, language = 'en'): number {
  const first = stackOf(role, weight, language)[0];
  const f = size * (role === 'pixel' ? PIXEL_X_HEIGHT / X_HEIGHT[first] : 1);
  const ascent = Math.round(METRICS[first].ascent * f);
  const descent = Math.round(METRICS[first].descent * f);
  return Math.floor((lineHeight - (ascent + descent)) / 2) + ascent;
}

/**
 * How far to move a text's glyphs down so its baseline stands where the browser puts it, in points.
 *
 * The browser (Blink, the web's reference) sets a line from the first font's ascent and descent, each rounded to a
 * whole pixel, and the room left over split above and below with the half above rounded down: the baseline is at
 * floor((lineHeight − (round(a·f) + round(d·f))) / 2) + round(a·f), with Jersey at its adjusted size for pixel text
 * and Chakra for reading text. iOS, given a line height, puts the baseline at lineHeight − descent (the largest
 * descent of the fonts in the text), and React Native raises it by half the room left when the line is taller than
 * the tallest font (RCTApplyBaselineOffset), in the line it is actually given (`drawnLine`). Unmoved, a pixel title on iOS stood up to two points above the web's,
 * and a sentence about a point below. Android is not measured yet, so nothing is moved there.
 */
export function baselineShift(runs: readonly Run[], role: Role, weight: Weight, size: number, lineHeight: number, drawnLine: number, os: string, language = 'en'): number {
  if (os !== 'ios' || runs.length === 0) return 0;
  const web = webBaseline(role, weight, size, lineHeight, language);
  const tallest = Math.max(...runs.map((r) => (metricsOf(r.family).ascent + metricsOf(r.family).descent) * size * r.scale));
  const deepest = Math.max(...runs.map((r) => metricsOf(r.family).descent * size * r.scale));
  // The phone draws the line it is given (on its pixel grid); the browser the one asked for.
  const native = drawnLine - deepest - Math.max(0, (drawnLine - tallest) / 2);
  return web - native;
}
