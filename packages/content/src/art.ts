import type { FocusAction, Headline, InsuranceKind } from '@ratrace/engine';

/**
 * Which sprite shows each piece of content. Ids on the right are sprite ids in art/clean/manifest.json.
 * The engine never sees these; a test fails if one of them is missing from the manifest.
 */

const scene = (name: string) => `card.${name}`;

export const cardArt: Record<string, string> = {
  career_raise: scene('boss_door'),
  career_competitor_offer: scene('handshake'),
  career_relocation: scene('airport'),
  career_overtime_crunch: scene('office_desk'),
  career_layoff: scene('packed_box'),
  career_toxic_boss: scene('angry_boss'),
  career_switch: scene('two_ladders'),
  career_big_offer: scene('tower_lobby'),
  career_shares_vs_salary: scene('shares_or_salary'),
  career_remote_work: scene('sunrise_balcony'),
  career_become_manager: scene('meeting_room'),
  career_headhunter: scene('headhunter_call'),
  career_law_firm: scene('courtroom'),
  career_market: scene('street_market'),

  edu_masters: scene('graduation'),
  edu_finance_course: scene('online_course'),
  edu_finance_book: scene('library'),
  edu_mba: scene('lecture_hall'),
  edu_bootcamp: scene('bootcamp'),
  edu_language: scene('language_class'),

  biz_freelance_gig: scene('kitchen_laptop'),
  biz_self_employed: scene('shopfront'),
  biz_bar: scene('bar'),
  biz_online_shop: scene('parcels'),
  biz_airbnb: scene('spare_room'),
  biz_app: scene('app_launch'),
  biz_cofounder: scene('pitch_napkin'),
  biz_acquisition: scene('contract_signing'),

  inv_hot_tip: scene('phone_chart'),
  inv_share_plan: scene('share_certificate'),
  inv_memecoin: scene('meme_coin'),
  inv_friend_startup: scene('garage_startup'),
  inv_ipo_hype: scene('trading_desk'),
  inv_ponzi: scene('shady_deal'),
  inv_exchange_freeze: scene('frozen_vault'),
  inv_offplan_dubai: scene('offplan_model'),
  inv_guru_course: scene('trading_guru'),
  inv_crowdfunding: scene('crowd_building'),

  house_rent_hike: scene('rent_letter'),
  house_first_flat: scene('door_keys'),
  house_landlord_sells: scene('sold_board'),
  house_refinance: scene('mortgage_scales'),
  house_tenant_default: scene('unpaid_rent'),
  house_renovation: scene('scaffolding'),
  house_flood: scene('flooded_room'),
  house_move_in: scene('moving_boxes'),

  life_sports_car: scene('sports_car'),
  life_ibiza: scene('beach_club'),
  life_new_phone: scene('phone_launch'),
  life_wedding_abroad: scene('beach_wedding'),
  life_rolex_call: scene('watch_boutique'),
  life_upgrade: scene('business_cabin'),
  life_designer_sale: scene('private_sale'),
  life_car_finance: scene('car_dealer'),
  life_bottle_service: scene('nightclub'),
  life_black_friday: scene('sale_crowd'),

  fam_dating: scene('dinner_for_two'),
  fam_wedding: scene('wedding'),
  fam_first_child: scene('nursery'),
  fam_prenup: scene('prenup'),
  fam_sibling_loan: scene('sibling_doorstep'),
  fam_cosign: scene('bank_cosign'),
  fam_support_parents: scene('family_dinner'),
  fam_inheritance: scene('will_reading'),
  fam_divorce: scene('torn_photo'),
  fam_school: scene('school_gate'),

  health_illness: scene('hospital'),
  health_burnout: scene('burnout'),
  health_dental: scene('dentist_chair'),
  health_injury: scene('pitch_injury'),
  health_gym_habit: scene('gym'),

  luck_lottery: scene('lottery'),
  luck_car_breakdown: scene('breakdown'),
  luck_tax_refund: scene('tax_refund'),
  luck_stolen_phone: scene('pickpocket'),
  luck_bonus: scene('bonus_confetti'),
  luck_phishing: scene('phishing'),
  luck_speeding_fine: scene('speed_camera'),
  luck_betting_app: scene('casino'),

  world_recession: scene('crash_screens'),
  world_rate_hike: scene('central_bank'),
  world_rate_cut: scene('rate_scissors'),
  world_inflation: scene('price_tags'),
  world_crypto_bull: scene('crypto_rocket'),
  world_crypto_winter: scene('crypto_winter'),
  world_housing_crash: scene('for_sale_signs'),
  world_tech_bubble: scene('tech_bubble'),
  world_ai_boom: scene('server_room'),
  world_pandemic: scene('empty_street'),
  world_tax_reform: scene('newsroom'),
  crisis_crash_panic: scene('crisis_black_monday'),
  crisis_crash_layoffs: scene('crisis_all_hands'),
  crisis_energy_bills: scene('crisis_thick_bill'),
  crisis_energy_wages: scene('crisis_picket'),
  crisis_debt_spreads: scene('crisis_spread'),
  crisis_debt_austerity: scene('crisis_cuts'),
  world_bank_failure: scene('bank_queue'),

  tax_advisor: scene('advisor_office'),
  tax_pension_topup: scene('piggy_bank'),
  tax_optimise: scene('receipts'),
  tax_audit: scene('inspector'),
  tax_undeclared: scene('cash_envelope'),
  tax_residency: scene('city_arrival'),

  late_porsche: scene('coupe_garage'),
  late_university: scene('campus_dropoff'),
  late_early_retirement: scene('sunset_bench'),
  late_downsizing: scene('small_house'),
  late_will: scene('will_desk'),
};

