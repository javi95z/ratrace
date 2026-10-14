import type { CardOption, Effects, GameLimits, Order } from './types';

/**
 * Whether an order goes against the limits a game was started under: an asset outside those
 * allowed, borrowing of any kind, a move, or property. The order is known to be well formed.
 */
export function orderBreaks(order: Order, limits: GameLimits): boolean {
  const asset = (assetId: string) => limits.onlyAssets !== undefined && !limits.onlyAssets.includes(assetId);
  switch (order.type) {
    case 'buy':
      return asset(order.assetId) || (limits.noBorrowing === true && (order.margin ?? 0) > 0);
    case 'setPlan':
      return order.amount !== 0 && asset(order.assetId);
    case 'borrow':
      return limits.noBorrowing === true;
    case 'buyProperty':
      return limits.noProperty === true || (limits.noBorrowing === true && order.mortgage !== 'none');
    case 'buyItem':
      return limits.noBorrowing === true && order.financed === true;
    case 'moveCity':
      return limits.noMoving === true;
    default:
      return false;
  }
}

function effectsBreak(effects: Effects | undefined, limits: GameLimits): boolean {
  if (effects === undefined) return false;
  if (effects.invest !== undefined && limits.onlyAssets !== undefined && !limits.onlyAssets.includes(effects.invest.assetId)) return true;
  if (effects.property !== undefined && (limits.noProperty === true || (limits.noBorrowing === true && effects.property.downPct < 100))) return true;
  if (effects.loan !== undefined && limits.noBorrowing === true) return true;
  return effects.moveCity !== undefined && limits.noMoving === true;
}

/** Whether a card option could do what the limits forbid, in its own effects or in any outcome the dice may give it. */
export function optionBreaks(option: CardOption, limits: GameLimits): boolean {
  return effectsBreak(option.effects, limits) || (option.outcomes ?? []).some((outcome) => effectsBreak(outcome.effects, limits));
}
