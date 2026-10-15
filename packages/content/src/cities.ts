import type { CityDef, TaxProfile } from '@ratrace/engine';
import { usd } from './money';

/**
 * Ten cities. Salaries, living costs and flat prices are game values in the right proportions,
 * not statistics. Tax rates are deliberately simplified (spec 3.8).
 */

const madridTax: TaxProfile = {
  incomeRatesBp: [1_900, 3_000, 4_500],
  capitalGainsBp: 2_100,
  dividendBp: 2_100,
  rentAsIncome: false,
  rentBp: 2_100,
  propertyPurchaseBp: 800,
  propertyAnnualBp: 40,
  pensionDeductionCapBp: 1_000,
  investmentAllowance: 0,
};

/** The first slice of gains and dividends each round is tax-free. */
const londonTax: TaxProfile = {
  incomeRatesBp: [2_000, 4_000, 4_500],
  capitalGainsBp: 2_000,
  dividendBp: 2_000,
  rentAsIncome: false,
  rentBp: 2_000,
  propertyPurchaseBp: 500,
  propertyAnnualBp: 50,
  pensionDeductionCapBp: 0,
  investmentAllowance: usd(6_000),
};

const newYorkTax: TaxProfile = {
  incomeRatesBp: [2_500, 3_800, 5_000],
  capitalGainsBp: 2_500,
  dividendBp: 2_500,
  rentAsIncome: false,
  rentBp: 2_500,
  propertyPurchaseBp: 200,
  propertyAnnualBp: 120,
  pensionDeductionCapBp: 1_500,
  investmentAllowance: 0,
};

