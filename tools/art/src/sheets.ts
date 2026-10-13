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
const AGES = [22, 32, 45, 58];
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
  ...[
    ['office_desk', 'handshake', 'packed_box', 'airport', 'library', 'graduation'],
    ['online_course', 'shopfront', 'bar', 'garage_startup', 'parcels', 'phone_chart'],
    ['trading_desk', 'meme_coin', 'shady_deal', 'frozen_vault', 'door_keys', 'moving_boxes'],
    ['flooded_room', 'scaffolding', 'sports_car', 'beach_club', 'phone_launch', 'watch_boutique'],
    ['nightclub', 'dinner_for_two', 'wedding', 'nursery', 'torn_photo', 'family_dinner'],
    ['hospital', 'gym', 'burnout', 'lottery', 'breakdown', 'cash_envelope'],
    ['casino', 'crash_screens', 'central_bank', 'empty_street', 'server_room', 'bank_queue'],
    ['receipts', 'inspector', 'sunset_bench', 'newsroom', 'sunrise_balcony', 'city_arrival'],
  ].map((names, i): SheetSpec => ({
    file: `cards/cards-0${i + 1}`, group: 'cards', kind: 'scenes', cols: 2, rows: 3, width: 288, height: 120,
    ids: names.map((name) => `card.${name}`),
  })),
  { file: 'skylines/skylines-01', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.madrid', 'skyline.london', 'skyline.new_york'] },
  { file: 'skylines/skylines-02', group: 'skylines', kind: 'scenes', cols: 1, rows: 3, width: 312, height: 66, ids: ['skyline.dubai', 'skyline.singapore', 'skyline.bangkok'] },
  { file: 'brand/brand-01', group: 'brand', kind: 'objects', cols: 2, rows: 2, width: 256, height: 256, ids: ['brand.logo', 'brand.wordmark', 'brand.app_icon', 'brand.mascot'] },
];
