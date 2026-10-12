import { clamp, round } from './money';
import { INDEX_START, PRICE_LEVEL_START } from './rates';
import { Rng, seedRng } from './rng';
import type { Content, CryptoPhase, WorldState } from './types';

const MIN_ASSET_RETURN_BP = -9_500;
const MIN_PROPERTY_RETURN_BP = -5_000;
const CRASH_RETURN_BP = -9_000;
const MAX_RATE_BP = 800;
const MIN_INFLATION_BP = -100;
const MAX_INFLATION_BP = 1_200;
const NEUTRAL_INFLATION_BP = 200;

/**
 * One random stream for the economy and one for each asset and each city.
 * Adding or removing an asset therefore never changes the others for a given seed.
 */
interface Streams {
  macro: Rng;
  /** Aligned with content.assets. */
  assets: Rng[];
  /** Aligned with content.cities. */
  cities: Rng[];
}

function nextIndex(index: number, returnBp: number): number {
  return Math.max(1, round((index * (10_000 + returnBp)) / 10_000));
}

function stepWorld(prev: WorldState, content: Content, streams: Streams): WorldState {
  const m = content.market;
  const macro = streams.macro;

  const regime = macro.pickWeighted(m.regimeTransitions[prev.regime]);
  const drawnPhase = macro.pickWeighted(m.cryptoTransitions[prev.cryptoPhase]);
  const chilled = macro.chance(m.recessionWinterChancePct);
  const cryptoPhase: CryptoPhase = regime === 'recession' && chilled ? 'winter' : drawnPhase;

  const policyRateBp = clamp(
    prev.policyRateBp + m.rateDriftBp[regime] + round(m.rateNoiseBp * macro.normal()),
    0,
    MAX_RATE_BP,
  );
  const inflationBp = clamp(
    round((prev.inflationBp + m.inflationTargetBp[regime]) / 2) + round(m.inflationNoiseBp * macro.normal()),
    MIN_INFLATION_BP,
    MAX_INFLATION_BP,
  );
  const rateChangeBp = policyRateBp - prev.policyRateBp;

  const classShock = {
    equity: round(m.classVolBp.equity * macro.normal()),
    crypto: round(m.classVolBp.crypto * macro.normal()),
    gold: round(m.classVolBp.gold * macro.normal()),
  };

  const assetReturnBp: Record<string, number> = {};
  const assetIndex: Record<string, number> = {};
  content.assets.forEach((asset, i) => {
    const rng = streams.assets[i];
    const own = round(asset.idioVolBp * rng.normal()) + (asset.driftBp ?? 0);
    const crashed = asset.crashChancePct !== undefined && rng.chance(asset.crashChancePct);

    let ret: number;
    if (asset.class === 'bond') {
      ret = round(-(asset.durationYears ?? 0) * rateChangeBp) + own;
    } else {
      const mean =
        asset.class === 'equity'
          ? m.equityMeanBp[regime]
          : asset.class === 'crypto'
            ? m.cryptoMeanBp[cryptoPhase]
            : m.goldMeanBp[regime] + (inflationBp - NEUTRAL_INFLATION_BP) * content.yearsPerRound;
      ret = mean + round((classShock[asset.class] * asset.betaPct) / 100) + own;
    }
    if (crashed) ret = CRASH_RETURN_BP;
    ret = Math.max(ret, MIN_ASSET_RETURN_BP);

    assetReturnBp[asset.id] = ret;
    assetIndex[asset.id] = nextIndex(prev.assetIndex[asset.id], ret);
  });

  const propertyReturnBp: Record<string, number> = {};
  const propertyIndex: Record<string, number> = {};
  content.cities.forEach((city, i) => {
    const shock = round(city.propertyVolBp * streams.cities[i].normal());
    const momentum = round((prev.propertyReturnBp[city.id] * city.propertyMomentumPct) / 100);
    const ret = Math.max(
      MIN_PROPERTY_RETURN_BP,
      city.propertyGrowthBp + momentum - city.propertyRateSensitivity * rateChangeBp + shock,
    );
    propertyReturnBp[city.id] = ret;
    propertyIndex[city.id] = nextIndex(prev.propertyIndex[city.id], ret);
  });

  return {
    round: prev.round + 1,
    regime,
    cryptoPhase,
    policyRateBp,
    inflationBp,
    priceLevel: nextIndex(prev.priceLevel, inflationBp * content.yearsPerRound),
    assetReturnBp,
    assetIndex,
    propertyReturnBp,
    propertyIndex,
    taxShiftBp: prev.taxShiftBp,
    news: [],
    eventCardId: null,
  };
}

/** The whole world for one game. It depends on the seed and the content, never on a player. */
export function generateTimeline(seed: string, content: Content): WorldState[] {
  const m = content.market;
  const streams: Streams = {
    macro: new Rng(seedRng(seed, 'world')),
    assets: content.assets.map((a) => new Rng(seedRng(seed, `asset:${a.id}`))),
    cities: content.cities.map((c) => new Rng(seedRng(seed, `city:${c.id}`))),
  };
  const timeline: WorldState[] = [
    {
      round: 0,
      regime: m.start.regime,
      cryptoPhase: m.start.cryptoPhase,
      policyRateBp: m.start.policyRateBp,
      inflationBp: m.start.inflationBp,
      priceLevel: PRICE_LEVEL_START,
      assetReturnBp: Object.fromEntries(content.assets.map((a) => [a.id, 0])),
      assetIndex: Object.fromEntries(content.assets.map((a) => [a.id, INDEX_START])),
      propertyReturnBp: Object.fromEntries(content.cities.map((c) => [c.id, 0])),
      propertyIndex: Object.fromEntries(content.cities.map((c) => [c.id, INDEX_START])),
      taxShiftBp: Object.fromEntries(content.cities.map((c) => [c.id, 0])),
      news: [],
      eventCardId: null,
    },
  ];
  for (let r = 1; r <= content.rounds; r++) timeline.push(stepWorld(timeline[r - 1], content, streams));
  return timeline;
}
