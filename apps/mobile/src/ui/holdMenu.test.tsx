// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HapticProvider, type Haptic } from './haptic';
import { HOLD_MS, useHoldMenu, type HoldAction } from './holdMenu';

/*
 * A thing's menu, opened by a long press (holdMenu.tsx): felt as the long press it is, a sheet that names the thing and lists what can be done, each
 * choice done once the sheet has gone, and the same choices for a screen reader. The long press itself is the platform's (`onLongPress`): pressed here.
 */

// The sheet is the overlay's own, held to it in its tests: here one that opens and closes at once, and says it has gone once closed.
vi.mock('./overlay', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    Sheet: ({ open, onClose, onGone, title, closeLabel, children }: { open: boolean; onClose(): void; onGone?(): void; title: string; closeLabel: string; children: React.ReactNode }) => {
      const was = useRef(open);
      useEffect(() => {
        if (was.current && !open) setTimeout(() => onGone?.(), 0);
        was.current = open;
      }, [open, onGone]);
      return open ? (
        <div role="dialog">
          <h2>{title}</h2>
          {children}
          <button type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      ) : null;
    },
  };
});
vi.mock('./Sprite', () => ({ Sprite: ({ id }: { id: string }) => <div data-sprite={id} /> }));

afterEach(cleanup);

const done: string[] = [];
afterEach(() => void (done.length = 0));

function Thing({ actions }: { actions: readonly HoldAction[] }) {
  const { held, menu } = useHoldMenu({ title: 'S&P 500', closeLabel: 'Close', actions });
  return (
    <>
      <button type="button" onClick={() => held.onLongPress?.()} data-delay={held.delayLongPress}>
        hold
      </button>
      <button type="button" onClick={() => held.onAccessibilityAction?.({ nativeEvent: { actionName: 'hold-1' } } as never)}>
        {`reader: ${(held.accessibilityActions ?? []).map((one) => one.label).join(', ')}`}
      </button>
      {menu}
    </>
  );
}

const ACTIONS: HoldAction[] = [
  { label: 'Buy more', onPress: () => void done.push('buy') },
  { label: 'Sell it all', onPress: () => void done.push('sell all'), danger: true },
];

function holding(actions = ACTIONS) {
  const felt: Haptic[] = [];
  render(
    <HapticProvider value={(kind) => void felt.push(kind)}>
      <Thing actions={actions} />
    </HapticProvider>,
  );
  return felt;
}

it('opens on a long press, felt as one: the thing named, what can be done with it, and its choice done once the sheet has gone', async () => {
  const felt = holding();
  expect(screen.getByRole('button', { name: 'hold' }).getAttribute('data-delay')).toBe(String(HOLD_MS));
  expect(screen.queryByRole('heading', { name: 'S&P 500' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'hold' }));
  expect(felt).toEqual(['hold']);
  expect(screen.getByRole('heading', { name: 'S&P 500' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Sell it all' }));
  // Nothing done while the sheet is still there: a choice that opens a sheet of its own never opens it over this one.
  expect(done).toEqual([]);
  await waitFor(() => expect(done).toEqual(['sell all']));
  expect(screen.queryByRole('heading', { name: 'S&P 500' })).toBeNull();
});

it('closed with nothing chosen, does nothing', async () => {
  holding();
  fireEvent.click(screen.getByRole('button', { name: 'hold' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'S&P 500' })).toBeNull());
  await act(async () => undefined);
  expect(done).toEqual([]);
});

it('gives a screen reader the same choices, done at once', () => {
  holding();
  fireEvent.click(screen.getByRole('button', { name: 'reader: Buy more, Sell it all' }));
  expect(done).toEqual(['sell all']);
});

it('is nothing to hold where there is nothing to do', () => {
  const felt = holding([]);
  expect(screen.getByRole('button', { name: 'hold' }).getAttribute('data-delay')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'hold' }));
  expect(felt).toEqual([]);
  expect(screen.queryByRole('heading')).toBeNull();
});
