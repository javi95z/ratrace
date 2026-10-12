import { describe, expect, it } from 'vitest';
import { debtRateBp } from '../debt';
import { applyRound, createGame, previewRound } from '../game';
import { executeOrder } from '../orders';
import { newTally } from '../tally';
import { fixtureContent, fixturePlayer, fixtureStart } from '../testing/fixture';
import type { Content, GameEvent, LedgerLine, LifeStart, OrderContext, StartConfig } from '../types';
import { generateTimeline } from '../world';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };

function setup(over: Partial<StartConfig> = {}, life: Partial<LifeStart> = {}, content: Content = fixtureContent()) {
  const world = generateTimeline('life-orders', content)[0];
  const p = fixturePlayer({ cash: 5_000_000, ...over, life: { ...office, ...life } }, content);
  const ctx: OrderContext = { content, world, round: 0, tally: newTally() };
  const run = (order: unknown) => executeOrder(p, order, ctx);
  return { content, world, p, ctx, run };
}

const start = (over: Partial<StartConfig> = {}, life: Partial<LifeStart> = {}): StartConfig => ({
  ...fixtureStart(),
  cash: 5_000_000,
  ...over,
  life: { ...office, ...life },
});

const ledger = (events: GameEvent[], line: LedgerLine): number | undefined => {
  const found = events.find((e) => e.kind === 'ledger' && e.line === line);
  return found && found.kind === 'ledger' ? found.amount : undefined;
};

describe('focus orders', () => {
  it('spends a focus point and records the action', () => {
    const { p, ctx, run } = setup();
    expect(run({ type: 'focus', action: 'studyCareer' })).toBeNull();
    expect(run({ type: 'focus', action: 'jobHunt' })).toBeNull();
    expect(p.life.focusUsed).toBe(2);
    expect(ctx.tally.focusActions).toEqual(['studyCareer', 'jobHunt']);
  });

  it('raises this round’s salary for overtime', () => {
    const { p, run } = setup();
    expect(run({ type: 'focus', action: 'overtime' })).toBeNull();
    expect(p.life.salaryBoostPct).toBe(15);
    expect(p.life.focusUsed).toBe(1);
  });

  it('allows each action once a round', () => {
    const { p, run } = setup();
    run({ type: 'focus', action: 'overtime' });
    expect(run({ type: 'focus', action: 'overtime' })).toBe('already-done');
    expect(p.life.salaryBoostPct).toBe(15);
    expect(p.life.focusUsed).toBe(1);
  });

  it('refuses when no focus is left', () => {
    const { p, run } = setup({}, { focus: 1 });
    expect(run({ type: 'focus', action: 'overtime' })).toBeNull();
    expect(run({ type: 'focus', action: 'jobHunt' })).toBe('no-focus');
    expect(p.life.focusUsed).toBe(1);
  });

  it('refuses unknown and malformed actions, and a player with no career', () => {
    const { run } = setup();
    expect(run({ type: 'focus', action: 'nap' })).toBe('unknown-action');
    expect(run({ type: 'focus', action: 7 })).toBe('bad-order');
    expect(run({ type: 'focus' })).toBe('bad-order');
    const jobless = setup({}, { career: null });
    for (const action of ['overtime', 'studyCareer', 'jobHunt']) expect(jobless.run({ type: 'focus', action })).toBe('no-job');
    expect(jobless.p.life.focusUsed).toBe(0);
  });

  it('shows overtime pay in the preview, exactly', () => {
    const content = fixtureContent();
    const game = createGame({ content, start: start() }, 'overtime');
    const preview = previewRound(content, game, { orders: [{ type: 'focus', action: 'overtime' }] });
    expect(preview.income.salary).toBe(5_520_000);
    expect(preview.player.salaryAnnual).toBe(2_760_000);
    const { events } = applyRound(content, game, { orders: [{ type: 'focus', action: 'overtime' }] });
    expect(ledger(events, 'salary')).toBe(5_520_000);
  });
});

