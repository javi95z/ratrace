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
  /** The app back in front from anywhere else (the background, or iOS's `inactive`), as a browser's page made visible again. */
  onShown: (listener) => {
    let was = AppState.currentState;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && was !== 'active') listener();
      was = state;
    });
    return () => subscription.remove();
  },
  now: () => Date.now(),
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
