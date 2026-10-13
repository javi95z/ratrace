import { businessLock, businessRound, businessSalePrice, businessTypeOf } from './business';
import type { BusinessRound } from './business';
import { debtRateBp, loanRoom, marginOn, personalLoanRateBp } from './debt';
import { marginLock } from './portfolio';
import { dividendsByAsset, livingCostAnnual } from './economy';
import { effectiveTax, incomeTaxAnnual } from './tax';
import { careerSwing, homeOf, INSURANCE_KINDS, itemStatus, ownPay, perksOf, refreshDerived, rentStatusAt } from './life/derive';
import { canSellItem, financeLock, focusLeft, focusTotal, itemFinance, itemTerms, lapsingIn, moveCost, soldIn } from './life/orders';
import { jobHuntChance, landingOf } from './life/roundEnd';
import { careerOf, cityOf, itemOf, propertyTypeOf } from './lookup';
import { applyBp, BP, mulDiv } from './money';
import type { Bp, Cents } from './money';
import { ownsHome, propertyTerms, rentalOnly, rentYieldBp } from './property';
import type { PropertyTerms } from './property';
import { depositRateBp, indexed } from './rates';
import type { Business, Content, GameView, InsuranceKind, ItemPerks, LifestyleTier, PlayerState, RejectReason, RentTier, WorldState } from './types';

/**
 * Quotes: what things cost this player right now. An interface shows these instead of working
 * the figures out itself, so no rule of the game is written twice. Each quote is computed by the
 * same code that executes the matching order, and a view of the game is all it needs.
 */

export interface PropertyQuote extends PropertyTerms {
  /** False during the bankruptcy lock: no mortgage, the price must be paid in full. */
  canBorrow: boolean;
  /** False until the player has the finance skill to be a landlord. */
  canRentOut: boolean;
  /** True for what nobody can live in: it can only be bought to let. */
  letOnly: boolean;
  /** What it would bring in a year if let, at today's price. */
  rentAnnual: Cents;
}

export function quoteProperty(content: Content, view: GameView, typeId: string): PropertyQuote {
  const p = view.player;
  const terms = propertyTerms(p, content, view.timeline[view.round], typeId);
  return {
    ...terms,
    canBorrow: view.round >= p.bankruptUntilRound,
    canRentOut: p.life.financeSkill >= content.life.rentOutMinFinanceSkill,
    letOnly: rentalOnly(content, typeId),
    rentAnnual: applyBp(terms.price, rentYieldBp(content, p.cityId, typeId)),
  };
}

export interface OwnedPropertyQuote {
  /** What it would sell for today. */
  value: Cents;
  /** What was paid for it. */
  paid: Cents;
  /** What a year of letting it brings at today's value, whether or not it is let now. */
  rentAnnual: Cents;
  rented: boolean;
  /** True for the one home the player lives in. */
  livedIn: boolean;
  /** True for what nobody can live in. */
  letOnly: boolean;
  /** The status it gives while it is the player's home. */
  status: number;
  /** The loan on it, at the rate it bears today, or null when it is owned outright. */
  mortgage: { principal: Cents; rateBp: Bp; roundsLeft: number; variable: boolean } | null;
  /** What a sale would leave after the mortgage is repaid, before any tax on the gain. */
  netOnSale: Cents;
}

/** Everything about a property the player owns, or null if they do not own it. */
export function quoteOwnedProperty(content: Content, view: GameView, propertyId: string): OwnedPropertyQuote | null {
  const p = view.player;
  const property = p.properties.find((x) => x.id === propertyId);
  if (!property) return null;
  const debt = p.debts.find((d) => d.id === property.mortgageId);
  return {
    value: property.value,
    paid: property.basis,
    rentAnnual: applyBp(property.value, rentYieldBp(content, property.cityId, property.typeId)),
    rented: property.rented,
    livedIn: homeOf(p, content)?.id === property.id,
    letOnly: rentalOnly(content, property.typeId),
    status: propertyTypeOf(content, property.typeId).status,
    mortgage: debt
      ? { principal: debt.principal, rateBp: debtRateBp(debt, content, view.timeline[view.round], p), roundsLeft: debt.roundsLeft, variable: debt.kind === 'mortgageVariable' }
      : null,
    netOnSale: property.value - (debt?.principal ?? 0),
  };
}

