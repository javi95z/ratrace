import type { TextStyle } from 'react-native';
import type { Role, Weight } from './fonts';

/**
 * What a text's box is given besides its runs' own faces, for its lines to be as tall as their line. Nothing on the phone: a native text's line is the
 * line it is given (the kit places its baseline: `baselineShift`). The web's twin (`strut.web.ts`) gives the box the face the browser sets its lines from
 * (and a span that runs on in it, its own: `adjusted` for a reading span a pixel text's `font-size-adjust` reaches, and `line` the span's own line height).
 */
export function strut(role: Role, weight: Weight, size: number, language: string, adjusted = false, line?: number): TextStyle | null {
  void role;
  void weight;
  void size;
  void language;
  void adjusted;
  void line;
  return null;
}

/**
 * What each run of a text is given besides its face and size: nothing on the phone. The web's twin keeps a run of another face (Cyrillic in Exo 2 or
 * Oswald, a sign in Arial) from setting the line's height, as the browser's own fallback inside one element does not.
 */
export const RUN_LINE: TextStyle | null = null;

/** The line a text is laid out in, as the platform is given it: on the phone, the line itself (iOS puts it on its pixel grid: `onGrid`). */
export function cssLine(line: number): number {
  return line;
}
