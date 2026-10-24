// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import type { FinishedRun } from '@ratrace/core/session/types';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryServices, renderGame } from '../testing/render';
import { Legal } from '../game/screens/Legal';
import { Records } from '../game/screens/Records';
import { useIsDesk, useIsWide, WIDE_COLUMN } from './desk.web';
import { browserAt, resizeTo } from './testing/media';

let restore: (() => void) | null = null;
afterEach(() => {
  cleanup();
  restore?.();
  restore = null;
});

function Widths() {
  return <p>{`desk ${useIsDesk()} wide ${useIsWide()}`}</p>;
}

describe('the widths of the web', () => {
  it('are the Next web\'s breakpoints: sm from 640 px, the desk (and lg) from 1024', () => {
    restore = browserAt(1280);
    render(<Widths />);
    expect(screen.getByText('desk true wide true')).toBeTruthy();
    act(() => resizeTo(800));
    expect(screen.getByText('desk false wide true')).toBeTruthy();
    act(() => resizeTo(639));
    expect(screen.getByText('desk false wide false')).toBeTruthy();
    act(() => resizeTo(1024));
    expect(screen.getByText('desk true wide true')).toBeTruthy();
  });

  it('are none in the export\'s HTML, whatever the window, so the browser\'s first drawing of it agrees with it', () => {
    restore = browserAt(1280);
    expect(renderToString(<Widths />)).toContain('desk false wide false');
  });

  it('give a page of reading the web\'s max-w-2xl column, 672 wide, centred', async () => {
    restore = browserAt(1280);
    expect(WIDE_COLUMN).toBe(672);
    renderGame(<Legal />, memoryServices());
    const title = await screen.findByRole('heading', { name: (messagesFor('en').phone.legal as Record<string, string>).title });
    let column: HTMLElement | null = title;
    while (column && column.style.maxWidth === '') column = column.parentElement;
    expect(column?.style.maxWidth).toBe('672px');
    expect(column?.style.alignSelf).toBe('center');
  });

  it('stand the personal bests two to a row from the web\'s sm up, one to a row under it', async () => {
    const run = (runId: string, score: number): FinishedRun => ({
      format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: 1, score, netWorth: 50_000_000, status: 20,
      escapedAtRound: null, bankruptcies: 0, history: [300_000], badges: [], cities: ['madrid'], verified: false,
    });
    for (const [width, perRow] of [[800, 2], [600, 1]] as const) {
      restore = browserAt(width);
      const services = memoryServices();
      await services.store.addRun(run('a', 310));
      renderGame(<Records />, services);
      const list = within(await screen.findByRole('region', { name: 'Personal bests' })).getAllByRole('list')[0];
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(4);
      // Two side by side share the box of their row, two rows of them; one to a row, each is a child of the list itself.
      const rows = new Set(items.map((item) => item.parentElement));
      if (perRow === 2) expect([...rows].map((row) => within(row as HTMLElement).getAllByRole('listitem').length)).toEqual([2, 2]);
      else expect([...rows]).toEqual([list]);
      cleanup();
      restore();
      restore = null;
    }
  });
});