export interface ItemQuote {
  price: Cents;
  /** What it would sell for: its value now if owned, or its value the moment it is bought. */
  resale: Cents;
  /** Yearly upkeep at today's prices. */
  upkeepAnnual: Cents;
  /** The status it gives new, and the status it gives as the player holds it: less for a thing that has aged. */
  statusNew: number;
  status: number;
  /** True for a thing that loses status as the years go by. */
  ages: boolean;
  owned: boolean;
  /** What the player paid for it, at the prices of that day, or null if they do not own it. */
  paid: Cents | null;
  /** What is still owed on the loans that bought it on instalments. It stays owed after a sale. */
  owed: Cents;
  /** False for something only a card can give. */
  forSale: boolean;
  /** False where the shops of the player's city do not sell it. */
  soldHere: boolean;
  /** True for a membership of certain cities only: it ends the day the player moves out of them. */
  local: boolean;
  /** True if the player owns it and may sell or cancel it. False for an experience already spent and for what only a card gives. */
  sellable: boolean;
  /** The terms of buying it on instalments today, or null for what no shop sells that way. */
  finance: ItemFinanceQuote | null;
}

export interface ItemFinanceQuote {
  /** Paid from cash on the day. */
  down: Cents;
  /** The rest, taken as a personal loan. */
  loan: Cents;
  /** The yearly rate of that loan, fixed for its term. */
  rateBp: Bp;
  termRounds: number;
  /** What the loan costs in each of its first years: interest, and the slice of the loan paid back. */
  annual: Cents;
  /** Why the player may not have these terms today, or null when they may. */
  lock: RejectReason | null;
}

export function quoteItem(content: Content, view: GameView, itemId: string): ItemQuote {
  const item = itemOf(content, itemId);
  const world = view.timeline[view.round];
  const held = view.player.life.items.find((owned) => owned.itemId === itemId);
  const terms = itemTerms(item, world);
  // Nothing is sold twice: there are no terms for what the player already owns.
  const plan = held ? null : itemFinance(item, content, world);
  const rateBp = personalLoanRateBp(content, world);
  const termRounds = content.debt.personalLoanTermRounds;
  const years = content.yearsPerRound;
  return {
    price: terms.price,
    resale: held ? held.value : terms.resale,
    upkeepAnnual: indexed(item.upkeepAnnual, world),
    statusNew: item.status,
    status: itemStatus(item, held ? held.age : 0, content),
    // Asked of a thing held long enough to have reached the floor: does it give less than it gave?
    ages: itemStatus(item, 1_000, content) < item.status,
    owned: held !== undefined,
    paid: held ? held.paid : null,
    owed: view.player.debts.reduce((sum, debt) => (debt.forItem === itemId ? sum + debt.principal : sum), 0),
    forSale: item.cardOnly !== true,
    soldHere: soldIn(item, view.player.cityId),
    local: item.kind === 'membership' && item.cities !== undefined,
    sellable: held !== undefined && canSellItem(content, held),
    finance:
      plan === null
        ? null
        : {
            ...plan,
            rateBp,
            termRounds,
            annual: Math.round((applyBp(plan.loan, rateBp * years) + Math.ceil(plan.loan / Math.max(1, termRounds))) / years),
            lock: financeLock(view.player, plan, content, world, view.round),
          },
  };
}

/** A year of the player's working life in one city, at today's prices: what comes in, what goes, and what is left. */
export interface CityYear {
  /** The rung of the career held there, or null without a career. */
  level: number | null;
  /** The player's own pay. */
  payAnnual: Cents;
  /** A partner's pay on top. */
  partnerAnnual: Cents;
  /** Income tax on the two together, at the city's rates. Tax on investments is not here: it follows what is sold. */
  taxAnnual: Cents;
  /** Living, family, insurance and upkeep. Debts are the same anywhere and are left out. */
  costAnnual: Cents;
  /** Pay after tax and after those costs. */
  leftAnnual: Cents;
  /** Status for living there. */
  prestige: number;
  /** What the player's career is paid there against the usual, in percent. 100 without a career. */
  careerPayPct: number;
}

