import type { OAuthResponse, SupabaseClient, SupportedStorage, User } from '@supabase/supabase-js';
import type { CloudGame } from './merge';
import type { CloudRun } from './mirror';
import { rankedApi } from './ranked';
import { roomsApi } from './rooms';
import { cameBackTo, noticeIn } from './supabase';
import type { Cloud, CloudUser } from './supabase';
import type { Friend, Opener, PushTarget } from './types';

const userOf = (user: User | null | undefined): CloudUser | null => (user ? { id: user.id, is_anonymous: user.is_anonymous === true, email: user.email } : null);

interface GameRow {
  id: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  seed: string | null;
  round: number;
  status: string;
  log: unknown;
  state_hash: string | null;
  updated_at: string;
  challenge?: string | null;
}
interface RunRow {
  id: string;
  mode: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  score: number;
  net_worth: number;
  status: number;
  escaped_at_round: number | null;
  bankruptcies: number;
  badges: string[] | null;
  cities: string[] | null;
  history: number[] | null;
  finished_at: string;
  challenge?: string | null;
}

const gameOf = (row: GameRow): CloudGame => ({
  id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, seed: row.seed, round: row.round, status: row.status, log: row.log, stateHash: row.state_hash, updatedAt: row.updated_at,
  ...(typeof row.challenge === 'string' ? { challenge: row.challenge } : {}),
});
const runOf = (row: RunRow): CloudRun => ({
  id: row.id, mode: row.mode === 'ranked' || row.mode === 'room' ? row.mode : 'casual', lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, score: row.score, netWorth: row.net_worth, status: row.status,
  escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies, badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: row.finished_at,
  ...(typeof row.challenge === 'string' ? { challenge: row.challenge } : {}),
});

/** Where a browser's row of notices is kept, by its endpoint, or a phone's, by its Expo token. */
const pushRow = (target: PushTarget): ['push_subscriptions', 'endpoint', string] | ['push_tokens', 'token', string] =>
  typeof target === 'string' ? ['push_subscriptions', 'endpoint', target] : ['push_tokens', 'token', target.expo];

/** The database's own word for "the rules of this table do not let you". */
const NOT_ALLOWED = '42501';
/** A name someone already has, a name that is not accepted for what it says, and one that is not written as a name is. */
const TAKEN = '23505';
const UNWELCOME = 'RR002';
const NOT_A_NAME = '23514';
/** The word of the `games` table for a save with less of a life played than the account holds. */
const BEHIND = 'RR001';
/** The answers the `finish-run` function gives of its own accord, by name. Asked again, it would give the same. */
const REFUSALS = new Set(['bad-request', 'unknown-game', 'not-casual', 'not-finished', 'cannot-replay']);
/** How long a request may go unanswered before it is given up. */
const PATIENCE = 20_000;

/**
 * Why the function would not, in its own word, or null if the answer is not the function's at
 * all: no network, a gateway that does not know it, a session that has run out.
 */
async function wordOf(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body: unknown = await context.clone().json();
    const word = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null;
    return typeof word === 'string' ? word : null;
  } catch {
    return null;
  }
}

/**
 * Proof, for the cloud, that a person is at the door. Where the project asks for one, a guest is
 * made only with it. Resolves the word to hand over, good once, or null if none could be had. It
 * never throws.
 */
export type Captcha = () => Promise<string | null>;

/** What a build may say about its cloud beyond where it is. */
export interface CloudOptions {
  /** The region the database is in, as the platform names it (ap-northeast-1). Named, the function that uses the database most is asked for there. */
  region?: string;
  /** The guard at the door of guest sign-in, where the project has one. */
  captcha?: Captcha;
  /** Where the session is kept, for a client with no browser storage of its own (a phone). Left out, the client's own. */
  storage?: SupportedStorage;
  /** Whether the client renews the session by itself (it does unless told not to): a phone renews it only while it is in front. */
  autoRefresh?: boolean;
}

/** The value of one part of an address's query, or null: for the address a browser came back to. */
function queryOf(address: string, name: string): string | null {
  try {
    return new URL(address).searchParams.get(name);
  } catch {
    return null;
  }
}

/**
 * The cloud, made from a Supabase client. Every table it touches is guarded in the database: a
 * player reads and writes their own rows and nothing else, whatever this code asks for.
 */
