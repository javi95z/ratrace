/** How a raw sheet is laid out and what each cell on it is called. */
export interface SheetSpec {
  /** Path under art/raw, without the file extension. */
  file: string;
  /** Output folder under art/clean, and the name of the contact sheet. */
  group: string;
  /**
   * objects: things on the key colour, found by their outline.
   * portraits: busts that fill their cells, cut on the fixed grid.
   * scenes: full pictures separated by dividing lines.
   * layers: pieces of the player's rat, cut on the fixed grid and placed over the reference rat
   *   (the first cell of `over`), so that any body takes any outfit, hat or eyewear.
   */
  kind: 'objects' | 'portraits' | 'scenes' | 'layers';
  cols: number;
  rows: number;
  /** Sprite size in pixels. */
  width: number;
  height: number;
  /** Cell names, left to right and top to bottom. An empty name skips the cell. */
  ids: string[];
  /** For layers: the sheet whose first cell is the rat every piece is placed over. */
  over?: string;
  /** For layers: drawn over a pale guide of the rat, which is not part of the piece. */
  guided?: boolean;
  /** For layers: where the piece is worn, the part of the rat it is fitted to. */
  worn?: 'head' | 'body' | 'all';
  /** For layers: strokes up to twice this many pixels wide, on the raw sheet, are taken out. */
  thinnest?: number;
}

const LIVES_A = ['nurse', 'engineer', 'civil_servant', 'rider'];
const LIVES_B = ['heir', 'newcomer', 'banker', 'doctor'];
const LIVES_C = ['comeback', 'founder', 'crypto_kid', 'nomad'];
const LIVES_D = ['lawyer', 'teacher', 'influencer', 'waiter'];
// The salesperson, and three lives for careers the game does not have yet.
const LIVES_E = ['salesperson', 'electrician', 'pilot', 'scientist'];
// A life for each of the four cities added later.
const LIVES_F = ['robotics_engineer', 'programmer', 'chef', 'private_banker'];
const AGES = [22, 32, 45, 58];
/** A workplace for each career, two to a sheet, each at three stages: starting out, established, at the top. The last is for a trade to come. */
const WORKPLACES = [['healthcare', 'tech'], ['public', 'service'], ['finance', 'medicine'], ['law', 'education'], ['influencer', 'hospitality'], ['sales', 'trades']];
const portraits = (lives: string[]) => lives.flatMap((life) => AGES.map((age) => `portrait.${life}.${age}`));

