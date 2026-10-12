import { describe, expect, it } from 'vitest';
import { applyBp, clamp, isAmount, mulDiv, round } from './money';

describe('money', () => {
  it('applies basis points and rounds to the nearest cent', () => {
    expect(applyBp(10_000, 250)).toBe(250);
    expect(applyBp(333, 5_000)).toBe(167);
    expect(applyBp(1_000, -2_500)).toBe(-250);
  });

  it('never returns negative zero', () => {
    expect(Object.is(round(-0.2), 0)).toBe(true);
    expect(Object.is(applyBp(0, -500), 0)).toBe(true);
  });

  it('splits proportionally with floor', () => {
    expect(mulDiv(10, 3, 4)).toBe(7);
    expect(() => mulDiv(1, 1, 0)).toThrow('division by zero');
  });

  it('clamps to a range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('accepts only positive safe integers as amounts', () => {
    expect(isAmount(1)).toBe(true);
    expect(isAmount(50_000_000)).toBe(true);
    const bad: unknown[] = [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2, '100', null, undefined];
    for (const value of bad) expect(isAmount(value)).toBe(false);
  });
});
