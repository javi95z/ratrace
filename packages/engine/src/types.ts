import type { Bp, Cents } from './money';
import type { RngState } from './rng';

export type Regime = 'expansion' | 'boom' | 'slowdown' | 'recession' | 'recovery';
export type CryptoPhase = 'accumulation' | 'bull' | 'mania' | 'winter';
export type AssetClass = 'bond' | 'equity' | 'crypto' | 'gold';
export type LifestyleTier = 0 | 1 | 2 | 3;
export type FinanceSkill = 0 | 1 | 2;
export type InsuranceKind = 'health' | 'home' | 'life' | 'liability';
/** 0 is a rented room, 1 a rented flat. Only matters while the player does not live in a home they own. */
export type RentTier = 0 | 1;

export interface AssetDef {
  id: string;
  class: AssetClass;
  /** Sensitivity to the class move, in percent. 100 moves with the class. */
  betaPct: number;
  /** Asset-specific volatility per round, in bp. */
  idioVolBp: Bp;
  /** Added to the asset's return every round, in bp. Lets assets in one class have different average returns. */
  driftBp?: Bp;
  /** Annual dividend yield in bp. Bonds use yieldSpreadBp instead. */
  yieldBp: Bp;
  /** Bonds only: price sensitivity to rate changes, in years. */
  durationYears?: number;
  /** Bonds only: annual yield above the policy rate, in bp. */
  yieldSpreadBp?: Bp;
  /** Chance per round, in percent, of a 90% crash. */
  crashChancePct?: number;
  /** Finance skill needed to buy this asset through an order. Cards can ignore it. Defaults to 0. */
  minFinanceSkill?: FinanceSkill;
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
  /** Chance in percent that a recession pulls the crypto cycle into winter. */
  recessionWinterChancePct: number;
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
  /** Status points for living here. */
  prestige: number;
}

export interface PropertyTypeDef {
  id: string;
  /** Price as a percent of the city's flat price. */
  pricePct: number;
  /** Status points for living in one. */
  status: number;
}

export interface CareerLevel {
  /** Salary as a percent of the city's median salary. */
  salaryPct: number;
  /** Career skill needed to hold this level. */
  minSkill: number;
  /** Status points for the job title. */
  status: number;
}

export interface CareerDef {
  id: string;
  levels: CareerLevel[];
  /** Extra salary for a round of overtime, in percent. */
  overtimePct: number;
}

export type ItemKind = 'durable' | 'membership' | 'experience';

export interface ItemDef {
  id: string;
  /** Items in one ladder compete: the best counts in full, the rest in part. */
  ladder: string;
  /** durable: owned and resold. membership: upkeep until cancelled. experience: consumed, boosts status for a while. */
  kind: ItemKind;
  /** In start-of-game dollars. */
  price: Cents;
  /** In start-of-game dollars. */
  upkeepAnnual: Cents;
  status: number;
  /** Durables: resale value right after purchase, as a percent of the price paid. */
  resaleStartPct: number;
  /** Durables: change in resale value each round, in bp. Negative loses value, positive gains it. */
  resaleDriftBp: Bp;
  /** Experiences: rounds the status lasts. */
  boostRounds: number;
  /** True for something a card can give but the shop does not sell. */
  cardOnly?: boolean;
}

