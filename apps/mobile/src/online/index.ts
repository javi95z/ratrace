import type { PlayerStore } from '@ratrace/core/session/types';
import { connectSupabase } from '@ratrace/online/connect';
import type { Cloud } from '@ratrace/online/supabase';
import { kvSession, kvText } from '../kvStore';
import { phoneTurnstile } from './captcha';
import { phoneErrors, watchErrors } from './errors';
import { heldSaves, pacedLives } from './held';
import { givenUpIn, offline, onlineOver, refusedIn } from './over';
import type { Online } from './over';
import { phonePage, whileActive } from './page';
import { googleOnDevice } from './google';

export { givenUpIn, onlineOver, refusedIn } from './over';
export type { Online, OnlineParts } from './over';

/*
 * The phone's cloud: the twin of the web's (apps/web/src/online/index.ts). What the game gets of the cloud, what it is made of and how it is put
 * together, and the lists of lives the account is still to be told of, are shared with the app's web export (`over.ts`, the Next web's word for
 * word, which `index.test.ts` holds), kept here in the phone's store. The rest is the phone's own: its session in its store, renewed only while the
 * app is in front, and its errors (`errors.ts`).
 */

/**
 * The cloud, with its session renewed only while the app is in front: the one client the account last connected (a start that ended offline
 * connects anew the next time), every one before it stopped, so two never renew the same session. And signing out takes away every key of the
 * session from the phone, not only those the client knows of. `stop` stops the renewal and the listening to the app (the app never does: it lasts
 * as long as the app).
 */
export function onThePhone(): { connected(cloud: Cloud): Cloud; cloud(): Cloud | null; stop(): void } {
  let current: Cloud | null = null;
  let active = false;
  const renew = (cloud: Cloud | null, on: boolean) => void cloud?.autoRefresh?.(on).catch(() => undefined);
  const stopListening = whileActive((now) => {
    active = now;
    renew(current, now);
  });
  return {
    connected(cloud) {
      renew(current, false);
      current = {
        ...cloud,
        signOut: async () => {
          await cloud.signOut();
          // Signed out all the same: a key the phone could not take away now is one the next guest's session writes over.
          await kvSession.clear().catch(() => undefined);
        },
      };
      renew(current, active);
      return current;
    },
    cloud: () => current,
    stop() {
      stopListening();
      renew(current, false);
      current = null;
    },
  };
}

/** The phone's one renewal of the session, made with the first cloud: whichever start connects, every client before it is stopped. */
let thePhone: ReturnType<typeof onThePhone> | null = null;
/**
 * The client the account connected last, signed in or not, or null before one has (and in a build with no project): what the game counts of how it
 * is played is sent through it (`track.ts`), which a guest who never signed in may do.
 */
export const phonesCloud = (): Cloud | null => thePhone?.cloud() ?? null;

/** How to stop watching the phone's errors: they are watched once, for the cloud made last. */
let stopWatching: (() => void) | null = null;

/**
 * For a test (and `testing/*`) only, which the wall holds (architecture.test.ts): stops the phone's renewal and its watch, and the next cloud made
 * starts them anew, as a new start of the app would.
 */
export function forgetThePhone(): void {
  thePhone?.stop();
  thePhone = null;
  stopWatching?.();
  stopWatching = null;
}

/**
 * The cloud of this phone, around the phone's store, made once for each start of the app (the game's context holds it, `shared`), whoever signs in
 * or out. With no Supabase project in the build's settings there is none: the store is the phone's
 * own, and the game is exactly what it is without a network (phase 2's game). With `livesAfter`, the account's lives in progress are handed to the
 * mirror only once it resolves (the game's first screen drawn, `held.ts`): the account still signs in at once, and its finished lives and lives in
 * progress are asked at once; the rest of the mirror's reading follows the held answer.
 */
export function phoneOnline(device: PlayerStore, livesAfter?: () => Promise<void>): Online {
  // Named in full, because the build writes these values into the app only where it sees them so (Expo's `EXPO_PUBLIC_*`).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return offline(device);
  // Where the database is. Named, the functions that use it most are asked for there. Named in full, as the two above.
  const region = process.env.EXPO_PUBLIC_SUPABASE_REGION || undefined;
  // The guard at the door of guest sign-in, where the project has one (`captcha.tsx`): with no site key, none is asked for, as on the web.
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || undefined;
  const captcha = siteKey ? phoneTurnstile(siteKey) : undefined;
  const phone = (thePhone ??= onThePhone());
  const online = onlineOver(device, {
    // The session in the phone's store, and renewed only while the app is in front (`onThePhone`), never by a timer of the client's own.
    connect: async () => {
      const cloud = await connectSupabase(url, key, { region, storage: kvSession, autoRefresh: false, captcha });
      return phone.connected(livesAfter ? heldSaves(cloud, livesAfter) : cloud);
    },
    // A phone has no address: Google's answer comes back with the browser that was opened for it (`browser.ts`), and there is nothing to clean;
    // or, where the build names its Google clients, the phone's own chooser answers with no browser at all (`google.ts`).
    address: () => null,
    clean: () => undefined,
    google: googleOnDevice(),
    page: phonePage,
    remember: givenUpIn(() => kvText),
    keepRefused: refusedIn(() => kvText),
    newId: () => crypto.randomUUID(),
    // The account's lives in progress played back one at a time, the JS thread free between them (held.ts).
    pace: pacedLives,
  });
  // Out of a release build, an error is the developer's to read, not to send. A phone that cannot be watched plays on all the same.
  if (process.env.NODE_ENV === 'production') {
    try {
      stopWatching?.();
      stopWatching = null;
      stopWatching = watchErrors(online, phoneErrors());
    } catch {
      // Nothing is watched: the game is what it is without it.
    }
  }
  return online;
}
