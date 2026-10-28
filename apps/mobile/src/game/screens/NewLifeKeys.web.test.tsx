// @vitest-environment jsdom
import { lives, textFor } from '@ratrace/content';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame } from '../../testing/render';
import { KeyboardControls } from '../KeyboardHelp';
import { AmountSheet } from './AmountSheet';
import { NewLife } from './NewLife';

/*
 * The keyboard on the web away from a round (docs/keyboard.md): the grid of lives' arrows, letters and Enter, and an amount given with Ctrl/⌘ + Enter.
 */

afterEach(cleanup);

const key = (init: KeyboardEventInit, on: Element = document.activeElement ?? document.body) => act(() => void fireEvent.keyDown(on, init));
const { text } = textFor('en');
const open = lives.filter((life) => life.unlock === 'default');
const locked = lives.filter((life) => life.unlock !== 'default');
const tile = (id: string) => document.querySelector<HTMLElement>(`[data-life="${id}"]`) as HTMLElement;
const focused = () => document.activeElement?.getAttribute('data-life');

describe('the grid of lives with the keyboard', () => {
  it('is one Tab stop; the arrows move across a row and down a column, Home and End to the ends, letters to a life by its name; Enter opens its sheet', async () => {
    renderGame(
      <>
        <KeyboardControls />
        <NewLife />
      </>,
      memoryServices(),
    );
    await waitFor(() => expect(tile(open[0].id)).toBeTruthy());
    expect(tile(open[0].id).getAttribute('tabindex')).toBe('0');
    expect(tile(open[1].id).getAttribute('tabindex')).toBe('-1');
    act(() => tile(open[0].id).focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(focused()).toBe(open[1].id));
    expect(tile(open[1].id).getAttribute('tabindex')).toBe('0');
    // Down a column: three to a row.
    await key({ key: 'ArrowDown' });
    await waitFor(() => expect(focused()).toBe(open[4].id));
    await key({ key: 'ArrowLeft' });
    await waitFor(() => expect(focused()).toBe(open[3].id));
    await key({ key: 'ArrowUp' });
    await waitFor(() => expect(focused()).toBe(open[0].id));
    // From the tile in focus, wherever the Tab stop was left (a tile clicked, or focused by the sheet that closed).
    act(() => tile(open[2].id).focus());
    await key({ key: 'ArrowRight' });
    await waitFor(() => expect(focused()).toBe(open[3].id));
    // The locked lives are in the grid too, after the open ones.
    await key({ key: 'End' });
    await waitFor(() => expect(focused()).toBe(locked[locked.length - 1].id));
    await key({ key: 'Home' });
    await waitFor(() => expect(focused()).toBe(open[0].id));
    // Letters: the first life whose name starts with them.
    const target = open[open.length - 1];
    await key({ key: text.lives[target.id].name[0] });
    await waitFor(() => expect(text.lives[focused() ?? ''].name.toLocaleLowerCase().startsWith(text.lives[target.id].name[0].toLocaleLowerCase())).toBe(true));
    // Enter opens the sheet of the life in focus, and its Start is there to be reached.
    await key({ key: 'Home' });
    await waitFor(() => expect(focused()).toBe(open[0].id));
    // The tile is a native button: the browser turns its Enter into a click (jsdom does not, so the click is given here), and no shortcut takes it first.
    expect(document.activeElement?.tagName).toBe('BUTTON');
    await key({ key: 'Enter' });
    act(() => void fireEvent.click(document.activeElement ?? document.body));
    const sheet = (await screen.findByRole('heading', { name: /^Nurse · / })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(sheet).getByRole('button', { name: 'Start this life' })).toBeTruthy();
    act(() => void fireEvent.keyUp(document.activeElement ?? document.body, { key: 'Escape' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /^Nurse · / })).toBeNull());
    // And the reference says so.
    await key({ key: '?' }, document.body);
    const help = (await screen.findByRole('heading', { name: 'Keyboard controls' })).closest('[aria-modal="true"]') as HTMLElement;
    expect(within(help).getAllByText((_, element) => element?.textContent === '← ↑ → ↓ · Home / End · Enter').length).toBeGreaterThan(0);
  });
});

describe('an amount with the keyboard', () => {
  it('is given with Ctrl/⌘ + Enter from anywhere in its sheet, never for a key held down, and moved with the slider\'s keys', async () => {
    const onConfirm = vi.fn(() => true);
    renderGame(
      <>
        <KeyboardControls />
        <AmountSheet title="Save" max={100_000} start={10_000} onClose={() => {}} onConfirm={onConfirm} />
      </>,
      memoryServices(),
    );
    const slider = await screen.findByRole('slider');
    act(() => slider.focus());
    await key({ key: 'ArrowRight', shiftKey: true });
    const now = Number(slider.getAttribute('aria-valuenow'));
    expect(now).toBeGreaterThan(10_000);
    await key({ key: 'Enter', ctrlKey: true, repeat: true });
    expect(onConfirm).not.toHaveBeenCalled();
    await key({ key: 'Enter', metaKey: true });
    expect(onConfirm).toHaveBeenCalledWith(now);
  });
});
