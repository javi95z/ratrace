import { SCENE_NOW } from './scenes';

/*
 * The other players of a scene of the rankings, the same on both clients: what they answer the screen (the rankings of all time, of the week and
 * among friends, the player's own name and code, their friends, the ranking of the week's challenge, the life behind a line). Both registries give
 * the screen a community made of it (`sceneCommunity`) in place of the cloud, so a shot of the web and one of the phone show the same players.
 *
 * The core knows nothing of the online client (`@ratrace/online`), so the community is written here in its shape (`SceneCommunity`) and taken by
 * each client as its `Community`, which the type checker holds to the same shape.
 */

/** A line of a ranking, as the cloud answers it. */
export interface SceneRankingRow {
  place: number;
  userId: string;
  nickname: string | null;
  score: number;
  lifeId: string;
  finishedAt: number;
  mine: boolean;
}

/** Another player among the friends. */
export interface SceneFriend {
  userId: string;
  nickname: string | null;
  avatar: string | null;
}

/** A player's best attempt at the week's challenge. */
export interface SceneChallengeRow {
  place: number;
  userId: string;
  nickname: string | null;
  score: number;
  finishedAt: number;
  mine: boolean;
}

/** The life behind a line of a ranking. */
export interface SceneLifeDetail {
  netWorth: number;
  status: number;
  escapedAtRound: number | null;
  bankruptcies: number;
  badges: string[];
  cities: string[];
  history: number[];
  finishedAt: number;
}

/** The online client's `Community`, as far as a scene answers it: everything it asks, each answered from the scene's players and nothing kept. */
export interface SceneCommunity {
  me(): Promise<{ nickname: string | null; friendCode: string; avatar: string | null } | null>;
  rename(nickname: string): Promise<'ok' | 'taken' | 'refused' | 'failed'>;
  setAvatar(avatar: string): Promise<boolean>;
  ranking(query: { period: 'all' | 'week'; friends: boolean; lifeId: string | null }): Promise<SceneRankingRow[] | null>;
  friends(): Promise<{ friends: SceneFriend[]; incoming: SceneFriend[]; outgoing: SceneFriend[] } | null>;
  compare(query: { lifeId: string; score: number }): Promise<{ below: number; total: number } | null>;
  run(row: { userId: string; lifeId: string; score: number }): Promise<SceneLifeDetail | null>;
  befriend(code: string): Promise<'sent' | 'accepted' | 'pending' | 'friends' | 'unknown' | 'self' | 'full' | 'failed'>;
  answerFriend(userId: string, yes: boolean): Promise<'accepted' | 'declined' | 'gone' | 'full' | 'failed'>;
  unfriend(userId: string): Promise<boolean>;
  challengeEntry(week: string, at?: number): Promise<{ entered: boolean; score: number | null } | null>;
  challengeRanking(week: string): Promise<{ rows: SceneChallengeRow[]; entrants: number } | null>;
  challengeChoices(week: string): Promise<Array<{ cardId: string; option: number; same: number; answered: number }> | null>;
  notifyMe(keys: unknown, locale: string): Promise<boolean>;
  stopNotifying(target: unknown): Promise<boolean>;
  marketNotice(target: unknown): Promise<boolean | null>;
  setMarketNotice(target: unknown, on: boolean): Promise<boolean>;
}

const DAY = 86_400_000;

/** The day a line's life ended: `days` before the scene's (`SCENE_NOW`), at noon. Within the scene's week for up to three days. */
const daysAgo = (days: number): number => SCENE_NOW - days * DAY;

/** The scene's player: their id (a line of theirs is `mine`), the name they chose, and the code a friend asks with. */
const ME = { userId: 'c0ffee00-0000-4000-8000-000000000006', nickname: 'Rata_Uno', friendCode: 'RAT7K2QX', avatar: 'rat_gold' };

/** A line of a ranking: the scene's player's own when it is theirs. */
const line = (place: number, userId: string, nickname: string | null, score: number, lifeId: string, days: number): SceneRankingRow => ({
  place,
  userId,
  nickname,
  score,
  lifeId,
  finishedAt: daysAgo(days),
  mine: userId === ME.userId,
});

/** The players of the scenes, by id: some with a name, some without (a ranking tells those apart by the start of their id). */
const ID = {
  ana: 'a11ce000-0000-4000-8000-000000000001',
  bo: 'b0b00000-0000-4000-8000-000000000002',
  cid: 'c1d00000-0000-4000-8000-000000000003',
  dee: 'dee00000-0000-4000-8000-000000000004',
  eve: 'e7e00000-0000-4000-8000-000000000005',
  fay: 'fa700000-0000-4000-8000-000000000007',
  gus: '9a5c0000-0000-4000-8000-000000000008',
  hal: '4a1e0000-0000-4000-8000-000000000009',
} as const;

/** The best ranked life of each player, of all time: the first three in their metals, the scene's own player sixth. */
const ALL_TIME: readonly SceneRankingRow[] = [
  line(1, ID.ana, 'Queso_Grande', 18_420, 'engineer', 40),
  line(2, ID.bo, 'MoneyRat', 16_905, 'founder', 12),
  line(3, ID.cid, null, 15_310, 'nurse', 25),
  line(4, ID.dee, 'Ratatouille', 14_120, 'civil_servant', 3),
  line(5, ID.eve, 'Squeak_99', 12_875, 'heir', 60),
  line(6, ME.userId, ME.nickname, 11_640, 'engineer', 2),
  line(7, ID.fay, null, 10_230, 'rider', 9),
  line(8, ID.gus, 'Whiskers', 9_015, 'nurse', 1),
];

