// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { expect, test } from 'vitest';
import { formatFor } from '@ratrace/core/lib/format';
import { useT, WordsProvider } from './words';

/** What Node's full ICU writes, which is what the web's players see: twelve thousand dollars, grouped, the sign after. */
const WEB = '12.346 $';

test('Spanish money is written as on the web', () => {
  expect(formatFor('es').money(1234567)).toBe(WEB);
});

test('a plural message reads "1 jugador" and "3 jugadores" through useT, from the web\'s own words', () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(WordsProvider, { locale: 'es', children });
  const { result } = renderHook(() => useT('records'), { wrapper });
  expect(result.current('players', { count: 1 })).toBe('1 jugador');
  expect(result.current('players', { count: 3 })).toBe('3 jugadores');
});

test('on the phone\'s path (no formatToParts until the polyfills load) numbers and days are still the web\'s', async () => {
  const day = Date.UTC(2026, 9, 13, 12);
  // formatjs's CLDR puts a narrow no-break space before Russian "г." where Node's ICU puts a plain one: the same to the eye.
  const spaced = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');
  const written = () => (['en', 'es', 'ru'] as const).map((locale) => [formatFor(locale).money(1234567), formatFor(locale).compact(1234567), formatFor(locale).rate(250), spaced(formatFor(locale).day(day))]);
  const native = written();
  const proto = Intl.NumberFormat.prototype as Partial<Intl.NumberFormat>;
  delete proto.formatToParts;
  expect(typeof Intl.NumberFormat.prototype.formatToParts).toBe('undefined');
  await import('../intl');
  expect((Intl.NumberFormat as unknown as { polyfilled?: boolean }).polyfilled).toBe(true);
  expect(typeof Intl.NumberFormat.prototype.formatToParts).toBe('function');
  expect(formatFor('es').money(1234567)).toBe(WEB);
  expect(written()).toEqual(native);
});
