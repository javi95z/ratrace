import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { COVERAGE, X_HEIGHT } from './fontCoverage';

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

/** The family a whole run in this language uses (Cyrillic ones for Russian). */
export function familyFor(role: Role, weight: Weight, locale: string): string {
  if (role === 'pixel') return locale === 'ru' ? OSWALD : JERSEY;
  return locale === 'ru' ? exo(weight) : chakra(weight);
}

/** Loads the game's fonts. True once they all are. */
export function useGameFonts(): boolean {
  // Required here, not imported at the top: the .ttf files and expo-font are for the app, and a test of the
  // runs below must not need either.
  const { useFonts } = require('expo-font') as typeof import('expo-font');
  const { FONT_SOURCES } = require('./fontSources') as typeof import('./fontSources');
  const [loaded] = useFonts(FONT_SOURCES);
  return loaded;
}

export interface Run {
  text: string;
  family: string;
  /** Multiply the size by this to bring the run to the pixel stack's common small-letter height. */
  scale: number;
}

const CYRILLIC = /\p{Script=Cyrillic}/u;
const SPACE = /\s/u;

function drawn(family: string, point: number): boolean {
  const ranges = COVERAGE[family];
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

/** Cuts a text into runs by the font that draws each character, as the browser's letter-by-letter fallback would. */
export function runsOf(text: string, role: Role, weight: Weight): Run[] {
  const chars = Array.from(text);
  const cyrillic = chars.map((c) => CYRILLIC.test(c));
  const space = chars.map((c) => SPACE.test(c));
  const base = role === 'pixel' ? JERSEY : chakra(weight);
  const cyrFont = role === 'pixel' ? OSWALD : exo(weight);
  const sign = chakra(weight);
  const scaleOf = (family: string) => (role === 'pixel' ? PIXEL_X_HEIGHT / X_HEIGHT[family] : 1);

  const runs: Run[] = [];
  let before = false; // the last character that is not a space was Cyrillic
  for (let i = 0; i < chars.length; i++) {
    let family: string;
    if (cyrillic[i]) family = cyrFont;
    else if (space[i]) {
      // A space between two Cyrillic characters is Oswald's / Exo's, so a Russian phrase is one run.
      let next = i + 1;
      while (next < chars.length && space[next]) next++;
      family = before && next < chars.length && cyrillic[next] ? cyrFont : base;
    } else if (role === 'pixel' && !drawn(JERSEY, chars[i].codePointAt(0)!) && drawn(sign, chars[i].codePointAt(0)!)) family = sign;
    else family = base;
    if (!space[i]) before = cyrillic[i];

    const last = runs[runs.length - 1];
    if (last && last.family === family) last.text += chars[i];
    else runs.push({ text: chars[i], family, scale: scaleOf(family) });
  }
  return runs;
}
