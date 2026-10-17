import { applyCard, applyRoomEvents, applyRound, applyRoundWith, createGame, livedStatus, replayLog, stateHash, viewOf } from '@ratrace/engine';
import type { GameState, LoggedRound, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { lives } from './lives';
import { replayLife, roomStart, stepLife } from './record';

const nurse = lives[0].start;
const tease: Order = { type: 'focus', action: 'tease', target: 'ana' };

/** A life at the finance phase of its first round: alone, or in a game with friends. */
function atFinance(room: boolean): GameState {
  let state = createGame({ content, start: room ? roomStart(nurse) : nurse }, 'tease');
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  return state;
}

describe('teasing a rival', () => {
  it('is open only to a life in a game with friends', () => {
    const alone = applyRound(content, atFinance(false), { orders: [tease] });
    expect(alone.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'unknown-action' }));
    const among = applyRound(content, atFinance(true), { orders: [tease] });
    expect(among.events.some((event) => event.kind === 'orderRejected')).toBe(false);
  });

  it('gives status for that round only', () => {
    const before = atFinance(true);
    const quiet = applyRound(content, before, { orders: [] }).state;
    const teased = applyRound(content, before, { orders: [tease] }).state;
    expect(teased.player.statusSum - quiet.player.statusSum).toBe(content.life.teaseStatus);
    expect(teased.player.statusPoints).toBe(quiet.player.statusPoints);
    expect(teased.player.life.statusNudge).toBeUndefined();
    // Once a round, as every use of focus.
    const twice = applyRound(content, before, { orders: [tease, tease] });
    expect(twice.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'already-done' }));
  });

  it('takes status from its target for the round to come, and only that one', () => {
    const start = atFinance(true);
    const quiet = applyRound(content, start, { orders: [] });
    const hit = applyRoundWith(content, start, [], [{ kind: 'teased', by: 'javi' }, { kind: 'teased', by: 'bo' }]);
    expect(hit.events.slice(-2)).toEqual([{ kind: 'teased', by: 'javi', status: -content.life.teasedStatus }, { kind: 'teased', by: 'bo', status: -content.life.teasedStatus }]);
    expect(quiet.state.player.statusPoints - hit.state.player.statusPoints).toBe(2 * content.life.teasedStatus);
    // The round it was for counts it, and then it is gone.
    const play = (state: GameState) => {
      let next = state;
      while (next.phase === 'cards') next = applyCard(content, next, 0).state;
      return applyRound(content, next, { orders: [] }).state;
    };
    const after = play(hit.state);
    const plain = play(quiet.state);
    expect(plain.player.statusSum - after.player.statusSum).toBe(2 * content.life.teasedStatus);
    expect(after.player.statusPoints).toBe(plain.player.statusPoints);
    expect(livedStatus(viewOf(after))).toBeLessThanOrEqual(livedStatus(viewOf(plain)));
  });

  it('plays back from the log, with the room events where the server wrote them', () => {
    const start = roomStart(nurse);
    const log: LoggedRound[] = [];
    let from = replayLife(content, start, 'replay', []);
    for (let round = 0; round < 3; round++) {
      const entry: LoggedRound = { picks: [], orders: null };
      log.push(entry);
      while (from.state.phase === 'cards') {
        entry.picks.push(0);
        from = stepLife(content, from, { card: 0 });
      }
      entry.orders = round === 0 ? [tease] : [];
      if (round === 1) entry.room = [{ kind: 'teased', by: 'ana' }];
      from = stepLife(content, from, { orders: entry.orders, ...(entry.room ? { room: entry.room } : {}) });
      expect(stateHash(from.state)).toBe(stateHash(replayLog(content, start, 'replay', log)));
      expect({ ...from, state: null }).toEqual({ ...replayLife(content, start, 'replay', log), state: null });
    }
  });

  it('refuses a log with a room event that is not one, or in a round never played', () => {
    const start = roomStart(nurse);
    const picks = replayLife(content, start, 'bad', []).state.hand.map(() => 0);
    expect(() => replayLog(content, start, 'bad', [{ picks, orders: [], room: [{ kind: 'gift', by: 'ana' } as never] }])).toThrow();
    expect(() => replayLog(content, start, 'bad', [{ picks, orders: [], room: [{ kind: 'teased', by: '' }] }])).toThrow();
    expect(() => replayLog(content, start, 'bad', [{ picks, orders: null, room: [{ kind: 'teased', by: 'ana' }] }])).toThrow();
  });

  it('leaves a life with no room event exactly as it was', () => {
    const log: LoggedRound[] = [{ picks: replayLife(content, nurse, 'same', []).state.hand.map(() => 0), orders: [] }];
    expect(stateHash(replayLog(content, nurse, 'same', log))).toBe(stateHash(replayLog(content, nurse, 'same', [{ ...log[0], room: [] }])));
  });
});

