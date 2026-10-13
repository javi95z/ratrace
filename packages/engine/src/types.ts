import type { Bp, Cents } from './money';
import type { RngState } from './rng';

export type Regime = 'expansion' | 'boom' | 'slowdown' | 'recession' | 'recovery';
export type CryptoPhase = 'accumulation' | 'bull' | 'mania' | 'winter';
export type AssetClass = 'bond' | 'equity' | 'crypto' | 'gold';
export type LifestyleTier = 0 | 1 | 2 | 3;
export type FinanceSkill = 0 | 1 | 2 | 3;
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
  /** What each career pays here against the usual, in percent: a city is the place for some trades. Absent: 100. */
  careerPayPct?: Readonly<Record<string, number>>;
}

export interface PropertyTypeDef {
  id: string;
  /** Price as a percent of the city's flat price. */
  pricePct: number;
  /** Status points for living in one. */
  status: number;
  /** True for what nobody can live in, such as a parking space or a shop. It is always let, and gives no status. */
  rentalOnly?: boolean;
  /** Its rent, as a percent of what a home of the same value brings in its city. 100 where left out. */
  rentPct?: number;
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
  /** Pay that follows the economy: percent on top of the pay, or off it, in each state of it. Absent: none. */
  cyclePct?: Partial<Record<Regime, number>>;
  /**
   * A trade for the young. From `fromRound` on the pay falls by `pctPerRound` each round, that
   * round included, until it is `maxPct` down.
   */
  fade?: { fromRound: number; pctPerRound: number; maxPct: number };
  /** Focus points on top each round: a job that leaves time over. */
  focus?: number;
}

export type ItemKind = 'durable' | 'membership' | 'experience';

/**
 * What owning a thing is good for, beyond its status. Within a ladder only the best of each counts,
 * as with status; across ladders they add up.
 */
export interface ItemPerks {
  /** Percent off the cost of moving to another city. */
  moveCostOffPct?: number;
  /** Career skill gained on top by a round of study. */
  studySkill?: number;
  /** Lasting rise in the player's own pay while it is owned, in percent. */
  salaryPct?: number;
  /** Points added to the chance that a job hunt succeeds, in percent. */
  jobHuntPct?: number;
  /** Focus points on top in the round after one in which it is held. */
  focus?: number;
}

export const ITEM_PERKS = ['moveCostOffPct', 'studySkill', 'salaryPct', 'jobHuntPct', 'focus'] as const satisfies ReadonlyArray<keyof ItemPerks>;

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
  /**
   * The cities whose shops sell it. Absent: every city. A membership tied to cities is of no use
   * anywhere else, so it lapses when the player moves out of them; anything else goes along.
   */
  cities?: readonly string[];
  /** What it is good for, if anything. */
  perks?: ItemPerks;
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
  /** From this round on a rented room is no longer neutral: sharing a flat is ordinary at twenty-two and noticed later. */
  roomLateRound: number;
  /** The status of a rented room from that round on. */
  roomLateStatus: number;
  /** Status for each lifestyle tier. Living below the ordinary may take status away. */
  lifestyleStatus: readonly [number, number, number, number];
  /** Buying a thing that lasts on instalments: this percent of the price is paid down, and the rest is a personal loan. */
  itemFinanceDownPct: number;
  /** The least a thing must cost, at the prices of the start, to be sold on instalments. */
  itemFinanceMinPrice: Cents;
  /** How much of its status an item gives when a better one in its ladder is owned, in percent. */
  lesserItemPct: number;
  /** Cost of moving, as a percent of the destination's yearly living cost. */
  moveCostPct: number;
  /** Moving a partner costs this percent more, and each child this percent more again. */
  movePartnerPct: number;
  moveChildPct: number;
  /** Rungs of the career lost by moving of one's own accord: nobody knows the newcomer yet. A transfer loses none. */
  moveRungsLost: number;
  /** Rounds a partner goes without pay after such a move, while they find work of their own. */
  partnerSettlingRounds: number;
  /**
   * The ladders whose things lose status as they lose value: an old car is not the car it was. Each
   * round held takes the item's own loss of resale value off its status too, never below the floor.
   * A thing that holds or gains value keeps its status and gains none.
   */
  agingLadders: readonly string[];
  /** The least of its status an aged thing keeps, in percent. */
  agingFloorPct: number;
  /** Career skill gained by a round of work. */
  workSkill: number;
  /** Career skill gained on top by a round of study. */
  studySkill: number;
  jobHuntChancePct: number;
  /** Lasting raise from a successful job hunt, in percent. */
  jobHuntRaisePct: number;
  /** Rounds of holding an investment before finance skill rises once from experience. */
  financeExperienceRounds: number;
  /** Rounds of holding an investment that take someone at the third level to the fourth and last. Cards never do. */
  financeMasterRounds: number;
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
/**
 * One round of a crisis. What it does on arriving: the regime and the crypto cycle it forces, and
 * what it adds to the policy rate and to inflation. What it does to the round then played under
 * it: what it adds to the return of each kind of asset, on top of everything else.
 */
