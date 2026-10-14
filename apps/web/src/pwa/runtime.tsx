'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** The install event is deliberately absent from lib.dom: Chromium exposes it before standardisation. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallState = 'checking' | 'available' | 'manual' | 'installed';
export type InstallPlatform = 'ios' | 'browser';

interface PwaState {
  state: InstallState;
  platform: InstallPlatform;
  install(): Promise<'accepted' | 'dismissed' | 'manual'>;
}

// Screens rendered alone in unit tests should not grow an installation control by accident.
const PwaContext = createContext<PwaState>({ state: 'installed', platform: 'browser', install: async () => 'manual' });

const standalone = () => {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosNavigator.standalone === true;
};

/** iPadOS presents itself as a Mac, but unlike a Mac it has several touch points. */
export const installPlatform = (agent: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>): InstallPlatform =>
  /iPad|iPhone|iPod/.test(agent.userAgent) || (agent.platform === 'MacIntel' && agent.maxTouchPoints > 1) ? 'ios' : 'browser';

/**
 * Owns browser installation state for the whole app. It is mounted above every route so Chromium's
 * one-shot `beforeinstallprompt` event is not lost when the player is somewhere other than Home.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const prompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [state, setState] = useState<InstallState>('checking');
  const [platform, setPlatform] = useState<InstallPlatform>('browser');

  useEffect(() => {
    setPlatform(installPlatform(navigator));
    setState(standalone() ? 'installed' : 'manual');

    const offered = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      prompt.current = installEvent;
      setState('available');
    };
    const installed = () => {
      prompt.current = null;
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  // Caching a development build makes its own source changes appear stale. Production builds alone
  // own a worker; `updateViaCache: none` makes every visit check the tiny worker file itself.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      } catch {
        // Installation is an enhancement. A blocked worker must never keep the game from opening.
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });

    const update = () => void registration?.update().catch(() => {});
    window.addEventListener('online', update);
    return () => {
      window.removeEventListener('load', register);
      window.removeEventListener('online', update);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    const offered = prompt.current;
    if (!offered) return 'manual';
    prompt.current = null;
    await offered.prompt();
    const choice = await offered.userChoice;
    setState(choice.outcome === 'accepted' ? 'installed' : 'manual');
    return choice.outcome;
  }, []);

  const value = useMemo(() => ({ state, platform, install }), [state, platform, install]);
  return <PwaContext value={value}>{children}</PwaContext>;
}

export const usePwa = () => useContext(PwaContext);
