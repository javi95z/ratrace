import type { Content } from '@ratrace/engine';
import { assets, market } from './assets';
import { cards } from './cards';
import { business } from './business';
import { careers } from './careers';
import { cities } from './cities';
import { crises } from './crises';
import { items } from './items';
import { debt, evasion, life, propertyTypes, scoring, world } from './rules';

/** Bumped whenever a number or a card changes, so a saved game knows which rules it was played under. */
export const CONTENT_VERSION = '1.54.0';

/** Everything the engine needs to run a v1 game: 20 rounds of two years, from age 22 to 62. */
export const content: Content = {
  rounds: 20,
  yearsPerRound: 2,
  lifestyleMultiplierPct: [70, 100, 140, 200],
  // Luxury is priced by the life it keeps up with: at least 30% of a year's income before tax, so a fortune pays for its standing.
  luxuryIncomePct: 30,
  housingSharePct: 35,
  pensionAssetId: 'msci_world',
  pensionContributionCapBp: 2_000,
  pensionEarlyPenaltyBp: 2_000,
  maxOrdersPerRound: 50,
  assets,
  market,
  cities,
  propertyTypes,
  debt,
  scoring,
  careers,
  business,
  items,
  life,
  evasion,
  world,
  crises,
  cards,
};
