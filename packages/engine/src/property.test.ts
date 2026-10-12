import { describe, expect, it } from 'vitest';
import { newPlayer } from './player';
import type { OrderContext } from './portfolio';
import {
  executeBuyProperty,
  executeSellProperty,
  executeSetRented,
  growProperties,
  ownsHome,
  propertyPrice,
} from './property';
import { fixtureContent, fixtureStart } from './testing/fixture';
import { generateTimeline } from './world';

function setup(cash = 0) {
  const content = fixtureContent();
  const timeline = generateTimeline('property', content);
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world: timeline[0],
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, propertyPurchases: 0 },
  };
  return { content, timeline, p, ctx };
}

describe('property prices', () => {
  it('scales the city flat price by type and index', () => {
    const { content, timeline } = setup();
    expect(propertyPrice(content, timeline[0], 'home', 'flat')).toBe(25_000_000);
    expect(propertyPrice(content, timeline[0], 'home', 'studio')).toBe(15_000_000);
    const dearer = { ...timeline[0], propertyIndex: { ...timeline[0].propertyIndex, home: 110_000_000 } };
    expect(propertyPrice(content, dearer, 'home', 'studio')).toBe(16_500_000);
  });
});

describe('buying property', () => {
  it('buys outright with cash', () => {
    const { p, ctx } = setup(20_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx)).toBeNull();
    expect(p.cash).toBe(5_000_000);
    expect(p.properties).toEqual([
      { id: 'property-1', cityId: 'home', typeId: 'studio', value: 15_000_000, basis: 15_000_000, rented: true, mortgageId: null },
    ]);
    expect(ctx.tally.propertyPurchases).toBe(15_000_000);
  });

  it('buys with a fixed mortgage at the policy rate plus the spread', () => {
    const { p, ctx } = setup(4_000_000);
    expect(executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx)).toBeNull();
    expect(p.cash).toBe(1_000_000);
    expect(p.debts).toEqual([{ id: 'debt-1', kind: 'mortgageFixed', principal: 12_000_000, fixedRateBp: 400, roundsLeft: 12 }]);
    expect(p.properties[0].mortgageId).toBe('debt-1');
    expect(ownsHome(p)).toBe(true);
  });

  it('buys with a variable mortgage that stores no rate', () => {
    const { p, ctx } = setup(4_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: true }, ctx);
    expect(p.debts[0]).toMatchObject({ kind: 'mortgageVariable', fixedRateBp: 0 });
    expect(ownsHome(p)).toBe(false);
  });

  it('rejects bad purchases and changes nothing', () => {
    const { p, ctx } = setup(4_000_000);
    const before = JSON.stringify({ p, tally: ctx.tally });
    const buy = (over: Partial<{ typeId: string; downPayment: number; mortgage: 'fixed' | 'variable' | 'none' }>) =>
      executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false, ...over }, ctx);
    expect(buy({ typeId: 'castle' })).toBe('unknown property type: castle');
    expect(buy({ mortgage: 'none' })).toBe('not enough cash');
    expect(buy({ downPayment: 2_999_999 })).toBe('down payment is below the minimum');
    expect(buy({ downPayment: 15_000_000 })).toBe('down payment covers the full price; buy without a mortgage');
    expect(buy({ downPayment: 4_000_001 })).toBe('not enough cash');
    for (const downPayment of [0, -5, 12.5, NaN, Infinity]) {
      expect(buy({ downPayment })).toBe('down payment must be a positive whole number of cents');
    }
    p.bankruptUntilRound = 2;
    expect(buy({})).toBe('no credit available after bankruptcy');
    p.bankruptUntilRound = 0;
    expect(JSON.stringify({ p, tally: ctx.tally })).toBe(before);
  });
});

describe('selling and renting property', () => {
  it('sells, repays the mortgage and realises the gain', () => {
    const { p, ctx } = setup(4_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'fixed', rented: false }, ctx);
    p.properties[0].value = 18_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.properties).toEqual([]);
    expect(p.debts).toEqual([]);
    expect(p.cash).toBe(1_000_000 + 18_000_000 - 12_000_000);
    expect(ctx.tally.realisedGains).toBe(3_000_000);
  });

  it('lets an underwater sale leave cash negative for the round to settle', () => {
    const { p, ctx } = setup(3_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 3_000_000, mortgage: 'variable', rented: false }, ctx);
    p.properties[0].value = 5_000_000;
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'property-2' }, ctx)).toBeNull();
    expect(p.cash).toBe(-7_000_000);
    expect(p.debts).toEqual([]);
    expect(ctx.tally.realisedGains).toBe(-10_000_000);
  });

  it('rejects unknown property ids', () => {
    const { p, ctx } = setup();
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: 'gone' }, ctx)).toBe('unknown property: gone');
    expect(executeSellProperty(p, { type: 'sellProperty', propertyId: '__proto__' }, ctx)).toBe('unknown property: __proto__');
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'gone', rented: true })).toBe('unknown property: gone');
  });

  it('switches a property between home and rental', () => {
    const { p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: false }, ctx);
    expect(ownsHome(p)).toBe(true);
    expect(executeSetRented(p, { type: 'setRented', propertyId: 'property-1', rented: true })).toBeNull();
    expect(ownsHome(p)).toBe(false);
  });

  it('grows property values with the city index', () => {
    const { timeline, p, ctx } = setup(20_000_000);
    executeBuyProperty(p, { type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented: true }, ctx);
    const after = { ...timeline[1], propertyReturnBp: { ...timeline[1].propertyReturnBp, home: 1_000 } };
    growProperties(p, after);
    expect(p.properties[0].value).toBe(16_500_000);
    expect(p.properties[0].basis).toBe(15_000_000);
  });
});
