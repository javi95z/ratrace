import type { Names } from '../names';
import type { ContentText } from './types';

/*
 * What is done to the text of a language before the interface shows it, whatever language it is and however it was loaded: what follows each choice
 * written into its option, and every name placeholder filled from the language's names (`index.ts`, and the app's web's `index.web.ts`).
 */

/** The text with what follows each choice written into the option it follows from. */
export function withAfter(text: ContentText, after: Record<string, ReadonlyArray<string | null>>): ContentText {
  const cards = Object.entries(text.cards).map(([id, card]) => {
    const lines = Object.hasOwn(after, id) ? after[id] : [];
    return [id, { ...card, options: card.options.map((option, i) => (lines[i] ? { ...option, after: lines[i] } : option)) }];
  });
  return { ...text, cards: Object.fromEntries(cards) as ContentText['cards'] };
}

/** Placeholders that the name pack fills: {item:watch_rolex}, {asset:tesla}, {city:london}, {brand:google}, {person:inlaw}. */
const PLACEHOLDER = /\{(item|asset|city|brand|person):([a-z0-9_]+)\}/g;

function nameOf(pack: Names, kind: string, id: string): string | undefined {
  switch (kind) {
    case 'item':
      return Object.hasOwn(pack.items, id) ? pack.items[id] : undefined;
    case 'asset':
      return Object.hasOwn(pack.assets, id) ? pack.assets[id].name : undefined;
    case 'city':
      return Object.hasOwn(pack.cities, id) ? pack.cities[id] : undefined;
    case 'person':
      return Object.hasOwn(pack.people, id) ? pack.people[id as keyof Names['people']] : undefined;
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

/** Every sentence of a text (a string, or any list or record of them) with its placeholders filled. */
export function filled<T>(value: T, pack: Names): T {
  if (typeof value === 'string') return fillNames(value, pack) as T;
  if (Array.isArray(value)) return value.map((entry) => filled(entry, pack)) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, filled(entry, pack)])) as T;
  }
  return value;
}

/** What a kind of home is called in a city: the city's own name for it, or the plain one. */
export function homeName(text: ContentText, typeId: string, cityId: string): string {
  return text.cityHomes[cityId]?.[typeId] ?? text.propertyTypes[typeId];
}
