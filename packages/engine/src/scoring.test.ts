import { describe, expect, it } from 'vitest';
import { escapeMultiplier, scoreOf, wealthPoints } from './scoring';
import { fixtureContent } from './testing/fixture';

const content = fixtureContent();
const points = content.scoring.wealthBreakpoints;

describe('scoring', () => {
  it('gives no wealth points at or below zero', () => {
    expect(wealthPoints(0, points)).toBe(0);
    expect(wealthPoints(-5_000_000, points)).toBe(0);
  });

  it('interpolates between breakpoints', () => {
    expect(wealthPoints(1_000_000, points)).toBe(100);
    expect(wealthPoints(5_500_000, points)).toBe(150);
    expect(wealthPoints(100_000_000, points)).toBe(300);
  });

  it('caps at the last breakpoint, even for absurd wealth', () => {
    expect(wealthPoints(10_000_000_000, points)).toBe(500);
    expect(wealthPoints(1e24, points)).toBe(500);
  });

  it('refuses a net worth that is not a finite number', () => {
    expect(() => wealthPoints(NaN, points)).toThrow('wealthPoints: net worth is not a finite number');
    expect(() => wealthPoints(Infinity, points)).toThrow('wealthPoints: net worth is not a finite number');
  });

  it('multiplies by 100 without escape and more the earlier the escape', () => {
    expect(escapeMultiplier(null, 20, content.scoring)).toBe(100);
    expect(escapeMultiplier(20, 20, content.scoring)).toBe(125);
    expect(escapeMultiplier(1, 20, content.scoring)).toBe(182);
  });

  it('combines wealth, status and escape', () => {
    expect(scoreOf(100_000_000, 50, null, content)).toBe(350);
    expect(scoreOf(100_000_000, 50, 1, content)).toBe(637);
  });
});
