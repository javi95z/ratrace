import type { DebtParams, LifeRules, PropertyTypeDef, ScoringParams, WorldRules } from '@ratrace/engine';
import { usd } from './money';

/**
 * Property scales from the reference flat of each city, the cheapest first. Status is for living
 * in one. A parking space and a shop cannot be lived in: they are bought to let, and let for a
 * little more than a home of the same price, which is all that makes up for being of no other use.
 */
export const propertyTypes: PropertyTypeDef[] = [
  { id: 'parking', pricePct: 12, status: 0, rentalOnly: true, rentPct: 110 },
  { id: 'studio', pricePct: 60, status: 8 },
  { id: 'flat', pricePct: 100, status: 14 },
  { id: 'shop', pricePct: 130, status: 0, rentalOnly: true, rentPct: 125 },
  { id: 'house', pricePct: 180, status: 24 },
  { id: 'penthouse', pricePct: 400, status: 42 },
  { id: 'villa', pricePct: 800, status: 60 },
];

export const debt: DebtParams = {
  personalLoanSpreadBp: 500,
  mortgageSpreadBp: 150,
  creditCardRateBp: 2_200,
  mortgageTermRounds: 12,
  personalLoanTermRounds: 3,
  mortgageMaxLtvBp: 8_000,
  personalLoanMaxIncomePct: 100,
  bankruptcyIncomeMultiple: 3,
  bankruptcyLockRounds: 3,
  fireSaleDiscountBp: 3_000,
  bankruptcyStatusPenalty: 25,
};

export const scoring: ScoringParams = {
  wealthBreakpoints: [
    [0, 0],
    [usd(10_000), 100],
    [usd(100_000), 200],
    [usd(1_000_000), 300],
    [usd(10_000_000), 400],
    [usd(100_000_000), 500],
  ],
  escapeBase: 125,
  escapePerRoundLeft: 3,
};

export const life: LifeRules = {
  childCostPct: 22,
  childRounds: 10,
  partnerCostPct: 45,
  // Priced so that a careful player can justify each one: about what the bills it covers cost over a life.
  insurancePremiumBp: { health: 150, home: 60, life: 60, liability: 40 },
  // A rented room costs a little over half the housing share of a rented flat.
  rentTierHousingPct: [55, 100],
  rentTierStatus: [0, 3],
  lifestyleStatus: [0, 0, 3, 8],
  lesserItemPct: 25,
  moveCostPct: 25,
  workSkill: 1,
  studySkill: 1,
  jobHuntChancePct: 20,
  jobHuntRaisePct: 3,
  financeExperienceRounds: 3,
  rentOutMinFinanceSkill: 2,
  unstablePayPct: 30,
  cheapMortgageBp: 60,
  cardsPerRound: 3,
};

export const world: WorldRules = {
  headlinesPerRound: 3,
  newsTruthPct: 70,
  flatBandBp: 25,
  taxReformChancePct: 8,
  taxReformsPerGame: 2,
  taxReformStepsBp: [-300, -200, 200, 300],
  quietWeight: 30,
};
