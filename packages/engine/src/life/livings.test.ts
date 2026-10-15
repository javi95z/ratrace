import { describe, expect, it } from 'vitest';
import { businessRound } from '../business';
import { incomeForRound } from '../economy';
import { optionBreaks, orderBreaks } from '../limits';
import { applyRound, createGame, previewRound } from '../game';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import { Rng, seedRng } from '../rng';
import type { CardDef, Content, GameState, LifeStart } from '../types';
import { drawHand } from './cards';
import { lodgerOf, ownPay, refreshDerived, statusParts, workModeOf } from './derive';
import { applyEffects } from './effects';
import { focusLock, focusTotal } from './orders';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 2 }, careerSkill: 10, financeSkill: 0, focus: 3 };
const start = (c: Content, life: Partial<LifeStart> = {}): GameState => createGame({ content: c, start: { ...fixtureStart(), cash: 200_000_00, life: { ...office, ...life } } }, 'livings');

describe('living from a business', () => {
  /** A game with a business that has made a good share of the pay two rounds running. */
  function strong(c: Content): GameState {
    const state = start(c);
    const { state: opened } = applyRound(c, state, { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 150_000_00 }] });
    opened.player.businesses[0].strong = c.life.fullTime.strongRounds;
    return opened;
  }

  it('may be done only once the business has shown it can pay', () => {
    const c = fixtureContent();
    const { state } = applyRound(c, start(c), { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 1_000_00 }] });
    const { rejected } = previewRound(c, state, { orders: [{ type: 'goFullTime', businessId: state.player.businesses[0].id }] });
    expect(rejected.map((r) => r.reason)).toEqual(['not-strong-enough']);
  });

  it('counts the rounds the business made a good share of the pay', () => {
    const c = fixtureContent();
    c.life.fullTime.strongPct = 0;
    const { state } = applyRound(c, start(c), { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 1_000_00 }] });
    expect(state.player.businesses[0].strong).toBe(1);
    c.life.fullTime.strongPct = 100_000;
    const { state: later } = applyRound(c, state, { orders: [] });
    expect(later.player.businesses[0].strong).toBe(0);
  });

  it('leaves the job for it: no pay, more profit, no manager, a point of focus, and the standing of its size', () => {
    const c = fixtureContent();
    const state = strong(c);
    const business = state.player.businesses[0];
    const world = state.timeline[state.round];
    const before = businessRound({ ...business, manager: false, tended: true }, c, world).profit;
    const focus = focusTotal(state.player);
    const { player, rejected } = previewRound(c, state, { orders: [{ type: 'goFullTime', businessId: business.id }] });
    expect(rejected).toEqual([]);
    expect(player.life.career).toBeNull();
    expect(player.life.formerCareer).toEqual({ id: 'office', level: 2 });
    expect(ownPay(player, c)).toBe(0);
    expect(focusTotal(player)).toBe(focus + c.life.fullTime.focus);
    const run = player.businesses[0];
    expect(run.fullTime).toBe(true);
    expect(businessRound(run, c, world).profit).toBe(Math.floor((before * c.life.fullTime.profitPct) / 100));
    expect(statusParts(player, c, state.round).job).toBe(5);
  });

  it('can go back to work, a rung lower', () => {
    const c = fixtureContent();
    const state = strong(c);
    const { state: own } = applyRound(c, state, { orders: [{ type: 'goFullTime', businessId: state.player.businesses[0].id }] });
    const { player } = previewRound(c, own, { orders: [{ type: 'backToWork' }] });
    expect(player.life.career).toEqual({ id: 'office', level: 1 });
    expect(player.businesses[0].fullTime).toBe(false);
    expect(previewRound(c, start(c), { orders: [{ type: 'backToWork' }] }).rejected.map((r) => r.reason)).toEqual(['no-former-job']);
  });
});

describe('a lodger', () => {
  it('pays a share of the home’s rent, as rent, and the home counts for less', () => {
    const c = fixtureContent();
    const state = start(c, { properties: [{ typeId: 'flat', rented: false }] });
    const flat = c.propertyTypes.find((type) => type.id === 'flat');
    if (flat) (flat as { spareRoom?: boolean }).spareRoom = true;
    const world = state.timeline[state.round];
    const rent = incomeForRound(state.player, c, world).rent;
    const home = statusParts(state.player, c, state.round).home;
    const { player, rejected } = previewRound(c, state, { orders: [{ type: 'setLodger', on: true }] });
    expect(rejected).toEqual([]);
    expect(lodgerOf(player, c)).toBe(true);
    expect(incomeForRound(player, c, world).rent).toBeGreaterThan(rent);
    expect(statusParts(player, c, state.round).home).toBe(home - c.life.lodger.statusLost);
  });

  it('needs a home of one’s own with a room to spare', () => {
    const c = fixtureContent();
    const { rejected } = previewRound(c, start(c, { properties: [{ typeId: 'studio', rented: false }] }), { orders: [{ type: 'setLodger', on: true }] });
    expect(rejected.map((r) => r.reason)).toEqual(['no-spare-room']);
  });
});

