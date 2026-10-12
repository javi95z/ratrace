import { Rng, seedRng } from './rng';
import type { Content, CryptoPhase, Headline, Regime, Trend, WorldState } from './types';

const REGIMES: readonly Regime[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];
const PHASES: readonly CryptoPhase[] = ['accumulation', 'bull', 'mania', 'winter'];
const TRENDS: readonly Trend[] = ['up', 'down', 'flat'];
const TOPICS: ReadonlyArray<Headline['topic']> = ['regime', 'rates', 'inflation', 'crypto', 'property'];

function trendOf(change: number, flatBandBp: number): Trend {
  if (change > flatBandBp) return 'up';
  if (change < -flatBandBp) return 'down';
  return 'flat';
}

/** The headline on a topic that turns out true. */
function truth(content: Content, about: Headline, now: WorldState, next: WorldState): Headline {
  const band = content.world.flatBandBp;
  switch (about.topic) {
    case 'regime':
      return { topic: 'regime', regime: next.regime };
    case 'crypto':
      return { topic: 'crypto', phase: next.cryptoPhase };
    case 'rates':
      return { topic: 'rates', trend: trendOf(next.policyRateBp - now.policyRateBp, band) };
    case 'inflation':
      return { topic: 'inflation', trend: trendOf(next.inflationBp - now.inflationBp, band) };
    case 'property':
      return { topic: 'property', cityId: about.cityId, trend: (next.propertyReturnBp[about.cityId] ?? 0) >= 0 ? 'up' : 'down' };
  }
}

/**
 * True if a headline shown in `now` turned out right in `next`.
 * The state never says whether a headline is true, so that a client cannot read the future from it;
 * this is how the client tells the player afterwards.
 */
export function headlineHeld(content: Content, headline: Headline, now: WorldState, next: WorldState): boolean {
  const real = truth(content, headline, now, next);
  switch (headline.topic) {
    case 'regime':
      return real.topic === 'regime' && real.regime === headline.regime;
    case 'crypto':
      return real.topic === 'crypto' && real.phase === headline.phase;
    case 'rates':
    case 'inflation':
    case 'property':
      return 'trend' in real && real.trend === headline.trend;
  }
}

const others = <T>(all: readonly T[], real: T, rng: Rng): T => {
  const rest = all.filter((x) => x !== real);
  return rest[rng.int(rest.length)];
};

/**
 * A headline on the same topic that is wrong. A false regime is one that could have followed the
 * current one, where there is such a regime: a forecast of something impossible would give itself away.
 */
function falsehood(content: Content, real: Headline, now: WorldState, rng: Rng): Headline {
  switch (real.topic) {
    case 'regime': {
      const reachable = content.market.regimeTransitions[now.regime].filter(([to, weight]) => weight > 0 && to !== real.regime).map(([to]) => to);
      return { topic: 'regime', regime: reachable.length > 0 ? reachable[rng.int(reachable.length)] : others(REGIMES, real.regime, rng) };
    }
    case 'crypto':
      return { topic: 'crypto', phase: others(PHASES, real.phase, rng) };
    case 'rates':
      return { topic: 'rates', trend: others(TRENDS, real.trend, rng) };
    case 'inflation':
      return { topic: 'inflation', trend: others(TRENDS, real.trend, rng) };
    case 'property':
      return { topic: 'property', cityId: real.cityId, trend: real.trend === 'up' ? 'down' : 'up' };
  }
}

/**
 * Gives every world state but the last its headlines about the next one.
 * Each is on a different topic and is true with the chance the content sets.
 * The headlines have their own random stream, so they never move a price.
 */
export function writeNews(seed: string, content: Content, timeline: WorldState[]): void {
  const rules = content.world;
  const rng = new Rng(seedRng(seed, 'news'));
  const count = Math.min(rules.headlinesPerRound, TOPICS.length);

  for (let r = 0; r + 1 < timeline.length; r++) {
    const now = timeline[r];
    const next = timeline[r + 1];
    const topics = [...TOPICS];
    const news: Headline[] = [];
    for (let i = 0; i < count; i++) {
      const topic = topics.splice(rng.int(topics.length), 1)[0];
      const about: Headline =
        topic === 'property'
          ? { topic, cityId: content.cities[rng.int(content.cities.length)].id, trend: 'up' }
          : topic === 'regime'
            ? { topic, regime: now.regime }
            : topic === 'crypto'
              ? { topic, phase: now.cryptoPhase }
              : { topic, trend: 'flat' };
      const real = truth(content, about, now, next);
      news.push(rng.chance(rules.newsTruthPct) ? real : falsehood(content, real, now, rng));
    }
    now.news = news;
  }
}

/**
 * Applies the tax reforms of a game: at most a set number, each moving one city by one step.
 * A city that taxes nothing is never chosen. Reforms have their own random stream.
 */
export function applyTaxReforms(seed: string, content: Content, timeline: WorldState[]): void {
  const rules = content.world;
  const rng = new Rng(seedRng(seed, 'tax'));
  const taxed = content.cities
    .filter(({ tax }) => [...tax.incomeRatesBp, tax.capitalGainsBp, tax.dividendBp, tax.rentBp].some((rate) => rate > 0))
    .map((city) => city.id);

  let reforms = 0;
  for (let r = 1; r < timeline.length; r++) {
    const shift = { ...timeline[r - 1].taxShiftBp };
    // One draw every round, whether or not a reform can still happen, so the stream never depends on the limit.
    const happens = rng.chance(rules.taxReformChancePct);
    if (happens && reforms < rules.taxReformsPerGame && taxed.length > 0 && rules.taxReformStepsBp.length > 0) {
      const cityId = taxed[rng.int(taxed.length)];
      shift[cityId] += rules.taxReformStepsBp[rng.int(rules.taxReformStepsBp.length)];
      reforms += 1;
    }
    timeline[r].taxShiftBp = shift;
  }
}
