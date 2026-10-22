import type { Opener } from '@ratrace/online/types';
import { openAuthSessionAsync } from 'expo-web-browser';

/**
 * Where Google sends the player back to: the app's own address (app.json's `scheme`). The project lets the cloud send a player back here
 * (`additional_redirect_urls`: `theratrace://**`); the account reads a code or a word only from an address that begins with it.
 */
export const BACK_FROM_GOOGLE = 'theratrace://auth';

/**
 * Google, opened over the app in the system's browser (an auth session: Safari's on iOS, a Custom Tab on Android), which shares the player's
 * Google sign-in and comes back by itself to `BACK_FROM_GOOGLE`. Resolves with the address it came back to, whole, or null if the player
 * closed it (or it was closed for them). The account does the rest (`keepWithGoogle(BACK_FROM_GOOGLE, openForGoogle)`).
 */
export const openForGoogle: Opener = async (url) => {
  const result = await openAuthSessionAsync(url, BACK_FROM_GOOGLE);
  return result.type === 'success' ? result.url : null;
};
