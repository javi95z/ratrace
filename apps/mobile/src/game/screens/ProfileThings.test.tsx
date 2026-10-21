// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { Play } from './Play';

/*
 * The order in which the profile's sheets come and go, as iOS has it: a Modal hidden takes a moment to dismiss, and says when it has
 * (`onDismiss`). Here every Modal is held as it is drawn, and its dismissal is the test's to tell: a Modal presented while another is
 * still dismissing can fail on iOS, or leave that one half gone.
 */
const modals = vi.hoisted(() => ({ byId: new Map<string, { onDismiss?: () => void }>(), os: 'ios' }));
vi.mock('react-native', async () => {
  const rn = await vi.importActual<Record<string, unknown> & { Platform: object }>('react-native-web');
  const { useId } = await vi.importActual<typeof import('react')>('react');
  return {
    ...rn,
    Platform: { ...rn.Platform, get OS() { return modals.os; } },
    Modal: ({ visible, onDismiss, children }: { visible?: boolean; onDismiss?: () => void; children: ReactNode }) => {
      const id = useId();
      const shown = visible !== false;
      modals.byId.set(id, { onDismiss });
      return <div data-modal={id} data-visible={String(shown)}>{shown ? children : null}</div>;
    },
  };
});

beforeEach(() => {
  modals.byId.clear();
  modals.os = 'ios';
});
afterEach(cleanup);

/** A sheet by its title: the window that holds it. */
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;
/** The Modals hidden and not yet dismissed. */
const leaving = () => [...document.querySelectorAll('[data-modal][data-visible="false"]')];

describe('a thing opened from the list of things, in the profile', () => {
  it('opens once the list has gone, never while the list is still leaving', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'Open your profile' }));
    fireEvent.click(within(within(sheetTitled('Your life')).getByLabelText('Balance sheet')).getByRole('button', { name: /^Things/ }));
    const things = within(sheetTitled('Things')).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    fireEvent.click(things[0]);

    // The list is hidden and leaving; the thing waits for it.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Things' })).toBeNull());
    expect(leaving()).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Casio F-91W' })).toBeNull();
    expect(document.querySelectorAll('[data-modal]')).toHaveLength(2);

    // The list's Modal says it has dismissed: then, and only then, the thing comes, over the profile.
    const list = modals.byId.get(leaving()[0].getAttribute('data-modal') as string);
    act(() => list?.onDismiss?.());
    expect(sheetTitled('Casio F-91W')).toBeTruthy();
    expect(sheetTitled('Your life')).toBeTruthy();
    expect(leaving()).toHaveLength(0);
  });

  it('opens nothing later for a thing pressed before another line was opened in the list\'s place', async () => {
    const services = memoryServices();
    const session = await services.sessions.start('nurse');
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    renderGame(<Play />, services);
    fireEvent.click(await screen.findByRole('button', { name: 'Open your profile' }));
    const balance = () => within(sheetTitled('Your life')).getByLabelText('Balance sheet');
    fireEvent.click(within(balance()).getByRole('button', { name: /^Things/ }));
    const things = within(sheetTitled('Things')).getAllByRole('button').filter((b) => b.getAttribute('aria-label') !== 'Close');
    fireEvent.click(things[0]);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Things' })).toBeNull());
    // While the list leaves, another line is opened in its place: the thing pressed in the list is let go.
    fireEvent.click(within(balance()).getByRole('button', { name: /^Cash/ }));
    fireEvent.click(within(sheetTitled('Cash')).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cash' })).toBeNull());
    for (const one of leaving()) act(() => modals.byId.get(one.getAttribute('data-modal') as string)?.onDismiss?.());
    expect(leaving()).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Casio F-91W' })).toBeNull();
    expect(sheetTitled('Your life')).toBeTruthy();
  });
});
