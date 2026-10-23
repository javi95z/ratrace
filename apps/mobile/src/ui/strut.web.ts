import type { TextStyle } from 'react-native';
import { strutFace, type Role, type Weight } from './fonts';

/**
 * The web's twin of `strut.ts`. A text is its runs, each a span in its own face (`runsOf`), inside a box that react-native-web gives the browser's
 * default font; the browser sets each line from the box's font (its strut) as well as the runs', each aligned on its baseline with its own half of
 * the leading, and a line came out a pixel taller than its `line-height` (a paragraph of five lines five pixels taller than the Next web's). The
 * Next web's element is set in the stack's first face, so the box is given that face at the size its runs are drawn at (Jersey's adjusted size).
 */
export function strut(role: Role, weight: Weight, size: number, language: string): TextStyle {
  const face = strutFace(role, weight, language);
  return { fontFamily: face.family, fontSize: size * face.scale };
}
