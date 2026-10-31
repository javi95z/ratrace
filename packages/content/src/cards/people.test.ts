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

const cardOf = (id: string) => {
  const card = content.cards.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`no ${id}`);
  return card;
};

describe('what sitting with Tony on the bench brings', () => {
  it('costs focus and warms him, where leaving him alone is free and cools him', () => {
    const [alone, bench] = cardOf('inlaw_rug').options;
    expect(alone.effects?.setFlags).toContain('inlaw_cold');
    expect(alone.effects?.focus).toBeUndefined();
    expect(bench.effects?.setFlags).toContain('inlaw_warm');
    expect(bench.effects?.focus).toBe(1);
  });

  it('has him sign for the loan only if warm, in place of the plain promise', () => {
    const loan = cardOf('inlaw_loan').options;
    expect(loan[1].when).toEqual({ unless: { flags: ['inlaw_warm'] } });
    expect(loan[3].when).toEqual({ flags: ['inlaw_warm'] });
    expect(loan[3].effects?.setFlags).toContain('inlaw_signed');
  });

  it('pays a signed loan back whole, with no dice, beside the envelope that may fall short', () => {
    const repay = cardOf('inlaw_repay').options;
    expect(repay[2].when).toEqual({ flags: ['inlaw_signed'] });
    expect(repay[2].outcomes).toBeUndefined();
    expect(repay[2].effects?.cash).toBe(-(cardOf('inlaw_loan').options[3].effects?.cash as number));
  });
});

describe("the adviser's client rate", () => {
  it("is offered to whoever took his fund, cheaper than the bank's usual commission and in its place", () => {
    const [, bank, , client] = adviser().options;
    expect(bank.when).toEqual({ unless: { flags: ['advisor_warm'] } });
    expect(client.when).toEqual({ flags: ['advisor_warm'] });
    expect(client.effects?.insure).toBe('home');
    expect(client.effects?.cash as number).toBeGreaterThan(bank.effects?.cash as number);
  });
});
