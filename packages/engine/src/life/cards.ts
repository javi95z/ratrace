import { coverShortfall } from '../debt';
import { optionBreaks } from '../limits';
import { cardOf } from '../lookup';
import type { Cents } from '../money';
import type { Rng } from '../rng';
import type { CardDef, CardPicks, Content, GameEvent, GameState, GameView, OptionLock, PlayerState } from '../types';
import { conditionHolds } from './conditions';
import type { Situation } from './conditions';
import { pctStepAt } from './derive';
import { applyEffects } from './effects';
import { focusLeft } from './orders';
import { skillLevel, tradeSkillLevel } from './skills';
import { ownedOutsidePension, totalOwed } from '../solvency';

const situationOf = (content: Content, state: GameView): Situation => ({
  content,
  world: state.timeline[state.round],
  round: state.round,
  limits: state.limits,
});

/**
 * Why the player may not take an option, or null if they may. The first option is always open.
 * Any other needs its condition to hold, enough focus, and enough cash and savings for its fixed
 * effects. Rolled outcomes are never checked: they are the risk the player takes.
 */
export function optionLock(p: PlayerState, card: CardDef, index: number, at: Situation): OptionLock | null {
  if (index === 0) return null;
  const option = card.options[index];
  // What the game was started without is closed on a card too, whatever the dice would have made of it.
  if (at.limits !== undefined && optionBreaks(option, at.limits)) return 'challenge';
  if (!conditionHolds(option.when, p, at)) {
    // Said apart when only a skill stands in the way: it is the one thing the player can work towards.
    const { minSkills, ...rest } = option.when ?? {};
    return minSkills !== undefined && conditionHolds(rest, p, at) ? 'skill' : 'condition';
  }
  // No bank lends during the bankruptcy lock, through a card or otherwise, and no bank takes a bankrupt as a guarantor.
  const all = [option.effects ?? {}, ...(option.outcomes ?? []).map((outcome) => outcome.effects)];
  const borrows = all.some((e) => e.loan !== undefined || (e.property !== undefined && e.property.downPct < 100));
  if (borrows && at.round < p.bankruptUntilRound) return 'bankruptcy';

  const effects = option.effects;
  if (effects === undefined) return null;
  if ((effects.focus ?? 0) > focusLeft(p)) return 'focus';
  const item = effects.buyItem;
  if (item !== undefined && p.life.items.some((owned) => owned.itemId === item.itemId)) return 'owned';

  const trial = structuredClone(p);
  applyEffects(trial, effects, at);
  if (trial.cash + trial.deposit < 0) return 'cash';
  // The pension is protected in bankruptcy, so a card may not fill it for someone who owes more than they own.
  if (effects.pension !== undefined && ownedOutsidePension(trial) < totalOwed(trial)) return 'insolvent';
  return null;
}

/** True if the player may take this option. */
export function optionAvailable(p: PlayerState, card: CardDef, index: number, at: Situation): boolean {
  return optionLock(p, card, index, at) === null;
}

/**
 * Draws the hand for the round the state is at: the world card of the round if it concerns the
 * player, then personal cards picked by weight from those that are open to them.
 */
export function drawHand(state: GameState, content: Content, rng: Rng): string[] {
  const p = state.player;
  const at = situationOf(content, state);
  const hand: string[] = [];

  const eventId = at.world.eventCardId;
  const event = eventId === null ? undefined : content.cards.find((card) => card.id === eventId);
  if (event && conditionHolds(event.when, p, at)) hand.push(event.id);

  const pool = openCards(state, content, at);
  for (let i = 0; i < content.life.cardsPerRound && pool.length > 0; i++) {
    const id = rng.pickWeighted(pool);
    hand.push(id);
    pool.splice(pool.findIndex(([candidate]) => candidate === id), 1);
  }

  for (const id of hand) p.life.seen[id] = state.round;
  return hand;
}

/**
 * How likely a card is to be dealt. A misfortune of the body or of work grows likelier with age, and
 * less likely with the skill that guards against it: health for the body, and for work the best of the
 * skills the player's own career practises. Never below one, so nothing that can happen is ruled out.
 */
export function weightOf(card: CardDef, p: PlayerState, content: Content, round: number): number {
  if (card.risk === undefined) return card.weight;
  const rules = content.life;
  const aged = pctStepAt(rules.riskByAge[card.risk], round);
  const off =
    card.risk === 'health'
      ? skillLevel(p, 'health', content) * rules.skills.healthRiskOffPct
      : card.risk === 'scam'
        ? p.life.financeSkill * rules.skills.scamRiskOffPct
        : tradeSkillLevel(p, content) * rules.skills.jobRiskOffPct;
  return Math.max(1, Math.round((card.weight * aged * Math.max(0, 100 - off)) / 10_000));
}

/**
 * True where a card belongs where the player is: cards of prison inside, every other card outside;
 * and never a card that offers to sell the player something they already own.
 */
function belongs(card: CardDef, p: PlayerState): boolean {
  if (card.options.some((option) => option.effects?.buyItem !== undefined && p.life.items.some((owned) => owned.itemId === option.effects?.buyItem?.itemId))) return false;
  return (card.when?.inJail === true) === p.life.jailRounds > 0;
}

/**
 * The personal cards that could be dealt to the player as they stand: those whose condition holds
 * and that are not resting after a recent appearance, each with its weight. A card of the hand is
 * resting from the moment it is dealt, so it is never dealt twice in a round.
 */
