// @vitest-environment jsdom
import type { GameSession } from '@ratrace/core/session/types';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { browserAt } from '../../ui/testing/media';
import { Play } from './Play';

/*
 * The end of a life on the web: one column on a phone's width (the web's `max-w-md`), and from `lg` (1024) two, side by side in a column of at most
 * 1024 (`lg:max-w-5xl lg:grid-cols-2 lg:items-start`): the verdict on the left (the title, the picture, the score, the tale), the life in figures on
 * the right (the figures, the map, the rivals, the line, the badges, the ways on).
 */

let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});

async function playRounds(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

/** A life lived to its end, opened on a browser `width` wide. */
async function endAt(width: number) {
  restore = browserAt(width);
  const services = memoryServices();
  await playRounds(await services.sessions.start('nurse'), 20);
  renderGame(<Play />, services);
  const title = await screen.findByRole('heading', { name: 'The end' });
  const figures = await screen.findByLabelText('Your life in figures');
  return { title, figures };
}

/** The nearest box round `node` with a width of its own set (the page's column). */
function columnOf(node: HTMLElement): HTMLElement | null {
  let at: HTMLElement | null = node;
  while (at && at.style.maxWidth === '') at = at.parentElement;
  return at;
}

describe('the end of a life on the web', () => {
  it('stands in two columns side by side from lg, the verdict on the left and the figures on the right, in a column 1024 wide', async () => {
    const { title, figures } = await endAt(1280);
    expect(columnOf(title)?.style.maxWidth).toBe('1024px');
    // The two columns: the nearest boxes of each that share a row.
    let left: HTMLElement = title;
    while (left.parentElement && !left.parentElement.contains(figures)) left = left.parentElement;
    const row = left.parentElement as HTMLElement;
    expect(row.style.flexDirection).toBe('row');
    expect(row.style.alignItems).toBe('flex-start');
    expect(row.style.columnGap || row.style.gap).toMatch(/^16px/);
    const right = [...row.children].find((child) => child.contains(figures)) as HTMLElement;
    expect([...row.children].indexOf(left)).toBe(0);
    expect([...row.children].indexOf(right)).toBe(1);
    expect(left.style.flexGrow).toBe('1');
    expect(right.style.flexGrow).toBe('1');
  });

  it('is one column of 448 under lg', async () => {
    const { title, figures } = await endAt(1000);
    expect(columnOf(title)?.style.maxWidth).toBe('448px');
    expect(columnOf(figures)).toBe(columnOf(title));
    let up: HTMLElement | null = title;
    while (up && !up.contains(figures)) up = up.parentElement;
    expect(up?.style.flexDirection).not.toBe('row');
  });
});
