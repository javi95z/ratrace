import { describe, expect, it } from 'vitest';
import { INDEX_START, PRICE_LEVEL_START } from './rates';
import { fixtureContent } from './testing/fixture';
import { generateTimeline } from './world';

const content = fixtureContent();

describe('world timeline', () => {
  it('has one state per round plus the start', () => {
    const t = generateTimeline('seed-a', content);
    expect(t).toHaveLength(content.rounds + 1);
    expect(t.map((w) => w.round)).toEqual(Array.from({ length: content.rounds + 1 }, (_, i) => i));
    expect(t[0].assetIndex.fund_world).toBe(INDEX_START);
    expect(t[0].assetReturnBp.fund_world).toBe(0);
    expect(t[0].propertyIndex.home).toBe(INDEX_START);
    expect(t[0].priceLevel).toBe(PRICE_LEVEL_START);
  });

  it('is identical for the same seed and different for another', () => {
    expect(generateTimeline('seed-a', content)).toEqual(generateTimeline('seed-a', content));
    expect(generateTimeline('seed-a', content)).not.toEqual(generateTimeline('seed-b', content));
  });

  it('stays inside its bounds with whole numbers across 300 seeds', () => {
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`bounds-${s}`, content)) {
        expect(w.policyRateBp).toBeGreaterThanOrEqual(0);
        expect(w.policyRateBp).toBeLessThanOrEqual(800);
        expect(w.inflationBp).toBeGreaterThanOrEqual(-100);
        expect(w.inflationBp).toBeLessThanOrEqual(1_200);
        const all = [
          w.policyRateBp,
          w.inflationBp,
          w.priceLevel,
          ...Object.values(w.assetReturnBp),
          ...Object.values(w.assetIndex),
          ...Object.values(w.propertyReturnBp),
          ...Object.values(w.propertyIndex),
        ];
        for (const v of all) expect(Number.isInteger(v)).toBe(true);
        for (const v of Object.values(w.assetReturnBp)) expect(v).toBeGreaterThanOrEqual(-9_500);
        for (const v of Object.values(w.propertyReturnBp)) expect(v).toBeGreaterThanOrEqual(-5_000);
        for (const v of [w.priceLevel, ...Object.values(w.assetIndex), ...Object.values(w.propertyIndex)]) {
          expect(v).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('moves bond prices against rate changes', () => {
    const t = generateTimeline('bond', content);
    for (let r = 1; r < t.length; r++) {
      const rateChange = t[r].policyRateBp - t[r - 1].policyRateBp;
      expect(t[r].assetReturnBp.bond_long).toBe(-8 * rateChange + 0);
    }
  });

  it('keeps each index in step with its returns', () => {
    const t = generateTimeline('index', content);
    for (let r = 1; r < t.length; r++) {
      const expected = Math.max(1, Math.round((t[r - 1].assetIndex.gold * (10_000 + t[r].assetReturnBp.gold)) / 10_000));
      expect(t[r].assetIndex.gold).toBe(expected);
    }
  });

  it('keeps a price index moving until the asset has lost 99.9999% of its starting value', () => {
    for (let s = 0; s < 300; s++) {
      const t = generateTimeline(`moving-${s}`, content);
      for (let r = 1; r < t.length; r++) {
        for (const asset of content.assets) {
          const before = t[r - 1].assetIndex[asset.id];
          if (before >= 100 && Math.abs(t[r].assetReturnBp[asset.id]) >= 100) {
            expect(t[r].assetIndex[asset.id]).not.toBe(before);
          }
        }
      }
    }
  });

  it('keeps the major coin alive in nearly every world and kills the meme coin far more often', () => {
    let majorDead = 0;
    let memeDead = 0;
    for (let s = 0; s < 300; s++) {
      const last = generateTimeline(`coins-${s}`, content)[content.rounds];
      if (last.assetIndex.coin_major < INDEX_START / 100) majorDead += 1;
      if (last.assetIndex.coin_meme < INDEX_START / 100) memeDead += 1;
    }
    expect(majorDead).toBeLessThan(30);
    expect(memeDead).toBeGreaterThan(60);
    expect(memeDead).toBeGreaterThan(majorDead * 4);
  });

  it('raises the price level by inflation each round', () => {
    const t = generateTimeline('prices', content);
    for (let r = 1; r < t.length; r++) {
      const growth = 10_000 + t[r].inflationBp * content.yearsPerRound;
      expect(t[r].priceLevel).toBe(Math.max(1, Math.round((t[r - 1].priceLevel * growth) / 10_000)));
    }
    expect(t[t.length - 1].priceLevel).toBeGreaterThan(PRICE_LEVEL_START);
  });

  it('pays more in booms than in recessions on average', () => {
    const sum = { boom: 0, recession: 0 };
    const count = { boom: 0, recession: 0 };
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`regime-${s}`, content).slice(1)) {
        if (w.regime === 'boom' || w.regime === 'recession') {
          sum[w.regime] += w.assetReturnBp.fund_world;
          count[w.regime] += 1;
        }
      }
    }
    expect(sum.boom / count.boom).toBeGreaterThan(sum.recession / count.recession + 2_000);
  });

  it('gives a high-beta stock the same average return as the fund: beta scales the shock, not the mean', () => {
    let fund = 0;
    let growth = 0;
    let n = 0;
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`beta-${s}`, content).slice(1)) {
        if (w.regime === 'boom') {
          fund += w.assetReturnBp.fund_world;
          growth += w.assetReturnBp.stock_growth;
          n += 1;
        }
      }
    }
    expect(n).toBeGreaterThan(500);
    expect(Math.abs(growth / n - fund / n)).toBeLessThan(400);
  });

  it('crashes the meme coin by 90% now and then', () => {
    let crashes = 0;
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`crash-${s}`, content).slice(1)) {
        if (w.assetReturnBp.coin_meme === -9_000) crashes += 1;
      }
    }
    expect(crashes).toBeGreaterThan(200);
  });

  it('makes crypto winters more likely in recessions', () => {
    let recession = 0;
    let recessionWinter = 0;
    let other = 0;
    let otherWinter = 0;
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`winter-${s}`, content).slice(1)) {
        if (w.regime === 'recession') {
          recession += 1;
          if (w.cryptoPhase === 'winter') recessionWinter += 1;
        } else {
          other += 1;
          if (w.cryptoPhase === 'winter') otherWinter += 1;
        }
      }
    }
    expect(recessionWinter / recession).toBeGreaterThan(otherWinter / other + 0.15);
  });

  it('does not reshuffle existing assets or cities when an asset is added', () => {
    const base = generateTimeline('streams', content);
    const added = { id: 'new_stock', class: 'equity' as const, betaPct: 100, idioVolBp: 500, yieldBp: 0 };
    const more = generateTimeline('streams', { ...content, assets: [added, ...content.assets] });
    for (let r = 0; r < base.length; r++) {
      for (const asset of content.assets) {
        expect(more[r].assetReturnBp[asset.id]).toBe(base[r].assetReturnBp[asset.id]);
      }
      expect(more[r].propertyReturnBp).toEqual(base[r].propertyReturnBp);
      expect(more[r].regime).toBe(base[r].regime);
      expect(more[r].policyRateBp).toBe(base[r].policyRateBp);
    }
  });
});
