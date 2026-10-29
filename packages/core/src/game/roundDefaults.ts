import { previewRound } from '@ratrace/engine';
import type { Content, GameView, Order } from '@ratrace/engine';
import { rulesKnow } from './rules';

/**
 * The orders a round's basket starts with, the first time the player comes to its finances: each business the owner
 * could run this round is run by them, rather than left to nobody. Only a business with no manager, not run full time
 * and not already run this round; the one with the most in it first, since a business left alone loses a share of what
 * is in it, as many as the round's focus allows. The engine's own preview judges each one: what it would refuse is left out.
 * The player sees them in the basket as any other order, and takes out what they do not want.
 */
export function roundDefaults(content: Content, view: GameView, rules: string): Order[] {
  if (view.finished || view.phase !== 'finance' || !rulesKnow(rules, 'tendBusiness')) return [];
  const idle = view.player.businesses
    .map((business, at) => ({ business, at }))
    .filter(({ business }) => !business.manager && business.fullTime !== true && !business.tended)
    // The largest first; two of the same size in the order they are listed.
    .sort((a, b) => b.business.capital - a.business.capital || a.at - b.at);
  const orders: Order[] = [];
  for (const { business } of idle) {
    const tried: Order[] = [...orders, { type: 'tendBusiness', businessId: business.id }];
    if (previewRound(content, view, { orders: tried }).rejected.length === 0) orders.push(tried[tried.length - 1]);
  }
  return orders;
}
