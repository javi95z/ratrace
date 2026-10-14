/**
 * How hard each badge is to earn, from bronze to the gem. It is for collecting and says nothing of
 * the score, so it lives apart from the rules of the badges: the server, which judges badges,
 * never needs it, and a change of rarity is not a new version of the game.
 */
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITIES: readonly BadgeRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** The share of lives, in percent, a badge of each rarity is earned in: a common one in more than thirty in a hundred, a legendary one in fewer than two. */
export const RARITY_BANDS: Record<BadgeRarity, [number, number]> = { common: [30, 100], uncommon: [10, 30], rare: [2, 10], legendary: [0, 2] };

/**
 * Each badge's rarity. `judged` marks a rarity that is a judgement rather than a measure: what the
 * balance bots never do (marry, move of their own accord, collect, build a ladder of bonds) says
 * nothing of how often players do it. Every other rarity is checked against how often the bots
 * earn the badge.
 */
export const BADGE_RARITY: Record<string, { rarity: BadgeRarity; judged?: true }> = {
  first_100k: { rarity: 'common' },
  millionaire: { rarity: 'common' },
  millionaire_by_35: { rarity: 'legendary' },
  ten_million: { rarity: 'rare' },
  debt_free_at_40: { rarity: 'common' },
  no_credit_card: { rarity: 'common' },
  escaped: { rarity: 'uncommon' },
  escaped_before_40: { rarity: 'legendary' },
  escaped_before_35: { rarity: 'legendary' },
  passive_double: { rarity: 'rare' },
  first_share: { rarity: 'uncommon' },
  five_asset_classes: { rarity: 'rare' },
  bought_the_dip: { rarity: 'common' },
  crypto_winter: { rarity: 'common' },
  three_rentals: { rarity: 'uncommon' },
  bond_ladder: { rarity: 'rare', judged: true },
  index_only: { rarity: 'rare' },
  bought_the_top: { rarity: 'common' },
  first_luxury_watch: { rarity: 'uncommon' },
  supercar: { rarity: 'rare' },
  shipowner: { rarity: 'rare' },
  penthouse: { rarity: 'rare', judged: true },
  status_100: { rarity: 'uncommon' },
  twenty_items: { rarity: 'rare', judged: true },
  every_car: { rarity: 'legendary', judged: true },
  more_cars_than_spaces: { rarity: 'rare', judged: true },
  three_cities: { rarity: 'rare', judged: true },
  moved_to_dubai: { rarity: 'uncommon', judged: true },
  family_of_four: { rarity: 'uncommon', judged: true },
  mba: { rarity: 'rare' },
  sold_business: { rarity: 'rare' },
  rode_out_recession: { rarity: 'common' },
  bankrupt: { rarity: 'uncommon' },
  room_at_40: { rarity: 'uncommon' },
  audited: { rarity: 'rare', judged: true },
};

/** A badge's rarity: common for one this list does not name. */
export const rarityOf = (badgeId: string): BadgeRarity => BADGE_RARITY[badgeId]?.rarity ?? 'common';
