import type { Locale } from '@ratrace/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

/**
 * Says yes to the question a round with no move of the player's own asks once its button is pressed ("Play the round without changes?"): its
 * Play anyway, in the sheet's own words (English unless given), pressed with `press` (a click unless given).
 */
export async function playAnyway(
  words: { title: string | RegExp; playAnyway: string | RegExp } = { title: 'Play the round without changes?', playAnyway: 'Play anyway' },
  press: (button: HTMLElement) => void = (button) => void fireEvent.click(button),
): Promise<void> {
  const title = await screen.findByRole('heading', { name: words.title });
  const sheet = title.closest('[aria-modal="true"]') as HTMLElement;
  press(within(sheet).getByRole('button', { name: words.playAnyway }));
}

/**
 * Presses the round's button (`button`, the English one unless given) as a test that is about something else plays a round: where the round
 * asks first, having no move of the player's own, its Play anyway too. The question is the tests' of Play.test.tsx.
 */
export async function playTheRound(button: HTMLElement = screen.getByRole('button', { name: 'Play the round' })): Promise<void> {
  fireEvent.click(button);
  if (screen.queryByRole('heading', { name: 'Play the round without changes?' })) await playAnyway();
}