describe('item orders', () => {
  it('buys a durable: pays the price and owns it at its resale value', () => {
    const { p, run } = setup();
    expect(run({ type: 'buyItem', itemId: 'car_basic' })).toBeNull();
    expect(p.cash).toBe(3_800_000);
    expect(p.life.items).toEqual([{ itemId: 'car_basic', value: 960_000, roundsLeft: null }]);
    expect(p.life.collection).toEqual(['car_basic']);
  });

  it('charges the price of the day', () => {
    const { p, ctx, run } = setup();
    ctx.world = { ...ctx.world, priceLevel: 1_100_000 };
    expect(run({ type: 'buyItem', itemId: 'car_basic' })).toBeNull();
    expect(p.cash).toBe(5_000_000 - 1_320_000);
    expect(p.life.items[0].value).toBe(1_056_000);
  });

  it('buys a membership and an experience, which have no resale value', () => {
    const { p, run } = setup();
    expect(run({ type: 'buyItem', itemId: 'club' })).toBeNull();
    expect(run({ type: 'buyItem', itemId: 'trip' })).toBeNull();
    expect(p.cash).toBe(5_000_000 - 50_000 - 300_000);
    expect(p.life.items).toEqual([
      { itemId: 'club', value: 0, roundsLeft: null },
      { itemId: 'trip', value: 0, roundsLeft: 2 },
    ]);
  });

  it('refuses unknown items, a second copy, and a price above cash', () => {
    const { p, run } = setup({ cash: 1_500_000 });
    expect(run({ type: 'buyItem', itemId: 'jetpack' })).toBe('unknown-item');
    expect(run({ type: 'buyItem', itemId: '__proto__' })).toBe('unknown-item');
    expect(run({ type: 'buyItem', itemId: 5 })).toBe('bad-order');
    expect(run({ type: 'buyItem', itemId: 'car_sports' })).toBe('not-enough-cash');
    expect(run({ type: 'buyItem', itemId: 'car_basic' })).toBeNull();
    expect(run({ type: 'buyItem', itemId: 'car_basic' })).toBe('already-owned');
    expect(p.cash).toBe(300_000);
    expect(p.life.items).toHaveLength(1);
  });

  it('does not sell in the shop what only a card can give', () => {
    const content = fixtureContent();
    content.items = content.items.map((item) => (item.id === 'watch_gold' ? { ...item, cardOnly: true } : item));
    const { p, run } = setup({}, {}, content);
    expect(run({ type: 'buyItem', itemId: 'watch_gold' })).toBe('not-for-sale');
    expect(p.cash).toBe(5_000_000);
    expect(p.life.items).toEqual([]);
  });

  it('sells a durable for its value and keeps it in the collection', () => {
    const { p, run } = setup();
    run({ type: 'buyItem', itemId: 'car_basic' });
    expect(run({ type: 'sellItem', itemId: 'car_basic' })).toBeNull();
    expect(p.cash).toBe(5_000_000 - 1_200_000 + 960_000);
    expect(p.life.items).toEqual([]);
    expect(p.life.collection).toEqual(['car_basic']);
    run({ type: 'buyItem', itemId: 'car_basic' });
    expect(p.life.collection).toEqual(['car_basic']);
  });

  it('cancels a membership for nothing, and cannot sell an experience or what is not owned', () => {
    const { p, run } = setup();
    run({ type: 'buyItem', itemId: 'club' });
    run({ type: 'buyItem', itemId: 'trip' });
    const cash = p.cash;
    expect(run({ type: 'sellItem', itemId: 'club' })).toBeNull();
    expect(run({ type: 'sellItem', itemId: 'trip' })).toBe('cannot-sell');
    expect(run({ type: 'sellItem', itemId: 'car_basic' })).toBe('not-owned');
    expect(run({ type: 'sellItem', itemId: null })).toBe('bad-order');
    expect(p.cash).toBe(cash);
    expect(p.life.items).toEqual([{ itemId: 'trip', value: 0, roundsLeft: 2 }]);
  });

  it('reports what was spent on and raised from items in the ledger, and charges upkeep', () => {
    const content = fixtureContent();
    const game = createGame({ content, start: start() }, 'items');
    const first = applyRound(content, game, { orders: [{ type: 'buyItem', itemId: 'car_basic' }, { type: 'buyItem', itemId: 'watch_gold' }] });
    expect(ledger(first.events, 'itemPurchases')).toBe(-2_200_000);
    expect(ledger(first.events, 'otherExpenses')).toBe(-240_000);
    expect(first.state.player.statusPoints).toBe(4 + 12 + 2);
    const value = first.state.player.life.items.find((i) => i.itemId === 'watch_gold')!.value;
    const second = applyRound(content, first.state, { orders: [{ type: 'sellItem', itemId: 'watch_gold' }] });
    expect(ledger(second.events, 'itemSales')).toBe(value);
    expect(second.state.player.statusPoints).toBe(4 + 2);
  });
});

