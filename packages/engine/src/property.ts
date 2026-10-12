import { cityOf } from './lookup';
import { applyBp, isAmount, round } from './money';
import type { Cents } from './money';
import { newId } from './player';
import { INDEX_START } from './rates';
import { purchaseTax } from './tax';
import type { Content, Debt, Order, OrderContext, PlayerState, RejectReason, WorldState } from './types';

export function propertyPrice(content: Content, world: WorldState, cityId: string, typeId: string): Cents {
  const city = cityOf(content, cityId);
  const type = content.propertyTypes.find((t) => t.id === typeId);
  if (!type) throw new Error(`unknown property type: ${typeId}`);
  return round((((city.flatPrice * type.pricePct) / 100) * world.propertyIndex[cityId]) / INDEX_START);
}

/** True if the player lives in a property they own in their current city. */
export function ownsHome(p: PlayerState): boolean {
  return p.properties.some((x) => x.cityId === p.cityId && !x.rented);
}

/**
 * Buys a property in the player's current city.
 * Cash must cover the purchase tax as well as the price or the down payment; the tax is paid here.
 */
export function executeBuyProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'buyProperty' }>,
  ctx: OrderContext,
): RejectReason | null {
  const { content, world } = ctx;
  if (!content.propertyTypes.some((t) => t.id === order.typeId)) return 'unknown-property-type';
  if (order.mortgage !== 'fixed' && order.mortgage !== 'variable' && order.mortgage !== 'none') {
    return 'unknown-mortgage-type';
  }
  const price = propertyPrice(content, world, p.cityId, order.typeId);
  const tax = purchaseTax(cityOf(content, p.cityId).tax, price);

  let debt: Debt | null = null;
  let fromCash = price;
  if (order.mortgage !== 'none') {
    if (ctx.round < p.bankruptUntilRound) return 'no-credit';
    if (!isAmount(order.downPayment)) return 'bad-down-payment';
    const minimum = price - applyBp(price, content.debt.mortgageMaxLtvBp);
    if (order.downPayment < minimum) return 'down-payment-too-low';
    if (order.downPayment >= price) return 'down-payment-too-high';
    fromCash = order.downPayment;
    debt = {
      id: '',
      kind: order.mortgage === 'fixed' ? 'mortgageFixed' : 'mortgageVariable',
      principal: price - order.downPayment,
      fixedRateBp: order.mortgage === 'fixed' ? world.policyRateBp + content.debt.mortgageSpreadBp : 0,
      roundsLeft: content.debt.mortgageTermRounds,
    };
  }
  if (fromCash + tax > p.cash) return 'not-enough-cash';

  p.cash -= fromCash + tax;
  ctx.tally.purchaseTaxPaid += tax;
  if (debt) {
    debt.id = newId(p, 'debt');
    p.debts.push(debt);
  }
  p.properties.push({
    id: newId(p, 'property'),
    cityId: p.cityId,
    typeId: order.typeId,
    value: price,
    basis: price,
    rented: order.rented === true,
    mortgageId: debt ? debt.id : null,
  });
  return null;
}

/** Sells at the current value and repays the linked mortgage. Cash may go negative; the round settles it. */
export function executeSellProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'sellProperty' }>,
  ctx: OrderContext,
): RejectReason | null {
  const index = p.properties.findIndex((x) => x.id === order.propertyId);
  if (index < 0) return 'unknown-property';
  const property = p.properties[index];

  let payoff = 0;
  if (property.mortgageId !== null) {
    const mortgage = p.debts.find((d) => d.id === property.mortgageId);
    if (mortgage) {
      payoff = mortgage.principal;
      p.debts = p.debts.filter((d) => d.id !== mortgage.id);
    }
  }
  ctx.tally.realisedGains += property.value - property.basis;
  p.cash += property.value - payoff;
  p.properties.splice(index, 1);
  return null;
}

export function executeSetRented(p: PlayerState, order: Extract<Order, { type: 'setRented' }>): RejectReason | null {
  const property = p.properties.find((x) => x.id === order.propertyId);
  if (!property) return 'unknown-property';
  property.rented = order.rented === true;
  return null;
}

export function growProperties(p: PlayerState, after: WorldState): void {
  for (const property of p.properties) {
    property.value = Math.max(0, property.value + applyBp(property.value, after.propertyReturnBp[property.cityId] ?? 0));
  }
}
