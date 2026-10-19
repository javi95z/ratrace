import { escapeProgress, homeOf, realNetWorth } from '@ratrace/engine';
import type { Content, GameEvent, GameView, Order, PlayerState, Position } from '@ratrace/engine';
import { assetKind } from './kinds';
import type { AssetKind } from './kinds';
import { usd } from './money';
import { storyAfter, storyStart } from './story';
import type { Story } from './story';

/** A life begins at 22 and ages by the years of a round. */
export const START_AGE = 22;

export type BadgeGroup = 'wealth' | 'escape' | 'investing' | 'status' | 'life' | 'misfortune' | 'multiplayer' | 'famous';

export interface BadgeDef {
  id: string;
  group: BadgeGroup;
}

/** The thirty badges of v1 (spec, Appendix C) and those added since, in the order the collection shows them. */
export const badges: BadgeDef[] = [
  { id: 'first_100k', group: 'wealth' },
  { id: 'millionaire', group: 'wealth' },
  { id: 'millionaire_by_35', group: 'wealth' },
  { id: 'ten_million', group: 'wealth' },
  { id: 'swiss_banker', group: 'wealth' },
  { id: 'fiscally_creative', group: 'wealth' },
  { id: 'tax_free_year', group: 'wealth' },
  { id: 'tax_haven', group: 'wealth' },
  { id: 'debt_free_at_40', group: 'wealth' },
  { id: 'no_credit_card', group: 'wealth' },
  { id: 'escaped', group: 'escape' },
  { id: 'off_the_grid', group: 'escape' },
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
  { id: 'bought_the_top', group: 'investing' },
  { id: 'first_luxury_watch', group: 'status' },
  { id: 'supercar', group: 'status' },
  { id: 'shipowner', group: 'status' },
  { id: 'penthouse', group: 'status' },
  { id: 'status_100', group: 'status' },
  { id: 'twenty_items', group: 'status' },
  { id: 'every_car', group: 'status' },
  { id: 'more_cars_than_spaces', group: 'status' },
  { id: 'three_cities', group: 'life' },
  { id: 'moved_to_dubai', group: 'life' },
  { id: 'world_tour', group: 'life' },
  { id: 'family_of_four', group: 'life' },
  { id: 'mba', group: 'life' },
  { id: 'sold_business', group: 'life' },
  { id: 'own_boss', group: 'life' },
  { id: 'home_again', group: 'life' },
  { id: 'rode_out_recession', group: 'life' },
  { id: 'bankrupt', group: 'misfortune' },
  { id: 'room_at_40', group: 'misfortune' },
  { id: 'ronin', group: 'misfortune' },
  { id: 'ex_convict', group: 'misfortune' },
  { id: 'truly_innocent', group: 'misfortune' },
  { id: 'audited', group: 'misfortune' },
  { id: 'mp_first_win', group: 'multiplayer' },
  { id: 'mp_full_house', group: 'multiplayer' },
  { id: 'mp_rematch_win', group: 'multiplayer' },
  // Met the famous: played along with one of their cards.
  { id: 'celeb_mosk', group: 'famous' },
  { id: 'celeb_grump', group: 'famous' },
  { id: 'celeb_poutine', group: 'famous' },
  { id: 'celeb_bufe', group: 'famous' },
  { id: 'celeb_bozos', group: 'famous' },
  { id: 'celeb_zuckerbot', group: 'famous' },
  { id: 'celeb_puertas', group: 'famous' },
  { id: 'celeb_nakamoro', group: 'famous' },
  { id: 'celeb_kardashion', group: 'famous' },
  { id: 'celeb_mrfeast', group: 'famous' },
  { id: 'celeb_ronalgo', group: 'famous' },
  { id: 'celeb_swiftly', group: 'famous' },
  { id: 'celeb_bellfort', group: 'famous' },
  { id: 'celeb_ortiga', group: 'famous' },
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
  /** What happened that is worth telling when the life is over. */
  story: Story;
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

export function journalStart(content: Content, view: GameView): Journal {
  return { cities: [view.player.cityId], cardUsed: false, kinds: [], earned: [], story: storyStart(content, view) };
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
    story: storyAfter(content, journal.story, after, events),
  };
}

