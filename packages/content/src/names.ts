/**
 * The name pack: every real brand, company, coin and place the game mentions, per language.
 * Card text refers to these with placeholders such as {item:watch_rolex}, {asset:tesla},
 * {city:london} and {brand:google}, so the whole pack can be swapped for a parody pack
 * without touching a sentence (spec 8.6).
 */

export type Locale = 'en' | 'es';

export interface Names {
  cities: Record<string, string>;
  assets: Record<string, { name: string; ticker: string }>;
  items: Record<string, string>;
  brands: Record<string, string>;
}

const assets: Names['assets'] = {
  treasury_short: { name: 'US Treasury 2Y', ticker: 'UST2' },
  treasury_long: { name: 'US Treasury 10Y', ticker: 'UST10' },
  bund: { name: 'German Bund', ticker: 'BUND' },
  sp500: { name: 'S&P 500', ticker: 'SPX' },
  msci_world: { name: 'MSCI World', ticker: 'MSCI' },
  apple: { name: 'Apple', ticker: 'AAPL' },
  microsoft: { name: 'Microsoft', ticker: 'MSFT' },
  nvidia: { name: 'Nvidia', ticker: 'NVDA' },
  amazon: { name: 'Amazon', ticker: 'AMZN' },
  tesla: { name: 'Tesla', ticker: 'TSLA' },
  inditex: { name: 'Inditex', ticker: 'ITX' },
  lvmh: { name: 'LVMH', ticker: 'MC' },
  ferrari: { name: 'Ferrari', ticker: 'RACE' },
  santander: { name: 'Santander', ticker: 'SAN' },
  coca_cola: { name: 'Coca-Cola', ticker: 'KO' },
  bitcoin: { name: 'Bitcoin', ticker: 'BTC' },
  ethereum: { name: 'Ethereum', ticker: 'ETH' },
  dogecoin: { name: 'Dogecoin', ticker: 'DOGE' },
  gold: { name: 'Gold', ticker: 'XAU' },
};

const items: Names['items'] = {
  car_seat_ibiza: 'SEAT Ibiza',
  car_toyota_corolla: 'Toyota Corolla',
  car_vw_golf_gti: 'VW Golf GTI',
  car_tesla_model_3: 'Tesla Model 3',
  car_bmw_m3: 'BMW M3',
  car_porsche_911: 'Porsche 911',
  car_lamborghini_aventador: 'Lamborghini Aventador',
  watch_casio: 'Casio F-91W',
  watch_tissot: 'Tissot PRX',
  watch_omega: 'Omega Speedmaster',
  watch_rolex: 'Rolex Submariner',
  watch_ap: 'Audemars Piguet Royal Oak',
  watch_patek: 'Patek Philippe Nautilus',
  tech_phone: 'iPhone',
  tech_laptop: 'MacBook Pro',
  tech_console: 'PS5',
  fashion_blazer: 'Zara blazer',
  fashion_polo: 'Ralph Lauren polo',
  fashion_loafers: 'Gucci loafers',
  fashion_duffel: 'Louis Vuitton Keepall',
  fashion_birkin: 'Hermès Birkin',
  art_stencil: 'Banksy print',
  art_cubist: 'Picasso lithograph',
  travel_weekend: 'Ryanair weekend',
  travel_ibiza: 'Ibiza summer',
  travel_business_class: 'Emirates business class',
  travel_maldives: 'Maldives resort',
  sea_yacht_charter: 'Yacht charter week',
  air_jet_charter: 'NetJets charter',
  member_gym: 'Basic-Fit',
  member_platinum_card: 'Amex Platinum',
  member_season_seat: 'Bernabéu season seat',
  member_club: 'Soho House',
  edu_mba: 'MBA at IESE',
};

const brands: Names['brands'] = {
  google: 'Google',
  inditex: 'Inditex',
  goldman_sachs: 'Goldman Sachs',
  airbnb: 'Airbnb',
  el_gordo: 'El Gordo',
  iese: 'IESE',
};

export const names: Record<Locale, Names> = {
  en: {
    cities: { madrid: 'Madrid', london: 'London', new_york: 'New York', dubai: 'Dubai', singapore: 'Singapore', bangkok: 'Bangkok' },
    assets,
    items,
    brands,
  },
  es: {
    cities: { madrid: 'Madrid', london: 'Londres', new_york: 'Nueva York', dubai: 'Dubái', singapore: 'Singapur', bangkok: 'Bangkok' },
    assets: {
      ...assets,
      treasury_short: { name: 'Bono EE. UU. 2 años', ticker: 'UST2' },
      treasury_long: { name: 'Bono EE. UU. 10 años', ticker: 'UST10' },
      bund: { name: 'Bund alemán', ticker: 'BUND' },
      gold: { name: 'Oro', ticker: 'XAU' },
    },
    items: {
      ...items,
      fashion_blazer: 'Blazer de Zara',
      fashion_polo: 'Polo Ralph Lauren',
      fashion_loafers: 'Mocasines de Gucci',
      art_stencil: 'Serigrafía de Banksy',
      art_cubist: 'Litografía de Picasso',
      travel_weekend: 'Escapada con Ryanair',
      travel_ibiza: 'Verano en Ibiza',
      travel_business_class: 'Business de Emirates',
      travel_maldives: 'Resort en Maldivas',
      sea_yacht_charter: 'Semana en yate',
      air_jet_charter: 'Vuelo con NetJets',
      member_season_seat: 'Abono del Bernabéu',
      edu_mba: 'MBA en el IESE',
    },
    brands,
  },
};
