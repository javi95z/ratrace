import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyCard, applyRound, createGame, viewOf } from '@ratrace/engine';
import type { GameEvent, GameState, GameView, PlayerState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { badgeArt } from './art';
import { badges, badgesEarned, galleryBadges, journalAfter, journalStart, START_AGE } from './badges';
import type { Journal } from './badges';
import { content } from './content';
import { lives } from './lives';
import { usd } from './money';
import { textFor } from './text';
import { unlockedLives } from './unlocks';

const nurse = lives[0].start;
const fresh = (): GameView => viewOf(createGame({ content, start: nurse }, 'badges'));
const ageAt = (round: number) => START_AGE + round * content.yearsPerRound;

interface Change {
  /** Changes the player as the step leaves them. */
  player?: (p: PlayerState) => void;
  /** Changes the player as the step found them. */
  was?: (p: PlayerState) => void;
  events?: GameEvent[];
  /** The round the step ends in. One more than it began in, unless `card` says it was a card. */
  round?: number;
  /** True for the answer to a card: the round does not move. */
  card?: boolean;
  /** The world the step was played in. */
  world?: Partial<GameView['timeline'][number]>;
  journal?: Partial<Journal>;
  finished?: boolean;
}

/** One step of a life, built by hand: the nurse's first round with the changes asked for. */
function step(change: Change = {}) {
  const before = fresh();
  const round = change.round ?? 1;
  before.round = change.card ? round : round - 1;
  before.timeline = Array.from({ length: before.round + 1 }, (_, r) => ({ ...before.timeline[0], round: r }));
  before.timeline[before.round] = { ...before.timeline[before.round], ...change.world };
  before.phase = 'finance';
  change.was?.(before.player);
  const after = structuredClone(before);
  after.round = round;
  after.timeline = [...before.timeline, ...(change.card ? [] : [{ ...before.timeline[before.round], round }])];
  after.finished = change.finished ?? false;
  change.player?.(after.player);
  const events = change.events ?? [];
  const journal = { ...journalAfter(content, journalStart(content, before), after, events), ...change.journal };
  return { content, before, after, events, journal };
}

const hold = (assetId: string, value = usd(1_000), basis = value) => (p: PlayerState) => {
  p.positions[assetId] = { value, basis };
};
const own = (...itemIds: string[]) => (p: PlayerState) => {
  for (const itemId of itemIds) p.life.items.push({ itemId, value: 0, roundsLeft: null });
};
const home = (typeId: string, rented = false) => (p: PlayerState) => {
  p.properties.push({ id: `p-${p.properties.length}`, cityId: p.cityId, typeId, value: usd(100_000), basis: usd(100_000), rented, mortgageId: null });
};
const all = (...changes: Array<(p: PlayerState) => void>) => (p: PlayerState) => {
  for (const change of changes) change(p);
};
const cash = (dollars: number) => (p: PlayerState) => {
  p.cash = usd(dollars);
};
const RECESSION = { regime: 'recession' as const };
const WINTER = { cryptoPhase: 'winter' as const };
const escaped = (round: number): GameEvent => ({ kind: 'escaped', round });

/** For every badge: a step that earns it, and steps that look close and do not. */
const CASES: Record<string, { earns: Change; misses: Change[] }> = {
  first_100k: { earns: { player: cash(100_000) }, misses: [{ player: cash(99_999) }] },
  millionaire: { earns: { player: cash(1_000_000) }, misses: [{ player: cash(999_999) }] },
  millionaire_by_35: { earns: { player: cash(1_000_000), round: 6 }, misses: [{ player: cash(1_000_000), round: 7 }, { player: cash(900_000), round: 3 }] },
  ten_million: { earns: { player: cash(10_000_000) }, misses: [{ player: cash(9_999_999) }] },
  debt_free_at_40: {
    earns: { round: 9 },
    misses: [
      { round: 8 },
      { round: 10 },
      { round: 9, player: (p) => p.debts.push({ id: 'd', kind: 'personalLoan', principal: 100, fixedRateBp: 500, roundsLeft: 3 }) },
      // Reaching 40 is a round; a card answered at 40 is not the moment.
      { round: 9, card: true },
    ],
  },
  no_credit_card: {
    earns: { round: 20, finished: true },
    misses: [{ round: 19 }, { round: 20, finished: true, journal: { cardUsed: true } }],
  },
  escaped: { earns: { events: [escaped(14)], round: 16 }, misses: [{ round: 16 }] },
  escaped_before_40: { earns: { events: [escaped(8)], round: 10 }, misses: [{ events: [escaped(9)], round: 11 }] },
  escaped_before_35: { earns: { events: [escaped(6)], round: 8 }, misses: [{ events: [escaped(7)], round: 9 }] },
  passive_double: {
    earns: { player: (p) => (p.deposit = usd(50_000_000)) },
    misses: [{ player: (p) => (p.deposit = usd(100_000)) }],
  },
  first_share: { earns: { player: hold('apple') }, misses: [{ player: hold('msci_world') }, { player: hold('bitcoin') }, { player: hold('apple', 0, 0) }] },
  five_asset_classes: {
    earns: { player: all(hold('msci_world'), hold('bund'), hold('apple'), hold('bitcoin'), hold('gold')) },
    misses: [
      { player: all(hold('msci_world'), hold('sp500'), hold('apple'), hold('nvidia'), hold('gold')) },
      { player: all(hold('msci_world'), hold('bund'), hold('apple'), hold('bitcoin')) },
    ],
  },
  bought_the_dip: {
    earns: { world: RECESSION, player: hold('msci_world', usd(5_000)) },
    misses: [
      { player: hold('msci_world', usd(5_000)) },
      { world: RECESSION, player: hold('bitcoin', usd(5_000)) },
      // Held, not bought: what was paid for it did not rise.
      { world: RECESSION, was: hold('apple', usd(5_000)), player: hold('apple', usd(3_000), usd(5_000)) },
    ],
  },
  crypto_winter: {
    earns: { world: WINTER, was: hold('bitcoin', usd(5_000)), player: hold('bitcoin', usd(1_200), usd(5_000)) },
    misses: [
      { was: hold('bitcoin', usd(5_000)), player: hold('bitcoin', usd(1_200), usd(5_000)) },
      { world: WINTER, was: hold('bitcoin', usd(5_000)), player: hold('bitcoin', usd(600), usd(2_500)) },
      { world: WINTER, was: hold('bitcoin', usd(5_000)), player: (p) => delete p.positions.bitcoin },
      { world: WINTER, player: hold('bitcoin', usd(1_000)) },
      { world: WINTER, was: hold('bitcoin', usd(5_000)), player: hold('bitcoin', usd(1_200), usd(5_000)), card: true },
    ],
  },
  three_rentals: {
    earns: { player: all(home('studio', true), home('studio', true), home('flat', true)) },
    misses: [{ player: all(home('studio', true), home('studio', true), home('flat', false)) }],
  },
  bond_ladder: {
    earns: { player: all(hold('treasury_short'), hold('treasury_long'), hold('bund')) },
    misses: [{ player: all(hold('treasury_short'), hold('treasury_long')) }],
  },
  index_only: {
    earns: { events: [escaped(10)], round: 12, player: hold('msci_world', usd(900_000)) },
    misses: [
      { round: 12, player: hold('msci_world', usd(900_000)) },
      { events: [escaped(10)], round: 12, player: all(hold('msci_world', usd(900_000)), hold('apple')) },
      { events: [escaped(10)], round: 12, player: all(hold('msci_world', usd(900_000)), home('studio', true)) },
      { events: [escaped(10)], round: 12, player: hold('msci_world', usd(900_000)), journal: { kinds: ['fund', 'crypto'] } },
      { events: [escaped(10)], round: 12 },
    ],
  },
  first_luxury_watch: { earns: { player: own('watch_omega') }, misses: [{ player: own('watch_tissot', 'watch_casio') }] },
  supercar: { earns: { player: own('car_lamborghini_aventador') }, misses: [{ player: own('car_porsche_911') }] },
  penthouse: { earns: { player: home('penthouse') }, misses: [{ player: home('villa') }] },
  status_100: { earns: { player: (p) => (p.statusPoints = 100) }, misses: [{ player: (p) => (p.statusPoints = 99) }] },
  three_cities: {
    earns: { events: [{ kind: 'moved', cityId: 'dubai' }], player: (p) => (p.cityId = 'dubai'), journal: { cities: ['madrid', 'london', 'dubai'] } },
    misses: [{ events: [{ kind: 'moved', cityId: 'dubai' }], player: (p) => (p.cityId = 'dubai') }],
  },
  moved_to_dubai: {
    earns: { events: [{ kind: 'moved', cityId: 'dubai' }], player: (p) => (p.cityId = 'dubai') },
    misses: [{ events: [{ kind: 'moved', cityId: 'london' }], player: (p) => (p.cityId = 'london') }],
  },
  family_of_four: {
    earns: { player: (p) => Object.assign(p.life, { partner: true, children: [6, 8] }) },
    misses: [{ player: (p) => Object.assign(p.life, { partner: true, children: [6] }) }, { player: (p) => Object.assign(p.life, { partner: false, children: [6, 8] }) }],
  },
  mba: { earns: { player: own('edu_mba') }, misses: [{ player: own('watch_casio') }] },
  sold_business: { earns: { player: (p) => (p.life.flags.sold_business = 4) }, misses: [{ player: (p) => (p.life.flags.has_business = 4) }] },
  rode_out_recession: {
    earns: { world: RECESSION, was: hold('msci_world', usd(5_000)), player: hold('msci_world', usd(3_900), usd(5_000)) },
    misses: [
      { was: hold('msci_world', usd(5_000)), player: hold('msci_world', usd(3_900), usd(5_000)) },
      { world: RECESSION, was: hold('msci_world', usd(5_000)), player: hold('msci_world', usd(1_950), usd(2_500)) },
      { world: RECESSION, was: all(hold('msci_world', usd(5_000)), hold('apple')), player: (p) => delete p.positions.apple },
      { world: RECESSION },
      { world: RECESSION, was: hold('msci_world', usd(5_000)), player: hold('msci_world', usd(3_900), usd(5_000)), card: true },
    ],
  },
  bankrupt: { earns: { events: [{ kind: 'bankrupt', proceeds: 0, debtsCleared: 100 }] }, misses: [{}] },
};

/** Badges that are about the gallery of every life, not about one step. */
const GALLERY = ['twenty_items', 'every_car'];

describe('the badges', () => {
  it('are the thirty of the spec, each in one of six groups', () => {
    expect(badges).toHaveLength(30);
    expect(new Set(badges.map((b) => b.id)).size).toBe(30);
    const count = (group: string) => badges.filter((b) => b.group === group).length;
    expect(['wealth', 'escape', 'investing', 'status', 'life', 'misfortune'].map(count)).toEqual([6, 4, 7, 6, 6, 1]);
  });

  it('each have a name, a way to earn them, and a picture, in both languages', () => {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../../art/clean/manifest.json', import.meta.url)), 'utf8')) as { sprites: Record<string, unknown> };
    for (const locale of ['en', 'es'] as const) {
      const { text } = textFor(locale);
      expect(Object.keys(text.badges).sort(), locale).toEqual(badges.map((b) => b.id).sort());
      expect(Object.keys(text.badgeGroups).sort(), locale).toEqual(['escape', 'investing', 'life', 'misfortune', 'status', 'wealth']);
      for (const badge of badges) {
        expect(text.badges[badge.id].name.length, `${locale} ${badge.id}`).toBeGreaterThan(2);
        expect(text.badges[badge.id].name.length, `${locale} ${badge.id}`).toBeLessThanOrEqual(34);
        expect(text.badges[badge.id].how.length, `${locale} ${badge.id}`).toBeGreaterThan(10);
      }
    }
    for (const badge of badges) expect(Object.hasOwn(manifest.sprites, badgeArt(badge.id)), badge.id).toBe(true);
    expect(Object.hasOwn(manifest.sprites, badgeArt('locked'))).toBe(true);
  });

  it('has a tested way in and a tested near miss for every badge', () => {
    expect([...Object.keys(CASES), ...GALLERY].sort()).toEqual(badges.map((b) => b.id).sort());
    for (const [id, { misses }] of Object.entries(CASES)) expect(misses.length, id).toBeGreaterThan(0);
  });

  it.each(Object.entries(CASES))('%s is earned by what earns it', (id, { earns }) => {
    expect(badgesEarned(step(earns))).toContain(id);
  });

  it.each(Object.entries(CASES))('%s is not earned by what only looks like it', (id, { misses }) => {
    misses.forEach((miss, i) => expect(badgesEarned(step(miss)), `near miss ${i}`).not.toContain(id));
  });

  it('earns nothing in an ordinary first round, and nothing but what the step shows', () => {
    expect(badgesEarned(step())).toEqual([]);
    expect(badgesEarned(step({ player: cash(150_000) }))).toEqual(['first_100k']);
    expect(badgesEarned(step({ player: cash(2_000_000), round: 5 }))).toEqual(['first_100k', 'millionaire', 'millionaire_by_35']);
  });

  it('is earned once in a life', () => {
    const rich = step({ player: cash(150_000), journal: { earned: ['first_100k'] } });
    expect(badgesEarned(rich)).toEqual([]);
  });

  it('counts net worth in the dollars of age 22, so that inflation hands out nothing', () => {
    const inflated = step({ player: cash(150_000) });
    const world = inflated.after.timeline[inflated.after.round];
    inflated.after.timeline[inflated.after.round] = { ...world, priceLevel: world.priceLevel * 2 };
    expect(badgesEarned(inflated)).toEqual([]);
  });

  it('gives the gallery its two badges', () => {
    const cars = content.items.filter((item) => item.ladder === 'car').map((item) => item.id);
    expect(cars).toHaveLength(7);
    expect(galleryBadges(content, cars)).toEqual(['every_car']);
    expect(galleryBadges(content, cars.slice(1))).toEqual([]);
    const twenty = content.items.slice(7, 27).map((item) => item.id);
    expect(galleryBadges(content, twenty)).toEqual(['twenty_items']);
    expect(galleryBadges(content, twenty.slice(1))).toEqual([]);
    expect(galleryBadges(content, content.items.map((item) => item.id))).toEqual(['twenty_items', 'every_car']);
    // The gallery is a set: owning one car twenty times is one item.
    expect(galleryBadges(content, new Array<string>(25).fill('car_seat_ibiza'))).toEqual([]);
  });
});

describe('the journal of a life', () => {
  it('starts with the city the life begins in and nothing else', () => {
    expect(journalStart(content, fresh())).toEqual({ cities: ['madrid'], cardUsed: false, kinds: [], earned: [] });
    const abroad = viewOf(createGame({ content, start: lives[5].start }, 'badges'));
    expect(journalStart(content, abroad).cities).toEqual(['london']);
  });

  it('remembers every city lived in, once each, in the order they came', () => {
    let journal = journalStart(content, fresh());
    const moveTo = (cityId: string) => {
      const s = step({ events: [{ kind: 'moved', cityId }], player: (p) => (p.cityId = cityId) });
      journal = journalAfter(content, journal, s.after, s.events);
    };
    moveTo('london');
    moveTo('madrid');
    moveTo('dubai');
    expect(journal.cities).toEqual(['madrid', 'london', 'dubai']);
  });

  it('remembers that the credit card was used, for good', () => {
    let journal = journalStart(content, fresh());
    journal = journalAfter(content, journal, fresh(), [{ kind: 'ledger', line: 'salary', amount: 100 }]);
    expect(journal.cardUsed).toBe(false);
    journal = journalAfter(content, journal, fresh(), [{ kind: 'ledger', line: 'creditCardDraw', amount: 5_000 }]);
    journal = journalAfter(content, journal, fresh(), [{ kind: 'ledger', line: 'creditCardRepay', amount: -5_000 }]);
    expect(journal.cardUsed).toBe(true);
  });

  it('remembers every kind of investment ever held, property included', () => {
    let journal = journalStart(content, fresh());
    const held = step({ player: all(hold('msci_world'), hold('apple'), home('studio', true)) });
    journal = journalAfter(content, journal, held.after, []);
    journal = journalAfter(content, journal, step({ player: hold('bitcoin') }).after, []);
    expect([...journal.kinds].sort()).toEqual(['crypto', 'fund', 'property', 'stock']);
  });

  it('does not change the journal it was given', () => {
    const journal = journalStart(content, fresh());
    const copy = structuredClone(journal);
    journalAfter(content, journal, step({ player: hold('bitcoin'), events: [{ kind: 'moved', cityId: 'dubai' }] }).after, [{ kind: 'ledger', line: 'creditCardDraw', amount: 1 }]);
    expect(journal).toEqual(copy);
  });
});

describe('a whole life', () => {
  it('can be judged at every step without a hitch, and earns only badges that exist', () => {
    const known = new Set(badges.map((b) => b.id));
    for (const life of lives) {
      let state: GameState = createGame({ content, start: life.start }, `judge-${life.id}`);
      let journal = journalStart(content, viewOf(state));
      const everything: string[] = [];
      while (!state.finished) {
        const before = state;
        const result = state.phase === 'cards' ? applyCard(content, state, 1) : applyRound(content, state, { orders: [{ type: 'focus', action: 'studyCareer' }] });
        state = result.state;
        journal = journalAfter(content, journal, viewOf(state), result.events);
        const earned = badgesEarned({ content, before: viewOf(before), after: viewOf(state), events: result.events, journal });
        for (const id of earned) {
          expect(known.has(id), id).toBe(true);
          expect(everything, `${id} earned twice`).not.toContain(id);
        }
        everything.push(...earned);
        journal = { ...journal, earned: [...journal.earned, ...earned] };
      }
      // Someone who studies and saves nothing else ends with money in the bank at least.
      expect(journal.cities.length, life.id).toBeGreaterThan(0);
      expect(everything.length, life.id).toBe(journal.earned.length);
    }
  });

  it('ages by two years a round from 22', () => {
    expect(ageAt(0)).toBe(22);
    expect(ageAt(9)).toBe(40);
    expect(ageAt(20)).toBe(62);
  });
});

describe('unlocking lives', () => {
  it('opens the rider after one finished life, the heir with a million, the newcomer with three cities', () => {
    expect(unlockedLives(lives, { finished: 0, badges: [] })).toEqual([]);
    expect(unlockedLives(lives, { finished: 1, badges: [] })).toEqual(['rider']);
    expect(unlockedLives(lives, { finished: 0, badges: ['millionaire'] })).toEqual(['heir']);
    expect(unlockedLives(lives, { finished: 0, badges: ['three_cities'] })).toEqual(['newcomer']);
    expect(unlockedLives(lives, { finished: 3, badges: ['first_100k', 'millionaire', 'three_cities'] })).toEqual(['rider', 'heir', 'newcomer']);
  });

  it('never lists a life that was open from the start', () => {
    const open = lives.filter((life) => life.unlock === 'default').map((life) => life.id);
    expect(open).toEqual(['nurse', 'engineer', 'civil_servant']);
    for (const id of open) expect(unlockedLives(lives, { finished: 9, badges: badges.map((b) => b.id) })).not.toContain(id);
  });
});
