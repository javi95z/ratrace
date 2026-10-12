import type { Bp, Cents } from './money';

export type Regime = 'expansion' | 'boom' | 'slowdown' | 'recession' | 'recovery';
export type CryptoPhase = 'accumulation' | 'bull' | 'mania' | 'winter';
export type AssetClass = 'bond' | 'equity' | 'crypto' | 'gold';
export type LifestyleTier = 0 | 1 | 2 | 3;

export interface AssetDef {
  id: string;
  class: AssetClass;
  /** Sensitivity to the class move, in percent. 100 moves with the class. */
  betaPct: number;
  /** Asset-specific volatility per round, in bp. */
  idioVolBp: Bp;
  /** Annual dividend yield in bp. Bonds use yieldSpreadBp instead. */
  yieldBp: Bp;
  /** Bonds only: price sensitivity to rate changes, in years. */
  durationYears?: number;
  /** Bonds only: annual yield above the policy rate, in bp. */
  yieldSpreadBp?: Bp;
  /** Chance per round, in percent, of a 90% crash. */
  crashChancePct?: number;
}

export interface MarketParams {
  regimeTransitions: Record<Regime, ReadonlyArray<readonly [Regime, number]>>;
  cryptoTransitions: Record<CryptoPhase, ReadonlyArray<readonly [CryptoPhase, number]>>;
  /** Mean return per round, in bp. */
  equityMeanBp: Record<Regime, Bp>;
  cryptoMeanBp: Record<CryptoPhase, Bp>;
  goldMeanBp: Record<Regime, Bp>;
  classVolBp: Record<'equity' | 'crypto' | 'gold', Bp>;
  /** Policy-rate change per round in bp, before noise. */
  rateDriftBp: Record<Regime, Bp>;
  rateNoiseBp: Bp;
  inflationTargetBp: Record<Regime, Bp>;
  inflationNoiseBp: Bp;
  /** Deposit rate = policy rate minus this spread, floored at zero. */
  depositSpreadBp: Bp;
  start: { regime: Regime; cryptoPhase: CryptoPhase; policyRateBp: Bp; inflationBp: Bp };
}

export interface TaxProfile {
  /** Marginal rates in bp for the three brackets. */
  incomeRatesBp: readonly [Bp, Bp, Bp];
  capitalGainsBp: Bp;
  dividendBp: Bp;
  /** If true, rent is added to salary and taxed through the brackets. */
  rentAsIncome: boolean;
  rentBp: Bp;
  propertyPurchaseBp: Bp;
  propertyAnnualBp: Bp;
  /** Pension contributions up to this share of salary, in bp, reduce taxable income. */
  pensionDeductionCapBp: Bp;
  /** Gains plus dividends up to this amount per round are tax-free. */
  investmentAllowance: Cents;
}

export interface CityDef {
  id: string;
  medianSalaryAnnual: Cents;
  livingCostAnnual: Cents;
  /** Price of the reference flat. Other property types scale from it. */
  flatPrice: Cents;
  /** Annual rent as a share of property value, in bp. */
  rentYieldBp: Bp;
  /** Base property growth per round, in bp. */
  propertyGrowthBp: Bp;
  /** Share of last round's return carried into this round, in percent. */
  propertyMomentumPct: number;
  /** Return in bp lost for each bp the policy rate rises. */
  propertyRateSensitivity: number;
  propertyVolBp: Bp;
  tax: TaxProfile;
}

export interface PropertyTypeDef {
  id: string;
  /** Price as a percent of the city's flat price. */
  pricePct: number;
}

export interface DebtParams {
  personalLoanSpreadBp: Bp;
  mortgageSpreadBp: Bp;
  creditCardRateBp: Bp;
  mortgageTermRounds: number;
  personalLoanTermRounds: number;
  /** Largest mortgage as a share of the price, in bp. */
  mortgageMaxLtvBp: Bp;
  /** Personal loans may total this percent of annual salary. */
  personalLoanMaxIncomePct: number;
  /** Bankruptcy when credit card debt exceeds this multiple of annual income. */
  bankruptcyIncomeMultiple: number;
  bankruptcyLockRounds: number;
  /** Discount on forced sales, in bp. */
  fireSaleDiscountBp: Bp;
}

export interface ScoringParams {
  /** [net worth in cents, points], strictly increasing by net worth. */
  wealthBreakpoints: ReadonlyArray<readonly [Cents, number]>;
  escapeBase: number;
  escapePerRoundLeft: number;
}

