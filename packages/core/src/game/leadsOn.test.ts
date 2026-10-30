import { content } from '@ratrace/content';
import { describe, expect, it } from 'vitest';
import { leadsOn } from './present';

describe('leadsOn', () => {
  const said = content.cards.flatMap((card) => card.options.flatMap((option, i) => (leadsOn(content.cards, option) ? [`${card.id}:${i}`] : [])));

  it('marks the options that show only a cost and open a card to come', () => {
    expect(said).toEqual(expect.arrayContaining(['inlaw_coin:1', 'founder_pitch:1', 'founder_more:1', 'inlaw_loan:1', 'landlord_damp:2']));
  });

  it('leaves out passing, an option with a gain of its own, and one whose odds are on the card', () => {
    for (const free of ['inlaw_coin:0', 'inlaw_coin:2', 'founder_pitch:0', 'founder_pitch:2', 'founder_second:1']) expect(said).not.toContain(free);
  });

  it('is said of few options: a tag on every card would say nothing', () => {
    expect(said.length).toBeLessThan(12);
  });
});
