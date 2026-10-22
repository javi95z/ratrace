// Sending notices to the browsers and the phones that asked for them, from any function. Deno only:
// the tests of the game do not reach it. What each is sent, and how, is worked out in
// `_shared/notice.ts` and `_shared/push.ts`, where they do.
//
// Browsers need the VAPID keys of the game as secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and
// VAPID_SUBJECT, a mailto: or https: address push services can reach the game at. Phones are told
// through Expo's push service, which needs no key; EXPO_ACCESS_TOKEN is sent where it is set, for a
// project that asks for one.
import webpush from 'npm:web-push@3.6.7';
import { byPlayer, deliverExpo as sendExpo, deliverTo, isApp } from '../_shared/push.ts';
import type { AppDevice, Device, Senders, Urgency } from '../_shared/push.ts';
import type { Notice, NoticeAbout } from '../_shared/notice.ts';

export { byPlayer };

/** A browser or a phone that asked for notices, and whose it is. */
export type Subscription = Device;

/** The database client of the function: its own types are too deep to restate here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

let keyed: boolean | null = null;

/** Sets the game's keys once. False where they are missing: then nothing is sent to browsers. */
export function vapid(): boolean {
  if (keyed !== null) return keyed;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  keyed = Boolean(publicKey && privateKey && subject);
  if (keyed) webpush.setVapidDetails(subject as string, publicKey as string, privateKey as string);
  return keyed;
}

/** What sends, and what forgets a device that is gone, for a function's database. */
function sendersOf(db: Db): Senders {
  return {
    web: vapid() ? (subscription, payload, options) => webpush.sendNotification(subscription, payload, options) : null,
    post: (url, init) => fetch(url, init),
    expoToken: Deno.env.get('EXPO_ACCESS_TOKEN') || undefined,
    forget: async (row) => {
      if (isApp(row)) await db.from('push_tokens').delete().eq('token', row.token);
      else await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
    },
  };
}

/**
 * Sends each browser and phone its notice. A browser the push service says is gone, or a phone
 * Expo says is no longer registered, is forgotten. `ttl` is how long a notice may wait for a device
 * that is off, in seconds: after that it is no news.
 */
export function deliver<T extends Device>(db: Db, rows: readonly T[], aboutOf: (row: T) => NoticeAbout, ttl: number, urgency: Urgency = 'normal'): Promise<{ sent: number; removed: number }> {
  return deliverTo(rows, aboutOf, ttl, urgency, sendersOf(db));
}

/** Sends phones alone their notice, through Expo's push service, a hundred at a time. */
export function deliverExpo<T extends AppDevice>(db: Db, tokens: readonly T[], message: (row: T) => Notice, ttl: number, urgency: Urgency = 'normal'): Promise<{ sent: number; removed: number }> {
  return sendExpo(tokens, message, ttl, urgency, sendersOf(db));
}

/**
 * The browsers and phones of some players. A phone that cannot be read leaves the browsers to be
 * told as they always were.
 */
export async function subscriptionsOf(db: Db, userIds: readonly string[]): Promise<Subscription[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, locale, user_id').in('user_id', userIds);
  if (error) throw new Error(error.message);
  const phones = await db.from('push_tokens').select('token, locale, user_id').in('user_id', userIds);
  if (phones.error) console.error('phones not read:', phones.error.message);
  return [...((data ?? []) as Subscription[]), ...((phones.error ? [] : (phones.data ?? [])) as Subscription[])];
}

/**
 * Takes a player's one notice of the day, if it is still there. Notices that are not urgent ask
 * first, so that nobody is told more than once a day, on all their browsers and phones together.
 * A player with no browser and no phone is never asked.
 */
export async function claimDay(db: Db, userId: string, now: Date): Promise<boolean> {
  const { data, error } = await db.rpc('notice_claim', { p_user: userId, p_day: now.toISOString().slice(0, 10) });
  if (error) throw new Error(error.message);
  return data === true;
}
