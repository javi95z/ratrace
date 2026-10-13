import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Captcha } from './captcha';
import type { CloudGame } from './merge';
import type { CloudRun } from './mirror';
import { rankedApi } from './ranked';
import type { Cloud, CloudUser } from './supabase';

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
}

const gameOf = (row: GameRow): CloudGame => ({
  id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, seed: row.seed, round: row.round, status: row.status, log: row.log, stateHash: row.state_hash, updatedAt: row.updated_at,
});
const runOf = (row: RunRow): CloudRun => ({
  id: row.id, mode: row.mode === 'ranked' ? 'ranked' : 'casual', lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, score: row.score, netWorth: row.net_worth, status: row.status,
  escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies, badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: row.finished_at,
});

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

/** What a build may say about its cloud beyond where it is. */
export interface CloudOptions {
  /** The region the database is in, as the platform names it (ap-northeast-1). Named, the function that uses the database most is asked for there. */
  region?: string;
  /** The guard at the door of guest sign-in, where the project has one. */
  captcha?: Captcha;
}

/**
 * The cloud, made from a Supabase client. Every table it touches is guarded in the database: a
 * player reads and writes their own rows and nothing else, whatever this code asks for.
 */
export function cloudOf(client: SupabaseClient, { region, captcha }: CloudOptions = {}): Cloud {
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
    async linkGoogle(redirectTo) {
      // On success the client itself sends the browser to Google.
      const { error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async signInWithGoogle(redirectTo) {
      // Replaces whoever is signed in here with the player the Google account belongs to.
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
      return error === null;
    },
    async ensureProfile(userId, language) {
      const { error } = await client.from('profiles').upsert({ user_id: userId, language }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onUser(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(userOf(session?.user)));
      return () => data.subscription.unsubscribe();
    },

    async playingGames() {
      const { data, error } = await client
        .from('games')
        .select('id, life_id, engine_version, content_version, seed, round, status, log, state_hash, updated_at')
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
        { id: game.id, mode: 'casual', status: 'playing', life_id: game.lifeId, engine_version: game.engineVersion, content_version: game.contentVersion, seed: game.seed, round: game.round, log: game.log, state_hash: game.stateHash || null },
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
        .select('id, mode, life_id, engine_version, content_version, score, net_worth, status, escaped_at_round, bankruptcies, badges, cities, history, finished_at')
        .eq('user_id', await me())
        .order('finished_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as RunRow[]).map(runOf);
    },
    async rankedLife() {
      // A player has one ranked life in progress at most, and sees no game but their own.
      const { data, error } = await client.from('games').select('id, life_id, engine_version, content_version').eq('mode', 'ranked').eq('status', 'playing').limit(1).maybeSingle();
      if (error) throw error;
      const row = data as { id: string; life_id: string; engine_version: string; content_version: string } | null;
      return row === null ? null : { id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version };
    },
    giveUpRanked: (id) => ranked.abandon(id),
    ranked,
    community: {
      async me() {
        try {
          const { data, error } = await client.from('profiles').select('nickname, friend_code').eq('user_id', await me()).maybeSingle();
          const row = data as { nickname: string | null; friend_code: string } | null;
          return error || row === null ? null : { nickname: row.nickname, friendCode: row.friend_code };
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
      async friends() {
        try {
          const followed = await client.from('friendships').select('followed').eq('follower', await me()).order('created_at', { ascending: false });
          if (followed.error) return null;
          const ids = ((followed.data ?? []) as Array<{ followed: string }>).map((row) => row.followed);
          if (ids.length === 0) return [];
          const named = await client.from('profiles').select('user_id, nickname').in('user_id', ids);
          if (named.error) return null;
          const names = new Map(((named.data ?? []) as Array<{ user_id: string; nickname: string | null }>).map((row) => [row.user_id, row.nickname]));
          return ids.map((userId) => ({ userId, nickname: names.get(userId) ?? null }));
        } catch {
          return null;
        }
      },
      async follow(code) {
        try {
          const { data, error } = await client.rpc('add_friend', { code });
          return !error && (data === 'ok' || data === 'unknown' || data === 'self' || data === 'full') ? data : 'failed';
        } catch {
          return 'failed';
        }
      },
      async unfollow(userId) {
        try {
          const { error } = await client.from('friendships').delete().eq('follower', await me()).eq('followed', userId);
          return error === null;
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
  return cloudOf(createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }, global: { fetch: patient } }), options);
}
