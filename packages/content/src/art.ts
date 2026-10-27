import type { ChallengeRule } from './challenges';
import type { CelebHeadlines } from './text/types';
import type { DebtKind, FocusAction, Headline, InsuranceKind, ItemPerks, SkillId } from '@ratrace/engine';

/**
 * Which sprite shows each piece of content. Ids on the right are sprite ids in art/clean/manifest.json.
 * The engine never sees these; a test fails if one of them is missing from the manifest.
 */

const scene = (name: string) => `card.${name}`;


export const cardArt: Record<string, string> = {
  career_raise: scene('boss_door'),
  career_competitor_offer: scene('handshake'),
  career_relocation: scene('airport'),
  career_transfer_east: scene('office_east'),
  career_transfer_west: scene('office_west'),
  city_madrid_cana: scene('city_madrid_cana'),
  city_madrid_tourist_flat: scene('city_madrid_tourist_flat'),
  city_london_tube_strike: scene('city_london_tube_strike'),
  city_london_club: scene('city_london_club'),
  city_new_york_rent_hike: scene('city_new_york_rent_hike'),
  city_new_york_elevator_pitch: scene('city_new_york_elevator_pitch'),
  city_dubai_visa: scene('city_dubai_visa'),
  city_dubai_golden_visa: scene('city_dubai_golden_visa'),
  city_singapore_ballot: scene('city_singapore_ballot'),
  city_singapore_gum: scene('city_singapore_gum'),
  city_bangkok_flood: scene('city_bangkok_flood'),
  city_bangkok_beach_bar: scene('city_bangkok_beach_bar'),
  city_tokyo_earthquake: scene('city_tokyo_earthquake'),
  city_tokyo_karaoke: scene('city_tokyo_karaoke'),
  city_moscow_rouble: scene('city_moscow_rouble'),
  city_moscow_dacha: scene('city_moscow_dacha'),
  city_mexico_city_mordida: scene('city_mexico_city_mordida'),
  city_mexico_city_taqueria: scene('city_mexico_city_taqueria'),
  city_zurich_numbered_account: scene('city_zurich_numbered_account'),
  city_zurich_referendum: scene('city_zurich_referendum'),
  crime_trial: scene('courtroom'),
  crime_wrongly_accused: scene('crime_wrongly_accused'),
  crime_jail_cellmate: scene('crime_jail_cellmate'),
  crime_jail_commissary: scene('crime_jail_commissary'),
  crime_jail_library: scene('crime_jail_library'),
  crime_memoirs: scene('crime_memoirs'),
  crime_fake_mba: scene('crime_fake_mba'),
  crime_fake_mba_found: scene('crime_fake_mba_found'),
  crime_ham_smuggling: scene('crime_ham_smuggling'),
  crime_memecoin: scene('crime_memecoin'),
  crime_illegal_betting: scene('crime_illegal_betting'),
  crime_enchufe: scene('crime_enchufe'),
  crime_insider_tip: scene('crime_insider_tip'),
  crime_laundering: scene('crime_laundering'),
  red_licence: scene('red_licence'),
  red_appointment: scene('red_appointment'),
  red_works_stopped: scene('red_works_stopped'),
  red_inheritance: scene('red_inheritance'),
  red_grant: scene('red_grant'),
  refuge_bank_freeze: scene('refuge_bank_freeze'),
  lodger_good: scene('lodger_good'),
  lodger_unpaid: scene('lodger_unpaid'),
  lodger_friend: scene('lodger_friend'),
  lodger_tension: scene('lodger_tension'),
  career_overtime_crunch: scene('office_desk'),
  career_layoff: scene('packed_box'),
  career_restructuring: scene('restructuring'),
  career_toxic_boss: scene('angry_boss'),
  career_switch: scene('two_ladders'),
  career_big_offer: scene('tower_lobby'),
  career_shares_vs_salary: scene('shares_or_salary'),
  career_remote_work: scene('career_remote_work'),
  career_boss_leaves: scene('boss_leaves'),
  career_become_manager: scene('meeting_room'),
  career_headhunter: scene('headhunter_call'),
  career_law_firm: scene('law_office'),
  career_market: scene('street_market'),
  career_bar: scene('bar_tips'),
  career_teaching: scene('classroom'),
  career_creator: scene('ring_light'),
  career_out_of_town: scene('out_of_town'),
  life_club_contacts: scene('club_contacts'),

  edu_masters: scene('graduation'),
  edu_finance_course: scene('online_course'),
  edu_finance_book: scene('library'),
  edu_mba: scene('lecture_hall'),
  edu_bootcamp: scene('bootcamp'),
  edu_language: scene('language_class'),

  biz_freelance_gig: scene('biz_freelance_gig'),
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
  life_retreat: scene('retreat'),
  house_trendy_area: scene('trendy_area'),
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
  tax_letter: scene('tax_letter'),
  luck_barn_car: scene('barn_car'),
  life_mlm: scene('mlm'),
  house_squatters: scene('squatters'),
  house_solar: scene('solar'),
  fam_village_house: scene('village_house'),
  career_company_ipo: scene('company_ipo'),
  biz_metro_works: scene('metro_works'),
  career_strike: scene('strike'),
  life_school_reunion: scene('school_reunion'),
  fam_child_streamer: scene('child_streamer'),
  life_stag_party: scene('stag_party'),
  career_linkedin_post: scene('linkedin_post'),
  life_podcast: scene('podcast'),
  career_ai_agent: scene('ai_agent'),
  life_gig_apps: scene('gig_apps'),
  inv_copy_trading: scene('copy_trading'),
  luck_hacked: scene('hacked'),
  fam_signal_group: scene('signal_group'),
  house_remote_outskirts: scene('remote_outskirts'),
  house_back_home: scene('back_home'),
  life_midlife: scene('midlife'),
  fam_grandchild: scene('grandchild'),
  life_black_card: scene('black_card'),
  fam_piggy_bank: scene('child_piggy'),
  house_lift_levy: scene('lift_levy'),
  biz_street_contest: scene('street_contest'),
  career_xmas_dinner: scene('xmas_dinner'),
  career_sabbatical: scene('sabbatical'),
  career_credit_stolen: scene('credit_stolen'),
  luck_office_pool: scene('office_pool'),
  life_cooking_show: scene('cooking_show'),
  luck_viral_bad: scene('viral_bad'),
  biz_influencer_review: scene('influencer_review'),
  health_smartwatch: scene('smartwatch'),
  house_festival_rental: scene('festival_rental'),
  fam_school_treasurer: scene('school_treasurer'),
  luck_drone_crash: scene('drone_crash'),
  life_concert: scene('concert'),
  luck_police_auction: scene('police_auction'),
  house_protected_flat: scene('protected_flat'),
  career_startup_advisor: scene('startup_advisor'),
  house_upstairs_leak: scene('upstairs_leak'),
  career_transfer_asia: scene('transfer_asia'),
  life_digital_nomad: scene('digital_nomad'),
  career_offer_madrid: scene('offer_madrid'),
  city_tokyo_lifetime: scene('tokyo_lifetime'),
  city_zurich_savings: scene('zurich_savings'),
  city_london_flatshare: scene('london_flatshare'),
  tax_audit: scene('inspector'),
  tax_undeclared: scene('cash_envelope'),
  tax_residency: scene('city_arrival'),

  late_porsche: scene('coupe_garage'),
  late_university: scene('campus_dropoff'),
  late_early_retirement: scene('sunset_bench'),
  late_downsizing: scene('small_house'),
  late_will: scene('will_desk'),
  late_gift: scene('keys_to_children'),
  late_business_handover: scene('shop_handover'),
  late_parents_care: scene('care_home'),
  career_four_day_week: scene('four_day_week'),
  edu_company_course: scene('company_course'),
  biz_rival: scene('rival_shop'),
  biz_viral_review: scene('viral_review'),
  biz_labour_inspection: scene('labour_inspector'),
  inv_bank_product: scene('bank_product'),
  inv_leveraged_etf: scene('leveraged_chart'),
  house_noisy_neighbours: scene('noisy_neighbours'),
  house_levy: scene('building_levy'),
  house_lodger: scene('lodger_room'),
  life_bali_wedding: scene('bali_wedding'),
  fam_dog: scene('shelter_dog'),
  fam_partner_startup: scene('partner_startup'),
  tax_no_vat: scene('cash_no_invoice'),
  tax_amnesty: scene('tax_amnesty'),
  late_motorbike: scene('motorbike_window'),
  late_mentor: scene('mentor_session'),
  late_scam_call: scene('scam_message'),
  // The famous, as parodies.
  celeb_mosk: scene('celeb_mosk'),
  celeb_grump: scene('celeb_grump'),
  celeb_poutine: scene('celeb_poutine'),
  celeb_bufe: scene('celeb_bufe'),
  celeb_bozos: scene('celeb_bozos'),
  celeb_zuckerbot: scene('celeb_zuckerbot'),
  celeb_puertas: scene('celeb_puertas'),
  celeb_nakamoro: scene('celeb_nakamoro'),
  celeb_kardashion: scene('celeb_kardashion'),
  celeb_mrfeast: scene('celeb_mrfeast'),
  celeb_ronalgo: scene('celeb_ronalgo'),
  celeb_swiftly: scene('celeb_swiftly'),
  celeb_bellfort: scene('celeb_bellfort'),
  celeb_ortiga: scene('celeb_ortiga'),
  rich_fake_art: scene('rich_fake_art'),
  lodger_party: scene('lodger_party'),
  lodger_leaves: scene('lodger_leaves'),
  // Content 1.50: the people who come back (cards-50 to 53).
  inlaw_coin: scene('inlaw_coin'),
  inlaw_moon: scene('inlaw_moon'),
  inlaw_dinner: scene('inlaw_dinner'),
  inlaw_rug: scene('inlaw_rug'),
  inlaw_loan: scene('inlaw_loan'),
  inlaw_repay: scene('inlaw_repay'),
  boss_weekend: scene('boss_weekend'),
  boss_offer: scene('boss_offer'),
  boss_layoffs: scene('boss_layoffs'),
  landlord_damp: scene('landlord_damp'),
  landlord_raise: scene('landlord_raise'),
  landlord_sale: scene('landlord_sale'),
  founder_pitch: scene('founder_pitch'),
  founder_more: scene('founder_more'),
  founder_exit: scene('founder_exit'),
  founder_second: scene('founder_second'),
  advisor_fund: scene('advisor_fund'),
  advisor_insurance: scene('advisor_insurance'),
  parents_help: scene('parents_help'),
  parents_care: scene('parents_care'),
  parents_inheritance: scene('parents_inheritance'),
  cousin_wedding: scene('cousin_wedding'),
  ex_new_car: scene('ex_new_car'),
  classmate_job: scene('classmate_job'),
  // The people, deeper (cards-54).
  classmate_housewarming: scene('classmate_housewarming'),
  cousin_yacht: scene('cousin_yacht'),
  parents_visit: scene('parents_visit'),
  founder_bell: scene('founder_bell'),
  boss_retire: scene('boss_retire'),
  rich_lawsuit: scene('rich_lawsuit'),
  rich_scandal: scene('rich_scandal'),
  rich_tax_squad: scene('rich_tax_squad'),
  rich_partner_swindle: scene('rich_partner_swindle'),
  rich_divorce: scene('rich_divorce'),
  rich_gala: scene('rich_gala'),
  rich_uncle_castle: scene('rich_uncle_castle'),
  rich_yacht_rocks: scene('rich_yacht_rocks'),
  rich_threat: scene('rich_threat'),
  rich_hostile_bid: scene('rich_hostile_bid'),
};

