import { describe, expect, it } from 'vitest';
import { applyRound, createGame, previewRound } from './game';
import { headlineHeld } from './news';
import { effectiveTax } from './tax';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { CardDef, Content, Headline, WorldState } from './types';
import { generateTimeline } from './world';

const withWorld = (over: Partial<Content['world']>, change: (c: Content) => void = () => {}): Content => {
  const content = fixtureContent();
  content.world = { ...content.world, ...over };
  change(content);
  return content;
};

/** Everything about a world state that a price depends on. */
const prices = (timeline: WorldState[]) =>
  timeline.map(({ regime, cryptoPhase, policyRateBp, inflationBp, priceLevel, assetIndex, propertyIndex }) => ({
    regime, cryptoPhase, policyRateBp, inflationBp, priceLevel, assetIndex, propertyIndex,
  }));

describe('news', () => {
  it('gives every world state but the last its headlines, each on a different topic', () => {
    const content = fixtureContent();
    const timeline = generateTimeline('news', content);
    timeline.slice(0, -1).forEach((world) => {
      expect(world.news).toHaveLength(3);
      expect(new Set(world.news.map((h) => h.topic)).size).toBe(3);
    });
    expect(timeline[20].news).toEqual([]);
    expect(generateTimeline('news', content)).toEqual(timeline);
  });

  it('covers every topic over time, and names a real city for property', () => {
    const content = fixtureContent();
    const topics = new Set<string>();
    for (let i = 0; i < 10; i++) {
      for (const world of generateTimeline(`topics-${i}`, content)) {
        for (const headline of world.news) {
          topics.add(headline.topic);
          if (headline.topic === 'property') expect(['home', 'haven']).toContain(headline.cityId);
        }
      }
    }
    expect([...topics].sort()).toEqual(['crypto', 'inflation', 'property', 'rates', 'regime']);
  });

  it('is true as often as the content says', () => {
    const rate = (truthPct: number) => {
      const content = withWorld({ newsTruthPct: truthPct });
      let held = 0;
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const timeline = generateTimeline(`truth-${i}`, content);
        for (let r = 0; r < 20; r++) {
          for (const headline of timeline[r].news) {
            total += 1;
            if (headlineHeld(content, headline, timeline[r], timeline[r + 1])) held += 1;
          }
        }
      }
      expect(total).toBe(12_000);
      return held / total;
    };
    expect(rate(100)).toBe(1);
    expect(rate(0)).toBe(0);
    const usual = rate(70);
    expect(usual).toBeGreaterThan(0.68);
    expect(usual).toBeLessThan(0.72);
  });

  it('never moves a price', () => {
    const quiet = generateTimeline('same', withWorld({ headlinesPerRound: 0 }));
    const loud = generateTimeline('same', withWorld({ headlinesPerRound: 5, newsTruthPct: 10 }));
    expect(prices(loud)).toEqual(prices(quiet));
    expect(quiet[3].news).toEqual([]);
    expect(loud[3].news).toHaveLength(5);
  });

  it('judges each kind of headline against what happened next', () => {
    const content = fixtureContent();
    const now = generateTimeline('judge', content)[0];
    const next = (over: Partial<WorldState>): WorldState => ({ ...now, ...over });
    const held = (headline: Headline, then: WorldState) => headlineHeld(content, headline, now, then);

    expect(held({ topic: 'regime', regime: 'recession' }, next({ regime: 'recession' }))).toBe(true);
    expect(held({ topic: 'regime', regime: 'boom' }, next({ regime: 'recession' }))).toBe(false);
    expect(held({ topic: 'crypto', phase: 'winter' }, next({ cryptoPhase: 'winter' }))).toBe(true);
    expect(held({ topic: 'crypto', phase: 'bull' }, next({ cryptoPhase: 'winter' }))).toBe(false);

    // The fixture calls a move of 25 bp or less flat. Rates start at 250.
    expect(held({ topic: 'rates', trend: 'up' }, next({ policyRateBp: 276 }))).toBe(true);
    expect(held({ topic: 'rates', trend: 'up' }, next({ policyRateBp: 275 }))).toBe(false);
    expect(held({ topic: 'rates', trend: 'flat' }, next({ policyRateBp: 275 }))).toBe(true);
    expect(held({ topic: 'rates', trend: 'flat' }, next({ policyRateBp: 225 }))).toBe(true);
    expect(held({ topic: 'rates', trend: 'down' }, next({ policyRateBp: 224 }))).toBe(true);
    expect(held({ topic: 'inflation', trend: 'down' }, next({ inflationBp: 100 }))).toBe(true);
    expect(held({ topic: 'inflation', trend: 'up' }, next({ inflationBp: 100 }))).toBe(false);

    const fell = next({ propertyReturnBp: { home: -1, haven: 0 } });
    expect(held({ topic: 'property', cityId: 'home', trend: 'down' }, fell)).toBe(true);
    expect(held({ topic: 'property', cityId: 'home', trend: 'up' }, fell)).toBe(false);
    expect(held({ topic: 'property', cityId: 'haven', trend: 'up' }, fell)).toBe(true);
  });
});

