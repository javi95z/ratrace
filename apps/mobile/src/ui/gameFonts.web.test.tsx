// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

/*
 * On the web a page fetches ahead only the typefaces it draws first, as the Next web's next/font does: Jersey 15 and Chakra Petch on every page, and
 * Oswald and Exo 2 on a Russian one, whose words they draw. The others (the Cyrillic faces of a Latin page, the slanted ones) are declared to the page
 * once it is the browser's, and fetched only by the text that needs them, as next/font's `preload: false` faces are.
 */

const asked: string[][] = [];
vi.mock('expo-font', () => ({
  useFonts: (map: Record<string, unknown>) => {
    asked.push(Object.keys(map));
    return [true, null];
  },
}));
vi.mock('./fontSources', () => ({
  FONT_SOURCES: Object.fromEntries(
    [
      'Jersey15_400Regular',
      'ChakraPetch_400Regular',
      'ChakraPetch_600SemiBold',
      'Oswald_500Medium',
      'Exo2_400Regular',
      'Exo2_600SemiBold',
      'ChakraPetch_400Regular_Slant',
      'ChakraPetch_600SemiBold_Slant',
      'Exo2_400Regular_Slant',
      'Exo2_600SemiBold_Slant',
    ].map((family) => [family, `/assets/${family}.ttf`]),
  ),
}));

const { useGameFonts } = await import('./gameFonts');

afterEach(() => {
  asked.length = 0;
  document.getElementById('ratrace-later-fonts')?.remove();
});

function Fonts({ locale }: { locale: string }) {
  return <p data-testid="fonts">{String(useGameFonts(locale))}</p>;
}

const LATIN = ['Jersey15_400Regular', 'ChakraPetch_400Regular', 'ChakraPetch_600SemiBold'];
const CYRILLIC = ['Oswald_500Medium', 'Exo2_400Regular', 'Exo2_600SemiBold'];
const SLANTED = ['ChakraPetch_400Regular_Slant', 'ChakraPetch_600SemiBold_Slant', 'Exo2_400Regular_Slant', 'Exo2_600SemiBold_Slant'];
const declared = () => [...(document.getElementById('ratrace-later-fonts')?.textContent ?? '').matchAll(/font-family:"([^"]+)"/g)].map((found) => found[1]);

test('a Latin page fetches ahead Jersey and Chakra only, and declares the rest for the text that needs them', () => {
  const { getByTestId } = render(<Fonts locale="en" />);
  expect(getByTestId('fonts').textContent).toBe('true');
  expect(asked[0]).toEqual(LATIN);
  expect(declared()).toEqual([...CYRILLIC, ...SLANTED]);
  const css = document.getElementById('ratrace-later-fonts')?.textContent ?? '';
  expect(css).toContain('@font-face{font-family:"Oswald_500Medium";src:url("/assets/Oswald_500Medium.ttf");font-display:swap}');
});

test('a Russian page fetches its Cyrillic faces ahead too', () => {
  render(<Fonts locale="ru" />);
  expect(asked[0]).toEqual([...LATIN, ...CYRILLIC]);
  expect(declared()).toEqual(SLANTED);
});

test('a page outside the languages (a development route) is drawn as a Latin one', () => {
  render(<Fonts locale="" />);
  expect(asked[0]).toEqual(LATIN);
});
