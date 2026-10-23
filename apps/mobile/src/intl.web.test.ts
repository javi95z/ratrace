import { expect, it } from 'vitest';

/*
 * On the web the browser's own Intl, WebCrypto and structuredClone are the game's: `polyfills` resolves to its web twin (`polyfills.web.ts`,
 * which Metro picks for the web too), and that installs nothing over them. If the phone's file were the one loaded, formatjs would replace
 * Intl.NumberFormat and the clone would be the phone's JSON one.
 */

const before = {
  numberFormat: Intl.NumberFormat,
  pluralRules: Intl.PluralRules,
  dateTimeFormat: Intl.DateTimeFormat,
  subtle: globalThis.crypto?.subtle,
  digest: globalThis.crypto?.subtle?.digest,
  getRandomValues: globalThis.crypto?.getRandomValues,
  structuredClone: globalThis.structuredClone,
};

const polyfills = await import('./polyfills');
const intl = await import('./intl');

it('is the web twin of the polyfills that is loaded, not the phone\'s', () => {
  // The phone's file reads expo-crypto and expo-localization; the twin reads neither.
  expect(Object.keys(polyfills).sort()).toEqual(['installCrypto']);
  expect(Object.keys(intl).sort()).toEqual(['readDaysIn']);
});

it('leaves the browser\'s Intl, crypto and structuredClone the very functions they were', () => {
  expect(Intl.NumberFormat).toBe(before.numberFormat);
  expect(Intl.PluralRules).toBe(before.pluralRules);
  expect(Intl.DateTimeFormat).toBe(before.dateTimeFormat);
  expect(globalThis.crypto.subtle).toBe(before.subtle);
  expect(globalThis.crypto.subtle.digest).toBe(before.digest);
  expect(globalThis.crypto.getRandomValues).toBe(before.getRandomValues);
  expect(globalThis.structuredClone).toBe(before.structuredClone);
  expect(typeof Intl.NumberFormat.prototype.formatToParts).toBe('function');
});

it('has nothing to do for the days: a browser reads them in its computer\'s zone', () => {
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  intl.readDaysIn('Pacific/Kiritimati');
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
});
