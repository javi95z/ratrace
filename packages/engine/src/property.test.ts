import { describe, expect, it } from 'vitest';
import {
  executeBuyProperty,
  executeSellProperty,
  executeSetRented,
  growProperties,
  ownsHome,
  propertyPrice,
} from './property';
import { newTally } from './tally';
import { fixtureContent, fixturePlayer } from './testing/fixture';
import type { OrderContext } from './types';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const timeline = generateTimeline('property', content);
  const p = fixturePlayer({ cash });
  const ctx: OrderContext = {
    content,
    world: timeline[0],
    round: 0,
    tally: newTally(),
  };
  return { content, timeline, p, ctx };
}

const STUDIO = 15_000_000;
const STUDIO_TAX = 1_200_000;

describe('property prices', () => {
  it('scales the city flat price by type and index', () => {
    const { content, timeline } = setup();
    expect(propertyPrice(content, timeline[0], 'home', 'flat')).toBe(25_000_000);
    expect(propertyPrice(content, timeline[0], 'home', 'studio')).toBe(STUDIO);
    const dearer = { ...timeline[0], propertyIndex: { ...timeline[0].propertyIndex, home: 110_000_000 } };
    expect(propertyPrice(content, dearer, 'home', 'studio')).toBe(16_500_000);
  });
});

describe('buying property', () => {
  it('buys outright: pays the price and the purchase tax from cash', () => {
    const { p, ctx } = setup(20_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBeNull();
    expect(p.cash).toBe(20_000_000 - STUDIO - STUDIO_TAX);
    expect(p.properties).toEqual([
      { id: 'property-1', cityId: 'home', typeId: 'studio', value: STUDIO, basis: STUDIO, rented: true, mortgageId: null },
    ]);
    expect(ctx.tally.purchaseTaxPaid).toBe(STUDIO_TAX);
  });

  it('buys with a fixed mortgage at the policy rate plus the spread', () => {
    const { p, ctx } = setup(5_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx)).toBeNull();
    expect(p.cash).toBe(5_000_000 - 3_000_000 - STUDIO_TAX);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'mortgageFixed', principal: 12_000_000, fixedRateBp: 400, roundsLeft: 12 }]);
    expect(p.properties[0].mortgageId).toBe('debt-1');
    expect(ownsHome(p)).toBe(true);
  });

  it('buys with a variable mortgage that stores no rate', () => {
    const { p, ctx } = setup(5_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: true }, ctx);
    expect(p.debts[0]).toMatchObject({ kind: 'mortgageVariable', fixedRateBp: 0 });
    expect(ownsHome(p)).toBe(false);
  });

  it('refuses a purchase when cash covers the price but not the tax', () => {
    const { p, ctx } = setup(STUDIO + STUDIO_TAX - 1);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBe('not-enough-cash');
    p.cash += 1;
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBeNull();
    expect(p.cash).toBe(0);
  });

  it('rejects bad purchases and changes nothing', () => {
    const { p, ctx } = setup(4_500_000);
    const before = JSON.stringify({ p, tally: ctx.tally });
    const buy = (over: Partial<{ typeId: string; downPayment: number; mortgage: 'fixed' | 'variable' | 'none' }>) =>
      executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false, ...over }, ctx);
    expect(buy({ typeId: 'castle' })).toBe('unknown-property-type');
    expect(buy({ typeId: '__proto__' })).toBe('unknown-property-type');
    expect(buy({ mortgage: 'none' })).toBe('not-enough-cash');
    expect(buy({ downPayment: 2_999_999 })).toBe('down-payment-too-low');
    expect(buy({ downPayment: STUDIO })).toBe('down-payment-too-high');
    expect(buy({ downPayment: 3_300_001 })).toBe('not-enough-cash');
    for (const downPayment of [0, -5, 12.5, NaN, Infinity]) expect(buy({ downPayment })).toBe('bad-down-payment');
    p.bankruptUntilRound = 2;
    expect(buy({})).toBe('no-credit');
    p.bankruptUntilRound = 0;
    expect(JSON.stringify({ p, tally: ctx.tally })).toBe(before);
  });
});

describe('selling and renting property', () => {
  it('sells, repays the mortgage and realises the gain', () => {
    const { p, ctx } = setup(5_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx);
    p.properties[0].value = 18_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(800_000 + 18_000_000 - 12_000_000);
    expect(ctx.tally.realisedGains).toBe(3_000_000);
  });

  it('lets an underwater sale leave cash negative for the round to settle', () => {
    const { p, ctx } = setup(4_200_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }, ctx);
    expect(p.cash).toBe(0);
    p.properties[0].value = 5_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.cash).toBe(-7_000_000);
    expect(p.debts).toEqual([]);
    expect(ctx.tally.realisedGains).toBe(-10_000_000);
  });

  it('rejects unknown property ids', () => {
    const { p, ctx } = setup();
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'gone' }, ctx)).toBe('unknown-property');
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: '__proto__' }, ctx)).toBe('unknown-property');
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'gone', rented: true }, ctx)).toBe('unknown-property');
  });

  it('switches a property between home and rental', () => {
    const { p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: false }, ctx);
    expect(ownsHome(p)).toBe(true);
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'property-1', rented: true }, ctx)).toBeNull();
    expect(ownsHome(p)).toBe(false);
  });

  it('grows property values with the city index', () => {
    const { timeline, p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx);
    const after = { ...timeline[1], propertyReturnBp: { ...timeline[1].propertyReturnBp, home: 1_000 } };
    growProperties(p, after);
    expect(p.properties[0].value).toBe(16_500_000);
    expect(p.properties[0].basis).toBe(STUDIO);
  });
});
