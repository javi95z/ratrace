// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { JERSEY_X_HEIGHT } from './fonts';
import { strut } from './strut.web';
import { Language, PixelText, ReadText } from './text';

afterEach(cleanup);

test('a line is set from the first face of its stack at the size it is drawn at, as the browser sets the Next web\'s (its strut)', () => {
  expect(strut('read', 400, 14, 'en')).toEqual({ fontFamily: 'ChakraPetch_400Regular', fontSize: 14 });
  expect(strut('read', 600, 15, 'es')).toEqual({ fontFamily: 'ChakraPetch_600SemiBold', fontSize: 15 });
  // A pixel text's Jersey at its adjusted size (`font-size-adjust`), as the runs in it are drawn.
  expect(strut('pixel', 400, 15, 'en')).toEqual({ fontFamily: 'Jersey15_400Regular', fontSize: (15 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT });
  // A Russian page's stacks start with the same faces: its Cyrillic falls to Oswald and Exo 2 inside the line.
  expect(strut('pixel', 400, 15, 'ru')).toEqual(strut('pixel', 400, 15, 'en'));
  expect(strut('read', 400, 14, 'ru')).toEqual(strut('read', 400, 14, 'en'));
});

test('the box of a text is in that face: its lines are as tall as their line, not taller by the browser\'s default font beside the runs', () => {
  const page = render(
    <Language.Provider value="en">
      <ReadText size={14} lineHeight={19.25}>Every round opens with the paper.</ReadText>
      <PixelText size={15}>Got it</PixelText>
    </Language.Provider>,
  );
  // The box of each text: the element whose children are its runs.
  const boxes = [...page.container.querySelectorAll('div')].filter((el) => el.children.length > 0 && [...el.children].every((child) => child.tagName === 'SPAN'));
  expect(boxes.map((box) => [box.style.fontFamily, box.style.fontSize])).toEqual([
    ['ChakraPetch_400Regular', '14px'],
    ['Jersey15_400Regular', `${(15 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT}px`],
  ]);
});
