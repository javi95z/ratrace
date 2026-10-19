/** How numbers are written in each language. Money is always US dollars, shown with a plain `$` (spec 8.6). */
export interface Format {
  /** Cents as whole dollars: $12,345. */
  money(cents: number): string;
  /** Cents as whole dollars with a sign: +$1,200 or −$300. Nothing is plain $0. */
  signed(cents: number): string;
  /** Cents in a few characters, for small spaces: $12.4K, $1.23M. Three figures at most, and whole dollars under ten thousand. */
  compact(cents: number): string;
  /** Cents in as few characters as will do, for a tag: $850, $7.1k, $203k, $1.2M. Exact under a thousand, about two figures above. */
  brief(cents: number): string;
  /** The same with a sign, as a change: +$7.1k or −$203k. */
  briefSigned(cents: number): string;
  /** Basis points as a percentage with one decimal: 250 → 2.5%. */
  rate(bp: number): string;
  /** Basis points as a signed whole percentage: -2200 → −22%. */
  change(bp: number): string;
  number(value: number): string;
  /** A percentage as a multiplier with two decimals: 125 → 1.25. */
  factor(pct: number): string;
  /** A moment as a day, by the clock of whoever is reading: 13 Oct 2026. */
  day(ms: number): string;
}

const TAGS: Record<string, string> = { en: 'en-US', es: 'es-ES', ru: 'ru-RU' };
/** Days are written day first in every language; American English would put the month first. */
const DAY_TAGS: Record<string, string> = { en: 'en-GB', es: 'es-ES', ru: 'ru-RU' };
const MINUS = '−';

export function formatFor(locale: string): Format {
  const tag = TAGS[locale] ?? TAGS.en;
  const currency = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const;
  // Spanish leaves four-digit numbers ungrouped by default; a game about money reads better with them grouped.
  const dollars = new Intl.NumberFormat(tag, { ...currency, maximumFractionDigits: 0, useGrouping: 'always' });
  const figures = new Intl.NumberFormat(tag, { maximumSignificantDigits: 3, useGrouping: 'always' });
  // Where the currency sign goes in this language, and what stands between it and the number.
  const parts = dollars.formatToParts(1);
  const digit = parts.findIndex((part) => part.type === 'integer');
  const before = parts.slice(0, digit).map((part) => part.value).join('');
  const after = parts.slice(digit + 1).map((part) => part.value).join('');
  // English counts thousands, millions and billions. A Spanish "B" would be read as a billón, a
  // million millions, and a Russian reader knows no "B" at all, so every other language stops at
  // millions and writes thousands of them out. Russian's own words for the units (тыс., млн) are
  // a character or two too long for the HUD of a phone.
  const units: ReadonlyArray<readonly [number, string]> = tag === TAGS.en ? [[1e3, 'K'], [1e6, 'M'], [1e9, 'B']] : [[1e3, 'K'], [1e6, 'M']];

  /** A large amount as three figures and a unit. Intl's own short form runs to "14,3 mil $", too long for a phone's HUD. */
  const shortened = (wholeDollars: number): string => {
    const size = Math.abs(wholeDollars);
    let at = 0;
    while (at < units.length - 1 && Number((size / units[at][0]).toPrecision(3)) >= 1000) at += 1;
    const [scale, unit] = units[at];
    return `${wholeDollars < 0 ? MINUS : ''}${before}${figures.format(Number((size / scale).toPrecision(3)))}${unit}${after}`;
  };
  const tenths = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  /** A large amount as a tag has room for: one decimal under ten of a unit, none above, and a small k as people write it. */
  const brief = (wholeDollars: number): string => {
    const size = Math.abs(wholeDollars);
    if (size < 1000) return fix(dollars.format(wholeDollars));
    const rounded = (scale: number) => (size / scale < 9.95 ? Math.round((size / scale) * 10) / 10 : Math.round(size / scale));
    let at = 0;
    while (at < units.length - 1 && rounded(units[at][0]) >= 1000) at += 1;
    const [scale, unit] = units[at];
    return `${wholeDollars < 0 ? MINUS : ''}${before}${tenths.format(rounded(scale))}${unit === 'K' ? 'k' : unit}${after}`;
  };
  const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0, useGrouping: 'always' });
  const decimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const hundredths = new Intl.NumberFormat(tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fix = (text: string) => text.replace('-', MINUS);
  // No time zone is named: a badge earned late in the evening is dated the day the player earned it.
  const days = new Intl.DateTimeFormat(DAY_TAGS[locale] ?? DAY_TAGS.en, { day: 'numeric', month: 'short', year: 'numeric' });

  // Rounded first, and never to a negative zero: forty cents owed is "$0", not "−$0", and its sign is a plus.
  const round = (value: number) => Math.round(value) || 0;
  const money = (cents: number) => fix(dollars.format(round(cents / 100)));
  return {
    money,
    signed: (cents) => (round(cents / 100) > 0 ? `+${money(cents)}` : money(cents)),
    compact: (cents) => (Math.abs(round(cents / 100)) < 10_000 ? money(cents) : shortened(round(cents / 100))),
    brief: (cents) => brief(round(cents / 100)),
    briefSigned: (cents) => (round(cents / 100) > 0 ? `+${brief(round(cents / 100))}` : brief(round(cents / 100))),
    rate: (bp) => `${decimal.format(bp / 100)}%`,
    change: (bp) => `${round(bp / 100) >= 0 ? '+' : MINUS}${whole.format(Math.abs(round(bp / 100)))}%`,
    number: (value) => fix(whole.format(round(value))),
    factor: (pct) => hundredths.format(pct / 100),
    day: (ms) => days.format(ms),
  };
}