export interface CrisisPhase {
  regime?: Regime;
  cryptoPhase?: CryptoPhase;
  rateBp?: Bp;
  inflationBp?: Bp;
  equityBp?: Bp;
  cryptoBp?: Bp;
  goldBp?: Bp;
  propertyBp?: Bp;
}

/** A crisis with a name: a few rounds in a row in which the world is pushed off its course. At most one in a game. */
export interface CrisisDef {
  id: string;
  /** Relative chance of being the one, when a game has a crisis. */
  weight: number;
  /** One entry for each round it lasts. */
  phases: ReadonlyArray<CrisisPhase>;
}

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
  /** Chance in percent that a game has a crisis at all. Zero for a world that never has one. */
  crisisChancePct: number;
  /** The first round a crisis may open in, so that a life has something to lose by then. */
  crisisEarliestRound: number;
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
  /** Owns nothing in this ladder: no car at all, for one. */
  lacksLadder?: string;
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
  /** This round is that round of that crisis, counted from 1. */
  crisis?: { id: string; year: number };
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
  /** What a margin loan costs above the policy rate, in bp. It moves with the rate. */
  marginSpreadBp: Bp;
  /** The most that may be borrowed against an investment when buying, as a percent of what is then held of it. */
  marginMaxPct: number;
  /** When the loan is more than this percent of what the investment is worth, the broker sells it all. */
  marginCallPct: number;
  /** Finance skill needed to buy with borrowed money. */
  marginMinFinanceSkill: FinanceSkill;
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
  /** The crises a game may have. Empty for a world without any. */
  crises: ReadonlyArray<CrisisDef>;
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
  /** The crisis this round is played under, and which of its rounds this is, counted from 1. Null in ordinary times. */
  crisis: { id: string; year: number; of: number } | null;
}

export interface Position {
  value: Cents;
  /** What was paid for the part still held. */
  basis: Cents;
}

export type DebtKind = 'mortgageFixed' | 'mortgageVariable' | 'personalLoan' | 'creditCard' | 'margin';

export interface Debt {
  id: string;
  kind: DebtKind;
  principal: Cents;
  /** Annual rate in bp. Ignored for variable mortgages and credit cards. */
  fixedRateBp: Bp;
  roundsLeft: number;
  /** The item this loan paid for, when it was taken to buy one on instalments. It stays owed if the item is sold. */
  forItem?: string;
  /** The investment a margin loan was taken to buy more of, and is secured on. */
  forAsset?: string;
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
  /** What was paid for it, at the prices of the day it was bought. Zero for a gift. */
  paid: Cents;
  /** Rounds it has been held. A thing that ages gives less status with each. */
  age: number;
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
  /** Focus on top this round, from what the player held when it opened: a long trip rests them for the round after. */
  focusBonus: number;
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
  /** True when that move is a transfer a card offered: an employer places the player, so it costs the career nothing. */
  movingTransfer: boolean;
  /** Rounds the partner still goes without pay, after a move of the player's own. */
  partnerSettling: number;
}

