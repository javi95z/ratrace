import type { Order } from '@ratrace/engine';
import type { BasketKeep } from '@ratrace/core/game/basket';

const KEY = 'ratrace.basket';

/** The basket in the browser's own storage. A browser that keeps nothing simply starts each page with none. */
export const browserBasket: BasketKeep = {
  load(gameId, round) {
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
      if (typeof raw !== 'object' || raw === null) return null;
      const kept = raw as { gameId?: unknown; round?: unknown; orders?: unknown };
      return kept.gameId === gameId && kept.round === round && Array.isArray(kept.orders) ? (kept.orders as Order[]) : null;
    } catch {
      return null;
    }
  },
  save(gameId, round, orders) {
    try {
      // An emptied basket is kept as empty, so the round does not begin again with its defaults.
      window.localStorage.setItem(KEY, JSON.stringify({ gameId, round, orders }));
    } catch {
      // Not kept: the orders are still on screen for as long as the page is.
    }
  },
};