/** The numbers behind family, insurance, housing and effort. */
export interface LifeRules {
  /** Yearly cost of one child, as a percent of the city's living cost. */
  childCostPct: number;
  /** Rounds a child depends on the player. */
  childRounds: number;
  /** Yearly cost a partner adds, as a percent of the city's living cost. */
  partnerCostPct: number;
  /** Yearly premium of each insurance, as a share of the city's living cost, in bp. */
  insurancePremiumBp: Record<InsuranceKind, Bp>;
  /** Share of the housing cost paid at each rent tier, in percent. */
  rentTierHousingPct: readonly [number, number];
  rentTierStatus: readonly [number, number];
  /** Status for each lifestyle tier. */
  lifestyleStatus: readonly [number, number, number, number];
  /** How much of its status an item gives when a better one in its ladder is owned, in percent. */
  lesserItemPct: number;
  /** Cost of moving, as a percent of the destination's yearly living cost. */
  moveCostPct: number;
  /** Career skill gained by a round of work. */
  workSkill: number;
  /** Career skill gained on top by a round of study. */
  studySkill: number;
  jobHuntChancePct: number;
  /** Lasting raise from a successful job hunt, in percent. */
  jobHuntRaisePct: number;
  /** Rounds of holding an investment before finance skill rises once from experience. */
  financeExperienceRounds: number;
  /** Finance skill needed to rent a property out. */
  rentOutMinFinanceSkill: FinanceSkill;
  /** Pay of a life with the `unstable_pay` flag swings by up to this many percent each round. */
  unstablePayPct: number;
  /** Mortgage spread saved by a life with the `cheap_mortgage` flag, in bp. */
  cheapMortgageBp: Bp;
  /** Personal cards drawn each round. */
  cardsPerRound: number;
}

/** News and tax reforms. Both come from their own random streams, so they never move a price. */
export interface WorldRules {
  headlinesPerRound: number;
  /** Chance in percent that a headline is true. */
  newsTruthPct: number;
  /** A move in rates or inflation smaller than this is reported as flat. */
  flatBandBp: Bp;
  /** Chance per round, in percent, of a tax reform somewhere. */
  taxReformChancePct: number;
  taxReformsPerGame: number;
  /** A reform moves every non-zero rate of one city by one of these amounts. */
  taxReformStepsBp: ReadonlyArray<Bp>;
  /**
   * Weight of "no world card this round", set against the weights of the world cards whose
   * trigger holds. Zero means a world card always appears when one can.
   */
  quietWeight: number;
}

export type CardCategory =
  | 'career'
  | 'education'
  | 'business'
  | 'investing'
  | 'housing'
  | 'lifestyle'
  | 'family'
  | 'health'
  | 'luck'
  | 'world'
  | 'tax'
  | 'laterLife';

/** What must be true of the player. Every part that is present must hold. */
export interface Condition {
  minRound?: number;
  maxRound?: number;
  cities?: string[];
  notCities?: string[];
  /** True needs a career, false needs none. */
  employed?: boolean;
  careers?: string[];
  minLevel?: number;
  maxLevel?: number;
  partner?: boolean;
  minChildren?: number;
  maxChildren?: number;
  /** Lives in a home they own. */
  ownsHome?: boolean;
  /** Owns a property that is rented out. */
  landlord?: boolean;
  hasMortgage?: boolean;
  /** Net worth in start-of-game dollars. */
  minNetWorth?: Cents;
  maxNetWorth?: Cents;
  minFinanceSkill?: FinanceSkill;
  maxFinanceSkill?: FinanceSkill;
  /** All of these flags are set. */
  flags?: string[];
  /** None of these flags is set. */
  notFlags?: string[];
  /** Holds something of this kind. */
  holds?: AssetClass | 'deposit';
  /** Owns an item in this ladder. */
  ownsLadder?: string;
  /** Owns none of these items. */
  notItems?: string[];
  /** Holds this insurance. */
  insured?: InsuranceKind;
  regimes?: Regime[];
  /** Property in the player's city returned this or less in the round that just ended. */
  cityPropertyReturnAtMostBp?: Bp;
}

/** What must be true of the world for a world card to appear. Every part that is present must hold. */
export interface WorldTrigger {
  /** The regime changed to one of these this round. */
  regimeBegan?: Regime[];
  regimes?: Regime[];
  /** The crypto cycle changed to one of these this round. */
  cryptoBegan?: CryptoPhase[];
  rateChangeAtLeastBp?: Bp;
  rateChangeAtMostBp?: Bp;
  inflationAtLeastBp?: Bp;
  /** Property in at least one city returned this or less. */
  anyPropertyReturnAtMostBp?: Bp;
  /** A tax reform happened this round. */
  taxReform?: boolean;
}

/**
 * What a card option does. Amounts of money are in start-of-game dollars and are converted at
 * the price level of the round. Everything is optional; an empty record does nothing.
 */