describe('lifestyle, rent and insurance orders', () => {
  it('changes the lifestyle tier, but not below the floor of the life', () => {
    const { p, run } = setup({ lifestyleTier: 2 }, { minLifestyleTier: 1 });
    expect(run({ type: 'setLifestyle', tier: 3 })).toBeNull();
    expect(p.lifestyleTier).toBe(3);
    expect(run({ type: 'setLifestyle', tier: 1 })).toBeNull();
    expect(run({ type: 'setLifestyle', tier: 0 })).toBe('below-lifestyle-floor');
    for (const tier of [4, -1, 1.5, '2', null, undefined]) expect(run({ type: 'setLifestyle', tier })).toBe('bad-tier');
    expect(p.lifestyleTier).toBe(1);
  });

  it('changes the rent tier', () => {
    const { p, run } = setup();
    expect(run({ type: 'setRentTier', tier: 0 })).toBeNull();
    expect(p.life.rentTier).toBe(0);
    for (const tier of [2, 0.5, '1']) expect(run({ type: 'setRentTier', tier })).toBe('bad-tier');
  });

  it('turns an insurance on and off', () => {
    const { p, run } = setup();
    expect(run({ type: 'setInsurance', insurance: 'health', on: true })).toBeNull();
    expect(p.life.insurance).toEqual({ health: true, home: false, life: false, liability: false });
    expect(run({ type: 'setInsurance', insurance: 'health', on: false })).toBeNull();
    expect(p.life.insurance.health).toBe(false);
    expect(run({ type: 'setInsurance', insurance: 'pet', on: true })).toBe('unknown-insurance');
    expect(run({ type: 'setInsurance', insurance: 'constructor', on: true })).toBe('unknown-insurance');
    expect(run({ type: 'setInsurance', insurance: 'health', on: 1 })).toBe('bad-order');
  });

  it('prices a rented room below a rented flat, and shows premiums in the preview', () => {
    const content = fixtureContent();
    const game = createGame({ content, start: start() }, 'costs');
    const before = previewRound(content, game, { orders: [] });
    expect(before.expenses.living).toBe(3_600_000);
    expect(before.expenses.other).toBe(0);
    const after = previewRound(content, game, {
      orders: [
        { type: 'setRentTier', tier: 0 },
        { type: 'setInsurance', insurance: 'health', on: true },
      ],
    });
    // Housing is 35% of 1,800,000; a room costs 60% of that, so 252,000 a year is saved.
    expect(after.expenses.living).toBe((1_800_000 - 252_000) * 2);
    expect(after.expenses.other).toBe(144_000);
    expect(after.player.statusPoints).toBe(0);
  });
});

describe('moving city', () => {
  it('pays the moving cost and a focus point now, and moves when the round has resolved', () => {
    const { p, ctx, run } = setup();
    expect(run({ type: 'moveCity', cityId: 'haven' })).toBeNull();
    expect(p.cash).toBe(5_000_000 - 800_000);
    expect(p.life.focusUsed).toBe(1);
    expect(p.life.movingTo).toBe('haven');
    expect(p.cityId).toBe('home');
    expect(ctx.tally.movingCost).toBe(800_000);
  });

  it('refuses bad destinations, a second move, no focus and no money', () => {
    const { p, run } = setup({ cash: 900_000 });
    expect(run({ type: 'moveCity', cityId: 'atlantis' })).toBe('unknown-city');
    expect(run({ type: 'moveCity', cityId: 'home' })).toBe('same-city');
    expect(run({ type: 'moveCity', cityId: 42 })).toBe('bad-order');
    expect(run({ type: 'moveCity', cityId: 'haven' })).toBeNull();
    expect(run({ type: 'moveCity', cityId: 'haven' })).toBe('already-moving');
    expect(p.cash).toBe(100_000);
    expect(setup({ cash: 700_000 }).run({ type: 'moveCity', cityId: 'haven' })).toBe('not-enough-cash');
    const tired = setup({}, { focus: 1 });
    tired.run({ type: 'focus', action: 'overtime' });
    expect(tired.run({ type: 'moveCity', cityId: 'haven' })).toBe('no-focus');
    expect(tired.p.life.movingTo).toBeNull();
  });

  it('reports the moving cost in the ledger and keeps this round in the old city', () => {
    const content = fixtureContent();
    const game = createGame({ content, start: start() }, 'move');
    const { state, events } = applyRound(content, game, { orders: [{ type: 'moveCity', cityId: 'haven' }] });
    expect(ledger(events, 'moving')).toBe(-800_000);
    expect(ledger(events, 'salary')).toBe(4_800_000);
    expect(ledger(events, 'living')).toBe(-3_600_000);
    expect(ledger(events, 'incomeTax')).toBeLessThan(0);
    expect(events).toContainEqual({ kind: 'moved', cityId: 'haven' });
    expect(state.player.cityId).toBe('haven');
    expect(state.player.life.movingTo).toBeNull();
    expect(state.player.salaryAnnual).toBe(4_800_000);
    expect(state.player.statusPoints).toBe(5 + 2);
  });
});

