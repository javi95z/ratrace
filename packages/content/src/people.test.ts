import { describe, expect, it } from 'vitest';
import type { CardDef, Effects } from '@ratrace/engine';
import { content } from './content';
import { cardPeople, metFlag, PEOPLE, personEndings } from './people';
import { rawText } from './text';

/** Every effect an option of a card can have: its own and each outcome's. */
const effectsOf = (card: CardDef): Effects[] => card.options.flatMap((option) => [option.effects ?? {}, ...(option.outcomes ?? []).map((outcome) => outcome.effects)]);
/** Every flag some card of the game sets. */
const setSomewhere = new Set(content.cards.flatMap((card) => effectsOf(card).flatMap((effects) => [...(effects.setFlags ?? []), ...Object.values(effects.onceMore ?? {})])));
const byId = new Map(content.cards.map((card) => [card.id, card]));

describe('the people who come back', () => {
  it('names the cards of each person, every one of which says the life met them, whatever is chosen', () => {
    for (const [cardId, { who }] of Object.entries(cardPeople)) {
      const card = byId.get(cardId);
      expect(card, cardId).toBeDefined();
      expect(cardId.startsWith(`${who}_`), cardId).toBe(true);
      for (const [i, option] of card!.options.entries()) expect(option.effects?.setFlags ?? [], `${cardId} option ${i}`).toContain(metFlag(who));
    }
    // Every card of theirs is in the map, and every person has cards.
    const theirs = content.cards.filter((card) => PEOPLE.some((who) => card.id.startsWith(`${who}_`))).map((card) => card.id);
    expect(theirs.sort()).toEqual(Object.keys(cardPeople).sort());
    for (const who of PEOPLE) expect(Object.values(cardPeople).some((entry) => entry.who === who), who).toBe(true);
  });

  it('deals each later card of a story only on flags some card sets, never in the round that set them', () => {
    for (const cardId of Object.keys(cardPeople)) {
      const when = byId.get(cardId)!.when ?? {};
      for (const flag of when.flags ?? []) expect(setSomewhere.has(flag), `${cardId} needs ${flag}`).toBe(true);
      if (when.notRecentFlag !== undefined) expect(setSomewhere.has(when.notRecentFlag.flag), cardId).toBe(true);
      // A follow-up waits a round at least for what it needs (`landlord_raise` and `landlord_sale` count from `landlord_since`).
      const needs = (when.flags ?? []).filter((flag) => !flag.endsWith('_met') && !flag.endsWith('_warm'));
      if (needs.length > 0) expect(when.notRecentFlag?.rounds ?? 0, cardId).toBeGreaterThanOrEqual(1);
    }
  });

  it('ends each story by its flags, the last ending always, every ending told in every language', () => {
    for (const who of PEOPLE) {
      const endings = personEndings[who];
      expect(endings.at(-1)?.flags ?? [], who).toEqual([]);
      for (const ending of endings) {
        for (const flag of [...(ending.flags ?? []), ...(ending.notFlags ?? [])]) expect(setSomewhere.has(flag), `${who}.${ending.id}: ${flag}`).toBe(true);
        for (const locale of ['en', 'es', 'ru'] as const) expect(rawText(locale).people[who].endings[ending.id], `${locale} ${who}.${ending.id}`).toBeTruthy();
      }
      for (const locale of ['en', 'es', 'ru'] as const) expect(Object.keys(rawText(locale).people[who].endings).sort(), locale).toEqual(endings.map((ending) => ending.id).sort());
    }
  });

  it("names the player's own people only in the body of their three cards", () => {
    const named: string[] = [];
    for (const locale of ['en', 'es', 'ru'] as const)
      for (const [cardId, card] of Object.entries(rawText(locale).cards)) {
        const elsewhere = [card.title, ...card.options.flatMap((option) => [option.label, ...option.outcomes, option.after ?? ''])];
        expect(elsewhere.filter((line) => line.includes('{rival:')), cardId).toEqual([]);
        if (card.body.includes('{rival:')) named.push(`${locale} ${cardId}`);
      }
    expect(named.filter((entry) => entry.startsWith('en ')).sort()).toEqual(['en classmate_job', 'en cousin_wedding', 'en ex_new_car']);
  });
});
