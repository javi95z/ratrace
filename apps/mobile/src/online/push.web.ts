import type { Account, Community, PushKeys, PushTarget } from '@ratrace/online/types';
import type { Page } from '../game/pages';

/*
 * The web export's twin of `push.ts` (Metro picks it for the web). The game's notices on the web are the browser's own push subscription (VAPID web
 * push, kept with the account in `push_subscriptions`), as the Next web takes it (`apps/web/src/pwa/notifications.ts` and its settings): asked of the
 * player and of the browser through the site's worker, whose `push` and `notificationclick` show the notice and open its page
 * (`scripts/serviceWorker.ts`), so a player who turned them on in the Next web keeps them. The browser keeps whether they are on (a subscription), so
 * the app's note is never read or written, and nothing follows the account or listens for a tap. Expo's library is never named, so none of it is in the
 * web's bundle. The types are the phone's, so the game's context is the same on both.
 */

/** What the switch came to: on, refused by the player (now or before), or not to be had here. */
export type PushOn = 'on' | 'refused' | 'unavailable';

/** What the app remembers of the notices: turned on, turned off, or refused by the player; and the token the account was last given. */
export interface PushNoted {
  state: 'on' | 'off' | 'refused';
  token: string | null;
}

/** Where the app keeps that, handed in by the game's context (`kvPush`). */
export interface PushNote {
  read(): PushNoted | null;
  write(noted: PushNoted): void;
}

/** A page a notice opens, and the query it opens it with (the phone's). */
export interface NoticePage {
  page: Page;
  query: Record<string, string>;
}

/** The browser, as the server knows it: its subscription's address (the phone's is its token). */
type Target = PushTarget;

/** The phone's `Push`, the same calls: see `push.ts`. */
export interface Push {
  available(): boolean;
  isOn(): Promise<boolean>;
  pushOn(): Promise<PushOn>;
  register(community: Community, locale: string): Promise<boolean>;
  pushOff(community: Community): Promise<boolean>;
  release(community: Community | null, patience?: number): Promise<void>;
  resume(): void;
  target(): Promise<Target | null>;
  follow(account: Account, community: () => Community | null, locale: string): () => void;
  onTap(open: (to: NoticePage) => void): () => void;
}

/**
 * The public half of the game's VAPID keys, which push services check a notice against: the Next web's `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Read where it
 * is used (the export puts the value in at build). Unset, there are no notices.
 */
const vapidKey = (): string => process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || '';

/** True where this browser can show a notice sent while the game is closed, and the game has keys to send one (the Next web's `canNotify`). */
const canNotify = (): boolean =>
  vapidKey() !== '' && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** The bytes of a key written in URL-safe base64, as the browser wants it. */
function keyBytes(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** A subscription in the three strings the server keeps. Null for one without its keys. */
function keysOf(subscription: Pick<PushSubscription, 'toJSON'>): PushKeys | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  return json.endpoint && p256dh && auth ? { endpoint: json.endpoint, p256dh, auth } : null;
}

/** The subscription this browser holds now, or null. */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (!canNotify()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Whatever it is, never raised: a failure is the answer given. */
async function quietly<T>(work: () => Promise<T>, failed: T): Promise<T> {
  try {
    return await work();
  } catch {
    return failed;
  }
}

/**
 * The game's notices in this browser. `note` is the phone's, which the browser has no use for: it holds the subscription itself. Called as the phone's.
 */
export const phonePush: (note: PushNote, options?: { platform?: string }) => Push = () => {
  /** The subscription the player's yes gave, until the account is told of it (`register`). */
  let keys: PushKeys | null = null;
  /** A question to the player under way: a second press waits for it, and asks nothing. */
  let asking: Promise<PushOn> | null = null;

  /**
   * Asks the player, then the browser, for a subscription (as the Next web's `subscribe`): `refused` where the player said no, now or before (only
   * the browser's settings undo it), `unavailable` where the browser fails or gives a subscription with no keys. Where the player only closed the
   * question it is neither (the browser asks again next time): nothing is held, `register` says so, and the switch stays off.
   */
  const ask = (): Promise<PushOn> =>
    quietly<PushOn>(async () => {
      if (!canNotify()) return 'unavailable';
      keys = null;
      const answer = await Notification.requestPermission();
      if (answer === 'denied') return 'refused';
      if (answer !== 'granted') return 'on';
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey()) as BufferSource }));
      keys = keysOf(subscription);
      return keys === null ? 'unavailable' : 'on';
    }, 'unavailable');

  return {
    available: canNotify,
    isOn: () => quietly(async () => (await currentSubscription()) !== null, false),
    pushOn: () => {
      asking ??= ask().finally(() => {
        asking = null;
      });
      return asking;
    },
    register: async (community, locale) => (keys === null ? false : community.notifyMe(keys, locale)),
    // The account forgets the address first: only once it has is the subscription given up, so a "no" from the server leaves them on, and the switch says so.
    pushOff: (community) =>
      quietly(async () => {
        const held = await currentSubscription();
        if (held === null) return true;
        if (!(await community.stopNotifying(held.endpoint))) return false;
        keys = null;
        await quietly(() => held.unsubscribe(), false);
        return true;
      }, false),
    // Signing out leaves the subscription with the browser, as the Next web does.
    release: async () => undefined,
    resume: () => undefined,
    target: () => quietly(async () => (await currentSubscription())?.endpoint ?? null, null),
    follow: () => () => undefined,
    // A tap is the worker's: it focuses the game's window or opens one at the notice's page.
    onTap: () => () => undefined,
  };
};