describe('finance skill', () => {
  const gated = (): Content => {
    const content = fixtureContent();
    content.assets = content.assets.map((a) => (a.class === 'crypto' ? { ...a, minFinanceSkill: 2 } : a.id === 'gold' ? { ...a, minFinanceSkill: 1 } : a));
    content.life.rentOutMinFinanceSkill = 2;
    return content;
  };

  it('locks assets above the player’s level, for buying only', () => {
    const novice = setup({}, {}, gated());
    expect(novice.run({ type: 'buy', assetId: 'coin_major', amount: 100_000 })).toBe('needs-finance-skill');
    expect(novice.run({ type: 'buy', assetId: 'gold', amount: 100_000 })).toBe('needs-finance-skill');
    expect(novice.run({ type: 'buy', assetId: 'fund_world', amount: 100_000 })).toBeNull();
    expect(novice.p.cash).toBe(4_900_000);
    novice.p.positions.coin_major = { value: 50_000, basis: 50_000 };
    expect(novice.run({ type: 'sell', assetId: 'coin_major', amount: 50_000 })).toBeNull();

    const learner = setup({}, { financeSkill: 1 }, gated());
    expect(learner.run({ type: 'buy', assetId: 'gold', amount: 100_000 })).toBeNull();
    expect(learner.run({ type: 'buy', assetId: 'coin_major', amount: 100_000 })).toBe('needs-finance-skill');
    expect(setup({}, { financeSkill: 2 }, gated()).run({ type: 'buy', assetId: 'coin_major', amount: 100_000 })).toBeNull();
  });

  it('locks renting a property out', () => {
    const novice = setup({ cash: 100_000_000 }, {}, gated());
    const buy = (rented: boolean) => ({ type: 'buyProperty', typeId: 'studio', downPayment: 0, mortgage: 'none', rented });
    expect(novice.run(buy(true))).toBe('needs-finance-skill');
    expect(novice.run(buy(false))).toBeNull();
    const id = novice.p.properties[0].id;
    expect(novice.run({ type: 'setRented', propertyId: id, rented: true })).toBe('needs-finance-skill');
    expect(novice.run({ type: 'setRented', propertyId: id, rented: false })).toBeNull();

    const expert = setup({ cash: 100_000_000 }, { financeSkill: 2 }, gated());
    expect(expert.run(buy(true))).toBeNull();
    expect(expert.run({ type: 'setRented', propertyId: expert.p.properties[0].id, rented: false })).toBeNull();
    expect(expert.run({ type: 'setRented', propertyId: expert.p.properties[0].id, rented: true })).toBeNull();
  });
});

describe('the cheap-mortgage perk', () => {
  const buy = (mortgage: 'fixed' | 'variable') => ({ type: 'buyProperty', typeId: 'studio', downPayment: 5_000_000, mortgage, rented: false });

  it('takes its discount off a fixed and a variable mortgage', () => {
    const plain = setup({ cash: 20_000_000 });
    plain.run(buy('fixed'));
    expect(plain.p.debts[0].fixedRateBp).toBe(400);

    const perk = setup({ cash: 20_000_000 }, { flags: ['cheap_mortgage'] });
    perk.run(buy('fixed'));
    expect(perk.p.debts[0].fixedRateBp).toBe(350);

    const variable = setup({ cash: 20_000_000 }, { flags: ['cheap_mortgage'] });
    variable.run(buy('variable'));
    expect(debtRateBp(variable.p.debts[0], variable.content, variable.world, variable.p)).toBe(350);
    plain.p.debts[0].kind = 'mortgageVariable';
    expect(debtRateBp(plain.p.debts[0], plain.content, plain.world, plain.p)).toBe(400);
  });
});
