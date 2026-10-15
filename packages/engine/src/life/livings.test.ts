import { describe, expect, it } from 'vitest';
import { businessRound } from '../business';
import { incomeForRound } from '../economy';
import { applyRound, createGame, previewRound } from '../game';
import { cityOf } from '../lookup';
import { fixtureContent, fixtureStart } from '../testing/fixture';
import type { Content, GameState, LifeStart } from '../types';
import { validateContent } from '../validate';
import { lodgerOf, ownPay, statusParts } from './derive';
import { focusTotal } from './orders';

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

describe('making something', () => {
  it('takes two points of focus, comes out when the round ends, and pays less every round', () => {
    const c = fixtureContent();
    c.life.works.weights = { flop: 0, modest: 0, hit: 1 };
    const state = start(c);
    const { state: after, events } = applyRound(c, state, { orders: [{ type: 'focus', action: 'createWork' }] });
    const median = cityOf(c, 'home').medianSalaryAnnual;
    const first = Math.floor((median * c.life.works.payPct.hit) / 100);
    expect(events.find((e) => e.kind === 'work')).toMatchObject({ kind: 'work', tier: 'hit' });
    expect(after.player.life.works).toEqual([{ tier: 'hit', annual: first, round: 0 }]);
    expect(after.player.extraPassiveAnnual).toBe(first);
    const { state: later } = applyRound(c, after, { orders: [] });
    expect(later.player.life.works[0].annual).toBe(Math.floor((first * (100 - c.life.works.fadePct)) / 100));
  });

  it('needs the focus for it', () => {
    const c = fixtureContent();
    const { rejected } = previewRound(c, start(c, { focus: 1 }), { orders: [{ type: 'focus', action: 'createWork' }] });
    expect(rejected.map((r) => r.reason)).toEqual(['no-focus']);
  });

  it('sells the rights to all of it for some years of what it pays', () => {
    const c = fixtureContent();
    const state = start(c);
    state.player.life.works = [{ tier: 'modest', annual: 1_000_00, round: 0 }];
    state.player.extraPassiveAnnual = 1_000_00;
    const cash = state.player.cash;
    const { player } = previewRound(c, state, { orders: [{ type: 'sellWorks' }] });
    expect(player.life.works).toEqual([]);
    expect(player.cash).toBe(cash + 1_000_00 * c.life.works.saleYears);
  });

  it('checks its rules', () => {
    const c = fixtureContent();
    c.life.works.fadePct = 0;
    c.life.lodger.rentPct = 150;
    expect(validateContent(c)).toEqual(expect.arrayContaining(['life.works.fadePct must be a whole number from 1 to 100', 'life.lodger needs a share of the rent from 0 to 100 and the status lost']));
  });
});
