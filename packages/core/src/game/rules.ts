import { ENGINE_VERSION } from '@ratrace/engine';
import type { Order } from '@ratrace/engine';

/**
 * When each order the page can give came into the game's rules, by the engine version that first
 * held it. A life begun under older rules is played to its end under them, by the server or by this
 * page: the page must not offer it, or send it, what those rules do not know, or the round comes back
 * with "that action does not exist". An order not listed here is known to every version still played.
 * A test holds this list to the rules bundles themselves.
 */
export const ORDERS_SINCE: Readonly<Record<string, string>> = {
  'focus:askRaise': '0.32.0',
  setWorkMode: '0.32.0',
  goFullTime: '0.32.0',
  backToWork: '0.32.0',
  setLodger: '0.32.0',
  setResidency: '0.33.0',
  switchMortgage: '0.34.0',
  'focus:tease': '0.38.0',
  'focus:careerMove': '0.39.0',
  pensionOut: '0.40.0',
};

/**
 * When each kind of property came into the game's rules, by the engine version that first sold it: a
 * life begun under older rules is not offered a kind those rules would refuse to sell. A kind not
 * listed here is sold by every version still played. A test holds this list to the rules bundles.
 */
export const PROPERTIES_SINCE: Readonly<Record<string, string>> = {
  kiosk: '0.43.0',
  market_stall: '0.43.0',
  hawker_stall: '0.43.0',
  rooftop: '0.43.0',
  billboard: '0.43.0',
  yacht_berth: '0.43.0',
  tourist_flat: '0.43.0',
  vault: '0.43.0',
  student_house: '0.43.0',
  capsule_hotel: '0.43.0',
};

/** Whether rules of engine version `rules` sell a kind of property. */
export function rulesSell(rules: string, typeId: string): boolean {
  const since = PROPERTIES_SINCE[typeId];
  return since === undefined || atLeast(rules, since);
}

/** How an order is named in that list: by its type, and a use of focus by its action too. */
export const orderKey = (order: Pick<Order, 'type'> & { action?: unknown }): string => (order.type === 'focus' && typeof order.action === 'string' ? `focus:${order.action}` : order.type);

/** True when version `a` is `b` or later. */
export function atLeast(a: string, b: string): boolean {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

/** Whether rules of engine version `rules` know an order, named by its key. */
export function rulesKnow(rules: string, key: string): boolean {
  const since = ORDERS_SINCE[key];
  return since === undefined || atLeast(rules, since);
}

/** The orders of a round that the rules a life is played under know: the rest are left out, never sent. */
export function knownOrders<T extends Pick<Order, 'type'> & { action?: unknown }>(rules: string, orders: readonly T[]): T[] {
  return orders.filter((order) => rulesKnow(rules, orderKey(order)));
}

/** The rules of this page, for a life that names none. */
export const OWN_RULES = ENGINE_VERSION;
