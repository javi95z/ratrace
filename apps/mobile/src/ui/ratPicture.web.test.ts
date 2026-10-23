import { expect, test } from 'vitest';
import { COMPOSED_KEPT, composedPicture, forgetComposed } from './ratPicture.web';

test('the web puts no rat together into one picture: the grid draws its layers, so nothing is made, kept or forgotten', () => {
  const pieces = [{ layer: 'body' as const, id: 'rat.body.brown', clip: 'rat.clip.suit' }];
  const imageOf = () => ({ uri: '/x.png', w: 128, h: 128 });
  expect(composedPicture({ pieces, faint: true }, imageOf, [])).toBeNull();
  expect(composedPicture({ pieces: [], faint: false }, imageOf, [])).toBeNull();
  expect(COMPOSED_KEPT).toBe(0);
  expect(() => forgetComposed()).not.toThrow();
});