const dubaiTax: TaxProfile = {
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

/** No tax on gains or dividends; rent is taxed with salary. */
const singaporeTax: TaxProfile = {
  incomeRatesBp: [500, 1_500, 2_200],
  capitalGainsBp: 0,
  dividendBp: 0,
  rentAsIncome: true,
  rentBp: 0,
  propertyPurchaseBp: 400,
  propertyAnnualBp: 40,
  pensionDeductionCapBp: 0,
  investmentAllowance: 0,
};

const bangkokTax: TaxProfile = {
  incomeRatesBp: [500, 2_000, 3_500],
  capitalGainsBp: 1_000,
  dividendBp: 1_000,
  rentAsIncome: false,
  rentBp: 1_000,
  propertyPurchaseBp: 300,
  propertyAnnualBp: 10,
  pensionDeductionCapBp: 0,
  investmentAllowance: 0,
};

/** Gains and dividends taxed lightly, with a yearly allowance like a NISA account; property pays a yearly tax. */
const tokyoTax: TaxProfile = {
  incomeRatesBp: [1_500, 3_300, 4_500],
  capitalGainsBp: 2_000,
  dividendBp: 2_000,
  rentAsIncome: true,
  rentBp: 0,
  propertyPurchaseBp: 400,
  propertyAnnualBp: 140,
  pensionDeductionCapBp: 800,
  investmentAllowance: usd(4_000),
};

/** A flat tax on nearly everything, and almost nothing on property. */
const moscowTax: TaxProfile = {
  incomeRatesBp: [1_300, 1_300, 1_500],
  capitalGainsBp: 1_300,
  dividendBp: 1_300,
  rentAsIncome: false,
  rentBp: 1_300,
  propertyPurchaseBp: 0,
  propertyAnnualBp: 10,
  pensionDeductionCapBp: 0,
  investmentAllowance: 0,
};

const mexicoCityTax: TaxProfile = {
  incomeRatesBp: [1_000, 2_500, 3_500],
  capitalGainsBp: 1_000,
  dividendBp: 1_000,
  rentAsIncome: false,
  rentBp: 1_000,
  propertyPurchaseBp: 500,
  propertyAnnualBp: 10,
  pensionDeductionCapBp: 1_000,
  investmentAllowance: 0,
};

/** No tax on gains at all; dividends and a wealth tax pay for it. Rent is taxed with salary. */
const zurichTax: TaxProfile = {
  incomeRatesBp: [1_200, 2_200, 3_300],
  capitalGainsBp: 0,
  dividendBp: 3_500,
  rentAsIncome: true,
  rentBp: 0,
  propertyPurchaseBp: 300,
  propertyAnnualBp: 50,
  pensionDeductionCapBp: 1_500,
  investmentAllowance: 0,
};

// How hard each tax office looks sets how likely an inspection is at the same suspicion: New York's
// most of all, Dubai's and Bangkok's hardly at all.
// Each city is the place for a trade or two, which it pays above the usual: the capital for its
// civil servants, the two financial centres for finance, the hubs for whoever serves or builds there.
export const cities: CityDef[] = [
  {
    id: 'madrid',
    medianSalaryAnnual: usd(32_000),
    livingCostAnnual: usd(26_000),
    flatPrice: usd(280_000),
    rentYieldBp: 420,
    propertyGrowthBp: 550,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 4,
    propertyVolBp: 700,
    tax: madridTax,
    prestige: 6,
    taxOfficePct: 100,
    careerPayPct: { public: 115, healthcare: 110, education: 110 },
  },
  {
    id: 'london',
    medianSalaryAnnual: usd(58_000),
    livingCostAnnual: usd(47_000),
    flatPrice: usd(620_000),
    rentYieldBp: 360,
    propertyGrowthBp: 550,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 5,
    propertyVolBp: 800,
    tax: londonTax,
    prestige: 12,
    taxOfficePct: 110,
    careerPayPct: { finance: 120, medicine: 110, law: 115, sales: 110 },
  },
  {
    id: 'new_york',
    medianSalaryAnnual: usd(75_000),
    livingCostAnnual: usd(60_000),
    flatPrice: usd(700_000),
    rentYieldBp: 400,
    propertyGrowthBp: 600,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 5,
    propertyVolBp: 800,
    tax: newYorkTax,
    prestige: 15,
    taxOfficePct: 120,
    careerPayPct: { finance: 125, tech: 110, law: 120, sales: 115 },
  },
  {
    id: 'dubai',
    medianSalaryAnnual: usd(56_000),
    livingCostAnnual: usd(45_000),
    flatPrice: usd(330_000),
    rentYieldBp: 650,
    propertyGrowthBp: 500,
    propertyMomentumPct: 40,
    propertyRateSensitivity: 3,
    propertyVolBp: 1_300,
    tax: dubaiTax,
    prestige: 15,
    taxOfficePct: 30,
    careerPayPct: { service: 120, finance: 110, influencer: 120, hospitality: 115 },
  },
  {
    id: 'singapore',
    medianSalaryAnnual: usd(58_000),
    livingCostAnnual: usd(47_000),
    flatPrice: usd(640_000),
    rentYieldBp: 320,
    propertyGrowthBp: 550,
    propertyMomentumPct: 25,
    propertyRateSensitivity: 4,
    propertyVolBp: 600,
    tax: singaporeTax,
    prestige: 12,
    taxOfficePct: 90,
    careerPayPct: { tech: 120, finance: 110, education: 115 },
  },
  {
    id: 'bangkok',
    medianSalaryAnnual: usd(13_000),
    livingCostAnnual: usd(10_500),
    flatPrice: usd(95_000),
    rentYieldBp: 500,
    propertyGrowthBp: 500,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 3,
    propertyVolBp: 900,
    tax: bangkokTax,
    prestige: 6,
    taxOfficePct: 40,
    careerPayPct: { service: 115, tech: 110, hospitality: 120, influencer: 110 },
  },
  {
    // Prices that have hardly moved in thirty years, and rates that barely move them now.
    id: 'tokyo',
    medianSalaryAnnual: usd(42_000),
    livingCostAnnual: usd(33_000),
    flatPrice: usd(450_000),
    rentYieldBp: 380,
    propertyGrowthBp: 300,
    propertyMomentumPct: 20,
    propertyRateSensitivity: 2,
    propertyVolBp: 500,
    tax: tokyoTax,
    prestige: 13,
    taxOfficePct: 110,
    careerPayPct: { tech: 115, sales: 110, hospitality: 110 },
  },
  {
    // A flat tax and cheap property, in a market that swings hard with the rates.
    id: 'moscow',
    medianSalaryAnnual: usd(18_000),
    livingCostAnnual: usd(14_000),
    flatPrice: usd(220_000),
    rentYieldBp: 450,
    propertyGrowthBp: 600,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 6,
    propertyVolBp: 1_400,
    tax: moscowTax,
    prestige: 9,
    taxOfficePct: 60,
    careerPayPct: { finance: 115, tech: 115, public: 110 },
  },
  {
    id: 'mexico_city',
    medianSalaryAnnual: usd(12_000),
    livingCostAnnual: usd(10_000),
    flatPrice: usd(140_000),
    rentYieldBp: 600,
    propertyGrowthBp: 650,
    propertyMomentumPct: 30,
    propertyRateSensitivity: 4,
    propertyVolBp: 1_100,
    tax: mexicoCityTax,
    prestige: 7,
    taxOfficePct: 45,
    careerPayPct: { influencer: 115, hospitality: 110, sales: 115, law: 110 },
  },
  {
    // The highest pay and the dearest flats in the game, and a quiet market.
    id: 'zurich',
    medianSalaryAnnual: usd(95_000),
    livingCostAnnual: usd(70_000),
    flatPrice: usd(1_400_000),
    rentYieldBp: 280,
    propertyGrowthBp: 400,
    propertyMomentumPct: 20,
    propertyRateSensitivity: 3,
    propertyVolBp: 400,
    tax: zurichTax,
    prestige: 16,
    taxOfficePct: 90,
    careerPayPct: { finance: 125, medicine: 115, law: 115, tech: 110 },
  },
];
