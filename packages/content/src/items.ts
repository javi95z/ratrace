import type { ItemDef } from '@ratrace/engine';
import { usd } from './money';

type Row = [id: string, price: number, upkeepAnnual: number, status: number, resaleStartPct: number, resaleDriftBp: number];

const durables = (ladder: string, rows: Row[]): ItemDef[] =>
  rows.map(([id, price, upkeepAnnual, status, resaleStartPct, resaleDriftBp]) => ({
    id, ladder, kind: 'durable', price: usd(price), upkeepAnnual: usd(upkeepAnnual), status, resaleStartPct, resaleDriftBp, boostRounds: 0,
  }));

const experience = (id: string, ladder: string, price: number, status: number, boostRounds: number): ItemDef => ({
  id, ladder, kind: 'experience', price: usd(price), upkeepAnnual: 0, status, resaleStartPct: 0, resaleDriftBp: 0, boostRounds,
});

const membership = (id: string, joining: number, upkeepAnnual: number, status: number): ItemDef => ({
  id, ladder: 'membership', kind: 'membership', price: usd(joining), upkeepAnnual: usd(upkeepAnnual), status, resaleStartPct: 0, resaleDriftBp: 0, boostRounds: 0,
});

/**
 * Thirty-four status items in nine ladders. With the seven homes they are the 41 of spec Appendix B.
 *
 * Columns for durables: price, yearly upkeep, status, resale value on day one as a percent of the
 * price, and the change in resale value each round, in bp, on top of inflation.
 * Cars, tech and most fashion lose value. The top watches, the Birkin and art hold or gain it.
 */
export const items: ItemDef[] = [
  ...durables('car', [
    ['car_seat_ibiza', 18_000, 1_500, 4, 80, -2_200],
    ['car_toyota_corolla', 26_000, 1_600, 6, 82, -2_000],
    ['car_vw_golf_gti', 42_000, 2_200, 10, 80, -2_200],
    ['car_tesla_model_3', 48_000, 1_800, 14, 78, -2_400],
    ['car_bmw_m3', 95_000, 4_000, 24, 78, -2_200],
    ['car_porsche_911', 150_000, 6_000, 38, 85, -1_200],
    ['car_lamborghini_aventador', 480_000, 15_000, 60, 85, -800],
  ]),
  ...durables('watch', [
    ['watch_casio', 20, 0, 1, 50, -1_000],
    ['watch_tissot', 750, 0, 3, 60, -800],
    ['watch_omega', 7_000, 100, 10, 75, -300],
    ['watch_rolex', 11_000, 150, 18, 95, 200],
    ['watch_ap', 38_000, 300, 32, 100, 300],
    ['watch_patek', 90_000, 400, 45, 105, 400],
  ]),
  ...durables('tech', [
    ['tech_phone', 1_200, 0, 2, 60, -5_000],
    ['tech_laptop', 2_600, 0, 3, 65, -4_500],
    ['tech_console', 550, 0, 1, 60, -4_000],
  ]),
  ...durables('fashion', [
    ['fashion_blazer', 150, 0, 1, 20, -6_000],
    ['fashion_polo', 600, 0, 3, 25, -5_000],
    ['fashion_loafers', 950, 0, 6, 40, -3_000],
    ['fashion_duffel', 2_800, 0, 11, 60, -1_500],
    ['fashion_birkin', 14_000, 0, 25, 110, 300],
  ]),
  ...durables('art', [
    ['art_stencil', 28_000, 0, 14, 90, 500],
    ['art_cubist', 60_000, 0, 25, 92, 400],
  ]),

  experience('travel_weekend', 'travel', 300, 2, 1),
  experience('travel_ibiza', 'travel', 2_500, 5, 1),
  experience('travel_business_class', 'travel', 6_000, 9, 2),
  experience('travel_maldives', 'travel', 14_000, 15, 2),
  experience('sea_yacht_charter', 'charter', 45_000, 25, 2),
  experience('air_jet_charter', 'charter', 80_000, 30, 2),

  membership('member_gym', 50, 360, 1),
  membership('member_platinum_card', 0, 800, 5),
  membership('member_season_seat', 1_000, 1_800, 6),
  membership('member_club', 500, 3_000, 8),

  // An MBA takes two focus points and builds skill, so it is earned through its card, not bought in the shop.
  {
    id: 'edu_mba', ladder: 'education', kind: 'durable', price: usd(95_000), upkeepAnnual: 0, status: 15,
    resaleStartPct: 0, resaleDriftBp: 0, boostRounds: 0, cardOnly: true,
  },
];
