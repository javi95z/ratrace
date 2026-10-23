import type { Opener } from '@ratrace/online/types';
import { openAuthSessionAsync } from 'expo-web-browser';
import { AppState } from 'react-native';

/**
 * Where Google sends the player back to: the app's own address (app.json's `scheme`). The project lets the cloud send a player back to this
 * address exactly (`additional_redirect_urls`: `theratrace://auth`, no wider); the account reads a code or a word only from an address that
 * begins with it.
 */
export const BACK_FROM_GOOGLE = 'theratrace://auth';

/** Where Google sends the player back to, asked for when they go: always `BACK_FROM_GOOGLE` on the phone (the web's twin answers the page they are on). */
export const backFromGoogle = (): string => BACK_FROM_GOOGLE;

/** How long the app is waited for to be in front again before Google is opened all the same (and refused, if it is still held). */
const IN_FRONT_MS = 3_000;

/** The browser's answer to an opening while it still holds the trip before (expo-web-browser's own words). */
const HELD = /already open/i;

/**
 * Resolves once the app is in front (at once if it is), and a turn of the event loop later, or after `ms` all the same. On Android the auth session
 * is expo-web-browser's own (expo-web-browser 58, `src/WebBrowser.ts`, `_openAuthSessionPolyfillAsync`): it answers as soon as the app is sent back
 * to `theratrace://auth`, but holds the browser as open (`_onWebBrowserCloseAndroid`) until AppState says the app is `active` again, and clears that
 * a turn after (`await appStateChangedToActive`). Opened before then, it throws "WebBrowser is already open". `dismissAuthSession` does not release
 * it there (it only dismisses the browser), and `maybeCompleteAuthSession` is the web's alone.
 */
function inFront(ms: number, again = false): Promise<void> {
  return new Promise((done) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      subscription.remove();
      clearTimeout(timer);
      // A turn later: the browser's own listener has heard `active` too, and let its trip go.
      setTimeout(done, 0);
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    const timer = setTimeout(finish, ms);
    if (!again && AppState.currentState === 'active') finish();
  });
}

/**
 * Google, opened over the app in the system's browser (an auth session: Safari's on iOS, a Custom Tab on Android), which shares the player's
 * Google sign-in and comes back by itself to `BACK_FROM_GOOGLE`. Resolves with the address it came back to, whole, or null if the player
 * closed it (or it was closed for them). The account does the rest (`keepWithGoogle(BACK_FROM_GOOGLE, openForGoogle)`).
 *
 * A Google account that is already a player's opens Google a second time, straight after the first comes back: the second waits for the app to be in
 * front again, so the first trip is over (`inFront`). Refused all the same (the browser still holds the first), it is tried once more, when the app
 * next comes to the front, and never again: refused twice, it throws, and the account says it could not sign in, as the web says it.
 */
export const openForGoogle: Opener = async (url) => {
  await inFront(IN_FRONT_MS);
  const open = () => openAuthSessionAsync(url, BACK_FROM_GOOGLE);
  let result: Awaited<ReturnType<typeof openAuthSessionAsync>>;
  try {
    result = await open();
  } catch (error) {
    if (!(error instanceof Error && HELD.test(error.message))) throw error;
    await inFront(IN_FRONT_MS, true);
    result = await open();
  }
  return result.type === 'success' ? result.url : null;
};
