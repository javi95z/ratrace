import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@/session/memory';
import { Unreachable } from '@/session/errors';
import type { RoomsLink } from '@/session/room';
import { roomServer } from '@/testing/roomServer';
import { createRoomStore, LOOK_EVERY_MS } from './room';
import type { RoomStore } from './room';
import type { GameStore } from './store';

// A room is two lives played a round at a time: a few seconds on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION };

/** Lets every answer on its way arrive, and every page act on it. */
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A server, a clock that the server and every page share, and pages on it. `offset` is how far the pages' clock is from the server's. */
function world(offset = 0) {
  const server = roomServer();
  const timers: Array<{ at: number; run: () => void; live: boolean }> = [];
  const clock = { now: server.state.now };
  const schedule = (run: () => void, ms: number) => {
    const timer = { at: clock.now + Math.max(0, ms), run, live: true };
    timers.push(timer);
    return () => {
      timer.live = false;
    };
  };
  /** Moves every clock on, running what falls due on the way, in order. */
  const advance = async (ms: number) => {
    const until = clock.now + ms;
    for (;;) {
      const next = timers.filter((timer) => timer.live && timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      server.wait(next.at - clock.now);
      clock.now = next.at;
      next.live = false;
      next.run();
      await settle();
    }
    server.wait(until - clock.now);
    clock.now = until;
    await settle();
  };
  const page = (user: string, link: () => RoomsLink | null = () => server.link(user), store = new MemoryStore(), timers = schedule, rules = versions) => ({
    rooms: createRoomStore({ link, store, content, lives, versions: rules, now: () => clock.now + offset, schedule: timers }),
    store,
  });
  /** A page that hears nothing through Realtime. */
  const deaf = (user: string): (() => RoomsLink) => () => ({ ...server.link(user), watch: () => () => {} });
  return { server, clock, advance, page, deaf };
}

/** From the news of a round to its finances, answering every card with its first option. */
async function toFinance(game: GameStore) {
  const s = () => game.getState();
  if (s().stage === 'news') s().leaveNews();
  while (s().stage === 'cards' || s().stage === 'outcome') {
    if (s().stage === 'cards') await s().pick(0);
    else s().afterCard();
  }
  expect(s().stage).toBe('finance');
}

const gameOf = (rooms: RoomStore): GameStore => {
  const game = rooms.getState().game;
  if (game === null) throw new Error('the page has no life in the room');
  return game;
};

/** HOST's page opens a room, B's joins it, and HOST starts it. */
async function playing(w = world()) {
  const host = w.page(HOST);
  const b = w.page(B);
  await host.rooms.getState().boot();
  await b.rooms.getState().boot();
  expect(await host.rooms.getState().open('nurse', 180)).toBe(true);
  expect(await b.rooms.getState().join((host.rooms.getState().room?.code ?? '').toLowerCase())).toBe(true);
  await host.rooms.getState().start();
  await settle();
  return { ...w, host, b };
}

describe('the room a page follows', () => {
  it('is unavailable with nobody signed in, and none for a player in no room', async () => {
    const w = world();
    const nobody = w.page(HOST, () => null);
    await nobody.rooms.getState().boot();
    expect(nobody.rooms.getState().status).toBe('unavailable');
    const host = w.page(HOST);
    await host.rooms.getState().boot();
    expect(host.rooms.getState()).toMatchObject({ status: 'none', room: null });
  });

  it('opens a room, and the host\'s page hears who joins as it happens', async () => {
    const w = world();
    const host = w.page(HOST);
    await host.rooms.getState().boot();
    expect(await host.rooms.getState().open('nurse', 90)).toBe(true);
    const room = host.rooms.getState().room;
    expect(room).toMatchObject({ status: 'open', seconds: 90, members: [{ userId: HOST, me: true, host: true }] });
    const b = w.page(B);
    await b.rooms.getState().boot();
    expect(await b.rooms.getState().join(` ${room?.code.toLowerCase()} `)).toBe(true);
    await settle();
    expect(host.rooms.getState().room?.members.map((m) => [m.userId, m.me])).toEqual([[HOST, true], [B, false]]);
  });

  it('keeps the server\'s no to be shown, and shows the room the player is already in', async () => {
    const w = world();
    const host = w.page(HOST);
    await host.rooms.getState().boot();
    expect(await host.rooms.getState().join('ZZZZZZ')).toBe(false);
    expect(host.rooms.getState().refusal).toBe('unknown-room');
    const locked = lives.find((life) => life.unlock !== 'default') as (typeof lives)[number];
    expect(await host.rooms.getState().open(locked.id, 90)).toBe(false);
    expect(host.rooms.getState().refusal).toBe('locked-life');
    host.rooms.getState().clearRefusal();
    w.server.network.down = true;
    expect(await host.rooms.getState().open('nurse', 90)).toBe(false);
    expect(host.rooms.getState()).toMatchObject({ refusal: 'unreachable', status: 'none' });
    w.server.network.down = false;
    // Opened from another page meanwhile: this one is told so, and shown it.
    await w.server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    expect(await host.rooms.getState().open('nurse', 90)).toBe(false);
    expect(host.rooms.getState()).toMatchObject({ refusal: 'in-a-room', status: 'in', room: { status: 'open' } });
  });

  it('gives each member the same life when the room starts, on a round store of its own, and leaves the device\'s own life alone', async () => {
    const { host, b } = await playing();
    const [one, two] = [gameOf(host.rooms).getState(), gameOf(b.rooms).getState()];
    expect(one.status).toBe('playing');
    expect(one.view).toEqual(two.view);
    expect(one.lifeId).toBe('nurse');
    expect(await host.store.loadGame()).toBeNull();
  });

  it('plays the cards at once, waits after playing the round, and shows its result once the last has played', async () => {
    const { host, b } = await playing();
    await toFinance(gameOf(host.rooms));
    const waiting = gameOf(host.rooms).getState().play();
    await settle();
    expect(gameOf(host.rooms).getState()).toMatchObject({ busy: true, stage: 'finance' });
    expect(host.rooms.getState().room?.members.find((m) => m.me)?.ready).toBe(true);
    expect(b.rooms.getState().room?.members.find((m) => m.userId === HOST)).toMatchObject({ ready: true, standing: null });

    await toFinance(gameOf(b.rooms));
    await gameOf(b.rooms).getState().play();
    await waiting;
    await settle();
    for (const page of [host, b]) {
      const life = gameOf(page.rooms).getState();
      expect(life).toMatchObject({ busy: false, stage: 'resolve' });
      expect(life.view?.round).toBe(1);
      expect(life.resolved?.events.length).toBeGreaterThan(0);
      expect(page.rooms.getState().room).toMatchObject({ round: 1 });
      expect(page.rooms.getState().room?.members.every((m) => m.standing !== null)).toBe(true);
    }
  });

  it('plays the round as it stands a second before the deadline: the basket from the finances, nothing from the cards', async () => {
    const { host, b, server, advance, clock } = await playing();
    const room = host.rooms.getState().room?.id as string;
    await toFinance(gameOf(host.rooms));
    const order = { type: 'buy', assetId: 'sp500', amount: 10_000 } as const;
    const taken = gameOf(host.rooms).getState().addOrder(order);
    expect([taken, gameOf(host.rooms).getState().refusal]).toEqual([true, null]);
    const deadline = host.rooms.getState().room?.deadline as number;
    await advance(deadline - clock.now - 1_001);
    expect(server.db.orders.size).toBe(0);
    await advance(1);
    for (const page of [host, b]) expect(gameOf(page.rooms).getState()).toMatchObject({ stage: 'resolve', busy: false });
    expect(server.logOf(HOST, room)[0].orders).toEqual([order]);
    const [bRound] = server.logOf(B, room);
    expect(bRound.orders).toEqual([]);
    expect(bRound.picks.every((pick) => pick === 0)).toBe(true);
  });

  it('turns the round once it is due when another member is away, and the page that waited shows it', async () => {
    const w = world();
    const host = w.page(HOST);
    await host.rooms.getState().boot();
    await host.rooms.getState().open('nurse', 90);
    // B joined from somewhere else and is not here.
    await w.server.ask(B, { action: 'join', code: host.rooms.getState().room?.code, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    await host.rooms.getState().start();
    await settle();
    await toFinance(gameOf(host.rooms));
    const waiting = gameOf(host.rooms).getState().play();
    await w.advance(90_000 + 5_000 - 1);
    expect(gameOf(host.rooms).getState().busy).toBe(true);
    await w.advance(1_000);
    await waiting;
    expect(gameOf(host.rooms).getState()).toMatchObject({ stage: 'resolve' });
    expect(host.rooms.getState().room?.round).toBe(1);
  });

  it('finds its room as it stands after sleeping through rounds, opens the life there, and says how many the clock played', async () => {
    const w = world();
    const host = w.page(HOST);
    // B's page hears nothing, asks nothing and plays nothing while it sleeps: no Realtime, and no clock of its own.
    const sleeping = createRoomStore({
      link: () => ({ ...w.server.link(B), watch: () => () => {} }),
      store: new MemoryStore(),
      content,
      lives,
      versions,
      now: () => w.clock.now,
      schedule: () => () => {},
    });
    await host.rooms.getState().boot();
    await host.rooms.getState().open('nurse', 90);
    await sleeping.getState().join(host.rooms.getState().room?.code ?? '');
    await host.rooms.getState().start();
    await sleeping.getState().refresh();
    await settle();
    expect(gameOf(sleeping).getState().view?.round).toBe(0);
    for (let round = 0; round < 2; round++) {
      await toFinance(gameOf(host.rooms));
      const waiting = gameOf(host.rooms).getState().play();
      await w.advance(90_000 + 5_000 + 1_000);
      await waiting;
      expect(gameOf(host.rooms).getState().stage).toBe('resolve');
      gameOf(host.rooms).getState().next();
    }
    await sleeping.getState().refresh();
    await settle();
    expect(sleeping.getState()).toMatchObject({ missed: 2, room: { round: 2 } });
    expect(gameOf(sleeping).getState()).toMatchObject({ status: 'playing', stage: 'news' });
    expect(gameOf(sleeping).getState().view?.round).toBe(2);
    sleeping.getState().clearMissed();
    expect(sleeping.getState().missed).toBe(0);
  });

  it('counts down on the server\'s clock, however far the page\'s own is from it', async () => {
    const { host, server, advance, clock } = await playing(world(30_000));
    await toFinance(gameOf(host.rooms));
    const deadline = host.rooms.getState().room?.deadline as number;
    expect(host.rooms.getState().skew).toBe(-30_000);
    await advance(deadline - clock.now - 1_001);
    expect(server.db.orders.size).toBe(0);
    await advance(1);
    expect(server.db.orders.size).toBeGreaterThan(0);
  });

  it('shows the player ready from the answer to their round, with nothing heard through Realtime', async () => {
    const w = world();
    const host = w.page(HOST, w.deaf(HOST));
    const b = w.page(B, w.deaf(B));
    await host.rooms.getState().open('nurse', 180);
    await b.rooms.getState().join(host.rooms.getState().room?.code ?? '');
    await host.rooms.getState().start();
    await b.rooms.getState().refresh();
    await settle();
    await toFinance(gameOf(host.rooms));
    void gameOf(host.rooms).getState().play();
    await settle();
    expect(host.rooms.getState().room?.members.find((m) => m.me)?.ready).toBe(true);
  });

  it('shows a round the clock played for a page that was not waiting as a played round, and says so', async () => {
    const w = world();
    const host = w.page(HOST);
    // B's page hears the room, and has no clock of its own: a tab in the background, whose timers the browser holds back.
    const b = w.page(B, () => w.server.link(B), new MemoryStore(), () => () => {});
    await host.rooms.getState().open('nurse', 90);
    await b.rooms.getState().join(host.rooms.getState().room?.code ?? '');
    await host.rooms.getState().start();
    await settle();
    await toFinance(gameOf(host.rooms));
    const waiting = gameOf(host.rooms).getState().play();
    await w.advance(90_000 + 5_000 + 1_000);
    await waiting;
    await settle();
    expect(gameOf(b.rooms).getState()).toMatchObject({ stage: 'resolve', busy: false });
    expect(gameOf(b.rooms).getState().view?.round).toBe(1);
    expect(gameOf(b.rooms).getState().resolved?.events.length).toBeGreaterThan(0);
    expect(b.rooms.getState().missed).toBe(1);
  });

  it('opened again after playing its round, waits as it did, shows the round once it turns, and plays nothing twice', async () => {
    const w = world();
    const first = w.page(HOST);
    // B's page is in the background, with no clock of its own: the round turns when it is due, not when B's time is up.
    const b = w.page(B, () => w.server.link(B), new MemoryStore(), () => () => {});
    await first.rooms.getState().open('nurse', 180);
    await b.rooms.getState().join(first.rooms.getState().room?.code ?? '');
    await first.rooms.getState().start();
    await settle();
    await toFinance(gameOf(first.rooms));
    expect(gameOf(first.rooms).getState().addOrder({ type: 'buy', assetId: 'sp500', amount: 10_000 })).toBe(true);
    void gameOf(first.rooms).getState().play();
    await settle();
    // The page is closed, and opened again.
    const again = w.page(HOST);
    await again.rooms.getState().boot();
    await settle();
    expect(again.rooms.getState().room?.members.find((m) => m.me)?.ready).toBe(true);
    const room = again.rooms.getState().room?.id as string;
    await w.advance((again.rooms.getState().room?.deadline as number) - w.clock.now + 5_000 + 1_000);
    // Its own time-up found the player ready, and sent nothing; the round turned when it was due.
    expect(w.server.logOf(HOST, room)[0].orders).toEqual([{ type: 'buy', assetId: 'sp500', amount: 10_000 }]);
    // Nothing was refused on the way: the page never had to open the life again as one that had moved.
    expect(gameOf(again.rooms).getState()).toMatchObject({ stage: 'resolve', moved: false });
    expect(again.rooms.getState().missed).toBe(0);
  });

  it('plays a room to its end: each page keeps the life among its finished lives, as a room\'s, and the room\'s order by score', async () => {
    const { host, b } = await playing();
    for (let round = 0; round < content.rounds; round++) {
      await toFinance(gameOf(host.rooms));
      const waiting = gameOf(host.rooms).getState().play();
      await toFinance(gameOf(b.rooms));
      await gameOf(b.rooms).getState().play();
      await waiting;
      await settle();
      for (const page of [host, b]) gameOf(page.rooms).getState().next();
    }
    for (const page of [host, b]) {
      expect(page.rooms.getState().room).toMatchObject({ status: 'finished' });
      expect(gameOf(page.rooms).getState().stage).toBe('end');
      const [run] = await page.store.listRuns();
      expect(run).toMatchObject({ room: true, seed: '' });
      expect(page.rooms.getState().room?.members.find((m) => m.me)?.standing?.score).toBe(run.score);
    }
  });

  it('opens the life again when the first look at it did not get through', async () => {
    const w = world();
    let failing = true;
    // The page's way to the server loses every look at the life, for a while.
    const flaky = (): RoomsLink => {
      const link = w.server.link(HOST);
      return {
        ...link,
        api: {
          ...link.api,
          view: (roomId) => (failing ? Promise.reject(new Unreachable('lost')) : link.api.view(roomId)),
        },
      };
    };
    const host = w.page(HOST, flaky);
    await host.rooms.getState().open('nurse', 180);
    await w.server.ask(B, { action: 'join', code: host.rooms.getState().room?.code, ...{ engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION } });
    await host.rooms.getState().start();
    await settle();
    expect(gameOf(host.rooms).getState().status).toBe('none');
    failing = false;
    await w.advance(LOOK_EVERY_MS);
    expect(gameOf(host.rooms).getState().status).toBe('playing');
  });

  it('can join again a lobby it left by mistake, and keeps a room whose leaving did not get through', async () => {
    const w = world();
    const host = w.page(HOST);
    const b = w.page(B);
    await host.rooms.getState().open('nurse', 180);
    const code = host.rooms.getState().room?.code ?? '';
    await b.rooms.getState().join(code);
    await b.rooms.getState().leave();
    expect(b.rooms.getState().status).toBe('none');
    expect(await b.rooms.getState().join(code)).toBe(true);
    await settle();
    expect(b.rooms.getState()).toMatchObject({ status: 'in', room: { status: 'open' } });
    w.server.network.down = true;
    await b.rooms.getState().leave();
    expect(b.rooms.getState()).toMatchObject({ status: 'in', refusal: 'unreachable', room: { status: 'open' } });
    w.server.network.down = false;
    await b.rooms.getState().refresh();
    expect(b.rooms.getState()).toMatchObject({ status: 'in', room: { status: 'open' } });
  });

  it('does not open a life in a room that plays other rules than the page, and says so', async () => {
    const w = world();
    const host = w.page(HOST);
    await host.rooms.getState().open('nurse', 180);
    await w.server.ask(B, { action: 'join', code: host.rooms.getState().room?.code, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    await host.rooms.getState().start();
    // A page on newer rules, opened after the room began.
    const newer = w.page(B, () => w.server.link(B), new MemoryStore(), undefined, { engine: '99.0.0', content: CONTENT_VERSION });
    await newer.rooms.getState().boot();
    expect(newer.rooms.getState()).toMatchObject({ status: 'in', otherRules: true, game: null });
    expect(host.rooms.getState().otherRules).toBe(false);
  });

  it('wakes after sleeping through rounds while it waited, with no ledger of the wrong round, and says how many the clock played', async () => {
    const w = world();
    const host = w.page(HOST, w.deaf(HOST), new MemoryStore(), () => () => {});
    await host.rooms.getState().open('nurse', 90);
    await w.server.ask(B, { action: 'join', code: host.rooms.getState().room?.code, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    await host.rooms.getState().start();
    await settle();
    const room = host.rooms.getState().room?.id as string;
    await toFinance(gameOf(host.rooms));
    const waiting = gameOf(host.rooms).getState().play();
    await settle();
    // The phone sleeps: the round the player played turns, and two more after it by the clock.
    for (let round = 0; round < 3; round++) {
      w.server.wait(90_000 + 5_000);
      await w.server.ask(B, { action: 'state', roomId: room });
    }
    await host.rooms.getState().refresh();
    await waiting;
    await settle();
    expect(host.rooms.getState()).toMatchObject({ missed: 2, room: { round: 3 } });
    expect(gameOf(host.rooms).getState()).toMatchObject({ stage: 'news', moved: true });
    expect(gameOf(host.rooms).getState().view?.round).toBe(3);
  });

  it('lets go of the room and the life of an account that is no longer the one signed in', async () => {
    const w = world();
    let who = HOST;
    const page = w.page(HOST, () => w.server.link(who));
    await page.rooms.getState().open('nurse', 180);
    await w.server.ask(B, { action: 'join', code: page.rooms.getState().room?.code, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    await page.rooms.getState().start();
    await settle();
    expect(page.rooms.getState().game).not.toBeNull();
    // Another account, in a lobby of its own.
    const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    await w.server.ask(C, { action: 'open', lifeId: 'nurse', seconds: 90, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    who = C;
    await page.rooms.getState().boot();
    expect(page.rooms.getState()).toMatchObject({ status: 'in', game: null, missed: 0, room: { status: 'open', seconds: 90 } });
  });

  it('looks again every fifteen seconds, and when the page comes back online after being away', async () => {
    const w = world();
    const host = w.page(HOST);
    w.server.network.down = true;
    await host.rooms.getState().boot();
    expect(host.rooms.getState().status).toBe('away');
    w.server.network.down = false;
    await w.server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    await w.advance(LOOK_EVERY_MS);
    expect(host.rooms.getState()).toMatchObject({ status: 'in', room: { status: 'open' } });
    await w.server.ask(B, { action: 'join', code: host.rooms.getState().room?.code, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
    expect(host.rooms.getState().room?.members).toHaveLength(1);
    await w.advance(LOOK_EVERY_MS);
    expect(host.rooms.getState().room?.members).toHaveLength(2);
  });

  it('leaves: the lobby closes when its host goes, and a member is in no room once they leave it', async () => {
    const w = world();
    const host = w.page(HOST);
    const b = w.page(B);
    await host.rooms.getState().boot();
    await host.rooms.getState().open('nurse', 180);
    await b.rooms.getState().join(host.rooms.getState().room?.code ?? '');
    await host.rooms.getState().leave();
    await settle();
    expect(host.rooms.getState()).toMatchObject({ status: 'none', room: null, game: null });
    // B's page is told the room was closed under them, and is in no room.
    expect(b.rooms.getState()).toMatchObject({ status: 'none', room: null, closed: true });
    expect(host.rooms.getState().closed).toBe(false);
    b.rooms.getState().clearClosed();
    expect(b.rooms.getState().closed).toBe(false);
  });

  it('gives up the life in play when a member leaves, and the room goes on without them', async () => {
    const { host, b } = await playing();
    await toFinance(gameOf(host.rooms));
    const waiting = gameOf(host.rooms).getState().play();
    await b.rooms.getState().leave();
    await waiting;
    await settle();
    expect(b.rooms.getState().status).toBe('none');
    expect(gameOf(host.rooms).getState().stage).toBe('resolve');
    expect(host.rooms.getState().room?.members.find((m) => m.userId === B)?.left).toBe(true);
  });
});
