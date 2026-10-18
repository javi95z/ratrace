import { content, lives, replayLife, roomStart } from '@ratrace/content';
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
    expect(room.members).toEqual([{ userId: HOST, name: null, avatar: null, me: true, host: true, ready: false, left: false, standing: null, shout: null }]);
    expect(reply.body.room).toMatchObject({ rematch: null, rematchOf: false });
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
  it('shows everyone the rat each player chose', async () => {
    const server = roomServer();
    server.db.avatars.set(HOST, 'rat_wine');
    const opened = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 180, ...VERSIONS }));
    await server.ask(B, { action: 'join', code: opened.code, ...VERSIONS });
    const seen = roomOf(await server.ask(B, { action: 'state', roomId: opened.id })).members as unknown as Array<{ userId: string; avatar: string | null }>;
    expect(seen.map((m) => [m.userId, m.avatar])).toEqual([[HOST, 'rat_wine'], [B, null]]);
  });

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

  it('lets a member tease another: the teaser gains status that round, and the one teased loses some the next, both written into the logs', async () => {
    const { server, room } = await begun(roomServer(), 180, [C]);
    const tease = { type: 'focus', action: 'tease', target: B };
    // Every life of a room is marked as one, so it may tease.
    expect((await lifeOf(server, HOST, room)).view.player.life.flags).toHaveProperty('in_room');
    expect((await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [tease] })).status).toBe(200);
    await server.ask(C, { action: 'submit', roomId: room, step: await answerHand(server, C, room), orders: [] });
    await server.ask(B, { action: 'submit', roomId: room, step: await answerHand(server, B, room), orders: [] });
    expect(server.logOf(B, room)[0].room).toEqual([{ kind: 'teased', by: HOST }]);
    expect(server.logOf(HOST, room)[0].room).toBeUndefined();
    expect(server.logOf(C, room)[0].room).toBeUndefined();
    const b = await lifeOf(server, B, room);
    const c = await lifeOf(server, C, room);
    expect(b.events).toContainEqual({ kind: 'teased', by: HOST, status: -content.life.teasedStatus });
    // B and C chose alike: B starts the round with less status, by the tease.
    expect(c.view.player.statusPoints - b.view.player.statusPoints).toBe(content.life.teasedStatus);
    const host = await lifeOf(server, HOST, room);
    expect(host.view.player.statusSum - c.view.player.statusSum).toBe(content.life.teaseStatus);
    // And what the server shows is the life its log plays back to.
    const seed = [...server.db.seeds.values()][0];
    expect(b.view).toEqual(viewOf(replayLife(content, roomStart(nurse.start), seed, server.logOf(B, room)).state));
  });

  it('refuses a tease at nobody, at oneself, or at someone not in the room', async () => {
    const { server, room } = await begun();
    const step = await answerHand(server, HOST, room);
    for (const target of [undefined, HOST, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']) {
      const reply = await server.ask(HOST, { action: 'submit', roomId: room, step, orders: [{ type: 'focus', action: 'tease', ...(target ? { target } : {}) }] });
      expect(reply.status, String(target)).toBe(400);
    }
  });

  /** Plays the round of every member named, with no orders: the last one turns it. */
  async function playRound(server: ReturnType<typeof roomServer>, room: string, who: string[]) {
    for (const member of who) expect((await server.ask(member, { action: 'submit', roomId: room, step: await answerHand(server, member, room), orders: [] })).status).toBe(200);
  }
  type Loan = { id: string; lend: boolean; other: string; mine: boolean; amount: number; rateBp: number; rounds: number; status: string };
  const loansOf = async (server: ReturnType<typeof roomServer>, who: string, room: string) => ((await server.ask(who, { action: 'state', roomId: room })).body.room as { loans: Loan[] }).loans;
  const offer = { action: 'loan', lend: true, amount: 100_000, rateBp: 800, rounds: 2 };

  it('pays a loan out as the round turns, once the other has said yes: one lends, the other owes, both told', async () => {
    const { server, room } = await begun();
    server.db.names.set(HOST, 'Ana');
    expect((await server.ask(HOST, { ...offer, roomId: room, to: B })).status).toBe(200);
    expect(server.notices.at(-1)).toEqual({ user: B, about: { kind: 'loanOffer', who: 'Ana', lend: true, amount: 100_000, rateBp: 800, rounds: 2 } });
    const [seen] = await loansOf(server, B, room);
    expect(seen).toMatchObject({ lend: false, other: HOST, mine: false, amount: 100_000, rateBp: 800, rounds: 2, status: 'open' });
    // Nobody else hears of it.
    expect(await loansOf(server, HOST, room)).toHaveLength(1);
    expect((await server.ask(B, { action: 'loanAnswer', roomId: room, loanId: seen.id, yes: true })).status).toBe(200);
    const hostBefore = (await lifeOf(server, HOST, room)).view.player.cash;
    await playRound(server, room, [HOST, B]);
    expect(server.logOf(HOST, room)[0].room).toEqual([{ kind: 'lent', id: seen.id, to: B, amount: 100_000, rateBp: 800, rounds: 2 }]);
    expect(server.logOf(B, room)[0].room).toEqual([{ kind: 'borrowed', id: seen.id, from: HOST, amount: 100_000, rateBp: 800, rounds: 2 }]);
    const host = await lifeOf(server, HOST, room);
    const b = await lifeOf(server, B, room);
    expect(host.view.player.lent).toEqual([{ id: seen.id, peer: B, principal: 100_000, fixedRateBp: 800, roundsLeft: 2 }]);
    expect(b.view.player.debts).toContainEqual({ id: seen.id, kind: 'personalLoan', principal: 100_000, fixedRateBp: 800, roundsLeft: 2, peer: HOST });
    expect(host.events).toContainEqual({ kind: 'lent', to: B, amount: 100_000, rateBp: 800, rounds: 2 });
    expect(hostBefore).toBeGreaterThan(0);
    expect((await loansOf(server, B, room))[0]).toMatchObject({ status: 'paid' });
    // And what each sees is the life its log plays back to.
    const seed = [...server.db.seeds.values()][0];
    expect(b.view).toEqual(viewOf(replayLife(content, roomStart(nurse.start), seed, server.logOf(B, room)).state));
  });

  it('pays out nothing refused, left unanswered, or more than the lender has once the round is played', async () => {
    const { server, room } = await begun(roomServer(), 180, [C]);
    await server.ask(HOST, { ...offer, roomId: room, to: B });
    await server.ask(HOST, { ...offer, roomId: room, to: C, lend: false });
    await server.ask(B, { ...offer, roomId: room, to: C, amount: 1_000_000_000 });
    const [toB] = await loansOf(server, B, room);
    const fromB = (await loansOf(server, B, room)).find((loan) => loan.mine) as Loan;
    expect((await server.ask(B, { action: 'loanAnswer', roomId: room, loanId: toB.id, yes: false })).status).toBe(200);
    expect((await server.ask(C, { action: 'loanAnswer', roomId: room, loanId: fromB.id, yes: true })).status).toBe(200);
    // Answered once: there is nothing left to answer.
    expect((await server.ask(B, { action: 'loanAnswer', roomId: room, loanId: toB.id, yes: true })).status).toBe(409);
    expect((await loansOf(server, HOST, room)).find((loan) => loan.other === B)).toMatchObject({ status: 'refused' });
    await playRound(server, room, [HOST, B, C]);
    for (const who of [HOST, B, C]) expect(server.logOf(who, room)[0].room, who).toBeUndefined();
    expect(server.db.loans.map((loan) => loan.status)).toEqual(['refused', 'expired', 'failed']);
  });

  it('takes an offer to the same player again in place of the last, and refuses what is not one', async () => {
    const { server, room } = await begun();
    await server.ask(HOST, { ...offer, roomId: room, to: B });
    await server.ask(HOST, { ...offer, roomId: room, to: B, amount: 200_000 });
    expect(server.db.loans.map((loan) => [loan.amount, loan.status])).toEqual([[100_000, 'withdrawn'], [200_000, 'open']]);
    for (const wrong of [{ to: HOST }, { to: C }, { amount: 50 }, { amount: 1.5 }, { rateBp: 850 }, { rateBp: 2_100 }, { rounds: 0 }, { rounds: 6 }, { lend: 'yes' }]) {
      expect((await server.ask(HOST, { ...offer, roomId: room, to: B, ...wrong })).status, JSON.stringify(wrong)).toBe(400);
    }
    // Its maker may take it back.
    const [mine] = await loansOf(server, HOST, room);
    expect((await server.ask(HOST, { action: 'loanAnswer', roomId: room, loanId: mine.id, yes: false })).status).toBe(200);
    expect(server.db.loans.at(-1)?.status).toBe('withdrawn');
  });

  it('loses what is still lent to someone who leaves the game', async () => {
    const { server, room } = await begun(roomServer(), 180, [C]);
    await server.ask(HOST, { ...offer, roomId: room, to: B, rounds: 3 });
    const [seen] = await loansOf(server, B, room);
    await server.ask(B, { action: 'loanAnswer', roomId: room, loanId: seen.id, yes: true });
    await playRound(server, room, [HOST, B, C]);
    expect((await server.ask(B, { action: 'leave', roomId: room })).status).toBe(200);
    await playRound(server, room, [HOST, C]);
    // The round it was paid out in keeps it; the next one, where it was lost, says so.
    expect(server.logOf(HOST, room)[0].room).toEqual([{ kind: 'lent', id: seen.id, to: B, amount: 100_000, rateBp: 800, rounds: 3 }]);
    expect(server.logOf(HOST, room)[1].room).toEqual([{ kind: 'defaulted', id: seen.id }]);
    const host = await lifeOf(server, HOST, room);
    expect(host.view.player.lent).toBeUndefined();
    expect(host.events).toContainEqual(expect.objectContaining({ kind: 'defaulted', by: B }));
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
    expect((await lifeOf(server, HOST, room)).view).toEqual(viewOf(replayLife(content, roomStart(nurse.start), seed, server.logOf(HOST, room)).state));
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

describe('a turn that cannot be written as it was worked out', () => {
  it('plays orders kept while the round was being turned: the turn is read again with them', async () => {
    const { server, room } = await begun();
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    const step = await answerHand(server, B, room);
    let landed = false;
    server.hooks.beforeTurn = () => {
      if (landed) return;
      landed = true;
      // B's orders arrive after this turn read the orders kept, and before it is written.
      void server.deps.submit(room, 0, B, [{ type: 'buy', assetId: 'sp500', amount: 100_000 }]);
    };
    server.wait(180_000 + GRACE_MS);
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(1);
    expect(server.logOf(B, room)[0].orders).toEqual([{ type: 'buy', assetId: 'sp500', amount: 100_000 }]);
    expect(step).toBeGreaterThan(0);
  });

  it('refuses orders that weigh more than any round needs', async () => {
    const { server, room } = await begun();
    const step = await answerHand(server, HOST, room);
    const heavy = Array.from({ length: 50 }, () => ({ type: 'buy', assetId: 'sp500', amount: 100, note: 'x'.repeat(400) }));
    expect(await server.ask(HOST, { action: 'submit', roomId: room, step, orders: heavy })).toMatchObject({ status: 400, body: { field: 'orders' } });
  });

  it('plays a member with no orders once their log could hold no more, and the room goes on', async () => {
    const { server, room } = await begun();
    // As heavy as a round's orders may be, every round: the log would outgrow its game after a few.
    const heavy = Array.from({ length: 50 }, () => ({ type: 'buy', assetId: 'sp500', amount: 1, note: 'x'.repeat(250) }));
    expect(JSON.stringify(heavy).length).toBeLessThan(16_000);
    for (let round = 0; round < 10; round++) {
      expect((await server.ask(B, { action: 'submit', roomId: room, step: await answerHand(server, B, room), orders: [] })).status).toBe(200);
      expect((await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: heavy })).status).toBe(200);
      expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(round + 1);
    }
    const log = server.logOf(HOST, room);
    expect(JSON.stringify(log).length).toBeLessThanOrEqual(120_000);
    expect(log[0].orders).toHaveLength(50);
    expect(log[9].orders).toEqual([]);
  });

  it('plays the round with no orders at all when the database says the turn cannot be held, rather than not at all', async () => {
    const { server, room } = await begun();
    server.hooks.invalidTurns = 1;
    await server.ask(B, { action: 'submit', roomId: room, step: await answerHand(server, B, room), orders: [{ type: 'buy', assetId: 'sp500', amount: 100 }] });
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).round).toBe(1);
    expect(server.logOf(B, room)[0].orders).toEqual([]);
  });

  it('lets a member look at the room and leave it even when its round cannot be turned', async () => {
    const { server, room } = await begun();
    server.wait(180_000 + GRACE_MS);
    server.hooks.brokenTurns = 10;
    expect((await server.ask(B, { action: 'state', roomId: room })).status).toBe(200);
    expect((await server.ask(B, { action: 'mine' })).status).toBe(200);
    expect((await server.ask(B, { action: 'leave', roomId: room })).status).toBe(200);
    expect(await server.ask(B, { action: 'mine' })).toEqual({ status: 200, body: { room: null } });
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
    const played = replayLife(content, roomStart(nurse.start), seed, server.logOf(HOST, room)).state;
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

/** A room of HOST and B (and C if asked) played to its end by the clock alone. */
async function over(also: string[] = []) {
  const { server, room, code } = await begun(roomServer(), 90, also);
  for (let guard = 0; guard < 50; guard++) {
    if (roomOf(await server.ask(HOST, { action: 'state', roomId: room })).status === 'finished') return { server, room, code };
    server.wait(90_000 + GRACE_MS + 1);
  }
  throw new Error('the room did not end');
}

describe('a rematch', () => {
  it('opens a room on the same pace from one that is over, says so in the old one, and joins the others with one press', async () => {
    const { server, room } = await over([C]);
    server.notices.length = 0;
    const asked = await server.ask(B, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS });
    expect(asked.status).toBe(200);
    const next = roomOf(asked);
    expect(next).toMatchObject({ status: 'open', seconds: 90, host: B, lifeId: 'nurse' });
    expect(asked.body.room).toMatchObject({ rematchOf: true });
    expect(server.notices).toEqual([HOST, C].map((user) => ({ user, about: { kind: 'rematch' } })));
    // The room that is over points to it while it waits.
    expect((await server.ask(HOST, { action: 'state', roomId: room })).body.room).toMatchObject({ rematch: { code: next.code, open: true } });
    // A second press, whoever makes it, joins it: one rematch a room.
    const second = await server.ask(HOST, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS });
    expect(roomOf(second).id).toBe(next.id);
    expect(roomOf(second).members.map((m) => m.userId)).toEqual([B, HOST]);
    expect(server.db.rooms.size).toBe(2);
  });

  it('is only for a room that is over, and only for whoever was in it', async () => {
    const { server, room } = await begun(roomServer(), 90);
    expect(await server.ask(HOST, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'not-over' } });
    const done = await over();
    expect(await done.server.ask(C, { action: 'rematch', roomId: done.room, lifeId: 'nurse', ...VERSIONS })).toMatchObject({ status: 404 });
    expect(await done.server.ask(HOST, { action: 'rematch', roomId: done.room, lifeId: locked.id, ...VERSIONS })).toMatchObject({ status: 403, body: { error: 'locked-life' } });
  });

  it('cannot be joined once it has started', async () => {
    const { server, room } = await over([C]);
    const next = roomOf(await server.ask(HOST, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS }));
    await server.ask(B, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS });
    expect((await server.ask(HOST, { action: 'start', roomId: next.id })).status).toBe(200);
    expect((await server.ask(C, { action: 'state', roomId: room })).body.room).toMatchObject({ rematch: { open: false } });
    expect(await server.ask(C, { action: 'rematch', roomId: room, lifeId: 'nurse', ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'started' } });
  });
});

