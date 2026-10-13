import { escapeProgress, realNetWorth } from '@ratrace/engine';
import type { Content, GameEvent, GameView, Order, PlayerState, Position } from '@ratrace/engine';
import { assetKind } from './art';
import type { AssetKind } from './art';
import { usd } from './money';

/** A life begins at 22 and ages by the years of a round. */
export const START_AGE = 22;

export type BadgeGroup = 'wealth' | 'escape' | 'investing' | 'status' | 'life' | 'misfortune';

export interface BadgeDef {
  id: string;
  group: BadgeGroup;
}

/** The thirty badges of v1, in the order the collection shows them (spec, Appendix C). */
export const badges: BadgeDef[] = [
  { id: 'first_100k', group: 'wealth' },
  { id: 'millionaire', group: 'wealth' },
  { id: 'millionaire_by_35', group: 'wealth' },
  { id: 'ten_million', group: 'wealth' },
  { id: 'debt_free_at_40', group: 'wealth' },
  { id: 'no_credit_card', group: 'wealth' },
  { id: 'escaped', group: 'escape' },
  { id: 'escaped_before_40', group: 'escape' },
  { id: 'escaped_before_35', group: 'escape' },
  { id: 'passive_double', group: 'escape' },
  { id: 'first_share', group: 'investing' },
  { id: 'five_asset_classes', group: 'investing' },
  { id: 'bought_the_dip', group: 'investing' },
  { id: 'crypto_winter', group: 'investing' },
  { id: 'three_rentals', group: 'investing' },
  { id: 'bond_ladder', group: 'investing' },
  { id: 'index_only', group: 'investing' },
  { id: 'first_luxury_watch', group: 'status' },
  { id: 'supercar', group: 'status' },
  { id: 'penthouse', group: 'status' },
  { id: 'status_100', group: 'status' },
  { id: 'twenty_items', group: 'status' },
  { id: 'every_car', group: 'status' },
  { id: 'three_cities', group: 'life' },
  { id: 'moved_to_dubai', group: 'life' },
  { id: 'family_of_four', group: 'life' },
  { id: 'mba', group: 'life' },
  { id: 'sold_business', group: 'life' },
  { id: 'rode_out_recession', group: 'life' },
  { id: 'bankrupt', group: 'misfortune' },
];

/**
 * What a life has shown so far that one step cannot. It is derived from the events of the life,
 * so playing a saved game again from its seed rebuilds it exactly.
 */
export interface Journal {
  /** Every city lived in, the first one first. */
  cities: string[];
  /** True once a shortfall went on the credit card. */
  cardUsed: boolean;
  /** Every kind of investment ever held: fund, bond, stock, crypto, gold, property. */
  kinds: string[];
  /** Badges earned in this life, in the order they came. */
  earned: string[];
}

/** One step of a life as the badges see it: the answer to a card, or a round. */
export interface Step {
  content: Content;
  /** The game before the step. For a round, that is after its cards and before its orders. */
  before: GameView;
  after: GameView;
  events: GameEvent[];
  /** The orders of the round, as the player gave them. None for the answer to a card. */
  orders: readonly Order[];
  /** The journal as it stands after the step, without the badges the step is about to earn. */
  journal: Journal;
}

type Kind = AssetKind | 'property';

/** What a player holds that is worth something, with the kind the market screen files it under. */
function holdings(content: Content, p: PlayerState): Array<{ id: string; kind: AssetKind; position: Position }> {
  return content.assets
    .filter((asset) => Object.hasOwn(p.positions, asset.id) && p.positions[asset.id].value > 0)
    .map((asset) => ({ id: asset.id, kind: assetKind(asset), position: p.positions[asset.id] }));
}

function kindsHeld(content: Content, p: PlayerState): Kind[] {
  const kinds = new Set<Kind>(holdings(content, p).map((held) => held.kind));
  if (p.properties.length > 0) kinds.add('property');
  return [...kinds];
}

export function journalStart(_content: Content, view: GameView): Journal {
  return { cities: [view.player.cityId], cardUsed: false, kinds: [], earned: [] };
}

/** The journal after a step. Badges are not added here: `badgesEarned` says which are new, and the caller records them. */
export function journalAfter(content: Content, journal: Journal, after: GameView, events: GameEvent[]): Journal {
  const city = after.player.cityId;
  const kinds = new Set([...journal.kinds, ...kindsHeld(content, after.player)]);
  return {
    cities: journal.cities.includes(city) ? journal.cities : [...journal.cities, city],
    cardUsed: journal.cardUsed || events.some((e) => e.kind === 'ledger' && e.line === 'creditCardDraw' && e.amount !== 0),
    kinds: [...kinds],
    earned: journal.earned,
  };
}

/** The watches that count as luxury: from the first one a jeweller would lock away. */
const LUXURY_WATCHES = ['watch_omega', 'watch_rolex', 'watch_ap', 'watch_patek'];

/** Everything a rule may look at, worked out once for the step. */
interface Facts extends Step {
  p: PlayerState;
  was: PlayerState;
  /** True for a round, false for the answer to a card. */
  round: boolean;
  /** The world the step was played in. */
  world: GameView['timeline'][number];
  /** The player's age once the step is over. */
  age: number;
  /** Net worth in start-of-game cents. */
  worth: number;
  held: ReturnType<typeof holdings>;
  heldBefore: ReturnType<typeof holdings>;
  escapedAtAge: number | null;
}

