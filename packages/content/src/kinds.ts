/**
 * How the game groups assets. Index funds are equities in the engine, but a player thinks of
 * them apart from single stocks.
 *
 * This is a rule, not a picture: the badges are judged by it, on the server too. It lives apart
 * from the art so that the server's copy of the game holds no art, and a new drawing is not a new
 * version of the rules.
 */
export type AssetKind = 'fund' | 'bond' | 'stock' | 'crypto' | 'gold';

const FUNDS: ReadonlySet<string> = new Set(['sp500', 'msci_world']);

export function assetKind(asset: { id: string; class: 'bond' | 'equity' | 'crypto' | 'gold' }): AssetKind {
  if (asset.class === 'equity') return FUNDS.has(asset.id) ? 'fund' : 'stock';
  return asset.class;
}
