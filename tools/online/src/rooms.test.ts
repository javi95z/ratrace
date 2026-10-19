import { content, lives, replayLife, ROOM_BOTS, roomStart } from '@ratrace/content';
import { finalScore, viewOf } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT, GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { GRACE_MS as GRACE_OF_SERVER, MAX_MEMBERS, PUBLIC_PACES, QUICK_SECONDS, QUICK_WAIT_MS, rooms, TABLE } from '../../../supabase/functions/_shared/rooms.ts';
import { RATS, roomServer } from '../../../apps/web/src/testing/roomServer.ts';

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
    expect(room.members).toEqual([{ userId: HOST, name: null, avatar: null, me: true, host: true, bot: null, followed: false, friend: false, ready: false, left: false, standing: null, shout: null }]);
    expect(reply.body.room).toMatchObject({ rematch: null, rematchOf: false, public: false, startsAt: null });
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

describe('a public game', () => {
  const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  type Seat = Omit<Room, 'members'> & { public: boolean; startsAt: string | null; members: Array<Room['members'][number] & { bot: string | null }> };
  const seatOf = (reply: { body: Body }) => reply.body.room as Seat;
  const quick = (server: ReturnType<typeof roomServer>, who: string) => server.ask(who, { action: 'quick', ...VERSIONS });
  const ratIds = new Set(RATS.map((rat) => rat.user));

  it('seats whoever asks in a new public lobby of theirs, for a life everyone may play, starting by itself a little later', async () => {
    const server = roomServer();
    const reply = await quick(server, HOST);
    expect(reply.status).toBe(200);
    const seat = seatOf(reply);
    expect(seat).toMatchObject({ status: 'open', public: true, seconds: QUICK_SECONDS, host: HOST, startsAt: new Date(server.state.now + QUICK_WAIT_MS).toISOString() });
    expect(lives.find((life) => life.id === seat.lifeId)?.unlock).toBe('default');
    expect(seat.members.map((m) => [m.userId, m.bot])).toEqual([[HOST, null]]);
    expect(server.state.asked).toEqual([`${HOST}:room-make`]);
  });

  it('seats the next ones in the same lobby, the oldest first, and never in a game among friends or one they left', async () => {
    const server = roomServer();
    const friends = roomOf(await server.ask(C, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS }));
    const first = seatOf(await quick(server, HOST));
    expect(first.id).not.toBe(friends.id);
    server.wait(1_000);
    expect(seatOf(await quick(server, B)).id).toBe(first.id);
    // One game at a time: asked again from inside one, the player is shown the way to it.
    expect(await quick(server, B)).toMatchObject({ status: 409, body: { error: 'in-a-room', roomId: first.id } });
    // Out of it, and asking again, they are given another.
    await server.ask(B, { action: 'leave', roomId: first.id });
    const again = seatOf(await quick(server, B));
    expect(again.id).not.toBe(first.id);
    expect(again.members.map((m) => m.userId)).toEqual([B]);
    // The first lobby went on without B, and the next player is seated there, the oldest.
    expect(seatOf(await quick(server, D)).id).toBe(first.id);
  });

  it('is offered only on the rules the server plays now, and only by rules that hold rats', async () => {
    const server = roomServer();
    expect(await server.ask(HOST, { action: 'quick', engineVersion: '0.1.0', contentVersion: '1.0.0' })).toMatchObject({ status: 409, body: { error: 'cannot-room' } });
    expect(await server.ask(HOST, { action: 'quick', engineVersion: ENGINE })).toMatchObject({ status: 400, body: { field: 'contentVersion' } });
    const ratless = { ...GAMES, [CURRENT]: { ...GAMES[CURRENT], bots: undefined } };
    expect(await rooms(ratless, server.deps, HOST, { action: 'quick', ...VERSIONS })).toMatchObject({ status: 409, body: { error: 'cannot-room' } });
    server.state.allowed = false;
    expect(await quick(server, HOST)).toEqual({ status: 429, body: { error: 'too-many' } });
  });

  it('starts by itself once its time has come, the first time anyone looks, with rats in the seats nobody came for', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    server.wait(QUICK_WAIT_MS - 1_000);
    expect(seatOf(await server.ask(B, { action: 'state', roomId: seat.id })).status).toBe('open');
    server.wait(1_000);
    const started = seatOf(await server.ask(B, { action: 'state', roomId: seat.id }));
    expect(started).toMatchObject({ status: 'playing', round: 0, startsAt: null, deadline: new Date(server.state.now + QUICK_SECONDS * 1000).toISOString() });
    // Four at the table: the two who came, and two rats of different kinds.
    expect(started.members).toHaveLength(TABLE);
    const rats = started.members.filter((m) => m.bot !== null);
    expect(rats).toHaveLength(2);
    expect(new Set(rats.map((m) => m.bot)).size).toBe(2);
    expect(rats.every((m) => ratIds.has(m.userId) && ROOM_BOTS.includes(m.bot as string))).toBe(true);
    // The rats have played their first round already: its cards answered, its orders kept. The two players have not.
    expect(started.members.map((m) => m.ready)).toEqual([false, false, true, true]);
    for (const rat of rats) {
      const log = server.logOf(rat.userId, seat.id);
      expect(log.length).toBe(1);
      expect(log[0].orders).toBeNull();
      expect(server.db.orders.has(`${seat.id}/${rat.userId}/0`)).toBe(true);
    }
    // The two players are told it has begun; the rats are told nothing.
    expect(server.notices.map((notice) => notice.user).every((user) => !ratIds.has(user))).toBe(true);
    expect(server.notices).toContainEqual({ user: HOST, about: { kind: 'roomStarted', seconds: QUICK_SECONDS } });
  });

  it('is anyone\'s in it to start at once, and alone a player is given three rats', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    // B did not open it, and starts it all the same.
    const started = seatOf(await server.ask(B, { action: 'start', roomId: seat.id }));
    expect(started.status).toBe('playing');
    expect(started.members.filter((m) => m.bot !== null)).toHaveLength(TABLE - 2);
    // Someone not in it cannot.
    const other = roomServer();
    const alone = seatOf(await quick(other, C));
    expect(await other.ask(D, { action: 'start', roomId: alone.id })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
    const solo = seatOf(await other.ask(C, { action: 'start', roomId: alone.id }));
    expect(solo.members.map((m) => m.bot === null)).toEqual([true, false, false, false]);
  });

  it('starts for those still in it, when the first to look once its time has come is someone who left', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    await server.ask(HOST, { action: 'leave', roomId: seat.id });
    server.wait(QUICK_WAIT_MS);
    // HOST left, and still looks: the game starts all the same, for B and the rats.
    const seen = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(seen.status).toBe('playing');
    expect(seen.members.filter((m) => !m.left).map((m) => m.bot === null)).toEqual([true, false, false, false]);
    expect(server.notices).toContainEqual({ user: B, about: { kind: 'roomStarted', seconds: QUICK_SECONDS } });
  });

  it('starts at once when every seat is taken, with no rat in it', async () => {
    const server = roomServer();
    const players = [HOST, B, C, D, ...['1', '2'].map((n) => `eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${n}`)];
    let seat: Seat | null = null;
    for (const who of players) seat = seatOf(await quick(server, who));
    expect(seat?.status).toBe('playing');
    expect(seat?.members.every((m) => m.bot === null)).toBe(true);
    expect(seat?.members).toHaveLength(MAX_MEMBERS);
  });

  it('plays a whole life against rats, each round turning the moment the player plays it, and keeps no rat\'s life', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    for (let round = 0; round < content.rounds; round++) {
      const reply = await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
      expect(reply.status).toBe(200);
      // The rats had played already: the player was the last, and is answered their round.
      expect(reply.body.result).not.toBeNull();
      expect(seatOf(reply).round).toBe(round + 1);
    }
    const end = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(end.status).toBe('finished');
    expect(end.members.every((m) => m.standing !== null)).toBe(true);
    // Only the player's life is kept among the runs; every life of the game was played to its end.
    expect(server.db.runs.map((run) => run.user_id)).toEqual([HOST]);
    expect([...server.db.games.values()].every((game) => game.status === 'finished')).toBe(true);
    // The rats played as their kinds: they did not live the life of one who does nothing.
    const rats = end.members.filter((m) => m.bot !== null);
    for (const rat of rats) expect(server.logOf(rat.userId, seat.id).some((round) => (round.orders ?? []).length > 0)).toBe(true);
    // Nobody but the player was ever told anything.
    expect(server.notices.every((notice) => notice.user === HOST)).toBe(true);
    // The history says who the rats were.
    const history = (await server.ask(HOST, { action: 'history' })).body.games as Array<{ public: boolean; players: Array<{ bot: string | null; me: boolean }> }>;
    expect(history[0].public).toBe(true);
    expect(history[0].players.filter((p) => p.bot !== null)).toHaveLength(TABLE - 1);
    expect(history[0].players.find((p) => p.me)?.bot).toBeNull();
  });

  it('lets a player tease a rat, and lends no money to one', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    const started = seatOf(await server.ask(HOST, { action: 'start', roomId: seat.id }));
    const rat = started.members.find((m) => m.bot !== null)?.userId as string;
    expect(await server.ask(HOST, { action: 'loan', roomId: seat.id, to: rat, lend: true, amount: 100_000, rateBp: 500, rounds: 2 })).toMatchObject({ status: 400, body: { field: 'to' } });
    const tease = { type: 'focus', action: 'tease', target: rat };
    expect((await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [tease] })).status).toBe(200);
    expect(server.logOf(rat, seat.id)[0].room).toEqual([{ kind: 'teased', by: HOST }]);
  });

  it('plays a rat that could not play on the next look, and turns the round if it was the last', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    const real = server.deps.loadSeed;
    // The rats' seeds cannot be read just as the game starts: they are left to play later.
    server.deps.loadSeed = async (id) => (ratIds.has(server.db.games.get(id)?.user_id ?? '') ? null : real(id));
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    server.deps.loadSeed = real;
    expect(server.db.members.filter((m) => m.room_id === seat.id && ratIds.has(m.user_id)).every((m) => m.ready_round === null)).toBe(true);
    // The player plays; the rats are behind, so the round waits for them...
    const played = await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
    // ...but not long: the call played them, and the round turned.
    expect(seatOf(played).round).toBe(1);
  });

  it('goes on without whoever opened it, closes when no player is left, and ends the rats\' lives when the last player leaves', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    await server.ask(HOST, { action: 'leave', roomId: seat.id });
    expect(seatOf(await server.ask(B, { action: 'state', roomId: seat.id })).status).toBe('open');
    await server.ask(B, { action: 'leave', roomId: seat.id });
    expect(server.db.rooms.get(seat.id)?.status).toBe('closed');

    const next = seatOf(await quick(server, C));
    await server.ask(C, { action: 'start', roomId: next.id });
    await server.ask(C, { action: 'leave', roomId: next.id });
    expect(server.db.rooms.get(next.id)?.status).toBe('closed');
    expect([...server.db.games.values()].filter((game) => game.room === next.id).every((game) => game.status === 'abandoned')).toBe(true);
  });

  it('leaves a game among friends exactly as it was: its host alone starts it, and no rat ever sits in it', async () => {
    const { server, room } = await begun();
    const state = seatOf(await server.ask(B, { action: 'state', roomId: room }));
    expect(state).toMatchObject({ public: false, startsAt: null });
    expect(state.members.every((m) => m.bot === null)).toBe(true);
    expect(state.members).toHaveLength(2);
  });
});

