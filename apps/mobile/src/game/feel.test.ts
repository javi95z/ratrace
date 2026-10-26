import { expect, test } from 'vitest';
import { CUES } from '../ui/sound';
import { feltOf } from './feel';

test('a change of the round is felt once, by its first cue that is felt: a badge won with the way out is one success, not two', () => {
  expect(feltOf(['escape', 'badgeLegendary'])).toBe('success');
  expect(feltOf(['card'])).toBeNull();
  expect(feltOf([])).toBeNull();
});

test('what the player did is committed to, what a life won is a success, what it lost or was refused a rejection, a crisis a warning', () => {
  expect(feltOf(['pick'])).toBe('confirm');
  expect(feltOf(['round'])).toBe('confirm');
  for (const cue of ['promote', 'escape', 'million', 'badge', 'badgeUncommon', 'badgeRare', 'badgeLegendary'] as const) expect(feltOf([cue]), cue).toBe('success');
  for (const cue of ['bankrupt', 'bad', 'refuse'] as const) expect(feltOf([cue]), cue).toBe('reject');
  expect(feltOf(['crisis'])).toBe('warning');
});

test('what only comes to the player is heard and not felt: a card dealt, the news, an order in the basket, a calm, the end counted up, a press', () => {
  const felt = CUES.filter((cue) => feltOf([cue]) !== null);
  expect(CUES.filter((cue) => !felt.includes(cue))).toEqual(['tap', 'card', 'coin', 'good', 'calm', 'end']);
});
