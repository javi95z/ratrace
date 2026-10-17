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
  /** What is new in the life as it stands, for the notes of a first time. Left out, none is due. */
  firsts?: FirstFacts;
}

/** What the notes of a first time look for: a crisis on, a debt of each costly kind, and half the way out. */
export interface FirstFacts {
  crisis: boolean;
  creditCard: boolean;
  mortgage: boolean;
  margin: boolean;
  halfway: boolean;
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
  { id: 'debt', stage: 'finance', fromRound: 2 },
  { id: 'rivals', stage: 'news', fromRound: 2 },
  { id: 'property', stage: 'finance', fromRound: 3 },
  { id: 'business', stage: 'finance', fromRound: 4 },
  { id: 'move', stage: 'finance', fromRound: 5 },
  { id: 'workMode', stage: 'finance', fromRound: 6 },
  { id: 'taxes', stage: 'finance', fromRound: 7 },
];

/**
 * Notes of a first time: said once, the first time a costly or decisive thing turns up in any life,
 * however many lives the player has finished, on the stage where it matters. Each once, ever.
 */
export const FIRSTS: ReadonlyArray<{ id: string; stage: Stage; when: (facts: FirstFacts) => boolean }> = [
  { id: 'firstCrisis', stage: 'news', when: (facts) => facts.crisis },
  { id: 'firstCard', stage: 'finance', when: (facts) => facts.creditCard },
  { id: 'firstMargin', stage: 'finance', when: (facts) => facts.margin },
  { id: 'firstMortgage', stage: 'finance', when: (facts) => facts.mortgage },
  { id: 'firstHalfway', stage: 'finance', when: (facts) => facts.halfway },
];

/** True for the id of a note of a first time, rather than a tip of the first life. */
export const isFirst = (id: string): boolean => FIRSTS.some((first) => first.id === id);

/**
 * The round from which each tab of the money is on screen in a guided first life: the first round
 * shows what a first round needs, and the rest come as their tips do, so nothing is learnt all at once.
 */
export const TAB_FROM_ROUND: Readonly<Record<string, number>> = { portfolio: 0, market: 0, lifestyle: 0, shop: 0, debt: 2, taxes: 2, property: 3, business: 4 };

/**
 * The tip to show now, or null. A first life is guided, one tip a visit to a stage, each tip once.
 * A stage's own tip comes before the ones that wait. Someone who has finished a life, or turned
 * the guide off, sees none.
 */
export function nextTip(facts: GuideFacts): string | null {
  if (facts.off) return null;
  const due = facts.livesFinished > 0 ? undefined : TIPS.find((tip) => tip.stage === facts.stage && facts.round >= tip.fromRound && !facts.seen.includes(tip.id) && !tip.unless?.(facts));
  if (due) return due.id;
  // Past the tips of the first life, or between them: the first time of something that matters.
  const { firsts } = facts;
  const first = firsts ? FIRSTS.find((each) => each.stage === facts.stage && !facts.seen.includes(each.id) && each.when(firsts)) : undefined;
  return first ? first.id : null;
}