function factsOf(step: Step): Facts {
  const { content, before, after, events } = step;
  const years = content.yearsPerRound;
  const escape = events.find((e): e is Extract<GameEvent, { kind: 'escaped' }> => e.kind === 'escaped');
  return {
    ...step,
    p: after.player,
    was: before.player,
    round: after.round === before.round + 1,
    world: before.timeline[before.round],
    age: START_AGE + after.round * years,
    worth: realNetWorth(after),
    held: holdings(content, after.player),
    heldBefore: holdings(content, before.player),
    escapedAtAge: escape ? START_AGE + escape.round * years : null,
  };
}

const basisOf = (p: PlayerState, assetId: string): number => (Object.hasOwn(p.positions, assetId) ? p.positions[assetId].basis : 0);
const owns = (p: PlayerState, itemId: string): boolean => p.life.items.some((item) => item.itemId === itemId);
/**
 * True if none of these was sold in the step: no order tried to sell one, each is still there, and
 * what was paid for the part held has not shrunk. Selling and buying back in the same round is selling.
 */
const keptAll = (f: Facts, kept: Facts['heldBefore']): boolean =>
  kept.every(
    (held) =>
      !f.orders.some((order) => order.type === 'sell' && order.assetId === held.id) &&
      Object.hasOwn(f.p.positions, held.id) &&
      f.p.positions[held.id].basis >= held.position.basis,
  );
const wentBankrupt = (f: Facts): boolean => f.journal.earned.includes('bankrupt') || f.events.some((e) => e.kind === 'bankrupt');

/** When each badge is earned. The two that are about the gallery of every life are judged by `galleryBadges`. */
const RULES: Record<string, (f: Facts) => boolean> = {
  first_100k: (f) => f.worth >= usd(100_000),
  millionaire: (f) => f.worth >= usd(1_000_000),
  millionaire_by_35: (f) => f.worth >= usd(1_000_000) && f.age <= 35,
  ten_million: (f) => f.worth >= usd(10_000_000),
  // Debts a bankruptcy wiped out are not debts paid.
  debt_free_at_40: (f) => f.round && f.age === 40 && f.p.debts.every((debt) => debt.principal === 0) && !wentBankrupt(f),
  no_credit_card: (f) => f.after.finished && !f.journal.cardUsed,

  escaped: (f) => f.escapedAtAge !== null,
  escaped_before_40: (f) => f.escapedAtAge !== null && f.escapedAtAge < 40,
  escaped_before_35: (f) => f.escapedAtAge !== null && f.escapedAtAge < 35,
  passive_double: (f) => {
    const escape = escapeProgress(f.content, f.after);
    return escape.outgoings > 0 && escape.passiveAfterTax >= 2 * escape.outgoings;
  },

  first_share: (f) => f.held.some((held) => held.kind === 'stock'),
  five_asset_classes: (f) => kindsHeld(f.content, f.p).length >= 5,
  bought_the_dip: (f) =>
    f.world.regime === 'recession' &&
    f.content.assets.some((asset) => ['fund', 'stock'].includes(assetKind(asset)) && basisOf(f.p, asset.id) > basisOf(f.was, asset.id)),
  crypto_winter: (f) => {
    const coins = f.heldBefore.filter((held) => held.kind === 'crypto');
    return f.round && f.world.cryptoPhase === 'winter' && coins.length > 0 && keptAll(f, coins);
  },
  // A parking space is a let, but three of them cost less than one studio: the badge is for a landlord.
  three_rentals: (f) => f.p.properties.filter((property) => property.rented && property.typeId !== 'parking').length >= 3,
  bond_ladder: (f) => {
    const bonds = f.content.assets.filter((asset) => assetKind(asset) === 'bond');
    return bonds.length > 0 && bonds.every((bond) => f.held.some((held) => held.id === bond.id));
  },
  index_only: (f) =>
    f.escapedAtAge !== null &&
    f.held.length > 0 &&
    f.held.every((held) => held.kind === 'fund') &&
    f.p.properties.length === 0 &&
    f.journal.kinds.every((kind) => kind === 'fund'),

  first_luxury_watch: (f) => LUXURY_WATCHES.some((watch) => owns(f.p, watch)),
  supercar: (f) => owns(f.p, 'car_lamborghini_aventador'),
  penthouse: (f) => f.p.properties.some((property) => property.typeId === 'penthouse'),
  status_100: (f) => f.p.statusPoints >= 100,

  three_cities: (f) => f.journal.cities.length >= 3,
  moved_to_dubai: (f) => f.events.some((e) => e.kind === 'moved' && e.cityId === 'dubai'),
  family_of_four: (f) => f.p.life.partner && f.p.life.children.length >= 2,
  mba: (f) => owns(f.p, 'edu_mba'),
  sold_business: (f) => Object.hasOwn(f.p.life.flags, 'sold_business'),
  rode_out_recession: (f) => f.round && f.world.regime === 'recession' && f.heldBefore.length > 0 && keptAll(f, f.heldBefore),

  bankrupt: (f) => f.events.some((e) => e.kind === 'bankrupt'),
};

/**
 * The badges a step earns that this life has not earned before, in the order of `badges`.
 * The same code judges a life wherever it runs: in the browser today, on a server later.
 */
export function badgesEarned(step: Step): string[] {
  const facts = factsOf(step);
  return badges
    .filter((badge) => Object.hasOwn(RULES, badge.id) && !step.journal.earned.includes(badge.id) && RULES[badge.id](facts))
    .map((badge) => badge.id);
}

/** The badges that are about everything ever owned, across lives: those this gallery has earned. */
export function galleryBadges(content: Content, gallery: readonly string[]): string[] {
  const owned = new Set(gallery);
  const cars = content.items.filter((item) => item.ladder === 'car');
  const earned: string[] = [];
  if (owned.size >= 20) earned.push('twenty_items');
  if (cars.length > 0 && cars.every((car) => owned.has(car.id))) earned.push('every_car');
  return earned;
}
