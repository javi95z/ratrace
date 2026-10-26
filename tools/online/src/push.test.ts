import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addUp, byPlayer, deliverExpo, deliverTo, EXPO_BATCH, EXPO_PATIENCE, EXPO_SEND, expoAnswer, expoRun, isApp, tally, tellPlayer } from '../../../supabase/functions/_shared/push.ts';
import type { AppDevice, Device, Senders, WebDevice } from '../../../supabase/functions/_shared/push.ts';
import { noticeOf } from '../../../supabase/functions/_shared/notice.ts';
import type { NoticeAbout } from '../../../supabase/functions/_shared/notice.ts';

const browser = (user: string, n = 1, locale = 'es'): WebDevice => ({ endpoint: `https://push.example/${user}/${n}`, p256dh: `p-${n}`, auth: `a-${n}`, locale, user_id: user });
const phone = (user: string, n = 1, locale: string | null = 'es'): AppDevice => ({ token: `ExponentPushToken[${user}-${n}]`, locale, user_id: user });

interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Senders that remember what they were asked, a push service that answers as told, and Expo answering each message with a ticket. */
function fakes(options: { web?: boolean; webFails?: (endpoint: string) => number | null; tickets?: (to: string) => Ticket; expoStatus?: number; expoThrows?: boolean; projectOf?: (to: string) => string } = {}) {
  const web: Array<{ subscription: unknown; payload: string; options: unknown }> = [];
  const posts: Array<{ url: string; headers: Record<string, string>; messages: Array<Record<string, unknown>> }> = [];
  const forgotten: Device[] = [];
  const logged: string[] = [];
  const senders: Senders = {
    log: (line) => {
      logged.push(line);
    },
    web:
      options.web === false
        ? null
        : async (subscription, payload, opts) => {
            web.push({ subscription, payload, options: opts });
            const status = options.webFails?.(subscription.endpoint) ?? null;
            if (status !== null) throw Object.assign(new Error('push service said no'), { statusCode: status });
          },
    post: async (url, init) => {
      if (options.expoThrows) throw new Error('offline');
      const messages = JSON.parse(init.body) as Array<Record<string, unknown>>;
      posts.push({ url, headers: init.headers, messages });
      // Expo refuses a whole request whose tokens belong to more than one project.
      const projects = new Set(messages.map((m) => options.projectOf?.(m.to as string) ?? '@ratrace/app'));
      if (projects.size > 1) return { ok: false, status: 400, json: async () => ({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS', message: `${messages.map((m) => m.to as string).join(', ')} are of different projects` }] }) };
      const status = options.expoStatus ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => (status === 200 ? { data: messages.map((m) => options.tickets?.(m.to as string) ?? { status: 'ok', id: `t-${m.to as string}` }) } : { errors: [{ code: 'INTERNAL_SERVER_ERROR', message: 'down' }] }),
      };
    },
    forget: async (row) => {
      forgotten.push(row);
    },
  };
  return { senders, web, posts, forgotten, logged };
}

const weekly: NoticeAbout = { kind: 'weekly', place: null, entrants: null };

describe('a notice to the browsers and the phones of players', () => {
  it('sends a player with a browser and a phone one of each: the page on the site, the screen in the app', async () => {
    const { senders, web, posts } = fakes();
    expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 86_400, 'normal', senders)).toEqual({ sent: 2, removed: 0 });
    expect(web).toHaveLength(1);
    expect(JSON.parse(web[0].payload)).toMatchObject({ url: '/es/challenge', tag: 'weekly-challenge' });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe(EXPO_SEND);
    expect(posts[0].messages).toEqual([
      {
        to: 'ExponentPushToken[u1-1]',
        title: 'Nuevo reto semanal',
        body: noticeOf('es', weekly).body,
        data: { url: 'theratrace://challenge', tag: 'weekly-challenge' },
        ttl: 86_400,
        priority: 'default',
        sound: 'default',
      },
    ]);
    expect(posts[0].headers).toEqual({ accept: 'application/json', 'accept-encoding': 'gzip, deflate', 'content-type': 'application/json' });
  });

  it('gives a phone a friend request\'s buttons: their category, and the link each opens; the browser none', async () => {
    const { senders, web, posts } = fakes();
    const from = '6f1c2a4e-1b2c-4d3e-8f90-123456789abc';
    expect(await deliverTo([browser('u1'), phone('u1')], () => ({ kind: 'friendRequest', who: 'Ana', from }), 86_400, 'normal', senders)).toEqual({ sent: 2, removed: 0 });
    expect(JSON.parse(web[0].payload)).not.toHaveProperty('actions');
    expect(posts[0].messages[0]).toMatchObject({
      categoryId: 'friend-request',
      data: { url: 'theratrace://rankings?tab=friends', tag: 'friends', actions: { accept: `theratrace://rankings?tab=friends&accept=${from}`, decline: `theratrace://rankings?tab=friends&decline=${from}` } },
    });
  });

  it('forgets a phone Expo says is no longer registered, as a browser the push service says is gone', async () => {
    const { senders, forgotten } = fakes({
      tickets: (to) => (to.includes('dead') ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : to.includes('busy') ? { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } } : { status: 'ok', id: 'x' }),
      webFails: (endpoint) => (endpoint.endsWith('/gone') ? 410 : endpoint.endsWith('/down') ? 500 : null),
    });
    const dead = phone('dead');
    const busy = phone('busy');
    const gone = { ...browser('u2'), endpoint: 'https://push.example/gone' };
    const down = { ...browser('u2'), endpoint: 'https://push.example/down' };
    expect(await deliverTo([phone('u1'), dead, busy, gone, down], () => weekly, 60, 'high', senders)).toEqual({ sent: 1, removed: 2 });
    expect(forgotten).toEqual(expect.arrayContaining([dead, gone]));
    expect(forgotten).toHaveLength(2);
  });

  it('sends phones in batches of a hundred, and forgets the right one of a later batch', async () => {
    const many = Array.from({ length: 250 }, (_, i) => phone('p', i));
    const { senders, posts, forgotten } = fakes({ tickets: (to) => (to === 'ExponentPushToken[p-150]' ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' }) });
    expect(EXPO_BATCH).toBe(100);
    expect(await deliverExpo(many, (row) => noticeOf(row.locale, { kind: 'idle' }, 'app'), 86_400, 'normal', senders)).toEqual({ sent: 249, removed: 1 });
    expect(posts.map((p) => p.messages.length)).toEqual([100, 100, 50]);
    expect(forgotten).toEqual([many[150]]);
  });

  it('forgets no phone when Expo cannot be reached or fails, and still tells the browsers', async () => {
    for (const trouble of [{ expoThrows: true }, { expoStatus: 500 }]) {
      const { senders, web, forgotten } = fakes(trouble);
      expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 60, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
      expect(web).toHaveLength(1);
      expect(forgotten).toEqual([]);
    }
  });

  it('gives up on an Expo that does not answer, forgets nobody, and goes on to the browsers and the players after', async () => {
    vi.useFakeTimers();
    try {
      const { senders, web, forgotten, logged } = fakes();
      let aborted = false;
      const hanging: Senders = {
        ...senders,
        post: (_url, init) => {
          init.signal?.addEventListener('abort', () => {
            aborted = true;
          });
          return new Promise(() => {});
        },
      };
      let done: { sent: number; removed: number } | null = null;
      void deliverTo([browser('u1'), phone('u1')], () => weekly, 60, 'normal', hanging).then((result) => {
        done = result;
      });
      await vi.advanceTimersByTimeAsync(EXPO_PATIENCE - 1);
      expect(done).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(done).toEqual({ sent: 1, removed: 0 });
      expect(aborted).toBe(true);
      expect(web).toHaveLength(1);
      expect(forgotten).toEqual([]);
      expect(logged).toEqual(['expo push: 1 batches, failed: timeout ×1; tickets refused: none']);
      // The next player of the run is told as if nothing had happened.
      const next = fakes();
      expect(await deliverTo([phone('u2')], () => weekly, 60, 'normal', next.senders)).toEqual({ sent: 1, removed: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs what Expo refused by its codes alone, never a token, so that wrong credentials show', async () => {
    const refusing = fakes({
      tickets: (to) =>
        to.includes('creds')
          ? { status: 'error', message: `Could not send to ${to}: InvalidCredentials`, details: { error: 'InvalidCredentials' } }
          : to.includes('busy')
            ? { status: 'error', message: `${to} is sending too much`, details: { error: 'MessageRateExceeded' } }
            : to.includes('dead')
              ? { status: 'error', message: `${to} is not registered`, details: { error: 'DeviceNotRegistered' } }
              : { status: 'ok', id: 'x' },
    });
    expect(await deliverTo([phone('creds', 1), phone('creds', 2), phone('busy'), phone('dead'), phone('fine')], () => weekly, 60, 'normal', refusing.senders)).toEqual({ sent: 1, removed: 1 });
    expect(refusing.logged).toEqual(['expo push: 4 batches, failed: none; tickets refused: InvalidCredentials ×2, MessageRateExceeded ×1']);
    const down = fakes({ expoStatus: 503 });
    await deliverTo([phone('u1')], () => weekly, 60, 'normal', down.senders);
    expect(down.logged).toEqual(['expo push: 1 batches, failed: http 503 INTERNAL_SERVER_ERROR ×1; tickets refused: none']);
    for (const line of [...refusing.logged, ...down.logged]) expect(line).not.toMatch(/ExponentPushToken|creds|busy|dead/);
    const fine = fakes();
    await deliverTo([phone('u1')], () => weekly, 60, 'normal', fine.senders);
    expect(fine.logged).toEqual([]);
  });

  it("sends each player's phones in their own batch, so that one player's token of another project silences only them", async () => {
    const { senders, posts, logged } = fakes({ projectOf: (to) => (to.includes('elsewhere') ? '@someone/else' : '@ratrace/app') });
    const mixed = [phone('u1'), browser('u2'), phone('u2'), { ...phone('u2', 2), token: 'ExponentPushToken[elsewhere]' }, phone('u3'), phone('u4'), phone('u4', 2)];
    expect(await deliverTo(mixed, () => ({ kind: 'roomStarted', seconds: 90 }), 60, 'high', senders)).toEqual({ sent: 5, removed: 0 });
    expect(posts.map((post) => post.messages.map((m) => m.to))).toEqual([
      ['ExponentPushToken[u1-1]'],
      ['ExponentPushToken[u2-1]', 'ExponentPushToken[elsewhere]'],
      ['ExponentPushToken[u3-1]'],
      ['ExponentPushToken[u4-1]', 'ExponentPushToken[u4-2]'],
    ]);
    expect(logged).toEqual(['expo push: 4 batches, failed: http 400 PUSH_TOO_MANY_EXPERIENCE_IDS ×1; tickets refused: none']);
    for (const line of logged) expect(line).not.toMatch(/ExponentPushToken|elsewhere/);
  });

  it('still tells the phones where the game has no keys for browsers', async () => {
    const { senders, posts } = fakes({ web: false });
    expect(await deliverTo([browser('u1'), phone('u1')], () => weekly, 60, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
    expect(posts).toHaveLength(1);
  });

  it('sends with the access token of the game, where it has one', async () => {
    const { senders, posts } = fakes();
    await deliverTo([phone('u1')], () => weekly, 60, 'high', { ...senders, expoToken: 'secret' });
    expect(posts[0].headers.authorization).toBe('Bearer secret');
    expect(posts[0].messages[0].priority).toBe('high');
  });

  it('tells a player with only a phone of the weekly challenge, a life left halfway and their market, each on its screen', async () => {
    const abouts: NoticeAbout[] = [weekly, { kind: 'idle' }, { kind: 'marketMoved', asset: 'bitcoin', percent: 12 }];
    const urls: unknown[] = [];
    for (const about of abouts) {
      const { senders, posts } = fakes();
      expect(await deliverTo([phone('u1', 1, 'en')], () => about, 86_400, 'normal', senders)).toEqual({ sent: 1, removed: 0 });
      urls.push((posts[0].messages[0].data as { url: string }).url);
    }
    expect(urls).toEqual(['theratrace://challenge', 'theratrace://play', 'theratrace://play']);
  });

  it('reads a phone with no language in English', async () => {
    const { senders, posts } = fakes();
    await deliverTo([phone('u1', 1, null)], () => ({ kind: 'idle' }), 60, 'normal', senders);
    expect(posts[0].messages[0].title).toBe('Your life is waiting');
  });

  it('puts a player\'s browsers and phones together, so that the day\'s one notice is claimed once for both', () => {
    const rows: Device[] = [browser('u1', 1), browser('u1', 2), { ...phone('u1'), endpoint: null, p256dh: null, auth: null } as Device, phone('u2')];
    const players = byPlayer(rows);
    expect([...players.keys()]).toEqual(['u1', 'u2']);
    expect(players.get('u1')?.map(isApp)).toEqual([false, false, true]);
  });
});

describe('a run of the clock, when Expo is down', () => {
  /** Players of a run: some with a phone alone, some with a browser and a phone, some with a browser alone. */
  const players = (n: number): Device[][] =>
    Array.from({ length: n }, (_, i) => {
      const user = `u${i}`;
      return i % 3 === 0 ? [phone(user)] : i % 3 === 1 ? [browser(user), phone(user)] : [browser(user)];
    });

  /** Tells each player in turn, as the clock's functions do, taking their day first; what each claim and each outcome was. */
  async function run(groups: Device[][], senders: Senders) {
    const claimed: string[] = [];
    const outcomes: string[] = [];
    for (const rows of groups) {
      const told = await tellPlayer(
        rows,
        async () => {
          claimed.push(rows[0].user_id);
          return true;
        },
        () => weekly,
        86_400,
        'normal',
        senders,
      );
      outcomes.push(told.told ? `told ${told.sent}` : told.why);
    }
    return { claimed, outcomes };
  }

  it('waits for an Expo that does not answer once in the run, not once a player, and tells every browser', async () => {
    vi.useFakeTimers();
    try {
      const { senders, web, forgotten, logged } = fakes();
      let asked = 0;
      const state = expoRun();
      const hanging: Senders = {
        ...senders,
        run: state,
        post: () => {
          asked += 1;
          return new Promise(() => {});
        },
      };
      const groups = players(30);
      let finished: Awaited<ReturnType<typeof run>> | null = null;
      void run(groups, hanging).then((result) => {
        finished = result;
      });
      await vi.advanceTimersByTimeAsync(EXPO_PATIENCE - 1);
      expect(finished).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      expect(finished).not.toBeNull();
      const { claimed, outcomes } = finished as unknown as Awaited<ReturnType<typeof run>>;
      expect(asked).toBe(1);
      expect(state.down).toBe('timeout');
      // Every browser of the run is told: twenty of the thirty players have one.
      expect(web.map((sent) => (sent.subscription as { endpoint: string }).endpoint)).toEqual(groups.flat().filter((row) => !isApp(row)).map((row) => (row as WebDevice).endpoint));
      expect(forgotten).toEqual([]);
      // The first player, whose phone met the timeout, had their day taken: nobody knows whether Expo sent it.
      // Every other player with a phone alone keeps their day, and may be told another day.
      expect(outcomes[0]).toBe('told 0');
      expect(claimed).toEqual(groups.filter((rows, i) => i === 0 || rows.some((row) => !isApp(row))).map((rows) => rows[0].user_id));
      expect(outcomes.filter((outcome) => outcome === 'unreached')).toHaveLength(9);
      expect(state.skipped).toBe(9 + 10);
      expect(logged).toEqual(['expo push: 1 batches, failed: timeout ×1; tickets refused: none; Expo is not asked again in this run']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks no more after Expo could not be reached, and asks again on the next run', async () => {
    const { senders, posts, web } = fakes({ expoThrows: true });
    const first = { ...senders, run: expoRun() };
    const { claimed, outcomes } = await run(players(9), first);
    expect(first.run.down).toBe('unreachable');
    expect(outcomes).toEqual(['told 0', 'told 1', 'told 1', 'unreached', 'told 1', 'told 1', 'unreached', 'told 1', 'told 1']);
    expect(claimed).toEqual(['u0', 'u1', 'u2', 'u4', 'u5', 'u7', 'u8']);
    expect(web).toHaveLength(6);
    const next = fakes();
    const second = { ...next.senders, run: expoRun() };
    expect((await run(players(9), second)).outcomes).toEqual(['told 1', 'told 2', 'told 1', 'told 1', 'told 2', 'told 1', 'told 1', 'told 2', 'told 1']);
    expect(next.posts).toHaveLength(6);
    expect(posts).toHaveLength(0);
  });

  it('goes on asking Expo after an answer it could not read, which is no outage', async () => {
    const { senders, logged } = fakes();
    let asked = 0;
    const state = expoRun();
    const garbled: Senders = {
      ...senders,
      run: state,
      post: async () => {
        asked += 1;
        return { ok: true, status: 200, json: async () => JSON.parse('<html>') as unknown };
      },
    };
    const { outcomes } = await run(players(4), garbled);
    expect(state.down).toBeNull();
    expect(asked).toBe(3);
    expect(outcomes).toEqual(['told 0', 'told 1', 'told 1', 'told 0']);
    expect(logged).toEqual(Array.from({ length: 3 }, () => 'expo push: 1 batches, failed: unreadable ×1; tickets refused: none'));
  });

  it('goes on asking Expo after an answer that came quickly, even a refusal', async () => {
    const { senders, posts } = fakes({ expoStatus: 503 });
    const state = expoRun();
    const { outcomes } = await run(players(6), { ...senders, run: state });
    expect(state.down).toBeNull();
    expect(posts).toHaveLength(4);
    expect(outcomes).toEqual(['told 0', 'told 1', 'told 1', 'told 0', 'told 1', 'told 1']);
  });

  it('never takes the day of a player nothing can be told: no browser keys, and Expo down', async () => {
    const { senders } = fakes({ web: false });
    const state = expoRun();
    state.down = 'timeout';
    let asked = 0;
    const told = await tellPlayer([browser('u1'), phone('u1')], async () => (asked += 1) > 0, () => weekly, 60, 'normal', { ...senders, run: state });
    expect(told).toEqual({ told: false, why: 'unreached' });
    expect(asked).toBe(0);
  });

  it('tells nobody whose day was taken already', async () => {
    const { senders, web, posts } = fakes();
    expect(await tellPlayer([browser('u1'), phone('u1')], async () => false, () => weekly, 60, 'normal', { ...senders, run: expoRun() })).toEqual({ told: false, why: 'had-today' });
    expect(web).toEqual([]);
    expect(posts).toEqual([]);
  });
});

describe("what a run of the clock answers", () => {
  it('adds up each player, and says whether Expo was down and how many phones it left', async () => {
    const totals = tally();
    addUp(totals, { told: true, sent: 2, removed: 1 });
    addUp(totals, { told: true, sent: 0, removed: 0 });
    addUp(totals, { told: false, why: 'had-today' });
    addUp(totals, { told: false, why: 'unreached' });
    // A player told on an earlier page of the run, whose phones on a later page Expo could not take, was told: not unreached.
    addUp(totals, { told: false, why: 'unreached' }, true);
    expect(totals).toEqual({ sent: 2, removed: 1, skipped: 1, unreached: 1 });
    expect(expoAnswer(expoRun())).toEqual({ expoDown: null, phonesSkipped: 0 });
    const { senders } = fakes({ expoThrows: true });
    const state = expoRun();
    await deliverTo([phone('u1')], () => weekly, 60, 'normal', { ...senders, run: state });
    await deliverTo([phone('u2'), phone('u2', 2)], () => weekly, 60, 'normal', { ...senders, run: state });
    expect(expoAnswer(state)).toEqual({ expoDown: 'unreachable', phonesSkipped: 2 });
  });

  it('is what the weekly and market notices answer, each player added up as told before or not', () => {
    const source = (name: string) => readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
    const weekly = source('weekly-notice');
    const market = source('market-notice');
    expect(weekly).toMatch(/json\(200, \{ kind, \.\.\.totals, \.\.\.expoAnswer\(notices\.run\) \}\)/);
    expect(market).toMatch(/json\(200, \{ \.\.\.totals, quiet, \.\.\.expoAnswer\(notices\.run\) \}\)/);
    expect(weekly).toMatch(/const before = taken\.has\(user\);[\s\S]*addUp\(totals, done, before\)/);
    expect(market).toMatch(/addUp\(totals, done\)/);
  });
});

/** Every notice as a browser was sent it before phones could be told, byte for byte. */
const ABOUTS: NoticeAbout[] = [
  { kind: 'weekly', place: 3, entrants: 41 },
  { kind: 'weekly', place: null, entrants: null },
  { kind: 'roomStarted', seconds: 90 },
  { kind: 'yourTurn', round: 6, rounds: 20, secondsLeft: 72 },
  { kind: 'newRound', round: 6, rounds: 20, seconds: 86_400 },
  { kind: 'rematch' },
  { kind: 'idle' },
  { kind: 'marketMoved', asset: 'bitcoin', percent: -12 },
  { kind: 'loanOffer', who: 'Ana', lend: true, amount: 1_000_000, rateBp: 750, rounds: 3 },
  { kind: 'shout', who: null, n: 13 },
  { kind: 'friendRequest', who: 'Ana' },
  { kind: 'friendAccepted', who: null },
];
const BEFORE = [
  "{\"title\":\"A new weekly challenge\",\"body\":\"You came #3 of 41 last week. A new one has begun.\",\"url\":\"/en/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"A new weekly challenge\",\"body\":\"One life, one rule, the same world for everyone. See where you rank this week.\",\"url\":\"/en/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Your game has started\",\"body\":\"Everyone lives the same life now. You have 1:30 for each round.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"They are waiting for you\",\"body\":\"Everyone else has played round 6 of 20. 1:12 left.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Round 6 of 20\",\"body\":\"A new round of your game has begun. You have 24 h to play it.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Rematch!\",\"body\":\"Someone from your last game wants another. Join them from the game.\",\"url\":\"/en/room\",\"tag\":\"room\"}",
  "{\"title\":\"Your life is waiting\",\"body\":\"You left a life halfway. Pick it up where you left it.\",\"url\":\"/en/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Your market moved\",\"body\":\"Your Bitcoin fell 12% in your last round. Come and see where you stand.\",\"url\":\"/en/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana offers you a loan\",\"body\":\"$10,000 at 7.5% over 3 rounds. Answer before the round turns.\",\"url\":\"/en/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"A rival says:\",\"body\":\"Hurry up!\",\"url\":\"/en/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"A friend request\",\"body\":\"Ana wants to be your friend. Say yes to see each other's lives among your friends.\",\"url\":\"/en/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"You have a new friend\",\"body\":\"A player said yes. Now you see each other's lives among your friends.\",\"url\":\"/en/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Nuevo reto semanal\",\"body\":\"Quedaste #3 de 41 la semana pasada. Ya hay uno nuevo.\",\"url\":\"/es/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Nuevo reto semanal\",\"body\":\"Una vida, una regla y el mismo mundo para todos. A ver en qué puesto quedas esta semana.\",\"url\":\"/es/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Empieza la partida\",\"body\":\"Todos vivís ya la misma vida. Tienes 1:30 por ronda.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Faltas tú\",\"body\":\"Los demás ya han jugado la ronda 6 de 20. Quedan 1:12.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Ronda 6 de 20\",\"body\":\"Empieza una ronda nueva de tu partida. Tienes 24 h para jugarla.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"¡Revancha!\",\"body\":\"Alguien de tu última partida quiere otra. Únete desde la partida.\",\"url\":\"/es/room\",\"tag\":\"room\"}",
  "{\"title\":\"Tu vida te espera\",\"body\":\"Dejaste una vida a medias. Sigue donde la dejaste.\",\"url\":\"/es/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Tu mercado se ha movido\",\"body\":\"Tu Bitcoin ha bajado un 12% en tu última ronda. Pasa a ver cómo estás.\",\"url\":\"/es/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana te ofrece un préstamo\",\"body\":\"10.000 $ al 7.5% en 3 rondas. Responde antes de que acabe la ronda.\",\"url\":\"/es/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"Un rival dice:\",\"body\":\"¡Date prisa!\",\"url\":\"/es/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"Solicitud de amistad\",\"body\":\"Ana quiere ser tu amigo. Acéptala y veréis vuestras vidas entre amigos.\",\"url\":\"/es/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Tienes un amigo nuevo\",\"body\":\"Un jugador ha aceptado. Ya veis vuestras vidas entre amigos.\",\"url\":\"/es/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Новый недельный вызов\",\"body\":\"На прошлой неделе у тебя #3 из 41. Начался новый.\",\"url\":\"/ru/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Новый недельный вызов\",\"body\":\"Одна жизнь, одно правило и один мир для всех. Посмотри, каким будет твоё место на этой неделе.\",\"url\":\"/ru/challenge\",\"tag\":\"weekly-challenge\"}",
  "{\"title\":\"Партия началась\",\"body\":\"Все живут одну и ту же жизнь. На каждый раунд у тебя 1:30.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Ждут только тебя\",\"body\":\"Остальные уже сыграли раунд 6 из 20. Осталось 1:12.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Раунд 6 из 20\",\"body\":\"В твоей партии начался новый раунд. На него у тебя 24 ч.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Реванш!\",\"body\":\"Кто-то из твоей последней партии хочет ещё одну. Присоединяйся из партии.\",\"url\":\"/ru/room\",\"tag\":\"room\"}",
  "{\"title\":\"Твоя жизнь ждёт\",\"body\":\"Одна из твоих жизней осталась на полпути. Продолжи с того же места.\",\"url\":\"/ru/play\",\"tag\":\"idle-life\"}",
  "{\"title\":\"Твой рынок сдвинулся\",\"body\":\"Bitcoin: −12% за твой последний раунд. Загляни, посмотри, как дела.\",\"url\":\"/ru/play\",\"tag\":\"market-moved\"}",
  "{\"title\":\"Ana предлагает тебе заём\",\"body\":\"10 000 $ под 7.5% на 3 раунда. Ответь до конца раунда.\",\"url\":\"/ru/room\",\"tag\":\"room-loan\"}",
  "{\"title\":\"Соперник говорит:\",\"body\":\"Поторопись!\",\"url\":\"/ru/room\",\"tag\":\"room-shout\"}",
  "{\"title\":\"Заявка в друзья\",\"body\":\"Ana хочет дружить. Прими заявку, и вы будете видеть жизни друг друга среди друзей.\",\"url\":\"/ru/rankings#friends\",\"tag\":\"friends\"}",
  "{\"title\":\"Новый друг\",\"body\":\"Игрок принимает заявку. Теперь вы видите жизни друг друга среди друзей.\",\"url\":\"/ru/rankings#friends\",\"tag\":\"friends\"}",
];

describe('what a browser is sent', () => {
  it('is what it was before phones, byte for byte, with the same options and keys', async () => {
    const sent: string[] = [];
    let index = 0;
    for (const locale of ['en', 'es', 'ru']) {
      for (const about of ABOUTS) {
        const { senders, web, posts } = fakes();
        const row = { ...browser('u1', index, locale), token: null };
        expect(await deliverTo([row], () => about, 3_600, 'high', senders)).toEqual({ sent: 1, removed: 0 });
        expect(posts).toEqual([]);
        expect(web[0].subscription).toEqual({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } });
        expect(web[0].options).toEqual({ TTL: 3_600, urgency: 'high' });
        sent.push(web[0].payload);
        index += 1;
      }
    }
    expect(sent).toEqual(BEFORE);
  });
});
