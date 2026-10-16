// Sending notices to the browsers that asked for them, from any function. Deno only: the tests of
// the game do not reach it, and what it sends is worked out in `_shared/notice.ts`, where they do.
//
// It needs the VAPID keys of the game as secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and
// VAPID_SUBJECT, a mailto: or https: address push services can reach the game at.
import webpush from 'npm:web-push@3.6.7';
import { gone } from '../_shared/notice.ts';
import type { Notice } from '../_shared/notice.ts';

/** A browser that asked for notices, and whose it is. */
export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  user_id: string;
}

/** The database client of the function: its own types are too deep to restate here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

let keyed: boolean | null = null;

/** Sets the game's keys once. False where they are missing: then nothing is sent. */
export function vapid(): boolean {
  if (keyed !== null) return keyed;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  keyed = Boolean(publicKey && privateKey && subject);
  if (keyed) webpush.setVapidDetails(subject as string, publicKey as string, privateKey as string);
  return keyed;
}

/**
 * Sends each browser its notice. A browser the push service says is gone is forgotten. `ttl` is how
 * long a notice may wait for a device that is off, in seconds: after that it is no news.
 */
export async function deliver(db: Db, rows: readonly Subscription[], noticeFor: (row: Subscription) => Notice, ttl: number, urgency: 'normal' | 'high' = 'normal'): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  if (!vapid()) return { sent, removed };
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(noticeFor(row)), { TTL: ttl, urgency });
        sent += 1;
      } catch (failure) {
        if (gone((failure as { statusCode?: number }).statusCode)) {
          await db.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
          removed += 1;
        }
      }
    }),
  );
  return { sent, removed };
}

/** The browsers of some players. */
export async function subscriptionsOf(db: Db, userIds: readonly string[]): Promise<Subscription[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth, locale, user_id').in('user_id', userIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as Subscription[];
}

/**
 * Takes a player's one notice of the day, if it is still there. Notices that are not urgent ask
 * first, so that nobody is told more than once a day. A player with no subscription is never asked.
 */
export async function claimDay(db: Db, userId: string, now: Date): Promise<boolean> {
  const { data, error } = await db.rpc('notice_claim', { p_user: userId, p_day: now.toISOString().slice(0, 10) });
  if (error) throw new Error(error.message);
  return data === true;
}

/** Rows grouped by whose they are. */
export function byPlayer<T extends { user_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(row.user_id, [...(out.get(row.user_id) ?? []), row]);
  return out;
}