/**
 * The lives drawn as women. The player's ex is of the other sex (the paper's people, `useRivals` in the app, holds the same list):
 * a man for these lives, a woman for the rest.
 */
export const LIVES_DRAWN_AS_WOMEN: readonly string[] = ['nurse', 'civil_servant', 'newcomer', 'doctor', 'founder', 'lawyer', 'programmer', 'influencer', 'salesperson', 'private_banker'];
/** A card that draws the player's ex: its own scene draws a woman, this one a man (cards-54). */
export const exAsManArt: Readonly<Record<string, string>> = { ex_new_car: 'card.ex_new_car_man' };
/** A card's scene in this life: the ex, where a card draws one, of the other sex to the player. */
export const cardArtOf = (cardId: string, lifeId?: string | null): string | undefined =>
  (lifeId != null && LIVES_DRAWN_AS_WOMEN.includes(lifeId) ? exAsManArt[cardId] : undefined) ?? cardArt[cardId];

/** Items are drawn by their own sprite. Cars live on their own sheet. */
export const itemArt = (itemId: string): string => (itemId.startsWith('car_') ? `car.${itemId.slice(4)}` : `item.${itemId}`);
/** The kinds of home each city draws its own way, once its sheet is cut. */
export const CITY_HOME_KINDS = ['studio', 'flat', 'loft', 'townhouse', 'house', 'duplex', 'chalet', 'penthouse', 'estate', 'villa', 'mansion'] as const;
/** The cities whose homes are drawn: until a city's sheet is cut, its homes are the plain ones. */
export const CITY_HOMES_DRAWN: readonly string[] = ['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok', 'tokyo', 'moscow', 'mexico_city', 'zurich'];
/** A kind of property, as the city it is in draws it, or plain where the city has no drawing of its own. */
/** The "for sale" board of a city, as it puts one up, or the board of the city of the start when the city has none. */
export const saleSignArt = (cityId: string): string => `home.${CITY_HOMES_DRAWN.includes(cityId) ? cityId : CITY_HOMES_DRAWN[0]}.sign`;
/** The kinds bought to let that every city sells, and draws its own way once its sheet of them is cut. */
export const CITY_RENTAL_KINDS = ['parking', 'shop', 'office', 'warehouse', 'block'] as const;
/** The cities whose kinds to let are drawn: until a city's sheet is cut, they are the plain ones. Each city's own kind is drawn by its id. */
export const CITY_RENTALS_DRAWN: readonly string[] = ['madrid', 'london', 'new_york', 'dubai', 'singapore', 'bangkok', 'tokyo', 'moscow', 'mexico_city', 'zurich'];
export const propertyArt = (typeId: string, cityId?: string): string => {
  if (cityId === undefined) return `home.${typeId}`;
  const drawn = (CITY_HOME_KINDS as readonly string[]).includes(typeId) ? CITY_HOMES_DRAWN : (CITY_RENTAL_KINDS as readonly string[]).includes(typeId) ? CITY_RENTALS_DRAWN : [];
  return drawn.includes(cityId) ? `home.${cityId}.${typeId}` : `home.${typeId}`;
};
export const rentTierArt: readonly [string, string] = ['home.rented_room', 'home.rented_flat'];
/** The skyline of a city: by night, or in the first light a round opens in. */
/** How a city is drawn: by night, by day, in a boom with cranes and fireworks, or in a crisis under the rain. */
export type CityLight = 'night' | 'day' | 'boom' | 'crisis';
export const CITY_LIGHTS: readonly CityLight[] = ['night', 'day', 'boom', 'crisis'];
export const cityArt = (cityId: string, light: CityLight = 'night'): string => (light === 'night' ? `skyline.${cityId}` : `skyline.${cityId}.${light}`);
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
};
/** The sign of each skill beyond the career, and of money sense. */
export const skillArt: Record<SkillId | 'finance' | 'career', string> = {
  career: 'icon.skill',
  finance: 'icon.skill_finance',
  negotiation: 'icon.skill_negotiation',
  languages: 'icon.skill_languages',
  network: 'icon.skill_network',
  management: 'icon.skill_management',
  health: 'icon.skill_health',
};
/** The sign of each kind of business. */
export const businessArt = (typeId: string): string => `business.${typeId}`;
/**
 * A business as big as it has grown: just started, doing well, thriving, by how much of its full
 * size its capital has reached.
 */