export interface Effects {
  /** One-off money. Negative is a cost. */
  cash?: Cents;
  /** One-off money as a percent of one year's salary. */
  cashSalaryPct?: number;
  /** One-off money as a percent of net worth, when net worth is positive. */
  cashNetWorthPct?: number;
  /** Reduces a net loss from the three fields above when the player holds the insurance or the flag. */
  protection?: { insurance?: InsuranceKind; flag?: string; coverPct: number };
  /** Lasting change to the salary, in percent. */
  salaryModPct?: number;
  /** Change to this round's salary only, in percent. */
  salaryBoostPct?: number;
  careerSkill?: number;
  financeSkill?: number;
  /** Lasting status. */
  status?: number;
  /** Focus points this takes this round. */
  focus?: number;
  /** Added to the player's recurring entries. An entry with the same tag is replaced. */
  recurring?: Recurring[];
  /** Tags of recurring entries to end. */
  endRecurring?: string[];
  setFlags?: string[];
  clearFlags?: string[];
  /** Changes the job. `leave` ends the career; otherwise the career, the level or both are set. */
  job?: { career?: string; level?: number; levelDelta?: number; leave?: boolean };
  /** The player moves here when the round has resolved. */
  moveCity?: string;
  /** A partner with this salary, as a percent of the city median, or null to end the partnership. */
  partner?: { salaryPct: number } | null;
  /** Children born. */
  children?: number;
  /** Buys an item at this percent of its price. Zero is a gift. */
  buyItem?: { itemId: string; pricePct: number };
  /** Buys an asset whatever the player's finance skill. `bonusPct` adds free units on top. */
  invest?: { assetId: string; amount: Cents; bonusPct?: number };
  /** Paid into the pension, on top of the yearly cap. */
  pension?: Cents;
  /** A personal loan of this size, paid out in cash, whatever the usual limit. */
  loan?: Cents;
  /**
   * Buys a property in the player's city at `pricePct` percent of the market price,
   * paying `downPct` percent of that in cash and the rest with a fixed mortgage.
   * The property is worth what was paid for it, so a bargain cannot be sold on at once for more.
   */
  property?: { typeId: string; pricePct: number; downPct: number; rented: boolean };
  /** Turns every mortgage into this kind, at today's rate. */
  refinance?: 'fixed' | 'variable';
  /** Sells the home the player lives in, repays its mortgage, and makes them a tenant. Untaxed. */
  sellHome?: boolean;
  /** Adds this much to the value of the home the player lives in. A fixed amount, so a grand home gains no more than a small one. */
  homeValue?: Cents;
  /** Takes away a percent of the deposit or of every holding in one asset class. */
  lose?: { what: AssetClass | 'deposit'; pct: number };
  /** Raises the lowest lifestyle tier the player can choose. */
  lifestyleFloor?: LifestyleTier;
}

export interface CardOutcome {
  weight: number;
  effects: Effects;
}

/**
 * Why a card option is closed to a player: its condition does not hold; no bank lends during the
 * bankruptcy lock; not enough focus; the thing is already owned; not enough cash and savings;
 * or it would fill the pension of someone who owes more than they own.
 */
export type OptionLock = 'condition' | 'bankruptcy' | 'focus' | 'owned' | 'cash' | 'insolvent';

export interface CardOption {
  /** The option is locked unless this holds. Never set on the first option. */
  when?: Condition;
  effects?: Effects;
  /** One of these is rolled from the player's own random stream, on top of `effects`. */
  outcomes?: CardOutcome[];
}

