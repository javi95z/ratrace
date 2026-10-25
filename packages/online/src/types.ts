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

/**
 * Opens an address in the system's browser, for a client that cannot leave its own page (a phone),
 * and resolves with the address the browser came back to, or null if the player closed it.
 */
export type Opener = (url: string) => Promise<string | null>;

/** The one way the screens learn who is playing and ask to keep the account. */
export interface Account {
  state(): AccountState;
  /** Calls `listener` whenever the state changes, and when a first start has ended. Returns how to stop. */
  subscribe(listener: () => void): () => void;
  /**
   * Whether the account has tried to sign in at least once, however it went: until then `offline`
   * only means it has not asked yet. Absent, it always has.
   */
  settled?(): boolean;
  /**
   * Signs in as a guest unless someone already is. Never throws: with no network the state stays
   * `offline`, and it can be asked again later.
   */
  start(language: string): Promise<void>;
  /**
   * Sends the player to Google to keep this account, and brings them back to `returnTo`.
   * The account stays the same one, so nothing has to be moved. Resolves false if it could not even begin.
   * With `open` (a phone), Google is opened with it and the call resolves once the browser comes back:
   * true if the account was kept, false if it failed (with its notice) or the player closed the browser (with none).
   */
  keepWithGoogle(returnTo: string, open?: Opener): Promise<boolean>;
  /**
   * Signs in as the player a Google account already belongs to, in place of the guest this
   * browser has been so far, and comes back to `returnTo`. For a second device. Resolves false if it could not begin.
   * With `open`, as `keepWithGoogle`.
   */
  useExistingAccount(returnTo: string, open?: Opener): Promise<boolean>;
  /** The player has read the notice. */
  dismissNotice(): void;
  /** Signs this browser out of the account. False if it could not. Whoever comes next starts as a new guest. */
  signOut(): Promise<boolean>;
  /**
   * Deletes the account, and everything of the player's in it, for good; then signs this device out of it. True only once the server has said it
   * is gone: false (no network, a refusal) leaves the account as it was, signed in. Absent, the account cannot be deleted from here.
   */
  deleteAccount?(): Promise<boolean>;
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
  /**
   * The account is gone (deleted): what the device noted to tell it later (the lives given up, those the server would not take) is nobody's to
   * tell now, and the next account is told none of it. Absent, there is nothing noted.
   */
  forget?(): void;
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

/** A player's best attempt in the ranking of a week's challenge. */
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

/** Another player in the list of friends: a friend, or someone a request is waiting on. `avatar` is the rat they chose. */
export interface Friend {
  userId: string;
  nickname: string | null;
  avatar: string | null;
}

/** The player's friends, both ways; the requests sent to them, to answer; and those they sent, waiting. The latest first. */
export interface Friends {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

/**
 * What asking someone to be friends did: `sent`; `accepted`, they had asked first and now are friends;
 * `pending`, asked already; `friends`, already; `unknown`, no player has that code; `self`, the
 * player's own; `full`, as many friends or requests as one may have; `failed`, nothing could be done.
 */
export type Befriended = 'sent' | 'accepted' | 'pending' | 'friends' | 'unknown' | 'self' | 'full' | 'failed';

/** Where a browser can be told: its push subscription's endpoint and keys. */
export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Where a phone with the app can be told: the token Expo's push service gave it, and what the phone is. */
export interface AppPushToken {
  expo: string;
  platform: 'ios' | 'android';
}

/** A browser that asked for notices, by its endpoint, or a phone, by its Expo token. */
export type PushTarget = string | { expo: string };

/**
 * The other players, as far as a screen is told of them: the rankings, the player's own name and
 * friend code, and their friends. It needs someone signed in and a connection; what cannot be
 * read just now is null, and what cannot be done says so in a word.
 */
export interface Community {
  /** `avatar` is the rat the player chose, as kept in the profile (`rat_<colour>`), or null for none yet. */
  me(): Promise<{ nickname: string | null; friendCode: string; avatar: string | null; language?: string | null } | null>;
  /** Keeps the language the player chose with their account, for the next device they sign in on. */
  setLanguage?(language: string): Promise<boolean>;
  /** `taken`: someone has that name. `refused`: the name is not accepted. */
  rename(nickname: string): Promise<'ok' | 'taken' | 'refused' | 'failed'>;
  /** Keeps the rat the player chose. False if it could not be. */
  setAvatar(avatar: string): Promise<boolean>;
  /** The first fifty, and the asker's own line if it is further down. */
  ranking(query: RankingQuery): Promise<RankingRow[] | null>;
  friends(): Promise<Friends | null>;
  /**
   * How a score stands among the lives other players have finished from the same start: how many
   * of them scored less, and how many there are. Ranked and casual alike; the asker's own are left out.
   */
  compare(query: { lifeId: string; score: number }): Promise<{ below: number; total: number } | null>;
  /** The life behind a line of a ranking, as far as anyone may see it. Null where it cannot be read. */
  run(row: Pick<RankingRow, 'userId' | 'lifeId' | 'score'>): Promise<RankedLifeDetail | null>;
  /** Asks the player a friend code belongs to to be friends: the other says yes or no. */
  befriend(code: string): Promise<Befriended>;
  /** Says yes or no to a request. `gone` if it is no longer there; `full` if either has as many friends as one may. */
  answerFriend(userId: string, yes: boolean): Promise<'accepted' | 'declined' | 'gone' | 'full' | 'failed'>;
  /** Ends a friendship, for both, or takes back a request. False if it could not be. */
  unfriend(userId: string): Promise<boolean>;
  /**
   * Whether the player has had today's attempt at a week's challenge (one counts each UTC day, `at` saying when now is),
   * and their best score of the week, once an attempt is over. Null where it cannot be read.
   */
  challengeEntry(week: string, at?: number): Promise<{ entered: boolean; score: number | null } | null>;
  challengeRanking(week: string): Promise<ChallengeRanking | null>;
  /** The player's choices in their attempt at a week, card by card, beside everyone's. Empty until the attempt is over. */
  challengeChoices(week: string): Promise<ChallengeChoice[] | null>;
  /** Keeps where this browser, or this phone with the app, can be told of the weekly challenge, in a language. False if it could not. */
  notifyMe(keys: PushKeys | AppPushToken, locale: string): Promise<boolean>;
  /** Forgets a browser, or a phone, that no longer wants to be told. */
  stopNotifying(target: PushTarget): Promise<boolean>;
  /** Whether this browser, or this phone, is told when something the player holds in a ranked life moved. Null where it cannot be read. */
  marketNotice(target: PushTarget): Promise<boolean | null>;
  /** Turns "your market moved" on or off for this browser, or this phone, apart from the other notices. False if it could not. */
  setMarketNotice(target: PushTarget, on: boolean): Promise<boolean>;
}