export const businessStageArt = (typeId: string, capital: number, scale: number): string => `business.${typeId}.${capital * 3 >= scale * 2 ? 3 : capital * 3 >= scale ? 2 : 1}`;
/** The second-hand shop: its sign, and the repair of a thing of each ladder, with a sign for any other. */
export const USED_ART = 'icon.used';
export const repairArt = (ladder: string): string => (ladder === 'car' ? 'icon.repair_car' : ladder === 'watch' ? 'icon.repair_watch' : 'icon.repair');
/** A life beside the lives of others. */
export const PERCENTILE_ART = 'icon.percentile';
export const focusArt: Record<FocusAction, string> = {
  overtime: 'icon.focus_overtime',
  studyCareer: 'icon.focus_study',
  jobHunt: 'icon.focus_hunt',
  askRaise: 'icon.use_pay',
  studyFinance: skillArt.finance,
  studyNegotiation: skillArt.negotiation,
  studyLanguages: skillArt.languages,
  networking: skillArt.network,
  exercise: skillArt.health,
  tease: 'icon.room_tease',
  careerMove: 'icon.star',
  familyTime: 'icon.focus_family',
  unwind: 'icon.focus_rest',
};
/** The filler headlines from this one on are about the famous, one each, in the order of `CELEBS`. */
export const CELEB_HEADLINES_FROM = 38;
/** The famous, by the ids of their portraits. */
export const CELEB_ART = ['mosk', 'grump', 'poutine', 'bufe', 'bozos', 'zuckerbot', 'puertas', 'nakamoro', 'kardashion', 'mrfeast', 'ronalgo', 'swiftly', 'bellfort', 'ortiga'].map((id) => `celeb.${id}`);
/** One of the famous saying a headline: who, and which of their lines (`CelebHeadlines`) says it. */
export type HeadlineVoice = { [C in keyof CelebHeadlines]: { celeb: C; line: keyof CelebHeadlines[C] } }[keyof CelebHeadlines];

