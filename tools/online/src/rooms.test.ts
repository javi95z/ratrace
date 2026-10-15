import { content, lives, replayLife } from '@ratrace/content';
import { finalScore, viewOf } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT, GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { GRACE_MS as GRACE_OF_SERVER } from '../../../supabase/functions/_shared/rooms.ts';
import { roomServer } from '../../../apps/web/src/testing/roomServer.ts';

// Several tests here play a whole life for two players: a few seconds alone, more on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

/** Five seconds after its deadline a round still waits, as the design says: the server's constant is held to it. */
const GRACE_MS = 5_000;

const HOST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const [ENGINE, CONTENT] = CURRENT.split('/');
const VERSIONS = { engineVersion: ENGINE, contentVersion: CONTENT };
const locked = lives.find((life) => life.unlock !== 'default');
if (!locked) throw new Error('the content has no locked life');
const nurse = lives.find((life) => life.id === 'nurse');
if (!nurse) throw new Error('the content has no nurse');

type Body = Record<string, unknown>;
type Room = { id: string; code: string; status: string; round: number; rounds: number; deadline: string | null; now: string; seconds: number; host: string; lifeId: string; members: Array<{ userId: string; me: boolean; host: boolean; ready: boolean; left: boolean; name: string | null; standing: Record<string, unknown> | null }> };
const roomOf = (reply: { body: Body }) => reply.body.room as Room;

/** A room opened by HOST, joined by B (and C if asked), and started. */
async function begun(server = roomServer(), seconds = 180, also: string[] = []) {
  const opened = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds, ...VERSIONS });
  expect(opened.status).toBe(200);
  const room = roomOf(opened);
  for (const who of [B, ...also]) expect((await server.ask(who, { action: 'join', code: room.code, ...VERSIONS })).status).toBe(200);
  expect((await server.ask(HOST, { action: 'start', roomId: room.id })).status).toBe(200);
  return { server, room: room.id, code: room.code };
}

/** The life of a member as they may see it, and how many steps it has taken. */
async function lifeOf(server: ReturnType<typeof roomServer>, who: string, room: string) {
  const reply = await server.ask(who, { action: 'view', roomId: room });
  expect(reply.status).toBe(200);
  return reply.body as { step: number; view: GameState; events: unknown[]; run?: Record<string, unknown>; record: { history: number[] } };
}

/** Answers every card of a member's hand with `option`, one step at a time, as a page would. */
async function answerHand(server: ReturnType<typeof roomServer>, who: string, room: string, option = 0) {
  for (;;) {
    const life = await lifeOf(server, who, room);
    if (life.view.finished || life.view.phase !== 'cards') return life.step;
    expect((await server.ask(who, { action: 'card', roomId: room, step: life.step, option })).status).toBe(200);
  }
}

