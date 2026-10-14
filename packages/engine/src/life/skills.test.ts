import { describe, expect, it } from 'vitest';
import { businessRound, businessSalePrice } from '../business';
import { applyRound, createGame } from '../game';
import { findInvariantBreaks } from '../invariants';
import { quoteBusinesses, quoteMove, quoteSkills, quoteWork } from '../quotes';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { withPlayer } from '../testing/patch';
import type { CardDef, Content, GameEvent, GameState, LifeStart, Order, SkillId } from '../types';
import { validateContent, validateStart } from '../validate';
import { viewOf } from '../view';
import { conditionHolds } from './conditions';
import { deriveExpenses, deriveStatus, focusBonusOf } from './derive';
import { optionLock } from './cards';
import { applyEffects } from './effects';
import { levelOfPoints, skillLevel } from './skills';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

/** The fixture with every skill worth something, and living teaching a point a round. */
function contentWith(change: (c: Content) => void = () => {}): Content {
  const content = fixtureContent();
  Object.assign(content.life.skills, {
    practicePoints: 1,
    practiceCareers: { negotiation: ['office'] },
    practiceItems: { health: ['club'] },
    negotiationHuntRaisePct: 1,
    negotiationPromotionPct: 2,
    negotiationSalePct: 4,
    languagesMoveOffPct: 15,
    languagesKeepRungFrom: 2,
    languagesPartnerFrom: 3,
    networkHuntPct: 8,
    networkStatus: 2,
    managementProfitPct: 6,
    managementManagerOffPct: 4,
    managementExtraFrom: 3,
    healthPremiumOffPct: 20,
    healthFocusFrom: 3,
  });
  change(content);
  return content;
}

const game = (content: Content, life: Partial<LifeStart> = {}): GameState =>
  createGame({ content, start: { ...fixtureStart(), cash: 50_000_000, life: { ...office, ...life } } }, 'skills');
/** Points that put a skill at a level, by the fixture's thresholds of 3, 6 and 9. */
const at = (level: 0 | 1 | 2 | 3) => [0, 3, 6, 9][level];
const skilled = (content: Content, state: GameState, skills: Partial<Record<SkillId, number>>) =>
  withPlayer(content, state, {}, { skills: { ...state.player.life.skills, ...skills } });
const focus = (action: Extract<Order, { type: 'focus' }>['action']): Order => ({ type: 'focus', action });
const skillEvents = (events: GameEvent[]) => events.filter((e) => e.kind === 'skill');

