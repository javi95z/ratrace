/**
 * Tries the real thing, end to end, against the linked Supabase project: two guests sign in
 * through the public API with the publishable key, and the game's own rules are tried as a
 * browser would meet them. Then a whole life played here is sent to the `engine` function, which
 * must find the same end. Run it with `pnpm online:live-check`. It needs the network, the two
 * values of `apps/web/.env.local`, and the Supabase CLI logged in (to remove the two guests after).
 *
 * The SQL tests prove the policies; this proves the project is set up to let a guest in and that
 * the deployed function is the engine this checkout has.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { content, CONTENT_VERSION, lives, replayLife } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, stateHash } from '@ratrace/engine';
import type { LoggedRound } from '@ratrace/engine';
import { createClient } from '@supabase/supabase-js';
import { fingerprintOf, scrub } from '../../../supabase/functions/_shared/errors.ts';
import { rowsOf } from './errors-list';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// The two public values are read from the game's own file. A second checkout of the repository has no such
// file of its own, and names the first one's instead of holding a copy of it.
const envFile = process.env.RATRACE_ENV_FILE ?? fileURLToPath(new URL('../../../apps/web/.env.local', import.meta.url));

/** Reads the two public values. Nothing here is printed. */
function settings(): { url: string; key: string } {
  if (!existsSync(envFile)) throw new Error('apps/web/.env.local is missing: copy .env.example and fill in the two values');
  const lines = Object.fromEntries(
    readFileSync(envFile, 'utf8')
      .split('\n')
      .filter((line) => /^\s*[A-Z_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
  ) as Record<string, string>;
  const url = lines.NEXT_PUBLIC_SUPABASE_URL;
  const key = lines.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('apps/web/.env.local needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (/secret|service_role/i.test(key) || claimsRole(key) === 'service_role') throw new Error('that is a secret key: only the publishable key belongs in apps/web/.env.local');
  return { url, key };
}

/** The role inside a key of the older kind, which is a token. Null for anything else. */
function claimsRole(key: string): string | null {
  try {
    return (JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8')) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** The status a function answered with: 200 if it answered well, 0 if it never answered at all. */
const statusOf = (result: { error: unknown }): number => {
  if (result.error === null) return 200;
  const context = (result.error as { context?: { status?: number } }).context;
  return typeof context?.status === 'number' ? context.status : 0;
};

/** Asks the linked database through the CLI, as its owner: for the rows this check makes and removes itself. Null if it could not. */
function asOwner(sql: string): Array<Record<string, unknown>> | null {
  const run = spawnSync('supabase', ['db', 'query', '--linked', '--output-format', 'json', sql], { cwd: root, encoding: 'utf8' });
  // A query that fails says why: the check that needed it is the one that fails.
  if (run.status !== 0) console.error(`  supabase db query failed (${run.status ?? run.error?.message}): ${`${run.stderr}`.trim().slice(-300)}`);
  return run.status === 0 ? (rowsOf(`${run.stdout}`) as Array<Record<string, unknown>> | null) : null;
}

const results: Array<{ ok: boolean; what: string }> = [];
const check = (ok: boolean, what: string) => results.push({ ok, what });

/**
 * The game's own way of talking to the account, as far as this check uses it. It is loaded from
 * the web app below, so that what is checked against the real project is the code that is shipped.
 */
interface GameCloud {
  playingGames(): Promise<Array<{ id: string; round: number; status: string; log: unknown }>>;
  ensureProfile(userId: string, language: string): Promise<void>;
  pushGame(game: { id: string; lifeId: string; engineVersion: string; contentVersion: string; seed: string; round: number; log: unknown; stateHash: string }): Promise<'saved' | 'closed' | 'taken' | 'behind'>;
  abandonGame(id: string): Promise<void>;
  loadProgress(): Promise<unknown>;
  saveProgress(progress: unknown): Promise<void>;
  listRuns(): Promise<Array<{ id: string; score: number; badges: string[] }>>;
  finishRun(gameId: string): Promise<'done' | 'refused' | 'unknown-version' | 'failed'>;
}

/** A nurse's life, first choice on every card, and the log of it: the whole of it, or its first rounds. */
function wholeLife(seed: string, rounds = Number.POSITIVE_INFINITY) {
  const start = lives.find((life) => life.id === 'nurse')?.start;
  if (!start) throw new Error('no nurse');
  let state = createGame({ content, start }, seed);
  const log: LoggedRound[] = [];
  while (!state.finished && log.length < rounds) {
    const picks: number[] = [];
    while (state.phase === 'cards') {
      state = applyCard(content, state, 0).state;
      picks.push(0);
    }
    state = applyRound(content, state, { orders: [] }).state;
    log.push({ picks, orders: [] });
  }
  return { state, log };
}

let found: { url: string; key: string };
try {
  found = settings();
} catch (error) {
  console.error(`✗ live check cannot start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
const { url, key } = found;
const guest = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const a = guest();
const b = guest();
const nobody = guest();
const made: string[] = [];
/** The kind of error this check notes, to be removed after it. */
let probe: string | null = null;

try {
  const inA = await a.auth.signInAnonymously();
  // Whoever did get in is noted at once, so that they are removed even if the other did not.
  if (inA.data.user) made.push(inA.data.user.id);
  const inB = await b.auth.signInAnonymously();
  if (inB.data.user) made.push(inB.data.user.id);
  check(!inA.error && !inB.error && inA.data.user?.is_anonymous === true, 'two guests can sign in with no form');
  if (inA.error || inB.error || !inA.data.user || !inB.data.user) throw new Error(`guests cannot sign in: ${(inA.error ?? inB.error)?.message}. Is "Anonymous sign-ins" on in the dashboard? With CAPTCHA protection on, this check cannot make its guests: it has no browser to answer with.`);
  const idA = inA.data.user.id;
  const idB = inB.data.user.id;

  const profileA = await a.from('profiles').upsert({ user_id: idA, language: 'es' }, { onConflict: 'user_id', ignoreDuplicates: true });
  check(profileA.error === null, 'a guest makes their own profile');
  const forged = await a.from('profiles').insert({ user_id: idB, language: 'en' });
  check(forged.error !== null, 'a guest cannot make a profile for someone else');

  const gameId = crypto.randomUUID();
  const saved = await a.from('games').insert({ id: gameId, mode: 'casual', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION, seed: 'live-check' });
  check(saved.error === null, 'a guest saves their own casual game');
  const ranked = await a.from('games').insert({ id: crypto.randomUUID(), mode: 'ranked', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION });
  check(ranked.error !== null, 'a guest cannot make a ranked game');
  const seenByB = await b.from('games').select('id').eq('id', gameId);
  check(seenByB.error === null && seenByB.data.length === 0, 'another guest cannot see that game');
  const changedByB = await b.from('games').update({ round: 9 }).eq('id', gameId).select('id');
  check((changedByB.data ?? []).length === 0, 'another guest cannot change that game');
  const secrets = await a.from('game_secrets').select('game_id');
  check(secrets.error !== null, 'no player can read the secrets of ranked games');
  const forgedRun = await a.from('runs').insert({ id: crypto.randomUUID(), user_id: idA, mode: 'casual', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION, score: 999999, net_worth: 1, status: 1, finished_at: new Date().toISOString() });
  check(forgedRun.error !== null, 'no player can write a finished run');
  const profilesByB = await b.from('profiles').select('user_id').eq('user_id', idA);
  check(profilesByB.error === null && profilesByB.data.length === 1, 'any signed-in player can read a profile');
  const byNobody = await nobody.from('profiles').select('user_id');
  check(byNobody.error !== null || (byNobody.data ?? []).length === 0, 'a visitor with no account reads nothing');

  // The engine on the server, asked by a signed-in guest, against the engine in this checkout.
  const life = wholeLife('live-check-parity');
  const replayed = await a.functions.invoke('engine', { body: { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 'live-check-parity', log: life.log } });
  const answer = replayed.data as { hash?: string; score?: number; finished?: boolean } | null;
  // When the server does not play the life, what it answered is the first thing to know.
  if (replayed.error) {
    const context = (replayed.error as { context?: { text?: () => Promise<string> } }).context;
    console.error(`  the engine function answered ${statusOf(replayed)}: ${(await context?.text?.().catch(() => '')) ?? replayed.error.message}`);
  }
  check(replayed.error === null && answer?.finished === true, 'the engine function plays a whole life for a signed-in guest');
  check(answer?.hash === stateHash(life.state), 'the server ends that life on the same state as this checkout does');
  check(answer?.score === finalScore(content, life.state), 'and gives it the same score');
  const unknown = await a.functions.invoke('engine', { body: { engineVersion: '9.9.9', contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 's', log: [] } });
  check(statusOf(unknown) === 409, 'the server refuses versions it does not hold');
  const unsigned = await nobody.functions.invoke('engine', { body: { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 's', log: [] } });
  check(statusOf(unsigned) === 401, 'the engine function refuses a caller with no account');

  // A whole life, saved as the game saves it and finished by the server.
  const start = lives.find((one) => one.id === 'nurse')?.start;
  if (!start) throw new Error('no nurse');
  const mine = replayLife(content, start, 'live-check-parity', life.log);
  const lifeId = crypto.randomUUID();
  const uploaded = await a.from('games').insert({ id: lifeId, mode: 'casual', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION, seed: 'live-check-parity', round: content.rounds, log: life.log, state_hash: stateHash(life.state) });
  check(uploaded.error === null, 'a guest saves a whole life to their account');
  const early = await a.functions.invoke('finish-run', { body: { gameId } });
  check(statusOf(early) === 409, 'the server does not finish a life that is not over');
  const notMine = await b.functions.invoke('finish-run', { body: { gameId: lifeId } });
  check(statusOf(notMine) === 404, 'nobody can finish a life that is not theirs');
  const finished = await a.functions.invoke('finish-run', { body: { gameId: lifeId, score: 999_999 } });
  const run = (finished.data as { run?: { score: number; net_worth: number; badges: string[]; history: number[]; verified: boolean } } | null)?.run;
  check(statusOf(finished) === 200 && run?.verified === true, 'the server finishes a life that is over, and writes the run itself');
  check(run?.score === finalScore(content, life.state), 'with the score this checkout gives it, not the one the client sent');
  check(JSON.stringify(run?.badges) === JSON.stringify(mine.journal.earned) && JSON.stringify(run?.history) === JSON.stringify(mine.history), 'and the same badges and net-worth history');
  const again = await a.functions.invoke('finish-run', { body: { gameId: lifeId } });
  const stored = await b.from('runs').select('id, score').eq('id', lifeId);
  check(statusOf(again) === 200 && stored.data?.length === 1 && stored.data[0].score === run?.score, 'asked twice, it is written once, and any signed-in player can read it');
  const rewritten = await a.from('games').update({ seed: 'another' }).eq('id', lifeId).select('id');
  check((rewritten.data ?? []).length === 0, 'a finished life is closed to its owner');
  const removed = await a.from('games').delete().eq('id', gameId).select('id');
  check(removed.error !== null || (removed.data ?? []).length === 0, 'a player cannot delete a game');

  // What is unlocked, as the game keeps it.
  const kept = await a.from('player_progress').upsert({ user_id: idA, progress: { badges: { first_100k: { at: 1, gameId: lifeId } }, gallery: ['watch_casio'] } }, { onConflict: 'user_id' });
  const readBack = await a.from('player_progress').select('progress').eq('user_id', idA);
  const seenByOther = await b.from('player_progress').select('user_id').eq('user_id', idA);
  check(kept.error === null && readBack.data?.length === 1 && seenByOther.data?.length === 0, 'a player keeps what they have unlocked, and only they can read it');

  // Cloud saves, through the game's own code: one player on two devices, and another player beside them.
  const adapter = fileURLToPath(new URL('../../../apps/web/src/online/connect.ts', import.meta.url));
  const { cloudOf } = (await import(adapter)) as { cloudOf(client: unknown): GameCloud };
  const session = (await a.auth.getSession()).data.session;
  if (!session) throw new Error('the first guest has no session to take to a second device');
  const a2 = guest();
  await a2.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  const [phone, laptop, stranger] = [cloudOf(a), cloudOf(a2), cloudOf(b)];

  // The profile, written the way the game writes it on every launch: made, then written again in another language.
  // A player may write four columns of their profile and no more; this is the write that must fit in them.
  const written = await phone.ensureProfile(idA, 'en').then(() => stranger.ensureProfile(idB, 'es')).then(() => stranger.ensureProfile(idB, 'en')).then(() => null, (error: unknown) => error);
  const mine2 = await b.from('profiles').select('language, friend_code').eq('user_id', idB).maybeSingle();
  check(written === null && mine2.data?.language === 'en', 'the game writes a player\'s profile, and writes it again, within what a player may write');
  check(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(String(mine2.data?.friend_code)), 'and the server gives the player a friend code');

  const early3 = wholeLife('live-check-two-devices', 3);
  const early5 = wholeLife('live-check-two-devices', 5);
  const shared = crypto.randomUUID();
  const upload = (played: { state: { round: number }; log: LoggedRound[] }, id = shared, seed = 'live-check-two-devices') => ({
    id,
    lifeId: 'nurse',
    engineVersion: ENGINE_VERSION,
    contentVersion: CONTENT_VERSION,
    seed,
    round: played.state.round,
    log: played.log,
    stateHash: stateHash(played.state as never),
  });
  check((await phone.pushGame(upload(early3))) === 'saved', 'the game saves a life in progress to the account');
  const onLaptop = (await laptop.playingGames()).find((game) => game.id === shared);
  // The database keeps what it is given, not the order of its keys.
  check(onLaptop?.round === 3 && isDeepStrictEqual(onLaptop.log, early3.log), 'a second device signed in as the same player finds that life, choice for choice');
  check((await laptop.pushGame(upload(early5))) === 'saved' && (await phone.playingGames()).find((game) => game.id === shared)?.round === 5, 'played further there, the first device finds it further along');
  // The first device has not looked since, and sends the older copy it still holds.
  check((await phone.pushGame(upload(early3))) === 'behind' && (await laptop.playingGames()).find((game) => game.id === shared)?.round === 5, 'an older copy does not go over the further one: the game is told the account is further along');
  // Another player's device holding a life under that same id: the guest this device was, before its player signed in as someone else.
  check((await stranger.pushGame(upload(early5))) === 'taken' && (await stranger.playingGames()).length === 0, 'another account saving under that id is told the id is taken, and nothing of it is written');
  await laptop.abandonGame(shared);
  check(!(await phone.playingGames()).some((game) => game.id === shared), 'given up on one device, it is no longer offered to the other');
  check((await phone.pushGame(upload(early5))) === 'saved' && (await laptop.playingGames()).some((game) => game.id === shared), 'and the device still playing it takes it up again');

  const unlocked = { badges: { first_100k: { at: 1, gameId: shared } }, gallery: ['watch_casio'], unlocked: {}, guide: { seen: ['news'], off: false } };
  await phone.saveProgress(unlocked);
  check(isDeepStrictEqual(await laptop.loadProgress(), unlocked), 'what is unlocked on one device is found on the other');

  const whole = crypto.randomUUID();
  const pushed = await phone.pushGame(upload(life, whole, 'live-check-parity'));
  const done = await phone.finishRun(whole);
  const there = (await laptop.listRuns()).find((one) => one.id === whole);
  check(pushed === 'saved' && done === 'done' && there?.score === finalScore(content, life.state), 'a life finished on one device is among the finished lives of the other, with the server\'s score');
  check(JSON.stringify(there?.badges) === JSON.stringify(mine.journal.earned), 'and with the badges of that life');
  check((await phone.pushGame(upload(life, whole, 'live-check-parity'))) === 'closed', 'the game is told that a life the server has finished is closed');
  check((await phone.finishRun(crypto.randomUUID())) === 'refused', 'and that the server will not finish a life it was never sent');
  const other = crypto.randomUUID();
  await phone.pushGame({ ...upload(life, other, 'live-check-parity'), engineVersion: '9.9.9' });
  check((await phone.finishRun(other)) === 'unknown-version', 'and that it does not hold versions it does not hold, which is not the same as no');
  await phone.abandonGame(other);
  const theirs = [await stranger.playingGames(), await stranger.listRuns()] as const;
  check(theirs[0].length === 0 && !theirs[1].some((one) => one.id === whole) && (await stranger.loadProgress()) === null, 'another player finds none of it in their own account');

  // A ranked life: the server keeps the seed and plays every step. Played here to its end, a step at a time.
  type Answer = { data: Record<string, unknown> | null; error: unknown };
  const askRanked = (who: typeof a, body: Record<string, unknown>) => who.functions.invoke('ranked', { body }) as Promise<Answer>;
  const versions = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
  const given = await askRanked(a, { action: 'start', lifeId: 'nurse', ...versions });
  const first = given.data as { gameId: string; step: number; view: { phase: string; finished: boolean; round: number; timeline: unknown[] } } | null;
  check(statusOf(given) === 200 && first?.step === 0 && first.view.timeline.length === 1 && !('seed' in first.view) && !('rng' in first.view), 'the server starts a ranked life, and answers a view with no seed, no dice and no world to come');
  if (!first) throw new Error('no ranked life was started');
  const rankedId = first.gameId;
  const row = await a.from('games').select('mode, seed, status, log').eq('id', rankedId).maybeSingle();
  const hidden = await a.from('game_secrets').select('seed').eq('game_id', rankedId);
  check(row.data?.mode === 'ranked' && row.data.seed === null && hidden.error !== null, 'its player can see the game and not its seed');
  const forced = await a.from('games').update({ round: 19, log: [] }).eq('id', rankedId).select('id');
  check((forced.data ?? []).length === 0, 'and cannot write to it');
  check(statusOf(await askRanked(b, { action: 'view', gameId: rankedId })) === 404, 'another player knows nothing of it');

  let standing = first.view;
  let at = 0;
  const once = await askRanked(a, { action: 'card', gameId: rankedId, step: 0, option: 0 });
  const twice = await askRanked(a, { action: 'card', gameId: rankedId, step: 0, option: 0 });
  check(statusOf(once) === 200 && isDeepStrictEqual(once.data, twice.data), 'a step asked for twice is played once, and answered the same');
  check(statusOf(await askRanked(a, { action: 'card', gameId: rankedId, step: 7, option: 0 })) === 409, 'a step that is not the next is refused');
  const take = (answer: Answer) => {
    const body = answer.data as { step: number; view: typeof standing; world: unknown | null };
    at = body.step;
    standing = { ...body.view, timeline: body.world ? [...standing.timeline, body.world] : standing.timeline };
  };
  take(once);
  let leaked = false;
  let lastAnswer: Answer = once;
  for (let guard = 0; guard < 400 && !standing.finished; guard++) {
    lastAnswer = await askRanked(a, standing.phase === 'cards' ? { action: 'card', gameId: rankedId, step: at, option: 0 } : { action: 'round', gameId: rankedId, step: at, orders: [] });
    if (statusOf(lastAnswer) !== 200) throw new Error(`a ranked step was refused with ${statusOf(lastAnswer)}`);
    take(lastAnswer);
    // What a client holds never runs ahead of the round it is in.
    if (standing.timeline.length !== standing.round + 1) leaked = true;
  }
  const rankedRun = (lastAnswer.data as { run?: { id: string; mode: string; verified: boolean; score: number; history: number[] } } | null)?.run;
  check(standing.finished && !leaked && rankedRun?.mode === 'ranked' && rankedRun.verified === true && rankedRun.history.length === content.rounds + 1, 'the life is played to its end on the server, which writes the run as a ranked one');
  const closedNow = await a.from('games').select('status, round').eq('id', rankedId).maybeSingle();
  check(closedNow.data?.status === 'finished' && closedNow.data.round === content.rounds, 'and closes the game');

  // Names and friends, and the ranking that reads them.
  const badName = await a.from('profiles').update({ nickname: 'Sh1t_head' }).eq('user_id', idA);
  const goodName = await a.from('profiles').update({ nickname: `check_${idA.slice(0, 8)}` }).eq('user_id', idA);
  check((badName.error as { code?: string } | null)?.code === 'RR002' && goodName.error === null, 'a name is refused for what it says, and an innocent one is taken');
  const codeOfA = (await a.from('profiles').select('friend_code').eq('user_id', idA).maybeSingle()).data?.friend_code as string;
  const followed = await b.rpc('add_friend', { code: codeOfA.toLowerCase() });
  check(followed.data === 'ok' && (await b.rpc('add_friend', { code: 'ZZZZZZZZ' })).data === 'unknown', 'a player follows another by their code, and nobody by a code that is nobody\'s');
  const board = await b.rpc('ranking', { period: 'week', friends: true });
  const placed = ((board.data ?? []) as Array<{ user_id: string; score: number; nickname: string | null; place: number }>).find((one) => one.user_id === idA);
  check(board.error === null && placed?.score === rankedRun?.score && placed?.nickname === `check_${idA.slice(0, 8)}`, 'the ranked life is in the ranking of the week among friends, under its player\'s name');
  const everyone = await a.rpc('ranking', { top: 100 });
  check(everyone.error === null && ((everyone.data ?? []) as Array<{ user_id: string }>).some((one) => one.user_id === idA) && (await nobody.rpc('ranking')).error !== null, 'and in the ranking of all time, which a visitor with no account cannot read');

  const another = await askRanked(a, { action: 'start', lifeId: 'nurse', ...versions });
  const second = (another.data as { gameId: string } | null)?.gameId ?? '';
  // A player has one ranked life in progress. Another is not started over it unasked: the server says which is in the way.
  const refused = await askRanked(a, { action: 'start', lifeId: 'nurse', ...versions });
  const context = (refused.error as { context?: unknown } | null)?.context;
  const inTheWay = context instanceof Response ? ((await context.clone().json().catch(() => null)) as { error?: string; gameId?: string } | null) : null;
  const untouched = await a.from('games').select('status').eq('id', second).maybeSingle();
  check(statusOf(another) === 200 && statusOf(refused) === 409 && inTheWay?.error === 'in-progress' && inTheWay.gameId === second && untouched.data?.status === 'playing', 'a ranked life in progress is not ended by starting another: the server says which one is in the way');
  const third = await askRanked(a, { action: 'start', lifeId: 'nurse', ...versions, replace: second });
  const firstOfTwo = await a.from('games').select('status').eq('id', second).maybeSingle();
  check(statusOf(third) === 200 && firstOfTwo.data?.status === 'abandoned', 'and it is given up for the new one when the request names it');
  const givenUp = await askRanked(a, { action: 'abandon', gameId: (third.data as { gameId: string }).gameId });
  check(statusOf(givenUp) === 200 && statusOf(await askRanked(a, { action: 'view', gameId: (third.data as { gameId: string }).gameId })) === 409, 'and a ranked life can be given up');

  // ---------------------------------------------------------------- errors
  // A page's error, sent as the game sends it. The kind is put there first, as if it had been seen a moment ago: the
  // report is then the same kind again, which is noted and sends no alert, so this check never wakes anyone up.
  const word = Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => 'abcdefghijklmnopqrstuvwxyz'[byte % 26]).join('');
  const said = `live check probe ${word} for ana@example.com`;
  const keptSaid = scrub(said);
  probe = await fingerprintOf('page', '/play', keptSaid, null);
  const seeded = asOwner(`insert into public.error_kinds (fingerprint, source, place, message, seen, first_seen, last_seen, alerted_at) values ('${probe}', 'page', '/play', '${keptSaid}', 1, now(), now(), now()) returning seen`);
  const reported = await a.functions.invoke('report-error', { body: { reports: [{ message: said, stack: null, place: '/es/play?code=QQQ#x', build: 'live-check', browser: 'live-check' }] } });
  const noted = asOwner(`select seen, place, message, build, browser from public.error_kinds where fingerprint = '${probe}'`)?.[0];
  // When the report does not go through, what each step gave is the first thing to know.
  if (seeded === null || statusOf(reported) !== 200 || (reported.data as { noted?: number } | null)?.noted !== 1 || noted?.seen !== 2) {
    const context = (reported.error as { context?: { text?: () => Promise<string> } } | null)?.context;
    const answer = reported.error ? ((await context?.text?.().catch(() => '')) ?? reported.error.message) : JSON.stringify(reported.data);
    console.error(`  the errors check saw: seeded ${JSON.stringify(seeded)}, report-error answered ${statusOf(reported)}: ${answer}, kept ${JSON.stringify(noted ?? null)}`);
  }
  check(seeded !== null && statusOf(reported) === 200 && (reported.data as { noted?: number } | null)?.noted === 1, 'a signed-in player reports the errors of a page');
  check(noted?.seen === 2 && noted.place === '/play' && noted.message === keptSaid && noted.build === 'live-check', 'the server keeps them by kind, cleaned: no address, no query, no language');
  check(statusOf(await nobody.functions.invoke('report-error', { body: { reports: [{ message: 'x', place: '/' }] } })) === 401, 'nobody with no account can report one');
  check(statusOf(await a.functions.invoke('report-error', { body: { reports: [] } })) === 400, 'and nothing that is not a batch of reports is taken');
  const peeked = await a.from('error_kinds').select('fingerprint').limit(1);
  const forgedNote = await a.rpc('note_error', { p_fingerprint: 'x', p_source: 'page', p_place: '/', p_message: 'x', p_stack: null, p_build: null, p_browser: null, p_now: new Date().toISOString() });
  check((peeked.error !== null || (peeked.data ?? []).length === 0) && forgedNote.error !== null, 'no player can read the errors kept, or note one past the function');

  // ---------------------------------------------------------------- rooms
  // The two guests open a room and join it, hear of it through Realtime, and play it through the real function a round
  // at a time: alike for three rounds, then one leaves while the other waits, which turns the round, and the other plays
  // it alone to its end.
  type Member = { userId: string; name: string | null; me: boolean; host: boolean; ready: boolean; left: boolean; standing: { score: number } | null };
  type Room = { id: string; code: string; status: string; round: number; rounds: number; deadline: string | null; now: string; members: Member[] };
  type Life = { step: number; view: { phase: string; finished: boolean; round: number; answered: number }; events: unknown[]; run?: { mode: string; verified: boolean; score: number } };
  const askRoom = (who: typeof a, body: Record<string, unknown>) => who.functions.invoke('rooms', { body }) as Promise<Answer>;
  const roomIn = (answer: Answer) => (answer.data as { room?: Room } | null)?.room ?? null;
  const lifeIn = async (who: typeof a, roomId: string) => (await askRoom(who, { action: 'view', roomId })).data as Life | null;
  /** Answers every card of the member's hand with its first option, then plays the round with no orders. */
  const playRound = async (who: typeof a, roomId: string) => {
    let life = await lifeIn(who, roomId);
    while (life && !life.view.finished && life.view.phase === 'cards') {
      const card = await askRoom(who, { action: 'card', roomId, step: life.step, option: 0 });
      if (statusOf(card) !== 200) throw new Error(`a card in the room was refused with ${statusOf(card)}`);
      life = { ...life, step: (card.data as { step: number }).step, view: (card.data as { view: Life['view'] }).view };
    }
    if (!life) throw new Error('the room has no life for this guest');
    const played = await askRoom(who, { action: 'submit', roomId, step: life.step, orders: [] });
    if (statusOf(played) !== 200) throw new Error(`a round in the room was refused with ${statusOf(played)}`);
    return played;
  };

  const opened = await askRoom(a, { action: 'open', lifeId: 'nurse', seconds: 90, ...versions });
  const room = roomIn(opened);
  check(statusOf(opened) === 200 && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(room?.code ?? '') && room?.status === 'open', 'a guest opens a room, with a code of six characters');
  if (!room) throw new Error('no room was opened');
  const joined = await askRoom(b, { action: 'join', code: ` ${room.code.toLowerCase()} `, ...versions });
  const roomForB = roomIn(joined);
  check(statusOf(joined) === 200 && roomForB?.members.length === 2 && roomForB.members[0].name === `check_${idA.slice(0, 8)}` && roomForB.members[1].me, 'another guest joins it by its code, typed any way, and sees who opened it by name');
  const tables = await b.from('rooms').select('id').eq('id', room.id);
  const ordersSeen = await b.from('room_orders').select('round');
  const strangers = await nobody.from('rooms').select('id');
  check(tables.data?.length === 1 && ordersSeen.error !== null && (strangers.error !== null || (strangers.data ?? []).length === 0), 'a member reads their room; nobody reads the orders kept for a round, and a visitor reads no room');
  check(statusOf(await askRoom(b, { action: 'start', roomId: room.id })) === 403, 'only the host starts the room');

  // B listens to the room as a page in it does, and hears of it starting.
  const heard: string[] = [];
  // SUBSCRIBED comes before the database is listened to for this channel: Realtime says so on its own, in a message of the system.
  let ready = false;
  const channel = b
    .channel(`room:${room.id}`)
    .on('system', {}, (message: { extension?: string; status?: string }) => {
      if (message.extension === 'postgres_changes' && message.status === 'ok') ready = true;
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (change) => heard.push(`rooms:${change.eventType}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` }, (change) => heard.push(`room_players:${change.eventType}`));
  const subscribed = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 15_000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
  for (let waited = 0; waited < 10_000 && !ready; waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
  const listening = subscribed && ready;
  const started = await askRoom(a, { action: 'start', roomId: room.id });
  const playing = roomIn(started);
  const due = playing?.deadline ? Date.parse(playing.deadline) - Date.parse(playing.now) : 0;
  // Due ninety seconds after the server started it, by the server's clock; the answer's own moment is a little later.
  check(statusOf(started) === 200 && playing?.status === 'playing' && playing.round === 0 && due > 85_000 && due <= 90_000, 'the host starts it, and its first round is due in the seconds the room was opened with');
  for (let waited = 0; waited < 10_000 && !heard.includes('rooms:UPDATE'); waited += 250) await new Promise((resolve) => setTimeout(resolve, 250));
  check(listening && heard.includes('rooms:UPDATE'), 'a member hears through Realtime that their room has changed');

  // Three rounds alike: both lives stay alike, and neither sees the other before a round turns.
  const lifeA0 = await lifeIn(a, room.id);
  const lifeB0 = await lifeIn(b, room.id);
  check(lifeA0 !== null && lifeB0 !== null && JSON.stringify(lifeA0.view) === JSON.stringify(lifeB0.view) && !('seed' in (lifeA0.view as object)), 'every member begins exactly alike, and is shown no seed');
  let alike = true;
  let unseen = true;
  for (let round = 0; round < 3; round++) {
    const waiting = roomIn(await playRound(a, room.id));
    const meanwhile = roomIn(await askRoom(b, { action: 'state', roomId: room.id }));
    if (!meanwhile?.members[0].ready || meanwhile.members.some((m) => m.standing !== null && round === 0) || waiting?.round !== round) unseen = false;
    const turned = await playRound(b, room.id);
    const result = (turned.data as { result?: { view: { round: number } } } | null)?.result;
    if (result?.view.round !== round + 1) unseen = false;
    if (JSON.stringify((await lifeIn(a, room.id))?.view) !== JSON.stringify((await lifeIn(b, room.id))?.view)) alike = false;
  }
  check(unseen, 'a member who has played waits, shown only as ready; the last to play turns the round and is answered it');
  check(alike, 'two members who choose alike live alike, round after round');

  // A plays the fourth round and waits; B leaves, which gives B's life up and turns the round for A.
  await playRound(a, room.id);
  const left = await askRoom(b, { action: 'leave', roomId: room.id });
  const afterLeaving = roomIn(await askRoom(a, { action: 'state', roomId: room.id }));
  const bGame = await b.from('games').select('status, mode').eq('room', room.id).maybeSingle();
  check(statusOf(left) === 200 && afterLeaving?.round === 4 && afterLeaving.members[1].left && bGame.data?.status === 'abandoned' && bGame.data.mode === 'room', 'a member who leaves gives their life up, and the room stops waiting for them');

  // A plays on alone to the end: each round turns as soon as it is played.
  let last: Answer | null = null;
  for (let round = 4; round < content.rounds; round++) last = await playRound(a, room.id);
  const ended = roomIn(last as Answer);
  const finalLife = await lifeIn(a, room.id);
  const roomRun = await a.from('runs').select('mode, verified, score').eq('game_id', (await a.from('games').select('id').eq('room', room.id).maybeSingle()).data?.id ?? '').maybeSingle();
  check(ended?.status === 'finished' && finalLife?.view.finished === true && roomRun.data?.mode === 'room' && roomRun.data.verified === true && ended.members[0].standing?.score === roomRun.data.score && finalLife.run?.score === roomRun.data.score,
    'the room ends after its last round with a run of its own for the life, written by the server, and the room\'s order by score');
  check(statusOf(await askRoom(a, { action: 'leave', roomId: room.id })) === 200 && roomIn(await askRoom(a, { action: 'mine' })) === null, 'a member leaves a room that is over, and is in none');
  await b.removeChannel(channel);
} catch (error) {
  check(false, error instanceof Error ? error.message : String(error));
} finally {
  // The kind of error noted here goes, and nothing else of the errors.
  if (probe !== null && /^[0-9a-f]{32}$/.test(probe)) check(asOwner(`delete from public.error_kinds where fingerprint = '${probe}' returning fingerprint`)?.length === 1, 'the error noted was removed afterwards');
  // The two guests and everything of theirs go, so the project is left as it was found.
  if (made.length > 0 && made.every((id) => /^[0-9a-f-]{36}$/.test(id))) {
    const gone = spawnSync('supabase', ['db', 'query', '--linked', `delete from auth.users where id in (${made.map((id) => `'${id}'`).join(', ')})`], { cwd: root, encoding: 'utf8' });
    check(gone.status === 0, 'the two guests were removed afterwards');
  }
}

for (const { ok, what } of results) console.log(`  ${ok ? '✓' : '✗'} ${what}`);
const broken = results.filter((result) => !result.ok).length;
console.log(`${broken === 0 ? '✓' : '✗'} live check: ${results.length - broken} held, ${broken} broken`);
process.exit(broken === 0 ? 0 : 1);
