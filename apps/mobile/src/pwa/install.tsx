import type { ReactNode } from 'react';

/*
 * The offer to install the game as an app, on the web export (`install.web.tsx`, which Metro picks for the web). The phone is installed already: it
 * offers nothing, and these have the web's names and shapes so that Home and the root layout use them as they are.
 */

/** The install event is deliberately absent from lib.dom: Chromium exposes it before standardisation (the web's twin takes it). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Where the steps to install are for: an iPhone or iPad's Safari, or any other browser. */
export type InstallPlatform = 'ios' | 'browser';

/** Which steps a device is shown: the phone's are never shown. */
export const installPlatform: (agent: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) => InstallPlatform = () => 'browser';

/** Owns the install state for the whole app (mounted inside the game): on the phone, nothing but what it is given. */
export function InstallProvider({ children }: { children: ReactNode }): ReactNode {
  return children;
}

/** Whether Home offers to install the game: never on the phone. */
export function useInstallOffer(): { shown: boolean; dismiss(): void } {
  return NEVER;
}
const NEVER = { shown: false, dismiss: () => undefined };

/** The invitation on Home: nothing on the phone. */
export const InstallApp: (props: { onDismiss?: () => void }) => ReactNode = () => null;

/** The fix for an installed iPhone page left shifted by the status bar: nothing on the phone. */
export function ViewportSync(): ReactNode {
  return null;
}
