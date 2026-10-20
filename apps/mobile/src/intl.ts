/**
 * The Intl the game's words and numbers are written with, the same on every phone as in the web's browsers.
 * Hermes's own Intl formats numbers but cannot say which part of the result is which (`formatToParts`), and
 * differs between iOS and Android: formatjs's polyfills take its place, forced (the formatjs advice for Hermes),
 * with the data of the game's three languages only. Loaded before anything that writes a number.
 *
 * The order is formatjs's: each polyfill leans on the ones before it.
 */
import '@formatjs/intl-getcanonicallocales/polyfill-force.js';
import '@formatjs/intl-locale/polyfill-force.js';

import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/ru.js';

import '@formatjs/intl-numberformat/polyfill-force.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-numberformat/locale-data/es.js';
import '@formatjs/intl-numberformat/locale-data/ru.js';

import '@formatjs/intl-datetimeformat/polyfill-force.js';
import '@formatjs/intl-datetimeformat/locale-data/en.js';
// Days are written day first in English too (`formatFor`'s en-GB).
import '@formatjs/intl-datetimeformat/locale-data/en-GB.js';
import '@formatjs/intl-datetimeformat/locale-data/es.js';
import '@formatjs/intl-datetimeformat/locale-data/ru.js';
// The world's time zones in their common form, so a day is the reader's own day, not London's.
import '@formatjs/intl-datetimeformat/add-golden-tz.js';

/** Makes `timeZone` the zone days are read in, as a browser takes its computer's. A zone it does not know leaves UTC. */
export function readDaysIn(timeZone: string | null | undefined): void {
  const format = Intl.DateTimeFormat as unknown as { __setDefaultTimeZone?: (zone: string) => void };
  if (!timeZone || !format.__setDefaultTimeZone) return;
  try {
    format.__setDefaultTimeZone(timeZone);
  } catch {
    // An unknown zone: days in UTC, a few hours off at most.
  }
}
