import { createContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/*
 * Whether a screen of the stack is the one in front, for its sheets (ui/overlay.tsx): kept apart from the sheets, so the app's shell (app/_layout.tsx)
 * takes nothing of them to give every screen its own.
 */

/**
 * Whether the screen a sheet is drawn on is the one in front: a sheet is shown only while it is (the screen pushed over it, by a tap on a notice,
 * hides it; it shows again when its screen is back in front, as it was left). True outside a screen of the stack (`InFront`).
 */
export const ScreenInFront = createContext(true);

/** What a screen of the stack hears of its being in front: React Navigation's `focus` and `blur`. */
interface Focusing {
  isFocused(): boolean;
  addListener(event: 'focus' | 'blur', listener: () => void): () => void;
}

/** Tells the sheets of a screen of the stack whether it is in front (the stack's `screenLayout`, app/_layout.tsx). */
export function InFront({ navigation, children }: { navigation: Focusing; children: ReactNode }) {
  const [front, setFront] = useState(() => navigation.isFocused());
  useEffect(() => {
    setFront(navigation.isFocused());
    const shown = navigation.addListener('focus', () => setFront(true));
    const hidden = navigation.addListener('blur', () => setFront(false));
    return () => {
      shown();
      hidden();
    };
  }, [navigation]);
  return <ScreenInFront.Provider value={front}>{children}</ScreenInFront.Provider>;
}
