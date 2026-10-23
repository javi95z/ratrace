import { expect, test } from 'vitest';
import { strut } from './strut';

test('on the phone a text\'s line is the line it is given, whatever the faces in it: nothing is added to its box', () => {
  expect(strut('read', 400, 14, 'en')).toBeNull();
  expect(strut('pixel', 400, 15, 'ru')).toBeNull();
});
