// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { PIXEL_X_HEIGHT } from '@ratrace/core/game/share';
import { adjustedRead, JERSEY_X_HEIGHT } from './fonts';
import { RUN_LINE, strut } from './strut.web';
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

test('a span that runs on in a text is set in its own face too, as the Next web\'s span is: a reading span in a pixel text at its adjusted size', () => {
  expect(strut('read', 400, 13, 'en', true)).toEqual({ fontFamily: 'ChakraPetch_400Regular', fontSize: adjustedRead(13) });
  expect(strut('pixel', 400, 13, 'en', false, 14.3)).toEqual({ fontFamily: 'Jersey15_400Regular', fontSize: 13 * (PIXEL_X_HEIGHT / JERSEY_X_HEIGHT), lineHeight: 14.3 });
  const page = render(
    <Language.Provider value="en">
      <PixelText size={17} after={[{ text: ' · Lucía', read: 13, tone: 'ink-300' }, { text: ' now', tone: 'gold-500' }]}>
        Nurse
      </PixelText>
    </Language.Provider>,
  );
  const span = (words: string) => page.getByText(words).parentElement as HTMLElement;
  // With the line its classes give it (`text-[13px]`: 1.25), which the line it runs on in would otherwise be pushed open by.
  expect([span('· Lucía').style.fontFamily, span('· Lucía').style.fontSize, span('· Lucía').style.lineHeight]).toEqual(['ChakraPetch_400Regular', `${adjustedRead(13)}px`, '16.25px']);
  expect([span('now').style.fontFamily, span('now').style.fontSize]).toEqual(['Jersey15_400Regular', `${(17 * PIXEL_X_HEIGHT) / JERSEY_X_HEIGHT}px`]);
});

test('a run of another face draws inside the line and sets nothing of it, as the browser\'s fallback inside one element (a Russian paragraph\'s Cyrillic in Exo 2)', () => {
  expect(RUN_LINE).toEqual({ lineHeight: 0 });
  const page = render(
    <Language.Provider value="ru">
      <ReadText size={14} lineHeight={19.25}>Каждую неделю: 2026</ReadText>
    </Language.Provider>,
  );
  const runs = [...page.container.querySelectorAll('span')].filter((span) => span.children.length === 0);
  expect(runs.map((run) => [run.textContent, run.style.fontFamily, run.style.lineHeight])).toEqual([
    ['Каждую', 'Exo2_400Regular', '0px'],
    [' ', 'ChakraPetch_400Regular', '0px'],
    ['неделю', 'Exo2_400Regular', '0px'],
    [': 2026', 'ChakraPetch_400Regular', '0px'],
  ]);
});