describe('learning a skill', () => {
  it('counts levels from the points, at the thresholds of the rules', () => {
    const content = fixtureContent();
    expect([0, 2, 3, 5, 6, 8, 9, 40].map((points) => levelOfPoints(points, content))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('starts a life with the skills it brings, and none of the others', () => {
    const content = fixtureContent();
    const state = game(content, { skills: { languages: 5 } });
    expect(state.player.life.skills).toEqual({ negotiation: 0, languages: 5, network: 0, management: 0, health: 0 });
    expect(state.player.life.homeCityId).toBe(state.player.cityId);
    expect(findInvariantBreaks(content, state)).toEqual([]);
    expect(validateStart(content, { ...fixtureStart(), life: { ...office, skills: { charm: 3 } as never } })).toContain('life.skills names an unknown skill: charm');
  });

  it('takes a point of focus to study, says so when a level is reached, and needs no job for it', () => {
    const content = fixtureContent();
    // A round of study is two points: short of a level from nothing, a level from one point in.
    const once = applyRound(content, game(content), { orders: [focus('studyNegotiation')] });
    expect(once.state.player.life.skills.negotiation).toBe(2);
    expect(skillEvents(once.events)).toEqual([]);
    const studied = applyRound(content, skilled(content, game(content), { negotiation: 1, health: 1 }), { orders: [focus('studyNegotiation'), focus('exercise')] });
    expect(studied.state.player.life.skills).toMatchObject({ negotiation: 3, health: 3, languages: 0 });
    expect(skillEvents(studied.events)).toEqual([
      { kind: 'skill', skill: 'negotiation', level: 1 },
      { kind: 'skill', skill: 'health', level: 1 },
    ]);
    const jobless = withPlayer(content, game(content), {}, { career: null });
    const alone = applyRound(content, jobless, { orders: [focus('studyLanguages'), focus('overtime')] });
    expect(alone.state.player.life.skills.languages).toBe(2);
    expect(alone.events).toContainEqual(expect.objectContaining({ kind: 'orderRejected', reason: 'no-job' }));
  });

  it('teaches money sense on a course too, with no job needed: two rounds of it open the first level', () => {
    const content = fixtureContent();
    const jobless = withPlayer(content, game(content), {}, { career: null });
    const once = applyRound(content, jobless, { orders: [focus('studyFinance')] });
    expect(once.state.player.life).toMatchObject({ financePoints: 2, financeSkill: 0 });
    const twice = applyRound(content, once.state, { orders: [focus('studyFinance')] });
    expect(twice.state.player.life).toMatchObject({ financePoints: 4, financeSkill: 1 });
    expect(twice.events).toContainEqual({ kind: 'financeSkill', level: 1 });
  });

  it("is learnt by living it too: a trade, a job hunt, a city not one's own, a club, a gym", () => {
    const content = contentWith();
    // The office is a trade of negotiation; the fixture's start is a modest life in the home city.
    const plain = applyRound(content, game(content), { orders: [] });
    expect(plain.state.player.life.skills).toEqual({ negotiation: 1, languages: 0, network: 0, management: 0, health: 0 });
    const club = { itemId: 'club', value: 0, roundsLeft: null, paid: 0, age: 0 };
    const abroad = withPlayer(content, game(content), { cityId: 'haven' }, { items: [club], collection: ['club'] });
    expect(applyRound(content, abroad, { orders: [] }).state.player.life.skills).toMatchObject({ languages: 1, network: 1, health: 1 });
    // Study and living add up.
    expect(applyRound(content, abroad, { orders: [focus('studyLanguages')] }).state.player.life.skills.languages).toBe(3);
  });

  it('is learnt in management only by running a business: as much as study by its owner, a little with a manager', () => {
    const content = contentWith();
    const owner = applyRound(content, game(content), { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 200_000 }] });
    expect(owner.state.player.life.skills.management).toBe(2);
    const id = owner.state.player.businesses[0].id;
    const managed = applyRound(content, owner.state, { orders: [{ type: 'setBusiness', businessId: id, manager: true }] });
    expect(managed.state.player.life.skills.management).toBe(3);
  });

  it('can be given by a card, and asked of by one', () => {
    const content = fixtureContent();
    const state = game(content);
    const p = structuredClone(state.player);
    const situation = { content, world: state.timeline[0], round: 0 };
    applyEffects(p, { skills: { network: 6 } }, situation);
    expect(p.life.skills.network).toBe(6);
    expect(conditionHolds({ minSkills: { network: 2 } }, p, situation)).toBe(true);
    expect(conditionHolds({ minSkills: { network: 3 } }, p, situation)).toBe(false);
  });

  it('tells an option locked only by a skill apart from one locked by anything else', () => {
    const content = fixtureContent();
    const state = game(content);
    const situation = { content, world: state.timeline[0], round: 0 };
    const card = { id: 'ask', category: 'career', options: [{}, { when: { minSkills: { negotiation: 2 } } }, { when: { minSkills: { negotiation: 2 }, partner: true } }] } as unknown as CardDef;
    expect([1, 2].map((i) => optionLock(state.player, card, i, situation))).toEqual(['skill', 'condition']);
    const able = skilled(content, state, { negotiation: at(2) });
    expect(optionLock(able.player, card, 1, situation)).toBeNull();
  });

  it('is quoted with where it stands, what study gives and what life as it is teaches', () => {
    const content = contentWith();
    const state = skilled(content, game(content), { negotiation: 3 });
    const quote = quoteSkills(content, viewOf(state));
    expect(quote.skills.find((s) => s.skill === 'negotiation')).toEqual({ skill: 'negotiation', points: 3, level: 1, from: 3, next: 6, study: 'studyNegotiation', studyPoints: 2, practice: 1 });
    expect(quote.skills.find((s) => s.skill === 'management')).toMatchObject({ study: null, practice: 0, from: 0, next: 3 });
    // Money sense on the same steps; a level given by a card is counted from where it begins.
    expect(quote.finance).toEqual({ level: 0, points: 0, from: 0, next: 3, practice: 0, study: 'studyFinance', studyPoints: 2 });
    const taught = quoteSkills(content, viewOf(withPlayer(content, state, {}, { financeSkill: 2, financePoints: 1 })));
    expect(taught.finance).toEqual({ level: 2, points: 6, from: 6, next: 9, practice: 0, study: 'studyFinance', studyPoints: 2 });
  });

  it('keeps the rules honest', () => {
    const content = fixtureContent();
    content.life.skills.levelPoints = [3, 3, 9];
    content.life.skills.practiceCareers = { network: ['astronaut'] };
    expect(validateContent(content)).toEqual(expect.arrayContaining([
      'life.skills.levelPoints must be three rising positive whole numbers',
      'life.skills.practiceCareers names an unknown career: astronaut',
    ]));
  });
});

describe('what a skill does', () => {
  it('negotiation: a bigger raise from a job hunt and at each promotion, and more for a business sold', () => {
    const content = contentWith((c) => (c.life.jobHuntChancePct = 100));
    const state = skilled(content, game(content), { negotiation: at(2) });
    expect(quoteWork(content, viewOf(state))).toMatchObject({ jobHuntRaisePct: content.life.jobHuntRaisePct + 2, promotionRaisePct: 4 });
    const hunted = applyRound(content, state, { orders: [focus('jobHunt')] });
    expect(hunted.state.player.life.salaryModPct).toBe(content.life.jobHuntRaisePct + 2);
    const promoted = applyRound(content, withPlayer(content, state, {}, { careerSkill: 3 }), { orders: [] });
    expect(promoted.events).toContainEqual({ kind: 'promoted', careerId: 'office', level: 1 });
    expect(promoted.state.player.life.salaryModPct).toBe(4);
    const business = { id: 'b', typeId: 'stall', capital: 1_000_000, basis: 1_000_000, payoutPct: 50, manager: false, tended: true };
    const world = { ...state.timeline[0], regime: 'recession' as const };
    expect(businessSalePrice(business, content, world, 2)).toBe(780_000);
    // Never more than is in it.
    expect(businessSalePrice(business, content, { ...world, regime: 'boom' }, 3)).toBe(1_000_000);
  });

  it('languages: a cheaper move, then one that costs no rung, then one a partner settles into at once', () => {
    const content = contentWith((c) => {
      c.life.moveRungsLost = 1;
      c.life.partnerSettlingRounds = 1;
    });
    const senior = withPlayer(content, game(content, { career: { id: 'office', level: 2 }, careerSkill: 10 }), {}, { partner: true, partnerSalaryPct: 50 });
    const none = quoteMove(content, viewOf(senior), 'haven');
    const one = quoteMove(content, viewOf(skilled(content, senior, { languages: at(1) })), 'haven');
    const two = quoteMove(content, viewOf(skilled(content, senior, { languages: at(2) })), 'haven');
    const three = quoteMove(content, viewOf(skilled(content, senior, { languages: at(3) })), 'haven');
    expect(one.cost).toBe(Math.floor((none.cost * 85) / 100));
    expect([none.rungsLost, one.rungsLost, two.rungsLost, three.rungsLost]).toEqual([1, 1, 0, 0]);
    expect([two.partnerIdleRounds, three.partnerIdleRounds]).toEqual([1, 0]);
  });

  it('network: a better chance at a job hunt, and status', () => {
    const content = contentWith();
    const state = game(content);
    const known = skilled(content, state, { network: at(3) });
    expect(quoteWork(content, viewOf(known)).jobHuntChancePct).toBe(content.life.jobHuntChancePct + 24);
    expect(deriveStatus(known.player, content, 0) - deriveStatus(state.player, content, 0)).toBe(6);
  });

  it('management: more from a business run, a cheaper manager, and from the top a business more', () => {
    const content = contentWith();
    const business = { id: 'b', typeId: 'stall', capital: 1_000_000, basis: 1_000_000, payoutPct: 50, manager: false, tended: true };
    const world = game(content).timeline[0];
    const plain = businessRound(business, content, world, 0).profit;
    expect(businessRound(business, content, world, 2).profit).toBe(Math.floor((plain * 112) / 100));
    const opened = applyRound(content, skilled(content, game(content), { management: at(3) }), {
      orders: [
        { type: 'startBusiness', typeId: 'stall', capital: 200_000 },
      ],
    });
    const quote = quoteBusinesses(content, viewOf(opened.state));
    expect(quote.max).toBe(content.business.maxBusinesses + 1);
    expect(quote.owned[0].managerPct).toBe(40 - 12);
    expect(findInvariantBreaks(content, opened.state)).toEqual([]);
  });

  it('health: cheaper health insurance, and at the top a point of focus more', () => {
    const content = contentWith();
    const insured = withPlayer(content, game(content), {}, { insurance: { health: true, home: false, life: false, liability: false } });
    const fit = skilled(content, insured, { health: at(3) });
    const premium = deriveExpenses(insured.player, content);
    expect(deriveExpenses(fit.player, content)).toBe(Math.floor((premium * 40) / 100));
    expect(focusBonusOf(fit.player, content) - focusBonusOf(insured.player, content)).toBe(1);
    expect(skillLevel(fit.player, 'health', content)).toBe(3);
  });
});
