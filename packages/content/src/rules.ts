import type { DebtParams, LifeRules, PropertyTypeDef, ScoringParams, WorldRules } from '@ratrace/engine';
import { usd } from './money';

/**
 * Property scales from the reference flat of each city, the cheapest first. Status is for living
 * in one, and among homes a dearer one is always the grander one.
 *
 * Five kinds cannot be lived in: they are bought to let. The dearer ones let for a little more than
 * a home of the same price, which is all that makes up for being of no other use; at 10 to 25
 * percent over a city's rent a let pays its mortgage with a little to spare, and much more would
 * mean nobody ever let a flat. A parking space lets for a little less than a home: its small price
 * already puts a player on borrowed property rounds before a studio could, and with a rent
 * premium on top it was the best buy in the game.
 */
export const propertyTypes: PropertyTypeDef[] = [
  { id: 'parking', pricePct: 12, status: 0, rentalOnly: true, rentPct: 90 },
  { id: 'studio', pricePct: 60, status: 8 },
  { id: 'flat', pricePct: 100, status: 14 },
  { id: 'loft', pricePct: 125, status: 18 },
  { id: 'shop', pricePct: 130, status: 0, rentalOnly: true, rentPct: 125 },
  { id: 'townhouse', pricePct: 150, status: 21 },
  { id: 'house', pricePct: 180, status: 24 },
  { id: 'office', pricePct: 220, status: 0, rentalOnly: true, rentPct: 115 },
  { id: 'duplex', pricePct: 250, status: 31 },
  { id: 'warehouse', pricePct: 300, status: 0, rentalOnly: true, rentPct: 120 },
  { id: 'chalet', pricePct: 320, status: 37 },
  { id: 'penthouse', pricePct: 400, status: 42 },
  { id: 'estate', pricePct: 550, status: 50 },
  { id: 'villa', pricePct: 800, status: 60 },
  { id: 'block', pricePct: 900, status: 0, rentalOnly: true, rentPct: 110 },
  { id: 'mansion', pricePct: 1500, status: 80 },
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
  // A room in a shared flat is how everyone starts. From twenty-six, two rounds in, it is noticed.
  roomLateRound: 2,
  roomLateStatus: -3,
  // Living on less than most people is seen, and it costs standing: saving is not free.
  lifestyleStatus: [-3, 0, 3, 8],
  // A fifth down and the rest on a personal loan, for anything a dealer would write a contract for.
  itemFinanceDownPct: 20,
  itemFinanceMinPrice: usd(5_000),
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
  // About one life in three lives through a crisis, and never before 30: by then there is something to lose.
  crisisChancePct: 30,
  crisisEarliestRound: 4,
};
