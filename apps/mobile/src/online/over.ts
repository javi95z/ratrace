import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RankedApi } from '@ratrace/core/session/ranked';
import type { RoomsLink } from '@ratrace/core/session/room';
import type { PlayerStore } from '@ratrace/core/session/types';
import type { ErrorReport, Sent } from '@ratrace/online/errors';
import { follow } from '@ratrace/online/follow';
import type { Page } from '@ratrace/online/follow';
import { MirroredStore } from '@ratrace/online/mirror';
import { offlineAccount } from '@ratrace/online/offline';
import { SupabaseAccount } from '@ratrace/online/supabase';
import type { Cloud } from '@ratrace/online/supabase';
import type { Account, AccountSaves, Community } from '@ratrace/online/types';

/*
 * The app's cloud as the phone and the web export share it (`index.ts` and its twin `index.web.ts` re-export it): what the game gets of the cloud,
 * what it is made of and how it is put together (`Online`, `OnlineParts`, `onlineOver`), the Next web's word for word (apps/web/src/online/index.ts),
 * but that a phone has no address to read Google's answer from and plays the account's lives back at a pace; and the lists of lives the account is
 * still to be told of (`givenUpIn`, `refusedIn`), kept in the store each hands in. `index.test.ts` holds them to the Next web's. Nothing here connects
 * or names a store: each start's own file does.
 */

/** Short texts read and written at once, as a browser's storage reads and writes them: the store's `kvText`, on the phone or on the web. */
export interface KeptText {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

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

/** What the app answers where there is no project to reach: no account, the device's store, nothing to send. The Next web's, word for word. */
export const offline = (device: PlayerStore): Online => ({ account: offlineAccount, store: device, saves: null, ranked: () => null, rooms: () => null, community: () => null, reportErrors: async () => 'never' });
