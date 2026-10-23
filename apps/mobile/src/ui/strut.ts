import type { TextStyle } from 'react-native';
import type { Role, Weight } from './fonts';

/**
 * What a text's box is given besides its runs' own faces, for its lines to be as tall as their line. Nothing on the phone: a native text's line is the
 * line it is given (the kit places its baseline: `baselineShift`). The web's twin (`strut.web.ts`) gives the box the face the browser sets its lines from.
 */
export function strut(role: Role, weight: Weight, size: number, language: string): TextStyle | null {
  void role;
  void weight;
  void size;
  void language;
  return null;
}
