import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';
import type { Role } from './fonts';

/*
 * The phone's own text size (Android's font size, iOS's Dynamic Type), followed by the game's words up to a point. Sentences (`ReadText`, a field's
 * text) grow with it to 1.3 times their size, which a paragraph, a card's option or a row of the finances has the room for; the pixel face (titles,
 * figures, buttons, the HUD) to 1.15 times, as it stands in rows and boxes of a set width that a larger figure would break. Below 1 both follow it
 * down as far as the phone goes. The same caps on both phones (`maxFontSizeMultiplier` is Android's and iOS's alike); the web follows the browser's
 * own zoom, and the phone's scale there is always 1.
 */

/** How much larger than its size a reading text is drawn, at most, however large the phone's text is. */
export const READ_SCALE_MAX = 1.3;
/** How much larger than its size a pixel text is drawn, at most. */
export const PIXEL_SCALE_MAX = 1.15;

/** The most a text of this kind grows with the phone's text size (its `maxFontSizeMultiplier`). */
export const scaleMax = (role: Role): number => (role === 'read' ? READ_SCALE_MAX : PIXEL_SCALE_MAX);

/** How many times its size a text of this kind is drawn at the phone's text size `system`: the phone's own, held to the kind's most. */
export const drawnScale = (system: number, role: Role): number => {
  const scale = Number.isFinite(system) && system > 0 ? system : 1;
  return Math.min(scale, scaleMax(role));
};

const subscribe = (changed: () => void): (() => void) => {
  const listening = Dimensions.addEventListener('change', changed);
  return () => listening.remove();
};
const systemScale = (): number => Dimensions.get('window').fontScale ?? 1;
/** A page drawn with no phone (the web export's HTML) has the browser's own size: 1. */
const serverScale = (): number => 1;

/**
 * The phone's text size, as it is now: a text is drawn again only when it changes (the settings changed while the game runs), never as the window
 * turns or changes its size.
 */
export function useFontScale(): number {
  return useSyncExternalStore(subscribe, systemScale, serverScale);
}
