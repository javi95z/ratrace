import type { CityDef, TaxProfile } from '@ratrace/engine';
import { usd } from './money';

/**
 * Six cities. Salaries, living costs and flat prices are game values in the right proportions,
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
    careerPayPct: { service: 115, tech: 110, hospitality: 120, influencer: 110 },
  },
];
