import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Unreachable } from '@/session/errors';
import { connectSupabase } from './connect';

/** The parts of the Supabase client the game uses, answering as told and remembering what they were asked. */
const client = vi.hoisted(() => {
  const asked: unknown[][] = [];
  const answers: Record<string, unknown> = {};
  const listeners: Array<(event: string, session: unknown) => void> = [];
  return {
    asked,
    answers,
    listeners,
    created: [] as unknown[][],
    make: () => ({
      auth: {
        getSession: async () => answers.getSession,
        signInAnonymously: async (...a: unknown[]) => (asked.push(['signInAnonymously', ...a]), answers.signInAnonymously),
        linkIdentity: async (...a: unknown[]) => (asked.push(['linkIdentity', ...a]), answers.linkIdentity),
        signInWithOAuth: async (...a: unknown[]) => (asked.push(['signInWithOAuth', ...a]), answers.signInWithOAuth),
        onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
          listeners.push(listener);
          return { data: { subscription: { unsubscribe: () => listeners.splice(listeners.indexOf(listener), 1) } } };
        },
      },
      // A question to a table is built a word at a time and asked when it is awaited. Each one is
      // remembered whole, and answered with what the test has set for its table.
      from: (table: string) => {
        const question: unknown[] = [table];
        const builder: Record<string, unknown> = {};
        for (const word of ['select', 'eq', 'neq', 'lt', 'in', 'order', 'limit', 'update', 'upsert', 'delete', 'maybeSingle']) {
          builder[word] = (...a: unknown[]) => (question.push([word, ...a]), builder);
        }
        builder.then = (resolve: (answer: unknown) => unknown, reject: (error: unknown) => unknown) => {
          asked.push(question);
          // An answer may depend on the question: a table is asked more than one thing in a row.
          const answer = answers[table];
          return Promise.resolve(typeof answer === 'function' ? (answer as (q: unknown[]) => unknown)(question) : answer).then(resolve, reject);
        };
        return builder;
      },
      functions: {
        invoke: async (...a: unknown[]) => (asked.push(['invoke', ...a]), answers.invoke),
      },
      rpc: async (...a: unknown[]) => (asked.push(['rpc', ...a]), answers.rpc),
    }),
  };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => (client.created.push(a), client.make()) }));

const user = { id: 'u-1', is_anonymous: true, email: undefined };
beforeEach(() => {
  client.asked.length = 0;
  client.created.length = 0;
  client.listeners.length = 0;
  Object.assign(client.answers, {
    getSession: { data: { session: null }, error: null },
    signInAnonymously: { data: { user }, error: null },
    linkIdentity: { data: {}, error: null },
    signInWithOAuth: { data: {}, error: null },
    profiles: { error: null },
    games: { data: [], error: null },
    player_progress: { data: null, error: null },
    runs: { data: [], error: null },
    invoke: { data: { run: {} }, error: null },
    rpc: { data: null, error: null },
    friendships: { data: [], error: null },
  });
});

