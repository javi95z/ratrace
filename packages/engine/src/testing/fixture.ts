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
  // Nothing hidden draws suspicion, and nobody inspects: tests of evasion set their own rules.
  evasion: {
    blackPcts: [0, 25, 50],
    blackSuspicionPer100: 0,
    shellMinFinanceSkill: 3,
    shellFeeAnnual: 0,
    shellTaxCutPct: 80,
    shellSuspicion: 0,
    cryptoSuspicion: 0,
    cryptoReportRound: 99,
    noInvoiceLadders: [],
    noInvoiceDiscountPct: 15,
    noInvoiceSaleSuspicion: 0,
    suspicionDecay: 5,
    auditMaxPct: 0,
    chargedFromEvaded: 100_000 * USD,
    auditFinePct: 50,
    auditGoodsPct: 30,
    auditStatus: -8,
    limitationRounds: 2,
  },
  life: {
    childCostPct: 25,
    childRounds: 9,
    partnerCostPct: 50,
    insurancePremiumBp: { health: 400, home: 300, life: 200, liability: 100 },
    rentTierHousingPct: [60, 100],
    rentTierStatus: [0, 2],
    lifestyleStatus: [0, 0, 0, 9],
    // Nothing changes with age, so that tests of anything else never meet it. Tests of ageing set their own steps.
    agedStatus: { room: [{ fromRound: 0, status: 0 }], frugal: [{ fromRound: 0, status: 0 }] },
    // Age changes nothing here, retiring is open from the start and gives nothing, and a gift is untaxed.
    riskByAge: { health: [{ fromRound: 0, pct: 100 }], job: [{ fromRound: 0, pct: 100 }], scam: [{ fromRound: 0, pct: 100 }] },
    healthPremiumByAge: [{ fromRound: 0, pct: 100 }],
    retireFromRound: 0,
    retiredFocus: 0,
    retiredStatus: 0,
    giftTaxPct: 0,
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
    workModes: { remote: { focus: 1, payPct: 100, jobStatusPct: 50, workSkill: true, fromLevel: 1, huntOffPct: 10 }, partTime: { focus: 2, payPct: 60, jobStatusPct: 50, workSkill: false, fromLevel: 0, huntOffPct: 0 } },
    raise: { chancePct: 40, perNegotiationPct: 10, pct: 5, restRounds: 2 },
    fullTime: { strongPct: 60, strongRounds: 2, profitPct: 150, focus: 1, status: [[0, 5], [1_000_000_00, 10]], rungsLost: 1 },
    lodger: { rentPct: 30, statusLost: 3 },
    jail: { statusLost: 6, rungsLost: 1 },
    // No limits by default: each test of one sets its own.
    focusLimits: { overtimeTiredFrom: 99, overtimeHealthPoints: 0, overtimeBurnoutFrom: 99, burnoutChancePct: 0, burnoutHealthPoints: 0, burnoutFocus: 0, huntRestRounds: 0, huntMissPct: 0, huntFloorPct: 0, studyPerRung: 999 },
    rentOutMinFinanceSkill: 0,
    unstablePayPct: 30,
    cheapMortgageBp: 50,
    cardsPerRound: 3,
    // Nothing is sold second hand here: tests of the used shop set their own terms.
    used: {},
    // Skills are learnt only by study here, and do nothing: tests of a skill set what they need.
    skills: {
      levelPoints: [3, 6, 9],
      studyPoints: 2,
      practicePoints: 0,
      investingPoints: 1,
      practiceCareers: {},
      practiceItems: {},
      negotiationHuntRaisePct: 0,
      negotiationPromotionPct: 0,
      negotiationSalePct: 0,
      languagesMoveOffPct: 0,
      languagesKeepRungFrom: 3,
      languagesPartnerFrom: 3,
      networkHuntPct: 0,
      networkStatus: 0,
      managementProfitPct: 0,
      managementManagerOffPct: 0,
      managementExtraFrom: 3,
      healthPremiumOffPct: 0,
      healthFocusFrom: 3,
      languagesAbroadPayPct: 0,
      managementPayPct: 0,
      managementPayFromLevel: 99,
      healthRiskOffPct: 0,
      jobRiskOffPct: 0,
      scamRiskOffPct: 0,
    },
  },
  // No reforms and no cards by default, so tests of money are not disturbed. Tests of either add their own.
  world: {
    headlinesPerRound: 3,
    noiseHeadlines: 0,
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
