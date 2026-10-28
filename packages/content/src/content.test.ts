import { applyRound, assetYieldBp, previewCard, businessRound, createGame, depositRateBp, INDEX_START, quoteItem, validateContent, validateStart, viewOf } from '@ratrace/engine';
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
    expect(content.cities.map((c) => c.id)).toEqual(['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok', 'tokyo', 'moscow', 'mexico_city', 'zurich']);
    expect(content.assets).toHaveLength(22);
    expect(content.careers).toHaveLength(15);
    expect(content.items).toHaveLength(67);
    expect(content.propertyTypes.filter((type) => type.cities === undefined).map((type) => type.id)).toEqual([
      'parking', 'studio', 'flat', 'loft', 'shop', 'townhouse', 'house', 'office', 'duplex', 'warehouse', 'chalet', 'penthouse', 'estate', 'villa', 'block', 'mansion',
    ]);
    // Five of them are investments only: nobody lives in a parking space, behind a shop counter, at a desk, among pallets, or in twelve flats at once.
    expect(content.propertyTypes.filter((type) => type.rentalOnly && type.cities === undefined).map((type) => type.id)).toEqual(['parking', 'shop', 'office', 'warehouse', 'block']);
    // And each city sells one thing to let of its own, which nobody lives in either.
    const local = content.propertyTypes.filter((type) => type.cities !== undefined);
    expect(local.map((type) => type.cities).flat().sort()).toEqual(content.cities.map((city) => city.id).sort());
    for (const type of local) expect(type.rentalOnly, type.id).toBe(true);
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
    expect(content.cards).toHaveLength(338);
    expect(lives).toHaveLength(24);
  });

  it('has the number of cards the spec sets for each category', () => {
    const count: Record<string, number> = {};
    for (const card of content.cards) count[card.category] = (count[card.category] ?? 0) + 1;
    expect(count).toEqual({
      // Twenty-three of them are a city's own: six in career, six in housing, three in lifestyle and in tax, two in business, one in family, in luck and in investing.
      // And fourteen are of the wrong side of the law; six more of red tape and a bank freeze; fourteen of the famous;
      // ten of the troubles of a fortune: four in lifestyle, two in business and in family, one in luck and in tax.
      // And content 1.50's people who come back, the player's own three, the lodger's party and leaving, and a fake masterpiece:
      // four in career, eight in investing, four in housing, six in family, four in lifestyle and one in later life;
      // and the people, deeper: one more in career, investing, housing, family and lifestyle.
      // Content 1.52: the four careers added last, four cards each: twelve in career, three in housing and one in investing;
      // and three for each of the eleven careers before them: thirty-two in career and one in business.
      career: 90, education: 9, business: 26, investing: 30, housing: 36, lifestyle: 46,
      family: 28, health: 6, luck: 23, world: 18, tax: 14, laterLife: 12,
    });
  });

  it('groups assets the way the market screen shows them', () => {
    const groups: Record<string, string[]> = {};
    for (const asset of content.assets) (groups[assetKind(asset)] ??= []).push(asset.id);
    expect(groups.fund).toEqual(['sp500', 'msci_world', 'reit', 'small_caps']);
    expect(groups.bond).toEqual(['treasury_bills', 'treasury_short', 'treasury_long', 'bund']);
    expect(groups.crypto).toEqual(['bitcoin', 'ethereum', 'dogecoin']);
    expect(groups.gold).toEqual(['gold']);
    expect(groups.stock).toHaveLength(10);
    // Funds, bonds and shares are open from the first day; gold takes Finance 1, and coins Finance 2.
    const need = (id: string) => content.assets.find((asset) => asset.id === id)?.minFinanceSkill ?? 0;
    for (const id of [...groups.fund, ...groups.bond, ...groups.stock]) expect(need(id), id).toBe(0);
    expect(need('gold')).toBe(1);
    for (const id of groups.crypto) expect(need(id), id).toBe(2);
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
    expect(content.life.lifestyleStatus).toEqual([-2, 0, 3, 8]);
    expect(content.life.rentTierStatus).toEqual([0, 3]);
    // A rented room and a frugal life cost more status each decade: from 26, from 32 and from 40.
    const ages = (steps: ReadonlyArray<{ fromRound: number; status: number }>) => steps.map((step) => [START_AGE + step.fromRound * content.yearsPerRound, step.status]);
    expect(ages(content.life.agedStatus.room)).toEqual([[22, 0], [26, -3], [32, -6], [40, -10]]);
    expect(ages(content.life.agedStatus.frugal)).toEqual([[22, -2], [26, -4], [32, -7], [40, -11]]);
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

  it('gives every kind of business a size, a yield, a temper and a way in', () => {
    const view = viewOf(createGame({ content, start: lives[0].start }, 'business'));
    const kinds = content.business.types;
    expect(kinds.map((type) => type.id)).toEqual(['services', 'shop', 'app', 'bar', 'franchise']);
    for (const type of kinds) {
      expect(type.minCapital, type.id).toBeLessThan(type.scale);
      // Every kind suffers a recession, and none is spared a slowdown.
      expect(type.cyclePct.recession ?? 0, type.id).toBeLessThan(0);
      expect(type.cyclePct.slowdown ?? 0, type.id).toBeLessThan(0);
      // One opened at its least capital, run by its owner in an ordinary year, pays, and pays less than it yields on paper.
      const round = businessRound({ id: 'b', typeId: type.id, capital: type.minCapital, basis: type.minCapital, payoutPct: 100, manager: false, tended: true }, content, { ...view.timeline[0], regime: 'expansion' });
      expect(round.profit, type.id).toBeGreaterThan(0);
      expect(round.profit, type.id).toBeLessThan((type.minCapital * type.yieldBp * content.yearsPerRound * (100 + (type.cyclePct.expansion ?? 0))) / 1_000_000);
    }
    // A bar loses money in a recession; a franchise only makes less.
    expect(kinds.find((type) => type.id === 'bar')?.cyclePct.recession).toBeLessThan(-100);
    expect(kinds.find((type) => type.id === 'franchise')?.cyclePct.recession).toBeGreaterThan(-100);
    // The dearest to open is the cheapest to have run by someone else.
    const byCost = [...kinds].sort((a, b) => b.minCapital - a.minCapital);
    expect(byCost[0].managerPct).toBe(Math.min(...kinds.map((type) => type.managerPct)));
    // No sale from the tab pays more than is in the business; only a buyer's card does.
    for (const share of Object.values(content.business.salePct)) expect(share).toBeLessThanOrEqual(100);
    const offer = content.cards.find((card) => card.id === 'biz_acquisition')?.options[1].effects?.sellBusiness?.pricePct ?? 0;
    expect(offer).toBeGreaterThan(100);
    // Three cards open one, each of a kind that exists.
    const opened = content.cards.flatMap((card) => card.options.flatMap((option) => (option.outcomes ?? []).map((outcome) => outcome.effects.business?.typeId))).filter(Boolean);
    expect([...new Set(opened)].sort()).toEqual(['app', 'bar', 'shop']);
  });

  it('lends to buy investments only to a seasoned investor, at half the holding, and sells it at three quarters', () => {
    expect(content.debt).toMatchObject({ marginMaxPct: 50, marginCallPct: 75, marginMinFinanceSkill: 3 });
    // No life starts able to: it is earned by years with money invested.
    for (const life of lives) expect(life.start.life?.financeSkill ?? 0, life.id).toBeLessThan(3);
    // Every skill, money sense too, has the same levels, each a longer step than the last: mastering one takes five rounds of study.
    const [one, two, three] = content.life.skills.levelPoints;
    expect(two - one).toBeGreaterThan(one);
    expect(three - two).toBeGreaterThan(two - one);
    expect(Math.ceil(three / content.life.skills.studyPoints)).toBe(5);
    // No asset asks for the fourth level: it opens borrowed money, not a market.
    for (const asset of content.assets) expect(asset.minFinanceSkill ?? 0, asset.id).toBeLessThan(3);
  });

  it('lets cars and gadgets lose status as they age, and nothing that holds its value', () => {
    const view = viewOf(createGame({ content, start: lives[0].start }, 'aging'));
    const aging = content.items.filter((item) => quoteItem(content, view, item.id).ages);
    expect([...new Set(aging.map((item) => item.ladder))].sort()).toEqual(['car', 'tech']);
    expect(aging).toHaveLength(content.items.filter((item) => item.ladder === 'car' || item.ladder === 'tech').length);
    // New, a thing gives all it gives.
    for (const item of content.items) expect(quoteItem(content, view, item.id)).toMatchObject({ status: item.status, statusNew: item.status });
    expect(content.life.agingFloorPct).toBe(25);
  });

  it('makes the things that are good for something good for what their kind is', () => {
    const by = (ladder: string) => content.items.filter((item) => item.ladder === ladder);
    // Every car moves a life for less, and the dearest no more than the cheapest.
    expect(new Set(by('car').map((item) => item.perks?.moveCostOffPct))).toEqual(new Set([30]));
    // Watches, clothes, memberships and a certificate help in a job hunt, more as they go up; nothing else does.
    for (const item of content.items) if (item.perks?.jobHuntPct) expect(['watch', 'fashion', 'membership', 'education'], item.id).toContain(item.ladder);
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

  // A perk that does what an option does, only better, takes that option's place: the card shows one or the other, never both.
  // [card, the plain option, the option that does it better]; indexes stay where they were, as answers are kept by index.
  const UPGRADES: Array<[string, number, number]> = [
    ['career_raise', 2, 3],
    ['biz_freelance_gig', 1, 2],
    ['biz_self_employed', 1, 2],
    ['life_club_contacts', 2, 3],
    ['late_scam_call', 2, 3],
    ['celeb_kardashion', 1, 2],
    ['life_gig_apps', 1, 2],
    ['parents_inheritance', 1, 2],
    ['classmate_job', 1, 2],
    ['sales_quota', 1, 2],
  ];

  it('closes an option while the one that does it better is open, and only those', () => {
    const found: Array<[string, number, number]> = [];
    for (const card of content.cards)
      card.options.forEach((option, plain) => {
        if (option.when?.unless === undefined) return;
        const better = card.options.findIndex((other) => JSON.stringify(other.when) === JSON.stringify(option.when?.unless));
        expect(better, `${card.id} option ${plain}`).toBeGreaterThan(0);
        // Nothing else stands between the player and the plain option: it is open exactly where the better one is not.
        expect(option.when, `${card.id} option ${plain}`).toEqual({ unless: card.options[better].when });
        found.push([card.id, plain, better]);
      });
    expect(found.sort()).toEqual([...UPGRADES].sort());
  });

  it('offers the plain gig to someone without a car, and only the better one to someone with one', () => {
    const open = (car: boolean) => {
      const state = createGame({ content, start: lives[0].start }, 'perk');
      if (car) state.player.life.items.push({ itemId: 'car_seat_ibiza', value: 1, roundsLeft: null, paid: 0, age: 0 });
      return previewCard(content, viewOf({ ...state, hand: ['biz_freelance_gig'], answered: 0 }), 'biz_freelance_gig').map((option) => option.available);
    };
    expect(open(false)).toEqual([true, true, false]);
    expect(open(true)).toEqual([true, false, true]);
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
    expect([...used].sort()).toEqual(['health', 'home', 'life']);
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
    expect(content.market.cryptoMeanBp.winter).toBe(-5_500);
  });

  it('starts the crypto kid with a coin no order of his could not have bought, and the founder with a business to sell', () => {
    const kid = createGame({ content, start: lives.find((life) => life.id === 'crypto_kid')!.start }, 'kid');
    expect(kid.player.positions).toEqual({ bitcoin: { value: 2_000_000, basis: 2_000_000 } });
    expect(kid.player.life.financeSkill).toBe(content.assets.find((asset) => asset.id === 'bitcoin')?.minFinanceSkill);

    const founder = createGame({ content, start: lives.find((life) => life.id === 'founder')!.start }, 'founder');
    // A shop that pays from the first round, run by its owner, and a buyer's card that asks for nothing else.
    expect(founder.player.businesses).toMatchObject([{ typeId: 'shop', capital: 4_000_000, basis: 4_000_000, manager: false, tended: true }]);
    expect(businessRound(founder.player.businesses[0], content, founder.timeline[0]).payout).toBeGreaterThan(0);
    expect(content.cards.find((card) => card.id === 'biz_acquisition')?.when).toEqual({ hasBusiness: true });
    expect(founder.player.life.flags).toEqual({});
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
      ['travel_ski', ['madrid', 'london', 'zurich']],
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

  it('sells Treasury bills that keep their price, pay a little under the rate of the day and more than savings', () => {
    const bills = content.assets.find((asset) => asset.id === 'treasury_bills')!;
    let state = createGame({ content, start: lives[0].start }, 'bills');
    state.player.cash = 10_000_000;
    state.player.life.financeSkill = 1;
    for (let round = 0; round < content.rounds && !state.finished; round++) {
      const orders = round === 0 ? [{ type: 'buy' as const, assetId: 'treasury_bills', amount: 5_000_000 }] : [];
      const world = state.timeline[state.round];
      expect(assetYieldBp(bills, world)).toBe(Math.max(0, world.policyRateBp - 25));
      expect(assetYieldBp(bills, world)).toBeGreaterThanOrEqual(depositRateBp(content, world));
      state = applyRound(content, state, { orders }).state;
      // Whatever the rates did, a bill is worth what was paid for it.
      expect(state.timeline[state.round].assetIndex.treasury_bills).toBe(INDEX_START);
      expect(state.player.positions.treasury_bills).toEqual({ value: 5_000_000, basis: 5_000_000 });
    }
  });

  it('buys Treasury bills every round on a plan, as any other investment', () => {
    let state = createGame({ content, start: lives[0].start }, 'bills plan');
    state.player.cash = 10_000_000;
    state.player.life.financeSkill = 1;
    state = applyRound(content, state, { orders: [{ type: 'setPlan', assetId: 'treasury_bills', amount: 100_000 }] }).state;
    state = applyRound(content, state, { orders: [] }).state;
    expect(state.player.positions.treasury_bills).toEqual({ value: 200_000, basis: 200_000 });
    expect(state.player.plans).toEqual([{ assetId: 'treasury_bills', amount: 100_000, invested: 200_000, rounds: 2 }]);
  });

  it('makes the misfortunes of the body and of work grow with age, and offers the choices of a working life ending only at its end', () => {
    const card = (id: string) => content.cards.find((each) => each.id === id)!;
    expect(content.cards.filter((each) => each.risk === 'health').map((each) => each.id)).toEqual(['health_illness', 'health_burnout', 'health_dental', 'health_injury']);
    expect(content.cards.filter((each) => each.risk === 'job').map((each) => each.id).sort()).toEqual(['career_layoff', 'career_restructuring']);
    // Every way an illness is met leaves it on the record for an insurer.
    expect(card('health_illness').options.every((option) => option.effects?.setFlags?.includes('had_illness'))).toBe(true);
    // Retiring is open from 56, and the late cards come then too.
    expect(START_AGE + content.life.retireFromRound * content.yearsPerRound).toBe(56);
    for (const id of ['late_early_retirement', 'late_gift', 'late_business_handover']) expect(card(id).when?.minRound, id).toBe(content.life.retireFromRound);
    expect(card('late_early_retirement').options[1].effects).toMatchObject({ retire: true });
    expect(card('late_gift').when).toMatchObject({ minChildren: 1 });
    expect(card('late_business_handover').options[2]).toMatchObject({ when: { minChildren: 1 }, effects: { gift: { business: true } } });
    // From 50 the body is twice as likely to fail, and three times from 56; skill takes it back down.
    expect(content.life.riskByAge.health.map(({ fromRound, pct }) => [START_AGE + fromRound * content.yearsPerRound, pct])).toEqual([[22, 100], [40, 150], [50, 200], [56, 300]]);
    expect(content.life.skills.healthRiskOffPct * 3).toBeLessThan(100);
  });
});
