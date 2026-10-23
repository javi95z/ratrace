import type { TextStyle } from 'react-native';

/**
 * The web's twin of `systemFace.ts`. Where none of the game's fonts draws a sign, the Next web's stack goes on through their stand-ins (next/font's
 * Arial) to the system's (`system-ui, sans-serif`), and Chrome picks the font that has it from there: SF for the ▸ of a figure, Zapf Dingbats for the
 * ✕ of a sheet's close, Lucida Grande for the ✎ of a name (measured with `CSS.getPlatformFontsForNode`). Named Zapf Dingbats, the pencil was Zapf's,
 * another pencil, lying flatter; named `system-ui` alone, it was Zapf's too: the run is given the same way there, through Arial.
 */
/** The end of the Next web's stacks, from the stand-in on: what a sign none of the game's fonts draws is looked for in. */
export const FALLBACK = 'Arial, system-ui, sans-serif';

export function platformFace(family: string): string {
  // `SYSTEM` and `DINGBATS` of fonts.ts, by their names (fonts.ts asks this module, so it cannot be asked back).
  return family === 'System' || family === 'Zapf Dingbats' ? FALLBACK : family;
}

/**
 * A sign of the system's fonts in a bold text (the ✕ on the picture of nothing worn, the Next web's `font-bold`), on the web: Chrome draws it bold, a
 * bold it makes itself where the font has none, as the Next web's element asks. The game's faces carry their weight in their names.
 */
export function faceWeight(face: string, weight: 400 | 600): TextStyle | null {
  return face === FALLBACK && weight === 600 ? { fontWeight: '600' } : null;
}
