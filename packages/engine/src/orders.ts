import { executeBorrow, executeRepay } from './debt';
import { executePortfolioOrder } from './portfolio';
import type { OrderContext } from './portfolio';
import { executeBuyProperty, executeSellProperty, executeSetRented } from './property';
import type { Order, PlayerState } from './types';

/** Returns the reason for rejection, or null when the order was executed. */
export function executeOrder(p: PlayerState, order: Order, ctx: OrderContext): string | null {
  if (order === null || typeof order !== 'object') return 'unknown order type';
  switch (order.type) {
    case 'buy':
    case 'sell':
    case 'depositIn':
    case 'depositOut':
    case 'pensionIn':
      return executePortfolioOrder(p, order, ctx);
    case 'borrow':
      return executeBorrow(p, order, ctx);
    case 'repay':
      return executeRepay(p, order);
    case 'buyProperty':
      return executeBuyProperty(p, order, ctx);
    case 'sellProperty':
      return executeSellProperty(p, order, ctx);
    case 'setRented':
      return executeSetRented(p, order);
    default:
      return 'unknown order type';
  }
}