export function cloudOf(client: SupabaseClient, { region, captcha }: CloudOptions = {}, counting?: () => Pick<SupabaseClient, 'functions'>): Cloud {
  /**
   * Google through a browser that comes back, for a client that cannot leave its page (a phone): the
   * address the client asked for is opened, and the code the browser comes back with is exchanged for
   * the session, against the verifier of this very trip. An error, a browser closed, an address it was
   * not sent back to, or a trip with no flow of its own (whose verifier could be another trip's) exchanges nothing.
   */
  const throughBrowser = async (asked: Promise<OAuthResponse>, redirectTo: string, open: Opener): Promise<boolean> => {
    const { data, error } = await asked;
    if (error || !data.url || !data.flowId) return false;
    const back = await open(data.url);
    if (back === null || !cameBackTo(back, redirectTo) || noticeIn(back) !== null) return false;
    const code = queryOf(back, 'code');
    if (code === null) return false;
    const exchanged = await client.auth.exchangeCodeForSession(code, { flowId: data.flowId });
    return exchanged.error === null;
  };
  /** Who is signed in, for the two things that must name their owner. */
  const me = async (): Promise<string> => {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('nobody is signed in');
    return id;
  };
  // A ranked life is played by the `ranked` function. Each step reads and writes the database several times, so the
  // function is asked for in the database's own region when the build names it: one long hop, not four. The region
  // goes in the address. The client's own way of naming one adds a header the function's gateway does not let a
  // browser send, and every ranked call from a page would be refused before it left.
  const rankedName = region !== undefined && /^[a-z]{2}-[a-z]+-\d$/.test(region) ? `ranked?forceFunctionRegion=${region}` : 'ranked';
  const ranked = rankedApi(async (body) => {
    const { data, error } = await client.functions.invoke(rankedName, { body });
    if (!error) return { status: 200, body: data };
    const context = (error as { context?: unknown }).context;
    // The function answered, and said no: its answer is in the response. Anything else never reached it.
    if (context instanceof Response) return { status: context.status, body: await context.clone().json().catch(() => null) };
    throw error instanceof Error ? error : new Error('the ranked function could not be reached');
  });
  // Rooms are asked for in the same region as ranked lives, for the same reason: every step is a few trips to the database.
  const roomsName = rankedName.replace(/^ranked/, 'rooms');
  const rooms = roomsApi(async (body) => {
    const { data, error } = await client.functions.invoke(roomsName, { body });
    if (!error) return { status: 200, body: data };
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) return { status: context.status, body: await context.clone().json().catch(() => null) };
    throw error instanceof Error ? error : new Error('the rooms function could not be reached');
  });

  return {
    async currentUser() {
      // A stored session that could not be renewed comes back as no session and an error. That is
      // not "nobody is signed in": said so, the game would make a new guest over the stored player.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return userOf(data.session?.user);
    },
    async signInAsGuest() {
      // Where there is a guard at the door, the cloud makes no guest without its word: with none, it is not asked.
      const word = captcha ? await captcha() : undefined;
      if (word === null) return null;
      const { data, error } = await (word === undefined ? client.auth.signInAnonymously() : client.auth.signInAnonymously({ options: { captchaToken: word } }));
      return error ? null : userOf(data.user);
    },
    async linkGoogle(redirectTo, open) {
      if (open) return throughBrowser(client.auth.linkIdentity({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }), redirectTo, open);
      // On success the client itself sends the browser to Google.
      const { error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async signInWithGoogle(redirectTo, open) {
      // Replaces whoever is signed in here with the player the Google account belongs to.
      if (open) return throughBrowser(client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }), redirectTo, open);
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async signOut() {
      // This browser only: the player's other devices stay signed in.
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    },
    async deleteAccount() {
      // Said in as many words, so that nothing sent by mistake removes anyone; gone only when the function says so.
      try {
        const { data, error } = await client.functions.invoke('delete-account', { body: { confirm: true } });
        return !error && (data as { deleted?: unknown } | null)?.deleted === true;
      } catch {
        return false;
      }
    },
    async ensureProfile(userId, language) {
      // Made with the language it was first opened in; an existing one keeps its own, which only the player changes.
      const { error } = await client.from('profiles').upsert({ user_id: userId, language }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onUser(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(userOf(session?.user)));
      return () => data.subscription.unsubscribe();
    },

    async playingGames() {
      const { data, error } = await client
        .from('games')
        .select('id, life_id, engine_version, content_version, seed, round, status, log, state_hash, updated_at, challenge')
        .eq('mode', 'casual')
        .eq('status', 'playing')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data ?? []) as GameRow[]).map(gameOf);
    },
    async pushGame(game) {
      const { error } = await client.from('games').upsert(
        // `playing` is said, not left to the table: a life another device gave up is taken up again by the one still playing it.
        {
          id: game.id,
          mode: 'casual',
          status: 'playing',
          life_id: game.lifeId,
          engine_version: game.engineVersion,
          content_version: game.contentVersion,
          seed: game.seed,
          round: game.round,
          log: game.log,
          state_hash: game.stateHash || null,
          challenge: game.challenge ?? null,
        },
        { onConflict: 'id' },
      );
      if (!error) return 'saved';
      // The account holds more of this life than this save does: the table does not go backwards.
      if (error.code === BEHIND) return 'behind';
      if (error.code !== NOT_ALLOWED) throw error;
      // The rules refused. Either this is the player's own life and the server has finished it, or
      // the id is not this player's at all: a player sees their own games and nobody else's, so
      // asking for it tells the two apart.
      const own = await client.from('games').select('status').eq('id', game.id).maybeSingle();
      if (own.error) throw own.error;
      return own.data === null ? 'taken' : 'closed';
    },
    async abandonGame(id) {
      const { error } = await client.from('games').update({ status: 'abandoned' }).eq('id', id).eq('status', 'playing');
      if (error) throw error;
    },
    async loadProgress() {
      const { data, error } = await client.from('player_progress').select('progress').maybeSingle();
      if (error) throw error;
      return (data as { progress?: unknown } | null)?.progress ?? null;
    },
    async saveProgress(progress) {
      const { error } = await client.from('player_progress').upsert({ user_id: await me(), progress }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    async listRuns() {
      // Every signed-in player may read every run; these are the player's own.
      const { data, error } = await client
        .from('runs')
        .select('id, mode, life_id, engine_version, content_version, score, net_worth, status, escaped_at_round, bankruptcies, badges, cities, history, finished_at, challenge')
        .eq('user_id', await me())
        .order('finished_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as RunRow[]).map(runOf);
    },
    async rankedLife() {
      // A player has one ranked life in progress at most, and sees no game but their own.
      const { data, error } = await client.from('games').select('id, life_id, engine_version, content_version, challenge').eq('mode', 'ranked').eq('status', 'playing').limit(1).maybeSingle();
      if (error) throw error;
      const row = data as { id: string; life_id: string; engine_version: string; content_version: string; challenge?: string | null } | null;
      return row === null ? null : { id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, challenge: row.challenge ?? null };
    },
    giveUpRanked: (id) => ranked.abandon(id),
    ranked,
    rooms: {
      api: rooms,
      // Every change to the room and to anyone in it, as the rules of the two tables let this player read them.
      watch(roomId, onChange) {
        const channel = client
          .channel(`room:${roomId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => onChange())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, () => onChange())
          // Listening begins a moment after the channel opens, and what changed in that moment would be missed: it is asked for once then.
          .on('system', {}, (message: { extension?: string; status?: string }) => {
            if (message.extension === 'postgres_changes' && message.status === 'ok') onChange();
          })
          .subscribe();
        return () => void client.removeChannel(channel);
      },
    },
    community: {
      async me() {
        try {
          const { data, error } = await client.from('profiles').select('nickname, friend_code, portrait, language').eq('user_id', await me()).maybeSingle();
          const row = data as { nickname: string | null; friend_code: string; portrait: string | null; language: string | null } | null;
          return error || row === null ? null : { nickname: row.nickname, friendCode: row.friend_code, avatar: row.portrait, language: row.language };
        } catch {
          return null;
        }
      },
      async rename(nickname) {
        try {
          const { error } = await client.from('profiles').update({ nickname }).eq('user_id', await me());
          if (!error) return 'ok';
          // The database checks a name itself: someone has it, or it is not accepted (what it says, or how it is written).
          if (error.code === TAKEN) return 'taken';
          return error.code === UNWELCOME || error.code === NOT_A_NAME ? 'refused' : 'failed';
        } catch {
          return 'failed';
        }
      },
      async setLanguage(language) {
        try {
          const { error } = await client.from('profiles').update({ language }).eq('user_id', await me());
          return !error;
        } catch {
          return false;
        }
      },
      async setAvatar(avatar) {
        try {
          const { error } = await client.from('profiles').update({ portrait: avatar }).eq('user_id', await me());
          return !error;
        } catch {
          return false;
        }
      },
      async ranking(query) {
        try {
          const mine = await me();
          const { data, error } = await client.rpc('ranking', { period: query.period, life: query.lifeId, friends: query.friends, top: 50 });
          if (error) return null;
          return ((data ?? []) as Array<{ place: number; user_id: string; nickname: string | null; score: number; life_id: string; finished_at: string }>).map((row) => ({
            place: Number(row.place), userId: row.user_id, nickname: row.nickname, score: row.score, lifeId: row.life_id, finishedAt: Date.parse(row.finished_at) || 0, mine: row.user_id === mine,
          }));
        } catch {
          return null;
        }
      },
      async challengeEntry(week, at = Date.now()) {
        try {
          const mine = await me();
          // An attempt counts once a day, by the UTC day the server counts in; the best of the week is the one ranked.
          const today = `${new Date(at).toISOString().slice(0, 10)}T00:00:00Z`;
          const [entry, run] = await Promise.all([
            client.from('challenge_entries').select('week').eq('week', week).gte('created_at', today).limit(1),
            client.from('runs').select('score').eq('user_id', mine).eq('mode', 'ranked').eq('challenge', week).order('score', { ascending: false }).limit(1),
          ]);
          if (entry.error || run.error) return null;
          const score = ((run.data ?? []) as Array<{ score: number }>)[0]?.score ?? null;
          return { entered: (entry.data ?? []).length > 0, score };
        } catch {
          return null;
        }
      },
      async challengeRanking(week) {
        try {
          const mine = await me();
          const { data, error } = await client.rpc('challenge_ranking', { week_id: week, top: 50 });
          if (error) return null;
          const rows = (data ?? []) as Array<{ place: number; user_id: string; nickname: string | null; score: number; finished_at: string; entrants: number }>;
          return {
            rows: rows.map((row) => ({ place: Number(row.place), userId: row.user_id, nickname: row.nickname, score: row.score, finishedAt: Date.parse(row.finished_at) || 0, mine: row.user_id === mine })),
            entrants: rows.length > 0 ? Number(rows[0].entrants) : 0,
          };
        } catch {
          return null;
        }
      },
      async notifyMe(keys, locale) {
        try {
          const { error } =
            'expo' in keys
              ? // A phone follows whoever signs in on it: the server moves its row from the account before.
                await client.rpc('claim_push_token', { p_token: keys.expo, p_platform: keys.platform, p_locale: locale })
              : await client.from('push_subscriptions').upsert({ endpoint: keys.endpoint, p256dh: keys.p256dh, auth: keys.auth, locale, user_id: await me() }, { onConflict: 'endpoint' });
          return !error;
        } catch {
          return false;
        }
      },
      async stopNotifying(target) {
        try {
          const [table, column, value] = pushRow(target);
          const { error } = await client.from(table).delete().eq(column, value);
          return !error;
        } catch {
          return false;
        }
      },
      async marketNotice(target) {
        try {
          const [table, column, value] = pushRow(target);
          const { data, error } = await client.from(table).select('market_moved').eq(column, value).maybeSingle();
          const row = data as { market_moved: boolean } | null;
          return error || row === null ? null : row.market_moved;
        } catch {
          return null;
        }
      },
      async setMarketNotice(target, on) {
        try {
          const [table, column, value] = pushRow(target);
          const { error } = await client.from(table).update({ market_moved: on }).eq(column, value);
          return !error;
        } catch {
          return false;
        }
      },
      async challengeChoices(week) {
        try {
          const { data, error } = await client.rpc('challenge_choices', { week_id: week });
          if (error) return null;
          return ((data ?? []) as Array<{ card_id: string; option: number; same: number; answered: number }>).map((row) => ({ cardId: row.card_id, option: Number(row.option), same: Number(row.same), answered: Number(row.answered) }));
        } catch {
          return null;
        }
      },
      async compare({ lifeId, score }) {
        try {
          const mine = await me();
          // Two counts and no rows: how many lives like this one there are, and how many of them did worse.
          const others = () => client.from('runs').select('id', { count: 'exact', head: true }).eq('life_id', lifeId).neq('user_id', mine);
          const [all, below] = await Promise.all([others(), others().lt('score', score)]);
          if (all.error || below.error || all.count === null || below.count === null) return null;
          return { below: below.count, total: all.count };
        } catch {
          return null;
        }
      },
      async run({ userId, lifeId, score }) {
        try {
          // The line of a ranking is the player's best ranked life of that start: the first to reach that score.
          const { data, error } = await client
            .from('runs')
            .select('net_worth, status, escaped_at_round, bankruptcies, badges, cities, history, finished_at')
            .eq('user_id', userId)
            .eq('mode', 'ranked')
            .eq('life_id', lifeId)
            .eq('score', score)
            .order('finished_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          const row = data as { net_worth: number; status: number; escaped_at_round: number | null; bankruptcies: number; badges: string[] | null; cities: string[] | null; history: Array<number | string> | null; finished_at: string } | null;
          if (error || row === null) return null;
          return {
            netWorth: Number(row.net_worth), status: row.status, escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies,
            badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: Date.parse(row.finished_at) || 0,
          };
        } catch {
          return null;
        }
      },
      async friends() {
        try {
          const { data, error } = await client.functions.invoke('friends', { body: { action: 'list' } });
          if (error || typeof data !== 'object' || data === null) return null;
          const list = (raw: unknown): Friend[] =>
            (Array.isArray(raw) ? raw : [])
              .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && typeof (row as { userId?: unknown }).userId === 'string')
              .map((row) => ({ userId: row.userId as string, nickname: typeof row.nickname === 'string' ? row.nickname : null, avatar: typeof row.avatar === 'string' ? row.avatar : null }));
          const body = data as Record<string, unknown>;
          return { friends: list(body.friends), incoming: list(body.incoming), outgoing: list(body.outgoing) };
        } catch {
          return null;
        }
      },
      async befriend(code) {
        try {
          const { data, error } = await client.functions.invoke('friends', { body: { action: 'request', code } });
          const answer = error ? null : (data as { answer?: unknown } | null)?.answer;
          return answer === 'sent' || answer === 'accepted' || answer === 'pending' || answer === 'friends' || answer === 'unknown' || answer === 'self' || answer === 'full' ? answer : 'failed';
        } catch {
          return 'failed';
        }
      },
      async answerFriend(userId, yes) {
        try {
          const { data, error } = await client.functions.invoke('friends', { body: { action: 'answer', from: userId, yes } });
          const answer = error ? null : (data as { answer?: unknown } | null)?.answer;
          return answer === 'accepted' || answer === 'declined' || answer === 'gone' || answer === 'full' ? answer : 'failed';
        } catch {
          return 'failed';
        }
      },
      async unfriend(userId) {
        try {
          const { error } = await client.functions.invoke('friends', { body: { action: 'remove', userId } });
          return !error;
        } catch {
          return false;
        }
      },
    },
    async finishRun(gameId) {
      const { error } = await client.functions.invoke('finish-run', { body: { gameId } });
      if (!error) return 'done';
      // The function said no, in its own word: asking again will not change its mind. Anything else
      // (no network, the server down, a gateway that does not know the function, a session that has
      // just run out) is worth another try.
      const word = await wordOf(error);
      if (word === 'unknown-version') return 'unknown-version';
      return word !== null && REFUSALS.has(word) ? 'refused' : 'failed';
    },
    async autoRefresh(on) {
      await (on ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh());
    },
    async track(event) {
      // Counted through a client with no session (`connectSupabase`), never the player's: the function is told nothing of who, not even a token.
      if (counting === undefined) return 'never';
      try {
        const { error } = await counting().functions.invoke('track', { body: event });
        if (!error) return 'sent';
        // The function's own no: not an event it knows, no key, or too many of it today. Sent again, it would get the same.
        const word = await wordOf(error);
        return word === 'bad-request' || word === 'no-key' || word === 'too-many' ? 'never' : 'later';
      } catch {
        return 'later';
      }
    },
    async reportErrors(reports) {
      const { error } = await client.functions.invoke('report-error', { body: { reports } });
      if (!error) return 'sent';
      // The function's own no, to these reports or to this many in an hour: sent again, they would get the same.
      const word = await wordOf(error);
      return word === 'bad-request' || word === 'too-many' ? 'never' : 'later';
    },
  };
}

/**
 * The cloud of this browser. The client is loaded here and nowhere else, and only when an account
 * starts, so a game with no project configured never downloads it.
 * `key` is the publishable key: it is public by design. The secret key has no business in a browser.
 */
export async function connectSupabase(url: string, key: string, options: CloudOptions = {}): Promise<Cloud> {
  const { createClient } = await import('@supabase/supabase-js');
  // A request that never gets an answer would hold up everything after it: the mirror sends one thing at a time.
  const patient: typeof fetch = (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(PATIENCE) });
  // A storage is named only where there is one: the browser's client is made as it always was.
  const { storage, autoRefresh = true } = options;
  const auth = { persistSession: true, autoRefreshToken: autoRefresh, detectSessionInUrl: true, flowType: 'pkce' as const, ...(storage ? { storage } : {}) };
  // What is counted goes through a client of its own, made the first time something is counted: it has no session to send (`accessToken` answers
  // none, and it keeps and renews nothing), so a call carries the publishable key and no player's token.
  let counting: SupabaseClient | null = null;
  const countingClient = () => (counting ??= createClient(url, key, { accessToken: async () => null, global: { fetch: patient } }));
  return cloudOf(createClient(url, key, { auth, global: { fetch: patient } }), options, countingClient);
}
