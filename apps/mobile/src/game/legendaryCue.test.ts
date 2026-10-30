import { content, lives } from '@ratrace/content';
import { createGame, viewOf } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { legendaryComing, stepCues } from './cues';
import type { HeardMilestones } from './cues';
import { feltOf } from './feel';

/** The round at its cards, the hand given, the first `answered` of it answered. */
function at(hand: string[], answered = 0, stage: HeardMilestones['stage'] = 'cards'): HeardMilestones {
  const view: GameView = { ...viewOf(createGame({ content, start: lives[0].start }, 'legend-cue')), phase: 'cards', hand, answered };
  return { stage, view, resolved: null, orders: [], refusal: null, earned: [], story: [], reached: [] };
}

describe('a legendary card coming up', () => {
  it('rings as a legendary badge in place of the card, and is felt as a success', () => {
    const { cues } = stepCues(at(['legend_airdrop', 'career_raise']), at(['legend_airdrop', 'career_raise'], 0, 'news'));
    expect(cues).toEqual(['badgeLegendary']);
    expect(feltOf(cues)).toBe('success');
  });

  it('rings when it comes after another card of the hand, and only once', () => {
    const second = at(['career_raise', 'legend_viral'], 1);
    expect(legendaryComing(second, at(['career_raise', 'legend_viral'], 0, 'outcome'))).toBe(true);
    expect(legendaryComing(second, second)).toBe(false);
  });

  it('leaves an everyday card its own sound', () => {
    expect(stepCues(at(['career_raise']), at(['career_raise'], 0, 'news')).cues).toEqual(['card']);
  });
});
