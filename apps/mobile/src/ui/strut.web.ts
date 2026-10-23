import type { TextStyle } from 'react-native';
import { strutFace, type Role, type Weight } from './fonts';

/**
 * The web's twin of `strut.ts`. A text is its runs, each a span in its own face (`runsOf`), inside a box that react-native-web gives the browser's
 * default font; the browser sets each line from the box's font (its strut) as well as the runs', each aligned on its baseline with its own half of
 * the leading, and a line came out a pixel taller than its `line-height` (a paragraph of five lines five pixels taller than the Next web's). The
 * Next web's element is set in the stack's first face, so the box is given that face at the size its runs are drawn at (Jersey's adjusted size), and so
 * is each span that runs on in it (a reading span in a pixel text at its adjusted size: `adjusted`), as the Next web's span is set in its own. A span of
 * another face has the line its classes give it (`line`: Tailwind's `text-[13px]` 1.25 of its size, `pixel` 1.1), which a line taller than the
 * text's own (inherited, as react-native-web's span does) would push the line open by.
 */
export function strut(role: Role, weight: Weight, size: number, language: string, adjusted = false, line?: number): TextStyle {
  const face = strutFace(role, weight, language, adjusted);
  return { fontFamily: face.family, fontSize: size * face.scale, ...(line === undefined ? null : { lineHeight: cssLine(line) }) };
}

/**
 * Each run's own line, on the web: none. The Next web's element draws a run of another face (Cyrillic in Exo 2 or Oswald, a sign in Arial) by the
 * browser's fallback, inside the element's one inline box, whose height is the element's own face's; the app's runs are spans of their own, each an
 * inline box set from its own face, and a Russian paragraph's lines came out up to a point taller each. A run with no line of its own stands inside
 * the box's line (its strut, `strut`) and moves nothing; a span that runs on keeps the line it is given (`strut`'s `line`).
 */
export const RUN_LINE: TextStyle = { lineHeight: 0 };

/**
 * The line a text is laid out in, on the web: the line the Next web's element has. Its lines are ratios of the size (`leading-snug`, the body's 1.45),
 * which Chrome lays out at the line's 1/64 px below (12 px at 1.45: 17.390625), where a line in pixels (react-native-web writes every line so) is laid
 * out at the nearest 1/64 (17.40625): a list of such lines drifted a device pixel down from the Next web's in six rows. The line is given in pixels
 * already cut to the 1/64 below (a hair over, for a product that falls a hair short of a whole 1/64).
 */
export function cssLine(line: number): number {
  return Math.floor(line * 64 + 1e-6) / 64;
}
