// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LinkText } from './LinkText.web';

afterEach(cleanup);

/** The box of the words: the element whose children are their runs. */
const boxOf = (container: HTMLElement) => [...container.querySelectorAll('div')].find((el) => el.children.length > 0 && [...el.children].every((child) => child.tagName === 'SPAN')) as HTMLElement;

test('a link\'s words are underlined by the browser, as the Next web\'s `underline underline-offset-N`: under every line they wrap to, round the descenders, nothing drawn by hand', () => {
  const page = render(<LinkText size={13} offset={4} tone="ink-300">Sign out</LinkText>);
  const box = boxOf(page.container);
  expect(box.style.textDecorationLine || box.style.textDecoration).toContain('underline');
  expect(box.style.getPropertyValue('text-underline-offset')).toBe('4px');
  expect(page.container.querySelector('[data-testid="underline"]')).toBeNull();
  expect(page.getByText('Sign out')).toBeTruthy();
});

test('a link the Next web underlines at the font\'s own place (`underline` alone) is underlined there', () => {
  const page = render(<LinkText size={13} offset="auto" tone="teal-300">See the challenge ranking</LinkText>);
  expect(boxOf(page.container).style.getPropertyValue('text-underline-offset')).toBe('auto');
});
