import type { Reply } from './replay.ts';

/**
 * The events the game counts, each with the props it may carry and every value each may take: the
 * eight the web counts (`apps/web/src/pwa/events.ts`, held to these by a test), and nothing more.
 * None says who: no id, no name, no score. The database holds the same list (`app_event_known`).
 */
const MODES = ['solo', 'ranked', 'challenge', 'practice'] as const;
export const EVENTS = {
  life_start: { mode: MODES },
  life_end: { mode: MODES, escaped: [true, false] },
  challenge_attempt: {},
  game_start: { kind: ['friends', 'public'] },
  game_join: { via: ['code', 'link', 'quick'] },
  account_kept: {},
  app_installed: {},
  share: { what: ['card', 'invite'] },
} as const satisfies Record<string, Record<string, readonly (string | boolean)[]>>;

/** Where the game runs. */
export const PLATFORMS = ['ios', 'android', 'web'] as const;

export type EventName = keyof typeof EVENTS;
export type Platform = (typeof PLATFORMS)[number];
type PropsOf<N extends EventName> = { -readonly [K in keyof (typeof EVENTS)[N]]: (typeof EVENTS)[N][K] extends readonly (infer V)[] ? V : never };
/** An event as the web types it: its name and its props, side by side. */
export type Counted = { [N in EventName]: { name: N } & PropsOf<N> }[EventName];

/** An event as it is kept: what happened, with what, where. */
export interface KeptEvent {
  name: EventName;
  props: Record<string, string | boolean>;
  platform: Platform;
}

/** The largest body an event may come in. The largest event is under a hundred characters. */
export const MAX_EVENT_BODY = 512;

/** What counting an event needs of the world. The function hands in the real thing; a test, its own. */
export interface EventsDeps {
  /** Counts this call for this caller. False if it is one too many. */
  allow(who: string): Promise<boolean>;
  /** Counts the event, today. */
  count(event: KeptEvent): Promise<void>;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const has = (x: object, key: string): boolean => Object.prototype.hasOwnProperty.call(x, key);
const BODY_KEYS = ['name', 'props', 'platform'];

/**
 * The event a body is, or the field that makes it none. Anything not known is refused: a key the
 * body or the props should not have, a prop missing, a value a prop may not take. The props kept
 * are built afresh from the known ones, never the object that was sent.
 */
export function readEvent(raw: unknown): KeptEvent | { field: string } {
  if (!isRecord(raw) || Object.keys(raw).some((key) => !BODY_KEYS.includes(key))) return { field: 'body' };
  const { name, props, platform } = raw;
  if (typeof name !== 'string' || !has(EVENTS, name)) return { field: 'name' };
  if (typeof platform !== 'string' || !(PLATFORMS as readonly string[]).includes(platform)) return { field: 'platform' };
  const sent = props === undefined ? {} : props;
  if (!isRecord(sent)) return { field: 'props' };
  const allowed: Record<string, readonly (string | boolean)[]> = EVENTS[name as EventName];
  const keys = Object.keys(allowed);
  if (Object.keys(sent).length !== keys.length || Object.keys(sent).some((key) => !has(allowed, key))) return { field: 'props' };
  const kept: Record<string, string | boolean> = {};
  for (const key of keys) {
    const value = sent[key];
    if ((typeof value !== 'string' && typeof value !== 'boolean') || !allowed[key].includes(value)) return { field: 'props' };
    kept[key] = value;
  }
  return { name: name as EventName, props: kept, platform: platform as Platform };
}

/**
 * Counts one event a page or the app sent. It is read first, so a body that is not an event costs
 * the database nothing; then the caller is held to their limit; then it is counted.
 */
export async function trackEvent(deps: EventsDeps, who: string, raw: unknown): Promise<Reply> {
  const event = readEvent(raw);
  if ('field' in event) return { status: 400, body: { error: 'bad-request', field: event.field } };
  if (!(await deps.allow(who))) return { status: 429, body: { error: 'too-many' } };
  await deps.count(event);
  return { status: 204, body: {} };
}

/** The address a request came from, as the platform in front of the function saw it, or '' if none says. */
function addressOf(headers: Headers): string {
  const first = (headers.get('x-forwarded-for') ?? '').split(',')[0];
  return (headers.get('cf-connecting-ip') ?? headers.get('x-real-ip') ?? first).trim().slice(0, 100);
}

/**
 * Who a caller is, for their limit and nothing else: a hash of their address, the day (UTC) and a
 * secret of the server's, thirty-two hex characters of SHA-256. The address is never kept, and the
 * hash of one day says nothing of the next. Callers with no address are one caller.
 */
export async function callerOf(headers: Headers, secret: string, now: Date): Promise<string> {
  const bytes = new TextEncoder().encode([secret, now.toISOString().slice(0, 10), addressOf(headers)].join('\u0000'));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