/** Who speaks for an investment when its news is theirs to tell. */
const ASSET_VOICES: Readonly<Record<string, 'mosk' | 'bufe' | 'bozos' | 'zuckerbot' | 'ortiga' | 'kardashion'>> = {
  sp500: 'bufe',
  msci_world: 'bufe',
  coca_cola: 'bufe',
  amazon: 'bozos',
  tesla: 'mosk',
  apple: 'zuckerbot',
  microsoft: 'zuckerbot',
  nvidia: 'zuckerbot',
  inditex: 'ortiga',
  lvmh: 'kardashion',
};

/**
 * Which of the famous says a headline, if one does: the same news in their mouth, true or false
 * as the plain one would be. Only the words and the picture change, never what the news tells, so
 * no life's rules do. `n` is what the screen passes to vary the wording; on every other one the
 * famous speak, so the plain headlines are still read.
 */
export function headlineVoice(h: Headline, n: number): HeadlineVoice | null {
  if (n % 2 !== 0) return null;
  switch (h.topic) {
    case 'crypto':
      return h.phase === 'bull' || h.phase === 'mania' ? { celeb: 'mosk', line: h.phase } : { celeb: 'nakamoro', line: h.phase };
    case 'asset': {
      if (h.assetId === 'gold') return { celeb: 'poutine', line: h.trend };
      const celeb = ASSET_VOICES[h.assetId];
      return celeb === undefined ? null : { celeb, line: h.trend };
    }
    case 'property':
      return { celeb: 'grump', line: h.trend };
    case 'inflation':
      return h.trend === 'up' ? { celeb: 'poutine', line: 'inflation' } : null;
    default:
      return null;
  }
}

