import { names } from '../names';
import type { Locale, Names } from '../names';
import { en } from './en';
import { es } from './es';
import type { ContentText } from './types';

export type { CardText, ContentText } from './types';

const raw: Record<Locale, ContentText> = { en, es };

/** Placeholders that the name pack fills: {item:watch_rolex}, {asset:tesla}, {city:london}, {brand:google}. */
const PLACEHOLDER = /\{(item|asset|city|brand):([a-z0-9_]+)\}/g;

function nameOf(pack: Names, kind: string, id: string): string | undefined {
  switch (kind) {
    case 'item':
      return Object.hasOwn(pack.items, id) ? pack.items[id] : undefined;
    case 'asset':
      return Object.hasOwn(pack.assets, id) ? pack.assets[id].name : undefined;
    case 'city':
      return Object.hasOwn(pack.cities, id) ? pack.cities[id] : undefined;
    default:
      return Object.hasOwn(pack.brands, id) ? pack.brands[id] : undefined;
  }
}

/** Replaces every name placeholder in a sentence. An unknown one is an error, not an empty space. */
export function fillNames(sentence: string, pack: Names): string {
  return sentence.replace(PLACEHOLDER, (whole, kind: string, id: string) => {
    const name = nameOf(pack, kind, id);
    if (name === undefined) throw new Error(`no name for ${whole}`);
    return name;
  });
}

function filled<T>(value: T, pack: Names): T {
  if (typeof value === 'string') return fillNames(value, pack) as T;
  if (Array.isArray(value)) return value.map((entry) => filled(entry, pack)) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, filled(entry, pack)])) as T;
  }
  return value;
}

/** The text exactly as written, with its placeholders. For tools that check it. */
export function rawText(locale: Locale): ContentText {
  return raw[locale];
}

/** Everything the interface shows about the content in one language: the sentences, with every name filled in, and the names. */
export function textFor(locale: Locale, pack: Names = names[locale]): { text: ContentText; names: Names } {
  return { text: filled(raw[locale], pack), names: pack };
}
