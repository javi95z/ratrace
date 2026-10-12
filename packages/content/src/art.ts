/**
 * Which sprite shows each piece of content. Ids on the right are sprite ids in art/clean/manifest.json.
 * The engine never sees these; a test fails if one of them is missing from the manifest.
 */

const scene = (name: string) => `card.${name}`;

export const cardArt: Record<string, string> = {
  career_raise: scene('office_desk'),
  career_competitor_offer: scene('handshake'),
  career_relocation: scene('airport'),
  career_overtime_crunch: scene('office_desk'),
  career_layoff: scene('packed_box'),
  career_toxic_boss: scene('burnout'),
  career_switch: scene('trading_desk'),
  career_big_offer: scene('handshake'),
  career_shares_vs_salary: scene('phone_chart'),
  career_remote_work: scene('sunrise_balcony'),
  career_become_manager: scene('office_desk'),
  career_headhunter: scene('city_arrival'),

  edu_masters: scene('graduation'),
  edu_finance_course: scene('online_course'),
  edu_finance_book: scene('library'),
  edu_mba: scene('graduation'),
  edu_bootcamp: scene('server_room'),
  edu_language: scene('library'),

  biz_freelance_gig: scene('office_desk'),
  biz_self_employed: scene('shopfront'),
  biz_bar: scene('bar'),
  biz_online_shop: scene('parcels'),
  biz_airbnb: scene('door_keys'),
  biz_app: scene('garage_startup'),
  biz_cofounder: scene('garage_startup'),
  biz_acquisition: scene('handshake'),

  inv_hot_tip: scene('phone_chart'),
  inv_share_plan: scene('trading_desk'),
  inv_memecoin: scene('meme_coin'),
  inv_friend_startup: scene('garage_startup'),
  inv_ipo_hype: scene('trading_desk'),
  inv_ponzi: scene('shady_deal'),
  inv_exchange_freeze: scene('frozen_vault'),
  inv_offplan_dubai: scene('scaffolding'),
  inv_guru_course: scene('online_course'),
  inv_crowdfunding: scene('door_keys'),

  house_rent_hike: scene('door_keys'),
  house_first_flat: scene('door_keys'),
  house_landlord_sells: scene('moving_boxes'),
  house_refinance: scene('central_bank'),
  house_tenant_default: scene('empty_street'),
  house_renovation: scene('scaffolding'),
  house_flood: scene('flooded_room'),
  house_move_in: scene('moving_boxes'),

  life_sports_car: scene('sports_car'),
  life_ibiza: scene('beach_club'),
  life_new_phone: scene('phone_launch'),
  life_wedding_abroad: scene('wedding'),
  life_rolex_call: scene('watch_boutique'),
  life_upgrade: scene('airport'),
  life_designer_sale: scene('watch_boutique'),
  life_car_finance: scene('sports_car'),
  life_bottle_service: scene('nightclub'),
  life_black_friday: scene('parcels'),

  fam_dating: scene('dinner_for_two'),
  fam_wedding: scene('wedding'),
  fam_first_child: scene('nursery'),
  fam_prenup: scene('receipts'),
  fam_sibling_loan: scene('family_dinner'),
  fam_cosign: scene('handshake'),
  fam_support_parents: scene('family_dinner'),
  fam_inheritance: scene('cash_envelope'),
  fam_divorce: scene('torn_photo'),
  fam_school: scene('nursery'),

  health_illness: scene('hospital'),
  health_burnout: scene('burnout'),
  health_dental: scene('hospital'),
  health_injury: scene('hospital'),
  health_gym_habit: scene('gym'),

  luck_lottery: scene('lottery'),
  luck_car_breakdown: scene('breakdown'),
  luck_tax_refund: scene('receipts'),
  luck_stolen_phone: scene('empty_street'),
  luck_bonus: scene('cash_envelope'),
  luck_phishing: scene('shady_deal'),
  luck_speeding_fine: scene('inspector'),
  luck_betting_app: scene('casino'),

  world_recession: scene('crash_screens'),
  world_rate_hike: scene('central_bank'),
  world_rate_cut: scene('central_bank'),
  world_inflation: scene('receipts'),
  world_crypto_bull: scene('meme_coin'),
  world_crypto_winter: scene('frozen_vault'),
  world_housing_crash: scene('empty_street'),
  world_tech_bubble: scene('trading_desk'),
  world_ai_boom: scene('server_room'),
  world_pandemic: scene('empty_street'),
  world_tax_reform: scene('newsroom'),
  world_bank_failure: scene('bank_queue'),

  tax_advisor: scene('receipts'),
  tax_pension_topup: scene('sunset_bench'),
  tax_optimise: scene('receipts'),
  tax_audit: scene('inspector'),
  tax_undeclared: scene('cash_envelope'),
  tax_residency: scene('city_arrival'),

  late_porsche: scene('sports_car'),
  late_university: scene('graduation'),
  late_early_retirement: scene('sunset_bench'),
  late_downsizing: scene('moving_boxes'),
  late_will: scene('sunset_bench'),
};

/** Items are drawn by their own sprite. Cars live on their own sheet. */
export const itemArt = (itemId: string): string => (itemId.startsWith('car_') ? `car.${itemId.slice(4)}` : `item.${itemId}`);

export const propertyArt = (typeId: string): string => `home.${typeId}`;
export const rentTierArt: readonly [string, string] = ['home.rented_room', 'home.rented_flat'];
export const cityArt = (cityId: string): string => `skyline.${cityId}`;

/** A life is drawn at four ages. */
export const PORTRAIT_AGES = [22, 32, 45, 58] as const;
export const portraitArt = (lifeId: string, age: (typeof PORTRAIT_AGES)[number]): string => `portrait.${lifeId}.${age}`;

/** Assets have no sprite of their own: the interface draws a ticker badge over the icon of their class. */
export const assetClassArt: Record<'bond' | 'fund' | 'stock' | 'crypto' | 'gold', string> = {
  bond: 'icon.bond',
  fund: 'icon.fund',
  stock: 'icon.stock',
  crypto: 'icon.crypto',
  gold: 'icon.gold',
};

/** How the market screen groups assets. Index funds are equities in the engine, but a player thinks of them apart from single stocks. */
export type AssetKind = 'fund' | 'bond' | 'stock' | 'crypto' | 'gold';

const FUNDS: ReadonlySet<string> = new Set(['sp500', 'msci_world']);

export function assetKind(asset: { id: string; class: 'bond' | 'equity' | 'crypto' | 'gold' }): AssetKind {
  if (asset.class === 'equity') return FUNDS.has(asset.id) ? 'fund' : 'stock';
  return asset.class;
}
