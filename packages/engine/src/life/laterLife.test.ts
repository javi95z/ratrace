import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { applyBp, mulDiv } from '../money';
import { quoteLiving, quoteWork } from '../quotes';
import { indexed, PRICE_LEVEL_START } from '../rates';
import { wealthPoints } from '../scoring';
import { realNetWorth, scoreBreakdown } from '../selectors';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { CardDef, Content, GameEvent, GameState, LifeStart, Order } from '../types';
import { validateContent } from '../validate';
import { viewOf } from '../view';
import { weightOf } from './cards';
import { focusBonusOf, insurancePremium, statusParts } from './derive';
import { applyEffects } from './effects';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 1 }, careerSkill: 4, financeSkill: 0, focus: 3 };

/** The fixture with the rules of the end of a working life switched on, in small round numbers. */
function laterRules(change: (c: Content) => void = () => {}): Content {
  const c = fixtureContent();
  c.life.retireFromRound = 2;
  c.life.retiredFocus = 2;
  c.life.retiredStatus = 5;
  c.life.giftTaxPct = 10;
  c.life.riskByAge = {
    health: [
      { fromRound: 0, pct: 100 },
      { fromRound: 3, pct: 200 },
    ],
    job: [
      { fromRound: 0, pct: 100 },
      { fromRound: 2, pct: 150 },
    ],
  };
  c.life.healthPremiumByAge = [
    { fromRound: 0, pct: 100 },
    { fromRound: 2, pct: 150 },
  ];
  c.life.skills.healthRiskOffPct = 20;
  c.life.skills.jobRiskOffPct = 25;
  c.life.skills.practiceCareers = { negotiation: ['office'] };
  change(c);
  return c;
}

const game = (content: Content, cash = 1_000_000, life: Partial<LifeStart> = {}): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash, life: { ...office, ...life } } }, 'later');
const situation = (content: Content, state: GameState) => ({ content, world: state.timeline[state.round], round: state.round });
const rejected = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
const play = (content: Content, state: GameState, orders: Order[] = []) => applyRound(content, state, { orders });
/** Plays empty rounds until the game is at a round. */
function reach(content: Content, state: GameState, round: number): GameState {
  let at = state;
  while (at.round < round) at = play(content, at).state;
  return at;
}

describe('the rules of the end of a working life', () => {
  it('are sound in the fixture, and refused when they make no sense', () => {
    expect(validateContent(laterRules())).toEqual([]);
    const broken = laterRules((c) => {
      c.life.riskByAge.health = [{ fromRound: 1, pct: 100 }];
      c.life.riskByAge.job = [
        { fromRound: 0, pct: 100 },
        { fromRound: 2, pct: 90 },
      ];
      c.life.healthPremiumByAge = [{ fromRound: 0, pct: 120 }];
      c.life.retireFromRound = c.rounds;
      c.life.giftTaxPct = 101;
      c.life.skills.jobRiskOffPct = -1;
    });
    expect(validateContent(broken)).toEqual(
      expect.arrayContaining([
        'life.riskByAge.health must be steps from round 0 at 100, later and never lower',
        'life.riskByAge.job must be steps from round 0 at 100, later and never lower',
        'life.healthPremiumByAge must be steps from round 0 at 100, later and never lower',
        'life.retireFromRound must be a round of the game',
        'life.giftTaxPct must be a whole number from 0 to 100',
        'life.skills.jobRiskOffPct must be a non-negative whole number',
      ]),
    );
  });

  it('refuses a card with an unknown risk, and a gift of nothing', () => {
    const content = laterRules((c) => {
      c.cards = [
        { id: 'odd', category: 'health', weight: 1, cooldown: 0, risk: 'luck' as never, options: [{}, { effects: { gift: {} } }] },
        { id: 'big', category: 'family', weight: 1, cooldown: 0, options: [{}, { effects: { gift: { liquidPct: 120 } } }] },
      ];
    });
    expect(validateContent(content)).toEqual(
      expect.arrayContaining([
        'card odd has an unknown risk: luck',
        'card odd option 1 gives nothing to the children',
        'card big option 1 gives a share of savings that is not a whole percentage from 1 to 100',
      ]),
    );
  });
});

