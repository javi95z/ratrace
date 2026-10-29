import { describe, expect, it } from 'vitest';
import type { CardDef, CardOption, Effects } from '@ratrace/engine';
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

  it('deals the people, deeper, only where their stories put them', () => {
    const when = (id: string) => byId.get(id)!.when ?? {};
    // The housewarming is for a tenant; the parents visit before they need care; the bell rings once the founder made it;
    // the boss retires late in a life, and offers her contacts only to someone she was warm to.
    expect(when('classmate_housewarming').ownsHome).toBe(false);
    expect(when('parents_visit').maxRound!).toBeLessThan(when('parents_care').minRound!);
    expect(when('founder_bell').flags).toEqual(['founder_won']);
    expect(when('founder_bell').notRecentFlag).toEqual({ flag: 'founder_won', rounds: 2 });
    expect(when('boss_retire').flags).toEqual(['boss_warm']);
    expect(when('boss_retire').minRound!).toBeGreaterThanOrEqual(14);
    for (const id of ['classmate_housewarming', 'cousin_yacht', 'parents_visit', 'founder_bell', 'boss_retire']) expect(byId.get(id)!.once, id).toBe(true);
  });

  it("names the player's own people only in the body of their cards", () => {
    const named: string[] = [];
    for (const locale of ['en', 'es', 'ru'] as const)
      for (const [cardId, card] of Object.entries(rawText(locale).cards)) {
        const elsewhere = [card.title, ...card.options.flatMap((option) => [option.label, ...option.outcomes, option.after ?? ''])];
        expect(elsewhere.filter((line) => line.includes('{rival:')), cardId).toEqual([]);
        if (card.body.includes('{rival:')) named.push(`${locale} ${cardId}`);
      }
    expect(named.filter((entry) => entry.startsWith('en ')).sort()).toEqual(['en classmate_housewarming', 'en classmate_job', 'en cousin_wedding', 'en cousin_yacht', 'en ex_new_car']);
  });
});

describe('what the people\'s cards leave behind', () => {
  const card = (id: string) => byId.get(id)!;
  it('lets a forgiven loan go: nothing is still owed, and he is not cold', () => {
    const forgiven = card('inlaw_repay').options[1].effects!;
    expect(forgiven.clearFlags).toEqual(expect.arrayContaining(['inlaw_owes', 'inlaw_cold']));
    expect(forgiven.setFlags).toEqual(expect.arrayContaining(['inlaw_warm', 'inlaw_forgiven']));
  });

  it('never deals two layoffs in one round: each marks the player laid off, and neither comes the round one did', () => {
    for (const id of ['career_layoff', 'boss_layoffs']) {
      const layoff = card(id);
      expect(layoff.when?.notRecentFlag, id).toEqual({ flag: 'laid_off', rounds: 1 });
      for (const [i, option] of layoff.options.entries()) expect(option.effects?.setFlags ?? [], `${id} option ${i}`).toContain('laid_off');
    }
  });

  it('keeps the landlord in the city the tenancy began in: his later cards need the flag a move clears', () => {
    for (const id of ['landlord_raise', 'landlord_sale']) expect(card(id).when?.flags ?? [], id).toContain('landlord_here');
    for (const option of card('landlord_damp').options) expect(option.effects?.setFlags ?? []).toContain('landlord_here');
  });

  it('takes the parents\' inheritance as it comes, debts and all, or with the benefit of inventory, which never costs more than its fee', () => {
    const [renounce, asItComes, knowsPapers, inventory] = card('parents_inheritance').options;
    const cashOf = (effects: Effects | undefined) => effects?.cash ?? 0;
    const worst = (option: CardOption) => cashOf(option.effects) + Math.min(...(option.outcomes ?? [{ effects: {} }]).map((o) => cashOf(o.effects)));
    const best = (option: CardOption) => cashOf(option.effects) + Math.max(...(option.outcomes ?? [{ effects: {} }]).map((o) => cashOf(o.effects)));
    expect(cashOf(renounce.effects)).toBe(0);
    // As it comes: the estate, or the debts it leaves, which are told.
    expect(asItComes.outcomes?.map((o) => o.weight)).toEqual([60, 40]);
    expect(worst(asItComes)).toBeLessThan(0);
    expect(asItComes.outcomes?.[1].effects.setFlags).toContain('parents_debts');
    // With the benefit of inventory: a notary's fee, the same estate on the same odds, and the debts never past what is left.
    const fee = -cashOf(inventory.effects);
    const gain = best(asItComes);
    expect(fee).toBeGreaterThanOrEqual(gain * 0.05);
    expect(fee).toBeLessThanOrEqual(gain * 0.08);
    expect(inventory.outcomes?.map((o) => o.weight)).toEqual([60, 40]);
    expect(worst(inventory)).toBe(-fee);
    expect(best(inventory)).toBe(gain - fee);
    expect(inventory.outcomes?.[1].effects.setFlags).toContain('parents_debts');
    // One who knows their papers knows there are no debts: the sure estate, in place of both ways of accepting it blind.
    expect(knowsPapers.when).toEqual({ flags: ['parents_warm'] });
    expect(cashOf(knowsPapers.effects)).toBe(gain);
    for (const blind of [asItComes, inventory]) expect(blind.when).toEqual({ unless: { flags: ['parents_warm'] } });
  });
});
