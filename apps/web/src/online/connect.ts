import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { CloudGame } from './merge';
import type { CloudRun } from './mirror';
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
  updated_at: string;
}
interface RunRow {
  id: string;
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
  id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, seed: row.seed, round: row.round, status: row.status, log: row.log, updatedAt: row.updated_at,
});
const runOf = (row: RunRow): CloudRun => ({
  id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, score: row.score, netWorth: row.net_worth, status: row.status,
  escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies, badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: row.finished_at,
});

/** The database's own word for "the rules of this table do not let you": a life the server has finished, for one. */
const NOT_ALLOWED = '42501';
/** The answers the `finish-run` function gives of its own accord. Asked again, it would give the same. */
const REFUSALS = new Set([400, 404, 409, 422]);

/**
 * The cloud, made from a Supabase client. Every table it touches is guarded in the database: a
 * player reads and writes their own rows and nothing else, whatever this code asks for.
 */
export function cloudOf(client: SupabaseClient): Cloud {
  /** Who is signed in, for the two things that must name their owner. */
  const me = async (): Promise<string> => {
    const { data } = await client.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('nobody is signed in');
    return id;
  };
  return {
    async currentUser() {
      // A stored session that could not be renewed comes back as no session and an error. That is
      // not "nobody is signed in": said so, the game would make a new guest over the stored player.
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return userOf(data.session?.user);
    },
    async signInAsGuest() {
      const { data, error } = await client.auth.signInAnonymously();
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
        .select('id, life_id, engine_version, content_version, seed, round, status, log, updated_at')
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
      // The server has finished this life: it is closed to its owner, and that is not a failure.
      if (error.code === NOT_ALLOWED) return 'closed';
      throw error;
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
        .select('id, life_id, engine_version, content_version, score, net_worth, status, escaped_at_round, bankruptcies, badges, cities, history, finished_at')
        .eq('user_id', await me())
        .order('finished_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as RunRow[]).map(runOf);
    },
    async finishRun(gameId) {
      const { error } = await client.functions.invoke('finish-run', { body: { gameId } });
      if (!error) return 'done';
      // The function said no: asking again will not change its mind. Anything else (no network, the
      // server down, a session that has just run out) is worth another try.
      const status = (error as { context?: { status?: unknown } }).context?.status;
      return typeof status === 'number' && REFUSALS.has(status) ? 'refused' : 'failed';
    },
  };
}

/**
 * The cloud of this browser. The client is loaded here and nowhere else, and only when an account
 * starts, so a game with no project configured never downloads it.
 * `key` is the publishable key: it is public by design. The secret key has no business in a browser.
 */
export async function connectSupabase(url: string, key: string): Promise<Cloud> {
  const { createClient } = await import('@supabase/supabase-js');
  return cloudOf(createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }));
}