/**
 * The picture beside a headline: the portrait of the famous one it is about or who says it, or the
 * icon of its topic. `n` is the one its words were chosen with (see `headlineVoice`).
 */
export function headlineArt(h: Headline, n?: number): string {
  if (h.topic === 'noise' && h.id >= CELEB_HEADLINES_FROM) return CELEB_ART[h.id - CELEB_HEADLINES_FROM] ?? topicArt.noise;
  const voice = n === undefined ? null : headlineVoice(h, n);
  return voice === null ? topicArt[h.topic] : `celeb.${voice.celeb}`;
}

/** What a headline is about. */
export const topicArt: Record<Headline['topic'], string> = {
  regime: 'icon.economy',
  crypto: 'icon.crypto',
  rates: 'icon.rates',
  inflation: 'icon.inflation',
  property: 'icon.property',
  asset: 'icon.stock',
  taxes: 'icon.tax',
  noise: 'icon.news',
  government: 'icon.career_public',
};

/** A badge, or `locked` for one not earned yet. */
export const badgeArt = (badgeId: string): string => `badge.${badgeId}`;
/** The rim a badge is set in, by its rarity: bronze, silver, a laurel of gold, and the gem. */
export const RIM_ART = { common: 'rim.bronze', uncommon: 'rim.silver', rare: 'rim.gold', legendary: 'rim.gem' } as const;

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

/** The milestones of a life, each with its scene, told on the round it happens in. */
export type MilestoneScene = 'home' | 'wedding' | 'child' | 'businessSold' | 'retired' | 'promotion';
export const milestoneArt: Record<MilestoneScene, string> = {
  home: 'card.moment_home',
  wedding: 'card.moment_wedding',
  child: 'card.moment_child',
  businessSold: 'card.moment_business_sold',
  retired: 'card.moment_retired',
  promotion: 'card.moment_promotion',
};

/** The scene of each of a life's milestones (core's `LIFE_MILESTONES`), across the top of its big moment. */
export const LIFE_MILESTONE_ART = {
  escaped: 'milestone.escaped',
  worth10m: 'milestone.worth_10m',
  worth1m: 'milestone.worth_1m',
  home: 'milestone.first_home',
  business: 'milestone.first_business',
  halfway: 'milestone.halfway',
  debtFree: 'milestone.debt_free',
  worth100k: 'milestone.worth_100k',
} as const;