describe('cards about the new ways of living', () => {
  it('a new job leaves no room to hunt for the next one straight away', () => {
    const c = fixtureContent();
    c.life.focusLimits.huntRestRounds = 1;
    const state = start(c);
    applyEffects(state.player, { job: { career: 'office', level: 0 } }, { content: c, world: state.timeline[0], round: 0 });
    expect(focusLock(state.player, 'jobHunt', c)).toBe('hunt-resting');
  });

  it('the boss’s yes to home works at any rung, and the lodger can be shown the door', () => {
    const c = fixtureContent();
    const state = start(c, { career: { id: 'office', level: 0 }, careerSkill: 0, properties: [{ typeId: 'flat', rented: false }] });
    const flat = c.propertyTypes.find((type) => type.id === 'flat');
    if (flat) (flat as { spareRoom?: boolean }).spareRoom = true;
    const p = state.player;
    const focus = focusTotal(p);
    applyEffects(p, { setFlags: ['remote_work'], workMode: 'remote' }, { content: c, world: state.timeline[0], round: 0 });
    expect(workModeOf(p, c)).toBe('remote');
    expect(focusTotal(p)).toBe(focus + 1);
    p.life.lodger = true;
    expect(lodgerOf(p, c)).toBe(true);
    applyEffects(p, { endLodger: true }, { content: c, world: state.timeline[0], round: 0 });
    expect(lodgerOf(p, c)).toBe(false);
  });
});

describe('a card that sells something', () => {
  it('is never dealt to someone who already owns it', () => {
    const c = fixtureContent();
    const itemId = c.items[0].id;
    const offer: CardDef = { id: 'offer', category: 'lifestyle', weight: 1_000, cooldown: 0, options: [{}, { effects: { buyItem: { itemId, pricePct: 80 } } }] };
    c.cards = [...c.cards, offer];
    const state = start(c);
    const hand = () => {
      state.player.life.seen = {};
      return drawHand(state, c, new Rng(seedRng('offer', 'cards')));
    };
    expect(hand()).toContain('offer');
    state.player.life.items.push({ itemId, value: 0, paid: 0, age: 0, roundsLeft: null });
    expect(hand()).not.toContain('offer');
  });
});

describe('coming home', () => {
  it('with little to show: the family carries you back for nothing and puts you up; no rung lost, old friends found', () => {
    const c = fixtureContent();
    const state = start(c, { career: { id: 'office', level: 2 } });
    state.player.cash = 1_000_00;
    const away = c.cities.find((city) => city.id !== state.player.cityId);
    if (!away) throw new Error('needs a second city');
    state.player.life.homeCityId = state.player.cityId;
    state.player.cityId = away.id;
    refreshDerived(state.player, c, state.round);
    const network = state.player.life.skills.network;
    const { state: after, events } = applyRound(c, state, { orders: [{ type: 'moveCity', cityId: state.player.life.homeCityId }] });
    expect(after.player.cityId).toBe(after.player.life.homeCityId);
    expect(after.player.life.career?.level).toBe(2);
    expect(after.player.life.skills.network).toBeGreaterThan(network);
    const back = events.find((event) => event.kind === 'homecoming');
    expect(back).toMatchObject({ kind: 'homecoming', triumphant: false });
    expect(back && 'gift' in back && back.gift).toBeGreaterThan(0);
  });

  it('richer than when you left: a triumph, once', () => {
    const c = fixtureContent();
    const state = start(c);
    const away = c.cities.find((city) => city.id !== state.player.cityId);
    if (!away) throw new Error('needs a second city');
    const home = state.player.cityId;
    const { state: gone } = applyRound(c, state, { orders: [{ type: 'moveCity', cityId: away.id }] });
    expect(gone.player.life.leftHomeWorth).not.toBeNull();
    gone.player.cash += 500_000_00;
    const status = gone.player.life.bonusStatus;
    const { events, state: back } = applyRound(c, gone, { orders: [{ type: 'moveCity', cityId: home }] });
    expect(events).toContainEqual({ kind: 'homecoming', gift: 0, triumphant: true });
    expect(back.player.life.bonusStatus).toBe(status + c.life.homecoming.status);
  });
});

