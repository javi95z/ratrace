import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { PlayerStore } from '@/session/types';
import { connectSupabase } from './connect';
import { follow } from './follow';
import { MirroredStore } from './mirror';
import { offlineAccount } from './offline';
import { SupabaseAccount } from './supabase';
import type { Account, AccountSaves } from './types';

/** What the game gets of the cloud: who is playing, the store to write to, and how the account's copy stands. */
export interface Online {
  account: Account;
  /** The device's store, with the account behind it where there is one. */
  store: PlayerStore;
  /** Null where there is no account to save to. */
  saves: AccountSaves | null;
}

/** Where the lives given up are noted until the account has been told. A browser that keeps nothing forgets them with the page. */
const GIVEN_UP = 'ratrace:given-up';
const givenUp = {
  read(): string[] {
    try {
      const noted: unknown = JSON.parse(window.localStorage.getItem(GIVEN_UP) ?? '[]');
      return Array.isArray(noted) ? noted.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  },
  write(ids: string[]): void {
    try {
      window.localStorage.setItem(GIVEN_UP, JSON.stringify(ids));
    } catch {
      // Nothing to do: the life is given up in the account if the page lives long enough to say so.
    }
  },
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
  if (!url || !key || typeof window === 'undefined') return { account: offlineAccount, store: device, saves: null };

  const account = new SupabaseAccount(
    () => connectSupabase(url, key),
    () => window.location.href,
    (address) => window.history.replaceState(window.history.state, '', address),
  );
  const mirror = new MirroredStore(device, account.cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, remember: givenUp });
  // For as long as the page lives: there is nothing to stop.
  follow(account, mirror, {
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
  });
  return { account, store: mirror, saves: mirror };
}