/** The guide's way into How to play, and its glossary. */
export const GUIDE_ART = { howTo: 'icon.howto', glossary: 'icon.glossary' } as const;

/** The warnings of a risk: the cash that rising prices eat, and overtime that may burn the player out. */
export const RISK_ART = { inflation: 'icon.inflation', burnout: 'icon.burnout' } as const;

/** The rat of the game, in the poses it takes on screen. */
export type RatPose = 'cheer' | 'hide' | 'exit' | 'count' | 'sleep' | 'shock' | 'think' | 'wave';
export const ratArt = (pose: RatPose): string => `rat.${pose}`;
export const RAT_POSES: readonly RatPose[] = ['cheer', 'hide', 'exit', 'count', 'sleep', 'shock', 'think', 'wave'];

/** The night sky of a city with its landmark, behind a portrait: lives tell apart by where they began. */
export const backdropArt = (cityId: string): string => `backdrop.${cityId}`;

/** The world at night, the cities of the game marked on it. */
export const MAP_ART = 'map.world';
/**
 * Where each city's light is on the map, as a share of its width and height: the route of a life is
 * drawn between them.
 */
export const MAP_PLACES: Readonly<Record<string, { x: number; y: number }>> = {
  new_york: { x: 0.268, y: 0.314 },
  mexico_city: { x: 0.175, y: 0.45 },
  london: { x: 0.455, y: 0.243 },
  madrid: { x: 0.443, y: 0.33 },
  zurich: { x: 0.491, y: 0.28 },
  moscow: { x: 0.566, y: 0.222 },
  dubai: { x: 0.611, y: 0.44 },
  bangkok: { x: 0.73, y: 0.509 },
  singapore: { x: 0.741, y: 0.587 },
  tokyo: { x: 0.848, y: 0.364 },
};

/** A life is drawn at four ages. */
export const PORTRAIT_AGES = [22, 32, 45, 58] as const;
export const portraitArt = (lifeId: string, age: (typeof PORTRAIT_AGES)[number]): string => `portrait.${lifeId}.${age}`;

/** The brand mark of a share or a coin, drawn in pixels. Funds, bonds and gold have none, and keep their ticker. */
export const assetLogo: Readonly<Partial<Record<string, string>>> = {
  apple: 'logo.apple', microsoft: 'logo.microsoft', nvidia: 'logo.nvidia', amazon: 'logo.amazon', tesla: 'logo.tesla',
  inditex: 'logo.inditex', lvmh: 'logo.lvmh', ferrari: 'logo.ferrari', santander: 'logo.santander', coca_cola: 'logo.coca_cola',
  bitcoin: 'logo.bitcoin', ethereum: 'logo.ethereum', dogecoin: 'logo.dogecoin',
};

/** Signing in with Google shows its mark. */
export const GOOGLE_LOGO = 'logo.google';

/** Assets with no brand mark have no sprite of their own: the interface draws a ticker badge over the icon of their class. */
export const assetClassArt: Record<'bond' | 'fund' | 'stock' | 'crypto' | 'gold', string> = {
  bond: 'icon.bond',
  fund: 'icon.fund',
  stock: 'icon.stock',
  crypto: 'icon.crypto',
  gold: 'icon.gold',
};

/** The sign of a career. */
export const careerArt = (careerId: string): string => `icon.career_${careerId}`;

/** The workplace of a career as the player rises in it: where they start, the middle of the ladder, and the top. */
export const workArt = (careerId: string, level: number, levels: number): string => `work.${careerId}.${level <= 0 ? 0 : level >= levels - 1 ? 2 : 1}`;

/** What a thing is good for, each use with its sign. */
export const perkArt: Record<keyof ItemPerks, string> = {
  moveCostOffPct: 'icon.use_move',
  studySkill: 'icon.use_study',
  salaryPct: 'icon.use_pay',
  jobHuntPct: 'icon.use_hunt',
  focus: 'icon.use_focus',
  healthCoverOffPct: 'icon.insure_health',
};

/** The sign of a debt: by its kind, and for a loan that bought a thing on instalments, the thing's key and tag. */
export const debtArt = (debt: { kind: DebtKind; forItem?: string }): string =>
  debt.forItem !== undefined ? 'icon.debt_instalments' : debt.kind === 'creditCard' ? 'icon.debt_card' : debt.kind === 'personalLoan' || debt.kind === 'margin' ? 'icon.debt_loan' : 'icon.debt_mortgage';
