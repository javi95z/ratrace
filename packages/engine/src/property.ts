import { cityOf } from './lookup';
import { applyBp, isAmount, round } from './money';
import type { Cents } from './money';
import { newId } from './player';
import type { OrderContext } from './portfolio';
import type { Content, Debt, Order, PlayerState, WorldState } from './types';
import { INDEX_START } from './world';

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

export function executeBuyProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'buyProperty' }>,
  ctx: OrderContext,
): string | null {
  const { content, world } = ctx;
  if (!content.propertyTypes.some((t) => t.id === order.typeId)) return `unknown property type: ${order.typeId}`;
  if (order.mortgage !== 'fixed' && order.mortgage !== 'variable' && order.mortgage !== 'none') return 'unknown mortgage type';
  const price = propertyPrice(content, world, p.cityId, order.typeId);

  let debt: Debt | null = null;
  let cashNeeded = price;
  if (order.mortgage !== 'none') {
    if (ctx.round < p.bankruptUntilRound) return 'no credit available after bankruptcy';
    if (!isAmount(order.downPayment)) return 'down payment must be a positive whole number of cents';
    const minimum = price - applyBp(price, content.debt.mortgageMaxLtvBp);
    if (order.downPayment < minimum) return 'down payment is below the minimum';
    if (order.downPayment >= price) return 'down payment covers the full price; buy without a mortgage';
    cashNeeded = order.downPayment;
    debt = {
      id: '',
      kind: order.mortgage === 'fixed' ? 'mortgageFixed' : 'mortgageVariable',
      principal: price - order.downPayment,
      fixedRateBp: order.mortgage === 'fixed' ? world.policyRateBp + content.debt.mortgageSpreadBp : 0,
      roundsLeft: content.debt.mortgageTermRounds,
    };
  }
  if (cashNeeded > p.cash) return 'not enough cash';

  p.cash -= cashNeeded;
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
  ctx.tally.propertyPurchases += price;
  return null;
}

export function executeSellProperty(
  p: PlayerState,
  order: Extract<Order, { type: 'sellProperty' }>,
  ctx: OrderContext,
): string | null {
  const index = p.properties.findIndex((x) => x.id === order.propertyId);
  if (index < 0) return `unknown property: ${order.propertyId}`;
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

export function executeSetRented(p: PlayerState, order: Extract<Order, { type: 'setRented' }>): string | null {
  const property = p.properties.find((x) => x.id === order.propertyId);
  if (!property) return `unknown property: ${order.propertyId}`;
  property.rented = order.rented === true;
  return null;
}

export function growProperties(p: PlayerState, after: WorldState): void {
  for (const property of p.properties) {
    property.value = Math.max(0, property.value + applyBp(property.value, after.propertyReturnBp[property.cityId] ?? 0));
  }
}
