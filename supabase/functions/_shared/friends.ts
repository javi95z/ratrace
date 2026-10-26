// Friends, both ways: one player asks, the other says yes or no, and either may end it for both.
//
// The words of the database are in its own functions (`friend_request`, `friend_answer`,
// `friend_remove`); this is what the server answers the page, and whom it tells: whoever is asked
// hears of it, and whoever asked hears the yes. Tested without a server; the function in
// `friends/index.ts` is the database and the push behind it.

import type { NoticeAbout } from './notice.ts';

/** What befriending says, in the database's word. */
export type Befriended = 'self' | 'friends' | 'accepted' | 'pending' | 'sent' | 'full';

/** Another player, as the list of friends shows them. */
export interface FriendRow {
  userId: string;
  nickname: string | null;
  avatar: string | null;
}

export interface FriendsDeps {
  /** Counts a call; false if it is one too many. */
  allow(userId: string): Promise<boolean>;
  /** Asks the player a friend code belongs to: `unknown` for no player. */
  requestByCode(userId: string, code: string): Promise<{ answer: Befriended | 'unknown'; to: string | null }>;
  answer(userId: string, from: string, yes: boolean): Promise<'accepted' | 'full' | 'declined' | 'gone' | Befriended>;
  remove(userId: string, other: string): Promise<void>;
  /** The player's friends, the requests sent to them, and those they sent, the latest first. */
  list(userId: string): Promise<{ friends: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] }>;
  /** The names the players chose, by id; null or left out for a player with none. */
  names(userIds: string[]): Promise<Record<string, string | null>>;
  /** Tells players something, on the browsers they asked to be told on. Never throws. */
  notify(userIds: string[], about: NoticeAbout): Promise<void>;
}

export interface Reply {
  status: number;
  body: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[\s\w-]{1,24}$/;
const bad = (field: string): Reply => ({ status: 400, body: { error: 'bad-request', field } });

/**
 * Tells the other player what befriending did: a request is news to whoever is asked; a yes, to
 * whoever asked. Their name is said as the asker chose it, or not at all.
 */
export async function tellOf(deps: { names: FriendsDeps['names']; notify(userIds: string[], about: Extract<NoticeAbout, { kind: 'friendRequest' | 'friendAccepted' }>): Promise<void> }, from: string, to: string, said: string): Promise<void> {
  if (said !== 'sent' && said !== 'accepted') return;
  const who = (await deps.names([from]))[from] ?? null;
  await deps.notify([to], said === 'sent' ? { kind: 'friendRequest', who, from } : { kind: 'friendAccepted', who });
}

/** The friends function: `list`, `request` by code, `answer` a request, `remove` a friend or a request. */
export async function friends(deps: FriendsDeps, userId: string, raw: unknown): Promise<Reply> {
  if (typeof raw !== 'object' || raw === null) return bad('body');
  const body = raw as Record<string, unknown>;
  if (!(await deps.allow(userId))) return { status: 429, body: { error: 'too-many' } };

  if (body.action === 'list') return { status: 200, body: await deps.list(userId) };

  if (body.action === 'request') {
    if (typeof body.code !== 'string' || !CODE.test(body.code)) return bad('code');
    const { answer, to } = await deps.requestByCode(userId, body.code);
    if (to !== null) await tellOf(deps, userId, to, answer);
    return { status: 200, body: { answer } };
  }

  if (body.action === 'answer') {
    if (typeof body.from !== 'string' || !UUID.test(body.from)) return bad('from');
    if (typeof body.yes !== 'boolean') return bad('yes');
    const answer = await deps.answer(userId, body.from, body.yes);
    // A yes is the asker's news; the one who said it knows.
    if (answer === 'accepted') await tellOf(deps, userId, body.from, 'accepted');
    return { status: 200, body: { answer } };
  }

  if (body.action === 'remove') {
    if (typeof body.userId !== 'string' || !UUID.test(body.userId)) return bad('userId');
    await deps.remove(userId, body.userId);
    return { status: 200, body: { answer: 'ok' } };
  }

  return bad('action');
}