export const DEBT_ART = ['icon.debt_mortgage', 'icon.debt_loan', 'icon.debt_card', 'icon.debt_instalments'] as const;

/** A sign for each line of the balance sheet. */
export const balanceArt = {
  cash: 'icon.bal_cash',
  savings: 'icon.bal_savings',
  pension: 'icon.bal_pension',
  investments: 'icon.bal_investments',
  homes: 'icon.bal_property',
  businesses: 'icon.business',
  things: 'icon.bal_things',
  debts: 'icon.bal_debts',
} as const;

/** The frame of the portrait, plainest first, and the status each begins at. */
export const FRAME_ART: readonly string[] = ['frame.plain', 'frame.bronze', 'frame.silver', 'frame.gold'];
export const FRAME_STATUS: readonly number[] = [0, 25, 60, 100];
export const frameArt = (status: number): string => FRAME_ART[FRAME_STATUS.reduce((best, from, i) => (status >= from ? i : best), 0)];

/** The crest of a city. */
export const crestArt = (cityId: string): string => `crest.${cityId}`;

/** A loop of four frames. */
export type Loop = 'coin' | 'wheel' | 'confetti' | 'cheer' | 'burst';
export const LOOPS: readonly Loop[] = ['coin', 'wheel', 'confetti', 'cheer', 'burst'];
export const loopArt = (loop: Loop): string[] => [0, 1, 2, 3].map((frame) => `anim.${loop}.${frame}`);

/** What the rat in the wheel wears: a tracksuit for a frugal life, the suit of the logo, and a tuxedo for a rich one. */
export type RatOutfit = 'tracksuit' | 'suit' | 'tuxedo';
/** The outfits drawn, besides the suit of the plain wheel. */
export const RAT_OUTFITS_DRAWN: readonly RatOutfit[] = ['tracksuit', 'tuxedo'];
/** The wheel turning with the rat in an outfit, or the plain wheel while that outfit is not drawn. */
export const wheelArt = (outfit: RatOutfit): string[] =>
  RAT_OUTFITS_DRAWN.includes(outfit) ? [0, 1, 2, 3].map((frame) => `anim.wheel_${outfit}.${frame}`) : loopArt('wheel');

/** How a life ended: out of the rat race, an ordinary retirement, or with nothing. */
export type Ending = 'escaped' | 'retired' | 'ruined';
export const ENDINGS: readonly Ending[] = ['escaped', 'retired', 'ruined'];
export const endingArt = (ending: Ending): string => `end.${ending}`;

/** The household at home, or null for someone who lives alone: a couple, a family, and a full house from the third child. */
export const HOME_LIFE_ART = ['family.couple', 'family.children', 'family.full_house'] as const;
export const homeLifeArt = (home: { partner: boolean; children: number }): string | null =>
  home.children >= 3 ? HOME_LIFE_ART[2] : home.children >= 1 ? HOME_LIFE_ART[1] : home.partner ? HOME_LIFE_ART[0] : null;

/** The sign of each rule of the weekly challenge. */
export const ruleArt: Record<ChallengeRule, string> = {
  indexOnly: 'icon.rule_index_only',
  noLoans: 'icon.rule_no_loans',
  noMoving: 'icon.rule_no_moving',
  noProperty: 'icon.rule_no_property',
  startInDebt: 'icon.rule_start_in_debt',
  noBusiness: 'icon.rule_no_business',
  frugal: 'icon.rule_frugal',
  minimalist: 'icon.rule_minimalist',
  honest: 'icon.rule_honest',
  richHeir: 'icon.rule_rich_heir',
};
/** The weekly challenge: its sign, its picture, the mark of its best tenth, and the sign of a practice. */
export const CHALLENGE_ART = { icon: 'icon.challenge', scene: 'card.weekly_challenge', topTenth: 'icon.top_tenth', practice: 'icon.practice' } as const;
/** A life after work: its sign, and its picture where a workplace would be. */
export const RETIRED_ART = { icon: 'icon.retired', scene: 'card.retired_garden' } as const;
/** What is given to the children, a business handed on, and the risk of the years. */
export const GIFT_ART = 'icon.gift';
export const HANDOVER_ART = 'icon.handover';
export const HEALTH_RISK_ART = 'icon.health_risk';
