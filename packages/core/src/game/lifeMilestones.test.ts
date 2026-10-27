import { content, LIFE_MILESTONE_ART, lives } from '@ratrace/content';
import type { Milestone } from '@ratrace/content';
import { createGame, escapeProgress, viewOf } from '@ratrace/engine';
import type { Debt, GameEvent, GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { fixedSessions } from '../session/fixed';
import type { FinishedRun } from '../session/types';
import { runScene, sceneStore } from '../testing/scenes';
import { bestsOfRuns, celebrationOf, EMPTY_BOOK, isHalfway, LIFE_MILESTONES, memoryMilestones, milestonesOfStep, readBook, withBests } from './lifeMilestones';
import type { MilestoneBook, Reached } from './lifeMilestones';
import { ageAt } from './present';
import { escapeUnder } from './rules';
import { createGameStore } from './store';

const DEBT: Debt = { id: 'd1', kind: 'creditCard', principal: 50_000, fixedRateBp: 0, roundsLeft: 0 };

/** A life at a round, with what the test gives it. */
function view(round: number, change: (view: GameView) => void = () => undefined): GameView {
  const made = viewOf(createGame({ content, start: lives[0].start }, 'milestones'));
  made.timeline = Array.from({ length: round + 1 }, (_, at) => ({ ...made.timeline[0], round: at }));
  made.round = round;
  made.player.debts = [];
  made.player.extraPassiveAnnual = 0;
  change(made);
  return made;
}
const indebted = (v: GameView) => void (v.player.debts = [{ ...DEBT }]);

interface Step {
  book?: MilestoneBook;
  before?: GameView;
  after?: GameView;
  was?: Milestone[];
  now?: Milestone[];
  events?: GameEvent[];
}
const step = ({ book = EMPTY_BOOK, before = view(3), after = view(4), was = [], now = was, events = [] }: Step) =>
  milestonesOfStep({ content, gameId: 'g1', book, before, after, story: { before: was, after: now }, events });
const ids = (reached: readonly Reached[]) => reached.map((r) => r.id);

describe('the milestones a step reaches', () => {
  it('takes the worth, the first home, the first business and the way out from what the story newly tells', () => {
    const now: Milestone[] = [
      { round: 4, kind: 'worth', mark: 10_000_000 },
      { round: 4, kind: 'worth', mark: 100_000_000 },
      { round: 4, kind: 'home', typeId: 'flat' },
      { round: 4, kind: 'business' },
      { round: 5, kind: 'escaped' },
    ];
    const { reached } = step({ now });
    expect(ids(reached)).toEqual(['escaped', 'worth1m', 'home', 'business', 'worth100k']);
    // The way out is told at the age of the round it was won in, as everywhere else.
    expect(reached.find((r) => r.id === 'escaped')?.age).toBe(ageAt(content, 4));
    expect(reached.find((r) => r.id === 'home')?.age).toBe(ageAt(content, 4));
  });

  it('never celebrates what the story already told before the step: a life begun before milestones were celebrated starts where it stands', () => {
    const was: Milestone[] = [{ round: 2, kind: 'worth', mark: 10_000_000 }, { round: 2, kind: 'business' }, { round: 2, kind: 'escaped' }];
    const now: Milestone[] = [...was, { round: 4, kind: 'business' }, { round: 4, kind: 'escaped' }];
    expect(step({ was, now }).reached).toEqual([]);
  });

  it('celebrates the debts paid off once, and only after having had some in this life', () => {
    // Never in debt: nothing to celebrate.
    expect(step({}).reached).toEqual([]);
    // In debt, then out of it.
    const paid = step({ before: view(3, indebted), after: view(4) });
    expect(ids(paid.reached)).toEqual(['debtFree']);
    // In debt again and out again: once a life.
    const again = step({ book: paid.book, before: view(6, indebted), after: view(7) });
    expect(again.reached).toEqual([]);
  });

  it('does not take a bankruptcy for debts paid off', () => {
    const broke = step({ before: view(3, indebted), after: view(4), events: [{ kind: 'bankrupt', proceeds: 0, debtsCleared: 50_000 } as GameEvent] });
    expect(broke.reached).toEqual([]);
    expect(step({ book: broke.book, before: view(4), after: view(5) }).reached).toEqual([]);
  });

  it('celebrates halfway out once, even if the life slips back under it and comes back', () => {
    const half = (v: GameView) => void (v.player.extraPassiveAnnual = 10_000_000_000);
    expect(isHalfway({ passiveAfterTax: 50, outgoings: 100 })).toBe(true);
    expect(isHalfway({ passiveAfterTax: 49, outgoings: 100 })).toBe(false);
    expect(isHalfway({ passiveAfterTax: 0, outgoings: 0 })).toBe(false);
    const first = step({ after: view(4, half) });
    expect(ids(first.reached)).toEqual(['halfway']);
    const slipped = step({ book: first.book, before: view(4, half), after: view(5) });
    expect(step({ book: slipped.book, before: view(5), after: view(6, half) }).reached).toEqual([]);
  });

  it('measures halfway out as the life\'s own rules do: savings count whole under engine 0.44, half from 0.45', () => {
    // Savings whose interest is between half and all of half the outgoings: halfway only where it counts whole.
    let deposit = 1_000_000;
    const saved = (v: GameView) => void (v.player.deposit = deposit);
    while (!isHalfway(escapeUnder('0.44.0', escapeProgress(content, view(4, saved))))) deposit += 1_000_000;
    expect(isHalfway(escapeProgress(content, view(4, saved)))).toBe(false);
    const steps = (rules?: string) => milestonesOfStep({ content, gameId: 'g1', book: EMPTY_BOOK, before: view(3), after: view(4, saved), story: { before: [], after: [] }, events: [], rules });
    expect(ids(steps().reached)).toEqual([]);
    expect(ids(steps('0.44.0').reached)).toEqual(['halfway']);
  });

  it('does not tell halfway out in the step that gets the life all the way out', () => {
    const half = (v: GameView) => void (v.player.extraPassiveAnnual = 10_000_000_000);
    const out = step({ after: view(5, half), now: [{ round: 5, kind: 'escaped' }] });
    expect(ids(out.reached)).toEqual(['escaped']);
    expect(step({ book: out.book, before: view(5, half), after: view(6, half) }).reached).toEqual([]);
  });

  it('keeps nothing true when a life is first seen as reached in it: what it had then is where it starts', () => {
    const half = (v: GameView) => void (v.player.extraPassiveAnnual = 10_000_000_000);
    expect(step({ before: view(9, half), after: view(10, half) }).reached).toEqual([]);
  });

  it('is big the first time ever, and for a new personal record; medium otherwise; the way out always big', () => {
    const now: Milestone[] = [{ round: 4, kind: 'home', typeId: 'flat' }];
    const first = step({ now });
    expect(first.reached).toEqual([{ id: 'home', age: ageAt(content, 4), best: null, size: 'big' }]);
    expect(first.book.best.home).toBe(ageAt(content, 4));
    // Another life, older: medium, and the record stands.
    const older = milestonesOfStep({ content, gameId: 'g2', book: first.book, before: view(5), after: view(6), story: { before: [], after: [{ round: 6, kind: 'home', typeId: 'flat' }] }, events: [] });
    expect(older.reached).toEqual([{ id: 'home', age: ageAt(content, 6), best: ageAt(content, 4), size: 'medium' }]);
    expect(older.book.best.home).toBe(ageAt(content, 4));
    // Younger than ever: big, and it is the record now.
    const younger = milestonesOfStep({ content, gameId: 'g3', book: older.book, before: view(1), after: view(2), story: { before: [], after: [{ round: 2, kind: 'home', typeId: 'flat' }] }, events: [] });
    expect(younger.reached[0]).toMatchObject({ size: 'big', best: ageAt(content, 4) });
    expect(younger.book.best.home).toBe(ageAt(content, 2));
    // The way out, at no record: big all the same.
    const out = withBests(EMPTY_BOOK, { escaped: 20 });
    expect(step({ book: out, now: [{ round: 5, kind: 'escaped' }] }).reached[0]).toMatchObject({ id: 'escaped', size: 'big', best: 20 });
  });

  it('remembers a few lives only', () => {
    let book = EMPTY_BOOK;
    for (let i = 0; i < 20; i++) book = milestonesOfStep({ content, gameId: `g${i}`, book, before: view(3), after: view(4), story: { before: [], after: [] }, events: [] }).book;
    expect(book.lives.length).toBeLessThanOrEqual(8);
    expect(book.lives[0].gameId).toBe('g19');
  });
});

describe('the youngest age of each milestone in the lives finished', () => {
  const run = (over: Partial<FinishedRun>): FinishedRun => ({
    format: 1, runId: 'r', engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: '', log: [], finishedAt: 1, score: 0, netWorth: 0, status: 0,
    escapedAtRound: null, bankruptcies: 0, history: [0], badges: [], cities: [], verified: false, ...over,
  });

  it('reads the worth from the graph of each life and the way out from its round, the youngest of all', () => {
    const runs = [run({ history: [0, 5_000_000, 12_000_000, 150_000_000], escapedAtRound: 12 }), run({ history: [0, 20_000_000, 0, 0, 0, 0, 0, 0, 0, 0, 1_000_000_000], escapedAtRound: 9 })];
    expect(bestsOfRuns(content, runs)).toEqual({ worth100k: ageAt(content, 1), worth1m: ageAt(content, 3), worth10m: ageAt(content, 10), escaped: ageAt(content, 9) });
  });

  it('takes nothing a life started with for a milestone', () => {
    expect(bestsOfRuns(content, [run({ history: [20_000_000, 20_000_000] })])).toEqual({});
  });

  it('only ever lowers what the device already knows', () => {
    expect(withBests({ lives: [], best: { home: 30, worth1m: 40 } }, { worth1m: 44, escaped: 50 }).best).toEqual({ home: 30, worth1m: 40, escaped: 50 });
  });
});

describe('what a step shows', () => {
  const legendary = (id: string) => id === 'legend';
  const medium: Reached = { id: 'home', age: 30, best: 28, size: 'medium' };
  const big: Reached = { id: 'worth100k', age: 26, best: null, size: 'big' };

  it('leaves badges alone where no milestone was reached', () => {
    expect(celebrationOf({ reached: [], earned: ['a'], legendary, moment: null, inRoom: false })).toEqual({ where: 'badges' });
  });

  it('carries the badges of the step in the milestone, which leads', () => {
    expect(celebrationOf({ reached: [medium], earned: ['a'], legendary, moment: null, inRoom: false })).toEqual({ where: 'banner', lead: medium, others: [], badges: ['a'] });
    expect(celebrationOf({ reached: [medium, big], earned: [], legendary, moment: null, inRoom: false })).toEqual({ where: 'sheet', lead: big, others: [medium], badges: [] });
  });

  it('makes a legendary badge and a milestone one big screen', () => {
    expect(celebrationOf({ reached: [medium], earned: ['legend'], legendary, moment: null, inRoom: false })).toMatchObject({ where: 'sheet', lead: medium, badges: ['legend'] });
  });

  it('never stops a room: a big moment rises as a banner there', () => {
    expect(celebrationOf({ reached: [big], earned: ['legend'], legendary, moment: null, inRoom: true })).toMatchObject({ where: 'banner', lead: big });
  });

  it('hands everything to the moment that already has the screen for the first million or the way out', () => {
    const million: Reached = { id: 'worth1m', age: 40, best: 38, size: 'medium' };
    expect(celebrationOf({ reached: [medium, million], earned: ['a'], legendary, moment: 'million', inRoom: false })).toEqual({ where: 'moment', lead: million, others: [medium], badges: ['a'] });
    // A moment of another kind carries nothing.
    expect(celebrationOf({ reached: [medium], earned: [], legendary, moment: 'million', inRoom: false }).where).toBe('banner');
  });
});

describe('the round store', () => {
  it('tells the milestones of the step on screen, keeps them in the book, and lets them go with the step', async () => {
    const milestones = memoryMilestones();
    const game = createGameStore({ sessions: fixedSessions(await sceneStore('moment-escape')), content, milestones });
    await game.getState().boot();
    await runScene('moment-escape', game);
    const state = game.getState();
    expect(state.reached.map((r) => r.id)).toContain('escaped');
    expect(state.reached.find((r) => r.id === 'escaped')?.size).toBe('big');
    expect(milestones.load().lives[0]).toMatchObject({ gameId: state.gameId, reached: expect.arrayContaining(['escaped']) });
    game.getState().next();
    expect(game.getState().reached).toEqual([]);
  });

  it('reads back a kept book, and nothing it does not know', () => {
    const book: MilestoneBook = { lives: [{ gameId: 'g', hadDebt: true, reached: ['halfway'] }], best: { home: 30 } };
    expect(readBook(JSON.parse(JSON.stringify(book)))).toEqual(book);
    expect(readBook({ lives: [{ gameId: 1 }, { gameId: 'h', reached: ['nonsense'] }], best: { nonsense: 3, home: 'x' } })).toEqual({ lives: [{ gameId: 'h', hadDebt: false, reached: [] }], best: {} });
    expect(readBook('nonsense')).toEqual(EMPTY_BOOK);
  });
});

describe('the scenes of the milestones', () => {
  it('draw every milestone the game celebrates, and none it does not', () => {
    expect(Object.keys(LIFE_MILESTONE_ART).sort()).toEqual([...LIFE_MILESTONES].sort());
  });
});