export interface MoveQuote {
  cost: Cents;
  /** The memberships the move would end, by item id. */
  lapses: string[];
  /** The year as it is where the player lives, and as it would be on landing in the other city. */
  here: CityYear;
  there: CityYear;
  /** Rungs of the career the move would cost, until the next promotion gives them back. */
  rungsLost: number;
  /** Rounds a partner would go without pay. */
  partnerIdleRounds: number;
}

function cityYear(content: Content, p: PlayerState, world: WorldState): CityYear {
  const city = cityOf(content, p.cityId);
  const pay = indexed(ownPay(p, content), world);
  const household = indexed(p.salaryAnnual, world);
  const tax = incomeTaxAnnual(household, indexed(city.medianSalaryAnnual, world), effectiveTax(city, world).incomeRatesBp);
  const cost = livingCostAnnual(p, content, world) + indexed(p.extraExpensesAnnual, world);
  return {
    level: p.life.career ? p.life.career.level : null,
    payAnnual: pay,
    partnerAnnual: household - pay,
    taxAnnual: tax,
    costAnnual: cost,
    leftAnnual: household - tax - cost,
    prestige: city.prestige,
    careerPayPct: p.life.career ? (city.careerPayPct?.[p.life.career.id] ?? 100) : 100,
  };
}

/**
 * What a move of the player's own to a city costs, what it ends, and the year there beside the
 * year here. The year there is the player as they would land: by the rules the order then follows.
 */
export function quoteMove(content: Content, view: GameView, cityId: string): MoveQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const lapses = lapsingIn(content, p, cityId);
  const landed = structuredClone(p);
  const landing = landingOf(landed, content, false);
  landed.cityId = cityId;
  if (landed.life.career && landing.level !== null) landed.life.career.level = landing.level;
  landed.life.partnerSettling = landing.partnerSettling;
  landed.life.items = landed.life.items.filter((owned) => !lapses.includes(owned.itemId));
  refreshDerived(landed, content, view.round);
  return {
    cost: moveCost(content, world, cityOf(content, cityId), p),
    lapses,
    here: cityYear(content, p, world),
    there: cityYear(content, landed, world),
    rungsLost: landing.rungsLost,
    partnerIdleRounds: landing.partnerSettling - p.life.partnerSettling,
  };
}

export interface LoanQuote {
  /** How much more may be borrowed. Zero during the bankruptcy lock. */
  room: Cents;
  /** The yearly rate a loan taken today would carry. */
  rateBp: Bp;
  termRounds: number;
  /** The round from which banks lend again, or null when they already do. */
  lockedUntilRound: number | null;
}

export function quoteLoan(content: Content, view: GameView): LoanQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const locked = view.round < p.bankruptUntilRound;
  return {
    room: locked ? 0 : loanRoom(p, content, world),
    rateBp: personalLoanRateBp(content, world),
    termRounds: content.debt.personalLoanTermRounds,
    lockedUntilRound: locked ? p.bankruptUntilRound : null,
  };
}

export interface LivingQuote {
  /** Yearly living cost at each lifestyle tier, housed as the player is now. */
  tiers: [Cents, Cents, Cents, Cents];
  /** Yearly living cost in a rented room and in a rented flat, at the current lifestyle. Null for an owner-occupier. */
  rentTiers: [Cents, Cents] | null;
  /** The status of a rented room and of a rented flat, as of this round. */
  rentStatus: [number, number];
  /** The round from which a rented room has the status of someone no longer young, or null once it has come. */
  roomLateFromRound: number | null;
  /** The status a rented room will have from that round on. */
  roomLateStatus: number;
  /** Yearly premium of each insurance on its own, at today's prices. */
  insurance: Record<InsuranceKind, Cents>;
}

