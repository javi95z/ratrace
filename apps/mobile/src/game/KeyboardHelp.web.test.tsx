// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../testing/render';
import { Preferences } from './screens/Settings';

afterEach(cleanup);

it('offers the keys in the settings on the web, unfolded in place, never as a sheet over the settings', async () => {
  renderGame(<Preferences />, memoryServices());
  const open = await screen.findByRole('button', { name: 'Keyboard controls' });
  expect(open.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(open);
  expect(open.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Move to the next control.')).toBeTruthy();
  expect(screen.getByText('Open this keyboard reference.')).toBeTruthy();
  expect(document.querySelector('[aria-modal="true"]')).toBeNull();
});
