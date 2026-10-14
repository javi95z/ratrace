/**
 * Who is playing, as far as the cloud knows. The game never needs an answer to play: `offline`
 * is a state like the others, and it is the state of a build with no Supabase project set.
 */
export type AccountState =
  /** No project is configured, or nobody could be signed in. The game plays on this device alone. */
  | { kind: 'offline' }
  /** Signed in without a form: an account that lives only in this browser until it is kept. */
  | { kind: 'guest'; userId: string; notice: AccountNotice | null }
  /** Kept with Google: the same account on any device. */
  | { kind: 'member'; userId: string; email: string | null };

/**
 * Something the player should be told once about keeping their account.
 * `joining`: the Google account they chose already belongs to a player of this game, most often
 * themselves on another device, and the game is taking them into it on its own. `failed`: nothing
 * was linked, whatever the reason.
 */
export type AccountNotice = 'joining' | 'failed';

/** The one way the screens learn who is playing and ask to keep the account. */
export interface Account {
  state(): AccountState;
  /** Calls `listener` whenever the state changes. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /**
   * Signs in as a guest unless someone already is. Never throws: with no network the state stays
   * `offline`, and it can be asked again later.
   */
  start(language: string): Promise<void>;
  /**
   * Sends the player to Google to keep this account, and brings them back to `returnTo`.
   * The account stays the same one, so nothing has to be moved. Resolves false if it could not even begin.
   */
  keepWithGoogle(returnTo: string): Promise<boolean>;
  /**
   * Signs in as the player a Google account already belongs to, in place of the guest this
   * browser has been so far, and comes back to `returnTo`. For a second device. Resolves false if it could not begin.
   */
  useExistingAccount(returnTo: string): Promise<boolean>;
  /** The player has read the notice. */
  dismissNotice(): void;
}

/**
 * Where what is on the device stands with the account: there is no account; it is on its way; the
 * last try did not get through; or everything is there.
 */
export type CloudSaving = 'off' | 'sending' | 'waiting' | 'saved';

/**
 * What the account changed on the device, for whoever shows it. `renamed`: the life on the device
 * is the same life under a new id, because the account would not take it under its own.
 */
export type DeviceChange = 'game' | 'renamed' | 'profile' | 'runs';

/** A different life in progress waiting in the account, as far as a screen needs to know it. */
export interface AccountLife {
  gameId: string;
  lifeId: string;
  round: number;
  cityId: string;
}

/**
 * The account's copy of what the player has, as the game is told of it. The device is always
 * written first and is always enough; this says how far the account is behind it, and holds the
 * one thing a player is asked: what to do with a different life waiting there.
 */
export interface AccountSaves {
  status(): CloudSaving;
  /** A different life in progress waiting in the account, if there is one. The same object until it changes. */
  offer(): AccountLife | null;
  /** Calls `listener` when the status or the offer changes. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /** Calls `listener` when the account has changed what the device holds. Returns how to stop. */
  onDeviceChanged(listener: (what: DeviceChange) => void): () => void;
  /** Takes the offered life in place of the device's own, which is given up. False if there was none. */
  takeOffer(): Promise<boolean>;
  /** Ends the offered life in the account instead. */
  declineOffer(): Promise<void>;
}

/** One line of a ranking: the best ranked life of one player. */
export interface RankingRow {
  place: number;
  userId: string;
  /** The name the player chose, or null if they have not chosen one. */
  nickname: string | null;
  score: number;
  lifeId: string;
  finishedAt: number;
  /** True for the line of the player who asked. */
  mine: boolean;
}

/** A ranked life as another player may see it: how it ended, what it earned, where it was lived. */
export interface RankedLifeDetail {
  /** At the end, in start-of-game cents. */
  netWorth: number;
  status: number;
  escapedAtRound: number | null;
  bankruptcies: number;
  badges: string[];
  cities: string[];
  /** Net worth round by round, in start-of-game cents. */
  history: number[];
  finishedAt: number;
}

/** Which ranking: of all time or of this week; among everyone or among friends; of one starting life or of any. */
export interface RankingQuery {
  period: 'all' | 'week';
  friends: boolean;
  lifeId: string | null;
}

/** One attempt in the ranking of a week's challenge. */
export interface ChallengeRow {
  place: number;
  userId: string;
  nickname: string | null;
  score: number;
  finishedAt: number;
  mine: boolean;
}

/** The ranking of a week's challenge: the first fifty and the asker's own line, and how many took part. */
export interface ChallengeRanking {
  rows: ChallengeRow[];
  entrants: number;
}

/** What the player chose on one card of their attempt, beside everyone else: how many chose the same, of how many who answered it. */
export interface ChallengeChoice {
  cardId: string;
  option: number;
  same: number;
  answered: number;
}

/** Someone the player follows. */
export interface Friend {
  userId: string;
  nickname: string | null;
}

/**
 * The other players, as far as a screen is told of them: the rankings, the player's own name and
 * friend code, and whom they follow. It needs someone signed in and a connection; what cannot be
 * read just now is null, and what cannot be done says so in a word.
 */
export interface Community {
  me(): Promise<{ nickname: string | null; friendCode: string } | null>;
  /** `taken`: someone has that name. `refused`: the name is not accepted. */
  rename(nickname: string): Promise<'ok' | 'taken' | 'refused' | 'failed'>;
  /** The first fifty, and the asker's own line if it is further down. */
  ranking(query: RankingQuery): Promise<RankingRow[] | null>;
  friends(): Promise<Friend[] | null>;
  /**
   * How a score stands among the lives other players have finished from the same start: how many
   * of them scored less, and how many there are. Ranked and casual alike; the asker's own are left out.
   */
  compare(query: { lifeId: string; score: number }): Promise<{ below: number; total: number } | null>;
  /** The life behind a line of a ranking, as far as anyone may see it. Null where it cannot be read. */
  run(row: Pick<RankingRow, 'userId' | 'lifeId' | 'score'>): Promise<RankedLifeDetail | null>;
  /** Follows the player a friend code belongs to. `full`: the player follows as many as one may. */
  follow(code: string): Promise<'ok' | 'unknown' | 'self' | 'full' | 'failed'>;
  unfollow(userId: string): Promise<boolean>;
  /** Whether the player has had their attempt at a week's challenge, and its score once it is over. Null where it cannot be read. */
  challengeEntry(week: string): Promise<{ entered: boolean; score: number | null } | null>;
  challengeRanking(week: string): Promise<ChallengeRanking | null>;
  /** The player's choices in their attempt at a week, card by card, beside everyone's. Empty until the attempt is over. */
  challengeChoices(week: string): Promise<ChallengeChoice[] | null>;
}
