import { applyRound, createGame, quoteItem, validateContent, validateStart, viewOf } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { assetKind } from './kinds';
import { START_AGE } from './badges';
import { content } from './content';
import { lives } from './lives';

describe('the v1 content', () => {
  it('is valid', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('has the size the spec sets', () => {
    expect(content.cities.map((c) => c.id)).toEqual(['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok']);
    expect(content.assets).toHaveLength(19);
    expect(content.careers).toHaveLength(11);
    expect(content.items).toHaveLength(55);
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
    expect(content.cards).toHaveLength(108);
    expect(lives).toHaveLength(11);
  });

  it('has the number of cards the spec sets for each category', () => {
    const count: Record<string, number> = {};
    for (const card of content.cards) count[card.category] = (count[card.category] ?? 0) + 1;
    expect(count).toEqual({
      career: 14, education: 6, business: 8, investing: 10, housing: 8, lifestyle: 10,
      family: 10, health: 5, luck: 8, world: 18, tax: 6, laterLife: 5,
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

  it('deals a card set at work only to someone with a job, and the first car only to someone with none', () => {
    const when = (id: string) => content.cards.find((card) => card.id === id)?.when ?? {};
    // Each of these speaks of an office, an employer or a new job in its text.
    for (const id of ['luck_lottery', 'life_car_finance', 'world_ai_boom', 'crisis_crash_layoffs']) expect(when(id).employed, id).toBe(true);
    expect(when('life_car_finance').lacksLadder).toBe('car');
  });

  it('sells on instalments every car and nothing that is used up, and takes status from a frugal life', () => {
    const view = viewOf(createGame({ content, start: lives[0].start }, 'instalments'));
    const financed = content.items.filter((item) => quoteItem(content, view, item.id).finance !== null);
    for (const item of financed) expect(item.kind, item.id).toBe('durable');
    for (const item of content.items.filter((x) => x.ladder === 'car')) expect(financed, item.id).toContain(item);
    // The cheap end of a ladder is paid for at the till.
    expect(financed.map((item) => item.id)).not.toContain('watch_casio');
    for (const item of financed) {
      const quote = quoteItem(content, view, item.id);
      expect((quote.finance?.down ?? 0) + (quote.finance?.loan ?? 0), item.id).toBe(quote.price);
      expect(Math.abs((quote.finance?.down ?? 0) * 5 - quote.price), item.id).toBeLessThan(5);
    }
    expect(content.life.lifestyleStatus).toEqual([-3, 0, 3, 8]);
    // A rented room is neutral until twenty-six, two rounds in, and then costs what a frugal life does.
    expect(START_AGE + content.life.roomLateRound * content.yearsPerRound).toBe(26);
    expect(content.life.roomLateStatus).toBe(-3);
    expect(content.life.rentTierStatus).toEqual([0, 3]);
  });

  it('gives every city a trade or two it pays above the usual, and every career a city to go to', () => {
    const paid = new Set<string>();
    for (const city of content.cities) {
      const trades = Object.entries(city.careerPayPct ?? {});
      expect(trades.length, city.id).toBeGreaterThanOrEqual(1);
      expect(trades.length, city.id).toBeLessThanOrEqual(4);
      for (const [career, share] of trades) {
        expect(share, `${city.id} ${career}`).toBeGreaterThan(100);
        expect(share, `${city.id} ${career}`).toBeLessThanOrEqual(125);
        paid.add(career);
      }
    }
    expect([...paid].sort()).toEqual(content.careers.map((career) => career.id).sort());
    // Moving of one's own accord has a price beyond the fare.
    expect(content.life).toMatchObject({ moveRungsLost: 1, movePartnerPct: 50, moveChildPct: 25, partnerSettlingRounds: 1 });
  });

  it('makes the five newer careers each a different bet, and gives each a way in', () => {
    const career = (id: string) => content.careers.find((x) => x.id === id);
    const top = (id: string) => career(id)?.levels.at(-1)?.salaryPct ?? 0;
    // Law is the tallest ladder of all, and the slowest to climb.
    expect(top('law')).toBe(Math.max(...content.careers.map((x) => top(x.id))));
    expect(career('law')?.levels.at(-1)?.minSkill).toBe(Math.max(...content.careers.map((x) => x.levels.at(-1)?.minSkill ?? 0)));
    // Teaching pays little and leaves time; selling follows the economy both ways; an audience does not last.
    expect(career('education')).toMatchObject({ focus: 1 });
    expect(top('education')).toBe(Math.min(...content.careers.map((x) => top(x.id))));
    expect(career('sales')?.cyclePct).toMatchObject({ boom: 25, recession: -25 });
    expect(START_AGE + (career('influencer')?.fade?.fromRound ?? 0) * content.yearsPerRound).toBe(34);
    // Nothing pays overtime like a bar.
    expect(career('hospitality')?.overtimePct).toBe(Math.max(...content.careers.map((x) => x.overtimePct)));
    // Each can be reached from a card, by someone who is not already in it.
    const leads = new Set<string>();
    for (const card of content.cards) {
      for (const option of card.options) {
        for (const effects of [option.effects ?? {}, ...(option.outcomes ?? []).map((outcome) => outcome.effects)]) {
          if (effects.job?.career) leads.add(effects.job.career);
        }
      }
    }
    for (const id of ['law', 'education', 'influencer', 'hospitality', 'sales']) expect(leads, id).toContain(id);
  });

  it('makes the things that are good for something good for what their kind is', () => {
    const by = (ladder: string) => content.items.filter((item) => item.ladder === ladder);
    // Every car moves a life for less, and the dearest no more than the cheapest.
    expect(new Set(by('car').map((item) => item.perks?.moveCostOffPct))).toEqual(new Set([30]));
    // Watches, clothes and memberships help in a job hunt, more as they go up; nothing else does.
    for (const item of content.items) if (item.perks?.jobHuntPct) expect(['watch', 'fashion', 'membership'], item.id).toContain(item.ladder);
    const watches = by('watch').map((item) => item.perks?.jobHuntPct ?? 0);
    expect(watches).toEqual([...watches].sort((a, b) => a - b));
    // A rest needs a trip that is still going when the round ends: one that lasts a single round would promise what it cannot give.
    for (const item of content.items) if (item.perks?.focus) expect(item.kind === 'experience' && item.boostRounds >= 2, item.id).toBe(true);
    expect(by('travel').filter((item) => item.boostRounds >= 2).every((item) => item.perks?.focus === 1)).toBe(true);
    expect(content.items.find((item) => item.id === 'tech_laptop')?.perks).toEqual({ studySkill: 1 });
    expect(content.items.find((item) => item.id === 'edu_mba')?.perks).toEqual({ salaryPct: 10 });
    // Art and boats are status and nothing else.
    for (const item of [...by('art'), ...by('charter')]) expect(item.perks, item.id).toBeUndefined();
  });

  it('opens a better way through a card to someone with a car, and to someone who is a member somewhere', () => {
    const option = (id: string, index: number) => content.cards.find((card) => card.id === id)?.options[index];
    expect(option('biz_freelance_gig', 2)?.when).toEqual({ ownsLadder: 'car' });
    expect(option('biz_freelance_gig', 2)?.effects?.cash).toBeGreaterThan(option('biz_freelance_gig', 1)?.effects?.cash ?? 0);
    const odds = (index: number) => {
      const outcomes = option('biz_self_employed', index)?.outcomes ?? [];
      const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      return outcomes.reduce((sum, outcome) => sum + outcome.weight * (outcome.effects.salaryModPct ?? 0), 0) / total;
    };
    expect(option('biz_self_employed', 2)?.when).toEqual({ ownsLadder: 'membership' });
    expect(odds(2)).toBeGreaterThan(odds(1));
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

  it('gives every city one membership of its own, and sells a few other things only where they belong', () => {
    const local = content.items.filter((item) => item.cities !== undefined);
    const seats = local.filter((item) => item.kind === 'membership');
    expect(seats.map((item) => item.cities).flat().sort()).toEqual(content.cities.map((city) => city.id).sort());
    for (const seat of seats) expect(seat.cities, seat.id).toHaveLength(1);
    // What is not a membership goes along on a move, so it may be sold in more than one city.
    expect(local.filter((item) => item.kind !== 'membership').map((item) => [item.id, item.cities])).toEqual([
      ['fashion_suit', ['london']],
      ['travel_ski', ['madrid', 'london']],
      ['sea_motor_yacht', ['dubai', 'singapore']],
    ]);
    // A card hands a thing over wherever the player is, so no card may give what belongs to one city.
    const given = content.cards.flatMap((card) => card.options.flatMap((option) => [option.effects, ...(option.outcomes ?? []).map((o) => o.effects)])).map((effects) => effects?.buyItem?.itemId);
    for (const item of local) expect(given, item.id).not.toContain(item.id);
  });

  it('keeps each ladder a climb: no two rungs give the same status for the same price', () => {
    for (const ladder of new Set(content.items.map((item) => item.ladder))) {
      const rungs = content.items.filter((item) => item.ladder === ladder && item.cities === undefined);
      const seen = new Set(rungs.map((item) => `${item.price}:${item.status}`));
      expect(seen.size, ladder).toBe(rungs.length);
    }
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
