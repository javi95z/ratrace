import type { Sent } from '@ratrace/online/errors';
import type { Cloud, TrackedEvent } from '@ratrace/online/supabase';
import type { Account } from '@ratrace/online/types';
import { Platform } from 'react-native';
import type { Counted, Track } from '../game/events';
import { phonesCloud } from './index';
import { phoneConnection } from './page';

/*
 * What the game counts of how it is played (`game/events.ts`, the web's eight), sent from the phone to the game's own project: the function `track`
 * (`supabase/functions/_shared/events.ts`), through the account's own client, so with the project's publishable key. As the web counts only in
 * production, the phone counts only in a release build. A count is never waited for by a screen, never kept for later (one made while the phone is
 * offline, or before the client has connected, is dropped), and says nothing of who: no id, no name, no score, which the function refuses anyway.
 */

/** A short text kept on the phone, read and written at once: the store's own (`kvText`), handed in by the game's context, which wires the store. */
export interface KeptText {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Where the phone may say it is: the platforms the function knows, but the web's. */
const PHONES = ['ios', 'android'];

/** What the sender needs of the world. The phone hands in its own (`phoneTrack`); a test, its stand-ins. */
export interface TrackParts {
  /** The client the account connected, or null before it has. */
  cloud(): Cloud | null;
  /** The phone's platform, as React Native names it. */
  platform: string;
  /** True in a release build only. */
  release: boolean;
  /** Whether the phone has a connection, as far as it knows. */
  connected(): boolean;
}

/** An event as the function takes it: the web's name and props, side by side with the phone's platform. */
const bodyOf = (event: Counted, platform: string): TrackedEvent => {
  const { name, ...props } = event;
  return { name, props, platform };
};

/** Sends one event, or drops it: what came of it, `dropped` when it was not sent at all. Never throws, and never rejects. */
async function send(parts: TrackParts, event: Counted): Promise<Sent | 'dropped'> {
  try {
    if (!parts.release || !PHONES.includes(parts.platform)) return 'dropped';
    const cloud = parts.cloud();
    if (cloud?.track === undefined || !parts.connected()) return 'dropped';
    return await cloud.track(bodyOf(event, parts.platform));
  } catch {
    // A count missed is a count missed.
    return 'later';
  }
}

/** Counts with the game's own project: each event sent as it happens, and never waited for. */
export function trackTo(parts: TrackParts): Track {
  return (event) => void send(parts, event);
}

/** Noted once the install has been counted on this phone (or tried, on its first launch): the next launches count nothing. */
const INSTALLED = 'ratrace:installed';

/**
 * The install of the app, counted on its first launch (in a release build): noted at once, so it is never counted on another launch, then sent once
 * the account's client has connected and the phone is online. Dropped if that launch never gets there, as any count made offline is. A phone that
 * keeps nothing counts nothing, rather than an install on every launch. Returns how to stop waiting.
 */
export function countInstalled(parts: TrackParts, account: Pick<Account, 'subscribe'>, noted: KeptText): () => void {
  if (!parts.release) return () => {};
  try {
    if (noted.getItem(INSTALLED) !== null) return () => {};
    noted.setItem(INSTALLED, '1');
  } catch {
    return () => {};
  }
  let sending = false;
  let over = false;
  const stop = () => {
    over = true;
    stopListening?.();
  };
  // Tried as the account changes (it connects as the app starts, and again when the network comes back), until it has been sent once.
  const attempt = () => {
    if (sending || over) return;
    sending = true;
    void send(parts, { name: 'app_installed' }).then((came) => {
      sending = false;
      if (came !== 'dropped') stop();
    });
  };
  let stopListening: (() => void) | null = null;
  stopListening = account.subscribe(attempt);
  attempt();
  return stop;
}

/** True in a release build: `__DEV__` is written in as `false` there. A test, which has no `__DEV__`, is development. */
const isRelease = (): boolean => typeof __DEV__ !== 'undefined' && !__DEV__;

/**
 * The phone's sender: through the client the account connected last (`phonesCloud`), as the phone it is, in a release build only; and the install
 * counted on the first launch, noted in the phone's store (`noted`, which the game's context hands in). Made once for each start of the app (the
 * game's context holds it). A test may say the build and the platform.
 */
export function phoneTrack(account: Pick<Account, 'subscribe'>, noted: KeptText, { release = isRelease(), platform = Platform.OS as string }: { release?: boolean; platform?: string } = {}): Track {
  // Listened to for as long as the app lasts, so that what the phone knows of its connection is never stale when an event is sent.
  if (release) phoneConnection.subscribe(() => undefined);
  const parts: TrackParts = { cloud: phonesCloud, platform, release, connected: phoneConnection.connected };
  countInstalled(parts, account, noted);
  return trackTo(parts);
}
