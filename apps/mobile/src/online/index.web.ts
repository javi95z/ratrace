import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RankedApi } from '@ratrace/core/session/ranked';
import type { RoomsLink } from '@ratrace/core/session/room';
import type { PlayerStore } from '@ratrace/core/session/types';
import { connectSupabase } from '@ratrace/online/connect';
import type { ErrorReport, Sent } from '@ratrace/online/errors';
import { follow } from '@ratrace/online/follow';
import type { Page } from '@ratrace/online/follow';
import { MirroredStore } from '@ratrace/online/mirror';
import { offlineAccount } from '@ratrace/online/offline';
import { SupabaseAccount } from '@ratrace/online/supabase';
import type { Cloud } from '@ratrace/online/supabase';
import type { Account, AccountSaves, Community } from '@ratrace/online/types';
// The store's web twin, as Metro picks it for the web (and the wall sees who wires the store: architecture.test.ts).
import { kvText } from '../kvStore';
import type { KeptText } from '../kvStore';
import { phoneTurnstile } from './captcha.web';
import { phoneErrors, watchErrors } from './errors.web';
import { heldSaves, pacedLives } from './held';
import { phonePage } from './page.web';

/*
 * The web export's twin of `index.ts` (Metro picks it for the web): the cloud of the browser, made as the Next web makes it
 * (apps/web/src/online/index.ts, `browserOnline`), so that a player signed in there, a guest or with Google, is the same player here after the swap.
 * What the game gets of the cloud, what it is made of and how it is put together are the phone's word for word (index.web.test.ts holds them so); what
 * is the browser's is the Next web's: the client made with no storage of the app's (supabase-js keeps the session in the browser's own storage under
 * its own key, `sb-<ref>-auth-token`) and renewing it by itself, the page's whole address read for Google's answer and cleaned with the history, the
 * lists of lives kept under the Next web's keys (the store's `kvText`), and the window's errors watched in production.
 */

/** What the game gets of the cloud: who is playing, the store to write to, and how the account's copy stands. */
export interface Online {
  account: Account;
  /** The device's store, with the account behind it where there is one. */
  store: PlayerStore;
  /** Null where there is no account to save to. */
  saves: AccountSaves | null;
  /** The server of ranked lives while someone is signed in, and null otherwise. */
  ranked(): RankedApi | null;
  /** The rooms while someone is signed in, and null otherwise. */
  rooms(): RoomsLink | null;
  /** The other players, while someone is signed in, and null otherwise. */
  community(): Community | null;
  /** Sends the errors a page met, as whoever is signed in: 'later' while nobody is. */
  reportErrors(reports: ErrorReport[]): Promise<Sent>;
}

/** What the cloud is made of. The browser's own in the game; a test hands in stand-ins for the network and the page. */
export interface OnlineParts {
  /** Loads the client and connects. */
  connect(): Promise<Cloud>;
  /** Where the page is, and how to replace that once a notice has been read from it. */
  address(): string | null;
  clean(address: string): void;
  page: Page;
  /** Where the lives given up are noted until the account has been told. */
  remember: { read(): string[]; write(ids: string[]): void };
  /** Where the finished lives the server would not take are noted, so they are not sent again. */
  keepRefused?: { read(): string[]; write(ids: string[]): void };
  schedule?(run: () => Promise<void>, ms: number): void;
  /** Makes an id for a life the account will not take under its own. */
  newId(): string;
  /** Awaited before each life in progress the account offers is played back (the mirror's `pace`). */
  pace?(): Promise<void>;
}

/**
 * The player's account around the store of a device: who is playing, the store with the account
 * as its mirror, and the follower that has the account read when it may have changed. It lasts as
 * long as the page does.
 */
export function onlineOver(device: PlayerStore, parts: OnlineParts): Online {
  const account = new SupabaseAccount(parts.connect, parts.address, parts.clean);
  const mirror = new MirroredStore(device, account.cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, remember: parts.remember, keepRefused: parts.keepRefused, schedule: parts.schedule, newId: parts.newId, pace: parts.pace });
  follow(account, mirror, parts.page);
  return {
    account,
    store: mirror,
    saves: mirror,
    ranked: () => account.cloud()?.ranked ?? null,
    rooms: () => account.cloud()?.rooms ?? null,
    community: () => account.cloud()?.community ?? null,
    reportErrors: async (reports) => account.cloud()?.reportErrors(reports) ?? 'later',
  };
}