describe('retiring', () => {
  it('is refused before the round the rules allow, and to someone with no career', () => {
    const content = laterRules();
    expect(rejected(play(content, game(content), [{ type: 'retire' }]).events)).toEqual(['too-young-to-retire']);
    const idle = withPlayer(content, reach(content, game(content), 2), {}, { career: null });
    expect(rejected(play(content, idle, [{ type: 'retire' }]).events)).toEqual(['no-job']);
  });

  it('ends the career for good, and gives time and a standing of its own while no career is taken up', () => {
    const content = laterRules();
    const before = reach(content, game(content), 2);
    expect(quoteWork(content, viewOf(before)).retirement).toEqual({ fromRound: 2, open: true, retired: false, focus: 2, status: 5 });
    const { state, events } = play(content, before, [{ type: 'retire' }]);
    expect(rejected(events)).toEqual([]);
    expect(state.player.life.career).toBeNull();
    expect(state.player.life.retiredAtRound).toBe(2);
    // The round of the retirement pays no salary: the pay ends with the job.
    expect(events.some((e) => e.kind === 'ledger' && e.line === 'salary' && e.amount > 0)).toBe(false);
    expect(focusBonusOf(state.player, content)).toBe(2);
    expect(statusParts(state.player, content, state.round).job).toBe(5);
    expect(quoteWork(content, viewOf(state)).retirement).toEqual({ fromRound: 2, open: false, retired: true, focus: 2, status: 5 });
    expect(findInvariantBreaks(content, state)).toEqual([]);

    // A career taken up again is a working life again: the time and the standing of retirement go.
    const back = structuredClone(state);
    applyEffects(back.player, { job: { career: 'office', level: 0 } }, situation(content, back));
    expect(focusBonusOf(back.player, content)).toBe(0);
    expect(statusParts(back.player, content, back.round).job).toBe(0);
  });

  it('is what a card that retires the player does, paid on the salary before it ends', () => {
    const content = laterRules();
    const state = reach(content, game(content), 2);
    const p = structuredClone(state.player);
    const salary = indexed(p.salaryAnnual, state.timeline[state.round]);
    applyEffects(p, { retire: true, cashSalaryPct: 100 }, situation(content, state));
    expect(p.cash - state.player.cash).toBe(salary);
    expect(p.life.career).toBeNull();
    expect(p.life.retiredAtRound).toBe(2);
    // Someone with no career has nothing to retire from.
    const idle = structuredClone(state.player);
    idle.life.career = null;
    applyEffects(idle, { retire: true }, situation(content, state));
    expect(idle.life.retiredAtRound).toBeNull();
  });
});

describe('giving to the children in life', () => {
  it('takes a share of cash and savings, cash first, and keeps what is left after the tax in the dollars of the start', () => {
    const content = laterRules();
    const state = reach(content, game(content, 100_000), 2);
    const p = structuredClone(state.player);
    p.cash = 100_000;
    p.deposit = 50_000;
    applyEffects(p, { gift: { liquidPct: 80 } }, situation(content, state));
    // 80 % of 150,000 is 120,000: all the cash and 20,000 of the savings.
    expect(p.cash).toBe(0);
    expect(p.deposit).toBe(30_000);
    expect(p.life.legacy).toBe(mulDiv(108_000, PRICE_LEVEL_START, state.timeline[state.round].priceLevel));
  });

  it('gives from savings alone when the cash is short, and every business at what is in it', () => {
    const content = laterRules();
    const state = game(content);
    const p = structuredClone(state.player);
    p.cash = -5_000;
    p.deposit = 40_000;
    p.businesses = [{ id: 'b1', typeId: 'stall', capital: 60_000, basis: 60_000, payoutPct: 50, manager: false, tended: false }];
    applyEffects(p, { gift: { liquidPct: 50, businesses: true } }, situation(content, state));
    expect(p.cash).toBe(-5_000);
    expect(p.deposit).toBe(20_000);
    expect(p.businesses).toEqual([]);
    // At the prices of the start, what is given less a tenth is kept as it is.
    expect(p.life.legacy).toBe(72_000);
  });

  it('counts what was given towards the score, as the family is still the player’s', () => {
    const content = laterRules();
    const state = withPlayer(content, game(content), {}, { legacy: 5_000_000 });
    const view = viewOf(state);
    expect(scoreBreakdown(content, view).wealth).toBe(wealthPoints(realNetWorth(view) + 5_000_000, content.scoring.wealthBreakpoints));
    expect(findInvariantBreaks(content, state)).toEqual([]);
  });
});

