import { mulDiv } from './money';
import type { Bp, Cents } from './money';
import type { AssetDef, Content, WorldState } from './types';

/** Starting value of every asset and property price index. Large, so an asset that loses 95% many times still moves. */
export const INDEX_START = 100_000_000;

/** Starting value of the price level that wages and living costs follow. */
export const PRICE_LEVEL_START = 1_000_000;

/** Converts an amount in start-of-game dollars to the dollars of the given world. */
export function indexed(amount: Cents, world: WorldState): Cents {
  return mulDiv(amount, world.priceLevel, PRICE_LEVEL_START);
}

/** Annual income yield of an asset, in bp. A bond pays the policy rate plus its spread. */
export function assetYieldBp(asset: AssetDef, world: WorldState): Bp {
  if (asset.class === 'bond') return Math.max(0, world.policyRateBp + (asset.yieldSpreadBp ?? 0));
  return asset.yieldBp;
}

/** Annual deposit rate, in bp. */
export function depositRateBp(content: Content, world: WorldState): Bp {
  return Math.max(0, world.policyRateBp - content.market.depositSpreadBp);
}
