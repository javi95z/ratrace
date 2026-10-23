import { expect, it } from 'vitest';
import { canShareLink } from './sharing';

it('the phone always has a share sheet for a link: a screen shows Share beside Copy link, as it always did', () => {
  expect(canShareLink()).toBe(true);
});
