import type { GoogleOnDevice } from '@ratrace/online/supabase';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/*
 * Google on the phone itself (the account's `GoogleOnDevice`): the system's own chooser of the Google accounts on the device (Android's Credential
 * Manager, Google's sheet on iOS), no browser opened over the game, answered with the chosen account's ID token, which the cloud takes as Google's
 * word (`signInWithIdToken`, `linkIdentity`). Only in a build that names its Google clients (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, the project's web
 * client, the audience the cloud checks; on iOS `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` too, app.config.ts writing its URL scheme), outside Expo Go
 * (which has no such module): anywhere else none, and the browser's trip it always was (`browser.ts`). The library is loaded only when asked.
 */

type Library = typeof import('@react-native-google-signin/google-signin');

let library: Promise<Library | null> | null = null;
let configured = false;

/** The build's Google clients, or null where it names none fit for this phone. */
function clients(): { webClientId: string; iosClientId?: string } | null {
  // Named in full: the build writes these into the app only where it sees them so (Expo's `EXPO_PUBLIC_*`).
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
  if (webClientId === '' || (Platform.OS === 'ios' && iosClientId === '')) return null;
  return iosClientId === '' ? { webClientId } : { webClientId, iosClientId };
}

/** The phone's own Google sign-in, or undefined where this build has none (the web, Expo Go, a build that names no client). */
export function googleOnDevice(): GoogleOnDevice | undefined {
  const named = clients();
  if (named === null || (Platform.OS !== 'ios' && Platform.OS !== 'android') || String(Constants.executionEnvironment) === 'storeClient') return undefined;
  return async () => {
    const loaded = await (library ??= import('@react-native-google-signin/google-signin').then(
      (it) => it,
      () => null,
    ));
    if (loaded === null) return null;
    const { GoogleSignin, isErrorWithCode, statusCodes } = loaded;
    try {
      if (!configured) {
        GoogleSignin.configure(named);
        configured = true;
      }
      // The chooser every time: the player picks the account, as a phone's own apps ask, never one remembered from the last time.
      await GoogleSignin.signOut().catch(() => undefined);
      if (Platform.OS === 'android' && !(await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }))) return null;
      const answer = await GoogleSignin.signIn();
      if (answer.type === 'cancelled') return 'cancelled';
      return answer.data.idToken ?? null;
    } catch (error) {
      if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) return 'cancelled';
      return null;
    }
  };
}