describe('the standings of a round', () => {
  it('keep how each member stood the round before: their score and their place', async () => {
    const { server, room } = await begun(roomServer(), 90);
    server.wait(90_000 + GRACE_MS + 1);
    const first = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(first.members.map((m) => (m.standing as { before: unknown }).before)).toEqual([null, null]);
    server.wait(90_000 + GRACE_MS + 1);
    const second = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    const order = [...first.members].sort((a, b) => (b.standing?.score as number) - (a.standing?.score as number)).map((m) => m.userId);
    for (const member of second.members) {
      const was = first.members.find((m) => m.userId === member.userId);
      expect((member.standing as { before: unknown }).before).toEqual({ score: was?.standing?.score, place: order.indexOf(member.userId) + 1 });
    }
  });
});

describe('shouts', () => {
  it('reach everyone in the game, one every ten seconds at most, from the list alone', async () => {
    const opened = await begun(roomServer(), 90);
    const { server, room } = opened;
    expect((await server.ask(B, { action: 'shout', roomId: room, shout: 7 })).status).toBe(200);
    const seen = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(seen.members.map((m) => (m as unknown as { shout: { n: number } | null }).shout?.n ?? null)).toEqual([null, 7]);
    // Told to the others' devices once, and not for one the server turned away.
    expect(server.notices.filter((n) => n.about.kind === 'shout')).toEqual([{ user: HOST, about: { kind: 'shout', who: null, n: 7 } }]);
    expect(await server.ask(B, { action: 'shout', roomId: room, shout: 1 })).toMatchObject({ status: 409, body: { error: 'soon' } });
    expect(server.notices.filter((n) => n.about.kind === 'shout')).toHaveLength(1);
    server.wait(10_001);
    expect((await server.ask(B, { action: 'shout', roomId: room, shout: 1 })).status).toBe(200);
    for (const shout of [14, -1, 2.5, 'hola', null]) expect((await server.ask(B, { action: 'shout', roomId: room, shout })).status, String(shout)).toBe(400);
    // A minute on, it is no longer news.
    server.wait(61_000);
    const later = roomOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(later.members.every((m) => (m as unknown as { shout: unknown }).shout === null)).toBe(true);
  });

  it('can be sent while waiting for the game to start', async () => {
    const server = roomServer();
    const opened = roomOf(await server.ask(HOST, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS }));
    expect((await server.ask(HOST, { action: 'shout', roomId: opened.id, shout: 0 })).status).toBe(200);
  });
});

