import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { RankedApi } from '@ratrace/core/session/ranked';
import type { RoomsLink } from '@ratrace/core/session/room';
import type { PlayerStore } from '@ratrace/core/session/types';
import { turnstile } from './captcha';
import { connectSupabase } from './connect';
import { browserOf, buildOf, errorWatch, watchPage } from './errors';
import type { ErrorReport, Sent } from './errors';
import { follow } from './follow';
import type { Page } from './follow';
import { MirroredStore } from './mirror';
import { offlineAccount } from './offline';
import { SupabaseAccount } from './supabase';
import type { Cloud } from './supabase';
import type { Account, AccountSaves, Community } from './types';

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
  address(): string;
  clean(address: string): void;
  page: Page;
  /** Where the lives given up are noted until the account has been told. */
  remember: { read(): string[]; write(ids: string[]): void };
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
  const mirror = new MirroredStore(device, account.cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, remember: parts.remember, schedule: parts.schedule, newId: parts.newId });
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
 * Watches what goes wrong on this page and sends it, cleaned, as whoever is signed in: at once if
 * someone is, and as soon as someone is if nobody is yet. See `docs/errors.md`. Returns how to stop.
 */
export function watchErrors(online: Pick<Online, 'account' | 'reportErrors'>, page: EventTarget, log: { error(...args: unknown[]): void }, schedule: (run: () => void, ms: number) => void): () => void {
  const watch = errorWatch({
    send: online.reportErrors,
    place: () => window.location.pathname,
    // Named in full, as the project's values below: the build writes it into the page only where it sees it so.
    build: buildOf(ENGINE_VERSION, CONTENT_VERSION, process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA),
    browser: browserOf(navigator.userAgent),
    schedule,
  });
  const stopHearing = watchPage(watch, page, log);
  const stopFollowing = online.account.subscribe(() => void watch.flush());
  return () => {
    stopHearing();
    stopFollowing();
  };
}

/**
 * Where the lives given up are noted in a browser, until the account has been told: a list of ids
 * under one key. A browser that keeps nothing forgets them with the page, and the game plays on.
 */
const GIVEN_UP = 'ratrace:given-up';
export function givenUpIn(storage: () => Storage): { read(): string[]; write(ids: string[]): void } {
  return {
    read() {
      try {
        const noted: unknown = JSON.parse(storage().getItem(GIVEN_UP) ?? '[]');
        return Array.isArray(noted) ? noted.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    write(ids) {
      try {
        storage().setItem(GIVEN_UP, JSON.stringify(ids));
      } catch {
        // Nothing to do: the life is given up in the account if the page lives long enough to say so.
      }
    },
  };
}

/** What the browser tells of the page. */
export const browserPage: Page = {
  onOnline: (listener) => {
    window.addEventListener('online', listener);
    return () => window.removeEventListener('online', listener);
  },
  onShown: (listener) => {
    const shown = () => {
      if (document.visibilityState === 'visible') listener();
    };
    document.addEventListener('visibilitychange', shown);
    return () => document.removeEventListener('visibilitychange', shown);
  },
  now: () => Date.now(),
};

/**
 * The cloud of this browser, around the store of this device. With no Supabase project in the
 * build's settings there is none: the store is the device's own, and the game is exactly what it
 * is without a network.
 */
export function browserOnline(device: PlayerStore): Online {
  // Named in full, because the build writes these two values into the page only where it sees them so.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === 'undefined') return { account: offlineAccount, store: device, saves: null, ranked: () => null, rooms: () => null, community: () => null, reportErrors: async () => 'never' };
  // Where the database is. Named, the functions that use it most are asked for there. Named in full, as the two above.
  const region = process.env.NEXT_PUBLIC_SUPABASE_REGION || undefined;
  // The site key of the guard at the door of guest sign-in. Named, a guest is made only with its word; left out, there is no guard.
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;
  const online = onlineOver(device, {
    connect: () => connectSupabase(url, key, { region, captcha: siteKey ? turnstile(siteKey) : undefined }),
    address: () => window.location.href,
    clean: (address) => window.history.replaceState(window.history.state, '', address),
    page: browserPage,
    remember: givenUpIn(() => window.localStorage),
    newId: () => crypto.randomUUID(),
  });
  // Out of production, an error is the developer's to read in the console, not to send. It lasts as long as the page,
  // and a page that will not be watched (its log cannot be written to) plays on all the same.
  if (process.env.NODE_ENV === 'production') {
    try {
      watchErrors(online, window, console, (run, ms) => void window.setTimeout(run, ms));
    } catch {
      // Nothing is watched: the game is what it is without it.
    }
  }
  return online;
}
