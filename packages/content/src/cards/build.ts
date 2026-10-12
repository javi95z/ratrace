import type { CardCategory, CardDef, CardOption, Condition, Recurring, WorldTrigger } from '@ratrace/engine';
import { usd } from '../money';

interface Spec {
  /** Relative chance of being drawn. Defaults to 10. */
  weight?: number;
  /** Rounds before the card can come back. Defaults to 4, which is eight years. */
  cooldown?: number;
  once?: boolean;
  when?: Condition;
  trigger?: WorldTrigger;
}

/** One card. The first option is the default an absent player gets. */
export function card(id: string, category: CardCategory, spec: Spec, options: CardOption[]): CardDef {
  const { weight = 10, cooldown = 4, ...rest } = spec;
  return { id, category, weight, cooldown, ...rest, options };
}

/** A yearly expense or income, in dollars, for a number of rounds or for good. */
export function yearly(tag: string, kind: Recurring['kind'], dollars: number, rounds: number | null): Recurring {
  return { tag, kind, annual: usd(dollars), roundsLeft: rounds };
}

export { usd };