/**
 * A list of ids a browser keeps under one key. A browser that keeps nothing forgets them with the
 * page, and the game plays on: what was to be noted is then only said again, or sent again.
 */
function idsIn(storage: () => KeptText, key: string): { read(): string[]; write(ids: string[]): void } {
  return {
    read() {
      try {
        const noted: unknown = JSON.parse(storage().getItem(key) ?? '[]');
        return Array.isArray(noted) ? noted.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    write(ids) {
      try {
        storage().setItem(key, JSON.stringify(ids));
      } catch {
        // Nothing to do: see above.
      }
    },
  };
}

/** Where the lives given up are noted in a browser, until the account has been told. */
export const givenUpIn = (storage: () => KeptText) => idsIn(storage, 'ratrace:given-up');
/** Where the finished lives the server would not take are noted in a browser, so that no page sends them again. */
export const refusedIn = (storage: () => KeptText) => idsIn(storage, 'ratrace:refused');

/** What the web answers where there is no project to reach: no account, the device's store, nothing to send. The Next web's, word for word. */
const offline = (device: PlayerStore): Online => ({ account: offlineAccount, store: device, saves: null, ranked: () => null, rooms: () => null, community: () => null, reportErrors: async () => 'never' });

/**
 * The client the account connected last. The browser's client renews its session by itself, as the Next web's does (the page in front or not is its
 * own business), and signing out is the client's own, so there is nothing to add to it: it is only remembered, for what the game counts (`track.ts`).
 * `stop` forgets it.
 */
export function onThePhone(): { connected(cloud: Cloud): Cloud; cloud(): Cloud | null; stop(): void } {
  let current: Cloud | null = null;
  return {
    connected(cloud) {
      current = cloud;
      return cloud;
    },
    cloud: () => current,
    stop() {
      current = null;
    },
  };
}

/** The page's one record of its client, made with the first cloud. */
let thePhone: ReturnType<typeof onThePhone> | null = null;
/**
 * The client the account connected last, signed in or not, or null before one has (and in a build with no project): what the game counts of how it
 * is played is sent through it (`track.ts`).
 */
export const phonesCloud = (): Cloud | null => thePhone?.cloud() ?? null;

/** How to stop watching the page's errors: they are watched once, for the cloud made last. */
let stopWatching: (() => void) | null = null;

/**
 * For a test (and `testing/*`) only, which the wall holds (architecture.test.ts): forgets the client and stops the watch, and the next cloud made
 * starts them anew, as a new load of the page would.
 */
export function forgetThePhone(): void {
  thePhone?.stop();
  thePhone = null;
  stopWatching?.();
  stopWatching = null;
}

/**
 * The cloud of this browser, around the device's store, made once for each load of the page (the game's context holds it, `shared`). With no Supabase
 * project in the build's settings there is none: the store is the device's own, and the game is exactly what it is without a network. With
 * `livesAfter`, the account's lives in progress are handed to the mirror only once it resolves (the game's first screen drawn, `held.ts`), as on the
 * phone.
 */
export function phoneOnline(device: PlayerStore, livesAfter?: () => Promise<void>): Online {
  // Named in full, because the build writes these values into the page only where it sees them so (Expo's `EXPO_PUBLIC_*`).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return offline(device);
  // Where the database is. Named, the functions that use it most are asked for there. Named in full, as the two above.
  const region = process.env.EXPO_PUBLIC_SUPABASE_REGION || undefined;
  // The site key of the guard at the door of guest sign-in. Named, a guest is made only with its word; left out, there is no guard.
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || undefined;
  const captcha = siteKey ? phoneTurnstile(siteKey) : undefined;
  const page = (thePhone ??= onThePhone());
  const online = onlineOver(device, {
    // The Next web's client: no storage named (the session is supabase-js's own, in the browser's storage), renewed by itself, the code read from the address.
    connect: async () => {
      const cloud = await connectSupabase(url, key, { region, captcha });
      return page.connected(livesAfter ? heldSaves(cloud, livesAfter) : cloud);
    },
    // The page's whole address, as the Next web reads it: Google's answer may come after the hash as well as in the query.
    address: () => window.location.href,
    clean: (address) => window.history.replaceState(window.history.state, '', address),
    page: phonePage,
    remember: givenUpIn(() => kvText),
    keepRefused: refusedIn(() => kvText),
    newId: () => crypto.randomUUID(),
    // The account's lives in progress played back one at a time, the page free between them (held.ts).
    pace: pacedLives,
  });
  // Out of production, an error is the developer's to read in the console, not to send. A page that will not be watched plays on all the same.
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
