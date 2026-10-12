import { describe, expect, it } from 'vitest';
import { newPlayer } from './player';
import { executePortfolioOrder, growPortfolio } from './portfolio';
import type { PortfolioOrder } from './portfolio';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { OrderContext } from './types';
import { generateTimeline } from './world';

function setup(cash = 1_000_000) {
  const content = fixtureContent();
  const timeline = generateTimeline('portfolio', content);
  const p = newPlayer({ ...fixtureStart(), cash });
  const ctx: OrderContext = {
    content,
    world: timeline[0],
    round: 0,
    tally: { realisedGains: 0, pensionContribution: 0, purchaseTaxPaid: 0 },
  };
  return { content, timeline, p, ctx };
}

describe('portfolio orders', () => {
  it('buys: cash becomes a position with matching basis', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'fund_world', amount: 400_000 }, ctx)).toBeNull();
    expect(p.cash).toBe(600_000);
    expect(p.positions.fund_world).toEqual({ value: 400_000, basis: 400_000 });
  });

  it('sells part: realises the gain in proportion', () => {
    const { p, ctx } = setup();
    p.positions.fund_world = { value: 600_000, basis: 400_000 };
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'fund_world', amount: 300_000 }, ctx)).toBeNull();
    expect(p.positions.fund_world).toEqual({ value: 300_000, basis: 200_000 });
    expect(p.cash).toBe(1_300_000);
    expect(ctx.tally.realisedGains).toBe(100_000);
  });

  it('sells all: removes the position and realises a loss', () => {
    const { p, ctx } = setup();
    p.positions.coin_meme = { value: 50_000, basis: 400_000 };
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'coin_meme', amount: 50_000 }, ctx)).toBeNull();
    expect(p.positions.coin_meme).toBeUndefined();
    expect(ctx.tally.realisedGains).toBe(-350_000);
  });

  it('moves money in and out of the deposit', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'depositIn', amount: 700_000 }, ctx)).toBeNull();
    expect(executePortfolioOrder(p, { type: 'depositOut', amount: 200_000 }, ctx)).toBeNull();
    expect(p.deposit).toBe(500_000);
    expect(p.cash).toBe(500_000);
  });

  it('refuses to overspend, oversell or overdraw', () => {
    const { p, ctx } = setup(100);
    p.positions.gold = { value: 500, basis: 500 };
    p.deposit = 300;
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'gold', amount: 101 }, ctx)).toBe('not-enough-cash');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'gold', amount: 501 }, ctx)).toBe('exceeds-position');
    expect(executePortfolioOrder(p, { type: 'depositIn', amount: 101 }, ctx)).toBe('not-enough-cash');
    expect(executePortfolioOrder(p, { type: 'depositOut', amount: 301 }, ctx)).toBe('exceeds-deposit');
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 101 }, ctx)).toBe('not-enough-cash');
  });

  it('rejects malformed amounts and changes nothing', () => {
    const { p, ctx } = setup();
    p.positions.gold = { value: 500_000, basis: 500_000 };
    p.deposit = 500_000;
    const before = JSON.stringify({ p, tally: ctx.tally });
    const amounts = [0, -5, 12.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 2];
    for (const amount of amounts) {
      const orders: PortfolioOrder[] = [
        { type: 'buy', assetId: 'gold', amount },
        { type: 'sell', assetId: 'gold', amount },
        { type: 'depositIn', amount },
        { type: 'depositOut', amount },
        { type: 'pensionIn', amount },
      ];
      for (const order of orders) expect(executePortfolioOrder(p, order, ctx)).toBe('bad-amount');
    }
    expect(JSON.stringify({ p, tally: ctx.tally })).toBe(before);
  });

  it('rejects stale and hostile asset ids without touching prototypes', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'buy', assetId: 'nope', amount: 100 }, ctx)).toBe('unknown-asset');
    expect(executePortfolioOrder(p, { type: 'buy', assetId: '__proto__', amount: 100 }, ctx)).toBe('unknown-asset');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'fund_world', amount: 100 }, ctx)).toBe('no-position');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: '__proto__', amount: 100 }, ctx)).toBe('no-position');
    expect(executePortfolioOrder(p, { type: 'sell', assetId: 'constructor', amount: 100 }, ctx)).toBe('no-position');
    expect(({} as Record<string, unknown>).value).toBeUndefined();
    expect(p.cash).toBe(1_000_000);
  });
});