describe('opening a room', () => {
  it('waits five seconds past a deadline, as the design says', () => {
    expect(GRACE_OF_SERVER).toBe(GRACE_MS);
  });

  it('opens one for a life the host may play, with a code, the host in it, and a round of the seconds asked for', async () => {
    const server = roomServer();
    const reply = await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS });
    expect(reply.status).toBe(200);
    const room = roomOf(reply);
    expect(room.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(room).toMatchObject({ status: 'open', round: 0, seconds: 90, lifeId: 'nurse', host: HOST, deadline: null, rounds: content.rounds });
    expect(room.members).toEqual([{ userId: HOST, name: null, me: true, host: true, ready: false, left: false, standing: null }]);
  });

  it('refuses what is not a room: a round of other seconds, an unknown life, a locked one, rules the server does not play now', async () => {
    const server = roomServer();
    expect(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 60, ...VERSIONS })).toMatchObject({ status: 400, body: { field: 'seconds' } });
    expect(await server.ask(HOST, { action: 'open', lifeId: 'nobody', seconds: 90, ...VERSIONS })).toMatchObject({ status: 400, body: { error: 'unknown-life' } });
    expect(await server.ask(HOST, { action: 'open', lifeId: locked.id, seconds: 90, ...VERSIONS })).toMatchObject({ status: 403, body: { error: 'locked-life' } });
    server.db.unlocked.set(HOST, [locked.id]);
    expect((await server.ask(HOST, { action: 'open', lifeId: locked.id, seconds: 90, ...VERSIONS })).status).toBe(200);
    const other = roomServer();
    expect(await other.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, engineVersion: '0.1.0', contentVersion: '1.0.0' })).toMatchObject({ status: 409, body: { error: 'cannot-room' } });
    // Rules the server still holds, to finish lives lived under them, but no longer plays: no room begins on them.
    const older = Object.keys(GAMES).find((key) => key !== CURRENT && (GAMES[key].SEED_BITS ?? 0) >= 128 && GAMES[key].viewOf);
    expect(older).toBeDefined();
    const [engine, contentOf] = (older as string).split('/');
    expect(await other.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, engineVersion: engine, contentVersion: contentOf })).toMatchObject({ status: 409, body: { error: 'cannot-room' } });
  });

  it('keeps a player to one room at a time that is not over', async () => {
    const server = roomServer();
    const first = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS }));
    expect(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'in-a-room', roomId: first.id } });
  });

  it('counts the call before anything is looked up, and refuses beyond the limit', async () => {
    const server = roomServer();
    server.state.allowed = false;
    expect(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(await server.ask(HOST, { action: 'state', roomId: '00000000-0000-4000-8000-000000000999' })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(server.state.asked).toEqual([`${HOST}:room-make`, `${HOST}:room-step`]);
  });
});

