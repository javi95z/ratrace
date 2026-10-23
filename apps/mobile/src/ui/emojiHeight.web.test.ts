import { expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { EMOJI_X_HEIGHT } from './emojiHeight.web';
import { JERSEY_X_HEIGHT, runsOf } from './fonts';

test('Chrome scales an emoji in a pixel text as it scales Jersey (measured on the Next web: 1.37455 times its size, Jersey\'s 0.56 / (11/27))', () => {
  expect(EMOJI_X_HEIGHT).toBe(JERSEY_X_HEIGHT);
  expect(PIXEL_X_HEIGHT / EMOJI_X_HEIGHT).toBeCloseTo(1.37455, 5);
  // The dice of "At random", as the web's runs set it.
  const [dice] = runsOf('🎲 At random', 'pixel', 400);
  expect(dice.text).toBe('🎲');
  expect(dice.scale).toBeCloseTo(1.37455, 5);
});