describe('a player\'s history', () => {
  it('lists the games over they were in, the latest first, with everyone in their final order', async () => {
    const { server, room } = await over([C]);
    const reply = await server.ask(B, { action: 'history' });
    expect(reply.status).toBe(200);
    const games = reply.body.games as Array<{ id: string; lifeId: string; seconds: number; rematchOf: boolean; players: Array<{ me: boolean; score: number | null; left: boolean; tag: string }> }>;
    expect(games.map((g) => [g.id, g.lifeId, g.seconds, g.rematchOf])).toEqual([[room, 'nurse', 90, false]]);
    expect(games[0].players).toHaveLength(3);
    expect(games[0].players.filter((p) => p.me)).toHaveLength(1);
    const scores = games[0].players.map((p) => p.score as number);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    // Where each ended up, doing what, with what; and leaving a game once it is over is not having left it.
    for (const who of [HOST, B]) await server.ask(who, { action: 'leave', roomId: room });
    const after = ((await server.ask(B, { action: 'history' })).body.games as Array<{ players: Array<{ left: boolean; cityId: string | null; career: unknown; netWorth: number | null }> }>)[0];
    expect(after.players.every((p) => !p.left)).toBe(true);
    expect(after.players.every((p) => p.cityId === 'madrid' && p.career !== null && typeof p.netWorth === 'number')).toBe(true);
    // Nothing of a game in play, and nothing of anyone else's.
    await begun(server, 90);
    expect(((await server.ask(HOST, { action: 'history' })).body.games as unknown[]).length).toBe(1);
    expect((await server.ask('dddddddd-dddd-4ddd-8ddd-dddddddddddd', { action: 'history' })).body).toEqual({ games: [] });
  });
});

