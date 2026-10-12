import { applyRound, createGame } from '../game';
import { applyBp } from '../money';
import { propertyPrice } from '../property';
import type { Content, GameEvent, GameState, Order, RoundChoices, StartConfig } from '../types';

export function playGame(
  content: Content,
  start: StartConfig,
  seed: string,
  choose: (state: GameState) => RoundChoices,
): { state: GameState; events: GameEvent[] } {
  let state = createGame({ content, start }, seed);
  const events: GameEvent[] = [];
  while (!state.finished) {
    const result = applyRound(content, state, choose(state));
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** A fixed strategy that touches every kind of order. Some orders are rejected on purpose. */
export function scriptedChoices(content: Content): (state: GameState) => RoundChoices {
  return (state) => {
    const p = state.player;
    const world = state.timeline[state.round];
    const orders: Order[] = [];

    if (state.round === 6) {
      if (p.deposit > 0) orders.push({ type: 'depositOut', amount: p.deposit });
      for (const [assetId, held] of Object.entries(p.positions)) {
        orders.push({ type: 'sell', assetId, amount: held.value });
      }
      const price = propertyPrice(content, world, p.cityId, 'studio');
      const downPayment = price - applyBp(price, content.debt.mortgageMaxLtvBp);
      orders.push({ type: 'buyProperty', typeId: 'studio', downPayment, mortgage: 'variable', rented: true });
      return { orders };
    }

    const slice = Math.floor(p.cash / 10);
    if (slice > 0) {
      orders.push(
        { type: 'depositIn', amount: slice },
        { type: 'buy', assetId: 'fund_world', amount: slice * 3 },
        { type: 'buy', assetId: 'bond_long', amount: slice },
        { type: 'buy', assetId: 'coin_meme', amount: slice },
        { type: 'pensionIn', amount: slice },
      );
    }
    if (state.round === 2) orders.push({ type: 'borrow', amount: 500_000 });
    if (state.round === 3) {
      for (const debt of p.debts) {
        if (debt.kind === 'personalLoan') orders.push({ type: 'repay', debtId: debt.id, amount: 100_000 });
      }
    }
    if (state.round === 9) {
      for (const property of p.properties) orders.push({ type: 'setRented', propertyId: property.id, rented: false });
    }
    if (state.round === 14) {
      for (const property of p.properties) orders.push({ type: 'sellProperty', propertyId: property.id });
    }
    if (state.round % 5 === 4 && Object.hasOwn(p.positions, 'fund_world')) {
      orders.push({ type: 'sell', assetId: 'fund_world', amount: Math.max(1, Math.floor(p.positions.fund_world.value / 2)) });
    }
    return { orders };
  };
}