/** The continent each city is on, for a life that has seen three of them. */
const CONTINENT: Readonly<Record<string, string>> = {
  madrid: 'europe', london: 'europe', moscow: 'europe', zurich: 'europe',
  new_york: 'america', mexico_city: 'america',
  dubai: 'asia', singapore: 'asia', bangkok: 'asia', tokyo: 'asia',
};

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
/** Never once inspected by the tax office, in the life so far or in this step. */
const neverInspected = (f: Facts): boolean => !f.journal.earned.includes('audited') && !f.events.some((e) => e.kind === 'audit');
const wentBankrupt = (f: Facts): boolean => f.journal.earned.includes('bankrupt') || f.events.some((e) => e.kind === 'bankrupt');

/** When each badge is earned. The two that are about the gallery of every life are judged by `galleryBadges`. */
const RULES: Record<string, (f: Facts) => boolean> = {
  first_100k: (f) => f.worth >= usd(100_000),
  millionaire: (f) => f.worth >= usd(1_000_000),
  millionaire_by_35: (f) => f.worth >= usd(1_000_000) && f.age <= 35,
  ten_million: (f) => f.worth >= usd(10_000_000),
  // A million, made or kept, while living among the private banks.
  swiss_banker: (f) => f.p.cityId === 'zurich' && f.worth >= usd(1_000_000),
  // A hundred thousand hidden that the office could still claim, and never once inspected.
  fiscally_creative: (f) =>
    f.p.life.evasion.evaded.reduce((sum, entry) => sum + entry.amount, 0) >= usd(100_000) && !f.journal.earned.includes('audited') && !f.events.some((e) => e.kind === 'audit'),
  // Two years of pay and not a cent of income tax, whether by the city or by cunning.
  tax_free_year: (f) => f.round && f.events.some((e) => e.kind === 'ledger' && e.line === 'salary' && e.amount > 0) && !f.events.some((e) => e.kind === 'ledger' && e.line === 'incomeTax'),
  // A company abroad, and three rounds of it on the books without the office ever coming.
  tax_haven: (f) => f.p.life.evasion.shell && new Set(f.p.life.evasion.evaded.map((entry) => entry.round)).size >= 3 && neverInspected(f),
  // Debts a bankruptcy wiped out are not debts paid.
  debt_free_at_40: (f) => f.round && f.age === 40 && f.p.debts.every((debt) => debt.principal === 0) && !wentBankrupt(f),
  no_credit_card: (f) => f.after.finished && !f.journal.cardUsed,

  escaped: (f) => f.escapedAtAge !== null,
  // Out of the rat race without the tax office ever knocking.
  off_the_grid: (f) => f.escapedAtAge !== null && neverInspected(f),
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
  // Something on the market worth half what was paid for it, and still held: the top, bought.
  bought_the_top: (f) => f.held.some((held) => held.position.basis > 0 && held.position.value * 2 <= held.position.basis),

  first_luxury_watch: (f) => LUXURY_WATCHES.some((watch) => owns(f.p, watch)),
  supercar: (f) => owns(f.p, 'car_lamborghini_aventador'),
  shipowner: (f) => owns(f.p, 'sea_sailboat') || owns(f.p, 'sea_motor_yacht'),
  penthouse: (f) => f.p.properties.some((property) => property.typeId === 'penthouse'),
  status_100: (f) => f.p.statusPoints >= 100,
  more_cars_than_spaces: (f) => {
    const cars = f.p.life.items.filter((owned) => owned.itemId.startsWith('car_')).length;
    const spaces = f.p.properties.filter((property) => property.typeId === 'parking').length;
    return spaces > 0 && cars > spaces;
  },

  three_cities: (f) => f.journal.cities.length >= 3,
  moved_to_dubai: (f) => f.events.some((e) => e.kind === 'moved' && e.cityId === 'dubai'),
  world_tour: (f) => new Set(f.journal.cities.map((city) => CONTINENT[city] ?? city)).size >= 3,
  family_of_four: (f) => f.p.life.partner && f.p.life.children.length >= 2,
  mba: (f) => owns(f.p, 'edu_mba'),
  sold_business: (f) => Object.hasOwn(f.p.life.flags, 'sold_business'),
  home_again: (f) => f.events.some((e) => e.kind === 'homecoming'),
  // The job left for a business of one's own, and a round lived from it.
  // The famous: one played along with leaves their mark.
  celeb_mosk: (f) => Object.hasOwn(f.p.life.flags, 'met_mosk'),
  celeb_grump: (f) => Object.hasOwn(f.p.life.flags, 'met_grump'),
  celeb_poutine: (f) => Object.hasOwn(f.p.life.flags, 'met_poutine'),
  celeb_bufe: (f) => Object.hasOwn(f.p.life.flags, 'met_bufe'),
  celeb_bozos: (f) => Object.hasOwn(f.p.life.flags, 'met_bozos'),
  celeb_zuckerbot: (f) => Object.hasOwn(f.p.life.flags, 'met_zuckerbot'),
  celeb_puertas: (f) => Object.hasOwn(f.p.life.flags, 'met_puertas'),
  celeb_nakamoro: (f) => Object.hasOwn(f.p.life.flags, 'met_nakamoro'),
  celeb_kardashion: (f) => Object.hasOwn(f.p.life.flags, 'met_kardashion'),
  celeb_mrfeast: (f) => Object.hasOwn(f.p.life.flags, 'met_mrfeast'),
  celeb_ronalgo: (f) => Object.hasOwn(f.p.life.flags, 'met_ronalgo'),
  celeb_swiftly: (f) => Object.hasOwn(f.p.life.flags, 'met_swiftly'),
  celeb_bellfort: (f) => Object.hasOwn(f.p.life.flags, 'met_bellfort'),
  celeb_ortiga: (f) => Object.hasOwn(f.p.life.flags, 'met_ortiga'),
  own_boss: (f) => f.round && f.p.businesses.some((business) => business.fullTime === true),
  rode_out_recession: (f) => f.round && f.world.regime === 'recession' && f.heldBefore.length > 0 && keptAll(f, f.heldBefore),

  bankrupt: (f) => f.events.some((e) => e.kind === 'bankrupt'),
  // Forty, and still in a room of a shared flat: no home of one's own and none rented whole.
  room_at_40: (f) => f.round && f.age === 40 && homeOf(f.p, f.content) === null && f.p.life.rentTier === 0,
  // A samurai without a master: the job lost in Tokyo, not given up for a pension.
  ex_convict: (f) => Object.hasOwn(f.p.life.flags, 'ex_convict'),
  truly_innocent: (f) => Object.hasOwn(f.p.life.flags, 'acquitted_innocent'),
  ronin: (f) => f.p.cityId === 'tokyo' && f.was.life.career !== null && f.p.life.career === null && f.p.life.retiredAtRound === null,
  audited: (f) => f.events.some((e) => e.kind === 'audit'),
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

/** How a multiplayer game ended for a player: whether they won it, how many played it, and whether it was a rematch. */
export interface RoomResult {
  /** True for a player who stayed to the end with no score below anyone else's. */
  won: boolean;
  /** Everyone who began the game, those who left after it began too. */
  players: number;
  rematch: boolean;
}

/** The badges of multiplayer: judged from how a game ended, never from a life, so the server never needs them. */
export const ROOM_BADGES: readonly string[] = ['mp_first_win', 'mp_full_house', 'mp_rematch_win'];

/** The multiplayer badges a game that ended so earns. */
export function roomBadges(result: RoomResult): string[] {
  if (!result.won || result.players < 2) return [];
  return ['mp_first_win', ...(result.players >= 6 ? ['mp_full_house'] : []), ...(result.rematch ? ['mp_rematch_win'] : [])];
}

/** What is kept with the cars but is no car: every car is a garage of four wheels. */
export const TWO_WHEELS: readonly string[] = ['car_motorbike'];

/** The badges that are about everything ever owned, across lives: those this gallery has earned. */
export function galleryBadges(content: Content, gallery: readonly string[]): string[] {
  const owned = new Set(gallery);
  const cars = content.items.filter((item) => item.ladder === 'car' && !TWO_WHEELS.includes(item.id));
  const earned: string[] = [];
  if (owned.size >= 20) earned.push('twenty_items');
  if (cars.length > 0 && cars.every((car) => owned.has(car.id))) earned.push('every_car');
  return earned;
}
