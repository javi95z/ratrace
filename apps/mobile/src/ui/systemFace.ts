import type { TextStyle } from 'react-native';
/**
 * The face a run is set in, by the font that draws it (`runsOf`): on the phone, that font by name (the system's own font, `System`, and Zapf
 * Dingbats, both on iOS). The web's twin (`systemFace.web.ts`) leaves the system's fonts to the browser.
 */
export function platformFace(family: string): string {
  return family;
}

/** What a run set in `face` takes of its text's weight besides its face: nothing on the phone, where the game's faces carry their weight in their names. */
export function faceWeight(face: string, weight: 400 | 600): TextStyle | null {
  void face;
  void weight;
  return null;
}
