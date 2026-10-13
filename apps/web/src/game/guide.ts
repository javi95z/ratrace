import type { Stage } from './store';

/** What the guide looks at to decide which tip is due. */
export interface GuideFacts {
  stage: Stage;
  round: number;
  /** Tips already shown. */
  seen: readonly string[];
  /** True once the player has turned the guide off. */
  off: boolean;
  livesFinished: number;
  /** True if the player holds, or has in this round's orders, savings or an investment. */
  hasInvested: boolean;
}

interface Tip {
  id: string;
  stage: Stage;
  /** The first round the tip may show in. */
  fromRound: number;
  /** A tip that is no use to someone who has already done what it suggests. */
  unless?: (facts: GuideFacts) => boolean;
}

/**
 * The tips of a first life, in the order they are offered. The first four explain a stage of the
 * round the first time it is reached; the rest wait for a later round, so that nobody is taught
 * everything at once.
 */
export const TIPS: readonly Tip[] = [
  { id: 'news', stage: 'news', fromRound: 0 },
  { id: 'cards', stage: 'cards', fromRound: 0 },
  { id: 'finance', stage: 'finance', fromRound: 0 },
  { id: 'ledger', stage: 'resolve', fromRound: 0 },
  { id: 'ratRace', stage: 'news', fromRound: 1 },
  { id: 'invest', stage: 'finance', fromRound: 1, unless: (facts) => facts.hasInvested },
  { id: 'focus', stage: 'finance', fromRound: 1 },
  { id: 'flow', stage: 'finance', fromRound: 2 },
];

/**
 * The tip to show now, or null. A first life is guided, one tip a visit to a stage, each tip once.
 * A stage's own tip comes before the ones that wait. Someone who has finished a life, or turned
 * the guide off, sees none.
 */
export function nextTip(facts: GuideFacts): string | null {
  if (facts.off || facts.livesFinished > 0) return null;
  const due = TIPS.find((tip) => tip.stage === facts.stage && facts.round >= tip.fromRound && !facts.seen.includes(tip.id) && !tip.unless?.(facts));
  return due ? due.id : null;
}