export interface CardDef {
  id: string;
  category: CardCategory;
  /** Relative chance of being drawn. */
  weight: number;
  /** Rounds that must pass before the card can be drawn again. */
  cooldown: number;
  /** Drawn at most once in a life. */
  once?: boolean;
  when?: Condition;
  /** World cards only. */
  trigger?: WorldTrigger;
  /**
   * Two or three options. The first is the default: it is what an absent player gets,
   * so it never has a condition and never buys anything.
   */
  options: CardOption[];
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
  /**
   * Discount on the forced sale in bankruptcy, in bp. Bankruptcy only happens to a player who owes
   * more than they own, so the sale never leaves them cash; the discount sets how much the
   * creditors recover, which the bankruptcy event reports.
   */
  fireSaleDiscountBp: Bp;
  /** Status a bankruptcy costs for good. Going broke in public is remembered. */
  bankruptcyStatusPenalty: number;
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
  /** The pension follows this asset: its price return plus its reinvested yield. */
  pensionAssetId: string;
  /** Pension contributions in one round may total this share of the round's salary, in bp. */
  pensionContributionCapBp: Bp;
  /** Orders beyond this many in one round are rejected. */
  maxOrdersPerRound: number;
  assets: ReadonlyArray<AssetDef>;
  market: MarketParams;
  cities: ReadonlyArray<CityDef>;
  propertyTypes: ReadonlyArray<PropertyTypeDef>;
  debt: DebtParams;
  scoring: ScoringParams;
  careers: ReadonlyArray<CareerDef>;
  items: ReadonlyArray<ItemDef>;
  life: LifeRules;
  world: WorldRules;
  cards: ReadonlyArray<CardDef>;
}

export type Trend = 'up' | 'down' | 'flat';

/** A claim about the next world state. Whether it was true shows once that state arrives. */
export type Headline =
  | { topic: 'regime'; regime: Regime }
  | { topic: 'crypto'; phase: CryptoPhase }
  | { topic: 'rates'; trend: Trend }
  | { topic: 'inflation'; trend: Trend }
  | { topic: 'property'; cityId: string; trend: 'up' | 'down' };

