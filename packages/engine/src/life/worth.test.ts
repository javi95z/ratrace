import { describe, expect, it } from 'vitest';
import { netWorth } from '../selectors';
import { ownedOutsidePension, totalOwed } from '../solvency';
import { fixturePlayer } from '../testing/fixture';

describe('what the player is worth', () => {
  it('counts the resale value of status items in net worth and in solvency', () => {
    const p = fixturePlayer({ cash: 1_000 });
    p.pension = 500;
    p.life.items.push({ itemId: 'watch_gold', value: 900_000, roundsLeft: null, paid: 0, age: 0 }, { itemId: 'trip', value: 0, roundsLeft: 2, paid: 0, age: 0 });
    p.debts.push({ id: 'debt-1', kind: 'personalLoan', principal: 400, fixedRateBp: 0, roundsLeft: 1 });
    expect(netWorth(p)).toBe(1_000 + 500 + 900_000 - 400);
    expect(ownedOutsidePension(p)).toBe(1_000 + 900_000);
    expect(totalOwed(p)).toBe(400);
  });
});