describe('pension contributions', () => {
  it('pays into the pension and records the contribution', () => {
    const { p, ctx } = setup();
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 250_000 }, ctx)).toBeNull();
    expect(p.pension).toBe(250_000);
    expect(p.cash).toBe(750_000);
    expect(ctx.tally.pensionContribution).toBe(250_000);
  });

  it("caps contributions at a share of the round's salary, across several orders", () => {
    const { p, ctx } = setup(5_000_000);
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 1_200_001 }, ctx)).toBe('over-pension-limit');
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 700_000 }, ctx)).toBeNull();
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 500_001 }, ctx)).toBe('over-pension-limit');
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 500_000 }, ctx)).toBeNull();
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 1 }, ctx)).toBe('over-pension-limit');
    expect(p.pension).toBe(1_200_000);
    expect(p.cash).toBe(3_800_000);
  });

  it('lets nobody without a salary pay in', () => {
    const { p, ctx } = setup(5_000_000);
    p.salaryAnnual = 0;
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 1 }, ctx)).toBe('over-pension-limit');
    expect(p.pension).toBe(0);
  });

  it('raises the cap with the price level', () => {
    const { p, ctx } = setup(5_000_000);
    const dearer = { ...ctx, world: { ...ctx.world, priceLevel: 2_000_000 } };
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 2_400_000 }, dearer)).toBeNull();
    expect(executePortfolioOrder(p, { type: 'pensionIn', amount: 1 }, dearer)).toBe('over-pension-limit');
  });
});

describe('portfolio growth', () => {
  it('applies each asset return to what is held', () => {
    const { content, timeline, p } = setup();
    p.positions.fund_world = { value: 1_000_000, basis: 900_000 };
    p.positions.coin_meme = { value: 200_000, basis: 200_000 };
    const after = {
      ...timeline[1],
      assetReturnBp: { ...timeline[1].assetReturnBp, fund_world: 1_000, coin_meme: -9_000 },
    };
    growPortfolio(p, content, timeline[0], after);
    expect(p.positions.fund_world).toEqual({ value: 1_100_000, basis: 900_000 });
    expect(p.positions.coin_meme).toEqual({ value: 20_000, basis: 200_000 });
  });

  it('grows the pension by the price return of its asset plus its reinvested yield', () => {
    const { content, timeline, p } = setup();
    p.pension = 500_000;
    const after = { ...timeline[1], assetReturnBp: { ...timeline[1].assetReturnBp, fund_world: 1_000 } };
    growPortfolio(p, content, timeline[0], after);
    expect(p.pension).toBe(500_000 + 50_000 + 18_000);
  });

  it('reinvests the yield the pension asset paid this round, not the one it will pay next', () => {
    const { content, timeline, p } = setup();
    p.pension = 500_000;
    const bondPension = { ...content, pensionAssetId: 'bond_long' };
    const after = { ...timeline[1], policyRateBp: 800, assetReturnBp: { ...timeline[1].assetReturnBp, bond_long: 0 } };
    growPortfolio(p, bondPension, timeline[0], after);
    expect(p.pension).toBe(500_000 + 30_000);
  });

  it('drops a position that falls to nothing', () => {
    const { content, timeline, p } = setup();
    p.positions.coin_meme = { value: 3, basis: 300 };
    const after = { ...timeline[1], assetReturnBp: { ...timeline[1].assetReturnBp, coin_meme: -9_500 } };
    growPortfolio(p, content, timeline[0], after);
    expect(p.positions.coin_meme).toBeUndefined();
  });
});
