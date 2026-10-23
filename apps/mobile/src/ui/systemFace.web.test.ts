import { expect, test } from 'vitest';
import { DINGBATS, faceOf, runsOf, SYSTEM } from './fonts';
import { FALLBACK, faceWeight, platformFace } from './systemFace.web';

test('where none of the game\'s fonts draws a sign, the browser picks the system\'s font for it, as it does for the Next web\'s stack: none is named', () => {
  // The pencil of a name: Chrome draws it from Lucida Grande through the Next web's stack (named Zapf Dingbats, or system-ui alone, it drew Zapf's).
  const [pencil] = runsOf('✎', 'read', 400);
  expect(pencil.family).toBe(DINGBATS);
  expect(faceOf(pencil)).toBe('Arial, system-ui, sans-serif');
  expect(platformFace(SYSTEM)).toBe('Arial, system-ui, sans-serif');
  // The game's own fonts are named as they are.
  expect(platformFace('ChakraPetch_400Regular')).toBe('ChakraPetch_400Regular');
  expect(faceOf(runsOf('Rata', 'read', 400)[0])).toBe('ChakraPetch_400Regular');
});

test('a sign of the system\'s fonts in a bold text is drawn bold, as Chrome draws the Next web\'s `font-bold` ✕; the game\'s faces keep their own', () => {
  expect(faceWeight(FALLBACK, 600)).toEqual({ fontWeight: '600' });
  expect(faceWeight(FALLBACK, 400)).toBeNull();
  expect(faceWeight('ChakraPetch_600SemiBold', 600)).toBeNull();
});
