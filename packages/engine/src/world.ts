import { clamp, round } from './money';
import { Rng, seedRng } from './rng';
import type { Content, WorldState } from './types';

export const INDEX_START = 10_000;

const MIN_ASSET_RETURN_BP = -9_500;
const MIN_PROPERTY_RETURN_BP = -5_000;
const CRASH_RETURN_BP = -9_000;
const MAX_RATE_BP = 800;
const MIN_INFLATION_BP = -100;
const MAX_INFLATION_BP = 1_200;
const NEUTRAL_INFLATION_BP = 200;

function nextIndex(index: number, returnBp: number): number {
  return Math.max(1, round((index * (10_000 + returnBp)) / 10_000));
}

export function stepWorld(prev: WorldState, content: Content, rng: Rng): WorldState {
  const m = content.market;

  const regime = rng.pickWeighted(m.regimeTransitions[prev.regime]);
  const cryptoPhase = rng.pickWeighted(m.cryptoTransitions[prev.cryptoPhase]);

  const policyRateBp = clamp(
    prev.policyRateBp + m.rateDriftBp[regime] + round(m.rateNoiseBp * rng.normal()),
    0,
    MAX_RATE_BP,
  );
  const inflationBp = clamp(
    round((prev.inflationBp + m.inflationTargetBp[regime]) / 2) + round(m.inflationNoiseBp * rng.normal()),
    MIN_INFLATION_BP,
    MAX_INFLATION_BP,
  );
  const rateChangeBp = policyRateBp - prev.policyRateBp;

  const classShock = {
    equity: round(m.classVolBp.equity * rng.normal()),
    crypto: round(m.classVolBp.crypto * rng.normal()),
    gold: round(m.classVolBp.gold * rng.normal()),
  };

  const assetReturnBp: Record<string, number> = {};
  const assetIndex: Record<string, number> = {};
  for (const asset of content.assets) {
    const own = round(asset.idioVolBp * rng.normal());
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
      ret = round(((mean + classShock[asset.class]) * asset.betaPct) / 100) + own;
    }
    if (asset.crashChancePct !== undefined && rng.chance(asset.crashChancePct)) ret = CRASH_RETURN_BP;
    ret = Math.max(ret, MIN_ASSET_RETURN_BP);
    assetReturnBp[asset.id] = ret;
    assetIndex[asset.id] = nextIndex(prev.assetIndex[asset.id], ret);
  }

  const propertyReturnBp: Record<string, number> = {};
  const propertyIndex: Record<string, number> = {};
  for (const city of content.cities) {
    const shock = round(city.propertyVolBp * rng.normal());
    const momentum = round((prev.propertyReturnBp[city.id] * city.propertyMomentumPct) / 100);
    const ret = Math.max(
      MIN_PROPERTY_RETURN_BP,
      city.propertyGrowthBp + momentum - city.propertyRateSensitivity * rateChangeBp + shock,
    );
    propertyReturnBp[city.id] = ret;
    propertyIndex[city.id] = nextIndex(prev.propertyIndex[city.id], ret);
  }

  return {
    round: prev.round + 1,
    regime,
    cryptoPhase,
    policyRateBp,
    inflationBp,
    assetReturnBp,
    assetIndex,
    propertyReturnBp,
    propertyIndex,
  };
}

/** The whole world for one game. It depends on the seed and the content, never on a player. */
export function generateTimeline(seed: string, content: Content): WorldState[] {
  const rng = new Rng(seedRng(seed, 'market'));
  const m = content.market;
  const timeline: WorldState[] = [
    {
      round: 0,
      regime: m.start.regime,
      cryptoPhase: m.start.cryptoPhase,
      policyRateBp: m.start.policyRateBp,
      inflationBp: m.start.inflationBp,
      assetReturnBp: Object.fromEntries(content.assets.map((a) => [a.id, 0])),
      assetIndex: Object.fromEntries(content.assets.map((a) => [a.id, INDEX_START])),
      propertyReturnBp: Object.fromEntries(content.cities.map((c) => [c.id, 0])),
      propertyIndex: Object.fromEntries(content.cities.map((c) => [c.id, INDEX_START])),
    },
  ];
  for (let r = 1; r <= content.rounds; r++) timeline.push(stepWorld(timeline[r - 1], content, rng));
  return timeline;
}