export interface WorldState {
  round: number;
  regime: Regime;
  cryptoPhase: CryptoPhase;
  policyRateBp: Bp;
  inflationBp: Bp;
  /** Consumer price level. Wages and living costs follow it. Starts at PRICE_LEVEL_START. */
  priceLevel: number;
  /** Return of each asset over the round that just ended, in bp. Zero at round 0. */
  assetReturnBp: Record<string, Bp>;
  /** Price index per asset. Starts at INDEX_START. */
  assetIndex: Record<string, number>;
  propertyReturnBp: Record<string, Bp>;
  propertyIndex: Record<string, number>;
  /** Added to every non-zero tax rate of a city, in bp. Changes only when a reform happens. */
  taxShiftBp: Record<string, Bp>;
  /** Headlines about the next world state. Empty in the last one. */
  news: Headline[];
  /** The world card of this round, the same for every player, or null. */
  eventCardId: string | null;
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

export interface OwnedItem {
  itemId: string;
  /** Durables: what it would sell for today. Otherwise 0. */
  value: Cents;
  /** Experiences: rounds of status left. Otherwise null. */
  roundsLeft: number | null;
}

export interface Recurring {
  /** Names the entry so a later card can end it. */
  tag: string;
  kind: 'expense' | 'passive';
  /** In start-of-game dollars. */
  annual: Cents;
  /** Null means it never ends on its own. */
  roundsLeft: number | null;
}

/** The player's life outside their portfolio. The derived fields of PlayerState are computed from this. */
export interface LifeState {
  lifeId: string;
  /** Null when the player has no job on a career ladder. */
  career: { id: string; level: number } | null;
  /** Salary while there is no career, in start-of-game dollars. Zero in the real lives. */
  baseSalaryAnnual: Cents;
  /** Lasting raises and cuts, in percent. */
  salaryModPct: number;
  /** This round only, in percent: overtime, or a gig worker's good or bad spell. */
  salaryBoostPct: number;
  careerSkill: number;
  financeSkill: FinanceSkill;
  /** Rounds in which the player held an investment. */
  investedRounds: number;
  focusBase: number;
  focusUsed: number;
  partner: boolean;
  /** The partner's salary as a percent of the city median. Zero when not working. */
  partnerSalaryPct: number;
  /** One entry per child: rounds of dependence left. */
  children: number[];
  insurance: Record<InsuranceKind, boolean>;
  rentTier: RentTier;
  minLifestyleTier: LifestyleTier;
  items: OwnedItem[];
  /** Every item ever owned, for the collection screen. */
  collection: string[];
  recurring: Recurring[];
  /** Flag name to the round it was set. */
  flags: Record<string, number>;
  /** Card id to the round it was last drawn. */
  seen: Record<string, number>;
  /** Lasting status from cards. May be negative; total status never is. */
  bonusStatus: number;
  /** City the player moves to when this round has resolved. */
  movingTo: string | null;
}

export interface PlayerState {
  cityId: string;
  cash: Cents;
  deposit: Cents;
  pension: Cents;
  positions: Record<string, Position>;
  properties: Property[];
  debts: Debt[];
  lifestyleTier: LifestyleTier;
  life: LifeState;
  /**
   * The next four fields are derived from `life`, the city and what the player owns.
   * `refreshDerived` recomputes them, and the invariant check fails if they are ever out of step.
   * Change `life`, not these.
   *
   * The three amounts are in start-of-game dollars. The engine converts them at the current
   * price level each time it uses them. Cash, deposit, pension, positions, properties, debts and
   * item values are in the dollars of the day and are never converted.
   */
  salaryAnnual: Cents;
  /** Item upkeep, family, insurance and recurring expenses. */
  extraExpensesAnnual: Cents;
  /** Business profit and other recurring passive income. */
  extraPassiveAnnual: Cents;
  statusPoints: number;
  /**
   * The status of every round played so far, added up, each as it stood once that round's orders
   * had run. The score uses the average, so status has to be lived with: buying it in the last
   * round counts for one round in twenty.
   */
  statusSum: number;
  nextId: number;
  /** Consecutive rounds in which passive income, after tax, covered expenses. */
  passiveStreak: number;
  /** The round at which the current escape was won, or null. An escape is lost by the first round that does not cover. */
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
  | { type: 'setRented'; propertyId: string; rented: boolean }
  | { type: 'focus'; action: FocusAction }
  | { type: 'buyItem'; itemId: string }
  | { type: 'sellItem'; itemId: string }
  | { type: 'setLifestyle'; tier: LifestyleTier }
  | { type: 'setRentTier'; tier: RentTier }
  | { type: 'setInsurance'; insurance: InsuranceKind; on: boolean }
  | { type: 'moveCity'; cityId: string };

/** Each costs one focus point and can be done once a round. */
export type FocusAction = 'overtime' | 'studyCareer' | 'jobHunt';

export interface RoundChoices {
  orders: Order[];
}

/** The player's answers to the cards in their hand: card id to option number. */
export type CardPicks = Record<string, number>;

/** Running totals for the round, read later by the tax step and the end-of-round updates. */
export interface RoundTally {
  realisedGains: Cents;
  pensionContribution: Cents;
  /** Property purchase tax already paid from cash while executing orders. */
  purchaseTaxPaid: Cents;
  /** Focus actions ordered this round. */
  focusActions: FocusAction[];
  /** Cash spent on status items, raised by selling them, and spent on moving city. */
  itemsBought: Cents;
  itemsSold: Cents;
  movingCost: Cents;
}

export interface OrderContext {
  content: Content;
  /** The world whose prices and rates the player saw when deciding. */
  world: WorldState;
  round: number;
  tally: RoundTally;
}

/** Why an order was not executed. The client turns the code into text in the player's language. */
export type RejectReason =
  | 'bad-order'
  | 'unknown-order'
  | 'too-many-orders'
  | 'bad-amount'
  | 'not-enough-cash'
  | 'unknown-asset'
  | 'no-position'
  | 'exceeds-position'
  | 'exceeds-deposit'
  | 'over-pension-limit'
  | 'would-be-insolvent'
  | 'no-credit'
  | 'over-loan-limit'
  | 'unknown-debt'
  | 'exceeds-debt'
  | 'unknown-property-type'
  | 'unknown-mortgage-type'
  | 'bad-down-payment'
  | 'down-payment-too-low'
  | 'down-payment-too-high'
  | 'unknown-property'
  | 'needs-finance-skill'
  | 'unknown-action'
  | 'no-focus'
  | 'already-done'
  | 'no-job'
  | 'unknown-item'
  | 'not-for-sale'
  | 'already-owned'
  | 'not-owned'
  | 'cannot-sell'
  | 'bad-tier'
  | 'below-lifestyle-floor'
  | 'unknown-insurance'
  | 'unknown-city'
  | 'same-city'
  | 'already-moving';

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
  | 'purchaseTax'
  | 'itemPurchases'
  | 'itemSales'
  | 'moving'
  | 'depositDraw'
  | 'creditCardDraw'
  | 'creditCardRepay';

/**
 * What happened in a round. Ledger amounts are signed from the point of view of the player's cash:
 * positive is money in, negative is money out. `purchaseTax` was paid while executing orders.
 */
export type GameEvent =
  | { kind: 'orderRejected'; order: unknown; reason: RejectReason }
  | { kind: 'ledger'; line: LedgerLine; amount: Cents }
  | { kind: 'escaped'; round: number }
  /** Passive income stopped covering expenses, and the escape is over. It can be won again. */
  | { kind: 'escapeLost' }
  | { kind: 'bankrupt'; proceeds: Cents; debtsCleared: Cents }
  /**
   * A card was answered. `picked` is what the player asked for; `option` is what happened, which
   * is the default when the pick was missing, malformed or locked. `outcome` is the number of the
   * rolled outcome, or null. `cash` is the change in the player's cash.
   */
  | { kind: 'card'; cardId: string; picked: number | null; option: number; outcome: number | null; cash: Cents }
  | { kind: 'promoted'; careerId: string; level: number }
  | { kind: 'jobHunt'; success: boolean }
  | { kind: 'financeSkill'; level: FinanceSkill }
  | { kind: 'moved'; cityId: string };

/** How a life begins beyond its money. All of it is optional: without it the player has a fixed salary and no career. */
export interface LifeStart {
  lifeId: string;
  /** Null for a life with no career: it earns the fixed `salaryAnnual` of its start. */
  career: { id: string; level: number } | null;
  careerSkill: number;
  financeSkill: FinanceSkill;
  focus: number;
  minLifestyleTier?: LifestyleTier;
  rentTier?: RentTier;
  /** Homes owned on day one, bought at the round-0 price with no mortgage. */
  properties?: Array<{ typeId: string; rented: boolean }>;
  recurring?: Recurring[];
  flags?: string[];
}

export interface StartConfig {
  cityId: string;
  cash: Cents;
  /** Salary of a life with no career, in start-of-game dollars. A life with a career ignores it. */
  salaryAnnual: Cents;
  lifestyleTier: LifestyleTier;
  debts: Array<Omit<Debt, 'id'>>;
  life?: LifeStart;
}

export interface GameConfig {
  content: Content;
  start: StartConfig;
  /**
   * Names this player's own random stream. Players who share a seed share the world;
   * a different key gives each of them their own cards and dice.
   */
  playerKey?: string;
}

/** `cards`: the hand is waiting for answers. `finance`: the cards are settled and orders are next. */
export type Phase = 'cards' | 'finance';

export interface GameState {
  seed: string;
  /** Rounds completed so far. */
  round: number;
  /** One world state per round boundary: length is rounds + 1. */
  timeline: WorldState[];
  player: PlayerState;
  finished: boolean;
  phase: Phase;
  /** Ids of the cards drawn for this round, in the order they are answered. */
  hand: string[];
  /** How many cards of the hand are answered. The next one to answer is `hand[answered]`. */
  answered: number;
  /** Saved position of the player's own random stream. */
  rng: { cards: RngState };
}

/**
 * A game as a client may hold it: no seed, no saved random stream, and a timeline that stops at the
 * current round. `viewOf` makes one. Previews and selectors accept a view; playing needs the game.
 * A whole `GameState` is also a valid view, of itself.
 */
export type GameView = Omit<GameState, 'seed' | 'rng'>;