export interface Content {
  rounds: number;
  yearsPerRound: number;
  /** Living-cost multiplier in percent for lifestyle tiers 0 to 3. */
  lifestyleMultiplierPct: readonly [number, number, number, number];
  /** Share of living cost that is housing, in percent. Waived for owner-occupiers. */
  housingSharePct: number;
  /** The pension follows this asset's return. */
  pensionAssetId: string;
  assets: ReadonlyArray<AssetDef>;
  market: MarketParams;
  cities: ReadonlyArray<CityDef>;
  propertyTypes: ReadonlyArray<PropertyTypeDef>;
  debt: DebtParams;
  scoring: ScoringParams;
}

export interface WorldState {
  round: number;
  regime: Regime;
  cryptoPhase: CryptoPhase;
  policyRateBp: Bp;
  inflationBp: Bp;
  /** Return of each asset over the round that just ended, in bp. Zero at round 0. */
  assetReturnBp: Record<string, Bp>;
  /** Price index per asset. Starts at 10000. */
  assetIndex: Record<string, number>;
  propertyReturnBp: Record<string, Bp>;
  propertyIndex: Record<string, number>;
}

export interface Position {
  value: Cents;
  /** What was paid for the part still held. */
  basis: Cents;
}

export type DebtKind = 'mortgageFixed' | 'mortgageVariable' | 'personalLoan' | 'creditCard';

export interface Debt {
  id: string;
  kind: DebtKind;
  principal: Cents;
  /** Annual rate in bp. Ignored for variable mortgages and credit cards. */
  fixedRateBp: Bp;
  roundsLeft: number;
}

export interface Property {
  id: string;
  cityId: string;
  typeId: string;
  value: Cents;
  basis: Cents;
  rented: boolean;
  mortgageId: string | null;
}

export interface PlayerState {
  cityId: string;
  cash: Cents;
  deposit: Cents;
  pension: Cents;
  positions: Record<string, Position>;
  properties: Property[];
  debts: Debt[];
  salaryAnnual: Cents;
  lifestyleTier: LifestyleTier;
  /** Upkeep, family and insurance. Set by the life systems in plan 2. */
  extraExpensesAnnual: Cents;
  /** Business profit and similar. Set by the life systems in plan 2. */
  extraPassiveAnnual: Cents;
  statusPoints: number;
  nextId: number;
  /** Consecutive rounds in which passive income covered expenses. */
  passiveStreak: number;
  escapedAtRound: number | null;
  /** Borrowing is refused while the current round is below this. */
  bankruptUntilRound: number;
}

export type Order =
  | { type: 'buy'; assetId: string; amount: Cents }
  | { type: 'sell'; assetId: string; amount: Cents }
  | { type: 'depositIn'; amount: Cents }
  | { type: 'depositOut'; amount: Cents }
  | { type: 'pensionIn'; amount: Cents }
  | { type: 'borrow'; amount: Cents }
  | { type: 'repay'; debtId: string; amount: Cents }
  | { type: 'buyProperty'; typeId: string; downPayment: Cents; mortgage: 'fixed' | 'variable' | 'none'; rented: boolean }
  | { type: 'sellProperty'; propertyId: string }
  | { type: 'setRented'; propertyId: string; rented: boolean };

export interface RoundChoices {
  orders: Order[];
}

export type LedgerLine =
  | 'salary'
  | 'dividends'
  | 'interest'
  | 'rent'
  | 'otherPassive'
  | 'living'
  | 'otherExpenses'
  | 'debtInterest'
  | 'debtPrincipal'
  | 'incomeTax'
  | 'investmentTax'
  | 'propertyTax'
  | 'creditCardDraw';

export type GameEvent =
  | { kind: 'orderRejected'; order: Order; reason: string }
  | { kind: 'ledger'; line: LedgerLine; amount: Cents }
  | { kind: 'escaped'; round: number }
  | { kind: 'bankrupt' };

export interface StartConfig {
  cityId: string;
  cash: Cents;
  salaryAnnual: Cents;
  lifestyleTier: LifestyleTier;
  debts: Array<Omit<Debt, 'id'>>;
}

export interface GameConfig {
  content: Content;
  start: StartConfig;
}

export interface GameState {
  seed: string;
  /** Rounds completed so far. */
  round: number;
  /** One world state per round boundary: length is rounds + 1. */
  timeline: WorldState[];
  player: PlayerState;
  finished: boolean;
}