describe('the cloud, made from the Supabase client', () => {
  it('is made with the two public values, and keeps the session in the browser', async () => {
    await connectSupabase('https://project.supabase.co', 'sb_publishable_x');
    expect(client.created[0].slice(0, 2)).toEqual(['https://project.supabase.co', 'sb_publishable_x']);
    expect(client.created[0][2]).toMatchObject({ auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
  });

  it('says who is signed in, or nobody', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.currentUser()).toBeNull();
    client.answers.getSession = { data: { session: { user: { id: 'u-2', is_anonymous: false, email: 'ana@example.com' } } }, error: null };
    expect(await cloud.currentUser()).toEqual({ id: 'u-2', is_anonymous: false, email: 'ana@example.com' });
  });

  it('fails, instead of answering "nobody", when it could not find out who is signed in', async () => {
    // A stored session that could not be renewed comes back as no session and an error. Reading that as
    // "nobody" would have the game make a new guest over the player who is stored.
    client.answers.getSession = { data: { session: null }, error: new Error('refresh failed: 503') };
    const cloud = await connectSupabase('u', 'k');
    await expect(cloud.currentUser()).rejects.toThrow('refresh failed: 503');
  });

  it('makes a guest, or says it could not', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.signInAsGuest()).toEqual({ id: 'u-1', is_anonymous: true, email: undefined });
    client.answers.signInAnonymously = { data: { user: null }, error: new Error('anonymous sign-ins are disabled') };
    expect(await cloud.signInAsGuest()).toBeNull();
    // With no guard at the door, nothing is handed over with the request.
    expect(client.asked).toEqual([['signInAnonymously'], ['signInAnonymously']]);
  });

  it('asks the guard at the door for its word before it makes a guest, where there is one, and makes none without it', async () => {
    const words: Array<string | null> = ['a-word', null];
    const cloud = await connectSupabase('u', 'k', { captcha: async () => words.shift() ?? null });
    expect(await cloud.signInAsGuest()).toEqual({ id: 'u-1', is_anonymous: true, email: undefined });
    expect(client.asked).toEqual([['signInAnonymously', { options: { captchaToken: 'a-word' } }]]);
    // No word: the cloud would refuse, so it is not asked.
    expect(await cloud.signInAsGuest()).toBeNull();
    expect(client.asked).toHaveLength(1);
  });

  it('links Google to the player signed in, and signs in as an existing player, each back to the address given', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.linkGoogle('http://localhost:3000/es')).toBe(true);
    expect(await cloud.signInWithGoogle('http://localhost:3000/es')).toBe(true);
    expect(client.asked).toEqual([
      ['linkIdentity', { provider: 'google', options: { redirectTo: 'http://localhost:3000/es' } }],
      ['signInWithOAuth', { provider: 'google', options: { redirectTo: 'http://localhost:3000/es' } }],
    ]);
    client.answers.linkIdentity = { data: {}, error: new Error('manual linking is disabled') };
    client.answers.signInWithOAuth = { data: {}, error: new Error('provider is not enabled') };
    expect(await cloud.linkGoogle('x')).toBe(false);
    expect(await cloud.signInWithGoogle('x')).toBe(false);
  });

  it('writes the player\'s profile with the language of the page every time, so a change of language is kept', async () => {
    const cloud = await connectSupabase('u', 'k');
    await cloud.ensureProfile('u-1', 'es');
    expect(client.asked).toEqual([['profiles', ['upsert', { user_id: 'u-1', language: 'es' }, { onConflict: 'user_id' }]]]);
    client.answers.profiles = { error: new Error('offline') };
    await expect(cloud.ensureProfile('u-1', 'es')).rejects.toThrow('offline');
  });

  it('tells of every change of who is signed in, until told to stop', async () => {
    const cloud = await connectSupabase('u', 'k');
    const heard: unknown[] = [];
    const stop = cloud.onUser((next) => heard.push(next));
    client.listeners[0]('SIGNED_IN', { user: { id: 'u-3', is_anonymous: false, email: 'b@example.com' } });
    client.listeners[0]('SIGNED_OUT', null);
    expect(heard).toEqual([{ id: 'u-3', is_anonymous: false, email: 'b@example.com' }, null]);
    stop();
    expect(client.listeners).toHaveLength(0);
  });
});