function openCards(state: GameState, content: Content, at: Situation, rested = false): Array<[string, number]> {
  const p = state.player;
  const seen = p.life.seen;
  const pool: Array<[string, number]> = [];
  for (const card of content.cards) {
    if (card.category === 'world') continue;
    if (Object.hasOwn(seen, card.id)) {
      const since = state.round - seen[card.id];
      // With `rested`, a card still resting may come back early, but never one of this very round, nor one that comes once in a life.
      if (card.once === true || since === 0 || (!rested && since <= card.cooldown)) continue;
    }
    if (belongs(card, p) && conditionHolds(card.when, p, at)) pool.push([card.id, weightOf(card, p, content, state.round)]);
  }
  return pool;
}

/**
 * Sees to it that the card now waiting still makes sense. The hand is dealt when the round opens,
 * and a card answered since may have changed the life it was dealt for: someone who has just
 * retired must not be asked about their boss. A card whose condition no longer holds is taken out
 * as if it had never been dealt, so it may come back another round, and another that is open to
 * the player is dealt in its place. A round keeps its number of cards if it possibly can: where
 * no card is open, one that is still resting is called back early, and only when even that fails
 * is the hand a card shorter.
 */
function settleHand(state: GameState, content: Content, rng: Rng, events: GameEvent[]): void {
  const p = state.player;
  const at = situationOf(content, state);
  while (state.answered < state.hand.length) {
    const waiting = cardOf(content, state.hand[state.answered]);
    if (belongs(waiting, p) && conditionHolds(waiting.when, p, at)) return;
    delete p.life.seen[waiting.id];
    let pool = openCards(state, content, at);
    if (pool.length === 0) pool = openCards(state, content, at, true);
    if (pool.length === 0) {
      state.hand.splice(state.answered, 1);
      events.push({ kind: 'cardWithdrawn', cardId: waiting.id, replacedBy: null });
      continue;
    }
    const id = rng.pickWeighted(pool);
    state.hand[state.answered] = id;
    p.life.seen[id] = state.round;
    events.push({ kind: 'cardWithdrawn', cardId: waiting.id, replacedBy: id });
    return;
  }
}

/**
 * Answers the next card of the hand. No pick, a malformed pick or a locked option gets the first
 * option. A shortfall the card leaves is covered at once, from the deposit and then the credit card,
 * so the game is sound between one card and the next and the next card is judged as the player now stands.
 * The card that then waits is checked too: if this answer made it senseless, it is withdrawn.
 */
export function answerNext(state: GameState, content: Content, pick: unknown, rng: Rng, events: GameEvent[]): void {
  const p = state.player;
  const at = situationOf(content, state);
  const card = cardOf(content, state.hand[state.answered]);
  const picked = typeof pick === 'number' && Number.isInteger(pick) && pick >= 0 && pick < card.options.length ? pick : null;
  const index = picked !== null && optionAvailable(p, card, picked, at) ? picked : 0;
  const option = card.options[index];

  const before = p.cash;
  applyEffects(p, option.effects, at);
  let outcome: number | null = null;
  if (option.outcomes !== undefined && option.outcomes.length > 0) {
    outcome = rng.pickWeighted(option.outcomes.map((o, i) => [i, o.weight] as const));
    applyEffects(p, option.outcomes[outcome].effects, at);
  }
  events.push({ kind: 'card', cardId: card.id, picked, option: index, outcome, cash: p.cash - before });

  const covered = coverShortfall(p);
  if (covered.fromDeposit !== 0) events.push({ kind: 'ledger', line: 'depositDraw', amount: covered.fromDeposit });
  if (covered.drawn !== 0) events.push({ kind: 'ledger', line: 'creditCardDraw', amount: covered.drawn });
  state.answered += 1;
  settleHand(state, content, rng, events);
}

/** Answers every card still waiting, in order, with the pick given for each. */
export function answerRest(state: GameState, content: Content, picks: CardPicks, rng: Rng, events: GameEvent[]): void {
  while (state.answered < state.hand.length) {
    const cardId = state.hand[state.answered];
    answerNext(state, content, Object.hasOwn(picks, cardId) ? picks[cardId] : undefined, rng, events);
  }
}

export interface OptionPreview {
  available: boolean;
  /** Why the option is closed to this player, or null when it is open. */
  lock: OptionLock | null;
  /** Change in cash from the fixed effects of the option. */
  cash: Cents;
  /** One entry per outcome that may be rolled: its weight, and the further change in cash it brings. */
  outcomes: Array<{ weight: number; cash: Cents }>;
}

/**
 * What each option of a card still waiting would do to the player's cash, and whether it is open.
 * It judges the card as the player stands now, so it is exact for the next card to answer. A view is all it needs.
 */
export function previewCard(content: Content, state: GameView, cardId: string): OptionPreview[] {
  const position = state.hand.indexOf(cardId);
  if (position < 0) throw new Error(`previewCard: ${cardId} is not in the hand`);
  if (position < state.answered) throw new Error(`previewCard: ${cardId} is already answered`);
  const card = cardOf(content, cardId);
  const at = situationOf(content, state);
  const p = state.player;

  return card.options.map((option, index) => {
    const fixed = structuredClone(p);
    applyEffects(fixed, option.effects, at);
    const outcomes = (option.outcomes ?? []).map((outcome) => {
      const rolled = structuredClone(fixed);
      applyEffects(rolled, outcome.effects, at);
      return { weight: outcome.weight, cash: rolled.cash - fixed.cash };
    });
    const lock = optionLock(p, card, index, at);
    return { available: lock === null, lock, cash: fixed.cash - p.cash, outcomes };
  });
}
