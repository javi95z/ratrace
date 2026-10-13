import { loanRoom } from './debt';
import { livingCostAnnual } from './economy';
import { INSURANCE_KINDS } from './life/derive';
import { canSellItem, itemTerms, lapsingIn, moveCost, soldIn } from './life/orders';
import { cityOf, itemOf } from './lookup';
import { applyBp } from './money';
import type { Bp, Cents } from './money';
import { ownsHome, propertyTerms, rentalOnly, rentYieldBp } from './property';
import type { PropertyTerms } from './property';
import { indexed } from './rates';
import type { Content, GameView, InsuranceKind, LifestyleTier, RentTier } from './types';

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

export interface ItemQuote {
  price: Cents;
  /** What it would sell for: its value now if owned, or its value the moment it is bought. */
  resale: Cents;
  /** Yearly upkeep at today's prices. */
  upkeepAnnual: Cents;
  owned: boolean;
  /** False for something only a card can give. */
  forSale: boolean;
  /** False where the shops of the player's city do not sell it. */
  soldHere: boolean;
  /** True for a membership of certain cities only: it ends the day the player moves out of them. */
  local: boolean;
  /** True if the player owns it and may sell or cancel it. False for an experience already spent and for what only a card gives. */
  sellable: boolean;
}

export function quoteItem(content: Content, view: GameView, itemId: string): ItemQuote {
  const item = itemOf(content, itemId);
  const world = view.timeline[view.round];
  const held = view.player.life.items.find((owned) => owned.itemId === itemId);
  const terms = itemTerms(item, world);
  return {
    price: terms.price,
    resale: held ? held.value : terms.resale,
    upkeepAnnual: indexed(item.upkeepAnnual, world),
    owned: held !== undefined,
    forSale: item.cardOnly !== true,
    soldHere: soldIn(item, view.player.cityId),
    local: item.kind === 'membership' && item.cities !== undefined,
    sellable: held !== undefined && canSellItem(content, held),
  };
}

export function quoteMove(content: Content, view: GameView, cityId: string): { cost: Cents; lapses: string[] } {
  return {
    cost: moveCost(content, view.timeline[view.round], cityOf(content, cityId)),
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
    rateBp: world.policyRateBp + content.debt.personalLoanSpreadBp,
    termRounds: content.debt.personalLoanTermRounds,
    lockedUntilRound: locked ? p.bankruptUntilRound : null,
  };
}

export interface LivingQuote {
  /** Yearly living cost at each lifestyle tier, housed as the player is now. */
  tiers: [Cents, Cents, Cents, Cents];
  /** Yearly living cost in a rented room and in a rented flat, at the current lifestyle. Null for an owner-occupier. */
  rentTiers: [Cents, Cents] | null;
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
    insurance: Object.fromEntries(INSURANCE_KINDS.map((kind) => [kind, premium(kind)])) as Record<InsuranceKind, Cents>,
  };
}
