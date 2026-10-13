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
const ru = new Map(sentences(read('ru')));
/** Every language the game was translated into, from the English it is written in. */
const translated = { es, ru };

/**
 * Russian words that are written with ё and here are not. The letter is optional in a newspaper
 * and not in this game. Only forms that are never right with е are listed: «счета» (the accounts)
 * and «в жилье» are, and are not here.
 */
const WITHOUT_YO = new RegExp(
  `(?<![а-яё])(?:${[
    'еще', 'ее', 'нее', 'мое', 'твое', 'свое', 'твоем', 'своем', 'партнер[а-я]*', 'учеба', 'учебы', 'учебе', 'учебу', 'учебой', 'заем', 'наем',
    'прием', 'приема', 'приему', 'приемом', 'приеме', 'объем[а-я]*', 'счет', 'отчет[а-я]*', 'расчет[а-я]*', 'самолет[а-я]*', 'перелет[а-я]*', 'полет[а-я]*', 'вперед',
    'идешь', 'живешь', 'берешь', 'даешь', 'ждешь', 'придешь', 'уйдешь', 'найдешь', 'начнешь', 'вернешь', 'поймешь', 'продаешь', 'отдаешь', 'сдаешь', 'остаешься', 'вернешься',
    'идет', 'живет', 'дает', 'ждет', 'придет', 'уйдет', 'растет', 'несет', 'ведет', 'продает', 'отдает', 'сдает', 'остается', 'придется', 'удается', 'вернется', 'начнется', 'найдется',
  ].join('|')})(?![а-яё])`,
  'i',
);

describe('interface text', () => {
  it('exists for every language the game is routed in', () => {
    expect([...routing.locales]).toEqual(['en', 'es', 'ru']);
  });

  it('has the same keys in every language', () => {
    for (const [language, map] of Object.entries(translated)) expect([...map.keys()].sort(), language).toEqual([...en.keys()].sort());
  });

  it('expects the same values in every language', () => {
    for (const [language, map] of Object.entries(translated)) {
      for (const [key, sentence] of en) expect(params(map.get(key) ?? ''), `${language}: ${key}`).toEqual(params(sentence));
    }
  });

  it('has no empty sentence and no stray space', () => {
    for (const map of [en, es, ru]) {
      for (const [key, sentence] of map) {
        expect(sentence.trim().length, key).toBeGreaterThan(0);
        expect(sentence, key).toBe(sentence.trim());
      }
    }
  });

  it('is typeset one way throughout', () => {
    const broken = (all: Map<string, string>, test: (sentence: string) => boolean) => [...all].filter(([, sentence]) => test(sentence)).map(([path]) => path);
    for (const all of [en, es, ru]) {
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
    // Russian: angle quotes, a percent sign against its number, a dash that is a dash, and ё wherever it belongs.
    expect(broken(ru, (s) => /["“”‘’]/.test(s))).toEqual([]);
    expect(broken(ru, (s) => /[\d}] %/.test(s))).toEqual([]);
    expect(broken(ru, (s) => /[¿¡]/.test(s))).toEqual([]);
    expect(broken(ru, (s) => /[а-яё] – | -- /i.test(s))).toEqual([]);
    expect(broken(ru, (s) => WITHOUT_YO.test(s))).toEqual([]);
  });

  it('counts in Russian with every form the language has', () => {
    // 1 год, 2 года, 5 лет, and 2,5 года: a count with a form missing is shown with nothing after its number.
    const counted = [...ru].filter(([, sentence]) => /, plural,/.test(sentence));
    expect(counted.length).toBeGreaterThanOrEqual([...en].filter(([, sentence]) => /, plural,/.test(sentence)).length);
    for (const [key, sentence] of counted) {
      for (const form of ['one', 'few', 'many', 'other']) expect(sentence, `${key}: ${form}`).toMatch(new RegExp(`[, ]${form} \\{`));
    }
  });

  it('never tells a Russian player whether they are a man or a woman', () => {
    // The two giveaways a reader can be searched for: an ending offered both ways, and «ты» with a verb in the past.
    const telling = [...ru].filter(([, sentence]) => /\((?:а|ла|ая|на)\)|[а-яё]\/[а-яё]{1,3}(?![а-яё])/i.test(sentence) || /(?<![а-яё])ты (?:не )?(?:уже |ещё |так и не |сам[а-я]* )?[а-яё]+(?:л|ла|лся|лась)(?![а-яё])/i.test(sentence));
    expect(telling.map(([key]) => key)).toEqual([]);
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
    const BUILT = [/^finance\.tabs\./, /^play\.stages\./, /^meta\.titles\./, /^guide\.(news|cards|finance|ledger|ratRace|invest|focus|flow)$/, /^end\.best(Score|NetWorth|Escape|Status)$/, /^effects\.perks\.(moveCostOffPct|studySkill|salaryPct|jobHuntPct|focus)$/, /^work\.financeOpens\.[012]$/];
    const unused = [...en.keys()].filter((key) => {
      if (BUILT.some((built) => built.test(key))) return false;
      const leaf = key.split('.').at(-1) as string;
      return !new RegExp(`['"\`.]${leaf}['"\`]`).test(source);
    });
    expect(unused).toEqual([]);
  });

  it('is really translated: no language is a copy of the English', () => {
    /** Words that are the same in English and in another language. A sentence of placeholders and signs alone is the same in all. */
    const same: Record<string, Set<string>> = {
      es: new Set(['meta.title', 'finance.market.crypto', 'finance.property.variable', 'news.crypto']),
      ru: new Set(['meta.title']),
    };
    const worded = (sentence: string) => /\p{L}/u.test(sentence.replace(/\{[^{}]*\}/g, ''));
    for (const [language, map] of Object.entries(translated)) {
      const copies = [...en].filter(([key, sentence]) => worded(sentence) && map.get(key) === sentence && !same[language].has(key)).map(([key]) => key);
      expect(copies, language).toEqual([]);
    }
    // And Russian is written in its own letters: a sentence with words has Cyrillic ones.
    const latinOnly = [...ru].filter(([key, sentence]) => worded(sentence) && !/[а-яё]/i.test(sentence) && !same.ru.has(key)).map(([key]) => key);
    expect(latinOnly).toEqual([]);
  });
});
