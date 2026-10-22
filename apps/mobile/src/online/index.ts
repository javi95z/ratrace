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
import { kvSession, kvText } from '../kvStore';
import type { KeptText } from '../kvStore';
import { phoneErrors, watchErrors } from './errors';
import { phonePage, whileActive } from './page';

/*
 * The phone's cloud: the twin of the web's (apps/web/src/online/index.ts). What the game gets of the cloud, what it is made of and how it is put
 * together (`Online`, `OnlineParts`, `onlineOver`) are the web's word for word, but that a phone has no address to read Google's answer from; and
 * so are the lists of lives the account is still to be told of (`givenUpIn`, `refusedIn`), kept in the phone's store. `index.test.ts` holds them
 * to the web's. The rest is the phone's own: its session in its store, renewed only while the app is in front, and its errors (`errors.ts`).
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
}

/**
 * The player's account around the store of a device: who is playing, the store with the account
 * as its mirror, and the follower that has the account read when it may have changed. It lasts as
 * long as the page does.
 */
export function onlineOver(device: PlayerStore, parts: OnlineParts): Online {
  const account = new SupabaseAccount(parts.connect, parts.address, parts.clean);
  const mirror = new MirroredStore(device, account.cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, remember: parts.remember, keepRefused: parts.keepRefused, schedule: parts.schedule, newId: parts.newId });
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

/** What the phone answers where there is no project to reach: no account, the device's store, nothing to send. The web's, word for word. */
const offline = (device: PlayerStore): Online => ({ account: offlineAccount, store: device, saves: null, ranked: () => null, rooms: () => null, community: () => null, reportErrors: async () => 'never' });

/**
 * The cloud, with its session renewed only while the app is in front: the one client the account last connected (a start that ended offline
 * connects anew the next time), every one before it stopped, so two never renew the same session. And signing out takes away every key of the
 * session from the phone, not only those the client knows of.
 */
export function onThePhone(): { connected(cloud: Cloud): Cloud } {
  let current: Cloud | null = null;
  let active = false;
  const renew = (cloud: Cloud | null, on: boolean) => void cloud?.autoRefresh?.(on).catch(() => undefined);
  whileActive((now) => {
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
          await kvSession.clear();
        },
      };
      renew(current, active);
      return current;
    },
  };
}

/**
 * The cloud of this phone, around the phone's store. With no Supabase project in the build's settings there is none: the store is the phone's
 * own, and the game is exactly what it is without a network (phase 2's game).
 */
export function phoneOnline(device: PlayerStore): Online {
  // Named in full, because the build writes these values into the app only where it sees them so (Expo's `EXPO_PUBLIC_*`).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return offline(device);
  // Where the database is. Named, the functions that use it most are asked for there. Named in full, as the two above.
  const region = process.env.EXPO_PUBLIC_SUPABASE_REGION || undefined;
  const phone = onThePhone();
  const online = onlineOver(device, {
    // The session in the phone's store, and renewed only while the app is in front (`onThePhone`), never by a timer of the client's own.
    connect: async () => phone.connected(await connectSupabase(url, key, { region, storage: kvSession, autoRefresh: false })),
    // A phone has no address: Google's answer comes back with the browser that was opened for it (`browser.ts`), and there is nothing to clean.
    address: () => null,
    clean: () => undefined,
    page: phonePage,
    remember: givenUpIn(() => kvText),
    keepRefused: refusedIn(() => kvText),
    newId: () => crypto.randomUUID(),
  });
  // Out of a release build, an error is the developer's to read, not to send. A phone that cannot be watched plays on all the same.
  if (process.env.NODE_ENV === 'production') {
    try {
      watchErrors(online, phoneErrors());
    } catch {
      // Nothing is watched: the game is what it is without it.
    }
  }
  return online;
}
