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
   */
  kind: 'objects' | 'portraits' | 'scenes';
  cols: number;
  rows: number;
  /** Sprite size in pixels. */
  width: number;
  height: number;
  /** Cell names, left to right and top to bottom. An empty name skips the cell. */
  ids: string[];
}

const LIVES_A = ['nurse', 'engineer', 'civil_servant', 'rider'];
const LIVES_B = ['heir', 'newcomer', 'banker', 'doctor'];
const LIVES_C = ['comeback', 'founder', 'crypto_kid', 'nomad'];
const LIVES_D = ['lawyer', 'teacher', 'influencer', 'waiter'];
// The salesperson, and three lives for careers the game does not have yet.
const LIVES_E = ['salesperson', 'electrician', 'pilot', 'scientist'];
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
    file: 'cars/cars-01', group: 'cars', kind: 'objects', cols: 2, rows: 4, width: 96, height: 48,
    ids: [
      'car.seat_ibiza', 'car.toyota_corolla', 'car.vw_golf_gti', 'car.tesla_model_3',
      'car.bmw_m3', 'car.porsche_911', 'car.lamborghini_aventador', 'car.mercedes_g_class',
    ],
  },
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
    // A picture for every choice of the lifestyle tab. Until it lands, `STAND_INS` in the content lends each one an older icon.
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
  // The frame of the portrait, by status: plain, bronze, silver, gold. The middle of each is clear.
  // Frames and loops share the icons' palette, though not their size: a group of their own would need every palette rebuilt.
  { file: 'icons/frames-01', group: 'icons', kind: 'objects', cols: 2, rows: 2, width: 80, height: 80, ids: ['frame.plain', 'frame.bronze', 'frame.silver', 'frame.gold'] },
  {
    // Four loops of four frames: a coin turning, the wheel, confetti, an arrow going up.
    file: 'icons/anim-01', group: 'icons', kind: 'objects', cols: 4, rows: 4, width: 48, height: 48,
    ids: ['coin', 'wheel', 'confetti', 'arrow'].flatMap((name) => [0, 1, 2, 3].map((frame) => `anim.${name}.${frame}`)),
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
  ...WORKPLACES.map((careers, i): SheetSpec => ({
    file: `cards/work-${String(i + 1).padStart(2, '0')}`, group: 'cards', kind: 'scenes', cols: 3, rows: 2, width: 288, height: 120,
    ids: careers.flatMap((career) => [0, 1, 2].map((stage) => `work.${career}.${stage}`)),
  })),
  { file: 'skylines/skylines-01', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.madrid', 'skyline.london', 'skyline.new_york'] },
  { file: 'skylines/skylines-02', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.dubai', 'skyline.singapore', 'skyline.bangkok'] },
  // The same six cities by day, shown while the news of a round is read.
  { file: 'skylines/skylines-03', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.madrid.day', 'skyline.london.day', 'skyline.new_york.day'] },
  { file: 'skylines/skylines-04', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.dubai.day', 'skyline.singapore.day', 'skyline.bangkok.day'] },
  // The same six again in a boom, with cranes and fireworks, and in a crisis, under rain with half the windows dark.
  ...(['boom', 'boom', 'crisis', 'crisis'] as const).map((mood, i): SheetSpec => ({
    file: `skylines/skylines-0${i + 5}`, group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66,
    ids: (i % 2 === 0 ? ['madrid', 'london', 'new_york'] : ['dubai', 'singapore', 'bangkok']).map((city) => `skyline.${city}.${mood}`),
  })),
  { file: 'brand/brand-01', group: 'brand', kind: 'objects', cols: 2, rows: 2, width: 256, height: 256, ids: ['brand.logo', 'brand.wordmark', 'brand.app_icon', 'brand.mascot'] },
];
