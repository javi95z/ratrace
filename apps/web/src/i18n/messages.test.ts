import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { routing } from './routing';

const read = (locale: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../messages/${locale}.json`, import.meta.url)), 'utf8'));

/** Every sentence in a message file, with the path that leads to it. */
function sentences(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, entry]) => sentences(entry, path === '' ? key : `${path}.${key}`));
}

/** The names a sentence expects to be given: {amount}, {count, plural, …}. */
const params = (sentence: string) => [...sentence.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]).sort();

const en = new Map(sentences(read('en')));
const es = new Map(sentences(read('es')));

describe('interface text', () => {
  it('exists for every language the game is routed in', () => {
    expect([...routing.locales]).toEqual(['en', 'es']);
  });

  it('has the same keys in both languages', () => {
    expect([...es.keys()].sort()).toEqual([...en.keys()].sort());
  });

  it('expects the same values in both languages', () => {
    for (const [key, sentence] of en) expect(params(es.get(key) ?? ''), key).toEqual(params(sentence));
  });

  it('has no empty sentence and no stray space', () => {
    for (const map of [en, es]) {
      for (const [key, sentence] of map) {
        expect(sentence.trim().length, key).toBeGreaterThan(0);
        expect(sentence, key).toBe(sentence.trim());
      }
    }
  });

  it('is really translated: Spanish is not a copy of the English', () => {
    /** Words that are the same in both languages. */
    const same = new Set(['meta.title', 'effects.get', 'finance.market.crypto', 'finance.property.variable', 'news.crypto']);
    const copies = [...en].filter(([key, sentence]) => es.get(key) === sentence && !same.has(key)).map(([key]) => key);
    expect(copies).toEqual([]);
  });
});