describe('public games: who is waiting, who is gone, and the people met', () => {
  const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  type Seat = Omit<Room, 'members'> & { public: boolean; members: Array<Room['members'][number] & { bot: string | null; followed: boolean }> };
  const seatOf = (reply: { body: Body }) => reply.body.room as Seat;
  const quick = (server: ReturnType<typeof roomServer>, who: string) => server.ask(who, { action: 'quick', ...VERSIONS });
  const lobbies = async (server: ReturnType<typeof roomServer>, who = D) => (await server.ask(who, { action: 'lobbies', ...VERSIONS })).body.open;

  it('counts the public lobbies a player could be seated in now: not one past its time, not a full one, none on other rules', async () => {
    const server = roomServer();
    expect(await lobbies(server)).toBe(0);
    await quick(server, HOST);
    expect(await lobbies(server)).toBe(1);
    // A game among friends is no lobby for strangers.
    await server.ask(C, { action: 'open', lifeId: 'nurse', seconds: 90, ...VERSIONS });
    expect(await lobbies(server)).toBe(1);
    // Past its time, nobody looked: whoever opened it has gone.
    server.wait(QUICK_WAIT_MS);
    expect(await lobbies(server)).toBe(0);
    expect((await server.ask(D, { action: 'lobbies', engineVersion: '0.1.0', contentVersion: '1.0.0' })).body).toEqual({ open: 0, slow: 0, dropped: false });
    expect(await server.ask(D, { action: 'lobbies', engineVersion: ENGINE })).toMatchObject({ status: 400, body: { field: 'contentVersion' } });
  });

  it('never seats a player in a lobby past its time: whoever opened it is not there to play', async () => {
    const server = roomServer();
    const ghost = seatOf(await quick(server, HOST));
    server.wait(QUICK_WAIT_MS + 1_000);
    const fresh = seatOf(await quick(server, B));
    expect(fresh.id).not.toBe(ghost.id);
    expect(fresh.members.map((m) => m.userId)).toEqual([B]);
    // The one who opened it comes back, and plays it with rats.
    expect(seatOf(await server.ask(HOST, { action: 'state', roomId: ghost.id })).status).toBe('playing');
  });

  it('takes out of a public game whoever let the clock play two rounds in a row, and the others no longer wait for them', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    // HOST plays each round; B has gone. The first round waits for its clock.
    for (let round = 0; round < 2; round++) {
      await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
      server.wait(QUICK_SECONDS * 1000 + GRACE_MS + 1);
      await server.ask(HOST, { action: 'state', roomId: seat.id });
    }
    const after = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(after.round).toBe(2);
    expect(after.members.find((m) => m.userId === B)?.left).toBe(true);
    expect([...server.db.games.values()].find((g) => g.user_id === B)?.status).toBe('abandoned');
    // From now on the round turns the moment HOST plays it.
    const played = await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
    expect(seatOf(played).round).toBe(3);
    // One round missed and then played is no reason to go: only two in a row.
    expect(after.members.find((m) => m.userId === HOST)?.left).toBe(false);
  });

  it('tells a player taken out of their last game why, for a day and until they take a seat again; not one who left', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    await server.ask(B, { action: 'start', roomId: seat.id });
    const dropped = async (who: string) => (await server.ask(who, { action: 'lobbies', ...VERSIONS })).body.dropped;
    for (let round = 0; round < 2; round++) {
      await server.ask(B, { action: 'submit', roomId: seat.id, step: await answerHand(server, B, seat.id), orders: [] });
      server.wait(QUICK_SECONDS * 1000 + GRACE_MS + 1);
      await server.ask(B, { action: 'state', roomId: seat.id });
    }
    expect(await dropped(HOST)).toBe(true);
    expect(await dropped(B)).toBe(false);
    // B leaves of their own accord: nothing to explain.
    await server.ask(B, { action: 'leave', roomId: seat.id });
    expect(await dropped(B)).toBe(false);
    // HOST takes a seat again: it is behind them.
    await quick(server, HOST);
    expect(await dropped(HOST)).toBe(false);
  });

  it('keeps everyone in a game among friends, however many rounds the clock plays for them', async () => {
    const { server, room } = await begun(roomServer(), 90);
    for (let round = 0; round < 3; round++) {
      await server.ask(HOST, { action: 'submit', roomId: room, step: await answerHand(server, HOST, room), orders: [] });
      server.wait(96_000);
      await server.ask(HOST, { action: 'state', roomId: room });
    }
    const after = seatOf(await server.ask(HOST, { action: 'state', roomId: room }));
    expect(after.round).toBe(3);
    expect(after.members.every((m) => !m.left)).toBe(true);
  });

  it('lets a player of a public game report a name: they stop seeing it at once, and a second player\'s report takes it away', async () => {
    const server = roomServer();
    server.db.names.set(C, 'Rude_Name');
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    await quick(server, C);
    const reported = await server.ask(HOST, { action: 'report', roomId: seat.id, userId: C });
    expect(reported.status).toBe(200);
    expect(reported.body.report).toBe('ok');
    // The one who reported it no longer sees it; the others still do.
    expect(seatOf(reported).members.find((m) => m.userId === C)?.name).toBeNull();
    expect(seatOf(await server.ask(B, { action: 'state', roomId: seat.id })).members.find((m) => m.userId === C)?.name).toBe('Rude_Name');
    // A second player reports it: the name is gone for everyone.
    expect((await server.ask(B, { action: 'report', roomId: seat.id, userId: C })).body.report).toBe('cleared');
    expect(server.db.names.get(C)).toBeNull();
    expect(seatOf(await server.ask(C, { action: 'state', roomId: seat.id })).members.find((m) => m.me)?.name).toBeNull();
    // Nothing more to report of a player with no name.
    expect((await server.ask(HOST, { action: 'report', roomId: seat.id, userId: C })).body.report).toBe('nameless');
  });

  it('reports no name of oneself, of a rat, of a stranger, or in a game among friends', async () => {
    const server = roomServer();
    const seat = seatOf(await quick(server, HOST));
    const started = seatOf(await server.ask(HOST, { action: 'start', roomId: seat.id }));
    const rat = started.members.find((m) => m.bot !== null)?.userId as string;
    expect(await server.ask(HOST, { action: 'report', roomId: seat.id, userId: HOST })).toMatchObject({ status: 400, body: { field: 'userId' } });
    expect(await server.ask(HOST, { action: 'report', roomId: seat.id, userId: rat })).toMatchObject({ status: 400, body: { field: 'userId' } });
    expect(await server.ask(HOST, { action: 'report', roomId: seat.id, userId: D })).toMatchObject({ status: 400, body: { field: 'userId' } });
    expect(await server.ask(D, { action: 'report', roomId: seat.id, userId: HOST })).toMatchObject({ status: 404, body: { error: 'unknown-room' } });
    const friends = await begun(roomServer());
    expect(await friends.server.ask(HOST, { action: 'report', roomId: friends.room, userId: B })).toMatchObject({ status: 409, body: { error: 'not-public' } });
  });

  it('lets a player ask someone they played with to be friends, without their code; a yes back makes them friends; and says so at the end', async () => {
    const server = roomServer();
    server.db.names.set(HOST, 'Hosta_1');
    const seat = seatOf(await quick(server, HOST));
    await quick(server, B);
    const started = seatOf(await server.ask(HOST, { action: 'start', roomId: seat.id }));
    const rat = started.members.find((m) => m.bot !== null)?.userId as string;
    expect(await server.ask(HOST, { action: 'follow', roomId: seat.id, userId: rat })).toMatchObject({ status: 400, body: { field: 'userId' } });
    const told = server.notices.length;
    expect((await server.ask(HOST, { action: 'follow', roomId: seat.id, userId: B })).status).toBe(200);
    // A request, not a friendship; and whoever is asked hears of it, by the asker's name.
    expect(server.db.friendships).toEqual([]);
    expect(server.db.requests).toEqual([{ from: HOST, to: B }]);
    expect(server.notices.slice(told)).toEqual([{ user: B, about: { kind: 'friendRequest', who: 'Hosta_1' } }]);
    // Asked once, it is not asked twice, nor told twice.
    await server.ask(HOST, { action: 'follow', roomId: seat.id, userId: B });
    expect(server.db.requests).toHaveLength(1);
    expect(server.notices.slice(told)).toHaveLength(1);
    // Played to its end by both: at the end, the page is told whom the player has asked, and whom they are friends with.
    for (let round = 0; round < content.rounds; round++) {
      for (const who of [HOST, B]) await server.ask(who, { action: 'submit', roomId: seat.id, step: await answerHand(server, who, seat.id), orders: [] });
    }
    const end = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(end.status).toBe('finished');
    expect(end.members.find((m) => m.userId === B)).toMatchObject({ followed: true, friend: false });
    expect(end.members.find((m) => m.userId === rat)).toMatchObject({ followed: false, friend: false });
    // B asking back is a yes: friends both ways, the request gone, and the asker hears it.
    expect((await server.ask(B, { action: 'follow', roomId: seat.id, userId: HOST })).status).toBe(200);
    expect(server.db.friendships).toEqual([{ follower: B, followed: HOST }, { follower: HOST, followed: B }]);
    expect(server.db.requests).toEqual([]);
    expect(server.notices.at(-1)).toEqual({ user: HOST, about: { kind: 'friendAccepted', who: null } });
    expect(seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id })).members.find((m) => m.userId === B)).toMatchObject({ followed: true, friend: true });
    // At most two hundred friends.
    server.db.friendships.length = 0;
    for (let n = 0; n < 200; n++) server.db.friendships.push({ follower: B, followed: `f${n}` });
    expect(await server.ask(B, { action: 'follow', roomId: seat.id, userId: HOST })).toMatchObject({ status: 409, body: { error: 'full' } });
  });
});

