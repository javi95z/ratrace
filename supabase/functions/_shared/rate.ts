/**
 * How often each kind of call may be made by one player: so many, in so many seconds. A guest
 * costs nothing to make, and each call is work: without these, one script is a busy server.
 */
export const LIMITS = {
  engine: [30, 60],
  // A device that meets its account for the first time sends five finished lives every five seconds until it has none left.
  finish: [60, 60],
  'ranked-start': [20, 3600],
  // A life is about a hundred steps, and a fast player takes several a second for a moment.
  'ranked-step': [240, 60],
  // Opening a room and joining one: a few an evening, and a code tried now and then.
  'room-make': [20, 3600],
  // Every call about a room in play, the page's own looks at it included: a card or two a second at most, and a look every few seconds.
  'room-step': [240, 60],
  // Friends: a list looked at now and then, and a few asked, answered or ended.
  friends: [60, 3600],
  // The errors a page met: ten kinds at most a page, a call or two each, so twenty a day is a player whose every page fails.
  // Counted by the day, so that one player can make up no more than two hundred kinds a day.
  errors: [20, 86_400],
} as const;

export type Counted = keyof typeof LIMITS;

/** The one thing asked of the database: its own function that counts a call and says whether it is within the limit. */
export interface Counter {
  rpc(name: 'take_rate', args: { who: string; what: string; at_most: number; per_seconds: number }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Counts this call for this player. False if it is one too many. A counter that cannot be
 * reached is a failure of the server, not a yes: the caller answers it as one.
 */
export async function allowed(db: Counter, userId: string, kind: Counted): Promise<boolean> {
  const [atMost, perSeconds] = LIMITS[kind];
  const { data, error } = await db.rpc('take_rate', { who: userId, what: kind, at_most: atMost, per_seconds: perSeconds });
  if (error) throw new Error(`the calls could not be counted: ${error.message}`);
  return data === true;
}
