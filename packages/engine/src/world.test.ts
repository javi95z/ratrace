import { describe, expect, it } from 'vitest';
import { fixtureContent } from './testing/fixture';
import { generateTimeline } from './world';

const content = fixtureContent();

describe('world timeline', () => {
  it('has one state per round plus the start', () => {
    const t = generateTimeline('seed-a', content);
    expect(t).toHaveLength(content.rounds + 1);
    expect(t.map((w) => w.round)).toEqual(Array.from({ length: content.rounds + 1 }, (_, i) => i));
    expect(t[0].assetIndex.fund_world).toBe(10_000);
    expect(t[0].assetReturnBp.fund_world).toBe(0);
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
          ...Object.values(w.assetReturnBp),
          ...Object.values(w.assetIndex),
          ...Object.values(w.propertyReturnBp),
          ...Object.values(w.propertyIndex),
        ];
        for (const v of all) expect(Number.isInteger(v)).toBe(true);
        for (const v of Object.values(w.assetReturnBp)) expect(v).toBeGreaterThanOrEqual(-9_500);
        for (const v of Object.values(w.propertyReturnBp)) expect(v).toBeGreaterThanOrEqual(-5_000);
        for (const v of [...Object.values(w.assetIndex), ...Object.values(w.propertyIndex)]) {
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

  it('crashes the meme coin by 90% now and then', () => {
    let crashes = 0;
    for (let s = 0; s < 300; s++) {
      for (const w of generateTimeline(`crash-${s}`, content).slice(1)) {
        if (w.assetReturnBp.coin_meme === -9_000) crashes += 1;
      }
    }
    expect(crashes).toBeGreaterThan(200);
  });
});
