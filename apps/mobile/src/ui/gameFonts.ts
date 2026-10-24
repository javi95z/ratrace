import { useFontsSettled } from './fonts';

/*
 * The game's typefaces, loaded before its first screen is drawn (`app/_layout.tsx`). The phone loads every one at once, whatever the language: they
 * are files of the app. The web fetches ahead only those its page draws first, and declares the rest for later (`gameFonts.web.ts`).
 */

/** The style element the web declares its later faces in (`gameFonts.web.ts`); the phone has no page to declare them in. */
export const LATER_FACES = 'ratrace-later-fonts';

/** The faces the web declares for later on a page in `locale`: none on the phone, which loads them all. */
export function laterFaces(locale: string): string {
  void locale;
  return '';
}

/** Loads the game's fonts. True once they all are, or once they failed to. */
export function useGameFonts(): boolean {
  // Required here, not imported at the top: the .ttf files and expo-font are for the app, and a test of the runs in fonts.ts must not need either.
  const { useFonts } = require('expo-font') as typeof import('expo-font');
  const { FONT_SOURCES } = require('./fontSources') as typeof import('./fontSources');
  return useFontsSettled(useFonts(FONT_SOURCES));
}
