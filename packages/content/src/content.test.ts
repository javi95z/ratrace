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
    expect(content.careers).toHaveLength(6);
    expect(content.items).toHaveLength(39);
    expect(content.propertyTypes.map((type) => type.id)).toEqual([
      'parking', 'studio', 'flat', 'loft', 'shop', 'townhouse', 'house', 'office', 'duplex', 'warehouse', 'chalet', 'penthouse', 'estate', 'villa', 'block', 'mansion',
    ]);
    // Five of them are investments only: nobody lives in a parking space, behind a shop counter, at a desk, among pallets, or in twelve flats at once.
    expect(content.propertyTypes.filter((type) => type.rentalOnly).map((type) => type.id)).toEqual(['parking', 'shop', 'office', 'warehouse', 'block']);
    // Among homes, a dearer one is always the grander one: no home is a worse buy than a cheaper one for someone who wants status.
    const homes = content.propertyTypes.filter((type) => !type.rentalOnly);
    for (let i = 1; i < homes.length; i++) expect(homes[i].status, homes[i].id).toBeGreaterThan(homes[i - 1].status);
    // Only what cannot be lived in has a rent of its own. A parking space lets for a little less than a home,
    // because its small price is already an advantage; the dearer kinds let for a little more.
    for (const type of content.propertyTypes) expect(type.rentPct !== undefined, type.id).toBe(type.rentalOnly === true);
    const rent = Object.fromEntries(content.propertyTypes.filter((type) => type.rentalOnly).map((type) => [type.id, type.rentPct]));
    expect(rent.parking).toBeLessThan(100);
    for (const id of ['shop', 'office', 'warehouse', 'block']) expect(rent[id], id).toBeGreaterThan(100);
    // Dearest last, so the shop reads as a ladder.
    const prices = content.propertyTypes.map((type) => type.pricePct);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(content.cards).toHaveLength(100);
    expect(lives).toHaveLength(11);
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

  it('starts the crypto kid with a coin no order of his could not have bought, and the founder with a business to sell', () => {
    const kid = createGame({ content, start: lives.find((life) => life.id === 'crypto_kid')!.start }, 'kid');
    expect(kid.player.positions).toEqual({ bitcoin: { value: 2_000_000, basis: 2_000_000 } });
    expect(kid.player.life.financeSkill).toBe(content.assets.find((asset) => asset.id === 'bitcoin')?.minFinanceSkill);

    const founder = createGame({ content, start: lives.find((life) => life.id === 'founder')!.start }, 'founder');
    expect(founder.player.extraPassiveAnnual).toBe(600_000);
    // The card that buys a business out ends it by its tag, and asks for the flag.
    expect(Object.keys(founder.player.life.flags)).toEqual(['has_business']);
    expect(founder.player.life.recurring.map((entry) => entry.tag)).toEqual(['shop']);
  });

  it('starts every life at a rung its experience holds, so the first round neither promotes nor demotes', () => {
    for (const life of lives) {
      const job = life.start.life?.career;
      if (!job) continue;
      const levels = content.careers.find((career) => career.id === job.id)!.levels;
      const skill = life.start.life?.careerSkill ?? 0;
      expect(skill, life.id).toBeGreaterThanOrEqual(levels[job.level].minSkill);
      // The newcomer's language is worth two points of experience, short of the next rung.
      if (levels[job.level + 1]) expect(skill, life.id).toBeLessThan(levels[job.level + 1].minSkill);
    }
  });

  it('gives every city one seat of its own, sold nowhere else, and ties nothing else to a city', () => {
    const local = content.items.filter((item) => item.cities !== undefined);
    expect(local.map((item) => item.cities).flat().sort()).toEqual(content.cities.map((city) => city.id).sort());
    for (const item of local) {
      expect(item.kind, item.id).toBe('membership');
      expect(item.cities, item.id).toHaveLength(1);
    }
    // A card hands a thing over wherever the player is, so no card may give what belongs to one city.
    const given = content.cards.flatMap((card) => card.options.flatMap((option) => [option.effects, ...(option.outcomes ?? []).map((o) => o.effects)])).map((effects) => effects?.buyItem?.itemId);
    for (const item of local) expect(given, item.id).not.toContain(item.id);
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
