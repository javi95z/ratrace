// Who is sent a notice, and how: browsers through web push, as always, and phones with the app
// through Expo's push service. Kept apart from the Deno code that holds the keys and the database,
// `_deno/push.ts`, so that it is tested without a server: the senders are handed in.

import { gone, noticeOf } from './notice.ts';
import type { Notice, NoticeAbout } from './notice.ts';

/** A browser that asked for notices, and whose it is. A row of the clock's notices has `token` null. */
export interface WebDevice {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  user_id: string;
  token?: null;
}

/** A phone with the app that asked for notices, by the token Expo gave it, and whose it is. */
export interface AppDevice {
  token: string;
  locale: string | null;
  user_id: string;
  endpoint?: null;
}

/** Where a player can be told something. */
export type Device = WebDevice | AppDevice;

export type Urgency = 'normal' | 'high';

/** True for a phone, false for a browser. */
export const isApp = (row: Device): row is AppDevice => typeof row.token === 'string' && row.token.length > 0;

/** What an answer of `fetch` is, as far as the sender reads it. */
interface Answer {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** What a notice is sent through, and what forgets a device that is gone. */
export interface Senders {
  /** Web push, as `web-push` sends: a failure carries the push service's `statusCode`. Null where the game has no keys for it. */
  web: ((subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string, options: { TTL: number; urgency: Urgency }) => Promise<unknown>) | null;
  /** `fetch`, for Expo's push service. */
  post: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<Answer>;
  /** The game's access token for Expo's push service, where it has one. */
  expoToken?: string;
  /** Forgets a browser or a phone that can no longer be told. */
  forget: (row: Device) => Promise<void>;
}

/** Expo's push service, and how many messages it takes at once. */
export const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
export const EXPO_BATCH = 100;

/** A message to a phone, as Expo's push service takes it. The tap's link and the notice's kind travel in `data`. */
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string; tag: string };
  ttl: number;
  priority: 'default' | 'high';
  sound: 'default';
}

/** A notice as a message to a phone. `ttl` is how long it may wait for a phone that is off, in seconds. */
export const expoMessage = (token: string, notice: Notice, ttl: number, urgency: Urgency): ExpoMessage => ({
  to: token,
  title: notice.title,
  body: notice.body,
  data: { url: notice.url, tag: notice.tag },
  ttl,
  priority: urgency === 'high' ? 'high' : 'default',
  sound: 'default',
});

/** True where a ticket or a receipt of Expo's says the phone no longer has the app, or no longer lets it notify: the token is no use any more. */
export function unregistered(answer: unknown): boolean {
  const ticket = answer as { status?: unknown; details?: { error?: unknown } } | null;
  return ticket !== null && typeof ticket === 'object' && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';
}

/**
 * Sends each phone its notice through Expo's push service, a hundred at a time. A phone Expo says
 * is no longer registered is forgotten, as a browser the push service says is gone. Nothing is
 * forgotten when Expo cannot be reached or fails as a whole.
 */
export async function deliverExpo<T extends AppDevice>(tokens: readonly T[], message: (row: T) => Notice, ttl: number, urgency: Urgency, senders: Pick<Senders, 'post' | 'expoToken' | 'forget'>): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  const headers: Record<string, string> = { accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' };
  if (senders.expoToken) headers.authorization = `Bearer ${senders.expoToken}`;
  const batches: T[][] = [];
  for (let at = 0; at < tokens.length; at += EXPO_BATCH) batches.push(tokens.slice(at, at + EXPO_BATCH));
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const answer = await senders.post(EXPO_SEND, { method: 'POST', headers, body: JSON.stringify(batch.map((row) => expoMessage(row.token, message(row), ttl, urgency))) });
        if (!answer.ok) return;
        const tickets = ((await answer.json()) as { data?: unknown } | null)?.data;
        if (!Array.isArray(tickets)) return;
        // Expo answers a ticket for each message, in the order they were sent.
        await Promise.all(
          batch.map(async (row, i) => {
            const ticket = tickets[i] as { status?: unknown } | undefined;
            if (ticket?.status === 'ok') sent += 1;
            else if (unregistered(ticket)) {
              await senders.forget(row);
              removed += 1;
            }
          }),
        );
      } catch {
        // Expo could not be reached, or answered nothing readable: nobody is forgotten for it.
      }
    }),
  );
  return { sent, removed };
}

/**
 * Sends each browser and each phone its notice: a browser what it was always sent, through web
 * push, led to the page on the site; a phone the same words through Expo, led to the screen in the
 * app. A device that is gone is forgotten. `ttl` is how long a notice may wait for a device that is
 * off, in seconds: after that it is no news.
 */
export async function deliverTo<T extends Device>(rows: readonly T[], aboutOf: (row: T) => NoticeAbout, ttl: number, urgency: Urgency, senders: Senders): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  const phones = rows.filter((row) => isApp(row)) as Array<T & AppDevice>;
  const browsers = rows.filter((row) => !isApp(row)) as Array<T & WebDevice>;
  const web = senders.web;
  await Promise.all([
    ...(web === null
      ? []
      : browsers.map(async (row) => {
          try {
            await web({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(noticeOf(row.locale, aboutOf(row))), { TTL: ttl, urgency });
            sent += 1;
          } catch (failure) {
            if (gone((failure as { statusCode?: number }).statusCode)) {
              await senders.forget(row);
              removed += 1;
            }
          }
        })),
    phones.length === 0
      ? Promise.resolve()
      : deliverExpo(phones, (row) => noticeOf(row.locale, aboutOf(row), 'app'), ttl, urgency, senders).then((done) => {
          sent += done.sent;
          removed += done.removed;
        }),
  ]);
  return { sent, removed };
}

/** Rows grouped by whose they are: a player's browsers and phones together. */
export function byPlayer<T extends { user_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(row.user_id, [...(out.get(row.user_id) ?? []), row]);
  return out;
}
