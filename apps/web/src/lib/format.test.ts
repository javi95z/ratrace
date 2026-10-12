import { describe, expect, it } from 'vitest';
import { formatFor } from './format';

const en = formatFor('en');
const es = formatFor('es');
/** Intl uses narrow and non-breaking spaces; the tests should not care which. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('formatFor', () => {
  it('writes money as whole dollars with a plain dollar sign', () => {
    expect(en.money(1_234_567)).toBe('$12,346');
    expect(en.money(0)).toBe('$0');
    expect(en.money(-30_000)).toBe('−$300');
    expect(plain(es.money(1_234_567))).toBe('12.346 $');
    expect(plain(es.money(300_000))).toBe('3.000 $');
  });

  it('signs an amount that is a change', () => {
    expect(en.signed(120_000)).toBe('+$1,200');
    expect(en.signed(-120_000)).toBe('−$1,200');
    expect(en.signed(0)).toBe('+$0');
  });

  it('shortens large amounts for small spaces, and leaves small ones whole', () => {
    expect(en.compact(123_400)).toBe('$1,234');
    expect(en.compact(1_240_000)).toBe('$12.4K');
    expect(en.compact(123_400_000)).toBe('$1.2M');
    expect(en.compact(-5_000_000)).toBe('−$50K');
    expect(plain(es.compact(123_400_000))).toMatch(/^1,2 M \$$/);
  });

  it('writes rates and changes', () => {
    expect(en.rate(250)).toBe('2.5%');
    expect(es.rate(250)).toBe('2,5%');
    expect(en.change(-2_200)).toBe('−22%');
    expect(en.change(1_450)).toBe('+15%');
    expect(en.change(0)).toBe('+0%');
    expect(en.number(-1234)).toBe('−1,234');
  });

  it('falls back to English for a language it does not know', () => {
    expect(formatFor('fr').money(1_234_567)).toBe('$12,346');
  });
});
