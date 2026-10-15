import { triggerHolds } from './life/conditions';
import { clamp, round } from './money';
import { applyTaxReforms, writeNews } from './news';
import { INDEX_START, PRICE_LEVEL_START } from './rates';
import { Rng, seedRng } from './rng';
import type { Content, CrisisPhase, CryptoPhase, WorldState } from './types';

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

/** The crisis of a game: which one, and the round it opens in. */
interface CrisisPlan {
  id: string;
  start: number;
  phases: ReadonlyArray<CrisisPhase>;
}

/**
 * Whether this game has a crisis, which, and when. It has a random stream of its own, so a world
 * without a crisis is the same world it was before crises existed.
 */
function planCrisis(seed: string, content: Content): CrisisPlan | null {
  const rng = new Rng(seedRng(seed, 'crisis'));
  if (content.crises.length === 0 || !rng.chance(content.world.crisisChancePct)) return null;
  const picked = rng.pickWeighted(content.crises.map((c): [string, number] => [c.id, c.weight]));
  const crisis = content.crises.find((c) => c.id === picked);
  if (!crisis) return null;
  // Every round of it is one the player plays: it is over by the last round of the life.
  const first = content.world.crisisEarliestRound;
  const last = content.rounds - crisis.phases.length;
  if (last < first) return null;
  return { id: crisis.id, start: first + rng.int(last - first + 1), phases: crisis.phases };
}

/** The phase of the crisis a round is played under, or null. */
function phaseAt(plan: CrisisPlan | null, round: number): CrisisPhase | null {
  if (!plan) return null;
  return plan.phases[round - plan.start] ?? null;
}

function nextIndex(index: number, returnBp: number): number {
  return Math.max(1, round((index * (10_000 + returnBp)) / 10_000));
}

function stepWorld(prev: WorldState, content: Content, streams: Streams, plan: CrisisPlan | null): WorldState {
  const m = content.market;
  const macro = streams.macro;
  // A crisis acts twice: on the state it arrives in, and on the returns of the round played under it.
  const arriving = phaseAt(plan, prev.round + 1);
  const leaving = phaseAt(plan, prev.round);

  // The draws are always made, so that a crisis changes what happens and never what is rolled after it.
  const drawnRegime = macro.pickWeighted(m.regimeTransitions[prev.regime]);
  const regime = arriving?.regime ?? drawnRegime;
  const drawnPhase = macro.pickWeighted(m.cryptoTransitions[prev.cryptoPhase]);
  const chilled = macro.chance(m.recessionWinterChancePct);
  const cryptoPhase: CryptoPhase = arriving?.cryptoPhase ?? (regime === 'recession' && chilled ? 'winter' : drawnPhase);

  const policyRateBp = clamp(
    prev.policyRateBp + m.rateDriftBp[regime] + round(m.rateNoiseBp * macro.normal()) + (arriving?.rateBp ?? 0),
    0,
    MAX_RATE_BP,
  );
  const inflationBp = clamp(
    round((prev.inflationBp + m.inflationTargetBp[regime]) / 2) + round(m.inflationNoiseBp * macro.normal()) + (arriving?.inflationBp ?? 0),
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
            // Gold is the refuge from the printing press: it climbs with inflation, twice as fast as prices.
            : m.goldMeanBp[regime] + (inflationBp - NEUTRAL_INFLATION_BP) * content.yearsPerRound * 2;
      const crisis = asset.class === 'equity' ? leaving?.equityBp : asset.class === 'crypto' ? leaving?.cryptoBp : leaving?.goldBp;
      ret = mean + round((classShock[asset.class] * asset.betaPct) / 100) + own + (crisis ?? 0);
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
      city.propertyGrowthBp + momentum - city.propertyRateSensitivity * rateChangeBp + shock + (leaving?.propertyBp ?? 0),
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
    crisis: plan && arriving ? { id: plan.id, year: prev.round + 1 - plan.start + 1, of: plan.phases.length } : null,
  };
}

/** The whole world for one game. It depends on the seed and the content, never on a player. */
export function generateTimeline(seed: string, content: Content, homeCityId?: string): WorldState[] {
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
      crisis: null,
    },
  ];
  const plan = planCrisis(seed, content);
  for (let r = 1; r <= content.rounds; r++) timeline.push(stepWorld(timeline[r - 1], content, streams, plan));
  // Each of these has its own random stream and reads prices without changing them.
  applyTaxReforms(seed, content, timeline);
  chooseWorldCards(seed, content, timeline);
  writeNews(seed, content, timeline, homeCityId);
  return timeline;
}

/**
 * Picks the world card of each round from those whose trigger holds, by weight, against the
 * weight of a quiet round. The choice depends on the world alone, so every player sees the same card.
 */
function chooseWorldCards(seed: string, content: Content, timeline: WorldState[]): void {
  const cards = content.cards.filter((card) => card.category === 'world');
  if (cards.length === 0) return;
  const rng = new Rng(seedRng(seed, 'events'));
  const lastUsed = new Map<string, number>();
  for (let r = 1; r < timeline.length; r++) {
    const choices: Array<[string | null, number]> = [[null, content.world.quietWeight]];
    for (const card of cards) {
      const last = lastUsed.get(card.id);
      if (last !== undefined && (card.once === true || r - last <= card.cooldown)) continue;
      if (triggerHolds(card.trigger, timeline[r - 1], timeline[r])) choices.push([card.id, card.weight]);
    }
    if (choices.length === 1) continue;
    const picked = rng.pickWeighted(choices);
    timeline[r].eventCardId = picked;
    if (picked !== null) lastUsed.set(picked, r);
  }
}
