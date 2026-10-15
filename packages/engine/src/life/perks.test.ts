import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { executeOrder } from '../orders';
import { quoteMove, quoteWork } from '../quotes';
import { newTally } from '../tally';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { Content, GameState, ItemPerks, LifeStart, OwnedItem } from '../types';
import { validateContent } from '../validate';
import { viewOf } from '../view';
import { deriveSalary, ownPay, perksOf } from './derive';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

/** The fixture, with each thing in it good for something. */
function contentWith(perks: Record<string, ItemPerks>, change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  content.items = content.items.map((item) => (perks[item.id] ? { ...item, perks: perks[item.id] } : item));
  change(content);
  return content;
}

const game = (content: Content, cash = 50_000_000): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash, life: office } }, 'perks');
const owning = (...ids: string[]): OwnedItem[] => ids.map((itemId) => ({ itemId, value: 0, roundsLeft: itemId === 'trip' ? 2 : null, paid: 0, age: 0 }));
const holding = (content: Content, state: GameState, ...ids: string[]) => withPlayer(content, state, {}, { items: owning(...ids), collection: ids });

describe('what the things owned are good for', () => {
  it('counts the best of each perk within a ladder, and adds the ladders up', () => {
    const content = contentWith({
      car_basic: { moveCostOffPct: 30, jobHuntPct: 1 },
      car_sports: { moveCostOffPct: 20, jobHuntPct: 4 },
      watch_gold: { jobHuntPct: 8 },
      club: { salaryPct: 5 },
    });
    const none = game(content);
    expect(perksOf(none.player, content)).toEqual({ moveCostOffPct: 0, studySkill: 0, salaryPct: 0, jobHuntPct: 0, focus: 0, healthCoverOffPct: 0 });
    // Two cars: the better discount of the two and the better chance of the two, not their sum. The watch adds to it.
    const all = holding(content, none, 'car_basic', 'car_sports', 'watch_gold', 'club');
    expect(perksOf(all.player, content)).toEqual({ moveCostOffPct: 30, studySkill: 0, salaryPct: 5, jobHuntPct: 12, focus: 0, healthCoverOffPct: 0 });
    // A thing good for nothing changes nothing.
    expect(perksOf(holding(content, none, 'trip').player, content).focus).toBe(0);
  });

  it('pays more to someone whose things raise their pay, and stays in step with the life', () => {
    const content = contentWith({ watch_gold: { salaryPct: 10 } });
    const plain = game(content);
    const before = plain.player.salaryAnnual;
    const bought = applyRound(content, plain, { orders: [{ type: 'buyItem', itemId: 'watch_gold' }] }).state;
    expect(bought.player.salaryAnnual).toBe(deriveSalary(bought.player, content));
    expect(ownPay(bought.player, content)).toBe(Math.floor((before * 110) / 100));
    expect(findInvariantBreaks(content, bought)).toEqual([]);
    // Sold, the pay is what it was.
    const sold = applyRound(content, bought, { orders: [{ type: 'sellItem', itemId: 'watch_gold' }] }).state;
    expect(sold.player.salaryAnnual).toBe(before);
    // A partner's pay is theirs: no thing of the player's raises it.
    const couple = withPlayer(content, bought, {}, { partner: true, partnerSalaryPct: 50 });
    expect(couple.player.salaryAnnual - ownPay(couple.player, content)).toBe(withPlayer(content, plain, {}, { partner: true, partnerSalaryPct: 50 }).player.salaryAnnual - before);
  });

  it('moves a player with a car for less, by exactly what the quote says', () => {
    const content = contentWith({ car_basic: { moveCostOffPct: 30 } });
    const walker = game(content);
    const driver = holding(content, walker, 'car_basic');
    const full = quoteMove(content, viewOf(walker), 'haven').cost;
    const less = quoteMove(content, viewOf(driver), 'haven').cost;
    expect(less).toBe(Math.floor((full * 70) / 100));
    const order = (state: GameState) => {
      const p = structuredClone(state.player);
      expect(executeOrder(p, { type: 'moveCity', cityId: 'haven' }, { content, world: state.timeline[0], round: 0, tally: newTally(), limits: {} })).toBeNull();
      return state.player.cash - p.cash;
    };
    expect(order(driver)).toBe(less);
    expect(order(walker)).toBe(full);
    // No discount takes the cost below nothing.
    const free = contentWith({ car_basic: { moveCostOffPct: 100 } });
    expect(quoteMove(free, viewOf(holding(free, game(free), 'car_basic')), 'haven').cost).toBe(0);
  });

  it('teaches more to someone who studies with the right tool, and nothing more to someone who does not study', () => {
    const content = contentWith({ watch_gold: { studySkill: 2 } });
    const equipped = holding(content, game(content), 'watch_gold');
    const study = applyRound(content, equipped, { orders: [{ type: 'focus', action: 'studyCareer' }] }).state;
    expect(study.player.life.careerSkill).toBe(content.life.workSkill + content.life.studySkill + 2);
    expect(applyRound(content, equipped, { orders: [] }).state.player.life.careerSkill).toBe(content.life.workSkill);
    expect(quoteWork(content, viewOf(equipped))).toMatchObject({ workSkill: content.life.workSkill, studySkill: content.life.studySkill + 2 });
    expect(quoteWork(content, viewOf(game(content))).studySkill).toBe(content.life.studySkill);
  });

  it('makes a job hunt likelier by what the things add, never past certain, as the quote says', () => {
    const sure = contentWith({ watch_gold: { jobHuntPct: 100 } }, (c) => {
      c.life.jobHuntChancePct = 0;
    });
    const dressed = holding(sure, game(sure), 'watch_gold');
    expect(quoteWork(sure, viewOf(dressed)).jobHuntChancePct).toBe(100);
    expect(quoteWork(sure, viewOf(game(sure))).jobHuntChancePct).toBe(0);
    const hunt = { orders: [{ type: 'focus' as const, action: 'jobHunt' as const }] };
    // Certain with the watch, hopeless without it, whatever the dice.
    for (const seed of ['a', 'b', 'c', 'd']) {
      const base = createGame({ content: sure, start: { ...fixtureStart(), cash: 1_000_000, life: office } }, seed);
      expect(applyRound(sure, holding(sure, base, 'watch_gold'), hunt).events).toContainEqual({ kind: 'jobHunt', success: true });
      expect(applyRound(sure, base, hunt).events).toContainEqual({ kind: 'jobHunt', success: false });
    }
    const some = contentWith({ watch_gold: { jobHuntPct: 7 } });
    expect(quoteWork(some, viewOf(holding(some, game(some), 'watch_gold'))).jobHuntChancePct).toBe(some.life.jobHuntChancePct + 7);
  });

  it('gives a point of focus in the round after a long trip, and only in that one', () => {
    const content = contentWith({ trip: { focus: 1 } });
    const start = game(content);
    expect(quoteWork(content, viewOf(start)).focus).toEqual({ left: 3, total: 3, bonus: 0, lost: 0 });
    // Bought in a round, it gives nothing in it: the rest is felt afterwards.
    const one = applyRound(content, start, { orders: [{ type: 'buyItem', itemId: 'trip' }, { type: 'focus', action: 'studyCareer' }] }).state;
    expect(one.player.life.items.map((owned) => owned.itemId)).toEqual(['trip']);
    expect(quoteWork(content, viewOf(one)).focus).toEqual({ left: 4, total: 4, bonus: 1, lost: 0 });
    // All four can be spent, and a fifth cannot.
    const spent = applyRound(content, one, {
      orders: [{ type: 'focus', action: 'overtime' }, { type: 'focus', action: 'studyCareer' }, { type: 'focus', action: 'jobHunt' }, { type: 'moveCity', cityId: 'haven' }],
    });
    expect(spent.events.filter((e) => e.kind === 'orderRejected')).toEqual([]);
    expect(findInvariantBreaks(content, spent.state)).toEqual([]);
    // The trip has faded by then, and the focus is the player's own again.
    expect(spent.state.player.life.items).toEqual([]);
    expect(quoteWork(content, viewOf(spent.state)).focus).toEqual({ left: 3, total: 3, bonus: 0, lost: 0 });
  });

  it('shows the whole ladder at what each rung would pay this player today', () => {
    const content = contentWith({ watch_gold: { salaryPct: 10 } });
    const state = holding(content, game(content), 'watch_gold');
    const work = quoteWork(content, viewOf(state));
    expect(work.level).toBe(0);
    expect(work.ladder.map((rung) => [rung.level, rung.status, rung.minSkill])).toEqual([[0, 0, 0], [1, 3, 4], [2, 6, 10]]);
    // The rung held pays what the player is paid; the next pays what a promotion would, raise for raise.
    expect(work.ladder[0].payAnnual).toBe(work.payAnnual);
    const promoted = withPlayer(content, state, {}, { career: { id: 'office', level: 1 } });
    expect(work.ladder[1].payAnnual).toBe(quoteWork(content, viewOf(promoted)).payAnnual);
    expect(work.ladder[1].payAnnual).toBeGreaterThan(work.ladder[0].payAnnual);
    expect(work).toMatchObject({ overtimePct: 15, jobHuntRaisePct: content.life.jobHuntRaisePct, skill: 0 });
    // Without a career there is no ladder, and the pay is the player's own all the same.
    const jobless = withPlayer(content, state, {}, { career: null });
    expect(quoteWork(content, viewOf(jobless))).toMatchObject({ ladder: [], level: null, overtimePct: 0 });
  });

  it('refuses a perk the game does not know, or one that is not a whole share', () => {
    expect(validateContent(contentWith({ club: { salaryPct: 5 } }))).toEqual([]);
    expect(validateContent(contentWith({ club: { charm: 5 } as ItemPerks }))).toContain('item club has a perk the game does not know');
    expect(validateContent(contentWith({ club: { salaryPct: 2.5 } }))).toContain('item club needs each perk to be a whole number from 0 to 100');
    expect(validateContent(contentWith({ club: { jobHuntPct: 101 } }))).toContain('item club needs each perk to be a whole number from 0 to 100');
  });
});
