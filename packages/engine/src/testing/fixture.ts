import { newPlayer } from '../player';
import type { Content, PlayerState, StartConfig, TaxProfile } from '../types';
import { generateTimeline } from '../world';

const USD = 100;

const homeTax: TaxProfile = {
  incomeRatesBp: [1_900, 3_000, 4_500],
  capitalGainsBp: 2_100,
  dividendBp: 2_100,
  rentAsIncome: false,
  rentBp: 2_100,
  propertyPurchaseBp: 800,
  propertyAnnualBp: 30,
  pensionDeductionCapBp: 1_000,
  investmentAllowance: 0,
};

const havenTax: TaxProfile = {
  incomeRatesBp: [0, 0, 0],
  capitalGainsBp: 0,
  dividendBp: 0,
  rentAsIncome: false,
  rentBp: 0,
  propertyPurchaseBp: 400,
  propertyAnnualBp: 0,
  pensionDeductionCapBp: 0,
  investmentAllowance: 0,
};

const base: Content = {
  rounds: 20,
  yearsPerRound: 2,
  lifestyleMultiplierPct: [70, 100, 140, 200],
  housingSharePct: 35,
  pensionAssetId: 'fund_world',
  pensionContributionCapBp: 2_000,
  maxOrdersPerRound: 50,
  assets: [
    { id: 'bond_long', class: 'bond', betaPct: 100, idioVolBp: 0, yieldBp: 0, durationYears: 8, yieldSpreadBp: 50 },
    { id: 'fund_world', class: 'equity', betaPct: 100, idioVolBp: 300, yieldBp: 180 },
    { id: 'stock_growth', class: 'equity', betaPct: 140, idioVolBp: 1_800, yieldBp: 0 },
    { id: 'stock_dividend', class: 'equity', betaPct: 70, idioVolBp: 900, yieldBp: 320, driftBp: -500 },
    { id: 'coin_major', class: 'crypto', betaPct: 100, idioVolBp: 1_500, yieldBp: 0 },
    { id: 'coin_meme', class: 'crypto', betaPct: 160, idioVolBp: 3_500, yieldBp: 0, crashChancePct: 8 },
    { id: 'gold', class: 'gold', betaPct: 100, idioVolBp: 600, yieldBp: 0 },
  ],
  market: {
    regimeTransitions: {
      expansion: [['expansion', 45], ['boom', 25], ['slowdown', 25], ['recession', 5]],
      boom: [['boom', 25], ['slowdown', 45], ['recession', 25], ['expansion', 5]],
      slowdown: [['recession', 40], ['expansion', 35], ['slowdown', 25]],
      recession: [['recovery', 65], ['recession', 35]],
      recovery: [['expansion', 65], ['boom', 15], ['recovery', 20]],
    },
    cryptoTransitions: {
      accumulation: [['accumulation', 40], ['bull', 55], ['winter', 5]],
      bull: [['mania', 45], ['bull', 30], ['winter', 25]],
      mania: [['winter', 75], ['mania', 15], ['bull', 10]],
      winter: [['accumulation', 60], ['winter', 40]],
    },
    equityMeanBp: { expansion: 1_400, boom: 2_400, slowdown: 300, recession: -2_200, recovery: 1_800 },
    cryptoMeanBp: { accumulation: 1_500, bull: 8_000, mania: 15_000, winter: -4_000 },
    goldMeanBp: { expansion: 300, boom: 0, slowdown: 600, recession: 1_400, recovery: 200 },
    classVolBp: { equity: 1_400, crypto: 2_500, gold: 900 },
    rateDriftBp: { expansion: 50, boom: 100, slowdown: -25, recession: -150, recovery: -25 },
    rateNoiseBp: 40,
    inflationTargetBp: { expansion: 220, boom: 380, slowdown: 250, recession: 80, recovery: 180 },
    inflationNoiseBp: 80,
    depositSpreadBp: 100,
    recessionWinterChancePct: 40,
    start: { regime: 'expansion', cryptoPhase: 'accumulation', policyRateBp: 250, inflationBp: 220 },
  },
  cities: [
    {
      id: 'home',
      medianSalaryAnnual: 30_000 * USD,
      livingCostAnnual: 18_000 * USD,
      flatPrice: 250_000 * USD,
      rentYieldBp: 450,
      propertyGrowthBp: 600,
      propertyMomentumPct: 30,
      propertyRateSensitivity: 4,
      propertyVolBp: 700,
      tax: homeTax,
      prestige: 0,
    },
    {
      id: 'haven',
      medianSalaryAnnual: 60_000 * USD,
      livingCostAnnual: 40_000 * USD,
      flatPrice: 400_000 * USD,
      rentYieldBp: 600,
      propertyGrowthBp: 500,
      propertyMomentumPct: 30,
      propertyRateSensitivity: 3,
      propertyVolBp: 900,
      tax: havenTax,
      prestige: 5,
    },
  ],
  propertyTypes: [
    { id: 'studio', pricePct: 60, status: 3 },
    { id: 'flat', pricePct: 100, status: 6 },
    { id: 'house', pricePct: 180, status: 10 },
    { id: 'penthouse', pricePct: 400, status: 25 },
    { id: 'villa', pricePct: 800, status: 40 },
  ],
  debt: {
    marginSpreadBp: 300,
    marginMaxPct: 50,
    marginCallPct: 75,
    marginMinFinanceSkill: 3,
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
    bankruptcyStatusPenalty: 0,
  },
  scoring: {
    wealthBreakpoints: [
      [0, 0],
      [10_000 * USD, 100],
      [100_000 * USD, 200],
      [1_000_000 * USD, 300],
      [10_000_000 * USD, 400],
      [100_000_000 * USD, 500],
    ],
    escapeBase: 125,
    escapePerRoundLeft: 3,
  },
  careers: [
    {
      id: 'office',
      overtimePct: 15,
      levels: [
        { salaryPct: 80, minSkill: 0, status: 0 },
        { salaryPct: 110, minSkill: 4, status: 3 },
        { salaryPct: 150, minSkill: 10, status: 6 },
      ],
    },
  ],
  business: {
    types: [
      { id: 'stall', minCapital: 1_000 * USD, yieldBp: 1_000, scale: 100_000 * USD, cyclePct: { boom: 50, recession: -150 }, managerPct: 40, minFinanceSkill: 0 },
      { id: 'firm', minCapital: 20_000 * USD, yieldBp: 600, scale: 500_000 * USD, cyclePct: {}, managerPct: 20, minFinanceSkill: 2 },
    ],
    maxBusinesses: 2,
    payouts: [0, 50, 100],
    neglectProfitPct: 50,
    neglectDecayBp: 500,
    salePct: { expansion: 95, boom: 100, slowdown: 85, recession: 70, recovery: 90 },
  },
  items: [
    { id: 'car_basic', ladder: 'car', kind: 'durable', price: 12_000 * USD, upkeepAnnual: 1_200 * USD, status: 4, resaleStartPct: 80, resaleDriftBp: -2_000, boostRounds: 0 },
    { id: 'car_sports', ladder: 'car', kind: 'durable', price: 150_000 * USD, upkeepAnnual: 6_000 * USD, status: 40, resaleStartPct: 85, resaleDriftBp: -1_500, boostRounds: 0 },
    { id: 'watch_gold', ladder: 'watch', kind: 'durable', price: 10_000 * USD, upkeepAnnual: 0, status: 12, resaleStartPct: 90, resaleDriftBp: 300, boostRounds: 0 },
    { id: 'club', ladder: 'membership', kind: 'membership', price: 500 * USD, upkeepAnnual: 2_400 * USD, status: 5, resaleStartPct: 0, resaleDriftBp: 0, boostRounds: 0 },
    { id: 'trip', ladder: 'travel', kind: 'experience', price: 3_000 * USD, upkeepAnnual: 0, status: 10, resaleStartPct: 0, resaleDriftBp: 0, boostRounds: 2 },
  ],
  life: {
    childCostPct: 25,
    childRounds: 9,
    partnerCostPct: 50,
    insurancePremiumBp: { health: 400, home: 300, life: 200, liability: 100 },
    rentTierHousingPct: [60, 100],
    rentTierStatus: [0, 2],
    // Past the last round, so that tests of anything else never meet it.
    roomLateRound: 99,
    roomLateStatus: 0,
    lifestyleStatus: [0, 0, 0, 9],
    itemFinanceDownPct: 20,
    itemFinanceMinPrice: 500_000,
    lesserItemPct: 25,
    // Nothing ages by default. Tests of ageing name their own ladders.
    agingLadders: [],
    agingFloorPct: 25,
    moveCostPct: 20,
    // Nothing by default, so tests of anything else move as before. Tests of a move's cost set their own.
    movePartnerPct: 0,
    moveChildPct: 0,
    moveRungsLost: 0,
    partnerSettlingRounds: 0,
    workSkill: 1,
    studySkill: 1,
    jobHuntChancePct: 35,
    jobHuntRaisePct: 8,
    financeExperienceRounds: 3,
    financeMasterRounds: 6,
    rentOutMinFinanceSkill: 0,
    unstablePayPct: 30,
    cheapMortgageBp: 50,
    cardsPerRound: 3,
  },
  // No reforms and no cards by default, so tests of money are not disturbed. Tests of either add their own.
  world: {
    headlinesPerRound: 3,
    newsTruthPct: 70,
    flatBandBp: 25,
    taxReformChancePct: 0,
    taxReformsPerGame: 2,
    taxReformStepsBp: [-300, -200, 200, 300],
    quietWeight: 10,
    crisisChancePct: 0,
    crisisEarliestRound: 3,
  },
  crises: [],
  cards: [],
};

/** A fresh copy each call, so a test may alter it freely. */
export function fixtureContent(): Content {
  return structuredClone(base);
}

export function fixtureStart(): StartConfig {
  return { cityId: 'home', cash: 0, salaryAnnual: 30_000 * USD, lifestyleTier: 1, debts: [] };
}

/** A player on day one of the fixture world, for tests of single systems. */
export function fixturePlayer(over: Partial<StartConfig> = {}, content: Content = base): PlayerState {
  return newPlayer(content, { ...fixtureStart(), ...over }, generateTimeline('fixture', content)[0]);
}
