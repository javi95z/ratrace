import { scoreOf } from '@ratrace/engine';
import type { Content, WorldState } from '@ratrace/engine';

/**
 * Three people of the player's age who live their lives beside theirs: a classmate who plays it
 * safe, a cousin who started with more and bets on everything, and an ex who spends what comes in.
 * They live in the same economy as the player, round by round, so a crash hits them too. They are
 * only told about: nothing of the game, its score or its ranking depends on them. Everything here
 * is worked out on the device from the rounds already played, the same every time for one life.
 */
export type RivalId = 'classmate' | 'cousin' | 'ex';

interface Style {
  /** What they start with beyond the player, in years of the city's median pay. */
  headStart: number;
  /** The share of the median pay they put away each year, in percent. */
  savePct: number;
  /** Where their money is, in percent of it: assets by id; the rest is cash. */
  mix: Readonly<Record<string, number>>;
}

const STYLES: Record<RivalId, Style> = {
  classmate: { headStart: 0, savePct: 15, mix: { msci_world: 50, treasury_short: 40 } },
  cousin: { headStart: 2, savePct: 10, mix: { sp500: 30, small_caps: 20, bitcoin: 30, nvidia: 20 } },
  ex: { headStart: 0, savePct: 4, mix: { sp500: 30 } },
};

export const RIVALS: readonly RivalId[] = ['classmate', 'cousin', 'ex'];

/** The status each rival's life is worth, for their score: the cousin lives well, the ex lives for now. */
export const RIVAL_STATUS: Record<RivalId, number> = { classmate: 22, cousin: 34, ex: 26 };

/** A few rounds of a life bring a windfall or a blow besides the market: an inheritance, a divorce. */
const SURPRISE_PCT = 8;

export interface Rival {
  id: RivalId;
  /** Which of the names of their kind they go by. */
  name: number;
  /** Their net worth after every round played, in the dollars of age 22, like the player's history. */
  worth: number[];
  /** The rounds a surprise came, and whether it was good. */
  surprises: Record<number, 'windfall' | 'blow'>;
}

/** A number from a string, the same every time: the life's own randomness for its rivals. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stream of numbers from 0 to 1, from a seed. */
function stream(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * The rivals of a life, as of the last round in `timeline`. `history` is the player's own net worth
 * after each round; the rivals start where the player started. `names` is how many names there are
 * of each kind, to pick from; `key` makes them the same for one life and different for the next.
 */
export function rivalsOf(content: Content, timeline: readonly WorldState[], history: readonly number[], cityId: string, key: string, names: number): Rival[] {
  const median = content.cities.find((city) => city.id === cityId)?.medianSalaryAnnual ?? 0;
  const years = content.yearsPerRound;
  const start = history[0] ?? 0;
  return RIVALS.map((id) => {
    const style = STYLES[id];
    const random = stream(hash(`${key}:${id}`));
    const name = Math.floor(random() * names);
    const worth = [Math.max(0, start + style.headStart * median)];
    const surprises: Rival['surprises'] = {};
    for (let r = 1; r < timeline.length; r++) {
      const world = timeline[r];
      const inflation = world.priceLevel / timeline[r - 1].priceLevel;
      // What their money did in the round, in real terms: each asset's return, and cash eaten by prices.
      let growth = 0;
      for (const [assetId, pct] of Object.entries(style.mix)) growth += (pct / 100) * ((world.assetReturnBp[assetId] ?? 0) / 10_000);
      let next = (worth[r - 1] * (1 + growth)) / inflation + (median * style.savePct * years) / 100;
      // Now and then life itself steps in, for better or worse.
      if (random() * 100 < SURPRISE_PCT) {
        const good = random() < 0.5;
        surprises[r] = good ? 'windfall' : 'blow';
        next += (good ? 1 : -1) * median * (0.5 + random());
      }
      worth.push(Math.max(0, Math.round(next)));
    }
    return { id, name, worth, surprises };
  });
}

/** What is said of a rival in a round's newspaper: one story, the biggest, or none. */
export type RivalStory = 'passedYou' | 'youPassed' | 'millionaire' | 'windfall' | 'blow' | 'boom' | 'bust';

export interface RivalNews {
  rival: Rival;
  story: RivalStory;
}

/** A million dollars of age 22, in cents. */
const MILLION = 1_000_000_00;

/**
 * The one story about the rivals worth printing in round `r`, comparing it with the round before:
 * who overtook whom first, then a first million, then a stroke of luck or bad luck, then a big
 * move of their money. Null in a quiet round, and in the first, which has no round before it.
 */
export function rivalNews(rivals: readonly Rival[], history: readonly number[], r: number): RivalNews | null {
  if (r < 1) return null;
  const you = history[r];
  const before = history[r - 1];
  if (you === undefined || before === undefined) return null;
  const tests: Array<(rival: Rival) => RivalStory | null> = [
    (rival) => (rival.worth[r - 1] <= before && rival.worth[r] > you ? 'passedYou' : null),
    (rival) => (rival.worth[r - 1] > before && rival.worth[r] <= you ? 'youPassed' : null),
    (rival) => (rival.worth[r - 1] < MILLION && rival.worth[r] >= MILLION ? 'millionaire' : null),
    (rival) => rival.surprises[r] ?? null,
    (rival) => (rival.worth[r] > rival.worth[r - 1] * 1.3 && rival.worth[r] - rival.worth[r - 1] > 20_000_00 ? 'boom' : null),
    (rival) => (rival.worth[r] < rival.worth[r - 1] * 0.7 && rival.worth[r - 1] - rival.worth[r] > 20_000_00 ? 'bust' : null),
  ];
  for (const test of tests) {
    for (const rival of rivals) {
      const story = test(rival);
      if (story !== null && rival.worth[r] !== undefined) return { rival, story };
    }
  }
  return null;
}

/** A rival's score after round `r`, as the game would count it: the points of their wealth, and the standing of their life. */
export function rivalScore(content: Content, rival: Rival, r: number): number {
  return scoreOf(rival.worth[r] ?? 0, RIVAL_STATUS[rival.id], null, content);
}
