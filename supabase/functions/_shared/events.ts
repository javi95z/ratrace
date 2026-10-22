import { json, readJson } from './http.ts';
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

/**
 * What counting an event needs of the world. The function hands in the real thing; a test, its own.
 * It is handed the event and nothing else: nothing of who sent it reaches the database.
 */
export interface EventsDeps {
  /** Counts the event, today. False, counting nothing, once the day's ceiling of that event on that platform is reached. */
  count(event: KeptEvent): Promise<boolean>;
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
 * the database nothing; then it is counted, unless the day's counts of it are at their ceiling.
 */
export async function trackEvent(deps: EventsDeps, raw: unknown): Promise<Reply> {
  const event = readEvent(raw);
  if ('field' in event) return { status: 400, body: { error: 'bad-request', field: event.field } };
  if (!(await deps.count(event))) return { status: 429, body: { error: 'too-many' } };
  return { status: 204, body: {} };
}

/**
 * The whole answer to a call of `track`, from the request. A call with no `apikey` is refused before
 * anything is read. That key is the project's publishable key, which every page and app carries: it
 * turns away what knocks on any address it finds, and makes a browser ask before it sends, but it is
 * no boundary of security. The wrapper of the function checks that it is the project's.
 */
export async function answerTrack(req: Request, deps: EventsDeps): Promise<Response> {
  if (!req.headers.get('apikey')) return json(401, { error: 'no-key' });
  const read = await readJson(req, MAX_EVENT_BODY);
  if ('refusal' in read) return read.refusal;
  const reply = await trackEvent(deps, read.value);
  return reply.status === 204 ? new Response(null, { status: 204 }) : json(reply.status, reply.body);
}
