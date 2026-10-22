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
  /** `fetch`, for Expo's push service. `signal` aborts a request Expo has not answered in time. */
  post: (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Answer>;
  /** The game's access token for Expo's push service, where it has one. */
  expoToken?: string;
  /** Forgets a browser or a phone that can no longer be told. */
  forget: (row: Device) => Promise<void>;
  /** Where what went wrong with Expo is written, for the function's logs. Never handed a token. */
  log?: (line: string) => void;
  /** What this run of the function has learned of Expo, shared by every send of the run. */
  run?: ExpoRun;
}

/**
 * What one run of a function has learned of Expo. Once Expo has kept a batch waiting past
 * `EXPO_PATIENCE`, or could not be reached at all, it is not asked again in that run: the players
 * after are told on their browsers alone, and a lasting outage costs the run its patience once, not
 * once a player. An answer that came, even a refusal, leaves Expo to be asked.
 */
export interface ExpoRun {
  /** Why Expo is left alone for the rest of the run (`timeout` or `unreachable`), or null while it is asked. */
  down: string | null;
  /** How many phones were not sent their notice because of it. */
  skipped: number;
}

/** A run of a function that has not met Expo yet. */
export const expoRun = (): ExpoRun => ({ down: null, skipped: 0 });

/** The troubles that say Expo is down, rather than that it answered no. */
const OUTAGE = new Set(['timeout', 'unreachable']);

/** Expo's push service, and how many messages it takes at once. */
export const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
export const EXPO_BATCH = 100;
/** How long Expo has to answer a batch, in milliseconds: a service that hangs must not hold back the players after. */
export const EXPO_PATIENCE = 10_000;

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

