import type { Locale } from '@ratrace/content';

const TAGS: Record<Locale, string> = { en: 'en-US', es: 'es-ES' };

export interface Format {
  /** Cents as whole dollars: $12,345. */
  money(cents: number): string;
  /** Cents with an explicit sign: +$1,200 or −$300. */
  signed(cents: number): string;
  /** Basis points as a percentage with one decimal: 250 → 2.5%. */
  rate(bp: number): string;
  /** Basis points as a signed whole percentage: -2200 → −22%. */
  change(bp: number): string;
  number(value: number): string;
}

export function formatFor(locale: Locale): Format {
  const tag = TAGS[locale];
  const dollars = new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
  const plain = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Whole dollars, and never a negative zero: forty cents owed is "$0", not "−$0".
  const whole = (cents: number) => Math.round(cents / 100) || 0;
  const money = (cents: number) => dollars.format(whole(cents)).replace('-', '−');
  return {
    money,
    signed: (cents) => (whole(cents) >= 0 ? `+${money(cents)}` : money(cents)),
    rate: (bp) => `${decimal.format(bp / 100)}%`,
    change: (bp) => `${bp >= 0 ? '+' : '−'}${plain.format(Math.abs(Math.round(bp / 100)))}%`,
    number: (value) => plain.format(value),
  };
}

/** Lower-case letters and digits only, without accents, so that "Dubái", "dubai" and "DUBAI" all match. */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Pads on the right to a width, counting characters. */
export const padEnd = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - [...text].length));
export const padStart = (text: string, width: number) => ' '.repeat(Math.max(0, width - [...text].length)) + text;