describe('joining a room', () => {
  it('lets a player in by the code however it is typed, and says who is who to each', async () => {
    const server = roomServer();
    server.db.names.set(HOST, 'Ana_88');
    const room = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    const reply = await server.ask(B, { action: 'join', code: ` ${room.code.toLowerCase().slice(0, 3)} ${room.code.toLowerCase().slice(3)} `, ...VERSIONS });
    expect(reply.status).toBe(200);
    expect(roomOf(reply).members.map((m) => [m.userId, m.name, m.me, m.host])).toEqual([[HOST, 'Ana_88', false, true], [B, null, true, false]]);
    // Joining again answers the same room, with nobody seated twice.
    expect(roomOf(await server.ask(B, { action: 'join', code: room.code, ...VERSIONS })).members).toHaveLength(2);
  });

  it('turns away an unknown code, a page on other rules, a seventh player, and anyone once the room has started', async () => {
    const server = roomServer();
    const room = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    expect(await server.ask(B, { action: 'join', code: 'ZZZZZZ', ...VERSIONS })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
    expect(await server.ask(B, { action: 'join', code: room.code, engineVersion: '0.1.0', contentVersion: CONTENT })).toMatchObject({ status: 409, body: { error: 'other-version', engineVersion: ENGINE } });
    expect(await server.ask(B, { action: 'join', code: '<script>', ...VERSIONS })).toMatchObject({ status: 400, body: { field: 'code' } });
    const others = ['1', '2', '3', '4', '5', '6'].map((n) => `dddddddd-dddd-4ddd-8ddd-dddddddddd0${n}`);
    for (const who of others.slice(0, 5)) expect((await server.ask(who, { action: 'join', code: room.code, ...VERSIONS })).status).toBe(200);
    expect(await server.ask(others[5], { action: 'join', code: room.code, ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'full' } });
    expect((await server.ask(HOST, { action: 'start', roomId: room.id })).status).toBe(200);
    expect(await server.ask(C, { action: 'join', code: room.code, ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'started' } });
  });
});

describe('starting a room', () => {
  it('is the host\'s to do, and not alone', async () => {
    const server = roomServer();
    const room = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    expect(await server.ask(HOST, { action: 'start', roomId: room.id })).toMatchObject({ status: 409, body: { error: 'alone' } });
    await server.ask(B, { action: 'join', code: room.code, ...VERSIONS });
    expect(await server.ask(B, { action: 'start', roomId: room.id })).toMatchObject({ status: 403, body: { error: 'not-host' } });
    expect(await server.ask(C, { action: 'start', roomId: room.id })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
  });

  it('gives every member the same start in the same world, with the first round due in the room\'s seconds', async () => {
    const { server, room } = await begun(roomServer(), 300);
    const state = roomOf(await server.ask(B, { action: 'state', roomId: room }));
    expect(state).toMatchObject({ status: 'playing', round: 0, deadline: new Date(server.state.now + 300_000).toISOString(), now: new Date(server.state.now).toISOString() });
    const [host, b] = [await lifeOf(server, HOST, room), await lifeOf(server, B, room)];
    expect(b.view).toEqual(host.view);
    expect(b.step).toBe(0);
    // One seed for the whole room, and it never leaves the server.
    expect(new Set(server.db.seeds.values()).size).toBe(1);
    expect(JSON.stringify([state, host, b])).not.toContain([...server.db.seeds.values()][0]);
  });
});

describe('a round in a room', () => {
  it('plays a card at once, and answers it as a ranked step is answered', async () => {
    const { server, room } = await begun();
    const life = await lifeOf(server, HOST, room);
    const reply = await server.ask(HOST, { action: 'card', roomId: room, step: life.step, option: 1 });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ step: 1, world: null });
    expect((reply.body.view as GameState).answered).toBe(1);
    expect(reply.body).not.toHaveProperty('view.timeline');
    // The same card asked for again, its answer lost on the way: the same answer, and nothing played twice.
    expect((await server.ask(HOST, { action: 'card', roomId: room, step: life.step, option: 1 })).body).toEqual(reply.body);
    expect(await server.ask(HOST, { action: 'card', roomId: room, step: 0, option: 0 })).toMatchObject({ status: 409, body: { error: 'out-of-step', step: 1 } });
  });

  it('keeps a member\'s orders until everyone has played, and shows only that they are ready', async () => {
    const { server, room } = await begun();
    const step = await answerHand(server, HOST, room);
    const orders = [{ type: 'buy', assetId: 'sp500', amount: 100_000 }];
    const reply = await server.ask(HOST, { action: 'submit', roomId: room, step, orders });
    expect(reply.status).toBe(200);
    expect(reply.body.result).toBeNull();
    expect(roomOf(reply)).toMatchObject({ round: 0, members: [{ userId: HOST, ready: true }, { userId: B, ready: false }] });
    // Nothing played yet: the host's life still waits at its finances.
    expect((await lifeOf(server, HOST, room)).view).toMatchObject({ round: 0, phase: 'finance' });
    // What B sees says the host is ready, and nothing of what they chose.
    const seen = await server.ask(B, { action: 'state', roomId: room });
    expect(roomOf(seen).members[0]).toMatchObject({ ready: true, standing: null });
    expect(JSON.stringify(seen.body)).not.toContain('sp500');
    // The same orders again change nothing; others are refused, as is a card.
    expect((await server.ask(HOST, { action: 'submit', roomId: room, step, orders })).status).toBe(200);
    expect(await server.ask(HOST, { action: 'submit', roomId: room, step, orders: [] })).toMatchObject({ status: 409, body: { error: 'ready' } });
  });

  it('turns the round in the call of the last to play, and answers that member their round', async () => {
    const { server, room } = await begun();
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    const step = await answerHand(server, B, room);
    const reply = await server.ask(B, { action: 'submit', roomId: room, step, orders: [{ type: 'buy', assetId: 'sp500', amount: 100_000 }] });
    expect(reply.status).toBe(200);
    const result = reply.body.result as { step: number; view: GameState; world: unknown; events: Array<{ kind: string }> };
    expect(result.step).toBe(step + 1);
    expect(result.view.round).toBe(1);
    expect(result.world).not.toBeNull();
    expect(result.events.length).toBeGreaterThan(0);
    // Each member's round was played with the orders they kept for it, and no others.
    expect(server.logOf(B, room)[0].orders).toEqual([{ type: 'buy', assetId: 'sp500', amount: 100_000 }]);
    expect(server.logOf(HOST, room)[0].orders).toEqual([]);
    const after = roomOf(reply);
    expect(after.round).toBe(1);
    expect(after.deadline).toBe(new Date(server.state.now + 180_000).toISOString());
    expect(after.members.every((m) => !m.ready && m.standing !== null)).toBe(true);
    // The host, who waited, finds their round played, with what it did.
    const host = await lifeOf(server, HOST, room);
    expect(host.view.round).toBe(1);
    expect(host.events.length).toBeGreaterThan(0);
  });

  it('plays the round for whoever has not chosen once the deadline and its grace have passed: first options and no orders', async () => {
    const { server, room } = await begun();
    const life = await lifeOf(server, HOST, room);
    await server.ask(HOST, { action: 'card', roomId: room, step: life.step, option: 1 });
    await server.ask(B, { action: 'submit', roomId: room, step: await answerHand(server, B, room), orders: [] });
    server.wait(180_000 + GRACE_MS - 1);
    expect(roomOf(await server.ask(B, { action: 'state', roomId: room })).round).toBe(0);
    server.wait(1);
    expect(roomOf(await server.ask(B, { action: 'state', roomId: room })).round).toBe(1);
    const [entry] = server.logOf(HOST, room);
    expect(entry.picks[0]).toBe(1);
    expect(entry.picks.slice(1).every((pick) => pick === 0)).toBe(true);
    expect(entry.orders).toEqual([]);
    // The host's own life says the same as the life the engine plays from that log.
    const seed = [...server.db.seeds.values()][0];
    expect((await lifeOf(server, HOST, room)).view).toEqual(viewOf(replayLife(content, nurse.start, seed, server.logOf(HOST, room)).state));
  });

  it('turns a round nobody touched, with every card of every member taking its first option, and gives the next the room\'s seconds', async () => {
    const { server, room } = await begun(roomServer(), 90);
    server.wait(90_000 + GRACE_MS);
    const turned = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(turned.round).toBe(1);
    expect(turned.deadline).toBe(new Date(server.state.now + 90_000).toISOString());
    for (const who of [HOST, B]) {
      const [entry] = server.logOf(who, room);
      expect(entry.orders).toEqual([]);
      expect(entry.picks.every((pick) => pick === 0)).toBe(true);
    }
  });

  it('refuses a card or orders that arrive after the round is due, turning it first', async () => {
    const { server, room } = await begun();
    const step = (await lifeOf(server, HOST, room)).step;
    server.wait(180_000 + GRACE_MS);
    expect(await server.ask(HOST, { action: 'card', roomId: room, step, option: 0 })).toMatchObject({ status: 409, body: { error: 'moved' } });
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(1);
    const late = await answerHand(server, B, room);
    server.wait(180_000 + GRACE_MS);
    expect(await server.ask(B, { action: 'submit', roomId: room, step: late, orders: [] })).toMatchObject({ status: 409, body: { error: 'moved' } });
    expect(roomOf(await server.ask(B, { action: 'state', roomId: room })).round).toBe(2);
  });

  it('refuses orders that are not orders, more of them than a round takes, and orders that cannot be played', async () => {
    const { server, room } = await begun();
    const step = await answerHand(server, HOST, room);
    expect(await server.ask(HOST, { action: 'submit', roomId: room, step, orders: 'all' })).toMatchObject({ status: 400, body: { field: 'orders' } });
    const many = Array.from({ length: content.maxOrdersPerRound + 1 }, () => ({ type: 'buy', assetId: 'sp500', amount: 100 }));
    expect(await server.ask(HOST, { action: 'submit', roomId: room, step, orders: many })).toMatchObject({ status: 400, body: { field: 'orders' } });
    expect(await server.ask(HOST, { action: 'submit', roomId: room, step: step + 3, orders: [] })).toMatchObject({ status: 409, body: { error: 'out-of-step' } });
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).members[0].ready).toBe(false);
  });

  it('turns once when another call turns it first: this one finds the room on, and writes nothing', async () => {
    const { server, room } = await begun();
    server.wait(180_000 + GRACE_MS);
    let raced = false;
    server.hooks.beforeTurn = (id, round) => {
      if (raced) return;
      raced = true;
      // As if another page's look had turned it a moment before this one could write.
      Object.assign(server.db.rooms.get(id) as object, { round: round + 1, deadline: new Date(server.state.now + 180_000).toISOString() });
    };
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(1);
    expect(server.logOf(HOST, room)).toEqual([]);
    expect(server.logOf(B, room)).toEqual([]);
  });

  it('reads every life again when a card lands while the round is being written, and keeps the card', async () => {
    const { server, room } = await begun();
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    let sneaked = false;
    server.hooks.beforeTurn = () => {
      if (sneaked) return;
      sneaked = true;
      const game = [...server.db.games.values()].find((g) => g.user_id === B) as { log: LoggedRound[]; updated_at: string };
      game.log = [{ picks: [1], orders: null }];
      game.updated_at = '2026-10-16T11:00:00.000000+00:00';
    };
    server.wait(180_000 + GRACE_MS);
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(1);
    const [entry] = server.logOf(B, room);
    expect(entry.picks[0]).toBe(1);
    expect(entry.orders).toEqual([]);
  });
});