export function quoteLiving(content: Content, view: GameView): LivingQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const atTier = (lifestyleTier: LifestyleTier) => livingCostAnnual({ ...p, lifestyleTier }, content, world);
  const atRent = (rentTier: RentTier) => livingCostAnnual({ ...p, life: { ...p.life, rentTier } }, content, world);
  const living = cityOf(content, p.cityId).livingCostAnnual;
  const premium = (kind: InsuranceKind) => indexed(applyBp(living, content.life.insurancePremiumBp[kind]), world);
  return {
    tiers: [atTier(0), atTier(1), atTier(2), atTier(3)],
    rentTiers: ownsHome(p) ? null : [atRent(0), atRent(1)],
    rentStatus: rentStatusAt(content, view.round),
    roomLateFromRound: view.round < content.life.roomLateRound && content.life.roomLateRound < content.rounds ? content.life.roomLateRound : null,
    roomLateStatus: content.life.roomLateStatus,
    insurance: Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, premium(kind)])) as Record<InsuranceKind, Cents>,
  };
}

export interface WorkQuote {
  /** Every rung of the player's career, lowest first, or none without a career. */
  ladder: Array<{
    level: number;
    /** What the rung would pay this player a year, at today's prices: their own pay, with every raise and cut they carry. */
    payAnnual: Cents;
    status: number;
    /** Career skill needed to hold it. */
    minSkill: number;
  }>;
  /** The rung held now, or null without a career. */
  level: number | null;
  /** The player's own pay a year at today's prices, without a partner's. */
  payAnnual: Cents;
  skill: number;
  /** Career skill a round of work adds, and what a round of study adds on top, counting what the player owns. */
  workSkill: number;
  studySkill: number;
  /** Extra pay for a round of overtime, in percent. Zero without a career. */
  overtimePct: number;
  /** The chance in percent that a job hunt ends in a raise, counting what the player owns, and the raise. */
  jobHuntChancePct: number;
  jobHuntRaisePct: number;
  focus: { left: number; total: number; bonus: number };
  /** What the things owned add, by perk. */
  perks: Required<ItemPerks>;
  /**
   * What is particular to the career: what the economy does to its pay this round, what age does,
   * the round from which age starts to and by how much a round, and the focus it leaves over.
   * All nothing for an ordinary career.
   */
  traits: { cyclePct: number; follows: boolean; fadePct: number; fade: { fromRound: number; pctPerRound: number; maxPct: number } | null; focus: number };
}

/** The player's working life in figures: the ladder they are on and what each way of spending focus is worth to them. */
export function quoteWork(content: Content, view: GameView): WorkQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const job = p.life.career;
  const perks = perksOf(p, content);
  const career = job ? careerOf(content, job.id) : null;
  return {
    ladder: job
      ? careerOf(content, job.id).levels.map((rung, level) => ({ level, payAnnual: indexed(ownPay(p, content, level), world), status: rung.status, minSkill: rung.minSkill }))
      : [],
    level: job ? job.level : null,
    payAnnual: indexed(ownPay(p, content), world),
    skill: p.life.careerSkill,
    workSkill: content.life.workSkill,
    studySkill: content.life.studySkill + perks.studySkill,
    overtimePct: job ? careerOf(content, job.id).overtimePct : 0,
    jobHuntChancePct: jobHuntChance(content, perks),
    jobHuntRaisePct: content.life.jobHuntRaisePct,
    focus: { left: focusLeft(p), total: focusTotal(p), bonus: p.life.focusBonus },
    perks,
    traits: {
      ...careerSwing(p, content, world.regime, view.round),
      follows: career?.cyclePct !== undefined,
      fade: career?.fade ?? null,
      focus: career?.focus ?? 0,
    },
  };
}

export interface PlanQuote {
  assetId: string;
  /** What the plan buys each round. */
  amount: Cents;
  /** What it has put in so far, and in how many rounds. */
  invested: Cents;
  rounds: number;
  /** What the player holds of the asset today, however it was bought, and what all of it cost. */
  value: Cents;
  basis: Cents;
  /**
   * How far today's price stands from the average price paid, in bp of that average: above zero the
   * player bought cheaper than today on the whole, below it dearer. Null with nothing held.
   */
  priceVsAverageBp: Bp | null;
}

