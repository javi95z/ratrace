import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assetClassArt, cardArt, cityArt, itemArt, PORTRAIT_AGES, portraitArt, propertyArt, rentTierArt } from './art';
import { content } from './content';
import { lives } from './lives';
import { names } from './names';
import type { Locale } from './names';
import { fillNames, rawText, textFor } from './text';

const LOCALES: Locale[] = ['en', 'es'];
const ids = (list: ReadonlyArray<{ id: string }>) => list.map((x) => x.id).sort();
const keys = (record: object) => Object.keys(record).sort();

/** Every string in a value, with the path that leads to it. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, entry]) => strings(entry, path === '' ? key : `${path}.${key}`));
}

/** The shape of a value: its keys, all the way down, without the strings. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe.each(LOCALES)('content text: %s', (locale) => {
  const text = rawText(locale);
  const pack = names[locale];

  it('names every city, asset and item, and nothing that does not exist', () => {
    expect(keys(pack.cities)).toEqual(ids(content.cities));
    expect(keys(pack.assets)).toEqual(ids(content.assets));
    expect(keys(pack.items)).toEqual(ids(content.items));
    for (const asset of Object.values(pack.assets)) {
      expect(asset.ticker).toMatch(/^[A-Z0-9]{2,5}$/);
    }
    expect(new Set(Object.values(pack.assets).map((a) => a.ticker)).size).toBe(content.assets.length);
  });

  it('describes every city, asset, career, ladder, home and life, and nothing that does not exist', () => {
    expect(keys(text.cities)).toEqual(ids(content.cities));
    expect(keys(text.assets)).toEqual(ids(content.assets));
    expect(keys(text.careers)).toEqual(ids(content.careers));
    for (const career of content.careers) {
      expect(text.careers[career.id].levels, career.id).toHaveLength(career.levels.length);
    }
    expect(keys(text.ladders)).toEqual([...new Set(content.items.map((item) => item.ladder))].sort());
    expect(keys(text.propertyTypes)).toEqual(ids(content.propertyTypes));
    expect(keys(text.lives)).toEqual(ids(lives));
    expect(keys(text.assetClasses)).toEqual([...new Set(content.assets.map((a) => a.class))].sort());
  });

  it('has text for every card, with a label for each option and a line for each outcome', () => {
    expect(keys(text.cards)).toEqual(ids(content.cards));
    for (const card of content.cards) {
      const written = text.cards[card.id];
      expect(written.options, card.id).toHaveLength(card.options.length);
      card.options.forEach((option, i) => {
        expect(written.options[i].outcomes, `${card.id} option ${i}`).toHaveLength(option.outcomes?.length ?? 0);
      });
    }
  });

  it('has no empty sentence and no stray space', () => {
    for (const [path, sentence] of strings(text)) {
      expect(sentence.trim().length, path).toBeGreaterThan(0);
      expect(sentence, path).toBe(sentence.trim());
      expect(sentence, path).not.toMatch(/ {2}/);
    }
  });

  it('is typeset one way throughout', () => {
    const all = strings(text);
    const broken = (test: (sentence: string) => boolean) => all.filter(([, sentence]) => test(sentence)).map(([path]) => path);
    // Three dots are one character, and a dash is never a spaced hyphen.
    expect(broken((s) => s.includes('...'))).toEqual([]);
    expect(broken((s) => / - /.test(s))).toEqual([]);
    expect(broken((s) => / [,.;:!?](\s|$)/.test(s))).toEqual([]);
    if (locale === 'en') {
      // English: straight apostrophes and quotes, and a percent sign against its number.
      expect(broken((s) => /[‘’“”«»]/.test(s))).toEqual([]);
      expect(broken((s) => /\d %/.test(s))).toEqual([]);
    } else {
      // Spanish: angle quotes, a space before the percent sign, and a question or an exclamation opened as well as closed.
      expect(broken((s) => /["“”]/.test(s))).toEqual([]);
      expect(broken((s) => /\d%/.test(s))).toEqual([]);
      expect(broken((s) => (s.match(/\?/g)?.length ?? 0) !== (s.match(/¿/g)?.length ?? 0))).toEqual([]);
      expect(broken((s) => (s.match(/!/g)?.length ?? 0) !== (s.match(/¡/g)?.length ?? 0))).toEqual([]);
    }
  });

  it('keeps titles and option labels short enough for a phone', () => {
    for (const card of Object.values(text.cards)) {
      expect(card.title.length, card.title).toBeLessThanOrEqual(45);
      expect(card.body.length, card.title).toBeLessThanOrEqual(140);
      for (const option of card.options) {
        expect(option.label.length, option.label).toBeLessThanOrEqual(60);
        for (const outcome of option.outcomes) expect(outcome.length, outcome).toBeLessThanOrEqual(90);
      }
    }
  });

  it('fills every name placeholder, and leaves only the ones the interface fills', () => {
    const { text: ready } = textFor(locale);
    for (const [path, sentence] of strings(ready)) {
      const left = sentence.match(/\{[^}]*\}/g) ?? [];
      expect(left.filter((p) => p !== '{city}'), path).toEqual([]);
    }
    expect(ready.cards.life_rolex_call.body).toContain(pack.items.watch_rolex);
    expect(ready.cards.inv_hot_tip.body).toContain('Tesla');
  });

  it('refuses a placeholder the name pack does not know', () => {
    expect(() => fillNames('A {item:jetpack} for you', pack)).toThrow('no name for {item:jetpack}');
    expect(() => fillNames('{asset:tulips}', pack)).toThrow('no name for {asset:tulips}');
    expect(fillNames('Move to {city:dubai} with {brand:google}', pack)).toBe(`Move to ${pack.cities.dubai} with Google`);
  });

  it('can be shown with a different name pack', () => {
    const parody = structuredClone(pack);
    parody.items.watch_rolex = 'Rolecks Diver';
    expect(textFor(locale, parody).text.cards.life_rolex_call.body).toContain('Rolecks Diver');
  });
});

describe('content text: the two languages together', () => {
  it('have the same shape, key for key', () => {
    expect(shape(rawText('es'))).toEqual(shape(rawText('en')));
    expect(shape(names.es)).toEqual(shape(names.en));
  });

  it('use the same placeholders in the same sentences', () => {
    const placeholders = (sentence: string) => (sentence.match(/\{[^}]*\}/g) ?? []).sort();
    const spanish = new Map(strings(rawText('es')));
    for (const [path, sentence] of strings(rawText('en'))) {
      expect(placeholders(spanish.get(path) ?? ''), path).toEqual(placeholders(sentence));
    }
  });

  it('are really two languages: Spanish card text is not a copy of the English', () => {
    /** Words that are the same in both languages. */
    const same = new Set(['cards.life_ibiza.title', 'cards.life_black_friday.title', 'cards.luck_lottery.title', 'cards.career_remote_work.options.2.outcomes.1']);
    const spanish = new Map(strings(rawText('es').cards, 'cards'));
    const copies = strings(rawText('en').cards, 'cards').filter(([path, sentence]) => spanish.get(path) === sentence && !same.has(path));
    expect(copies).toEqual([]);
  });
});

describe('content art', () => {
  const path = fileURLToPath(new URL('../../../art/clean/manifest.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as { sprites: Record<string, unknown> };
  const has = (sprite: string) => Object.hasOwn(manifest.sprites, sprite);

  it('gives every card a scene, and no scene to a card that does not exist', () => {
    expect(keys(cardArt)).toEqual(ids(content.cards));
  });

  it('points only at sprites that exist', () => {
    const wanted: string[] = [
      ...Object.values(cardArt),
      ...content.items.map((item) => itemArt(item.id)),
      ...content.propertyTypes.map((type) => propertyArt(type.id)),
      ...rentTierArt,
      ...content.cities.map((city) => cityArt(city.id)),
      ...lives.flatMap((life) => PORTRAIT_AGES.map((age) => portraitArt(life.id, age))),
      ...Object.values(assetClassArt),
    ];
    expect(wanted.filter((sprite) => !has(sprite))).toEqual([]);
    expect(wanted.length).toBe(100 + 34 + 5 + 2 + 6 + 24 + 5);
  });
});
