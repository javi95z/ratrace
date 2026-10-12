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
    // A change of nothing carries no sign: "+$0" of tax reads like a mistake.
    expect(en.signed(0)).toBe('$0');
  });

  it('never writes a negative zero: a few cents either way are no dollars', () => {
    for (const fmt of [en, es]) {
      for (const cents of [0, -0, 40, -40, -49]) {
        expect(fmt.money(cents), String(cents)).not.toMatch(/[−-]/);
        expect(fmt.signed(cents), String(cents)).toMatch(/^[^+−-]*$/);
        expect(fmt.compact(cents), String(cents)).not.toMatch(/[−-]/);
      }
    }
    expect(en.signed(-51)).toBe('−$1');
    expect(en.change(-49)).toBe('+0%');
    expect(en.change(-51)).toBe('−1%');
    expect(en.number(-0)).toBe('0');
  });

  it('shortens large amounts to three figures for small spaces, and leaves small ones whole', () => {
    expect(en.compact(123_400)).toBe('$1,234');
    expect(en.compact(999_900)).toBe('$9,999');
    expect(en.compact(1_240_000)).toBe('$12.4K');
    expect(en.compact(28_846_700)).toBe('$288K');
    expect(en.compact(123_400_000)).toBe('$1.23M');
    expect(en.compact(-5_000_000)).toBe('−$50K');
    expect(en.compact(987_654_321_000)).toBe('$9.88B');
  });

  it('never lets a rounded figure spill into four digits before its unit', () => {
    expect(en.compact(99_960_000)).toBe('$1M');
    expect(en.compact(99_940_000)).toBe('$999K');
    expect(en.compact(99_999_990_000)).toBe('$1B');
  });

  it('keeps a shortened amount short in Spanish too, with the units a player reads at a glance', () => {
    // Intl would write "14,3 mil $" and "1,2 mil M $": correct, and too long for the HUD of a phone.
    expect(plain(es.compact(1_430_000))).toBe('14,3K $');
    expect(plain(es.compact(28_846_700))).toBe('288K $');
    expect(plain(es.compact(123_400_000))).toBe('1,23M $');
    expect(plain(es.compact(-5_000_000))).toBe('−50K $');
    // A Spanish "B" would be read as a billón, a million millions. Thousands of millions are written out.
    expect(plain(es.compact(987_654_321_000))).toBe('9.880M $');
    expect(plain(es.compact(123_400))).toBe('1.234 $');
  });

  it('writes no shortened amount longer than nine characters, sign included, up to a billion dollars', () => {
    for (const fmt of [en, es]) {
      for (let exponent = 0; exponent <= 10; exponent++) {
        for (const lead of [1, 1.234, 4.5678, 9.999, 9.9999]) {
          const cents = Math.round(lead * 10 ** exponent);
          for (const amount of [cents, -cents]) expect(plain(fmt.compact(amount)).length, `${amount}`).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('writes rates and changes', () => {
    expect(en.rate(250)).toBe('2.5%');
    expect(es.rate(250)).toBe('2,5%');
    expect(en.change(-2_200)).toBe('−22%');
    expect(en.change(1_450)).toBe('+15%');
    expect(en.change(0)).toBe('+0%');
    expect(en.number(-1234)).toBe('−1,234');
  });

  it('writes a multiplier from its percentage', () => {
    expect(en.factor(100)).toBe('1.00');
    expect(en.factor(161)).toBe('1.61');
    expect(es.factor(125)).toBe('1,25');
  });

  it('falls back to English for a language it does not know', () => {
    expect(formatFor('fr').money(1_234_567)).toBe('$12,346');
  });
});
