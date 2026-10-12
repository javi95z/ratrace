import type { Content, StartConfig, TaxProfile } from '../types';

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
    { id: 'stock_dividend', class: 'equity', betaPct: 70, idioVolBp: 900, yieldBp: 320 },
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
    },
  ],
  propertyTypes: [
    { id: 'studio', pricePct: 60 },
    { id: 'flat', pricePct: 100 },
    { id: 'house', pricePct: 180 },
    { id: 'penthouse', pricePct: 400 },
    { id: 'villa', pricePct: 800 },
  ],
  debt: {
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
};

/** A fresh copy each call, so a test may alter it freely. */
export function fixtureContent(): Content {
  return structuredClone(base);
}

export function fixtureStart(): StartConfig {
  return { cityId: 'home', cash: 0, salaryAnnual: 30_000 * USD, lifestyleTier: 1, debts: [] };
}