describe('two members who choose the same', () => {
  it('live the same life to the end, the life the engine plays from the same log, and the room ends with a run for each', async () => {
    const { server, room } = await begun();
    for (let round = 0; round < content.rounds; round++) {
      for (const who of [HOST, B]) {
        const step = await answerHand(server, who, room, 1);
        const reply = await server.ask(who, { action: 'submit', roomId: room, step, orders: [] });
        expect(reply.status).toBe(200);
      }
    }
    const end = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(end).toMatchObject({ status: 'finished', deadline: null, round: content.rounds });
    expect(server.logOf(HOST, room)).toEqual(server.logOf(B, room));
    const seed = [...server.db.seeds.values()][0];
    const played = replayLife(content, nurse.start, seed, server.logOf(HOST, room)).state;
    const score = finalScore(content, played);
    expect(end.members.map((m) => m.standing?.score)).toEqual([score, score]);
    expect(server.db.runs.map((run) => [run.user_id, run.mode, run.score, run.verified])).toEqual([
      [HOST, 'room', score, true],
      [B, 'room', score, true],
    ]);
    // Looking again writes nothing more, and each member is told their run.
    await server.ask(B, { action: 'state', roomId: room });
    expect(server.db.runs).toHaveLength(2);
    expect((await lifeOf(server, B, room)).run).toMatchObject({ mode: 'room', score });
    // Once they have left it, the room is behind them: their life in it is in their records, not here.
    await server.ask(B, { action: 'leave', roomId: room });
    expect(await server.ask(B, { action: 'view', roomId: room })).toMatchObject({ status: 409, body: { error: 'closed' } });
  });
});

