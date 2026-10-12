import { coverShortfall } from '../debt';
import { cardOf } from '../lookup';
import type { Cents } from '../money';
import type { Rng } from '../rng';
import type { CardDef, CardPicks, Content, GameEvent, GameState, GameView, PlayerState } from '../types';
import { conditionHolds } from './conditions';
import type { Situation } from './conditions';
import { applyEffects } from './effects';
import { focusLeft } from './orders';

const situationOf = (content: Content, state: GameView): Situation => ({
  content,
  world: state.timeline[state.round],
  round: state.round,
});

/**
 * True if the player may take this option. The first option is always open.
 * Any other needs its condition to hold, enough focus, and enough cash and savings for its fixed
 * effects. Rolled outcomes are never checked: they are the risk the player takes.
 */
export function optionAvailable(p: PlayerState, card: CardDef, index: number, at: Situation): boolean {
  if (index === 0) return true;
  const option = card.options[index];
  if (!conditionHolds(option.when, p, at)) return false;
  const effects = option.effects;
  if (effects === undefined) return true;
  if ((effects.focus ?? 0) > focusLeft(p)) return false;
  const item = effects.buyItem;
  if (item !== undefined && p.life.items.some((owned) => owned.itemId === item.itemId)) return false;
  // No bank lends during the bankruptcy lock, through a card or otherwise.
  const borrows = effects.loan !== undefined || (effects.property !== undefined && effects.property.downPct < 100);
  if (borrows && at.round < p.bankruptUntilRound) return false;

  const trial = structuredClone(p);
  applyEffects(trial, effects, at);
  const means = trial.cash + trial.deposit;
  return means >= 0 || means >= p.cash + p.deposit;
}

/**
 * Draws the hand for the round the state is at: the world card of the round if it concerns the
 * player, then personal cards picked by weight from those that are open to them.
 */
export function drawHand(state: GameState, content: Content, rng: Rng): string[] {
  const p = state.player;
  const at = situationOf(content, state);
  const seen = p.life.seen;
  const hand: string[] = [];

  const eventId = at.world.eventCardId;
  const event = eventId === null ? undefined : content.cards.find((card) => card.id === eventId);
  if (event && conditionHolds(event.when, p, at)) hand.push(event.id);

  const pool: Array<[string, number]> = [];
  for (const card of content.cards) {
    if (card.category === 'world') continue;
    if (Object.hasOwn(seen, card.id) && (card.once === true || state.round - seen[card.id] <= card.cooldown)) continue;
    if (conditionHolds(card.when, p, at)) pool.push([card.id, card.weight]);
  }
  for (let i = 0; i < content.life.cardsPerRound && pool.length > 0; i++) {
    const id = rng.pickWeighted(pool);
    hand.push(id);
    pool.splice(pool.findIndex(([candidate]) => candidate === id), 1);
  }

  for (const id of hand) seen[id] = state.round;
  return hand;
}

/**
 * Answers every card in the hand, in order. A card with no pick, a malformed pick or a locked
 * option gets its first option. Then any shortfall is covered from the deposit and the credit card.
 */
export function answerCards(state: GameState, content: Content, picks: CardPicks, rng: Rng, events: GameEvent[]): void {
  const p = state.player;
  const at = situationOf(content, state);

  for (const cardId of state.hand) {
    const card = cardOf(content, cardId);
    const raw: unknown = Object.hasOwn(picks, cardId) ? picks[cardId] : undefined;
    const picked = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < card.options.length ? raw : null;
    const index = picked !== null && optionAvailable(p, card, picked, at) ? picked : 0;
    const option = card.options[index];

    const before = p.cash;
    applyEffects(p, option.effects, at);
    let outcome: number | null = null;
    if (option.outcomes !== undefined && option.outcomes.length > 0) {
      outcome = rng.pickWeighted(option.outcomes.map((o, i) => [i, o.weight] as const));
      applyEffects(p, option.outcomes[outcome].effects, at);
    }
    events.push({ kind: 'card', cardId, picked, option: index, outcome, cash: p.cash - before });
  }

  const covered = coverShortfall(p);
  if (covered.fromDeposit !== 0) events.push({ kind: 'ledger', line: 'depositDraw', amount: covered.fromDeposit });
  if (covered.drawn !== 0) events.push({ kind: 'ledger', line: 'creditCardDraw', amount: covered.drawn });
}

export interface OptionPreview {
  available: boolean;
  /** Change in cash from the fixed effects of the option. */
  cash: Cents;
  /** One entry per outcome that may be rolled: its weight, and the further change in cash it brings. */
  outcomes: Array<{ weight: number; cash: Cents }>;
}

/** What each option of a card in the hand would do to the player's cash, and whether it is open. A view is all it needs. */
export function previewCard(content: Content, state: GameView, cardId: string): OptionPreview[] {
  if (!state.hand.includes(cardId)) throw new Error(`previewCard: ${cardId} is not in the hand`);
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
    return { available: optionAvailable(p, card, index, at), cash: fixed.cash - p.cash, outcomes };
  });
}
