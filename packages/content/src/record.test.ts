import { applyCard, applyRound, createGame, realNetWorth, stateHash, viewOf } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { journalStart } from './badges';
import { content } from './content';
import { lives } from './lives';
import { recordStart, recordStep, replayLife, stepLife } from './record';
import type { LifeRecord, Replayed, ReplayedStep } from './record';

const nurse = lives[0].start;

/** Plays a life with the same answers and orders every round, keeping the record as a session would. */
function play(rounds: number, orders: Parameters<typeof applyRound>[2]['orders'] = []): { state: GameState; record: LifeRecord; earned: string[][] } {
  let state = createGame({ content, start: nurse }, 'record');
  let record = recordStart(content, state);
  const earned: string[][] = [];
  const take = (after: GameState, events: Parameters<typeof recordStep>[4], given: typeof orders = []) => {
    const step = recordStep(content, record, state, after, events, given);
    record = step.record;
    earned.push(step.earned);
    state = after;
  };
  while (!state.finished && state.round < rounds) {
    while (state.phase === 'cards') {
      const card = applyCard(content, state, 0);
      take(card.state, card.events);
    }
    const round = applyRound(content, state, { orders });
    take(round.state, round.events, orders);
  }
  return { state, record, earned };
}

describe('the record of a life', () => {
  it('starts with the net worth the life begins with, no bankruptcy, and a fresh journal', () => {
    const state = createGame({ content, start: nurse }, 'record');
    expect(recordStart(content, state)).toEqual({ history: [realNetWorth(state)], bankruptcies: 0, journal: journalStart(content, viewOf(state)) });
    expect(recordStart(content, state).journal).toMatchObject({ cities: ['madrid'], cardUsed: false, kinds: [], earned: [], story: { milestones: [] } });
  });

  it('adds one net worth for every round played, and none for a card', () => {
    const { state, record } = play(3);
    expect(state.round).toBe(3);
    expect(record.history).toHaveLength(4);
    expect(record.history[3]).toBe(realNetWorth(state));
  });

  it('counts bankruptcies', () => {
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    const { record, earned } = play(10, [{ type: 'setLifestyle', tier: 3 }]);
    expect(record.bankruptcies).toBeGreaterThan(0);
    expect(record.journal.cardUsed).toBe(true);
    expect(earned.flat()).toContain('bankrupt');
  });

  it('writes each badge into the journal the moment it is earned, and never twice', () => {
    const { record, earned } = play(20, [{ type: 'focus', action: 'studyCareer' }]);
    const all = earned.flat();
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    expect(record.journal.earned).toEqual(all);
  });

  it('gives the same record for the same life, step for step', () => {
    expect(play(8).record).toEqual(play(8).record);
  });

  it('does not change the record it was given', () => {
    const state = createGame({ content, start: nurse }, 'record');
    const record = recordStart(content, state);
    const copy = structuredClone(record);
    const card = applyCard(content, state, 0);
    recordStep(content, record, state, card.state, card.events, []);
    expect(record).toEqual(copy);
  });

  it('hands the orders of a round to the badges, which is how selling and buying back is told from holding', () => {
    // A hand-made round in a recession: the fund is still held, at the price paid, but an order sold some of it.
    const state = createGame({ content, start: nurse }, 'record');
    state.phase = 'finance';
    state.timeline[0] = { ...state.timeline[0], regime: 'recession' };
    state.player.positions.msci_world = { value: 500_000, basis: 500_000 };
    const after = structuredClone(state);
    after.round = 1;
    after.timeline.push({ ...state.timeline[0], round: 1 });
    const record = recordStart(content, state);
    expect(recordStep(content, record, state, after, [], []).earned).toContain('rode_out_recession');
    expect(recordStep(content, record, state, after, [], [{ type: 'sell', assetId: 'msci_world', amount: 1 }]).earned).not.toContain('rode_out_recession');
  });
});