/** A batch's answer from Expo, or why there is none, read within `EXPO_PATIENCE`. */
async function askExpo(senders: Pick<Senders, 'post'>, init: { method: 'POST'; headers: Record<string, string>; body: string }): Promise<{ tickets: unknown[] } | { trouble: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<{ trouble: string }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ trouble: 'timeout' });
    }, EXPO_PATIENCE);
  });
  const asked = (async (): Promise<{ tickets: unknown[] } | { trouble: string }> => {
    try {
      const answer = await senders.post(EXPO_SEND, { ...init, signal: controller.signal });
      if (!answer.ok) return { trouble: `http ${answer.status}${await requestError(answer)}` };
      const tickets = ((await answer.json()) as { data?: unknown } | null)?.data;
      return Array.isArray(tickets) ? { tickets } : { trouble: 'unreadable' };
    } catch {
      return { trouble: controller.signal.aborted ? 'timeout' : 'unreachable' };
    }
  })();
  try {
    return await Promise.race([asked, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The code of the error Expo refused a whole request with, after a space, such as
 * ` PUSH_TOO_MANY_EXPERIENCE_IDS`: never its message or details, which name the tokens. Empty when
 * there is none to read.
 */
async function requestError(answer: Answer): Promise<string> {
  try {
    const code = ((await answer.json()) as { errors?: Array<{ code?: unknown }> } | null)?.errors?.[0]?.code;
    return typeof code === 'string' && /^[A-Z_]{1,60}$/.test(code) ? ` ${code}` : '';
  } catch {
    return '';
  }
}

/** The error code of a ticket or a receipt of Expo's: never its message, which may name the token. */
const errorCode = (ticket: unknown): string => {
  const code = (ticket as { details?: { error?: unknown } } | null)?.details?.error;
  return typeof code === 'string' && /^[A-Za-z]{1,40}$/.test(code) ? code : 'unknown';
};

/**
 * Sends each phone its notice through Expo's push service: each player's phones in their own
 * batches, a hundred at a time, since Expo refuses a whole request whose tokens are of more than one
 * project, and a player's token of another build must silence only them. A phone Expo says is no
 * longer registered is forgotten, as a browser the push service says is gone. Nothing is forgotten
 * when Expo cannot be reached, fails as a whole, or takes longer than `EXPO_PATIENCE`; after the
 * first and the last, Expo is not asked again in the run (`ExpoRun`). Batches Expo did not take,
 * and tickets refused for another reason than a phone gone (wrong credentials for Apple's or
 * Google's service, too many messages), are counted in one line of the log, by their codes alone.
 */
export async function deliverExpo<T extends AppDevice>(tokens: readonly T[], message: (row: T) => Notice, ttl: number, urgency: Urgency, senders: Pick<Senders, 'post' | 'expoToken' | 'forget' | 'log' | 'run'>): Promise<{ sent: number; removed: number }> {
  const run = senders.run;
  if (run?.down) {
    run.skipped += tokens.length;
    return { sent: 0, removed: 0 };
  }
  let sent = 0;
  let removed = 0;
  let tripped = false;
  const failedBatches = new Map<string, number>();
  const refused = new Map<string, number>();
  const count = (into: Map<string, number>, key: string) => into.set(key, (into.get(key) ?? 0) + 1);
  const headers: Record<string, string> = { accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' };
  if (senders.expoToken) headers.authorization = `Bearer ${senders.expoToken}`;
  const batches: T[][] = [];
  for (const own of byPlayer(tokens).values()) {
    for (let at = 0; at < own.length; at += EXPO_BATCH) batches.push(own.slice(at, at + EXPO_BATCH));
  }
  await Promise.all(
    batches.map(async (batch) => {
      const answer = await askExpo(senders, { method: 'POST', headers, body: JSON.stringify(batch.map((row) => expoMessage(row.token, message(row), ttl, urgency))) });
      if ('trouble' in answer) {
        count(failedBatches, answer.trouble);
        if (run && run.down === null && OUTAGE.has(answer.trouble)) {
          run.down = answer.trouble;
          tripped = true;
        }
        return;
      }
      // Expo answers a ticket for each message, in the order they were sent.
      await Promise.all(
        batch.map(async (row, i) => {
          const ticket = answer.tickets[i] as { status?: unknown } | undefined;
          if (ticket?.status === 'ok') sent += 1;
          else if (unregistered(ticket)) {
            try {
              await senders.forget(row);
              removed += 1;
            } catch {
              count(refused, 'not-forgotten');
            }
          } else count(refused, errorCode(ticket));
        }),
      );
    }),
  );
  if (failedBatches.size + refused.size > 0) {
    const listed = (counts: Map<string, number>) => [...counts].map(([code, n]) => `${code} ×${n}`).join(', ');
    senders.log?.(`expo push: ${batches.length} batches, failed: ${listed(failedBatches) || 'none'}; tickets refused: ${listed(refused) || 'none'}${tripped ? '; Expo is not asked again in this run' : ''}`);
  }
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

/** What became of one player in a run of the clock: told (`sent` may be 0, if every device failed), or why not. */
export type Told = { told: true; sent: number; removed: number } | { told: false; why: 'had-today' | 'unreached' };

/**
 * Tells one player a notice of the clock on all their browsers and phones, after taking their
 * notice of the day with `claim`. Their day is not taken when nothing of theirs can be told in this
 * run: no browser (or no keys for browsers), and Expo left alone after it failed the run. A player
 * with a phone alone keeps their day through an outage, and can be told by a later run. The player
 * whose phone met the outage first did have their day taken: whether Expo sent it is not known, and
 * a notice twice in a day is worse than one missed.
 */
export async function tellPlayer<T extends Device>(rows: readonly T[], claim: () => Promise<boolean>, aboutOf: (row: T) => NoticeAbout, ttl: number, urgency: Urgency, senders: Senders): Promise<Told> {
  const browsers = senders.web === null ? 0 : rows.filter((row) => !isApp(row)).length;
  if (browsers === 0 && senders.run?.down) {
    senders.run.skipped += rows.filter((row) => isApp(row)).length;
    return { told: false, why: 'unreached' };
  }
  if (!(await claim())) return { told: false, why: 'had-today' };
  return { told: true, ...(await deliverTo(rows, aboutOf, ttl, urgency, senders)) };
}

/** Rows grouped by whose they are: a player's browsers and phones together. */
export function byPlayer<T extends { user_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(row.user_id, [...(out.get(row.user_id) ?? []), row]);
  return out;
}
