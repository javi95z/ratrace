import { START_AGE } from '@ratrace/content';
import { homeOf, scoreOf } from '@ratrace/engine';
import type { Milestone } from '@ratrace/content';
import type { Content, GameView, ItemDef, PropertyTypeDef, WorldState } from '@ratrace/engine';

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
  /** The standing of their life after every round played: what they live like, and what they bought to keep up. */
  status: number[];
  /** The rounds a surprise came, and whether it was good. */
  surprises: Record<number, 'windfall' | 'blow'>;
  /** The rounds they bought something to keep up with the player, and what: a thing (`itemId`), or a home (`typeId`). */
  copies: Record<number, Show>;
  /** The rounds they had to sell what they bought to keep up, to pay for it, and what. */
  sold: Record<number, string>;
  /** The round a stroke of luck brought them back within reach of a player far ahead, and what it was. */
  caughtUp: Record<number, CatchUp>;
  /** A number of their own for this life, to pick what they say and how. */
  seed: number;
}

/**
 * Something the player bought that shows, as the rivals see it: a thing (`itemId`) or a home
 * (`typeId`), and the round of the life it was counted in, as `history` counts them: the first
 * round played is 1. The rivals see it in that round's paper, and the one it suits has one too.
 */
export type Show = { round: number; itemId: string } | { round: number; typeId: string };

/** How luck brings a rival back within reach: an inheritance, a startup sold, a coin that went to the moon. */
export type CatchUp = 'inheritance' | 'startup' | 'coin';

/**
 * The things that show, by ladder, and who keeps up with each: the ex with cars, watches and
 * clothes; the cousin with trips, boats and art. A home is the classmate's. Gadgets, pets, clubs and
 * degrees are not seen across a dinner table.
 */
const COPIER: Readonly<Record<string, RivalId>> = { car: 'ex', watch: 'ex', fashion: 'ex', travel: 'cousin', charter: 'cousin', art: 'cousin' };
const HOME_COPIER: RivalId = 'classmate';

/** Too cheap to be noticed: a thing the player bought for less than this, in cents of age 22, is copied by nobody. */
const NOTICED_FROM = 1_000_00;
/** Every this many rounds a rival looks at what the player bought since the last time, and keeps up: they have a life too. */
const COPY_REST = 3;

/**
 * What a thing that is kept costs the one who copies it, in percent of its price: the rest is still theirs, in what it would sell for.
 * A rival's own rough count, not the shop's: nothing of the game's figures depends on it.
 */
const DURABLE_LOSS_PCT = 20;

/** What a home costs the one who copies it, beyond what it is worth: fees, taxes and furniture, in percent of its price. */
const HOME_FEES_PCT = 8;

/** A player this many times as rich as every rival, two rounds running, makes one of them lucky. */
const FAR_AHEAD = 2;
/** Not before the player has this much, in cents of age 22: in the first rounds a few dollars are twice as many. */
const FAR_FROM = 100_000_00;
/** How many times luck steps in so in one life, and the rounds between two. */
const CATCH_UPS = 2;
const CATCH_UP_GAP = 4;

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
 * What the player bought that shows, as the life on screen holds it: each thing they own and paid
 * for, in the round it was bought (from how long it has been held), and their first home (from the
 * story of the life). A thing since sold, or a trip already over, is not seen any more.
 */
export function showsOf(content: Content, view: GameView, story: readonly Milestone[]): Show[] {
  const shows: Show[] = [];
  for (const owned of view.player.life.items) {
    const item = content.items.find((one) => one.id === owned.itemId);
    if (!item || owned.paid <= 0 || COPIER[item.ladder] === undefined) continue;
    // A new thing is a round old once the round it was bought in is over; a used one was older on the day; a trip counts its rounds down.
    const held = item.kind === 'experience' ? item.boostRounds - (owned.roundsLeft ?? 0) : owned.age - (owned.used === true ? (content.life.used[item.ladder]?.ageRounds ?? 0) : 0);
    const round = view.round - held + 1;
    if (round >= 1 && round <= view.round) shows.push({ round, itemId: item.id });
  }
  const home = story.find((milestone) => milestone.kind === 'home');
  if (home?.kind === 'home' && home.round >= 1) shows.push({ round: home.round, typeId: home.typeId });
  return shows.sort((a, b) => a.round - b.round);
}