export const SHEETS: SheetSpec[] = [
  {
    file: 'items/items-01', group: 'items', kind: 'objects', cols: 4, rows: 4, width: 64, height: 64,
    ids: [
      'item.watch_casio', 'item.watch_tissot', 'item.watch_omega', 'item.watch_rolex',
      'item.watch_ap', 'item.watch_patek', 'item.tech_phone', 'item.tech_laptop',
      'item.tech_console', 'item.fashion_blazer', 'item.fashion_polo', 'item.fashion_loafers',
      'item.fashion_duffel', 'item.fashion_birkin', 'item.art_stencil', 'item.art_cubist',
    ],
  },
  {
    file: 'items/items-02', group: 'items', kind: 'objects', cols: 4, rows: 4, width: 64, height: 64,
    ids: [
      'item.travel_weekend', 'item.travel_ibiza', 'item.travel_business_class', 'item.travel_maldives',
      'item.member_gym', 'item.member_club', 'item.member_platinum_card', 'item.member_season_seat',
      'item.sea_yacht_charter', 'item.air_jet_charter', 'item.edu_mba', 'item.tech_camera',
      'item.tech_headset', 'item.fashion_sneakers', 'item.member_golf', 'item.art_wine',
    ],
  },
  {
    // One seat a city. Until it lands, `ITEM_STAND_IN` in the content lends each of them Madrid's. The last cell is for a later item.
    file: 'items/items-03', group: 'items', kind: 'objects', cols: 3, rows: 2, width: 64, height: 64,
    ids: [
      'item.member_seat_london', 'item.member_seat_new_york', 'item.member_beach_dubai',
      'item.member_paddock_singapore', 'item.member_ringside_bangkok', 'item.member_opera',
    ],
  },
  {
    // Sixteen more rungs: travel, air and sea, art and fashion.
    // The last cell is the shipowner's badge, drawn here beside the boats it is earned with.
    file: 'items/items-04', group: 'items', kind: 'objects', cols: 4, rows: 4, width: 64, height: 64,
    ids: [
      'item.travel_interrail', 'item.travel_ski', 'item.travel_safari', 'item.travel_world_first',
      'item.sea_sailing_course', 'item.air_helicopter', 'item.sea_sailboat', 'item.sea_motor_yacht',
      'item.art_local_print', 'item.art_photo', 'item.art_bronze', 'item.art_old_master',
      'item.fashion_sunglasses', 'item.fashion_suit', 'item.fashion_coat', 'badge.shipowner',
    ],
  },
  {
    // Three ways to learn that are bought: a certificate, a coach, a school abroad.
    file: 'items/items-05', group: 'items', kind: 'objects', cols: 3, rows: 1, width: 64, height: 64,
    ids: ['item.edu_certificate', 'item.edu_coach', 'item.edu_language_school'],
  },
  // A dog from the shelter.
  { file: 'items/items-06', group: 'items', kind: 'objects', cols: 1, rows: 1, width: 64, height: 64, ids: ['item.pet_dog'] },
  {
    file: 'cars/cars-01', group: 'cars', kind: 'objects', cols: 2, rows: 4, width: 96, height: 48,
    ids: [
      'car.seat_ibiza', 'car.toyota_corolla', 'car.vw_golf_gti', 'car.tesla_model_3',
      'car.bmw_m3', 'car.porsche_911', 'car.lamborghini_aventador', 'car.mercedes_g_class',
    ],
  },
  // Two wheels, kept with the cars.
  { file: 'cars/cars-02', group: 'cars', kind: 'objects', cols: 1, rows: 1, width: 96, height: 48, ids: ['car.motorbike'] },
  {
    file: 'homes/homes-01', group: 'homes', kind: 'objects', cols: 3, rows: 3, width: 128, height: 128,
    ids: [
      'home.rented_room', 'home.rented_flat', 'home.studio',
      'home.flat', 'home.house', 'home.penthouse',
      'home.villa', 'home.parking', 'home.shop',
    ],
  },
  {
    // Nine more kinds of property: six to live in, three to let.
    file: 'homes/homes-02', group: 'homes', kind: 'objects', cols: 3, rows: 3, width: 128, height: 128,
    ids: [
      'home.loft', 'home.townhouse', 'home.duplex',
      'home.chalet', 'home.estate', 'home.mansion',
      'home.office', 'home.warehouse', 'home.block',
    ],
  },
  {
    // Eleven homes as Madrid builds them, and its "for sale" sign.
    file: 'homes/homes-madrid', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.madrid.studio', 'home.madrid.flat', 'home.madrid.loft', 'home.madrid.townhouse', 'home.madrid.house', 'home.madrid.duplex', 'home.madrid.chalet', 'home.madrid.penthouse', 'home.madrid.estate', 'home.madrid.villa', 'home.madrid.mansion', 'home.madrid.sign'],
  },
  {
    // Eleven homes as London builds them, and its "for sale" sign.
    file: 'homes/homes-london', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.london.studio', 'home.london.flat', 'home.london.loft', 'home.london.townhouse', 'home.london.house', 'home.london.duplex', 'home.london.chalet', 'home.london.penthouse', 'home.london.estate', 'home.london.villa', 'home.london.mansion', 'home.london.sign'],
  },
  {
    // Eleven homes as New York builds them, and its "for sale" sign.
    file: 'homes/homes-new-york', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.new_york.studio', 'home.new_york.flat', 'home.new_york.loft', 'home.new_york.townhouse', 'home.new_york.house', 'home.new_york.duplex', 'home.new_york.chalet', 'home.new_york.penthouse', 'home.new_york.estate', 'home.new_york.villa', 'home.new_york.mansion', 'home.new_york.sign'],
  },
  {
    // Eleven homes as Dubai builds them, and its "for sale" sign.
    file: 'homes/homes-dubai', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.dubai.studio', 'home.dubai.flat', 'home.dubai.loft', 'home.dubai.townhouse', 'home.dubai.house', 'home.dubai.duplex', 'home.dubai.chalet', 'home.dubai.penthouse', 'home.dubai.estate', 'home.dubai.villa', 'home.dubai.mansion', 'home.dubai.sign'],
  },
  {
    // Eleven homes as Singapore builds them, and its "for sale" sign.
    file: 'homes/homes-singapore', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.singapore.studio', 'home.singapore.flat', 'home.singapore.loft', 'home.singapore.townhouse', 'home.singapore.house', 'home.singapore.duplex', 'home.singapore.chalet', 'home.singapore.penthouse', 'home.singapore.estate', 'home.singapore.villa', 'home.singapore.mansion', 'home.singapore.sign'],
  },
  {
    // Eleven homes as Bangkok builds them, and its "for sale" sign.
    file: 'homes/homes-bangkok', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.bangkok.studio', 'home.bangkok.flat', 'home.bangkok.loft', 'home.bangkok.townhouse', 'home.bangkok.house', 'home.bangkok.duplex', 'home.bangkok.chalet', 'home.bangkok.penthouse', 'home.bangkok.estate', 'home.bangkok.villa', 'home.bangkok.mansion', 'home.bangkok.sign'],
  },
  {
    file: 'icons/icons-01', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.account', 'icon.deposit', 'icon.bond', 'icon.fund',
      'icon.stock', 'icon.crypto', 'icon.gold', 'icon.property',
      'icon.pension', 'icon.business', 'icon.mortgage', 'icon.loan',
      'icon.card', 'icon.tax', 'icon.insurance', 'icon.focus',
    ],
  },
  {
    file: 'icons/icons-02', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.cash', 'icon.cashflow', 'icon.status', 'icon.skill',
      'icon.job', 'icon.family', 'icon.city', 'icon.news',
      'icon.mood', 'icon.inflation', 'icon.rates', 'icon.calendar',
      'icon.locked', 'icon.star', 'icon.settings', 'icon.trophy',
    ],
  },
  {
    // A picture for every choice of the lifestyle tab.
    file: 'icons/icons-03', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.life_frugal', 'icon.life_normal', 'icon.life_comfortable', 'icon.life_lavish',
      'icon.rent_room', 'icon.rent_flat', 'icon.insure_health', 'icon.insure_home',
      'icon.insure_life', 'icon.insure_liability', 'icon.focus_overtime', 'icon.focus_study',
      'icon.focus_hunt', 'icon.economy', 'icon.move', 'icon.exit_door',
    ],
  },
  {
    // Who shares the life: not shown anywhere yet.
    file: 'icons/icons-04', group: 'icons', kind: 'objects', cols: 4, rows: 2, width: 32, height: 32,
    ids: ['icon.single', 'icon.dating', 'icon.partner', 'icon.married', 'icon.baby', 'icon.child', 'icon.teen', 'icon.family_four'],
  },
  {
    // A landmark for each city, to stand where the globe of `icon.city` stands today.
    file: 'icons/icons-05', group: 'icons', kind: 'objects', cols: 3, rows: 2, width: 32, height: 32,
    ids: ['icon.city_madrid', 'icon.city_london', 'icon.city_new_york', 'icon.city_dubai', 'icon.city_singapore', 'icon.city_bangkok'],
  },
  {
    file: 'badges/badges-01', group: 'badges', kind: 'objects', cols: 4, rows: 4, width: 64, height: 64,
    ids: [
      'badge.first_100k', 'badge.millionaire', 'badge.millionaire_by_35', 'badge.ten_million',
      'badge.debt_free_at_40', 'badge.no_credit_card', 'badge.escaped', 'badge.escaped_before_40',
      'badge.escaped_before_35', 'badge.passive_double', 'badge.first_share', 'badge.five_asset_classes',
      'badge.bought_the_dip', 'badge.crypto_winter', 'badge.three_rentals', 'badge.bond_ladder',
    ],
  },
  {
    file: 'badges/badges-02', group: 'badges', kind: 'objects', cols: 4, rows: 4, width: 64, height: 64,
    ids: [
      'badge.index_only', 'badge.first_luxury_watch', 'badge.supercar', 'badge.penthouse',
      'badge.status_100', 'badge.twenty_items', 'badge.every_car', 'badge.three_cities',
      'badge.moved_to_dubai', 'badge.family_of_four', 'badge.mba', 'badge.sold_business',
      'badge.rode_out_recession', 'badge.bankrupt', 'badge.locked', 'badge.new',
    ],
  },
  { file: 'portraits/portraits-01', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_A) },
  { file: 'portraits/portraits-02', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_B) },
  { file: 'portraits/portraits-03', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_C) },
  { file: 'portraits/portraits-04', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_D) },
  { file: 'portraits/portraits-05', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_E) },
  { file: 'portraits/portraits-06', group: 'portraits', kind: 'portraits', cols: 4, rows: 4, width: 64, height: 64, ids: portraits(LIVES_F) },
  // Three badges of the later cities, and the two transfers abroad.
  { file: 'badges/badges-06', group: 'badges', kind: 'objects', cols: 3, rows: 1, width: 64, height: 64, ids: ['badge.swiss_banker', 'badge.world_tour', 'badge.ronin'] },
  { file: 'cards/cards-26', group: 'cards', kind: 'scenes', cols: 2, rows: 1, width: 288, height: 120, ids: ['card.office_east', 'card.office_west'] },
  // Two cards for each city, dealt only there.
  { file: 'cards/cards-27', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.city_madrid_cana', 'card.city_madrid_tourist_flat', 'card.city_london_tube_strike', 'card.city_london_club', 'card.city_new_york_rent_hike', 'card.city_new_york_elevator_pitch'] },
  { file: 'cards/cards-28', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.city_dubai_visa', 'card.city_dubai_golden_visa', 'card.city_singapore_ballot', 'card.city_singapore_gum', 'card.city_bangkok_flood', 'card.city_bangkok_beach_bar'] },
  { file: 'cards/cards-29', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.city_tokyo_earthquake', 'card.city_tokyo_karaoke', 'card.city_moscow_rouble', 'card.city_moscow_dacha', 'card.city_mexico_city_mordida', 'card.city_mexico_city_taqueria'] },
  { file: 'cards/cards-30', group: 'cards', kind: 'scenes', cols: 2, rows: 1, width: 288, height: 120, ids: ['card.city_zurich_numbered_account', 'card.city_zurich_referendum'] },
  {
    // A sign for each career, and five for careers to come.
    file: 'icons/icons-06', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.career_healthcare', 'icon.career_tech', 'icon.career_public', 'icon.career_service',
      'icon.career_finance', 'icon.career_medicine', 'icon.career_law', 'icon.career_education',
      'icon.career_influencer', 'icon.career_hospitality', 'icon.career_sales', 'icon.career_trades',
      'icon.career_construction', 'icon.career_science', 'icon.career_aviation', 'icon.career_creative',
    ],
  },
  {
    // What a thing is good for, the kinds of debt, and the lines of the balance sheet.
    file: 'icons/icons-07', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.use_move', 'icon.use_study', 'icon.use_pay', 'icon.use_hunt',
      'icon.use_focus', 'icon.debt_mortgage', 'icon.debt_loan', 'icon.debt_card',
      'icon.debt_instalments', 'icon.bal_cash', 'icon.bal_savings', 'icon.bal_pension',
      'icon.bal_investments', 'icon.bal_property', 'icon.bal_things', 'icon.bal_debts',
    ],
  },
  {
    // Each kind of business, each skill and money sense, the second-hand shop, and a life beside others.
    file: 'icons/icons-08', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'icon.biz_services', 'icon.biz_shop', 'icon.biz_app', 'icon.biz_bar',
      'icon.biz_franchise', 'icon.skill_negotiation', 'icon.skill_languages', 'icon.skill_network',
      'icon.skill_management', 'icon.skill_health', 'icon.skill_finance', 'icon.used',
      'icon.repair_car', 'icon.repair', 'icon.repair_watch', 'icon.percentile',
    ],
  },
  {
    // The five rules of the weekly challenge, the challenge and its best tenth, retiring, the gifts to the children, the risk of age, and practice.
    file: 'icons/icons-09', group: 'icons', kind: 'objects', cols: 4, rows: 3, width: 32, height: 32,
    ids: [
      'icon.rule_index_only', 'icon.rule_no_loans', 'icon.rule_no_moving', 'icon.rule_no_property',
      'icon.rule_start_in_debt', 'icon.challenge', 'icon.top_tenth', '',
      'icon.gift', 'icon.handover', 'icon.health_risk', 'icon.practice',
    ],
  },
  // The frame of the portrait, by status: plain, bronze, silver, gold. The middle of each is clear.
  // Frames and loops share the icons' palette, though not their size: a group of their own would need every palette rebuilt.
  { file: 'icons/frames-01', group: 'icons', kind: 'objects', cols: 2, rows: 2, width: 80, height: 80, ids: ['frame.plain', 'frame.bronze', 'frame.silver', 'frame.gold'] },
  {
    // Four loops of four frames: a coin turning, the wheel, confetti, an arrow going up.
    file: 'icons/anim-01', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 48, height: 48,
    ids: ['coin', 'wheel', 'confetti', 'arrow'].flatMap((name) => [0, 1, 2, 3].map((frame) => `anim.${name}.${frame}`)),
  },
  {
    // The wheel again, the rat in a tracksuit and in a tuxedo.
    file: 'icons/anim-02', group: 'icons', kind: 'objects', cols: 4, rows: 2, width: 48, height: 48,
    ids: ['tracksuit', 'tuxedo'].flatMap((outfit) => [0, 1, 2, 3].map((frame) => `anim.wheel_${outfit}.${frame}`)),
  },
  {
    // Four rims for badges by rarity, a crest for each city, and two spare.
    file: 'badges/badges-03', group: 'badges', kind: 'objects', cols: 4, rows: 3, width: 64, height: 64,
    ids: [
      'rim.bronze', 'rim.silver', 'rim.gold', 'rim.gem',
      'crest.madrid', 'crest.london', 'crest.new_york', 'crest.dubai',
      'crest.singapore', 'crest.bangkok', 'crest.compass', 'crest.wheel',
    ],
  },
  {
    // Four badges added since: the top bought, more cars than spaces, a room at forty, an inspection.
    file: 'badges/badges-04', group: 'badges', kind: 'objects', cols: 2, rows: 2, width: 64, height: 64,
    ids: ['badge.bought_the_top', 'badge.more_cars_than_spaces', 'badge.room_at_40', 'badge.audited'],
  },
  ...[
    ['office_desk', 'handshake', 'packed_box', 'airport', 'library', 'graduation'],
    ['online_course', 'shopfront', 'bar', 'garage_startup', 'parcels', 'phone_chart'],
    ['trading_desk', 'meme_coin', 'shady_deal', 'frozen_vault', 'door_keys', 'moving_boxes'],
    ['flooded_room', 'scaffolding', 'sports_car', 'beach_club', 'phone_launch', 'watch_boutique'],
    ['nightclub', 'dinner_for_two', 'wedding', 'nursery', 'torn_photo', 'family_dinner'],
    ['hospital', 'gym', 'burnout', 'lottery', 'breakdown', 'cash_envelope'],
    ['casino', 'crash_screens', 'central_bank', 'empty_street', 'server_room', 'bank_queue'],
    ['receipts', 'inspector', 'sunset_bench', 'newsroom', 'sunrise_balcony', 'city_arrival'],
    // Nine more sheets, so that no two cards share a scene. The prompt pack says which card each is for.
    ['boss_door', 'meeting_room', 'kitchen_laptop', 'tower_lobby', 'angry_boss', 'headhunter_call'],
    ['contract_signing', 'bank_cosign', 'two_ladders', 'share_certificate', 'shares_or_salary', 'business_cabin'],
    ['prenup', 'tax_refund', 'price_tags', 'advisor_office', 'piggy_bank', 'speed_camera'],
    ['tech_bubble', 'crowd_building', 'trading_guru', 'crypto_rocket', 'crypto_winter', 'phishing'],
    ['spare_room', 'rent_letter', 'unpaid_rent', 'for_sale_signs', 'sold_board', 'mortgage_scales'],
    ['small_house', 'offplan_model', 'car_dealer', 'coupe_garage', 'rate_scissors', 'sale_crowd'],
    ['lecture_hall', 'campus_dropoff', 'language_class', 'bootcamp', 'app_launch', 'pitch_napkin'],
    ['will_reading', 'bonus_confetti', 'will_desk', 'dentist_chair', 'pitch_injury', 'school_gate'],
    ['sibling_doorstep', 'beach_wedding', 'private_sale', 'pickpocket', 'courtroom', 'street_market'],
    // The six cards of the crises.
    ['crisis_black_monday', 'crisis_all_hands', 'crisis_thick_bill', 'crisis_picket', 'crisis_spread', 'crisis_cuts'],
    // The pictures of the moments that stop the game.
    ['moment_escape', 'moment_bankrupt', 'moment_million', 'moment_crash', 'moment_energy', 'moment_debt'],
  ].map((names, i): SheetSpec => ({
    file: `cards/cards-${String(i + 1).padStart(2, '0')}`, group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: names.map((name) => `card.${name}`),
  })),
  // Scenes for the newer careers and for what things open.
  { file: 'cards/cards-20', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.out_of_town', 'card.club_contacts', 'card.classroom', 'card.ring_light', 'card.law_office', 'card.bar_tips'] },
  // How a life ends, and who is at home.
  { file: 'cards/cards-21', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['end.escaped', 'end.retired', 'end.ruined', 'family.couple', 'family.children', 'family.full_house'] },
  // The end of a working life, and the weekly challenge.
  {
    file: 'cards/cards-22', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: ['card.restructuring', 'card.keys_to_children', 'card.shop_handover', 'card.care_home', 'card.retired_garden', 'card.weekly_challenge'],
  },
  // Eighteen cards more: work, learning and business; money and home; family, tax and later life.
  {
    file: 'cards/cards-23', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: ['card.four_day_week', 'card.company_course', 'card.rival_shop', 'card.viral_review', 'card.labour_inspector', 'card.bank_product'],
  },
  {
    file: 'cards/cards-24', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: ['card.leveraged_chart', 'card.noisy_neighbours', 'card.building_levy', 'card.lodger_room', 'card.bali_wedding', 'card.shelter_dog'],
  },
  {
    file: 'cards/cards-25', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: ['card.partner_startup', 'card.cash_no_invoice', 'card.tax_amnesty', 'card.motorbike_window', 'card.mentor_session', 'card.scam_message'],
  },
  ...WORKPLACES.map((careers, i): SheetSpec => ({
    file: `cards/work-${String(i + 1).padStart(2, '0')}`, group: 'cards', kind: 'scenes', cols: 3, rows: 2, width: 288, height: 120,
    ids: careers.flatMap((career) => [0, 1, 2].map((stage) => `work.${career}.${stage}`)),
  })),
  { file: 'skylines/skylines-01', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.madrid', 'skyline.london', 'skyline.new_york'] },
  { file: 'skylines/skylines-02', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.dubai', 'skyline.singapore', 'skyline.bangkok'] },
  // The first six cities by day, shown while the news of a round is read.
  { file: 'skylines/skylines-03', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.madrid.day', 'skyline.london.day', 'skyline.new_york.day'] },
  { file: 'skylines/skylines-04', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.dubai.day', 'skyline.singapore.day', 'skyline.bangkok.day'] },
  // The same six again in a boom, with cranes and fireworks, and in a crisis, under rain with half the windows dark.
  ...(['boom', 'boom', 'crisis', 'crisis'] as const).map((mood, i): SheetSpec => ({
    file: `skylines/skylines-0${i + 5}`, group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66,
    ids: (i % 2 === 0 ? ['madrid', 'london', 'new_york'] : ['dubai', 'singapore', 'bangkok']).map((city) => `skyline.${city}.${mood}`),
  })),
  // Four cities added since: their homes, their landmarks, crests and seats, and their skylines in every light.
  {
    file: 'homes/homes-tokyo', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.tokyo.studio', 'home.tokyo.flat', 'home.tokyo.loft', 'home.tokyo.townhouse', 'home.tokyo.house', 'home.tokyo.duplex', 'home.tokyo.chalet', 'home.tokyo.penthouse', 'home.tokyo.estate', 'home.tokyo.villa', 'home.tokyo.mansion', 'home.tokyo.sign'],
  },
  {
    file: 'homes/homes-moscow', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.moscow.studio', 'home.moscow.flat', 'home.moscow.loft', 'home.moscow.townhouse', 'home.moscow.house', 'home.moscow.duplex', 'home.moscow.chalet', 'home.moscow.penthouse', 'home.moscow.estate', 'home.moscow.villa', 'home.moscow.mansion', 'home.moscow.sign'],
  },
  {
    file: 'homes/homes-mexico_city', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.mexico_city.studio', 'home.mexico_city.flat', 'home.mexico_city.loft', 'home.mexico_city.townhouse', 'home.mexico_city.house', 'home.mexico_city.duplex', 'home.mexico_city.chalet', 'home.mexico_city.penthouse', 'home.mexico_city.estate', 'home.mexico_city.villa', 'home.mexico_city.mansion', 'home.mexico_city.sign'],
  },
  {
    file: 'homes/homes-zurich', group: 'homes', kind: 'objects', cols: 4, rows: 3, width: 128, height: 128,
    ids: ['home.zurich.studio', 'home.zurich.flat', 'home.zurich.loft', 'home.zurich.townhouse', 'home.zurich.house', 'home.zurich.duplex', 'home.zurich.chalet', 'home.zurich.penthouse', 'home.zurich.estate', 'home.zurich.villa', 'home.zurich.mansion', 'home.zurich.sign'],
  },
  { file: 'icons/icons-10', group: 'icons', kind: 'objects', cols: 2, rows: 2, width: 32, height: 32, ids: ['icon.city_tokyo', 'icon.city_moscow', 'icon.city_mexico_city', 'icon.city_zurich'] },
  { file: 'badges/badges-05', group: 'badges', kind: 'objects', cols: 2, rows: 2, width: 64, height: 64, ids: ['crest.tokyo', 'crest.moscow', 'crest.mexico_city', 'crest.zurich'] },
  {
    file: 'items/items-07', group: 'items', kind: 'objects', cols: 2, rows: 2, width: 64, height: 64,
    ids: ['item.member_sumo_tokyo', 'item.member_bolshoi_moscow', 'item.member_palco_mexico_city', 'item.member_golf_zurich'],
  },
  ...(['', '.day', '.boom', '.crisis'] as const).map((light, i): SheetSpec => ({
    file: `skylines/skylines-${String(i + 9).padStart(2, '0')}`, group: 'skylines', kind: 'scenes', cols: 1, rows: 4, width: 312, height: 66,
    ids: ['tokyo', 'moscow', 'mexico_city', 'zurich'].map((city) => `skyline.${city}${light}`),
  })),
  // Brand marks: Google's for signing in, Apple's for a sign-in to come, and those of the shares and coins on the market.
  {
    file: 'icons/logos-01', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 32, height: 32,
    ids: [
      'logo.google', 'logo.apple', 'logo.microsoft', 'logo.nvidia', 'logo.amazon', 'logo.tesla', 'logo.inditex', 'logo.lvmh',
      'logo.ferrari', 'logo.santander', 'logo.coca_cola', 'logo.bitcoin', 'logo.ethereum', 'logo.dogecoin', 'logo.toyota', 'logo.nestle',
    ],
  },
  // The wrong side of the law: trials, prison and small cheats, and the badges of a life that went there.
  { file: 'cards/cards-31', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.crime_wrongly_accused', 'card.crime_jail_cellmate', 'card.crime_jail_commissary', 'card.crime_jail_library', 'card.crime_memoirs', 'card.crime_fake_mba'] },
  { file: 'cards/cards-32', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.crime_fake_mba_found', 'card.crime_ham_smuggling', 'card.crime_memecoin', 'card.crime_illegal_betting', 'card.crime_enchufe', 'card.crime_insider_tip'] },
  { file: 'cards/cards-33', group: 'cards', kind: 'scenes', cols: 1, rows: 1, width: 288, height: 120, ids: ['card.crime_laundering'] },
  { file: 'items/items-08', group: 'items', kind: 'objects', cols: 3, rows: 1, width: 64, height: 64, ids: ['item.tech_smartwatch', 'item.tech_drone', 'item.tech_ai_workstation'] },
  { file: 'badges/badges-07', group: 'badges', kind: 'objects', cols: 3, rows: 1, width: 64, height: 64, ids: ['badge.fiscally_creative', 'badge.ex_convict', 'badge.truly_innocent'] },
  // The sheet came with two more scenes, of a book; the cards they were for were left out of the game.
  { file: 'cards/cards-34', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.lodger_good', 'card.lodger_unpaid', 'card.lodger_friend', 'card.lodger_tension', '', ''] },
  { file: 'items/business-01', group: 'items', kind: 'objects', cols: 5, rows: 1, width: 64, height: 64, ids: ['business.services', 'business.shop', 'business.app', 'business.bar', 'business.franchise'] },
  { file: 'icons/rules-02', group: 'icons', kind: 'objects', cols: 5, rows: 1, width: 32, height: 32, ids: ['icon.rule_no_business', 'icon.rule_frugal', 'icon.rule_minimalist', 'icon.rule_honest', 'icon.rule_rich_heir'] },
  { file: 'cards/cards-35', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.red_licence', 'card.red_appointment', 'card.red_works_stopped', 'card.red_inheritance', 'card.red_grant', 'card.refuge_bank_freeze'] },
  { file: 'badges/badges-10', group: 'badges', kind: 'objects', cols: 3, rows: 1, width: 64, height: 64, ids: ['badge.mp_first_win', 'badge.mp_full_house', 'badge.mp_rematch_win'] },
  { file: 'badges/badges-09', group: 'badges', kind: 'objects', cols: 4, rows: 1, width: 64, height: 64, ids: ['badge.tax_free_year', 'badge.tax_haven', 'badge.off_the_grid', 'badge.home_again'] },
  // v17: the famous, as parodies: a portrait each, a card scene each and a badge each.
  { file: 'portraits/celebs-01', group: 'portraits', kind: 'portraits', cols: 4, rows: 2, width: 64, height: 64, ids: ['mosk', 'grump', 'poutine', 'bufe', 'bozos', 'zuckerbot', 'puertas', 'nakamoro'].map((id) => `celeb.${id}`) },
  { file: 'portraits/celebs-02', group: 'portraits', kind: 'portraits', cols: 3, rows: 2, width: 64, height: 64, ids: ['kardashion', 'mrfeast', 'ronalgo', 'swiftly', 'bellfort', 'ortiga'].map((id) => `celeb.${id}`) },
  { file: 'cards/cards-37', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['mosk', 'grump', 'poutine', 'bufe', 'bozos', 'zuckerbot'].map((id) => `card.celeb_${id}`) },
  { file: 'cards/cards-38', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['puertas', 'nakamoro', 'kardashion', 'mrfeast', 'ronalgo', 'swiftly'].map((id) => `card.celeb_${id}`) },
  { file: 'cards/cards-39', group: 'cards', kind: 'scenes', cols: 2, rows: 1, width: 288, height: 120, ids: ['card.celeb_bellfort', 'card.celeb_ortiga'] },
  { file: 'badges/badges-11', group: 'badges', kind: 'objects', cols: 4, rows: 2, width: 64, height: 64, ids: ['mosk', 'grump', 'poutine', 'bufe', 'bozos', 'zuckerbot', 'puertas', 'nakamoro'].map((id) => `badge.celeb_${id}`) },
  { file: 'badges/badges-12', group: 'badges', kind: 'objects', cols: 3, rows: 2, width: 64, height: 64, ids: ['kardashion', 'mrfeast', 'ronalgo', 'swiftly', 'bellfort', 'ortiga'].map((id) => `badge.celeb_${id}`) },
  // v16: playing with friends, the rat ranks, and two icons (the retirement one drawn again with room round it).
  {
    file: 'icons/multiplayer-01', group: 'icons', kind: 'objects', cols: 4, rows: 2, width: 32, height: 32,
    ids: ['icon.multiplayer', 'icon.room_lobby', 'icon.room_ready', 'icon.room_rematch', 'icon.room_shout', 'icon.room_loan', 'icon.room_tease', 'icon.room_podium'],
  },
  { file: 'badges/rat-ranks-01', group: 'badges', kind: 'objects', cols: 3, rows: 2, width: 64, height: 64, ids: ['rank.sewer', 'rank.office', 'rank.stock', 'rank.wall_street', 'rank.tycoon', 'rank.king'] },
  { file: 'icons/icons-11', group: 'icons', kind: 'objects', cols: 2, rows: 1, width: 32, height: 32, ids: ['icon.retired', 'icon.estates'] },
  { file: 'badges/badges-08', group: 'badges', kind: 'objects', cols: 1, rows: 1, width: 64, height: 64, ids: ['badge.own_boss'] },
  // A player's rat in layers, back to front: backdrop, body, face, outfit, eyewear, headwear. The bodies
  // of rat-body-02 have their faces left blank, so that the faces of rat-face-01 can be worn on them.
  ...(
    [
      ['rat-body-02', 'body', false, ['grey', 'brown', 'white', 'black', 'ginger', 'golden', 'slate', 'spotted']],
      ['rat-face-01', 'face', true, ['calm', 'grin', 'smug', 'wink', 'shock', 'sleepy', 'fierce', 'tears']],
      ['rat-outfit-01', 'outfit', true, ['suit', 'tracksuit', 'tuxedo', 'hoodie', 'scrubs', 'hivis', 'chef', 'leather']],
      ['rat-outfit-02', 'outfit', true, ['lab', 'sweater', 'hawaiian', 'varsity', 'robe', 'kimono', 'fur', 'gold']],
      ['rat-hat-01', 'hat', true, ['cap', 'beanie', 'beret', 'hardhat', 'cowboy', 'headphones', 'bandana', 'chef']],
      ['rat-hat-02', 'hat', true, ['tophat', 'crown', 'graduate', 'party', 'viking', 'flowers', 'wizard', 'halo']],
      ['rat-eyes-01', 'eyes', true, ['sunglasses', 'round', 'aviators', 'monocle', 'patch', 'visor', 'moustache', 'heart']],
    ] as const
  ).map(([file, layer, guided, names]): SheetSpec => ({
    file: `brand/${file}`, group: `rat_${layer}`, kind: 'layers', cols: 4, rows: 2, width: 128, height: 128,
    ids: names.map((name) => `rat.${layer}.${name}`), over: 'brand/rat-body-02', guided,
    worn: layer === 'outfit' ? 'body' : layer === 'body' ? 'all' : 'head',
    thinnest: layer === 'outfit' ? 3 : 0,
  })),
  {
    file: 'brand/rat-backdrop-01', group: 'rat_backdrop', kind: 'scenes', cols: 4, rows: 2, width: 128, height: 128,
    ids: ['stars', 'city', 'coins', 'chart', 'cheese', 'confetti', 'wheel', 'beach'].map((name) => `rat.backdrop.${name}`),
  },
  { file: 'brand/brand-01', group: 'brand', kind: 'objects', cols: 2, rows: 2, width: 256, height: 256, ids: ['brand.logo', 'brand.wordmark', 'brand.app_icon', 'brand.mascot'] },
  // v14: the rat in eight poses, and its head in eight hats (the avatars in layers of v15 take their place).
  { file: 'brand/brand-02', group: 'brand', kind: 'objects', cols: 4, rows: 2, width: 128, height: 128, ids: ['rat.cheer', 'rat.hide', 'rat.exit', 'rat.count', 'rat.sleep', 'rat.shock', 'rat.think', 'rat.wave'] },
  { file: 'brand/rats-01', group: 'brand', kind: 'objects', cols: 4, rows: 2, width: 64, height: 64, ids: ['rat.head.plain', 'rat.head.cap', 'rat.head.beanie', 'rat.head.top_hat', 'rat.head.headphones', 'rat.head.crown', 'rat.head.sunglasses', 'rat.head.chef'] },
  // A backdrop behind a portrait, one for each city, to tell lives apart at a glance.
  { file: 'portraits/backdrops-01', group: 'portraits', kind: 'scenes', cols: 5, rows: 2, width: 64, height: 64, ids: ['backdrop.madrid', 'backdrop.london', 'backdrop.new_york', 'backdrop.dubai', 'backdrop.singapore', 'backdrop.bangkok', 'backdrop.tokyo', 'backdrop.moscow', 'backdrop.mexico_city', 'backdrop.zurich'] },
  // The milestones of a life, told on the round they happen in.
  { file: 'cards/cards-36', group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120, ids: ['card.moment_home', 'card.moment_wedding', 'card.moment_child', 'card.moment_business_sold', 'card.moment_retired', 'card.moment_promotion'] },
  // Every business at three sizes: just started, doing well, thriving.
  { file: 'items/business-02', group: 'items', kind: 'objects', cols: 3, rows: 5, width: 64, height: 64, ids: ['business.services.1', 'business.services.2', 'business.services.3', 'business.shop.1', 'business.shop.2', 'business.shop.3', 'business.app.1', 'business.app.2', 'business.app.3', 'business.bar.1', 'business.bar.2', 'business.bar.3', 'business.franchise.1', 'business.franchise.2', 'business.franchise.3'] },
  // The world at night, the cities of the game marked; the route of a life is drawn over it.
  { file: 'cards/map-01', group: 'cards', kind: 'scenes', cols: 1, rows: 1, width: 576, height: 240, ids: ['map.world'] },
];
