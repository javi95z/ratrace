// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { typefaceOf } from './typefaces.web';

test('the web draws its text with CSS fonts: no typeface is ever had, for the game\'s own fonts or any other', async () => {
  expect(await typefaceOf('Jersey15_400Regular')).toBeNull();
  expect(await typefaceOf('Arial')).toBeNull();
});
