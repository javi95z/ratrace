import type { Locale } from '@ratrace/content';

const TAGS: Record<Locale, string> = { en: 'en-US', es: 'es-ES', ru: 'ru-RU' };

export interface Format {
  /** Cents as whole dollars: $12,345. */
  money(cents: number): string;
  /** Cents with an explicit sign: +$1,200 or −$300. Nothing is plain $0. */
  signed(cents: number): string;
  /** Basis points as a percentage with one decimal: 250 → 2.5%. */
  rate(bp: number): string;
  /** Basis points as a signed whole percentage: -2200 → −22%. */
  change(bp: number): string;
  number(value: number): string;
  /** A number with a set count of decimals and the decimal mark of the language: 1.25, or 1,25. */
  fixed(value: number, decimals: number): string;
}

export function formatFor(locale: Locale): Format {
  const tag = TAGS[locale];
  const dollars = new Intl.NumberFormat(tag, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 });
  const plain = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Whole dollars, and never a negative zero: forty cents owed is "$0", not "−$0".
  const whole = (cents: number) => Math.round(cents / 100) || 0;
  const money = (cents: number) => dollars.format(whole(cents)).replace('-', '−');
  const mark = decimal.formatToParts(0.5).find((part) => part.type === 'decimal')?.value ?? '.';
  return {
    money,
    signed: (cents) => (whole(cents) > 0 ? `+${money(cents)}` : money(cents)),
    rate: (bp) => `${decimal.format(bp / 100)}%`,
    change: (bp) => `${bp >= 0 ? '+' : '−'}${plain.format(Math.abs(Math.round(bp / 100)))}%`,
    number: (value) => plain.format(value),
    fixed: (value, decimals) => value.toFixed(decimals).replace('.', mark),
  };
}

/**
 * Lower-case letters and digits only, without accents, so that "Dubái", "dubai" and "DUBAI" all match.
 * Russian letters stay: ё is read as е, since it is typed either way, and й keeps its breve, since it
 * is a letter of its own and no и with an accent.
 */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/(?<![иИ])\u0306|[\u0300-\u0305\u0307-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]/g, '');
}

/** Pads on the right to a width, counting characters. */
export const padEnd = (text: string, width: number) => text + ' '.repeat(Math.max(0, width - [...text].length));
export const padStart = (text: string, width: number) => ' '.repeat(Math.max(0, width - [...text].length)) + text;
