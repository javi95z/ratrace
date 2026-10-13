import { applyRound, createGame, validateContent, validateStart } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { assetKind } from './art';
import { content } from './content';
import { lives } from './lives';

describe('the v1 content', () => {
  it('is valid', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('has the size the spec sets', () => {
    expect(content.cities.map((c) => c.id)).toEqual(['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok']);
    expect(content.assets).toHaveLength(19);
    expect(content.careers).toHaveLength(5);
    expect(content.items).toHaveLength(34);
    expect(content.propertyTypes.map((type) => type.id)).toEqual(['parking', 'studio', 'flat', 'shop', 'house', 'penthouse', 'villa']);
    // Two of them are investments only: nobody lives in a parking space or behind a shop counter.
    expect(content.propertyTypes.filter((type) => type.rentalOnly).map((type) => type.id)).toEqual(['parking', 'shop']);
    // What cannot be lived in lets for a little more than a home: that is all it is good for.
    for (const type of content.propertyTypes) expect((type.rentPct ?? 100) > 100, type.id).toBe(type.rentalOnly === true);
    // Dearest last, so the shop reads as a ladder.
    const prices = content.propertyTypes.map((type) => type.pricePct);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(content.cards).toHaveLength(100);
    expect(lives).toHaveLength(6);
  });

  it('has the number of cards the spec sets for each category', () => {
    const count: Record<string, number> = {};
    for (const card of content.cards) count[card.category] = (count[card.category] ?? 0) + 1;
    expect(count).toEqual({
      career: 12, education: 6, business: 8, investing: 10, housing: 8, lifestyle: 10,
      family: 10, health: 5, luck: 8, world: 12, tax: 6, laterLife: 5,
    });
  });

  it('groups assets the way the market screen shows them', () => {
    const groups: Record<string, string[]> = {};
    for (const asset of content.assets) (groups[assetKind(asset)] ??= []).push(asset.id);
    expect(groups.fund).toEqual(['sp500', 'msci_world']);
    expect(groups.bond).toEqual(['treasury_short', 'treasury_long', 'bund']);
    expect(groups.crypto).toEqual(['bitcoin', 'ethereum', 'dogecoin']);
    expect(groups.gold).toEqual(['gold']);
    expect(groups.stock).toHaveLength(10);
    // A fund is what a beginner may buy: it needs no finance skill.
    for (const asset of content.assets) expect((asset.minFinanceSkill ?? 0) === 0, asset.id).toBe(assetKind(asset) === 'fund');
  });

  it('never sells an item through a card for less than it could be sold on for at once', () => {
    const flips: string[] = [];
    for (const card of content.cards) {
      for (const option of card.options) {
        for (const effects of [option.effects ?? {}, ...(option.outcomes ?? []).map((o) => o.effects)]) {
          const deal = effects.buyItem;
          if (!deal || deal.pricePct === 0) continue;
          const item = content.items.find((i) => i.id === deal.itemId);
          if (item && item.kind === 'durable' && deal.pricePct < item.resaleStartPct) flips.push(`${card.id}: ${item.id} at ${deal.pricePct}%`);
        }
      }
    }
    expect(flips).toEqual([]);
  });

  it('gives every insurance a card that it softens or opens', () => {
    const used = new Set<string>();
    for (const card of content.cards) {
      for (const option of card.options) {
        if (option.when?.insured) used.add(option.when.insured);
        for (const effects of [option.effects ?? {}, ...(option.outcomes ?? []).map((o) => o.effects)]) {
          if (effects.protection?.insurance) used.add(effects.protection.insurance);
        }
      }
    }
    expect([...used].sort()).toEqual(['health', 'home', 'liability', 'life']);
  });

  it('reads every flag a life starts with, in a card or in the engine', () => {
    const engine = new Set(['unstable_pay', 'cheap_mortgage']);
    const read = new Set<string>();
    const note = (when: { flags?: string[]; notFlags?: string[] } | undefined) => {
      for (const flag of [...(when?.flags ?? []), ...(when?.notFlags ?? [])]) read.add(flag);
    };
    for (const card of content.cards) {
      note(card.when);
      for (const option of card.options) {
        note(option.when);
        for (const effects of [option.effects ?? {}, ...(option.outcomes ?? []).map((o) => o.effects)]) {
          if (effects.protection?.flag) read.add(effects.protection.flag);
        }
      }
    }
    for (const life of lives) {
      for (const flag of life.start.life?.flags ?? []) expect(engine.has(flag) || read.has(flag), `${life.id}: ${flag}`).toBe(true);
    }
  });

  it('keeps the numbers the spec names for a life and for bankruptcy', () => {
    expect(content.rounds).toBe(20);
    expect(content.yearsPerRound).toBe(2);
    expect(content.debt.bankruptcyStatusPenalty).toBe(25);
    expect(content.lifestyleMultiplierPct).toEqual([70, 100, 140, 200]);
    // A crypto winter takes three quarters: the one number that holds the gambler's band (spec 3.7).
    expect(content.market.cryptoMeanBp.winter).toBe(-7_500);
  });

  it('starts every life cleanly', () => {
    for (const life of lives) {
      expect(validateStart(content, life.start), life.id).toEqual([]);
      expect(life.start.life?.lifeId).toBe(life.id);
      const state = createGame({ content, start: life.start }, `start-${life.id}`);
      expect(state.hand.length, life.id).toBeGreaterThan(0);
      expect(applyRound(content, state, { orders: [] }).state.round).toBe(1);
    }
  });
});