describe('a tax residency', () => {
  it('in a city that offers one: dividends earned abroad pay its rate, for a fee a year, and it ends with a move', () => {
    const c = fixtureContent();
    const city = c.cities[0];
    (city as { residency?: { feeAnnual: number; dividendBp: number } }).residency = { feeAnnual: 1_000_00, dividendBp: 0 };
    const state = start(c);
    state.player.cityId = city.id;
    refreshDerived(state.player, c, 0);
    const expenses = state.player.extraExpensesAnnual;
    const { player, rejected } = previewRound(c, state, { orders: [{ type: 'setResidency', on: true }] });
    expect(rejected).toEqual([]);
    expect(player.life.residency).toBe(true);
    expect(player.extraExpensesAnnual).toBe(expenses + 1_000_00);
    const other = c.cities.find((x) => x.id !== city.id);
    if (!other) throw new Error('needs a second city');
    const elsewhere = start(c);
    elsewhere.player.cityId = other.id;
    refreshDerived(elsewhere.player, c, 0);
    expect(previewRound(c, elsewhere, { orders: [{ type: 'setResidency', on: true }] }).rejected.map((r) => r.reason)).toEqual(['no-residency']);
  });
});

describe('a card with one open choice', () => {
  it('is not dealt where the content asks for choices', () => {
    const c = fixtureContent();
    c.life.dealOnlyChoices = true;
    const lonely: CardDef = { id: 'lonely', category: 'lifestyle', weight: 1_000, cooldown: 0, options: [{}, { when: { minNetWorth: 999_999_999_00 }, effects: {} }] };
    c.cards = [...c.cards, lonely];
    const state = start(c);
    state.player.life.seen = {};
    expect(drawHand(state, c, new Rng(seedRng('lonely', 'cards')))).not.toContain('lonely');
    c.life.dealOnlyChoices = false;
    state.player.life.seen = {};
    expect(drawHand(state, c, new Rng(seedRng('lonely', 'cards')))).toContain('lonely');
  });
});

describe('a new business', () => {
  it('starts slowly, and may not see its second round: what is left of it is sold for parts', () => {
    const c = fixtureContent();
    c.business.rampPct = [50, 75];
    const fresh = { id: 'b', typeId: 'stall', capital: 50_000_00, basis: 50_000_00, payoutPct: 50, manager: false, tended: true };
    const world = start(c).timeline[0];
    const grown = businessRound(fresh, c, world).profit;
    expect(businessRound({ ...fresh, age: 0 }, c, world).profit).toBe(Math.floor((grown * 50) / 100));
    expect(businessRound({ ...fresh, age: 1 }, c, world).profit).toBe(Math.floor((grown * 75) / 100));
    (c.business.types[0] as { failPct: number }).failPct = 100;
    const { state, events } = applyRound(c, start(c), { orders: [{ type: 'startBusiness', typeId: 'stall', capital: 10_000_00 }] });
    expect(state.player.businesses).toEqual([]);
    expect(events).toContainEqual({ kind: 'businessFailed', typeId: 'stall', recovered: 4_000_00 });
  });
});

describe('the limits of the new challenge rules', () => {
  it('forbid what each says, by order and through a card', () => {
    expect(orderBreaks({ type: 'startBusiness', typeId: 'stall', capital: 1 }, { noBusiness: true })).toBe(true);
    expect(orderBreaks({ type: 'setLifestyle', tier: 2 }, { maxLifestyleTier: 1 })).toBe(true);
    expect(orderBreaks({ type: 'setLifestyle', tier: 1 }, { maxLifestyleTier: 1 })).toBe(false);
    expect(orderBreaks({ type: 'buyItem', itemId: 'x' }, { noItems: true })).toBe(true);
    expect(orderBreaks({ type: 'setEvasion', blackPct: 25 }, { noEvasion: true })).toBe(true);
    expect(orderBreaks({ type: 'setEvasion', blackPct: 0 }, { noEvasion: true })).toBe(false);
    expect(optionBreaks({ effects: { buyItem: { itemId: 'x', pricePct: 80 } } }, { noItems: true })).toBe(true);
    expect(optionBreaks({ effects: { suspicion: 10 } }, { noEvasion: true })).toBe(true);
  });
});