/** Items are drawn by their own sprite. Cars live on their own sheet. */
export const itemArt = (itemId: string): string => (itemId.startsWith('car_') ? `car.${itemId.slice(4)}` : `item.${itemId}`);
export const propertyArt = (typeId: string): string => `home.${typeId}`;
export const rentTierArt: readonly [string, string] = ['home.rented_room', 'home.rented_flat'];
/** The skyline of a city: by night, or in the first light a round opens in. */
export const cityArt = (cityId: string, light: 'night' | 'day' = 'night'): string => (light === 'day' ? `skyline.${cityId}.day` : `skyline.${cityId}`);
/** The landmark that stands for a city where there is only room for an icon. */
export const cityIcon = (cityId: string): string => `icon.city_${cityId}`;

/** Every picture of who shares a life. */
export const FAMILY_ART = ['icon.single', 'icon.dating', 'icon.partner', 'icon.married', 'icon.baby', 'icon.child', 'icon.teen', 'icon.family_four'] as const;

/**
 * Who shares the life, in pictures: the couple first, then the youngest child. A couple with two
 * children or more is one picture. `children` holds the rounds each child still depends on the
 * player, out of `childRounds`.
 */
export function familyArt(home: { partner: boolean; married: boolean; dating: boolean; children: readonly number[]; childRounds: number }): string[] {
  if (home.partner && home.children.length >= 2) return ['icon.family_four'];
  const couple = home.partner ? (home.married ? 'icon.married' : 'icon.partner') : home.dating ? 'icon.dating' : 'icon.single';
  if (home.children.length === 0) return [couple];
  // The youngest has the most rounds left. A third of childhood each: baby, child, teenager.
  const grown = home.childRounds - Math.max(...home.children);
  return [couple, grown * 3 < home.childRounds ? 'icon.baby' : grown * 3 < home.childRounds * 2 ? 'icon.child' : 'icon.teen'];
}

/** The four ways of living, the cheapest first. */
export const lifestyleArt: readonly string[] = ['icon.life_frugal', 'icon.life_normal', 'icon.life_comfortable', 'icon.life_lavish'];
/** A rented room and a rented flat, small enough to sit on a button. `rentTierArt` is the same pair drawn large. */
export const rentTierIcon: readonly string[] = ['icon.rent_room', 'icon.rent_flat'];
export const insuranceArt: Record<InsuranceKind, string> = {
  health: 'icon.insure_health',
  home: 'icon.insure_home',
  life: 'icon.insure_life',
  liability: 'icon.insure_liability',
};
export const focusArt: Record<FocusAction, string> = {
  overtime: 'icon.focus_overtime',
  studyCareer: 'icon.focus_study',
  jobHunt: 'icon.focus_hunt',
};
/** What a headline is about. */
export const topicArt: Record<Headline['topic'], string> = {
  regime: 'icon.economy',
  crypto: 'icon.crypto',
  rates: 'icon.rates',
  inflation: 'icon.inflation',
  property: 'icon.property',
};

/** A badge, or `locked` for one not earned yet. */
export const badgeArt = (badgeId: string): string => `badge.${badgeId}`;

/**
 * The picture of a moment that stops the game: leaving the rat race, going bankrupt, the first
 * million, and the opening of each crisis.
 */
export const momentArt: Record<string, string> = {
  escape: 'card.moment_escape',
  bankrupt: 'card.moment_bankrupt',
  million: 'card.moment_million',
  crash: 'card.moment_crash',
  energy: 'card.moment_energy',
  debt: 'card.moment_debt',
};

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

