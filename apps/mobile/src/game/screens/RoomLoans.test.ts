// @vitest-environment jsdom
import { content } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { loanCost } from './RoomLoans';

/*
 * What a loan between players costs whoever owes it (the web's `loanCost`, the same sums): each round the interest on what is still owed and a share
 * of it back, the rest at the last. The sheets that offer and answer loans are played in Room.test, on the in-memory server.
 */

describe('what a loan costs', () => {
  it('pays it back in equal shares with the interest on what is owed, the years of a round at a time', () => {
    expect(content.yearsPerRound).toBe(2);
    // $1,000 at 10% for two rounds: 500 back and 200 of interest, then 500 and 100.
    expect(loanCost(100_000, 1_000, 2, content.yearsPerRound)).toEqual({ first: 70_000, total: 130_000 });
  });

  it('costs nothing more than itself interest-free, and is paid at once over a single round', () => {
    expect(loanCost(250_000, 0, 5, content.yearsPerRound)).toEqual({ first: 50_000, total: 250_000 });
    const once = loanCost(100_000, 500, 1, content.yearsPerRound);
    expect(once.first).toBe(once.total);
    expect(once.total).toBe(110_000);
  });
});
