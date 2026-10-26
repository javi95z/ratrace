import { EMPTY_BOOK } from '@ratrace/core/game/lifeMilestones';
import { expect, it } from 'vitest';
import type { BasketText } from './phoneBasket';
import { milestonesOver } from './phoneMilestones';

const place = (text: string | null = null): BasketText & { text: string | null } => {
  const kept = {
    text,
    read: () => kept.text,
    write: (next: string | null) => {
      kept.text = next;
    },
  };
  return kept;
};

it('keeps the book as text, and reads it back on the next start', () => {
  const kept = place();
  const book = { lives: [{ gameId: 'g', hadDebt: true, reached: ['debtFree' as const] }], best: { home: 30 } };
  milestonesOver(kept).save(book);
  expect(milestonesOver(kept).load()).toEqual(book);
});

it('starts empty from nothing, or from what is not a book', () => {
  expect(milestonesOver(place()).load()).toEqual(EMPTY_BOOK);
  expect(milestonesOver(place('{not json')).load()).toEqual(EMPTY_BOOK);
});

it('goes on with a place that will not keep anything', () => {
  const keep = milestonesOver({ read: () => { throw new Error('no'); }, write: () => { throw new Error('no'); } });
  expect(keep.load()).toEqual(EMPTY_BOOK);
  keep.save({ lives: [], best: { home: 25 } });
  expect(keep.load().best.home).toBe(25);
});