/** The thing a notch above one the player bought, on its ladder and sold everywhere; the same thing at the top. */
function notchAbove(content: Content, item: ItemDef): ItemDef {
  let best: ItemDef | null = null;
  for (const other of content.items) {
    if (other.ladder !== item.ladder || other.cardOnly === true || other.cities !== undefined || other.price <= item.price) continue;
    if (best === null || other.price < best.price) best = other;
  }
  return best ?? item;
}

/** The home a notch above the player's, sold in the city (a place only to let has no status); the same at the top. */
function homeAbove(content: Content, typeId: string, cityId: string): PropertyTypeDef | null {
  const sold = content.propertyTypes.filter((type) => type.status > 0 && type.cardOnly !== true && (type.cities === undefined || type.cities.includes(cityId)) && !(type.notIn ?? []).includes(cityId));
  const theirs = content.propertyTypes.find((type) => type.id === typeId);
  if (!theirs) return null;
  let best: PropertyTypeDef | null = null;
  for (const type of sold) if (type.status > theirs.status && (best === null || type.status < best.status)) best = type;
  return best ?? theirs;
}

/**
 * What a rival notices in round `r` of what the player bought since they last looked, `COPY_REST` rounds before: the home, for the one who
 * keeps up with homes, or else the dearest thing that suits them and cost enough to be noticed. Null when there is nothing.
 */
function noticed(content: Content, shows: readonly Show[], id: RivalId, r: number): Show | null {
  let best: { show: Show; price: number } | null = null;
  for (const show of shows) {
    if (show.round > r || show.round <= r - COPY_REST) continue;
    if (!('itemId' in show)) {
      if (id === HOME_COPIER) return show;
      continue;
    }
    const item = content.items.find((one) => one.id === show.itemId);
    if (!item || COPIER[item.ladder] !== id || item.price < NOTICED_FROM) continue;
    if (best === null || item.price > best.price) best = { show, price: item.price };
  }
  return best?.show ?? null;
}

/** A thing a rival bought to keep up, while they still have it. */
interface Kept {
  item: ItemDef;
  round: number;
}

/**
 * The rivals of a life, as of the last round in `timeline`. `history` is the player's own net worth
 * after each round; the rivals start where the player started. `names` is how many names there are
 * of each kind, to pick from; `key` makes them the same for one life and different for the next.
 * `shows` is what the player bought that shows (`showsOf`): every few rounds the rival it suits
 * buys one a notch better than the dearest of them, and pays for it. A player far ahead of all three makes one of them lucky.
 */
