import { createContext, useContext } from 'react';

const noTap = (): void => {};

const TapContext = createContext<() => void>(noTap);

/** Supplies the sound a press makes (Task 11's sound provider). Without one, a press is silent. */
export const TapProvider = TapContext.Provider;

/** The tap sound: every pressable in the kit calls it on press, never when disabled. */
export function useTap(): () => void {
  return useContext(TapContext);
}
