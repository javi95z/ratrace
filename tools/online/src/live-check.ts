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
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, stateHash } from '@ratrace/engine';
import type { LoggedRound } from '@ratrace/engine';
import { createClient } from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const envFile = fileURLToPath(new URL('../../../apps/web/.env.local', import.meta.url));

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
  if (/secret|service_role/i.test(key)) throw new Error('that is a secret key: only the publishable key belongs in apps/web/.env.local');
  return { url, key };
}

const results: Array<{ ok: boolean; what: string }> = [];
const check = (ok: boolean, what: string) => results.push({ ok, what });

/** A nurse's whole life, first choice on every card, and the log of it. */
function wholeLife(seed: string) {
  const start = lives.find((life) => life.id === 'nurse')?.start;
  if (!start) throw new Error('no nurse');
  let state = createGame({ content, start }, seed);
  const log: LoggedRound[] = [];
  while (!state.finished) {
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

try {
  const inA = await a.auth.signInAnonymously();
  const inB = await b.auth.signInAnonymously();
  check(!inA.error && !inB.error && inA.data.user?.is_anonymous === true, 'two guests can sign in with no form');
  if (inA.error || inB.error || !inA.data.user || !inB.data.user) throw new Error(`guests cannot sign in: ${(inA.error ?? inB.error)?.message}. Is "Anonymous sign-ins" on in the dashboard?`);
  const idA = inA.data.user.id;
  const idB = inB.data.user.id;
  made.push(idA, idB);

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
  check(replayed.error === null && answer?.finished === true, 'the engine function plays a whole life for a signed-in guest');
  check(answer?.hash === stateHash(life.state), 'the server ends that life on the same state as this checkout does');
  check(answer?.score === finalScore(content, life.state), 'and gives it the same score');
  const unknown = await a.functions.invoke('engine', { body: { engineVersion: '9.9.9', contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 's', log: [] } });
  check(unknown.error !== null, 'the server refuses versions it does not hold');
  const unsigned = await nobody.functions.invoke('engine', { body: { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 's', log: [] } });
  check(unsigned.error !== null, 'the engine function refuses a caller with no account');
} catch (error) {
  check(false, error instanceof Error ? error.message : String(error));
} finally {
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