export function rivalsOf(content: Content, timeline: readonly WorldState[], history: readonly number[], cityId: string, key: string, names: number, shows: readonly Show[] = []): Rival[] {
  const city = content.cities.find((one) => one.id === cityId);
  const median = city?.medianSalaryAnnual ?? 0;
  const years = content.yearsPerRound;
  const start = history[0] ?? 0;
  const lives = RIVALS.map((id) => {
    const random = stream(hash(`${key}:${id}`));
    const rival: Rival = {
      id,
      name: Math.floor(random() * names),
      worth: [Math.max(0, start + STYLES[id].headStart * median)],
      status: [RIVAL_STATUS[id]],
      surprises: {},
      copies: {},
      sold: {},
      caughtUp: {},
      seed: hash(`${key}:${id}:seed`),
    };
    return { rival, random, kept: new Map<string, Kept>(), home: 0 };
  });
  const luck = stream(hash(`${key}:luck`));
  let lastLuck = -CATCH_UP_GAP;
  let lucky = 0;
  for (let r = 1; r < timeline.length; r++) {
    const world = timeline[r];
    const inflation = world.priceLevel / timeline[r - 1].priceLevel;
    for (const life of lives) {
      const { rival, random, kept } = life;
      const style = STYLES[rival.id];
      // What their money did in the round, in real terms: each asset's return, and cash eaten by prices.
      let growth = 0;
      for (const [assetId, pct] of Object.entries(style.mix)) growth += (pct / 100) * ((world.assetReturnBp[assetId] ?? 0) / 10_000);
      let next = (rival.worth[r - 1] * (1 + growth)) / inflation + (median * style.savePct * years) / 100;
      // Now and then life itself steps in, for better or worse.
      if (random() * 100 < SURPRISE_PCT) {
        const good = random() < 0.5;
        rival.surprises[r] = good ? 'windfall' : 'blow';
        next += (good ? 1 : -1) * median * (0.5 + random());
      }
      // What they keep up with costs every year it is kept; a trip is over once its rounds are.
      for (const [ladder, thing] of kept) {
        if (thing.item.kind !== 'experience') next -= thing.item.upkeepAnnual * years;
        else if (r >= thing.round + thing.item.boostRounds) kept.delete(ladder);
      }
      // Every few rounds they look at what the player bought since they last did: the dearest thing that suits them, they have one a notch better, whatever it costs them.
      const show = (rival.seed + r) % COPY_REST === 0 ? noticed(content, shows, rival.id, r) : null;
      if (show !== null && 'itemId' in show) {
        const item = notchAbove(content, content.items.find((one) => one.id === show.itemId) as ItemDef);
        next -= item.kind === 'durable' ? Math.round((item.price * DURABLE_LOSS_PCT) / 100) : item.price;
        kept.set(item.ladder, { item, round: r });
        rival.copies[r] = { round: r, itemId: item.id };
      } else if (show !== null && city) {
        const type = homeAbove(content, show.typeId, cityId);
        if (type) {
          next -= Math.round((city.flatPrice * type.pricePct * HOME_FEES_PCT) / 100 / 100);
          life.home = Math.max(life.home, type.status);
          rival.copies[r] = { round: r, typeId: type.id };
        }
      }
      // In debt beyond all they own, they sell the dearest thing they keep, bought before this round: it is worth what it was, and costs no more.
      if (next < 0) {
        let dearest: Kept | null = null;
        for (const thing of kept.values()) if (thing.item.kind === 'durable' && thing.round < r && (dearest === null || thing.item.upkeepAnnual > dearest.item.upkeepAnnual)) dearest = thing;
        if (dearest !== null) {
          kept.delete(dearest.item.ladder);
          rival.sold[r] = dearest.item.id;
        }
      }
      rival.worth.push(Math.max(0, Math.round(next)));
      let status = RIVAL_STATUS[rival.id] + life.home;
      for (const thing of kept.values()) status += thing.item.status;
      rival.status.push(status);
    }
    // A player far ahead of all three, two rounds running, and one of them gets lucky: back within reach, never past.
    const you = history[r];
    const before = history[r - 1];
    const best = (at: number) => Math.max(...lives.map((life) => life.rival.worth[at]));
    if (you !== undefined && before !== undefined && lucky < CATCH_UPS && r - lastLuck >= CATCH_UP_GAP && you >= FAR_FROM && you > FAR_AHEAD * best(r) && before > FAR_AHEAD * best(r - 1)) {
      const { rival } = lives[Math.floor(luck() * lives.length)];
      const kinds: CatchUp[] = ['inheritance', 'startup', 'coin'];
      rival.caughtUp[r] = kinds[Math.floor(luck() * kinds.length)];
      rival.worth[r] = Math.max(rival.worth[r], Math.round(you * (0.6 + 0.25 * luck())));
      lastLuck = r;
      lucky += 1;
    }
  }
  return lives.map((life) => life.rival);
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

/**
 * A rival's score after round `r`, as the game would count it: the points of their wealth, and the
 * standing of their life, lived with round after round as the player's is (the average so far).
 */
export function rivalScore(content: Content, rival: Rival, r: number): number {
  const lived = rival.status.slice(0, Math.max(1, r + 1));
  const status = lived.length > 0 ? Math.round(lived.reduce((sum, one) => sum + one, 0) / lived.length) : RIVAL_STATUS[rival.id];
  return scoreOf(rival.worth[r] ?? 0, status, null, content);
}

/** What the paper says of a rival beyond their money: what they bought to keep up, sold to pay for, or the luck that brought them back. */
export type RivalAside =
  | { rival: Rival; kind: 'copy'; copy: Show; n: number }
  | { rival: Rival; kind: 'sold'; itemId: string; n: number }
  | { rival: Rival; kind: 'catchUp'; how: CatchUp; n: number };

/**
 * The story of round `r` about what a rival did because of the player, which goes before any other
 * of theirs: luck that brought one back within reach, then a thing bought to keep up, then one sold
 * to pay for it. `n` picks the words, the same each time. Null when there is none.
 */
export function rivalAside(rivals: readonly Rival[], r: number): RivalAside | null {
  for (const rival of rivals) {
    const how = rival.caughtUp[r];
    if (how !== undefined) return { rival, kind: 'catchUp', how, n: hash(`${rival.seed}:${r}`) };
  }
  for (const rival of rivals) {
    const copy = rival.copies[r];
    if (copy !== undefined) return { rival, kind: 'copy', copy, n: hash(`${rival.seed}:${r}`) };
  }
  for (const rival of rivals) {
    const itemId = rival.sold[r];
    if (itemId !== undefined) return { rival, kind: 'sold', itemId, n: hash(`${rival.seed}:${r}`) };
  }
  return null;
}

/** How the player has fallen, for a rival to remark on. */
export type Fall = 'bankrupt' | 'jail' | 'trial' | 'drop' | 'burnout' | 'renting';

export interface Needle {
  rival: Rival;
  fall: Fall;
  /** Picks the words, the same each time. */
  n: number;
}

/** How often a fall is remarked on, in percent: most are, and renting only now and then, or it would be every round. */
const NEEDLE_PCT: Record<Fall, number> = { bankrupt: 80, jail: 70, trial: 60, drop: 50, burnout: 50, renting: 20 };
/** Still renting from this age, a rival notices. */
const RENTING_FROM = 30;
/** A fall of net worth in a round worth a remark: a quarter of it, and at least this much, in cents of age 22. */
const DROP_FROM = 20_000_00;

/**
 * A line from one of the rivals about how the player has fallen, as the round opens: gone bankrupt
 * (from the story of the life), in prison or just tried, a quarter of their worth gone in the round,
 * burnt out, or still renting at thirty and over. Light, and not every time: the life's own
 * randomness says when, and who. Null in a round with nothing to say, or nothing said.
 */
export function rivalNeedle(content: Content, rivals: readonly Rival[], view: GameView, history: readonly number[], story: readonly Milestone[]): Needle | null {
  const r = view.round;
  if (r < 1 || rivals.length === 0) return null;
  const life = view.player.life;
  const you = history[r];
  const before = history[r - 1];
  const age = START_AGE + r * content.yearsPerRound;
  const falls: Array<[Fall, boolean]> = [
    ['bankrupt', story.some((milestone) => milestone.kind === 'bankrupt' && milestone.round === r)],
    ['jail', life.jailRounds > 0],
    ['trial', life.seen.crime_trial === r - 1],
    ['drop', you !== undefined && before !== undefined && before > 0 && before - you >= DROP_FROM && you < before * 0.75],
    ['burnout', life.focusLost > 0],
    ['renting', homeOf(view.player, content) === null && age >= RENTING_FROM],
  ];
  const fall = falls.find(([, fell]) => fell)?.[0];
  if (fall === undefined) return null;
  const n = hash(`${rivals.map((rival) => rival.seed).join(':')}:${r}:needle`);
  if (n % 100 >= NEEDLE_PCT[fall]) return null;
  return { rival: rivals[Math.floor(n / 100) % rivals.length], fall, n: Math.floor(n / 300) };
}
