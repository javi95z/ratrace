import { quoteMargin } from '@ratrace/engine';
import type { Content, GameView, RoundPreview } from '@ratrace/engine';

/**
 * A mistake the round is about to make that costs dearly, said before it is played: cash that runs
 * out and goes onto the credit card, or a holding bought on margin a small fall away from being sold.
 */
export type RoundWarning = { kind: 'card'; amount: number; rateBp: number } | { kind: 'margin'; assetId: string; dropBp: number };

/** A margin loan this close to its forced sale, as a share of the way there, is worth a word. */
const MARGIN_NEAR = 0.85;

/** What to warn of before the round is played with these orders, the costliest first. None for a round that is fine. */
export function roundWarnings(content: Content, view: GameView, preview: RoundPreview): RoundWarning[] {
  const warnings: RoundWarning[] = [];
  // The savings cover a shortfall first; what they do not, goes on the card.
  const short = -preview.cashAfter - preview.player.deposit;
  if (short > 0) warnings.push({ kind: 'card', amount: short, rateBp: content.debt.creditCardRateBp });
  const after = { ...view, player: preview.player };
  for (const debt of preview.player.debts) {
    if (debt.kind !== 'margin' || !debt.forAsset) continue;
    const margin = quoteMargin(content, after, debt.forAsset);
    if (margin.owed === 0 || margin.value <= 0 || margin.dropToCallBp === null) continue;
    const way = (margin.owed * 100) / (margin.value * margin.callPct);
    if (way >= MARGIN_NEAR) warnings.push({ kind: 'margin', assetId: debt.forAsset, dropBp: Math.max(0, margin.dropToCallBp) });
  }
  return warnings;
}