describe('the notices of a room', () => {
  it('tells everyone but the host that the room has started, with the time a round takes', async () => {
    const { server } = await begun(roomServer(), 90, [C]);
    expect(server.notices).toEqual([
      { user: B, about: { kind: 'roomStarted', seconds: 90 } },
      { user: C, about: { kind: 'roomStarted', seconds: 90 } },
    ]);
  });

  it('tells the one member still to play, once, when everyone else has played, with the time left', async () => {
    const { server, room } = await begun(roomServer(), 180, [C]);
    server.notices.length = 0;
    server.wait(30_000);
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    expect(server.notices).toEqual([]);
    const step = await answerHand(server, B, room);
    await server.ask(B, { action: 'submit', roomId: room, step, orders: [] });
    // The same orders sent again, as a page does when its answer was lost, tell nobody again.
    await server.ask(B, { action: 'submit', roomId: room, step, orders: [] });
    expect(server.notices).toEqual([{ user: C, about: { kind: 'yourTurn', round: 1, rounds: content.rounds, secondsLeft: 150 } }]);
  });

  it('tells everyone but whoever turned it that a new round of a game of a round a day has begun', async () => {
    const { server, room } = await begun(roomServer(), 86_400, [C]);
    server.notices.length = 0;
    for (const who of [HOST, B]) await server.ask(who, { action: 'submit', roomId: room, step: await answerHand(server, who, room), orders: [] });
    expect(server.notices).toEqual([{ user: C, about: { kind: 'yourTurn', round: 1, rounds: content.rounds, secondsLeft: 86_400 } }]);
    server.notices.length = 0;
    await server.ask(C, { action: 'submit', roomId: room, step: await answerHand(server, C, room), orders: [] });
    expect(server.notices).toEqual([HOST, B].map((user) => ({ user, about: { kind: 'newRound', round: 2, rounds: content.rounds, seconds: 86_400 } })));
  });

  it('tells nobody of a new round in a quick game: everyone is looking', async () => {
    const { server, room } = await begun(roomServer(), 90);
    server.notices.length = 0;
    for (const who of [HOST, B]) await server.ask(who, { action: 'submit', roomId: room, step: await answerHand(server, who, room), orders: [] });
    expect(server.notices.filter((notice) => notice.about.kind === 'newRound')).toEqual([]);
  });

  it('tells nobody when the round is about to turn anyway', async () => {
    const { server, room } = await begun(roomServer(), 90);
    server.notices.length = 0;
    server.wait(75_000);
    await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
    expect(server.notices).toEqual([]);
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

  it('opens games of half a day a round, and tells each new round of them', async () => {
    const { server, room } = await begun(roomServer(), 43_200);
    server.notices.length = 0;
    for (const who of [HOST, B]) await server.ask(who, { action: 'submit', roomId: room, step: await answerHand(server, who, room), orders: [] });
    expect(server.notices.filter((notice) => notice.about.kind === 'newRound')).toEqual([{ user: HOST, about: { kind: 'newRound', round: 2, rounds: content.rounds, seconds: 43_200 } }]);
  });

  it('keeps a game of a round a day through a quiet day, and closes it after three', async () => {
    const { server, room } = await begun(roomServer(), 86_400);
    server.wait(86_400_000 + 2 * 86_400_000 - 1_000);
    expect(roomOf(await server.ask(HOST, { action: 'state', roomId: room })).status).toBe('playing');
    const quiet = await begun(roomServer(), 86_400);
    quiet.server.wait(86_400_000 + 3 * 86_400_000 + 1_000);
    expect(roomOf(await quiet.server.ask(HOST, { action: 'state', roomId: quiet.room })).status).toBe('closed');
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