describe('tax reforms', () => {
  it('never happen when the chance is zero', () => {
    for (const world of generateTimeline('calm', fixtureContent())) expect(world.taxShiftBp).toEqual({ home: 0, haven: 0 });
  });

  it('happen up to the limit, move one city by one of the steps, and last', () => {
    const content = withWorld({ taxReformChancePct: 100, taxReformsPerGame: 2, taxReformStepsBp: [300] });
    const timeline = generateTimeline('reform', content);
    expect(timeline[0].taxShiftBp).toEqual({ home: 0, haven: 0 });
    expect(timeline[1].taxShiftBp).toEqual({ home: 300, haven: 0 });
    expect(timeline[2].taxShiftBp).toEqual({ home: 600, haven: 0 });
    for (let r = 3; r <= 20; r++) expect(timeline[r].taxShiftBp).toEqual({ home: 600, haven: 0 });
    expect(timeline[1].taxShiftBp).not.toBe(timeline[2].taxShiftBp);
  });

  it('pick among the steps and never touch a city that taxes nothing', () => {
    const content = withWorld({ taxReformChancePct: 30 });
    const moves = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const timeline = generateTimeline(`steps-${i}`, content);
      let reforms = 0;
      for (let r = 1; r <= 20; r++) {
        expect(timeline[r].taxShiftBp.haven).toBe(0);
        const move = timeline[r].taxShiftBp.home - timeline[r - 1].taxShiftBp.home;
        if (move !== 0) {
          reforms += 1;
          moves.add(move);
        }
      }
      expect(reforms).toBeLessThanOrEqual(2);
    }
    expect([...moves].sort((a, b) => a - b)).toEqual([-300, -200, 200, 300]);
  });

  it('never move a price', () => {
    const calm = generateTimeline('same', fixtureContent());
    const stormy = generateTimeline('same', withWorld({ taxReformChancePct: 100 }));
    expect(prices(stormy)).toEqual(prices(calm));
  });

  it('can trigger a world card', () => {
    const reform: CardDef = { id: 'reform', category: 'world', weight: 1, cooldown: 0, trigger: { taxReform: true }, options: [{}, {}] };
    const content = withWorld({ taxReformChancePct: 100, taxReformsPerGame: 1, quietWeight: 0 }, (c) => {
      c.cards = [reform];
    });
    const timeline = generateTimeline('reform-card', content);
    expect(timeline.map((world) => world.eventCardId)).toEqual([null, 'reform', ...new Array<null>(19).fill(null)]);
  });
});