/** The player's standing plans to invest, each beside what it has built. */
export function quotePlans(view: GameView): PlanQuote[] {
  const p = view.player;
  return p.plans.map((plan) => {
    const held = Object.hasOwn(p.positions, plan.assetId) ? p.positions[plan.assetId] : { value: 0, basis: 0 };
    return {
      assetId: plan.assetId,
      amount: plan.amount,
      invested: plan.invested,
      rounds: plan.rounds,
      value: held.value,
      basis: held.basis,
      priceVsAverageBp: held.basis > 0 ? mulDiv(held.value - held.basis, BP, held.basis) : null,
    };
  });
}

/** The kinds of thing wealth is held in, as the portfolio is read at a glance. */
export type WealthKind = 'cash' | 'savings' | 'pension' | 'equity' | 'bond' | 'crypto' | 'gold' | 'property' | 'business' | 'things';

/** Past this share of what is invested, one holding is the player's fate: the screen says so. */
export const CONCENTRATION_PCT = 50;

export interface PortfolioQuote {
  /** Everything owned, before any debt: the whole the shares are of. */
  total: Cents;
  /** What is owned, kind by kind, largest first. Kinds with nothing in them are left out. `sharePct` is of `total`, to one decimal in bp. */
  slices: Array<{ kind: WealthKind; value: Cents; shareBp: Bp }>;
  /** What is put to work: investments, property and businesses, without cash, savings, pension or things. */
  invested: Cents;
  /**
   * The single largest thing among what is put to work, an asset, a property or a business, and
   * its share of it. Null with nothing invested. `concentrated` is true when that share is past the mark.
   */
  largest: { kind: 'asset' | 'property' | 'business'; id: string; value: Cents; shareBp: Bp } | null;
  concentrated: boolean;
  /** What each investment pays this round, and the interest the savings pay. */
  dividends: Array<{ assetId: string; amount: Cents }>;
  dividendsTotal: Cents;
  interest: Cents;
  /** True if the dividends are put back into what paid them. */
  reinvest: boolean;
}

/** The player's wealth at a glance: what it is held in, how much hangs on one thing, and what it pays this round. */
export function quotePortfolio(content: Content, view: GameView): PortfolioQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const held: Record<WealthKind, Cents> = { cash: p.cash, savings: p.deposit, pension: p.pension, equity: 0, bond: 0, crypto: 0, gold: 0, property: 0, business: 0, things: 0 };
  let largest: PortfolioQuote['largest'] = null;
  const consider = (kind: 'asset' | 'property' | 'business', id: string, value: Cents) => {
    if (largest === null || value > largest.value) largest = { kind, id, value, shareBp: 0 };
  };
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    const value = p.positions[asset.id].value;
    held[asset.class] += value;
    consider('asset', asset.id, value);
  }
  for (const property of p.properties) {
    held.property += property.value;
    consider('property', property.id, property.value);
  }
  for (const business of p.businesses) {
    held.business += business.capital;
    consider('business', business.id, business.capital);
  }
  for (const owned of p.life.items) held.things += owned.value;

  let total = 0;
  for (const value of Object.values(held)) total += value;
  const invested = held.equity + held.bond + held.crypto + held.gold + held.property + held.business;
  const share = (value: Cents, of: Cents): Bp => (of > 0 ? mulDiv(value, BP, of) : 0);
  const top = largest as PortfolioQuote['largest'];
  const dividends = dividendsByAsset(p, content, world);
  let dividendsTotal = 0;
  for (const paid of dividends) dividendsTotal += paid.amount;
  return {
    total,
    slices: (Object.keys(held) as WealthKind[])
      .filter((kind) => held[kind] > 0)
      .map((kind) => ({ kind, value: held[kind], shareBp: share(held[kind], total) }))
      .sort((a, b) => b.value - a.value),
    invested,
    largest: top ? { ...top, shareBp: share(top.value, invested) } : null,
    // One holding is no warning to someone who has only begun: it takes two things for one to weigh too much.
    concentrated: top !== null && share(top.value, invested) > CONCENTRATION_PCT * 100 && invested > top.value,
    dividends,
    dividendsTotal,
    interest: applyBp(p.deposit, depositRateBp(content, world) * content.yearsPerRound),
    reinvest: p.reinvest,
  };
}

