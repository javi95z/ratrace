import type { Page } from '@ratrace/online/follow';
import * as Network from 'expo-network';
import { AppState } from 'react-native';

/*
 * What the phone tells the account of itself, as the browser tells it of a page (the web's `browserPage`, apps/web/src/online/index.ts): the
 * connection come back, and the app come back to the front, after which `follow` has the account read again.
 */

/** Whether the phone can reach the servers: connected, and to the internet as far as it knows (not yet known is not "no"). */
const reaches = (state: Network.NetworkState): boolean => state.isConnected === true && state.isInternetReachable !== false;

/** What the phone tells of the app. */
export const phonePage: Page = {
  /**
   * The connection back: a change from none to one, as a browser's `online` event. What the phone says as the listening begins is how it is, not a
   * change, and is not told; how it was before then is read once, so a change that comes before that answer is heard all the same.
   */
  onOnline: (listener) => {
    let was: boolean | null = null;
    let stopped = false;
    const subscription = Network.addNetworkStateListener((state) => {
      const now = reaches(state);
      if (now && was === false) listener();
      was = now;
    });
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!stopped && was === null) was = reaches(state);
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      subscription.remove();
    };
  },
  /**
   * The app back in front from the background, as a browser's page made visible again (`visibilitychange`). Only covered a moment (iOS's `inactive`:
   * the notification shade, the sheet of Google's sign-in) it never left, as a page under a dialog is still visible: that is not told.
   */
  onShown: (listener) => {
    let away = AppState.currentState === 'background';
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') away = true;
      else if (state === 'active') {
        if (away) listener();
        away = false;
      }
    });
    return () => subscription.remove();
  },
  now: () => Date.now(),
};

/** Whether the phone reached the servers when it was last asked or told: not yet known is not "no", as a browser's `navigator.onLine`. */
let reachable = true;
const hearing = new Set<() => void>();
let stopHearing: (() => void) | null = null;

/**
 * Whether the phone has a connection now, and every change of it, for a screen to read as the web reads `navigator.onLine` and its `online` and
 * `offline` events. The phone is listened to while someone is listening here, and asked once as the listening begins.
 */
export const phoneConnection = {
  connected: (): boolean => reachable,
  subscribe(listener: () => void): () => void {
    hearing.add(listener);
    if (stopHearing === null) {
      const set = (now: boolean) => {
        if (now === reachable) return;
        reachable = now;
        for (const one of [...hearing]) one();
      };
      let told = false;
      const subscription = Network.addNetworkStateListener((state) => {
        told = true;
        set(reaches(state));
      });
      void Network.getNetworkStateAsync()
        .then((state) => {
          if (!told && stopHearing !== null) set(reaches(state));
        })
        .catch(() => undefined);
      stopHearing = () => subscription.remove();
    }
    return () => {
      hearing.delete(listener);
      if (hearing.size === 0) {
        stopHearing?.();
        stopHearing = null;
      }
    };
  },
};

/**
 * Tells `set` whether the app is in front: at once, and again each time that changes. The account's session is renewed only then: a phone in the
 * background renews nothing, and a timer kept running there would be stopped by the system half way. Returns how to stop.
 */
export function whileActive(set: (active: boolean) => void): () => void {
  let active = AppState.currentState === 'active';
  set(active);
  const subscription = AppState.addEventListener('change', (state) => {
    const now = state === 'active';
    if (now === active) return;
    active = now;
    set(now);
  });
  return () => subscription.remove();
}
