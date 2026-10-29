import type { Order } from '@ratrace/engine';

/**
 * The orders of the round being planned, kept on this device until the round is played: a page
 * opened again, or reloaded, finds them where the player left them. One basket at a time, of one
 * life and one round; any other is forgotten. A basket emptied by the player is kept as empty:
 * `load` answers null only for a round whose basket was never made, which then begins with its
 * defaults (`roundDefaults`), and an empty list for one the player emptied, which does not.
 */
export interface BasketKeep {
  load(gameId: string, round: number): Order[] | null;
  save(gameId: string, round: number, orders: readonly Order[]): void;
}

/** A basket held in memory, for tests and for pages with no storage. */
export function memoryBasket(): BasketKeep & { kept: { gameId: string; round: number; orders: readonly Order[] } | null } {
  const keep = {
    kept: null as { gameId: string; round: number; orders: readonly Order[] } | null,
    load: (gameId: string, round: number) => (keep.kept && keep.kept.gameId === gameId && keep.kept.round === round ? [...keep.kept.orders] : null),
    save: (gameId: string, round: number, orders: readonly Order[]) => {
      keep.kept = { gameId, round, orders: [...orders] };
    },
  };
  return keep;
}
