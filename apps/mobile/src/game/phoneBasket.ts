import type { BasketKeep } from '@ratrace/core/game/basket';
import type { Order } from '@ratrace/engine';
import { kvBasket } from '../kvStore';

/** Where the basket is held, as the text it is written in. Written at once, because the round store keeps the basket as it changes. */
export interface BasketText {
  read(): string | null;
  /** Null takes away what is held. */
  write(text: string | null): void;
}

/**
 * The orders of the round being planned, kept on a place for them until the round is played: the app killed, or sent away
 * and forgotten, finds them where the player left them. One basket at a time, of one life and one round, as the web's;
 * any other is forgotten. A place that keeps nothing simply starts each time with none.
 */
export function basketOver(place: BasketText): BasketKeep {
  return {
    load(gameId, round) {
      try {
        const raw: unknown = JSON.parse(place.read() ?? 'null');
        if (typeof raw !== 'object' || raw === null) return [];
        const kept = raw as { gameId?: unknown; round?: unknown; orders?: unknown };
        if (kept.gameId !== gameId || kept.round !== round || !Array.isArray(kept.orders)) return [];
        // What is not an order would stop the round being planned at all, on every start, until the round were played.
        return kept.orders.filter((order): order is Order => typeof order === 'object' && order !== null && typeof (order as { type?: unknown }).type === 'string');
      } catch {
        return [];
      }
    },
    save(gameId, round, orders) {
      try {
        place.write(orders.length === 0 ? null : JSON.stringify({ gameId, round, orders }));
      } catch {
        // Not kept: the orders are still on screen for as long as the app is.
      }
    },
  };
}

/** The basket in the phone's own store. */
export const phoneBasket: BasketKeep = basketOver(kvBasket);
