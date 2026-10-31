import { content } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { remembered } from './present';

const asked = (cardId: string, index: number, seen: Record<string, number> = {}) => {
  const card = content.cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error(`no ${cardId}`);
  return remembered(content.cards, cardId, card.options[index], seen);
};

describe('remembered', () => {
  it('tells the two ways of answering Tony on the bench apart', () => {
    expect(asked('inlaw_rug', 0)).toBe('cold');
    expect(asked('inlaw_rug', 1)).toBe('warm');
  });

  it('says it of the boss, the landlord and the parents, whose later cards ask after it', () => {
    expect(asked('boss_weekend', 1)).toBe('warm');
    expect(asked('boss_weekend', 0)).toBe('cold');
    expect(asked('landlord_damp', 0)).toBe('warm');
    expect(asked('landlord_damp', 1)).toBe('cold');
    expect(asked('parents_visit', 2)).toBe('warm');
  });

  it('says it of the adviser only while the insurance can still come', () => {
    expect(asked('advisor_fund', 1)).toBe('warm');
    expect(asked('advisor_fund', 1, { advisor_insurance: 3 })).toBeNull();
  });

  it('promises nothing where no card to come asks after it', () => {
    expect(asked('advisor_insurance', 1)).toBeNull();
    expect(asked('inlaw_repay', 1, { inlaw_loan: 5 })).toBeNull();
    expect(asked('founder_pitch', 2)).toBeNull();
  });

  it('says nothing of a card of nobody, nor of an option that sets no feeling', () => {
    expect(asked('cousin_wedding', 2)).toBeNull();
    expect(asked('parents_help', 1)).toBeNull();
  });
});