describe('leaving a room, and coming back', () => {
  it('takes a member out of the lobby, and the host leaving closes it for everyone', async () => {
    const server = roomServer();
    const room = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    await server.ask(B, { action: 'join', code: room.code, ...VERSIONS });
    await server.ask(C, { action: 'join', code: room.code, ...VERSIONS });
    expect((await server.ask(C, { action: 'leave', roomId: room.id })).status).toBe(200);
    expect(roomOf(await server.ask(B, { action: 'state', roomId: room.id })).members.filter((m) => !m.left).map((m) => m.userId)).toEqual([HOST, B]);
    expect(await server.ask(C, { action: 'mine' })).toEqual({ status: 200, body: { room: null } });
    await server.ask(HOST, { action: 'leave', roomId: room.id });
    expect(roomOf(await server.ask(B, { action: 'state', roomId: room.id })).status).toBe('closed');
    expect(await server.ask(B, { action: 'mine' })).toEqual({ status: 200, body: { room: null } });
  });

  it('gives up a member\'s life in play, stops waiting for them, and turns the round if everyone left is ready', async () => {
    const { server, room } = await begun(roomServer(), 180, [C]);
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    await server.ask(B, { action: 'submit', roomId: room, step: await answerHand(server, B, room), orders: [] });
    const left = await server.ask(C, { action: 'leave', roomId: room });
    expect(left.status).toBe(200);
    // Turned in the leaver's own call: nobody had to look again.
    expect(server.db.rooms.get(room)?.round).toBe(1);
    const after = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(after.round).toBe(1);
    expect(after.members.find((m) => m.userId === C)).toMatchObject({ left: true, standing: null });
    expect([...server.db.games.values()].find((g) => g.user_id === C)?.status).toBe('abandoned');
    expect(await server.ask(C, { action: 'view', roomId: room })).toMatchObject({ status: 409, body: { error: 'closed' } });
  });

  it('finds a member\'s room again, wherever they open the page, and its life as it stands', async () => {
    const { server, room } = await begun();
    expect(roomOf(await server.ask(B, { action: 'mine' })).id).toBe(room);
    server.wait(3 * (180_000 + GRACE_MS));
    // Away for three deadlines: the first look turns one round; the clock starts again from it.
    expect(roomOf(await server.ask(B, { action: 'mine' })).round).toBe(1);
    expect((await lifeOf(server, B, room)).view.round).toBe(1);
    expect(await server.ask(C, { action: 'mine' })).toEqual({ status: 200, body: { room: null } });
    expect(await server.ask(C, { action: 'state', roomId: room })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
    expect(await server.ask(C, { action: 'view', roomId: room })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
  });

  it('closes a room nobody has moved for a day, giving up its lives', async () => {
    const lobby = roomServer();
    const open = roomOf(await lobby.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    lobby.wait(86_400_000 + 1);
    expect(roomOf(await lobby.ask(HOST, { action: 'state', roomId: open.id })).status).toBe('closed');
    const { server } = await begun();
    server.wait(180_000 + 86_400_000 + 1);
    expect(roomOf(await server.ask(HOST, { action: 'mine' }) ).status).toBe('closed');
    expect([...server.db.games.values()].every((g) => g.status === 'abandoned')).toBe(true);
    expect(await server.ask(HOST, { action: 'mine' })).toEqual({ status: 200, body: { room: null } });
  });

  it('closes a room in play when the last member leaves it, and its members may open another', async () => {
    const { server, room } = await begun();
    for (const who of [HOST, B]) await server.ask(who, { action: 'leave', roomId: room });
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).status).toBe('closed');
    expect((await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 300, ...VERSIONS })).status).toBe(200);
  });
});

describe('what is not a request', () => {
  it('names the field that is wrong', async () => {
    const server = roomServer();
    expect(await server.ask(HOST, 'hello' as unknown as Body)).toMatchObject({ status: 400, body: { field: 'body' } });
    expect(await server.ask(HOST, { action: 'dance' })).toMatchObject({ status: 400, body: { field: 'action' } });
    expect(await server.ask(HOST, { action: 'state', roomId: 'nope' })).toMatchObject({ status: 400, body: { field: 'roomId' } });
    expect(await server.ask(HOST, { action: 'card', roomId: '00000000-0000-4000-8000-000000000001', step: -1 })).toMatchObject({ status: 400, body: { field: 'step' } });
  });
});
