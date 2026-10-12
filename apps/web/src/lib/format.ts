/** How numbers are written in each language. Money is always US dollars, shown with a plain `$` (spec 8.6). */
export interface Format {
  /** Cents as whole dollars: $12,345. */
  money(cents: number): string;
  /** Cents as whole dollars with a sign: +$1,200 or −$300. */
  signed(cents: number): string;
  /** Cents in a few characters, for small spaces: $12.4k, $1.2M. */
  compact(cents: number): string;
  /** Basis points as a percentage with one decimal: 250 → 2.5%. */
  rate(bp: number): string;
  /** Basis points as a signed whole percentage: -2200 → −22%. */
  change(bp: number): string;
  number(value: number): string;
}

const TAGS: Record<string, string> = { en: 'en-US', es: 'es-ES' };
const MINUS = '−';

export function formatFor(locale: string): Format {
  const tag = TAGS[locale] ?? TAGS.en;
  const currency = { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' } as const;
  // Spanish leaves four-digit numbers ungrouped by default; a game about money reads better with them grouped.
  const dollars = new Intl.NumberFormat(tag, { ...currency, maximumFractionDigits: 0, useGrouping: 'always' });
  const short = new Intl.NumberFormat(tag, { ...currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0, useGrouping: 'always' });
  const decimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fix = (text: string) => text.replace('-', MINUS);

  const money = (cents: number) => fix(dollars.format(Math.round(cents / 100)));
  return {
    money,
    signed: (cents) => (cents >= 0 ? `+${money(cents)}` : money(cents)),
    compact: (cents) => (Math.abs(cents) < 1_000_000 ? money(cents) : fix(short.format(cents / 100))),
    rate: (bp) => `${decimal.format(bp / 100)}%`,
    change: (bp) => `${bp >= 0 ? '+' : MINUS}${whole.format(Math.abs(Math.round(bp / 100)))}%`,
    number: (value) => fix(whole.format(value)),
  };
}