describe('world cards in the timeline', () => {
  const worldCard = (over: Partial<CardDef>): CardDef => ({ id: 'storm', category: 'world', weight: 1, cooldown: 0, trigger: {}, options: [{}, {}], ...over });
  const rounds = (card: CardDef): number[] => {
    const content = withWorld({ quietWeight: 0 }, (c) => {
      c.cards = [card];
    });
    return generateTimeline('world-cards', content).flatMap((world) => (world.eventCardId === card.id ? [world.round] : []));
  };

  it('never has one in the opening state, and one every round when nothing holds it back', () => {
    expect(rounds(worldCard({}))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('shows a card marked once a single time, and waits out a cooldown', () => {
    expect(rounds(worldCard({ once: true }))).toEqual([1]);
    expect(rounds(worldCard({ cooldown: 2 }))).toEqual([1, 4, 7, 10, 13, 16, 19]);
  });

  it('leaves most rounds quiet when the quiet weight is high', () => {
    const content = withWorld({ quietWeight: 99 }, (c) => {
      c.cards = [worldCard({})];
    });
    const shown = generateTimeline('quiet', content).filter((world) => world.eventCardId !== null).length;
    expect(shown).toBeLessThan(4);
  });
});

describe('effectiveTax', () => {
  const content = fixtureContent();
  const world0 = generateTimeline('tax', content)[0];
  const [home, haven] = content.cities;

  it('is the city’s own profile when nothing has changed', () => {
    expect(effectiveTax(home, world0)).toEqual(home.tax);
  });

  it('moves every rate that is not zero by the reform, and stays within 0 to 100%', () => {
    const up = effectiveTax(home, { ...world0, taxShiftBp: { home: 200, haven: 200 } });
    expect(up.incomeRatesBp).toEqual([2_100, 3_200, 4_700]);
    expect([up.capitalGainsBp, up.dividendBp, up.rentBp]).toEqual([2_300, 2_300, 2_300]);
    expect(up.propertyPurchaseBp).toBe(800);
    expect(up.propertyAnnualBp).toBe(30);
    const untouched = effectiveTax(haven, { ...world0, taxShiftBp: { home: 200, haven: 200 } });
    expect(untouched.incomeRatesBp).toEqual([0, 0, 0]);
    expect(untouched.capitalGainsBp).toBe(0);
    const slashed = effectiveTax(home, { ...world0, taxShiftBp: { home: -2_500, haven: 0 } });
    expect(slashed.incomeRatesBp).toEqual([0, 500, 2_000]);
    expect(slashed.capitalGainsBp).toBe(0);
    expect(effectiveTax(home, { ...world0, taxShiftBp: { home: 9_000, haven: 0 } }).incomeRatesBp).toEqual([10_000, 10_000, 10_000]);
  });

  it('lets the tax-free allowance follow the price level', () => {
    const generous = { ...home, tax: { ...home.tax, investmentAllowance: 100_000 } };
    expect(effectiveTax(generous, world0).investmentAllowance).toBe(100_000);
    expect(effectiveTax(generous, { ...world0, priceLevel: 2_000_000 }).investmentAllowance).toBe(200_000);
  });

  it('is what a round charges, and what the preview shows', () => {
    const state = createGame({ content, start: fixtureStart() }, 'reformed');
    state.timeline[0].taxShiftBp = { home: 200, haven: 0 };
    // Salary 3,000,000; the first bracket starts at 1,500,000; 21% of the rest for two years.
    expect(previewRound(content, state, { orders: [] }).tax.income).toBe(630_000);
    const incomeTax = applyRound(content, state, { orders: [] }).events.find((e) => e.kind === 'ledger' && e.line === 'incomeTax');
    expect(incomeTax).toEqual({ kind: 'ledger', line: 'incomeTax', amount: -630_000 });
  });

  it('applies the indexed allowance to a real gain', () => {
    const generous = fixtureContent();
    generous.cities[0].tax = { ...generous.cities[0].tax, investmentAllowance: 100_000 };
    const state = createGame({ content: generous, start: { ...fixtureStart(), cash: 1_000_000 } }, 'allowance');
    state.player.positions.gold = { value: 500_000, basis: 200_000 };
    state.timeline[0].priceLevel = 2_000_000;
    const preview = previewRound(generous, state, { orders: [{ type: 'sell', assetId: 'gold', amount: 500_000 }] });
    // Gain 300,000; allowance 100,000 at twice the starting price level is 200,000; 21% of the remaining 100,000.
    expect(preview.tax.investment).toBe(21_000);
  });
});
