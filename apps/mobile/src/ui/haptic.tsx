import { createContext, useContext } from 'react';

/**
 * What the phone's touch says of a moment, by what the moment is, never by how it buzzes (`haptics.ts` maps each to the platform's own):
 * - `select`: another of a few choices is taken (a tab, a segment, an option of a picker);
 * - `tick`: a value moves past one of many steps (a slider);
 * - `toggleOn`, `toggleOff`: a switch is turned;
 * - `threshold`: a drag reaches the point where letting go acts (a card swiped far enough to answer);
 * - `confirm`: the player commits to something (an answer, the round played);
 * - `success`: something good is won (a badge, the way out of the rat race, a new rank);
 * - `warning`: something goes wrong round the player (a crisis begins);
 * - `reject`: what the player asked is refused, or something goes badly wrong for them.
 *
 * Nothing for a plain press of a button: a phone's own buttons say nothing to the touch either.
 */
export type Haptic = 'select' | 'tick' | 'toggleOn' | 'toggleOff' | 'threshold' | 'confirm' | 'success' | 'warning' | 'reject';

const silent = (): void => undefined;

const HapticContext = createContext<(kind: Haptic) => void>(silent);

/** Supplies the phone's touch (the game's provider gives `feel`, ./haptics). Without one, nothing is felt: the kit's own tests, the web. */
export const HapticProvider = HapticContext.Provider;

/** Says a moment to the touch, as the provider feels it. */
export function useHaptic(): (kind: Haptic) => void {
  return useContext(HapticContext);
}
