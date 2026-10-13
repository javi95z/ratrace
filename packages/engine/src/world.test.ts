import { describe, expect, it } from 'vitest';
import { INDEX_START, PRICE_LEVEL_START } from './rates';
import { triggerHolds } from './life/conditions';
import { fixtureContent } from './testing/fixture';
import type { Content, CrisisPhase } from './types';
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

  it("adds an asset's own drift to every return, so assets in one class can differ", () => {
    const drifting = {
      ...content,
      assets: content.assets.map((asset) => (asset.id === 'fund_world' ? { ...asset, driftBp: -700 } : asset)),
    };
    const base = generateTimeline('drift', content);
    const moved = generateTimeline('drift', drifting);
    for (let r = 1; r < base.length; r++) {
      expect(moved[r].assetReturnBp.fund_world).toBe(base[r].assetReturnBp.fund_world - 700);
      expect(moved[r].assetReturnBp.gold).toBe(base[r].assetReturnBp.gold);
    }
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

describe('a crisis', () => {
  /** The fixture with one crisis that every game has. */
  const withCrisis = (phases: CrisisPhase[], chance = 100): Content => {
    const world = fixtureContent();
    return { ...world, crises: [{ id: 'crash', weight: 1, phases }], world: { ...world.world, crisisChancePct: chance, crisisEarliestRound: 3 } };
  };
  const quiet: CrisisPhase[] = [{}, {}, {}];
  const rounds = (timeline: ReturnType<typeof generateTimeline>) => timeline.filter((w) => w.crisis !== null);

  it('never happens in a world that has none, and leaves that world exactly as it was', () => {
    const plain = generateTimeline('seed-a', content);
    expect(plain.every((w) => w.crisis === null)).toBe(true);
    // A crisis that is possible but not drawn changes nothing either: it has a random stream of its own.
    expect(generateTimeline('seed-a', withCrisis(quiet, 0))).toEqual(plain);
  });

  it('lasts its rounds in a row, counted from one, after the earliest round and before the life ends', () => {
    for (let s = 0; s < 200; s++) {
      const timeline = generateTimeline(`crisis-${s}`, withCrisis(quiet));
      const during = rounds(timeline);
      expect(during.map((w) => w.crisis)).toEqual([1, 2, 3].map((year) => ({ id: 'crash', year, of: 3 })));
      expect(during[0].round).toBeGreaterThanOrEqual(3);
      // Every round of it is played: the last state of a life is never under a crisis.
      expect(during[2].round).toBeLessThan(content.rounds);
      expect(during[2].round - during[0].round).toBe(2);
    }
  });

  it('opens anywhere from the earliest round to the last that still fits, and not always in the same one', () => {
    const starts = new Set<number>();
    for (let s = 0; s < 400; s++) starts.add(rounds(generateTimeline(`when-${s}`, withCrisis(quiet)))[0].round);
    expect(Math.min(...starts)).toBe(3);
    expect(Math.max(...starts)).toBe(content.rounds - 3);
    expect(starts.size).toBeGreaterThan(8);
  });

  it('happens in about as many games as its chance says', () => {
    let games = 0;
    for (let s = 0; s < 1_000; s++) if (rounds(generateTimeline(`often-${s}`, withCrisis(quiet, 30))).length > 0) games += 1;
    expect(games).toBeGreaterThan(250);
    expect(games).toBeLessThan(350);
  });

  it('is one of several by their weights, and every game that is due one gets one', () => {
    const base = fixtureContent();
    const several: Content = {
      ...base,
      crises: [
        { id: 'common', weight: 3, phases: [{}, {}] },
        { id: 'rare', weight: 1, phases: [{}, {}, {}] },
      ],
      world: { ...base.world, crisisChancePct: 100, crisisEarliestRound: 3 },
    };
    const seen: Record<string, number> = {};
    for (let s = 0; s < 400; s++) {
      const during = rounds(generateTimeline(`which-${s}`, several));
      const id = during[0]?.crisis?.id ?? 'none';
      seen[id] = (seen[id] ?? 0) + 1;
      // One crisis, whole: never a round of one and a round of another.
      expect(new Set(during.map((w) => w.crisis?.id)).size, `which-${s}`).toBe(1);
      expect(during).toHaveLength(id === 'common' ? 2 : 3);
    }
    expect(seen.none).toBeUndefined();
    expect(seen.common).toBeGreaterThan(260);
    expect(seen.rare).toBeGreaterThan(60);
  });

  it('with nothing in its phases only puts its name on the rounds', () => {
    const named = generateTimeline('seed-a', withCrisis(quiet));
    const plain = generateTimeline('seed-a', content);
    expect(named.map((w) => ({ ...w, crisis: null }))).toEqual(plain);
  });

  it('forces the regime and the crypto cycle of the rounds it arrives in', () => {
    const forced = generateTimeline('seed-a', withCrisis([{ regime: 'recession', cryptoPhase: 'winter' }, { regime: 'recession' }, { regime: 'recovery' }]));
    expect(rounds(forced).map((w) => w.regime)).toEqual(['recession', 'recession', 'recovery']);
    expect(rounds(forced)[0].cryptoPhase).toBe('winter');
  });

  it('adds what each phase says, and nothing else, to the round played under it', () => {
    // Shocks small enough that no return hits its floor, so the difference is the shock to the basis point.
    const phases: CrisisPhase[] = [{ equityBp: -700, propertyBp: -300 }, { goldBp: 400, cryptoBp: -900 }, {}];
    const shocked = generateTimeline('seed-b', withCrisis(phases));
    const calm = generateTimeline('seed-b', withCrisis(quiet));
    const start = rounds(shocked)[0].round;
    const moved = (round: number, pick: (w: (typeof shocked)[number]) => number) => pick(shocked[round]) - pick(calm[round]);

    // The first phase is felt in the returns that close its round, not in those that opened it.
    expect(moved(start, (w) => w.assetReturnBp.fund_world)).toBe(0);
    expect(moved(start + 1, (w) => w.assetReturnBp.fund_world)).toBe(-700);
    expect(moved(start + 1, (w) => w.assetReturnBp.stock_growth)).toBe(-700);
    expect(moved(start + 1, (w) => w.assetReturnBp.bond_long)).toBe(0);
    expect(moved(start + 1, (w) => w.propertyReturnBp.home)).toBe(-300);
    // No return goes under its floor, so a coin already in free fall cannot fall the whole shock further.
    const coin = calm[start + 2].assetReturnBp.coin_major;
    expect(moved(start + 2, (w) => w.assetReturnBp.coin_major)).toBe(Math.max(coin - 900, -9_500) - coin);
    expect(moved(start + 2, (w) => w.assetReturnBp.gold)).toBe(400);
    expect(moved(start + 2, (w) => w.assetReturnBp.fund_world)).toBe(0);
    // Once it is over the world rolls on as it would have, but for what the falls left behind.
    expect(moved(start + 3, (w) => w.assetReturnBp.fund_world)).toBe(0);
    expect(shocked[start + 1].assetIndex.fund_world).toBeLessThan(calm[start + 1].assetIndex.fund_world);
  });

  it('moves rates and inflation on arriving, and the rest of the world follows from there', () => {
    const shocked = generateTimeline('seed-c', withCrisis([{ inflationBp: 300, rateBp: 100 }, {}, {}]));
    const calm = generateTimeline('seed-c', withCrisis(quiet));
    const start = rounds(shocked)[0].round;
    expect(shocked[start].inflationBp - calm[start].inflationBp).toBe(calm[start].inflationBp + 300 > 1_200 ? 1_200 - calm[start].inflationBp : 300);
    expect(shocked[start].policyRateBp).toBeGreaterThanOrEqual(calm[start].policyRateBp);
    // The round before is the same world, but for its headlines: they are about the round the crisis opens in.
    expect({ ...shocked[start - 1], news: [] }).toEqual({ ...calm[start - 1], news: [] });
  });

  it('can be what a world card waits for: one round of one crisis', () => {
    const timeline = generateTimeline('seed-a', withCrisis(quiet));
    const [first, second] = rounds(timeline);
    const before = timeline[first.round - 1];
    expect(triggerHolds({ crisis: { id: 'crash', year: 1 } }, before, first)).toBe(true);
    expect(triggerHolds({ crisis: { id: 'crash', year: 1 } }, first, second)).toBe(false);
    expect(triggerHolds({ crisis: { id: 'crash', year: 2 } }, first, second)).toBe(true);
    expect(triggerHolds({ crisis: { id: 'other', year: 1 } }, before, first)).toBe(false);
    expect(triggerHolds({ crisis: { id: 'crash', year: 1 } }, timeline[0], timeline[1])).toBe(false);
  });
});

