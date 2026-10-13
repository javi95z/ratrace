import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

  it('is typeset one way throughout', () => {
    const broken = (all: Map<string, string>, test: (sentence: string) => boolean) => [...all].filter(([, sentence]) => test(sentence)).map(([path]) => path);
    for (const all of [en, es]) {
      expect(broken(all, (s) => s.includes('...'))).toEqual([]);
      expect(broken(all, (s) => / - /.test(s))).toEqual([]);
      expect(broken(all, (s) => / [,.;!?](\s|$)/.test(s))).toEqual([]);
    }
    // English: straight apostrophes and quotes, and a percent sign against its number.
    expect(broken(en, (s) => /[‘’“”«»]/.test(s))).toEqual([]);
    expect(broken(en, (s) => /[\d}] %/.test(s))).toEqual([]);
    // Spanish: no straight quotes, a space before the percent sign, and a question or an exclamation opened as well as closed.
    expect(broken(es, (s) => /["“”]/.test(s))).toEqual([]);
    expect(broken(es, (s) => /[\d}]%/.test(s))).toEqual([]);
    expect(broken(es, (s) => (s.match(/\?/g)?.length ?? 0) !== (s.match(/¿/g)?.length ?? 0))).toEqual([]);
    expect(broken(es, (s) => (s.match(/!/g)?.length ?? 0) !== (s.match(/¡/g)?.length ?? 0))).toEqual([]);
  });

  it('holds no sentence that nothing on screen uses', () => {
    // Every key must be asked for somewhere in the source: by its whole last name in quotes, or built from a
    // prefix the source spells out (`tabs.${id}`, `stages.${stage}`, a tip of the guide, a best of the end, a perk of an item, a level of money sense).
    const root = fileURLToPath(new URL('..', import.meta.url));
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return files(path);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
      });
    const source = files(root).map((path) => readFileSync(path, 'utf8')).join('\n');
    const BUILT = [/^finance\.tabs\./, /^play\.stages\./, /^meta\.titles\./, /^guide\.(news|cards|finance|ledger|ratRace|invest|focus|flow)$/, /^end\.best(Score|NetWorth|Escape|Status)$/, /^effects\.perks\.(moveCostOffPct|studySkill|salaryPct|jobHuntPct|focus)$/, /^work\.financeOpens\.[0123]$/, /^finance\.glance\.kinds\./];
    const unused = [...en.keys()].filter((key) => {
      if (BUILT.some((built) => built.test(key))) return false;
      const leaf = key.split('.').at(-1) as string;
      return !new RegExp(`['"\`.]${leaf}['"\`]`).test(source);
    });
    expect(unused).toEqual([]);
  });

  it('is really translated: Spanish is not a copy of the English', () => {
    /** Words that are the same in both languages. */
    const same = new Set(['meta.title', 'effects.get', 'finance.market.crypto', 'finance.property.variable', 'news.crypto']);
    const copies = [...en].filter(([key, sentence]) => es.get(key) === sentence && !same.has(key)).map(([key]) => key);
    expect(copies).toEqual([]);
  });
});
