import type { Locale } from '@ratrace/i18n';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { GameProvider } from '../game/context';
import type { Services } from '../game/context';
import { speaking } from './memoryServices';

// What the tests of the game read of the phone's stand-ins (`fakes.ts`): the router's spies, Android's Back, the phone's languages and
// key-value store, the cues played, the edges of the screen.
export { changeLanguages, device, files, folders, heard, insets, kv, params, photos, pressBack, router, shareSheet, spriteRenders, systemLanguageKeep } from './fakes';
// The services with nothing behind them but memory (kept apart: the development route that draws a scene has them too).
export { memoryServices } from './memoryServices';

/**
 * Draws a screen inside everything the real app gives it: the language, its words, and the game. The language is the
 * one asked for, whatever the phone speaks and whatever it kept, unless the services keep a language of their own.
 */
export function renderGame(ui: ReactElement, services: Services, locale: Locale = 'en') {
  return render(<GameProvider services={speaking(services, locale)}>{ui}</GameProvider>);
}
