import { executeBorrow, executeRepay } from './debt';
import { executeLifeOrder } from './life/orders';
import { executePortfolioOrder } from './portfolio';
import { executeBuyProperty, executeSellProperty, executeSetRented } from './property';
import type { Order, OrderContext, PlayerState, RejectReason } from './types';

const ORDER_TYPES: ReadonlySet<string> = new Set<Order['type']>([
  'buy',
  'sell',
  'depositIn',
  'depositOut',
  'pensionIn',
  'borrow',
  'repay',
  'buyProperty',
  'sellProperty',
  'setRented',
  'focus',
  'buyItem',
  'sellItem',
  'setLifestyle',
  'setRentTier',
  'setInsurance',
  'moveCity',
]);

const isText = (x: unknown): x is string => typeof x === 'string';
const isFlag = (x: unknown): x is boolean => typeof x === 'boolean';

/**
 * True if the fields that name things have the right primitive type.
 * Amounts and tiers are checked by each executor, which rejects them as 'bad-amount' or 'bad-tier'.
 */
function hasValidFields(fields: Record<string, unknown>): boolean {
  switch (fields.type) {
    case 'buy':
    case 'sell':
      return isText(fields.assetId);
    case 'repay':
      return isText(fields.debtId);
    case 'buyProperty':
      return isText(fields.typeId) && isText(fields.mortgage) && isFlag(fields.rented);
    case 'sellProperty':
      return isText(fields.propertyId);
    case 'setRented':
      return isText(fields.propertyId) && isFlag(fields.rented);
    case 'focus':
      return isText(fields.action);
    case 'buyItem':
    case 'sellItem':
      return isText(fields.itemId);
    case 'setInsurance':
      return isText(fields.insurance) && isFlag(fields.on);
    case 'moveCity':
      return isText(fields.cityId);
    default:
      return true;
  }
}

/**
 * Executes one order. The order may come from an untrusted client, so its shape is checked first:
 * nothing here throws, and nothing is coerced.
 * Returns the reason for rejection, or null when the order was executed.
 */
export function executeOrder(p: PlayerState, raw: unknown, ctx: OrderContext): RejectReason | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'bad-order';
  const fields = raw as Record<string, unknown>;
  if (!isText(fields.type)) return 'bad-order';
  if (!ORDER_TYPES.has(fields.type)) return 'unknown-order';
  if (!hasValidFields(fields)) return 'bad-order';

  const order = raw as Order;
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
      return executeSetRented(p, order, ctx);
    case 'focus':
    case 'buyItem':
    case 'sellItem':
    case 'setLifestyle':
    case 'setRentTier':
    case 'setInsurance':
    case 'moveCity':
      return executeLifeOrder(p, order, ctx);
  }
}
