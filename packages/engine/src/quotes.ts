import { debtRateBp, loanRoom, personalLoanRateBp } from './debt';
import { livingCostAnnual } from './economy';
import { homeOf, INSURANCE_KINDS, ownPay, perksOf, rentStatusAt } from './life/derive';
import { canSellItem, financeLock, focusLeft, focusTotal, itemFinance, itemTerms, lapsingIn, moveCost, soldIn } from './life/orders';
import { jobHuntChance } from './life/roundEnd';
import { careerOf, cityOf, itemOf, propertyTypeOf } from './lookup';
import { applyBp } from './money';
import type { Bp, Cents } from './money';
import { ownsHome, propertyTerms, rentalOnly, rentYieldBp } from './property';
import type { PropertyTerms } from './property';
import { indexed } from './rates';
import type { Content, GameView, InsuranceKind, ItemPerks, LifestyleTier, RejectReason, RentTier } from './types';

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

export function quoteMove(content: Content, view: GameView, cityId: string): { cost: Cents; lapses: string[] } {
  return {
    cost: moveCost(content, view.timeline[view.round], cityOf(content, cityId), view.player),
    // The memberships the move would end, by item id.
    lapses: lapsingIn(content, view.player, cityId),
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
}

/** The player's working life in figures: the ladder they are on and what each way of spending focus is worth to them. */
export function quoteWork(content: Content, view: GameView): WorkQuote {
  const p = view.player;
  const world = view.timeline[view.round];
  const job = p.life.career;
  const perks = perksOf(p, content);
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
  };
}
