import type { CardCategory, CardDef, CardOption, CardRisk, Condition, Recurring, WorldTrigger } from '@ratrace/engine';
import { usd } from '../money';

interface Spec {
  /** Relative chance of being drawn. Defaults to 10. */
  weight?: number;
  /** Rounds before the card can come back. Defaults to, and is never less than, `RESTS_AT_LEAST`, but for a world card or `soon`. */
  cooldown?: number;
  /** A card that may come back sooner than the rest, because what it tells can happen again soon: a date, a trial. */
  soon?: boolean;
  once?: boolean;
  /** A misfortune that grows likelier with age. */
  risk?: CardRisk;
  when?: Condition;
  trigger?: WorldTrigger;
}

/**
 * Rounds a personal card rests after it is dealt, at least: twenty-four years, so that one life sees most
 * of its cards once or twice and not the same few again and again. A world card tells what the world
 * did, and comes back whenever the world does it again.
 */
export const RESTS_AT_LEAST = 12;

/** One card. The first option is the default an absent player gets. */
export function card(id: string, category: CardCategory, spec: Spec, options: CardOption[]): CardDef {
  const { weight = 10, cooldown = RESTS_AT_LEAST, soon = false, ...rest } = spec;
  const rests = category === 'world' || soon || cooldown === 0 ? cooldown : Math.max(cooldown, RESTS_AT_LEAST);
  return { id, category, weight, cooldown: rests, ...rest, options };
}

/** A yearly expense or income, in dollars, for a number of rounds or for good. */
export function yearly(tag: string, kind: Recurring['kind'], dollars: number, rounds: number | null): Recurring {
  return { tag, kind, annual: usd(dollars), roundsLeft: rounds };
}

export { usd };
