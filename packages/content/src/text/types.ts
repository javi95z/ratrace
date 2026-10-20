import type { AssetClass, CardCategory, CryptoPhase, DebtKind, FocusAction, InsuranceKind, LedgerLine, OptionLock, Regime, RejectReason, SkillId, Trend } from '@ratrace/engine';
import type { BadgeGroup } from '../badges';

/**
 * What the famous say of the coming round. Each line says the same as the plain headline it stands
 * for: crypto by its phase, an investment ({asset}) or homes in a city ({city}) going up or down,
 * prices rising.
 */
export interface CelebHeadlines {
  mosk: { bull: string; mania: string; up: string; down: string };
  nakamoro: { accumulation: string; winter: string };
  bufe: { up: string; down: string };
  bozos: { up: string; down: string };
  zuckerbot: { up: string; down: string };
  ortiga: { up: string; down: string };
  kardashion: { up: string; down: string };
  poutine: { up: string; down: string; inflation: string };
  grump: { up: string; down: string };
}

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
  /** Each career, its rungs, and what its uses of focus at work are called in it: the same rules, in the words of that job. */
  careers: Record<string, { name: string; levels: string[]; focus: Record<'overtime' | 'studyCareer' | 'jobHunt' | 'askRaise', string>; /** Each move of the career: its name, what it is, and a line for each of its outcomes, in their order. */ moves?: Record<string, { name: string; about: string; outcomes: string[] }> }>;
  ladders: Record<string, string>;
  propertyTypes: Record<string, string>;
  rentTiers: [string, string];
  lifestyleTiers: [string, string, string, string];
  insurance: Record<InsuranceKind, string>;
  focusActions: Record<FocusAction, string>;
  /** What each kind of home is called in each city, by city and kind. A kind a city does not name goes by `propertyTypes`. */
  cityHomes: Record<string, Record<string, string>>;
  /** The skills beyond the career and Finance, by name. */
  skills: Record<SkillId, string>;
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
    /** Each said a few ways, so the same forecast does not read the same every round. */
    regime: Record<Regime, string[]>;
    crypto: Record<CryptoPhase, string[]>;
    rates: Record<Trend, string[]>;
    inflation: Record<Trend, string[]>;
    property: Record<'up' | 'down', string[]>;
    /** With {asset}, the investment's name. */
    asset: Record<'up' | 'down', string[]>;
    /** With {city}. */
    taxes: Record<Trend, string[]>;
    /** Some of the same news said by one of the famous, as `headlineVoice` picks them: {asset} and {city} as above. */
    celebs: CelebHeadlines;
    /** Filler that tells nothing of what is coming, as many as `world.noiseHeadlines`. */
    noise: string[];
    /** The government at work, as many as `world.governmentHeadlines`. */
    government: string[];
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
