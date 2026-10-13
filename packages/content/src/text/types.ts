import type {
  AssetClass,
  CardCategory,
  CryptoPhase,
  DebtKind,
  FocusAction,
  InsuranceKind,
  LedgerLine,
  OptionLock,
  Regime,
  RejectReason,
  Trend,
} from '@ratrace/engine';
import type { BadgeGroup } from '../badges';

export interface CardText {
  title: string;
  body: string;
  /**
   * One entry per option of the card, each with one line per outcome it can roll. An option the
   * dice do not decide has instead `after`: what follows from choosing it, in a sentence.
   */
  options: Array<{ label: string; outcomes: string[]; after?: string }>;
}

/**
 * Every sentence the content needs, in one language. Names of brands, companies, coins and places
 * are not here: they come from the name pack, and text refers to them with placeholders.
 */
export interface ContentText {
  cities: Record<string, { tagline: string }>;
  assets: Record<string, { blurb: string }>;
  assetClasses: Record<AssetClass, string>;
  careers: Record<string, { name: string; levels: string[] }>;
  ladders: Record<string, string>;
  propertyTypes: Record<string, string>;
  rentTiers: [string, string];
  lifestyleTiers: [string, string, string, string];
  insurance: Record<InsuranceKind, string>;
  focusActions: Record<FocusAction, string>;
  debts: Record<DebtKind, string>;
  lives: Record<string, { name: string; perk: string; handicap: string; unlock: string }>;
  /** A crisis: its name, what it is in two lines, and one line for each of its rounds. */
  crises: Record<string, { name: string; intro: string; years: string[] }>;
  categories: Record<CardCategory, string>;
  cards: Record<string, CardText>;
  regimes: Record<Regime, string>;
  cryptoPhases: Record<CryptoPhase, string>;
  /** Headlines. The property ones contain {city}, which the interface fills in. */
  headlines: {
    regime: Record<Regime, string>;
    crypto: Record<CryptoPhase, string>;
    rates: Record<Trend, string>;
    inflation: Record<Trend, string>;
    property: Record<'up' | 'down', string>;
  };
  /** Badges: what each is called, and how it is earned. */
  badges: Record<string, { name: string; how: string }>;
  badgeGroups: Record<BadgeGroup, string>;
  /** Why a card option is closed to the player. */
  optionLocks: Record<OptionLock, string>;
  /** Why an order was refused. */
  /** Every kind of business: its name and what owning one is like. */
  businessTypes: Record<string, { name: string; blurb: string }>;
  reasons: Record<RejectReason, string>;
  ledger: Record<LedgerLine, string>;
}

type OptionText = string | [label: string, ...outcomes: string[]];

/** A card's text. An option is its label, or its label followed by one line per outcome. */
export function c(title: string, body: string, options: OptionText[]): CardText {
  return {
    title,
    body,
    options: options.map((option) =>
      typeof option === 'string' ? { label: option, outcomes: [] } : { label: option[0], outcomes: option.slice(1) },
    ),
  };
}
