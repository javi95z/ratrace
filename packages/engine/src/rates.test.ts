import { describe, expect, it } from 'vitest';
import { assetYieldBp, depositRateBp, indexed, PRICE_LEVEL_START } from './rates';
import { fixtureContent } from './testing/fixture';
import { generateTimeline } from './world';

const content = fixtureContent();
const world = generateTimeline('rates', content)[0];
const asset = (id: string) => {
  const found = content.assets.find((a) => a.id === id);
  if (!found) throw new Error(`fixture has no asset ${id}`);
  return found;
};

describe('rates', () => {
  it('leaves an amount unchanged at the starting price level', () => {
    expect(world.priceLevel).toBe(PRICE_LEVEL_START);
    expect(indexed(1_800_000, world)).toBe(1_800_000);
  });

  it('scales an amount with the price level, rounding down', () => {
    expect(indexed(1_000_000, { ...world, priceLevel: 1_250_000 })).toBe(1_250_000);
    expect(indexed(333, { ...world, priceLevel: 1_500_000 })).toBe(499);
    expect(indexed(0, { ...world, priceLevel: 1_500_000 })).toBe(0);
  });

  it('pays a bond the policy rate plus its spread, never below zero', () => {
    expect(assetYieldBp(asset('bond_long'), world)).toBe(300);
    expect(assetYieldBp(asset('bond_long'), { ...world, policyRateBp: 0 })).toBe(50);
  });

  it('pays other assets their own dividend yield', () => {
    expect(assetYieldBp(asset('fund_world'), world)).toBe(180);
    expect(assetYieldBp(asset('gold'), world)).toBe(0);
  });

  it('pays the deposit the policy rate minus the spread, never below zero', () => {
    expect(depositRateBp(content, world)).toBe(150);
    expect(depositRateBp(content, { ...world, policyRateBp: 50 })).toBe(0);
  });
});
