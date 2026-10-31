import { describe, expect, it } from 'vitest';
import { content } from '../content';

const adviser = () => {
  const card = content.cards.find((candidate) => candidate.id === 'advisor_insurance');
  if (!card) throw new Error('no advisor_insurance');
  return card;
};

describe("the adviser's insurance", () => {
  it('is offered only to a player with a mortgage and a home not yet insured', () => {
    expect(adviser().when).toMatchObject({ hasMortgage: true, uninsured: 'home' });
  });

  it('leaves refusing with no cover, and both ways of taking it with the real one', () => {
    const [stay, bank, elsewhere] = adviser().options;
    expect(stay.effects?.insure).toBeUndefined();
    expect(bank.effects?.insure).toBe('home');
    expect(elsewhere.effects?.insure).toBe('home');
  });

  it("makes the bank's way cost money and the player's own way cost time, so neither is simply better", () => {
    const [, bank, elsewhere] = adviser().options;
    expect(bank.effects?.cash).toBeLessThan(0);
    expect(bank.effects?.focus).toBeUndefined();
    expect(elsewhere.effects?.cash).toBeUndefined();
    expect(elsewhere.effects?.focus).toBe(1);
  });

  it('leaves no yearly payment behind, to run on after a home is sold', () => {
    for (const option of adviser().options) expect(option.effects?.recurring).toBeUndefined();
  });
});