describe('a loan between players', () => {
  const terms = { id: 'loan-1', amount: 1_000_000, rateBp: 800, rounds: 3 };
  /** Two lives of a room, one round played each, the loan paid out between them. */
  function lentAndBorrowed() {
    const play = (state: GameState, orders: Order[] = []) => {
      let next = state;
      while (next.phase === 'cards') next = applyCard(content, next, 0).state;
      return applyRound(content, next, { orders }).state;
    };
    const start = createGame({ content, start: roomStart(lives[4].start) }, 'lender');
    const lender = applyRoomEvents(content, play(start), [{ kind: 'lent', to: 'bo', ...terms }]);
    const borrower = applyRoomEvents(content, play(createGame({ content, start: roomStart(nurse) }, 'borrower')), [{ kind: 'borrowed', from: 'ana', ...terms }]);
    return { play, lender, borrower };
  }

  it('pays the money out from one and into the other, as a loan owed and a loan to collect', () => {
    const { lender, borrower } = lentAndBorrowed();
    expect(lender.events).toEqual([{ kind: 'lent', to: 'bo', amount: 1_000_000, rateBp: 800, rounds: 3 }]);
    expect(borrower.events).toEqual([{ kind: 'borrowed', from: 'ana', amount: 1_000_000, rateBp: 800, rounds: 3 }]);
    expect(lender.state.player.lent).toEqual([{ id: 'loan-1', peer: 'bo', principal: 1_000_000, fixedRateBp: 800, roundsLeft: 3 }]);
    expect(borrower.state.player.debts).toContainEqual({ id: 'loan-1', kind: 'personalLoan', principal: 1_000_000, fixedRateBp: 800, roundsLeft: 3, peer: 'ana' });
  });

  it('is paid back round by round by the same sums the other collects, until nothing is owed', () => {
    const { play, lender, borrower } = lentAndBorrowed();
    let a = lender.state;
    let b = borrower.state;
    for (let round = 0; round < 3; round++) {
      const owed = b.player.debts.find((debt) => debt.id === 'loan-1')?.principal ?? 0;
      a = play(a);
      b = play(b);
      const left = b.player.debts.find((debt) => debt.id === 'loan-1')?.principal ?? 0;
      expect(a.player.lent?.find((loan) => loan.id === 'loan-1')?.principal ?? 0, `round ${round}`).toBe(left);
      expect(left).toBeLessThan(owed);
    }
    expect(a.player.lent).toBeUndefined();
    expect(b.player.debts.some((debt) => debt.id === 'loan-1')).toBe(false);
  });

  it('cannot be paid early', () => {
    const { borrower } = lentAndBorrowed();
    let b = borrower.state;
    while (b.phase === 'cards') b = applyCard(content, b, 0).state;
    const round = applyRound(content, b, { orders: [{ type: 'repay', debtId: 'loan-1', amount: 1_000 }] });
    expect(round.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'peer-loan' }));
  });

  it('is lost when whoever owes it goes under, and what was left is told', () => {
    const { lender } = lentAndBorrowed();
    const lost = applyRoomEvents(content, lender.state, [{ kind: 'defaulted', id: 'loan-1' }]);
    expect(lost.events).toEqual([{ kind: 'defaulted', by: 'bo', lost: 1_000_000 }]);
    expect(lost.state.player.lent).toBeUndefined();
  });

  it('refuses to pay out more than the lender has', () => {
    const start = createGame({ content, start: roomStart(nurse) }, 'poor');
    expect(() => applyRoomEvents(content, start, [{ kind: 'lent', to: 'bo', ...terms, amount: start.player.cash + 1 }])).toThrow();
  });
});