export interface MarginQuote {
  /** Why the player may not buy with borrowed money today, or null when they may. */
  lock: RejectReason | null;
  /** The finance skill it takes. */
  minSkill: number;
  /** What the loan costs a year today. It moves with the policy rate. */
  rateBp: Bp;
  /** The most that may be owed on the holding when buying, and the share at which the broker sells it, both in percent of its value. */
  maxPct: number;
  callPct: number;
  /** What is held of the asset, and what is owed on it. */
  value: Cents;
  owed: Cents;
  /** True if a purchase may borrow as much again as is put in, as the holding stands. */
  canDouble: boolean;
  /**
   * How far the price may fall from today before the broker sells, in bp of today's price. Null
   * with nothing owed. Zero or less means the next round already has it sold unless it rises.
   */
  dropToCallBp: Bp | null;
}

/** The terms of buying an asset with borrowed money, and how the player's holding of it stands against its loan. */
export function quoteMargin(content: Content, view: GameView, assetId: string): MarginQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const value = Object.hasOwn(p.positions, assetId) ? p.positions[assetId].value : 0;
  const owed = marginOn(p, assetId)?.principal ?? 0;
  const { marginMaxPct: maxPct, marginCallPct: callPct } = content.debt;
  return {
    lock: marginLock(p, content, view.round),
    minSkill: content.debt.marginMinFinanceSkill,
    rateBp: world.policyRateBp + content.debt.marginSpreadBp,
    maxPct,
    callPct,
    value,
    owed,
    // Putting in one and borrowing one adds two to the holding and one to the loan.
    canDouble: owed * 100 <= value * maxPct,
    // The broker sells when the loan is more than `callPct` of the value: at a value of owed / callPct.
    dropToCallBp: owed > 0 && value > 0 ? BP - Math.ceil((owed * 100 * BP) / (value * callPct)) : null,
  };
}

export interface BusinessesQuote {
  /** Each business owned, with what this round makes of it as it stands and what it would sell for today. */
  owned: Array<Business & BusinessRound & { salePrice: Cents; managerPct: number }>;
  /** Each kind there is: what it asks for at today's prices, what it yields, how the economy treats it this round, and why it cannot be opened, if it cannot. */
  kinds: Array<{ typeId: string; minCapital: Cents; yieldBp: Bp; scale: Cents; cyclePct: number; managerPct: number; minFinanceSkill: number; lock: RejectReason | null }>;
  /** The most businesses there may be, and the shares of the profit that may be taken out. */
  max: number;
  payouts: number[];
  /** The focus left to give them this round. */
  focusLeft: number;
}

/** The player's businesses and the ones they could open, in the figures of this round. */
export function quoteBusinesses(content: Content, view: GameView): BusinessesQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  return {
    owned: p.businesses.map((business) => ({
      ...business,
      ...businessRound(business, content, world),
      salePrice: businessSalePrice(business, content, world),
      managerPct: businessTypeOf(content, business.typeId).managerPct,
    })),
    kinds: content.business.types.map((type) => ({
      typeId: type.id,
      minCapital: indexed(type.minCapital, world),
      yieldBp: type.yieldBp,
      scale: indexed(type.scale, world),
      cyclePct: type.cyclePct[world.regime] ?? 0,
      managerPct: type.managerPct,
      minFinanceSkill: type.minFinanceSkill,
      lock: businessLock(p, type, content),
    })),
    max: content.business.maxBusinesses,
    payouts: [...content.business.payouts],
    focusLeft: focusLeft(p),
  };
}
