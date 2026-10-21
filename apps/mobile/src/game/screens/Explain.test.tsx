// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Explain } from './Explain';

afterEach(cleanup);

it('keeps an explanation out of the way until it is asked for, then shows it in place of the link', async () => {
  renderGame(<Explain>{'Cash is what you have on hand.'}</Explain>, memoryServices(), 'es');
  const link = await screen.findByRole('button', { name: '¿Qué es esto?' });
  expect(link.getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByText('Cash is what you have on hand.')).toBeNull();
  fireEvent.click(link);
  expect(screen.getByText('Cash is what you have on hand.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '¿Qué es esto?' })).toBeNull();
});