/** The best of this week: lives that ended in the scene's own week. */
const THIS_WEEK: readonly SceneRankingRow[] = [
  line(1, ID.dee, 'Ratatouille', 14_120, 'civil_servant', 3),
  line(2, ME.userId, ME.nickname, 11_640, 'engineer', 2),
  line(3, ID.gus, 'Whiskers', 9_015, 'nurse', 1),
  line(4, ID.hal, null, 7_480, 'founder', 0),
];

/** The best of the player and their friends, of all time. */
const AMONG_FRIENDS: readonly SceneRankingRow[] = [
  line(1, ID.bo, 'MoneyRat', 16_905, 'founder', 12),
  line(2, ME.userId, ME.nickname, 11_640, 'engineer', 2),
  line(3, ID.gus, 'Whiskers', 9_015, 'nurse', 1),
];

/** The player's friends: two, a request waiting on the player, and one they sent. */
const FRIENDS = {
  friends: [
    { userId: ID.bo, nickname: 'MoneyRat', avatar: 'rat_teal' },
    { userId: ID.gus, nickname: 'Whiskers', avatar: 'rat_wine' },
  ],
  incoming: [{ userId: ID.cid, nickname: null, avatar: null }],
  outgoing: [{ userId: ID.eve, nickname: 'Squeak_99', avatar: 'rat_sky' }],
};

/** The week's challenge: forty took part (the best four are its best tenth); the scene's player fifth, just outside it. */
const CHALLENGE = {
  entrants: 40,
  rows: [
    { place: 1, userId: ID.dee, nickname: 'Ratatouille', score: 9_840, finishedAt: daysAgo(2), mine: false },
    { place: 2, userId: ID.ana, nickname: 'Queso_Grande', score: 9_215, finishedAt: daysAgo(3), mine: false },
    { place: 3, userId: ID.fay, nickname: null, score: 8_760, finishedAt: daysAgo(1), mine: false },
    { place: 4, userId: ID.bo, nickname: 'MoneyRat', score: 8_430, finishedAt: daysAgo(0), mine: false },
    { place: 5, userId: ME.userId, nickname: ME.nickname, score: 8_105, finishedAt: daysAgo(1), mine: true },
    { place: 6, userId: ID.gus, nickname: 'Whiskers', score: 7_520, finishedAt: daysAgo(2), mine: false },
  ],
};

/** The life behind any line: an engineer out of the rat race at forty, in two cities, with two badges. */
const DETAIL: SceneLifeDetail = {
  netWorth: 412_350_00,
  status: 38,
  escapedAtRound: 9,
  bankruptcies: 0,
  badges: ['millionaire', 'escaped'],
  cities: ['madrid', 'london'],
  history: [100_000, 450_000, 1_200_000, 3_100_000, 7_800_000, 15_200_000, 26_400_000, 41_235_000],
  finishedAt: daysAgo(2),
};

/** The scenes of the rankings, by name: each answers the same players, and each opens on what its name says (`rankingsOpening`). */
const RANKING_SCENES: ReadonlySet<string> = new Set(['rankings-all', 'rankings-week', 'rankings-friends', 'rankings-challenge', 'rankings-nickname']);

/**
 * The tab a scene of the rankings opens on: the one its name says, all time unless it names another (the name being changed is all time's, as the
 * page first is). Null for a scene that is not one of the rankings'.
 */
export function rankingsOpening(name: string): { tab: 'all' | 'week' | 'friends' | 'challenge'; naming: boolean } | null {
  if (!RANKING_SCENES.has(name)) return null;
  const tab = name === 'rankings-week' ? 'week' : name === 'rankings-friends' ? 'friends' : name === 'rankings-challenge' ? 'challenge' : 'all';
  return { tab, naming: name === 'rankings-nickname' };
}

/**
 * The other players of a scene, or null for a scene that has none (every scene but the rankings', whose screens ask nobody). A new object each
 * time, answering the same: nothing a scene does changes what it is told, so a shot shows what the scene says whatever was pressed on it.
 */
export function sceneCommunity(name: string): SceneCommunity | null {
  if (!RANKING_SCENES.has(name)) return null;
  const ranking = (query: { period: 'all' | 'week'; friends: boolean; lifeId: string | null }): SceneRankingRow[] => {
    const rows = query.friends ? AMONG_FRIENDS : query.period === 'week' ? THIS_WEEK : ALL_TIME;
    return rows.filter((row) => query.lifeId === null || row.lifeId === query.lifeId).map((row) => ({ ...row }));
  };
  return {
    me: async () => ({ nickname: ME.nickname, friendCode: ME.friendCode, avatar: ME.avatar }),
    rename: async () => 'failed',
    setAvatar: async () => false,
    ranking: async (query) => ranking(query),
    friends: async () => ({ friends: [...FRIENDS.friends], incoming: [...FRIENDS.incoming], outgoing: [...FRIENDS.outgoing] }),
    compare: async () => null,
    run: async () => ({ ...DETAIL }),
    befriend: async () => 'failed',
    answerFriend: async () => 'failed',
    unfriend: async () => false,
    challengeEntry: async () => ({ entered: true, score: CHALLENGE.rows[4].score }),
    challengeRanking: async () => ({ entrants: CHALLENGE.entrants, rows: CHALLENGE.rows.map((row) => ({ ...row })) }),
    challengeChoices: async () => [],
    notifyMe: async () => false,
    stopNotifying: async () => false,
    marketNotice: async () => null,
    setMarketNotice: async () => false,
  };
}