describe('a public game of a round a day', () => {
  const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  type Seat = Omit<Room, 'members'> & { public: boolean; startsAt: string | null; members: Array<Room['members'][number] & { bot: string | null }> };
  const seatOf = (reply: { body: Body }) => reply.body.room as Seat;
  const slow = (server: ReturnType<typeof roomServer>, who: string) => server.ask(who, { action: 'quick', pace: 'slow', ...VERSIONS });
  const DAY = PUBLIC_PACES.slow.seconds;

  it('seats whoever asks for one in a lobby of a round a day, which waits half an hour for players', async () => {
    const server = roomServer();
    const seat = seatOf(await slow(server, HOST));
    expect(seat).toMatchObject({ status: 'open', public: true, seconds: DAY, startsAt: new Date(server.state.now + PUBLIC_PACES.slow.waitMs).toISOString() });
    expect(DAY).toBe(86_400);
    expect(seatOf(await slow(server, B)).id).toBe(seat.id);
    expect(await server.ask(C, { action: 'quick', pace: 'fast', ...VERSIONS })).toMatchObject({ status: 400, body: { field: 'pace' } });
  });

  it('never puts the two paces together, and counts each apart', async () => {
    const server = roomServer();
    const day = seatOf(await slow(server, HOST));
    const live = seatOf(await server.ask(B, { action: 'quick', ...VERSIONS }));
    expect(live.id).not.toBe(day.id);
    expect(live.seconds).toBe(QUICK_SECONDS);
    expect(seatOf(await slow(server, C)).id).toBe(day.id);
    expect((await server.ask(D, { action: 'lobbies', ...VERSIONS })).body).toEqual({ open: 1, slow: 1, dropped: false });
  });

  it('turns a round as soon as everyone has played it, and tells each player when the next is theirs', async () => {
    const server = roomServer();
    const seat = seatOf(await slow(server, HOST));
    await slow(server, B);
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    server.notices.length = 0;
    // HOST plays at once; B a few hours later. The rats played already: nobody waits a day.
    await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
    expect(server.notices).toEqual([{ user: B, about: { kind: 'yourTurn', round: 1, rounds: content.rounds, secondsLeft: DAY } }]);
    server.wait(5 * 3_600_000);
    const turned = await server.ask(B, { action: 'submit', roomId: seat.id, step: await answerHand(server, B, seat.id), orders: [] });
    expect(seatOf(turned).round).toBe(1);
    expect(seatOf(turned).deadline).toBe(new Date(server.state.now + DAY * 1000).toISOString());
    // The new round is told to the player who did not turn it, and to no rat.
    expect(server.notices.slice(1)).toEqual([{ user: HOST, about: { kind: 'newRound', round: 2, rounds: content.rounds, seconds: DAY } }]);
  });

  it('takes out whoever lets two days go by in a row, as in a game played together', async () => {
    const server = roomServer();
    const seat = seatOf(await slow(server, HOST));
    await slow(server, B);
    await server.ask(HOST, { action: 'start', roomId: seat.id });
    for (let round = 0; round < 2; round++) {
      await server.ask(HOST, { action: 'submit', roomId: seat.id, step: await answerHand(server, HOST, seat.id), orders: [] });
      server.wait(DAY * 1000 + GRACE_MS + 1);
      await server.ask(HOST, { action: 'state', roomId: seat.id });
    }
    const after = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(after.round).toBe(2);
    expect(after.members.find((m) => m.userId === B)?.left).toBe(true);
  });

  it('starts by itself once its half hour is over, the first time anyone looks', async () => {
    const server = roomServer();
    const seat = seatOf(await slow(server, HOST));
    server.wait(PUBLIC_PACES.slow.waitMs - 1_000);
    expect(seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id })).status).toBe('open');
    server.wait(1_000);
    const started = seatOf(await server.ask(HOST, { action: 'state', roomId: seat.id }));
    expect(started.status).toBe('playing');
    expect(started.members.filter((m) => m.bot !== null)).toHaveLength(TABLE - 1);
  });
});
