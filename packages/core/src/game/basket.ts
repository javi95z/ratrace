import type { Order } from '@ratrace/engine';

/**
 * The orders of the round being planned, kept on this device until the round is played: a page
 * opened again, or reloaded, finds them where the player left them. One basket at a time, of one
 * life and one round; any other is forgotten.
 */
export interface BasketKeep {
  load(gameId: string, round: number): Order[];
  save(gameId: string, round: number, orders: readonly Order[]): void;
}

/** A basket held in memory, for tests and for pages with no storage. */
export function memoryBasket(): BasketKeep & { kept: { gameId: string; round: number; orders: readonly Order[] } | null } {
  const keep = {
    kept: null as { gameId: string; round: number; orders: readonly Order[] } | null,
    load: (gameId: string, round: number) => (keep.kept && keep.kept.gameId === gameId && keep.kept.round === round ? [...keep.kept.orders] : []),
    save: (gameId: string, round: number, orders: readonly Order[]) => {
      keep.kept = orders.length === 0 ? null : { gameId, round, orders: [...orders] };
    },
  };
  return keep;
}
