import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { GameEvent, GameState, LifeStart, RoundChoices, StartConfig } from '../types';

const content = fixtureContent();
const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

const game = (seed: string, life: Partial<LifeStart> = {}, over: Partial<StartConfig> = {}): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash: 5_000_000, ...over, life: { ...office, ...life } } }, seed);

const play = (state: GameState, choices: RoundChoices = { orders: [] }) => applyRound(content, state, choices);
const quiet: RoundChoices = { orders: [] };
const study: RoundChoices = { orders: [{ type: 'focus', action: 'studyCareer' }] };
const hunt: RoundChoices = { orders: [{ type: 'focus', action: 'jobHunt' }] };
const kinds = (events: GameEvent[]) => events.map((e) => e.kind);

describe('end of round: career', () => {
  it('grows career skill with a round of work, and more with study', () => {
    expect(play(game('skill')).state.player.life.careerSkill).toBe(1);
    expect(play(game('skill'), study).state.player.life.careerSkill).toBe(2);
  });

  it('does not grow the skill of someone with no career', () => {
    expect(play(game('skill', { career: null })).state.player.life.careerSkill).toBe(0);
  });

  it('promotes when skill reaches what the next level needs', () => {
    const { state, events } = play(game('promo', { careerSkill: 3 }));
    expect(state.player.life.career).toEqual({ id: 'office', level: 1 });
    expect(events).toContainEqual({ kind: 'promoted', careerId: 'office', level: 1 });
    expect(state.player.salaryAnnual).toBe(3_300_000);
    expect(state.player.statusPoints).toBe(3 + 2);
    const short = play(game('promo', { careerSkill: 2 }));
    expect(short.state.player.life.career).toEqual({ id: 'office', level: 0 });
    expect(kinds(short.events)).not.toContain('promoted');
  });

  it('promotes one level a round, and stops at the top', () => {
    let state = game('fast', { careerSkill: 30 });
    const levels: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = play(state).state;
      levels.push(state.player.life.career?.level ?? -1);
    }
    expect(levels).toEqual([1, 2, 2, 2]);
  });

  it('rolls a job hunt when the round has resolved, and a success is a lasting raise', () => {
    let wins = 0;
    for (let i = 0; i < 300; i++) {
      const start = game(`hunt-${i}`);
      const { state, events } = play(start, hunt);
      const result = events.find((e) => e.kind === 'jobHunt');
      if (!result || result.kind !== 'jobHunt') throw new Error('expected a job hunt result');
      expect(state.player.life.salaryModPct).toBe(result.success ? 8 : 0);
      expect(state.player.salaryAnnual).toBe(result.success ? 2_592_000 : 2_400_000);
      expect(state.rng.cards).not.toEqual(start.rng.cards);
      expect(play(start, hunt).events).toEqual(events);
      if (result.success) wins += 1;
    }
    expect(wins).toBeGreaterThan(80);
    expect(wins).toBeLessThan(130);
  });

  it('rolls nothing when nobody hunts', () => {
    const start = game('no-hunt');
    const { state, events } = play(start, study);
    expect(kinds(events)).not.toContain('jobHunt');
    expect(state.rng.cards).toEqual(start.rng.cards);
  });

  it('gives focus and this round’s pay boost back', () => {
    const { state } = play(game('reset'), { orders: [{ type: 'focus', action: 'overtime' }, { type: 'focus', action: 'studyCareer' }] });
    expect(state.player.life.focusUsed).toBe(0);
    expect(state.player.life.salaryBoostPct).toBe(0);
    expect(state.player.salaryAnnual).toBe(2_400_000);
  });
});

describe('end of round: things with a clock', () => {
  it('moves the resale value of a durable by its drift and by inflation', () => {
    const start = game('drift');
    const first = play(start, { orders: [{ type: 'buyItem', itemId: 'car_basic' }, { type: 'buyItem', itemId: 'watch_gold' }] }).state;
    const [now, after] = [start.timeline[0].priceLevel, start.timeline[1].priceLevel];
    const real = (value: number, driftBp: number) => Math.floor((Math.floor((value * (10_000 + driftBp)) / 10_000) * after) / now);
    expect(first.player.life.items).toEqual([
      { itemId: 'car_basic', value: real(960_000, -2_000), roundsLeft: null, paid: 1_200_000, age: 1 },
      { itemId: 'watch_gold', value: real(900_000, 300), roundsLeft: null, paid: 1_000_000, age: 1 },
    ]);
    expect(first.player.life.items[0].value).toBeLessThan(960_000);
    expect(first.player.life.items[1].value).toBeGreaterThan(900_000);
  });

  it('lets an experience fade', () => {
    let state = play(game('trip'), { orders: [{ type: 'buyItem', itemId: 'trip' }] }).state;
    expect(state.player.life.items).toEqual([{ itemId: 'trip', value: 0, roundsLeft: 1, paid: 300_000, age: 0 }]);
    expect(state.player.statusPoints).toBe(10 + 2);
    state = play(state).state;
    expect(state.player.life.items).toEqual([]);
    expect(state.player.statusPoints).toBe(2);
    expect(state.player.life.collection).toEqual(['trip']);
  });

  it('counts recurring entries down and ends them', () => {
    const start = withPlayer(content, game('recurring'), {}, {
      recurring: [
        { tag: 'school', kind: 'expense', annual: 100_000, roundsLeft: 2 },
        { tag: 'bar', kind: 'passive', annual: 300_000, roundsLeft: null },
      ],
    });
    const first = play(start).state;
    expect(first.player.life.recurring[0]).toEqual({ tag: 'school', kind: 'expense', annual: 100_000, roundsLeft: 1 });
    expect(first.player.extraExpensesAnnual).toBe(100_000);
    const second = play(first).state;
    expect(second.player.life.recurring).toEqual([{ tag: 'bar', kind: 'passive', annual: 300_000, roundsLeft: null }]);
    expect(second.player.extraExpensesAnnual).toBe(0);
    expect(second.player.extraPassiveAnnual).toBe(300_000);
  });

  it('lets children grow up', () => {
    const start = withPlayer(content, game('kids'), {}, { children: [2, 1] });
    const first = play(start).state;
    expect(first.player.life.children).toEqual([1]);
    expect(first.player.extraExpensesAnnual).toBe(450_000);
    expect(play(first).state.player.life.children).toEqual([]);
  });
});

