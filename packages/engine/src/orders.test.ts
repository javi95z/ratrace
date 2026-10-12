import { describe, expect, it } from 'vitest';
import { applyRound, createGame } from './game';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { GameEvent, RoundChoices } from './types';

const content = fixtureContent();
const start = () => createGame({ content, start: { ...fixtureStart(), cash: 20_000_000 } }, 'orders');
const reasons = (events: GameEvent[]) => events.flatMap((e) => (e.kind === 'orderRejected' ? [e.reason] : []));
const raw = (json: string) => ({ orders: JSON.parse(json) }) as RoundChoices;

describe('order validation', () => {
  it('rejects things that are not orders', () => {
    const { state, events } = applyRound(content, start(), raw('[null, 7, "buy", [], true]'));
    expect(reasons(events)).toEqual(['bad-order', 'bad-order', 'bad-order', 'bad-order', 'bad-order']);
    expect(state.player.positions).toEqual({});
  });

  it('rejects an order with a missing or non-text type, and an unknown type', () => {
    const { events } = applyRound(content, start(), raw('[{"amount":5}, {"type":7}, {"type":"teleport","amount":5}]'));
    expect(reasons(events)).toEqual(['bad-order', 'bad-order', 'unknown-order']);
  });

  it('rejects ids that are not text, without throwing and without coercing them', () => {
    const base = start();
    const withGold = { ...base, player: { ...base.player, positions: { gold: { value: 500_000, basis: 500_000 } } } };
    const { state, events } = applyRound(
      content,
      withGold,
      raw(`[
        {"type":"sell","assetId":["gold"],"amount":500000},
        {"type":"sell","assetId":{"toString":1},"amount":5},
        {"type":"buy","assetId":5,"amount":5},
        {"type":"repay","debtId":{"toString":1},"amount":5},
        {"type":"sellProperty","propertyId":["property-1"]},
        {"type":"setRented","propertyId":null,"rented":true},
        {"type":"buyProperty","typeId":["studio"],"downPayment":0,"mortgage":"none","rented":true}
      ]`),
    );
    expect(reasons(events)).toEqual(['bad-order', 'bad-order', 'bad-order', 'bad-order', 'bad-order', 'bad-order', 'bad-order']);
    expect(state.player.positions.gold.basis).toBe(500_000);
    expect(state.player.properties).toEqual([]);
  });

  it('rejects flags that are not true or false, and unknown mortgage types', () => {
    const { state, events } = applyRound(
      content,
      start(),
      raw(`[
        {"type":"buyProperty","typeId":"studio","downPayment":0,"mortgage":"none","rented":"yes"},
        {"type":"buyProperty","typeId":"studio","downPayment":0,"mortgage":7,"rented":true},
        {"type":"buyProperty","typeId":"studio","downPayment":5000000,"mortgage":"weird","rented":true},
        {"type":"setRented","propertyId":"property-1","rented":1}
      ]`),
    );
    expect(reasons(events)).toEqual(['bad-order', 'bad-order', 'unknown-mortgage-type', 'bad-order']);
    expect(state.player.properties).toEqual([]);
  });

  it('rejects amounts that are not numbers', () => {
    const { events } = applyRound(
      content,
      start(),
      raw('[{"type":"buy","assetId":"gold","amount":"100"}, {"type":"depositIn"}, {"type":"borrow","amount":null}]'),
    );
    expect(reasons(events)).toEqual(['bad-amount', 'bad-amount', 'bad-amount']);
  });

  it('executes orders up to the limit and rejects the rest', () => {
    const orders = Array.from({ length: content.maxOrdersPerRound + 2 }, () => ({ type: 'depositIn' as const, amount: 100 }));
    const { state, events } = applyRound(content, start(), { orders });
    expect(reasons(events)).toEqual(['too-many-orders', 'too-many-orders']);
    expect(state.player.deposit).toBeGreaterThanOrEqual(content.maxOrdersPerRound * 100);
    expect(state.player.deposit).toBeLessThan((content.maxOrdersPerRound + 1) * 100);
  });

  it('refuses choices that have no list of orders, with a clear error', () => {
    const bad: unknown[] = [null, undefined, {}, { orders: 'buy' }, { orders: { length: 1 } }, 7];
    for (const choices of bad) {
      expect(() => applyRound(content, start(), choices as RoundChoices)).toThrow('applyRound: choices.orders must be an array');
    }
  });
});