/**
 * A standing instruction to put the same amount into an asset every round, whatever its price:
 * much when it is cheap in units and little when it is dear, without the player having to decide.
 */
export interface InvestPlan {
  assetId: string;
  /** Bought each round, in the dollars of the day. */
  amount: Cents;
  /** Everything the plan has put in so far. */
  invested: Cents;
  /** Rounds in which it bought. */
  rounds: number;
}

export interface PlayerState {
  cityId: string;
  cash: Cents;
  deposit: Cents;
  pension: Cents;
  positions: Record<string, Position>;
  /** Standing instructions to invest, at most one an asset, run each round after the player's own orders. */
  plans: InvestPlan[];
  /** True if what the investments pay is put back into them each round instead of being kept as cash. */
  reinvest: boolean;
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
  /** `margin` is borrowed from the broker on top of the amount, and buys more of the same. */
  | { type: 'buy'; assetId: string; amount: Cents; margin?: Cents }
  | { type: 'sell'; assetId: string; amount: Cents }
  | { type: 'depositIn'; amount: Cents }
  | { type: 'depositOut'; amount: Cents }
  | { type: 'pensionIn'; amount: Cents }
  /** Has what the investments pay bought more of them each round, or pays it out as cash again. */
  | { type: 'setReinvest'; on: boolean }
  /** Sets what is put into the asset every round from now on, this round included. Zero ends the plan. */
  | { type: 'setPlan'; assetId: string; amount: Cents }
  | { type: 'borrow'; amount: Cents }
  | { type: 'repay'; debtId: string; amount: Cents }
  | { type: 'buyProperty'; typeId: string; downPayment: Cents; mortgage: 'fixed' | 'variable' | 'none'; rented: boolean }
  | { type: 'sellProperty'; propertyId: string }
  | { type: 'setRented'; propertyId: string; rented: boolean }
  | { type: 'focus'; action: FocusAction }
  | { type: 'buyItem'; itemId: string; financed?: boolean }
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
  | 'over-margin-limit'
  | 'unknown-debt'
  | 'exceeds-debt'
  | 'unknown-property-type'
  | 'unknown-mortgage-type'
  | 'bad-down-payment'
  | 'down-payment-too-low'
  | 'down-payment-too-high'
  | 'unknown-property'
  | 'needs-finance-skill'
  | 'not-a-home'
  | 'unknown-action'
  | 'no-focus'
  | 'already-done'
  | 'no-job'
  | 'unknown-item'
  | 'not-for-sale'
  | 'not-sold-here'
  | 'already-owned'
  | 'cannot-finance'
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
  | 'creditCardRepay'
  | 'dividendsReinvested';

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
  /**
   * A card still waiting in the hand stopped making sense, because of what an earlier card of the
   * round did, and was taken out. `replacedBy` is the card dealt in its place, or null when no
   * other card was open to the player.
   */
  | { kind: 'cardWithdrawn'; cardId: string; replacedBy: string | null }
  | { kind: 'promoted'; careerId: string; level: number }
  | { kind: 'jobHunt'; success: boolean }
  | { kind: 'financeSkill'; level: FinanceSkill }
  /** `rungsLost` and `partnerIdle` say what the move cost the career and the household; both are nothing for a transfer. */
  /** The broker sold an investment bought with borrowed money, because the loan had grown too large beside it. */
  | { kind: 'marginCall'; assetId: string; sold: Cents; repaid: Cents }
  /** A plan bought, or did not and why: no cash left for it, or the asset is no longer the player's to buy. */
  | { kind: 'planRan'; assetId: string; amount: Cents; reason: RejectReason | null }
  | { kind: 'moved'; cityId: string; rungsLost: number; partnerIdle: boolean }
  /** A membership of the city just left ended with the move. Nothing is paid back. */
  | { kind: 'lapsed'; itemId: string };

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
  /** Investments held on day one, as if just bought for what they are worth. The finance skill is not asked. */
  holdings?: Array<{ assetId: string; value: Cents }>;
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