describe('end of round: finance skill from experience', () => {
  const buy: RoundChoices = { orders: [{ type: 'buy', assetId: 'fund_world', amount: 100_000 }] };

  it('rises once after three rounds of holding an investment', () => {
    let state = game('invest');
    const seen: number[] = [];
    const raised: number[] = [];
    for (let i = 0; i < 6; i++) {
      const result = play(state, i === 0 ? buy : quiet);
      state = result.state;
      seen.push(state.player.life.financeSkill);
      if (result.events.some((e) => e.kind === 'financeSkill')) raised.push(i);
    }
    expect(seen).toEqual([0, 0, 1, 1, 1, 1]);
    expect(raised).toEqual([2]);
    expect(state.player.life.investedRounds).toBe(6);
  });

  it('counts the pension, counts rounds that are not in a row, and never counts cash', () => {
    let saver = game('pension');
    saver = play(saver, { orders: [{ type: 'pensionIn', amount: 100_000 }] }).state;
    expect(saver.player.life.investedRounds).toBe(1);

    let idle = game('idle');
    for (let i = 0; i < 5; i++) idle = play(idle, { orders: [{ type: 'depositIn', amount: 1_000 }] }).state;
    expect(idle.player.life.investedRounds).toBe(0);
    expect(idle.player.life.financeSkill).toBe(0);

    let onOff = game('on-off');
    for (let i = 0; i < 6; i++) {
      const held = onOff.player.positions.fund_world;
      onOff = play(onOff, i % 2 === 0 ? buy : { orders: held ? [{ type: 'sell', assetId: 'fund_world', amount: held.value }] : [] }).state;
    }
    expect(onOff.player.life.investedRounds).toBe(3);
    expect(onOff.player.life.financeSkill).toBe(1);
  });

  it('does not rise past the top level', () => {
    let state = game('expert', { financeSkill: 2 });
    for (let i = 0; i < 4; i++) {
      const result = play(state, i === 0 ? buy : quiet);
      state = result.state;
      expect(kinds(result.events)).not.toContain('financeSkill');
    }
    expect(state.player.life.financeSkill).toBe(2);
  });
});

describe('end of round: bankruptcy and status items', () => {
  const broke = (watchValue: number): GameState =>
    withPlayer(
      content,
      createGame({ content, start: { ...fixtureStart(), salaryAnnual: 0, lifestyleTier: 3 } }, 'broke'),
      {
        debts: [{ id: 'debt-1', kind: 'creditCard', principal: 9_000_000, fixedRateBp: 0, roundsLeft: 0 }],
        nextId: 1,
      },
      {
        minLifestyleTier: 1,
        bonusStatus: 6,
        items: [
          { itemId: 'watch_gold', value: watchValue, roundsLeft: null, paid: 1_000_000, age: 0 },
          { itemId: 'club', value: 0, roundsLeft: null, paid: 50_000, age: 0 },
          { itemId: 'trip', value: 0, roundsLeft: 2, paid: 300_000, age: 0 },
        ],
        collection: ['watch_gold', 'club', 'trip'],
      },
    );

  it('sells status items at the fire-sale discount, cancels the rest and resets the lifestyle', () => {
    const start = broke(2_000_000);
    const { state, events } = play(start);
    const [now, after] = [start.timeline[0].priceLevel, start.timeline[1].priceLevel];
    const watch = Math.floor((Math.floor((2_000_000 * 10_300) / 10_000) * after) / now);
    // Living at the lavish tier 7,200,000, club upkeep 480,000 and card interest 3,960,000 all go on the card.
    expect(events).toContainEqual({ kind: 'bankrupt', proceeds: Math.round((watch * 7_000) / 10_000), debtsCleared: 20_640_000 });
    const p = state.player;
    expect(p.life.items).toEqual([]);
    expect(p.life.collection).toEqual(['watch_gold', 'club', 'trip']);
    expect(p.debts).toEqual([]);
    expect(p.lifestyleTier).toBe(1);
    expect(p.bankruptUntilRound).toBe(4);
    expect(p.extraExpensesAnnual).toBe(0);
    expect(p.statusPoints).toBe(6 + 2);
  });

  it('costs standing for good, by the amount the content sets', () => {
    const harsh = fixtureContent();
    harsh.debt.bankruptcyStatusPenalty = 5;
    const { state, events } = applyRound(harsh, broke(2_000_000), { orders: [] });
    expect(kinds(events)).toContain('bankrupt');
    expect(state.player.life.bonusStatus).toBe(1);
    expect(state.player.statusPoints).toBe(1 + 2);
    const again = applyRound(harsh, state, { orders: [] }).state;
    expect(again.player.life.bonusStatus).toBe(1);
  });

  it('never liquidates a player whose items are worth more than they owe', () => {
    const { state, events } = play(broke(40_000_000));
    expect(kinds(events)).not.toContain('bankrupt');
    expect(state.player.life.items).toHaveLength(3);
    expect(state.player.lifestyleTier).toBe(3);
    expect(state.player.debts[0].principal).toBe(20_640_000);
  });
});
