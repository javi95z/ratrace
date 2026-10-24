import { useFontsSettled } from './fonts';

/*
 * The game's typefaces, loaded before its first screen is drawn (`app/_layout.tsx`). The phone loads every one at once, whatever the language: they
 * are files of the app. The web fetches ahead only those its page draws first (`gameFonts.web.ts`).
 */

/** Loads the game's fonts. True once they all are, or once they failed to. (`locale`, the page's language, is the web's to read.) */
export function useGameFonts(locale: string): boolean {
  void locale;
  // Required here, not imported at the top: the .ttf files and expo-font are for the app, and a test of the runs in fonts.ts must not need either.
  const { useFonts } = require('expo-font') as typeof import('expo-font');
  const { FONT_SOURCES } = require('./fontSources') as typeof import('./fontSources');
  return useFontsSettled(useFonts(FONT_SOURCES));
}