describe('health cover by age', () => {
  /** The health premium of the fixture's home city at the start, before age. */
  const base = (content: Content) => applyBp(content.cities[0].livingCostAnnual, content.life.insurancePremiumBp.health);

  it('keeps the premium of the age it was taken out at, and charges a later age for cover taken out again', () => {
    const content = laterRules();
    const young = play(content, game(content), [{ type: 'setInsurance', insurance: 'health', on: true }]).state;
    expect(young.player.life.healthCoverSince).toBe(0);
    const later = reach(content, young, 2);
    // Kept: still the premium of the start.
    expect(insurancePremium(later.player, content, 'health', later.player.life.healthCoverSince ?? 0)).toBe(base(content));
    expect(quoteLiving(content, viewOf(later)).insurance.health).toBe(indexed(base(content), later.timeline[later.round]));
    const dropped = play(content, later, [{ type: 'setInsurance', insurance: 'health', on: false }]).state;
    expect(dropped.player.life.healthCoverSince).toBeNull();
    // Not held: a quote is what cover taken out now would cost, at the dearer age.
    expect(quoteLiving(content, viewOf(dropped)).insurance.health).toBe(indexed(mulDiv(base(content), 150, 100), dropped.timeline[dropped.round]));
    const again = play(content, dropped, [{ type: 'setInsurance', insurance: 'health', on: true }]).state;
    expect(again.player.life.healthCoverSince).toBe(3);
    expect(findInvariantBreaks(content, again)).toEqual([]);
  });

  it('says when cover gets dearer, and stops saying it once no dearer step is left', () => {
    const content = laterRules();
    expect(quoteLiving(content, viewOf(game(content))).health).toEqual({ since: null, dearerFrom: { fromRound: 2, pct: 150 }, refused: false });
    expect(quoteLiving(content, viewOf(reach(content, game(content), 2))).health.dearerFrom).toBeNull();
  });

  it('is refused after a serious illness, while other cover and cover already held are not', () => {
    const content = laterRules();
    const ill = withPlayer(content, game(content), {}, { flags: { had_illness: 0 } });
    expect(quoteLiving(content, viewOf(ill)).health.refused).toBe(true);
    const { state, events } = play(content, ill, [
      { type: 'setInsurance', insurance: 'health', on: true },
      { type: 'setInsurance', insurance: 'home', on: true },
    ]);
    expect(rejected(events)).toEqual(['preexisting-condition']);
    expect(state.player.life.insurance).toMatchObject({ health: false, home: true });

    const covered = withPlayer(content, game(content), {}, { flags: { had_illness: 0 }, insurance: { health: true, home: false, life: false, liability: false }, healthCoverSince: 0 });
    expect(quoteLiving(content, viewOf(covered)).health.refused).toBe(false);
    const kept = play(content, covered, [{ type: 'setInsurance', insurance: 'health', on: true }]);
    expect(rejected(kept.events)).toEqual([]);
    expect(kept.state.player.life.healthCoverSince).toBe(0);
  });
});

describe('misfortunes that grow with age', () => {
  const card = (risk: CardDef['risk'], weight = 10): CardDef => ({ id: 'risky', category: 'health', weight, cooldown: 0, risk, options: [{}] });

  it('leaves a card that is no risk as it is', () => {
    const content = laterRules();
    const p = reach(content, game(content), 3).player;
    expect(weightOf(card(undefined), p, content, 3)).toBe(10);
  });

  it('makes a misfortune of the body likelier with age, and less likely with health', () => {
    const content = laterRules();
    const p = game(content).player;
    expect(weightOf(card('health'), p, content, 0)).toBe(10);
    expect(weightOf(card('health'), p, content, 3)).toBe(20);
    p.life.skills.health = 3;
    expect(weightOf(card('health'), p, content, 3)).toBe(16);
    p.life.skills.health = 9;
    expect(weightOf(card('health'), p, content, 3)).toBe(8);
    // Never ruled out altogether.
    expect(weightOf(card('health', 1), p, content, 0)).toBe(1);
  });

  it('makes a misfortune at work likelier with age, and less likely with the skills the career practises', () => {
    const content = laterRules();
    const p = game(content).player;
    expect(weightOf(card('job'), p, content, 2)).toBe(15);
    p.life.skills.negotiation = 3;
    expect(weightOf(card('job'), p, content, 2)).toBe(11);
    // A skill the career does not practise guards nothing at work.
    p.life.skills.negotiation = 0;
    p.life.skills.languages = 9;
    expect(weightOf(card('job'), p, content, 2)).toBe(15);
    // Nor does any skill without a career.
    p.life.skills.negotiation = 9;
    p.life.career = null;
    expect(weightOf(card('job'), p, content, 2)).toBe(15);
  });
});