describe('a life played again from its log', () => {
  /** A nurse's first `rounds` rounds, first choice on every card, with the record kept step by step and the log of it. */
  function lived(seed: string, rounds: number) {
    const start = lives.find((life) => life.id === 'nurse')?.start;
    if (!start) throw new Error('no nurse');
    let state = createGame({ content, start }, seed);
    let record = recordStart(content, state);
    const log: LoggedRound[] = [];
    for (let i = 0; i < rounds; i++) {
      const picks: number[] = [];
      while (state.phase === 'cards') {
        const next = applyCard(content, state, 0);
        record = recordStep(content, record, state, next.state, next.events, []).record;
        state = next.state;
        picks.push(0);
      }
      const next = applyRound(content, state, { orders: [] });
      record = recordStep(content, record, state, next.state, next.events, []).record;
      state = next.state;
      log.push({ picks, orders: [] });
    }
    return { start, state, record, log };
  }

  it('gives back the game and the very record that was kept while it was played', () => {
    const { start, state, record, log } = lived('again', 6);
    const again = replayLife(content, start, 'again', log);
    expect(stateHash(again.state)).toBe(stateHash(state));
    expect({ history: again.history, bankruptcies: again.bankruptcies, journal: again.journal }).toEqual(record);
    expect(again.history).toHaveLength(7);
  });

  it('gives a life not begun its starting record', () => {
    const { start } = lived('fresh', 0);
    const again = replayLife(content, start, 'fresh', []);
    expect(again.state.round).toBe(0);
    expect({ history: again.history, bankruptcies: again.bankruptcies, journal: again.journal }).toEqual(recordStart(content, again.state));
  });

  it('refuses a log that cannot have been played, as the engine does', () => {
    const { start, log } = lived('bad', 1);
    expect(() => replayLife(content, start, 'bad', [{ picks: [], orders: null }, log[0]])).toThrow('the log goes on after a round that was never played');
  });

  it('tells of every step as it is played again: what happened, what it earned, and the record so far', () => {
    // A server that plays a ranked life answers each step with these, and so must find the last one.
    const { log, record } = lived('steps', 3);
    const start = lives.find((life) => life.id === 'nurse')?.start;
    if (!start) throw new Error('no nurse');
    const heard: Array<{ events: number; earned: string[]; rounds: number }> = [];
    const again = replayLife(content, start, 'steps', log, (step) => heard.push({ events: step.events.length, earned: step.earned, rounds: step.record.history.length - 1 }));
    expect(heard).toHaveLength(log.reduce((steps, round) => steps + round.picks.length + 1, 0));
    expect(heard[heard.length - 1].rounds).toBe(3);
    expect(heard.every((step) => step.events > 0)).toBe(true);
    expect(heard.flatMap((step) => step.earned)).toEqual(record.journal.earned);
    expect(again.history).toEqual(record.history);
  });
});

describe('a life taken one step further', () => {
  /** Answers each card with an option that moves along the hand, and plays every round with the same orders. */
  const choicesOf = (round: number, hand: number): number => (round + hand) % 3;
  const ORDERS = [[], [{ type: 'focus', action: 'studyCareer' }], [{ type: 'setLifestyle', tier: 2 }]] as const;

  for (const life of [lives[0], lives[3], lives[8], lives[14]]) {
    it(`gives what playing the whole log again gives, at every step of the ${life.id}`, () => {
      const seed = `step-${life.id}`;
      const log: LoggedRound[] = [];
      let from: Replayed = replayLife(content, life.start, seed, []);
      while (!from.state.finished) {
        const round = from.state.round;
        const entry: LoggedRound = { picks: [], orders: null };
        log.push(entry);
        while (from.state.phase === 'cards') {
          const card = choicesOf(round, entry.picks.length);
          entry.picks.push(card);
          let heard: ReplayedStep | null = null;
          from = stepLife(content, from, { card }, (step) => (heard = step));
          let last: ReplayedStep | null = null;
          const whole = replayLife(content, life.start, seed, log, (step) => (last = step));
          expect(stateHash(from.state)).toBe(stateHash(whole.state));
          expect({ ...from, state: null }).toEqual({ ...whole, state: null });
          expect(heard).toEqual(last);
        }
        const orders = structuredClone(ORDERS[round % ORDERS.length]) as LoggedRound['orders'] & object;
        entry.orders = orders;
        from = stepLife(content, from, { orders });
        const whole = replayLife(content, life.start, seed, log);
        expect(stateHash(from.state)).toBe(stateHash(whole.state));
        expect({ ...from, state: null }).toEqual({ ...whole, state: null });
      }
    });
  }

  it('does not change the life it was given', () => {
    const from = replayLife(content, nurse, 'still', []);
    const copy = structuredClone(from);
    stepLife(content, from, { card: 1 });
    expect(from).toEqual(copy);
  });

  it('refuses a step that cannot be taken, as playing the log again does', () => {
    const begun = replayLife(content, nurse, 'refuse', []);
    let from = begun;
    while (from.state.phase === 'cards') from = stepLife(content, from, { card: 0 });
    expect(() => stepLife(content, from, { card: 0 })).toThrow();
  });
});