describe('what the cloud keeps of a player', () => {
  const signedIn = { data: { session: { user: { id: 'u-1', is_anonymous: true } } }, error: null };
  const gameRow = { id: 'g-1', life_id: 'nurse', engine_version: '0.4.0', content_version: '1.3.0', seed: 'abc', round: 3, status: 'playing', log: [{ picks: [0], orders: [] }], state_hash: 'h-1', updated_at: '2026-10-13T10:00:00Z' };
  const upload = { id: 'g-1', lifeId: 'nurse', engineVersion: '0.4.0', contentVersion: '1.3.0', seed: 'abc', round: 3, log: [{ picks: [0], orders: [] }], stateHash: 'h-1' };

  it('reads the lives still being played, the latest first, as the game names them', async () => {
    client.answers.games = { data: [gameRow], error: null };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.playingGames()).toEqual([{ id: 'g-1', lifeId: 'nurse', engineVersion: '0.4.0', contentVersion: '1.3.0', seed: 'abc', round: 3, status: 'playing', log: [{ picks: [0], orders: [] }], stateHash: 'h-1', updatedAt: '2026-10-13T10:00:00Z' }]);
    expect(client.asked).toEqual([['games', ['select', 'id, life_id, engine_version, content_version, seed, round, status, log, state_hash, updated_at'], ['eq', 'mode', 'casual'], ['eq', 'status', 'playing'], ['order', 'updated_at', { ascending: false }], ['limit', 5]]]);
    client.answers.games = { data: null, error: new Error('offline') };
    await expect(cloud.playingGames()).rejects.toThrow('offline');
  });

  it('saves a life in progress as the player\'s own casual game, being played', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.pushGame(upload)).toBe('saved');
    // Being played: a life another device gave up is taken up again by the one that still plays it.
    expect(client.asked).toEqual([['games', ['upsert', { id: 'g-1', mode: 'casual', status: 'playing', life_id: 'nurse', engine_version: '0.4.0', content_version: '1.3.0', seed: 'abc', round: 3, log: upload.log, state_hash: 'h-1' }, { onConflict: 'id' }]]]);
    client.asked.length = 0;
    await cloud.pushGame({ ...upload, stateHash: '' });
    expect((client.asked[0][1] as unknown[])[1]).toMatchObject({ state_hash: null });
  });

  /** The table refuses the save; asked whether the player holds a game of that id, it answers with `own`. */
  const refusedThen = (own: unknown) => (question: unknown[]) =>
    (question[1] as unknown[])[0] === 'upsert' ? { error: { code: '42501', message: 'new row violates row-level security policy' } } : { data: own, error: null };

  it('says a life is closed when the rules refuse the save and the game is the player\'s own: the server has finished it', async () => {
    const cloud = await connectSupabase('u', 'k');
    client.answers.games = refusedThen({ status: 'finished' });
    expect(await cloud.pushGame(upload)).toBe('closed');
    expect(client.asked[1]).toEqual(['games', ['select', 'status'], ['eq', 'id', 'g-1'], ['maybeSingle']]);
  });

  it('says the id is taken when the rules refuse the save and the player holds no such game: it is another account\'s', async () => {
    // Most often the guest this device was before its player signed in as someone who already had an account.
    // Read as "closed", this was the life never reaching the account while the game said it had.
    const cloud = await connectSupabase('u', 'k');
    client.answers.games = refusedThen(null);
    expect(await cloud.pushGame(upload)).toBe('taken');
  });

  it('says the account is further along when the table refuses to go backwards, and fails for any other reason', async () => {
    const cloud = await connectSupabase('u', 'k');
    client.answers.games = { error: { code: 'RR001', message: 'the account holds more of this life than this save does' } };
    expect(await cloud.pushGame(upload)).toBe('behind');
    client.answers.games = { error: { code: '23514', message: 'a player holds fifty games at most' } };
    await expect(cloud.pushGame(upload)).rejects.toMatchObject({ code: '23514' });
    // Not being able to ask whose the game is, is a failure too, not an answer.
    client.answers.games = (question: unknown[]) => ((question[1] as unknown[])[0] === 'upsert' ? { error: { code: '42501' } } : { data: null, error: new Error('offline') });
    await expect(cloud.pushGame(upload)).rejects.toThrow('offline');
  });

  it('gives up a life that is being played, and no other', async () => {
    const cloud = await connectSupabase('u', 'k');
    await cloud.abandonGame('g-1');
    expect(client.asked).toEqual([['games', ['update', { status: 'abandoned' }], ['eq', 'id', 'g-1'], ['eq', 'status', 'playing']]]);
    client.answers.games = { error: new Error('offline') };
    await expect(cloud.abandonGame('g-1')).rejects.toThrow('offline');
  });

  it('reads what the player has unlocked, or nothing if they have never saved any', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.loadProgress()).toBeNull();
    client.answers.player_progress = { data: { progress: { gallery: ['watch_casio'] } }, error: null };
    expect(await cloud.loadProgress()).toEqual({ gallery: ['watch_casio'] });
    expect(client.asked[1]).toEqual(['player_progress', ['select', 'progress'], ['maybeSingle']]);
    client.answers.player_progress = { data: null, error: new Error('offline') };
    await expect(cloud.loadProgress()).rejects.toThrow('offline');
  });

  it('writes what the player has unlocked as their own row', async () => {
    client.answers.getSession = signedIn;
    const cloud = await connectSupabase('u', 'k');
    const progress = { badges: {}, gallery: ['watch_casio'], unlocked: {}, guide: { seen: [], off: false } };
    await cloud.saveProgress(progress);
    expect(client.asked).toEqual([['player_progress', ['upsert', { user_id: 'u-1', progress }, { onConflict: 'user_id' }]]]);
    client.answers.player_progress = { error: new Error('offline') };
    await expect(cloud.saveProgress(progress)).rejects.toThrow('offline');
    // With nobody signed in there is no row to write, and it does not ask.
    client.asked.length = 0;
    client.answers.getSession = { data: { session: null }, error: null };
    await expect(cloud.saveProgress(progress)).rejects.toThrow('nobody is signed in');
    expect(client.asked).toEqual([]);
  });

  it('reads the player\'s own finished lives, though every player\'s can be read', async () => {
    client.answers.getSession = signedIn;
    client.answers.runs = { data: [{ id: 'r-1', mode: 'ranked', life_id: 'nurse', engine_version: '0.4.0', content_version: '1.3.0', score: 321, net_worth: 9_000_000, status: 30, escaped_at_round: null, bankruptcies: 1, badges: ['escaped'], cities: null, history: ['1', 2], finished_at: '2026-10-01T08:00:00Z' }], error: null };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.listRuns()).toEqual([{ id: 'r-1', mode: 'ranked', lifeId: 'nurse', engineVersion: '0.4.0', contentVersion: '1.3.0', score: 321, netWorth: 9_000_000, status: 30, escapedAtRound: null, bankruptcies: 1, badges: ['escaped'], cities: [], history: [1, 2], finishedAt: '2026-10-01T08:00:00Z' }]);
    expect(client.asked[0].slice(2)).toEqual([['eq', 'user_id', 'u-1'], ['order', 'finished_at', { ascending: false }], ['limit', 1000]]);
    client.answers.runs = { data: null, error: new Error('offline') };
    await expect(cloud.listRuns()).rejects.toThrow('offline');
  });

  it('asks the server to finish a life, and tells a refusal from a failure to ask', async () => {
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.finishRun('g-1')).toBe('done');
    expect(client.asked).toEqual([['invoke', 'finish-run', { body: { gameId: 'g-1' } }]]);
    // The function's own answers, each by its name: asking again would get the same one.
    const said = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });
    for (const [status, error] of [[400, 'bad-request'], [404, 'unknown-game'], [409, 'not-finished'], [409, 'not-casual'], [422, 'cannot-replay']] as const) {
      client.answers.invoke = said(status, { error });
      expect(await cloud.finishRun('g-1'), error).toBe('refused');
    }
    // It does not hold the versions of this life: no life on them is worth sending.
    client.answers.invoke = said(409, { error: 'unknown-version', versions: ['0.5.0/1.5.0'] });
    expect(await cloud.finishRun('g-1')).toBe('unknown-version');
    // Not the function's own word: it is not there, the player is not signed in just now, there are too many
    // requests, the server is down, there is no network. All worth another try, and none is "it said no".
    for (const context of [new Response('Not Found', { status: 404 }), new Response('{"message":"no such function"}', { status: 404 }), new Response('{}', { status: 401 }), new Response('{"error":"server"}', { status: 500 }), new Response('', { status: 503 }), { status: 409 }, undefined, new TypeError('failed to fetch')]) {
      client.answers.invoke = { data: null, error: { context } };
      expect(await cloud.finishRun('g-1')).toBe('failed');
    }
  });

  it('gives up on a request that gets no answer, so that one stuck request does not stop everything after it', async () => {
    await connectSupabase('u', 'k');
    const through = (client.created[0][2] as { global: { fetch: typeof fetch } }).global.fetch;
    const seen: Array<RequestInit | undefined> = [];
    vi.stubGlobal('fetch', async (_input: unknown, init?: RequestInit) => (seen.push(init), new Response('{}')));
    try {
      await through('https://project.supabase.co/rest/v1/games', { method: 'GET' });
      expect(seen[0]?.method).toBe('GET');
      expect(seen[0]?.signal).toBeInstanceOf(AbortSignal);
      // A caller that brings its own way to stop is left with it.
      const own = new AbortController().signal;
      await through('https://project.supabase.co/rest/v1/games', { signal: own });
      expect(seen[1]?.signal).toBe(own);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('ranked lives, as the cloud is asked for them', () => {
  it('asks the ranked function, and hands back what it answered', async () => {
    const cloud = await connectSupabase('u', 'k');
    client.answers.invoke = { data: { gameId: 'g-1', step: 0, view: { timeline: [{}] }, record: {} }, error: null };
    expect(await cloud.ranked.start('nurse', { engine: '0.10.0', content: '1.9.0' })).toMatchObject({ gameId: 'g-1', step: 0 });
    expect(client.asked).toEqual([['invoke', 'ranked', { body: { action: 'start', lifeId: 'nurse', engineVersion: '0.10.0', contentVersion: '1.9.0' } }]]);
  });

  it('asks for the ranked function in the region of the database when one is named: in the address, where a browser may say it', async () => {
    // The client's own way of naming a region adds a header the function's gateway does not let a browser send,
    // and every ranked call from a page would be refused before it left. The address says the same thing.
    client.answers.invoke = { data: {}, error: null };
    await (await connectSupabase('u', 'k', { region: 'ap-northeast-1' })).ranked.abandon('g-1');
    expect(client.asked).toEqual([['invoke', 'ranked?forceFunctionRegion=ap-northeast-1', { body: { action: 'abandon', gameId: 'g-1' } }]]);
    // What is not the name of a region is not sent as one: the platform chooses, and ranked lives go on working.
    for (const region of ['Tokyo', 'ap-northeast1', 'ap-northeast-1&x=1', '']) {
      client.asked.length = 0;
      await (await connectSupabase('u', 'k', { region })).ranked.abandon('g-1');
      expect(client.asked, region).toEqual([['invoke', 'ranked', { body: { action: 'abandon', gameId: 'g-1' } }]]);
    }
  });

  it('gives a ranked life up through the function that plays it, and says so when it could not', async () => {
    const cloud = await connectSupabase('u', 'k');
    client.answers.invoke = { data: {}, error: null };
    await cloud.giveUpRanked('g-1');
    expect(client.asked).toEqual([['invoke', 'ranked', { body: { action: 'abandon', gameId: 'g-1' } }]]);
    // A life that is nobody's, or already given up, is given up as far as this device is concerned.
    client.answers.invoke = { data: null, error: { context: new Response(JSON.stringify({ error: 'unknown-game' }), { status: 404 }) } };
    await cloud.giveUpRanked('g-1');
    client.answers.invoke = { data: null, error: { context: new Response('', { status: 503 }) } };
    await expect(cloud.giveUpRanked('g-1')).rejects.toBeInstanceOf(Unreachable);
  });

  it('reads what the function said when it said no, and knows no answer at all from an answer', async () => {
    const cloud = await connectSupabase('u', 'k');
    // The function's own no: the life is not where the client thinks.
    client.answers.invoke = { data: null, error: { context: new Response(JSON.stringify({ error: 'out-of-step', step: 4 }), { status: 409 }) } };
    expect(await cloud.ranked.card('g-1', 3, 0)).toBe('moved');
    client.answers.invoke = { data: null, error: { context: new Response(JSON.stringify({ error: 'closed' }), { status: 409 }) } };
    expect(await cloud.ranked.view('g-1')).toBe('gone');
    // Busy, away, or no network: worth asking again, and said so.
    for (const error of [{ context: new Response('{"error":"too-many"}', { status: 429 }) }, { context: new Response('', { status: 503 }) }, { context: new TypeError('failed to fetch') }, {}]) {
      client.answers.invoke = { data: null, error };
      await expect(cloud.ranked.round('g-1', 3, [])).rejects.toBeInstanceOf(Unreachable);
    }
  });

  it('finds the ranked life a player has in progress, if they have one', async () => {
    client.answers.games = { data: { id: 'g-9', life_id: 'nurse', engine_version: '0.10.0', content_version: '1.9.0' }, error: null };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.rankedLife()).toEqual({ id: 'g-9', lifeId: 'nurse', engineVersion: '0.10.0', contentVersion: '1.9.0' });
    expect(client.asked).toEqual([['games', ['select', 'id, life_id, engine_version, content_version'], ['eq', 'mode', 'ranked'], ['eq', 'status', 'playing'], ['limit', 1], ['maybeSingle']]]);
    client.answers.games = { data: null, error: null };
    expect(await cloud.rankedLife()).toBeNull();
    client.answers.games = { data: null, error: new Error('offline') };
    await expect(cloud.rankedLife()).rejects.toThrow('offline');
  });
});

describe('names, friends and rankings, as the cloud is asked for them', () => {
  const signedIn = { data: { session: { user: { id: 'u-1', is_anonymous: false } } }, error: null };

  it('reads the player\'s own name and friend code', async () => {
    client.answers.getSession = signedIn;
    client.answers.profiles = { data: { nickname: 'Rata_Uno', friend_code: 'ABCD2345' }, error: null };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.community.me()).toEqual({ nickname: 'Rata_Uno', friendCode: 'ABCD2345' });
    expect(client.asked).toEqual([['profiles', ['select', 'nickname, friend_code'], ['eq', 'user_id', 'u-1'], ['maybeSingle']]]);
    client.answers.profiles = { data: null, error: null };
    expect(await cloud.community.me()).toBeNull();
    client.answers.profiles = { data: null, error: new Error('offline') };
    expect(await cloud.community.me()).toBeNull();
    // An answer that says it failed is a failure, whatever came with it.
    client.answers.profiles = { data: { nickname: 'Rata_Uno', friend_code: 'ABCD2345' }, error: new Error('half an answer') };
    expect(await cloud.community.me()).toBeNull();
  });

  it('gives the player a name, and says in a word why not when it does not', async () => {
    client.answers.getSession = signedIn;
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.community.rename('Rata_Uno')).toBe('ok');
    expect(client.asked).toEqual([['profiles', ['update', { nickname: 'Rata_Uno' }], ['eq', 'user_id', 'u-1']]]);
    for (const [code, word] of [['23505', 'taken'], ['RR002', 'refused'], ['23514', 'refused'], ['08006', 'failed']] as const) {
      client.answers.profiles = { error: { code, message: 'no' } };
      expect(await cloud.community.rename('Rata_Uno'), code).toBe(word);
    }
  });

  it('counts the lives of others from the same start, and those of them that scored less, without reading a row', async () => {
    client.answers.getSession = signedIn;
    // The question that asks for the lower scores says so; the other counts them all.
    client.answers.runs = (question: unknown[]) => ({ count: question.some((word) => Array.isArray(word) && word[0] === 'lt') ? 31 : 40, error: null });
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.community.compare({ lifeId: 'nurse', score: 420 })).toEqual({ below: 31, total: 40 });
    const others = ['runs', ['select', 'id', { count: 'exact', head: true }], ['eq', 'life_id', 'nurse'], ['neq', 'user_id', 'u-1']];
    expect(client.asked).toEqual(expect.arrayContaining([others, [...others, ['lt', 'score', 420]]]));
    // Anything it cannot count is no comparison at all.
    client.answers.runs = { count: null, error: { code: '42501', message: 'denied' } };
    expect(await cloud.community.compare({ lifeId: 'nurse', score: 420 })).toBeNull();
  });

  it('reads the life behind a line of a ranking: the first ranked life of that start to reach that score', async () => {
    client.answers.getSession = signedIn;
    client.answers.runs = { data: { net_worth: '12345600', status: 41, escaped_at_round: 9, bankruptcies: 1, badges: ['first_share'], cities: ['madrid', 'london'], history: ['100', '250'], finished_at: '2026-10-12T10:00:00Z' }, error: null };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.community.run({ userId: 'u-9', lifeId: 'nurse', score: 356 })).toEqual({
      netWorth: 12_345_600, status: 41, escapedAtRound: 9, bankruptcies: 1, badges: ['first_share'], cities: ['madrid', 'london'], history: [100, 250], finishedAt: Date.parse('2026-10-12T10:00:00Z'),
    });
    expect(client.asked).toContainEqual([
      'runs',
      ['select', 'net_worth, status, escaped_at_round, bankruptcies, badges, cities, history, finished_at'],
      ['eq', 'user_id', 'u-9'],
      ['eq', 'mode', 'ranked'],
      ['eq', 'life_id', 'nurse'],
      ['eq', 'score', 356],
      ['order', 'finished_at', { ascending: true }],
      ['limit', 1],
      ['maybeSingle'],
    ]);
    client.answers.runs = { data: null, error: null };
    expect(await cloud.community.run({ userId: 'u-9', lifeId: 'nurse', score: 356 })).toBeNull();
  });

  it('asks the database for a ranking, and says which line is the player\'s own', async () => {
    client.answers.getSession = signedIn;
    client.answers.rpc = {
      data: [
        { place: 1, user_id: 'u-9', nickname: 'Otra', portrait: null, score: 900, life_id: 'engineer', finished_at: '2026-10-12T08:00:00Z', run_id: 'r-9' },
        { place: 7, user_id: 'u-1', nickname: null, portrait: null, score: 300, life_id: 'nurse', finished_at: '2026-10-13T08:00:00Z', run_id: 'r-1' },
      ],
      error: null,
    };
    const cloud = await connectSupabase('u', 'k');
    expect(await cloud.community.ranking({ period: 'week', friends: true, lifeId: 'nurse' })).toEqual([
      { place: 1, userId: 'u-9', nickname: 'Otra', score: 900, lifeId: 'engineer', finishedAt: Date.parse('2026-10-12T08:00:00Z'), mine: false },
      { place: 7, userId: 'u-1', nickname: null, score: 300, lifeId: 'nurse', finishedAt: Date.parse('2026-10-13T08:00:00Z'), mine: true },
    ]);
    expect(client.asked).toEqual([['rpc', 'ranking', { period: 'week', life: 'nurse', friends: true, top: 50 }]]);
    client.asked.length = 0;
    await cloud.community.ranking({ period: 'all', friends: false, lifeId: null });
    expect(client.asked).toEqual([['rpc', 'ranking', { period: 'all', life: null, friends: false, top: 50 }]]);
    client.answers.rpc = { data: null, error: new Error('offline') };
    expect(await cloud.community.ranking({ period: 'all', friends: false, lifeId: null })).toBeNull();
  });

  it('follows a player by their code, lists whom the player follows by name, and stops following', async () => {
    client.answers.getSession = signedIn;
    const cloud = await connectSupabase('u', 'k');
    client.answers.rpc = { data: 'ok', error: null };
    expect(await cloud.community.follow(' abcd2345 ')).toBe('ok');
    expect(client.asked).toEqual([['rpc', 'add_friend', { code: ' abcd2345 ' }]]);
    for (const word of ['unknown', 'self', 'full'] as const) {
      client.answers.rpc = { data: word, error: null };
      expect(await cloud.community.follow('x')).toBe(word);
    }
    client.answers.rpc = { data: 'something else', error: null };
    expect(await cloud.community.follow('x')).toBe('failed');
    client.answers.rpc = { data: null, error: new Error('offline') };
    expect(await cloud.community.follow('x')).toBe('failed');
    client.answers.rpc = { data: 'ok', error: new Error('half an answer') };
    expect(await cloud.community.follow('x')).toBe('failed');

    client.asked.length = 0;
    client.answers.friendships = { data: [{ followed: 'u-9' }, { followed: 'u-8' }], error: null };
    client.answers.profiles = { data: [{ user_id: 'u-9', nickname: 'Otra' }], error: null };
    expect(await cloud.community.friends()).toEqual([{ userId: 'u-9', nickname: 'Otra' }, { userId: 'u-8', nickname: null }]);
    expect(client.asked).toEqual([
      ['friendships', ['select', 'followed'], ['eq', 'follower', 'u-1'], ['order', 'created_at', { ascending: false }]],
      ['profiles', ['select', 'user_id, nickname'], ['in', 'user_id', ['u-9', 'u-8']]],
    ]);
    client.answers.friendships = { data: null, error: new Error('offline') };
    expect(await cloud.community.friends()).toBeNull();

    client.asked.length = 0;
    client.answers.friendships = { error: null };
    expect(await cloud.community.unfollow('u-9')).toBe(true);
    expect(client.asked).toEqual([['friendships', ['delete'], ['eq', 'follower', 'u-1'], ['eq', 'followed', 'u-9']]]);
    client.answers.friendships = { error: new Error('offline') };
    expect(await cloud.community.unfollow('u-9')).toBe(false);
  });
});

