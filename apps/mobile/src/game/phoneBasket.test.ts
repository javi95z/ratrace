import type { Order } from '@ratrace/engine';
import { expect, test } from 'vitest';
import { kv } from '../testing/fakes';
import { basketOver, phoneBasket } from './phoneBasket';
import type { BasketText } from './phoneBasket';

const study: Order = { type: 'focus', action: 'studyCareer' };
const deposit: Order = { type: 'depositIn', amount: 500 };

/** A place for the basket that is only a variable. */
function text(start: string | null = null) {
  const place = {
    held: start,
    read: (): string | null => place.held,
    write: (next: string | null) => {
      place.held = next;
    },
  };
  return place;
}

test('what is saved for a round is loaded for that round of that life', () => {
  const basket = basketOver(text());
  basket.save('life-1', 3, [study, deposit]);
  expect(basket.load('life-1', 3)).toEqual([study, deposit]);
});

test('another round, another life or nothing at all loads no basket: the round was never planned', () => {
  const basket = basketOver(text());
  expect(basket.load('life-1', 3)).toBeNull();
  basket.save('life-1', 3, [study]);
  expect(basket.load('life-1', 4)).toBeNull();
  expect(basket.load('life-2', 3)).toBeNull();
});

test('one basket at a time: saving for a round forgets the basket of any other', () => {
  const basket = basketOver(text());
  basket.save('life-1', 3, [study]);
  basket.save('life-1', 4, [deposit]);
  expect(basket.load('life-1', 3)).toBeNull();
  expect(basket.load('life-1', 4)).toEqual([deposit]);
});

test('a basket the player emptied is kept as empty, so its round does not begin again with its defaults', () => {
  const place = text();
  const basket = basketOver(place);
  basket.save('life-1', 3, [study]);
  basket.save('life-1', 3, []);
  expect(JSON.parse(place.held as string)).toEqual({ gameId: 'life-1', round: 3, orders: [] });
  expect(basket.load('life-1', 3)).toEqual([]);
});

test('a basket that is not what was written is no basket: damaged text, other shapes, other types', () => {
  for (const held of ['', '{', 'null', '[]', '7', '"x"', '{"gameId":"life-1","round":3}', '{"gameId":"life-1","round":3,"orders":"study"}', '{"gameId":"life-1","round":"3","orders":[]}']) {
    expect(basketOver(text(held)).load('life-1', 3), held).toBeNull();
  }
});

test('a phone that keeps nothing starts each time with none, and nothing stops the game', () => {
  const broken: BasketText = {
    read: () => {
      throw new Error('no storage');
    },
    write: () => {
      throw new Error('no storage');
    },
  };
  const basket = basketOver(broken);
  expect(() => basket.save('life-1', 3, [study])).not.toThrow();
  expect(() => basket.save('life-1', 3, [])).not.toThrow();
  expect(basket.load('life-1', 3)).toBeNull();
});

test('on the phone it is kept under one key of the key-value store, as the web keeps one under one key of its own', () => {
  phoneBasket.save('life-1', 3, [study, deposit]);
  expect(JSON.parse(kv.get('ratrace:basket') as string)).toEqual({ gameId: 'life-1', round: 3, orders: [study, deposit] });
  expect(phoneBasket.load('life-1', 3)).toEqual([study, deposit]);
  phoneBasket.save('life-1', 3, []);
  expect(phoneBasket.load('life-1', 3)).toEqual([]);
});
